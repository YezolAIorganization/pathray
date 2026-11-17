import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/money';
import { getAccountState, type AccountState } from '../account/account';

type Journey = { id: string; status: string; funding_tier: string | null; market_id: string };
type Order = { id: string; reference: string; amount: number; currency: string; is_paid: boolean };
type Price = { price: number; currency: string };
type HomeData = { journey: Journey | null; order: Order | null; price: Price | null };

const STATUS_LABEL: Record<string, string> = {
  quick_check: 'Quick Check done',
  awaiting_payment: 'Waiting for your payment',
  payment_review: 'Payment under review',
  awaiting_profile: 'Complete your profile',
  in_research: 'Research in progress',
  in_review: 'Report being reviewed',
  delivered: 'Report delivered',
  closed: 'Closed',
};

const LOCALES: Record<string, string> = { PKR: 'en-PK', INR: 'en-IN', USD: 'en-US' };

function money(amount: number, currency: string) {
  return formatMoney(Number(amount), currency, LOCALES[currency] ?? 'en-US');
}

async function loadHome(): Promise<HomeData> {
  const { data: journeys, error } = await supabase
    .from('journeys')
    .select('id,status,funding_tier,market_id')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;

  const journey = (journeys as Journey[] | null)?.[0] ?? null;
  if (!journey) return { journey: null, order: null, price: null };

  const { data: orders } = await supabase
    .from('orders')
    .select('id,reference,amount,currency,is_paid')
    .eq('journey_id', journey.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const order = (orders as Order[] | null)?.[0] ?? null;

  let price: Price | null = null;
  const { data: services } = await supabase.from('services').select('id').eq('slug', 'report').limit(1);
  const serviceId = (services as { id: string }[] | null)?.[0]?.id;
  if (serviceId) {
    const { data: prices } = await supabase
      .from('service_market_prices')
      .select('price,currency')
      .eq('service_id', serviceId)
      .eq('market_id', journey.market_id)
      .limit(1);
    price = (prices as Price[] | null)?.[0] ?? null;
  }

  return { journey, order, price };
}

export function HomePage() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const state = await getAccountState();
      setAccount(state);
      if (state.userId && !state.isAnonymous) {
        setData(await loadHome());
      }
    } catch (e) {
      console.error('Could not load home:', e);
      setError('We could not load your journey. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function placeOrder() {
    if (!data?.journey || ordering) return;
    setOrdering(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('place_order', {
      p_journey_id: data.journey.id,
      p_service_slug: 'report',
    });
    if (rpcError) {
      console.error('place_order failed:', rpcError);
      setError('We could not create your order. Please try again.');
    } else {
      await refresh();
    }
    setOrdering(false);
  }

  const signedIn = Boolean(account && !account.isAnonymous && account.email);
  const journey = data?.journey ?? null;
  const order = data?.order ?? null;
  const price = data?.price ?? null;
  const tier = journey?.funding_tier?.replace('tier_', '').toUpperCase() ?? null;

  return (
    <div
      className="relative isolate min-h-svh bg-midnight text-white"
      style={{
        backgroundImage:
          'radial-gradient(60rem 40rem at 85% -10%, rgb(43 74 140 / 0.35), transparent 60%), radial-gradient(50rem 36rem at 0% 40%, rgb(27 47 94 / 0.45), transparent 60%)',
      }}
    >
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-21 w-full max-w-300 items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Pathray home" className="inline-flex">
            <img src="/brand/pathray-logo-dark.svg" alt="Pathray" width={128} height={45} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-160 px-4 py-10 sm:py-16">
        {loading && <p role="status">Loading your journey...</p>}

        {!loading && !signedIn && (
          <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
            <h1 className="text-h2">Sign in to see your journey</h1>
            <p className="mt-3 text-white/70">
              Open the confirmation link from your email in this browser, or take the free Quick
              Check first.
            </p>
            <Link
              to="/check"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control bg-white px-5 font-medium text-navy no-underline"
            >
              Take the Quick Check
            </Link>
          </div>
        )}

        {!loading && signedIn && !journey && (
          <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
            <h1 className="text-h2">No journey yet</h1>
            <p className="mt-3 text-white/70">Take the free Quick Check to start.</p>
            <Link
              to="/check"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control bg-white px-5 font-medium text-navy no-underline"
            >
              Take the Quick Check
            </Link>
          </div>
        )}

        {!loading && signedIn && journey && (
          <div className="grid gap-4">
            <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
              <p className="text-sm text-white/70">Your journey</p>
              <div className="mt-3 flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 font-heading text-2xl"
                >
                  {tier ?? '?'}
                </span>
                <div>
                  <h1 className="text-h2">Funding tier {tier ?? 'not set'}</h1>
                  <p className="text-white/70">
                    {STATUS_LABEL[journey.status] ?? journey.status}
                  </p>
                </div>
              </div>
            </div>

            {!order && journey.status === 'quick_check' && (
              <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
                <h2 className="text-xl">Pathray Report</h2>
                <p className="mt-2 text-white/70">
                  A funding-first report on your study options, researched from official sources,
                  with the source and check date for every fact. Delivered in up to 48 hours after
                  your payment is confirmed and your profile is complete.
                </p>
                {price && (
                  <p className="mt-4 font-heading text-2xl">{money(price.price, price.currency)}</p>
                )}
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={ordering || !price}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-white px-5 font-medium text-navy transition-transform duration-150 ease-pathray enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ordering ? 'Creating your order...' : 'Get your Pathray Report'}
                </button>
              </div>
            )}

            {order && (
              <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
                <h2 className="text-xl">Your order</h2>
                <dl className="mt-4 grid gap-3">
                  <div>
                    <dt className="text-sm text-white/70">Reference</dt>
                    <dd className="font-heading text-2xl">{order.reference}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-white/70">Amount</dt>
                    <dd className="text-lg">{money(order.amount, order.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-white/70">Status</dt>
                    <dd className="text-lg">{order.is_paid ? 'Paid' : 'Waiting for your payment'}</dd>
                  </div>
                </dl>
                {!order.is_paid && (
                  <p className="mt-5 rounded-control border border-white/12 bg-white/5 p-4 text-white/80">
                    Payment details are coming soon. When they are ready, you will see where to send
                    your payment here. Keep your reference, you will need it.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-white">
                {error}
              </p>
            )}
          </div>
        )}

        {!loading && error && !journey && (
          <p role="alert" className="mt-4 text-sm font-medium text-white">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

export default HomePage;