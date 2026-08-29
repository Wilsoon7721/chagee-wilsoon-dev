import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@wilsoon/auth-next/server';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/auth-config';

export const metadata: Metadata = {
  title: 'Admin Login | CHAGEE Tool | Wilson Oon'
};

// Error messages shown for each error code the callback or proxy may send back
const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'Your account does not have admin access.',
  state_mismatch: 'Login session expired or was tampered with. Please try again.',
  nonce_mismatch: 'Login session mismatch. Please try again.',
  invalid_callback: 'Login attempt expired. Please try again.',
  token_verification_failed: 'Could not verify your identity. Please try again.',
  auth_failed: 'Sign-in failed. Please try again.'
};

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  // If there's already a valid admin session, go straight to the dashboard
  const { user } = await getSession(authConfig);
  if (user?.role === 'admin') redirect('/admin');

  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.auth_failed) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">CHAGEE Tool</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Admin access</h1>
        </div>

        {/* Error */}
        {errorMessage && (
          <div role="alert" className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900">
            {errorMessage}
          </div>
        )}

        <Link href="/api/auth/login" className="flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Sign In
        </Link>

        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">Access is restricted to authorised administrators.</p>
      </div>
    </div>
  );
}
