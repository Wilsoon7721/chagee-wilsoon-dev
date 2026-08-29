import 'server-only';
import type { AuthConfig } from '@wilsoon/auth-core';

if (!process.env.WILSOON_CLIENT_ID) throw new Error('Missing WILSOON_CLIENT_ID env var');
if (!process.env.WILSOON_CLIENT_SECRET) throw new Error('Missing WILSOON_CLIENT_SECRET env var');

const appUrl = process.env.NODE_ENV === 'production' ? 'https://chagee.wilsoon.dev' : 'http://localhost:3000';

export const authConfig: AuthConfig = {
  clientId: process.env.WILSOON_CLIENT_ID!,
  clientSecret: process.env.WILSOON_CLIENT_SECRET,
  issuer: 'https://id.wilsoon.dev',
  redirectUri: `${appUrl}/api/auth/callback`,
  scope: ['openid', 'profile', 'email']
};
