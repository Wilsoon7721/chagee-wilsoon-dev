import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthClient } from '@wilsoon/auth-core';
import { ServerCookieStorage } from '@wilsoon/auth-next';
import { AUTH_ATTEMPT_COOKIE, MAX_AUTH_ATTEMPTS, authConfig } from '@/lib/auth-config';

export async function GET(request: Request) {
  const cookieStore = await cookies();

  // If we have bounced through the authorization server this many times without ever
  // landing on a session, stop and show the error instead of looping forever
  const attempts = Number(cookieStore.get(AUTH_ATTEMPT_COOKIE)?.value) || 0;
  if (attempts >= MAX_AUTH_ATTEMPTS) {
    cookieStore.delete(AUTH_ATTEMPT_COOKIE);
    return NextResponse.redirect(new URL('/admin/login?error=auth_failed', request.url));
  }

  const client = new AuthClient(authConfig, new ServerCookieStorage(cookieStore));
  const { url } = await client.createAuthorizeUrl();

  cookieStore.set(AUTH_ATTEMPT_COOKIE, String(attempts + 1), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 300
  });

  return NextResponse.redirect(url);
}
