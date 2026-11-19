import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendSignInLink } from './account';

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address, like name@example.com.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await sendSignInLink(value);
      setSent(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (/signups? not allowed|not found/i.test(message)) {
        // Same answer for unknown emails, so nobody can check who has an account.
        setSent(true);
      } else {
        console.error('Sign-in link failed:', e);
        setError('We could not send the link. Please try again in a few minutes.');
      }
    } finally {
      setBusy(false);
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
        <div className="mx-auto flex h-[84px] w-full max-w-[1200px] items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Pathray home" className="inline-flex">
            <img src="/brand/pathray-logo-dark.svg" alt="Pathray" width={128} height={45} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] px-4 py-10 sm:py-16">
        <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] sm:p-8">
          <h1 className="text-h2">Sign in</h1>

          {sent ? (
            <p role="status" className="mt-4 text-white/80">
              If an account exists for {email.trim()}, we sent a sign-in link. Open it in this
              browser. Check your spam folder if you do not see it.
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="mt-4">
              <p className="text-white/70">
                Enter your email and we will send you a link. No password needed.
              </p>
              <label htmlFor="signin-email" className="mt-5 block font-medium">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'signin-error' : undefined}
                className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-white/5 px-4 text-base text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
              />
              {error && (
                <p id="signin-error" role="alert" className="mt-3 text-sm font-medium text-white">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-white px-5 font-medium text-navy transition-transform duration-150 ease-pathray enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Sending...' : 'Email me a sign-in link'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default SignInPage;