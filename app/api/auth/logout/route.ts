import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthClient } from '@wilsoon/auth-core';
import { ServerCookieStorage } from '@wilsoon/auth-next';
import { AUTH_ATTEMPT_COOKIE, authConfig } from '@/lib/auth-config';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const client = new AuthClient(authConfig, new ServerCookieStorage(cookieStore));

  const tokens = client.getStoredTokens();
  const postLogoutUri = new URL('/', request.url).toString();

  // Clears the token cookie and any leftover state/nonce/verifier cookies
  client.clearStorage();
  cookieStore.delete(AUTH_ATTEMPT_COOKIE);

  if (tokens?.id_token)
    try {
      const logoutUrl = await client.getLogoutUrl(tokens.id_token, postLogoutUri);
      return NextResponse.redirect(logoutUrl);
    } catch {}

  return NextResponse.redirect(new URL('/', request.url));
}
