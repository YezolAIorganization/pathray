import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithGoogle } from './account';

export function SignInPage() {
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setError(null);
    try {
      // The browser leaves for Google and comes back to /account.
      await signInWithGoogle();
    } catch (e) {
      console.error('Google sign-in failed:', e);
      setError('We could not start Google sign-in. Please try again.');
      setGoogleBusy(false);
    }
  }

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

      <main className="mx-auto w-full max-w-120 px-4 py-10 sm:py-16">
        <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] sm:p-8">
          <h1 className="text-h2">Sign in</h1>
          <p className="mt-3 text-white/70">
            Sign in with the Google account you used when you saved your Quick Check result. No
            password needed.
          </p>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={googleBusy}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-white px-5 font-medium text-navy transition-transform duration-150 ease-pathray enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {googleBusy ? 'Opening Google...' : 'Continue with Google'}
          </button>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-white">
              {error}
            </p>
          )}

          <p className="mt-5 text-sm text-white/70">
            New here?{' '}
            <Link to="/check" className="underline">
              Take the free Quick Check
            </Link>{' '}
            first.
          </p>
        </div>
      </main>
    </div>
  );
}

export default SignInPage;