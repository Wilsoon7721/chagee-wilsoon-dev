import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthClient } from '@wilsoon/auth-core';
import { ServerCookieStorage } from '@wilsoon/auth-next';
import { authConfig } from '@/lib/auth-config';

export async function GET(request: Request) {
  const storage = new ServerCookieStorage(await cookies());
  const client = new AuthClient(authConfig, storage);

  const tokens = client.getStoredTokens();
  const postLogoutUri = new URL('/', request.url).toString();
  storage.removeItem('wilsoon_id_tokens');

  if (tokens?.id_token)
    try {
      const logoutUrl = await client.getLogoutUrl(tokens.id_token, postLogoutUri);
      return NextResponse.redirect(logoutUrl);
    } catch {}

  return NextResponse.redirect(new URL('/', request.url));
}
