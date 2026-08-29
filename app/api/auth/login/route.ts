import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AuthClient } from '@wilsoon/auth-core';
import { ServerCookieStorage } from '@wilsoon/auth-next';
import { authConfig } from '@/lib/auth-config';

export async function GET() {
  const client = new AuthClient(authConfig, new ServerCookieStorage(await cookies()));
  const { url } = await client.createAuthorizeUrl();
  return NextResponse.redirect(url);
}
