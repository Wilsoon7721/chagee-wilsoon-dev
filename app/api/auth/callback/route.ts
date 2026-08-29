import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthClient, AuthError } from '@wilsoon/auth-core';
import { ServerCookieStorage } from '@wilsoon/auth-next';
import { authConfig } from '@/lib/auth-config';

export async function GET(request: Request) {
  const client = new AuthClient(authConfig, new ServerCookieStorage(await cookies()));

  try {
    const { user } = await client.handleCallback(request.url);
    if (!user || user.role !== 'admin') return NextResponse.redirect(new URL('/admin/login?error=forbidden', request.url));

    return NextResponse.redirect(new URL('/admin', request.url));
  } catch (error) {
    const code = error instanceof AuthError ? (error.code ?? 'AUTH_FAILED') : 'AUTH_FAILED';
    console.error('[auth/callback] failed:', code, error);
    return NextResponse.redirect(new URL(`/admin/login?error=${code.toLowerCase()}`, request.url));
  }
}
