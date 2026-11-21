import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/money';
import { ReportBuilder } from './ReportBuilder';

type JourneyAdmin = {
  id: string;
  student_id?: string;
  status: string;
  funding_tier: string | null;
  market_id: string;
  created_at: string;
  sla_deadline?: string | null;
  timer_started_at?: string | null;
  timer_deadline_at?: string | null;
};

type OrderAdmin = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  is_paid: boolean;
};

type ProofAdmin = {
  id: string;
  payment_method: string;
  trx_id: string | null;
  status: string;
  proof_file_path: string | null;
  reject_reason: string | null;
  created_at: string;
};

type ProfileSubmissionRow = {
  id: string;
  journey_id: string;
  student_id: string;
  details: Record<string, unknown> | null;
  submitted_at: string;
  updated_at: string;
};

// Must match advance_journey_status in the database (migration 0018).
// awaiting_profile to in_research is done by the student's submit_profile, not by an admin.
const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  in_research: ['in_review'],
  in_review: ['in_research'],
  delivered: ['closed'],
};

const STATUS_HINT: Record<string, string> = {
  quick_check: 'The student has not ordered the report yet.',
  awaiting_payment: 'Waiting for the student to pay and send a payment proof.',
  payment_review: 'Review the payment proof above, then confirm or reject the payment.',
  awaiting_profile:
    'Waiting for the student to submit their profile. The case moves to research and the 48-hour clock starts when they do.',
  in_research: 'Research is in progress.',
  in_review: 'The report is being reviewed.',
  delivered: 'The report is delivered.',
  closed: 'This case is closed.',
};

