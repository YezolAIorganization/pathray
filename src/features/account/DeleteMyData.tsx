import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Step = 'idle' | 'confirm' | 'working';

export function DeleteMyData() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (step === 'working') return;
    setStep('working');
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('delete_my_data');

    if (rpcError) {
      console.error('delete_my_data failed:', rpcError);
      setError('We could not delete your data. Please message us on WhatsApp and we will do it.');
      setStep('confirm');
      return;
    }

    const paths = ((data as { proof_paths?: string[] } | null)?.proof_paths ?? []).filter(Boolean);
    let filesFailed = false;

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('payment-proofs').remove(paths);
      if (removeError) {
        console.error('Could not remove receipt files:', removeError);
        filesFailed = true;
      }
    }

    await supabase.auth.signOut();

    if (filesFailed) {
      window.alert(
        'Your details were erased, but we could not remove your receipt files. Please message us on WhatsApp so we can remove them.',
      );
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
      <h2 className="text-xl">Delete my data</h2>
      <p className="mt-2 text-white/70">
        This erases your name, phone, email, Quick Check answers, profile form, report and payment
        receipt files. We keep a record of any order you placed (reference, amount and dates)
        for our accounts, with none of your personal details attached. This cannot be undone.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-white">
          {error}
        </p>
      )}

      {step === 'idle' && (
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control border border-white/25 px-5 font-medium text-white transition-transform duration-150 ease-pathray active:scale-[0.97]"
        >
          Delete my data
        </button>
      )}

      {step !== 'idle' && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={step === 'working'}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-white px-5 font-medium text-navy transition-transform duration-150 ease-pathray enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === 'working' ? 'Deleting...' : 'Yes, delete everything'}
          </button>
          <button
            type="button"
            onClick={() => setStep('idle')}
            disabled={step === 'working'}
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-white/25 px-5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Keep my data
          </button>
        </div>
      )}
    </div>
  );
}