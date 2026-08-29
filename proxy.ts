import { createAuthMiddleware } from '@wilsoon/auth-next';
import { authConfig } from './lib/auth-config';

export const proxy = createAuthMiddleware({
  ...authConfig,
  loginPath: '/admin/login',
  unauthorizedPath: '/admin/login',
  roles: ['admin']
});

export const config = {
  matcher: ['/admin', '/admin/((?!login$).*)']
};
