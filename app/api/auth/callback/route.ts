import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthClient, AuthError } from '@wilsoon/auth-core';
import { ServerCookieStorage } from '@wilsoon/auth-next';
import { AUTH_ATTEMPT_COOKIE, authConfig } from '@/lib/auth-config';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const client = new AuthClient(authConfig, new ServerCookieStorage(cookieStore));

  try {
    // `persistTokens` is what writes the session cookie - without it the code is
    // exchanged, the user is verified, and the tokens are then thrown away
    const { user } = await client.handleCallback(request.url, { persistTokens: true });

    if (!user || user.role !== 'admin') {
      client.clearStorage();
      cookieStore.delete(AUTH_ATTEMPT_COOKIE);
      return NextResponse.redirect(new URL('/admin/login?error=forbidden', request.url));
    }

    cookieStore.delete(AUTH_ATTEMPT_COOKIE);
    return NextResponse.redirect(new URL('/admin', request.url));
  } catch (error) {
    const code = error instanceof AuthError ? (error.code ?? 'AUTH_FAILED') : 'AUTH_FAILED';
    console.error('[auth/callback] failed:', code, error);
    return NextResponse.redirect(new URL(`/admin/login?error=${code.toLowerCase()}`, request.url));
  }
}