export function AdminPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [journeys, setJourneys] = useState<JourneyAdmin[]>([]);
  const [marketCodes, setMarketCodes] = useState<Record<string, string>>({});
  const [selectedJourney, setSelectedJourney] = useState<JourneyAdmin | null>(null);
  const [order, setOrder] = useState<OrderAdmin | null>(null);
  const [proof, setProof] = useState<ProofAdmin | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<ProfileSubmissionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin');
    if (roleError || !isAdmin) {
      navigate('/home', { replace: true });
      return;
    }

    setAuthorized(true);

    const [journeysRes, marketsRes] = await Promise.all([
      supabase.from('journeys').select('*').order('created_at', { ascending: false }),
      supabase.from('markets').select('id, country_code'),
    ]);

    if (journeysRes.error) {
      console.error('Failed to load admin queue:', journeysRes.error);
      setError('Could not load admin queue.');
    } else {
      setJourneys((journeysRes.data as JourneyAdmin[]) ?? []);
    }

    if (!marketsRes.error && marketsRes.data) {
      const map: Record<string, string> = {};
      for (const m of marketsRes.data as { id: string; country_code: string }[]) {
        map[m.id] = m.country_code;
      }
      setMarketCodes(map);
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  function formatMarket(marketId: string) {
    return marketCodes[marketId] ?? marketId;
  }

  async function selectJourney(j: JourneyAdmin) {
    setSelectedJourney(j);
    setOrder(null);
    setProof(null);
    setProofUrl(null);
    setStudentProfile(null);

    const { data: submissions, error: subError } = await supabase
      .from('profile_submissions')
      .select('id, journey_id, student_id, details, submitted_at, updated_at')
      .eq('journey_id', j.id)
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (subError) {
      console.error('Failed to load profile submission:', subError);
    } else if (submissions && submissions.length > 0) {
      setStudentProfile(submissions[0] as ProfileSubmissionRow);
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, reference, amount, currency, is_paid')
      .eq('journey_id', j.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentOrder = (orders?.[0] as OrderAdmin | undefined) ?? null;
    setOrder(currentOrder);

    if (currentOrder) {
      const { data: proofs, error: proofError } = await supabase.rpc(
        'admin_get_payment_for_order',
        { p_order_id: currentOrder.id },
      );
      if (proofError) {
        console.error('admin_get_payment_for_order failed:', proofError);
      }

      const currentProof = ((proofs as ProofAdmin[] | null)?.[0] as ProofAdmin | undefined) ?? null;
      setProof(currentProof);

      if (currentProof?.proof_file_path) {
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(currentProof.proof_file_path, 3600);
        if (signed?.signedUrl) {
          setProofUrl(signed.signedUrl);
        }
      }
    }
  }

  async function handleConfirmPayment(orderId: string) {
    if (busy) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('confirm_payment', { p_order_id: orderId });
    if (rpcError) {
      console.error('confirm_payment failed:', rpcError);
      alert('Failed to confirm payment.');
    } else {
      await loadQueue();
      if (selectedJourney) {
        await selectJourney({ ...selectedJourney, status: 'awaiting_profile' });
      }
    }
    setBusy(false);
  }

  async function handleRejectPayment(orderId: string) {
    if (busy) return;
    const reason = prompt('Reason for rejection:') ?? 'Incorrect payment proof';
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('reject_payment', {
      p_order_id: orderId,
      p_reason: reason,
    });
    if (rpcError) {
      console.error('reject_payment failed:', rpcError);
      alert('Failed to reject payment.');
    } else {
      await loadQueue();
      if (selectedJourney) {
        await selectJourney({ ...selectedJourney, status: 'awaiting_payment' });
      }
    }
    setBusy(false);
  }

  async function handleAdvanceStatus(journeyId: string, nextStatus: string) {
    if (busy) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('advance_journey_status', {
      p_journey_id: journeyId,
      p_new_status: nextStatus,
    });
    if (rpcError) {
      console.error('advance_journey_status failed:', rpcError);
      alert('Failed to update status.');
    } else {
      await loadQueue();
      if (selectedJourney) {
        setSelectedJourney({ ...selectedJourney, status: nextStatus });
      }
    }
    setBusy(false);
  }

  if (!authorized && loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-midnight text-white">
        <p role="status">Checking admin access...</p>
      </div>
    );
  }

  const allowedNext = selectedJourney ? (ALLOWED_NEXT_STATUSES[selectedJourney.status] ?? []) : [];

  return (
    <div className="min-h-svh bg-midnight text-white">
      <header className="border-b border-white/10 p-4">
        <div className="mx-auto flex max-w-300 items-center justify-between">
          <Link to="/" className="font-heading text-xl">
            Pathray Admin
          </Link>
          <button
            type="button"
            onClick={loadQueue}
            className="rounded-control bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-300 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5">
          <h2 className="text-xl font-medium">Journeys Queue ({journeys.length})</h2>
          {loading && <p className="mt-4 text-white/70">Loading queue...</p>}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <div className="mt-4 grid gap-2">
            {journeys.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => selectJourney(j)}
                className={`w-full rounded-control border p-3 text-left transition-colors ${
                  selectedJourney?.id === j.id
                    ? 'border-cyan bg-white/15'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="font-medium">
                  Tier {j.funding_tier?.replace('tier_', '').toUpperCase() ?? '?'} (
                  {formatMarket(j.market_id)})
                </div>
                <div className="text-sm text-white/70">Status: {j.status}</div>
                <div className="mt-1 text-xs text-white/50">
                  {new Date(j.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 md:col-span-1 lg:col-span-2">
          {selectedJourney ? (
            <div>
              <h2 className="text-xl font-medium">Case Details</h2>
              <div className="mt-4 grid gap-2 text-sm text-white/80">
                <div>
                  <strong className="text-white">Journey ID:</strong> {selectedJourney.id}
                </div>
                <div>
                  <strong className="text-white">Market:</strong> {formatMarket(selectedJourney.market_id)}
                </div>
                <div>
                  <strong className="text-white">Status:</strong> {selectedJourney.status}
                </div>
                {selectedJourney.timer_deadline_at && (
                  <div>
                    <strong className="text-white">48h Timer Deadline:</strong>{' '}
                    {new Date(selectedJourney.timer_deadline_at).toLocaleString()}
                  </div>
                )}
                {!selectedJourney.timer_deadline_at && selectedJourney.sla_deadline && (
                  <div>
                    <strong className="text-white">48h SLA Deadline:</strong>{' '}
                    {new Date(selectedJourney.sla_deadline).toLocaleString()}
                  </div>
                )}
              </div>

              {order && (
                <div className="mt-6 border-t border-white/12 pt-4">
                  <h3 className="text-lg font-medium">Order: {order.reference}</h3>
                  <p className="mt-1 text-sm text-white/70">
                    Amount: {formatMoney(order.amount, order.currency, 'en-US')}
                  </p>
                  <p className="text-sm text-white/70">
                    Paid Status: {order.is_paid ? 'Confirmed Paid' : 'Unpaid'}
                  </p>

                  {proof && (
                    <div className="mt-4 rounded-control border border-white/15 bg-white/5 p-4 text-sm">
                      <div className="font-medium text-white">Submitted Payment Proof</div>
                      <div className="mt-2 grid gap-1 text-white/80">
                        <div>
                          <strong className="text-white">Method:</strong> {proof.payment_method}
                        </div>
                        <div>
                          <strong className="text-white">Transaction ID:</strong>{' '}
                          {proof.trx_id || 'None provided'}
                        </div>
                        <div>
                          <strong className="text-white">Payment status:</strong> {proof.status}
                        </div>
                        <div>
                          <strong className="text-white">Submitted:</strong>{' '}
                          {new Date(proof.created_at).toLocaleString()}
                        </div>
                      </div>
                      {proofUrl && (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex min-h-10 items-center rounded-control bg-white px-4 text-sm font-medium text-navy no-underline"
                        >
                          View Payment Receipt
                        </a>
                      )}
                    </div>
                  )}

                  {!order.is_paid && (
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleConfirmPayment(order.id)}
                        className="rounded-control bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        Confirm Payment
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRejectPayment(order.id)}
                        className="rounded-control bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Reject Payment
                      </button>
                    </div>
                  )}
                </div>
              )}

              {studentProfile && (
                <div className="mt-6 border-t border-white/12 pt-4">
                  <h3 className="text-lg font-medium">Student Profile</h3>
                  <p className="mt-1 text-xs text-white/60">
                    Submitted: {new Date(studentProfile.submitted_at).toLocaleString()}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-control border border-white/10 bg-white/5 p-3 text-xs text-white/85">
                    {JSON.stringify(studentProfile.details ?? studentProfile, null, 2)}
                  </pre>
                </div>
              )}

              <div className="mt-6 border-t border-white/12 pt-4">
                <h3 className="text-lg font-medium">Advance Journey Status</h3>
                {allowedNext.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allowedNext.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdvanceStatus(selectedJourney.id, status)}
                        className="rounded-control border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 disabled:opacity-30"
                      >
                        Set to {status}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-white/60">
                    {STATUS_HINT[selectedJourney.status] ??
                      `No direct admin status advance from ${selectedJourney.status}.`}
                  </p>
                )}
              </div>

              <ReportBuilder
                journeyId={selectedJourney.id}
                onPublished={async () => {
                  await loadQueue();
                  setSelectedJourney((prev) => (prev ? { ...prev, status: 'delivered' } : null));
                }}
              />
            </div>
          ) : (
            <p className="text-white/70">
              Select a journey from the queue to inspect cases, verify payment proofs, and build
              funding reports.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default AdminPage;