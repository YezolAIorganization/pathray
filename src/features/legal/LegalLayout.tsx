import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-midnight text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-21 w-full max-w-300 items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Pathray home" className="inline-flex">
            <img src="/brand/pathray-logo-dark.svg" alt="Pathray" width={128} height={45} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-160 px-4 py-10 sm:py-16">
        <h1 className="text-h2">{title}</h1>
        <p className="mt-2 text-sm text-white/70">Last updated {updated}</p>
        <div className="mt-8 grid gap-8 text-white/85">{children}</div>
        <p className="mt-10 text-sm text-white/70">
          <Link to="/privacy" className="underline">
            Privacy policy
          </Link>{' '}
          ·{' '}
          <Link to="/terms" className="underline">
            Terms
          </Link>{' '}
          ·{' '}
          <Link to="/" className="underline">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}