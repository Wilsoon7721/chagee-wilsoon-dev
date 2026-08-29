import { createAuthMiddleware } from '@wilsoon/auth-next';
import { authConfig } from './lib/auth-config';

export const proxy = createAuthMiddleware({
  ...authConfig,
  loginPath: '/admin/login',
  unauthorizedPath: '/admin/login?error=forbidden',
  roles: ['admin']
});

export const config = {
  matcher: ['/admin/((?!login$).*)']
};
