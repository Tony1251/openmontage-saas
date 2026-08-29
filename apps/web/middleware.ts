import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtected = createRouteMatcher(['/dashboard(.*)', '/admin(.*)', '/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Bypass auth entirely in mock mode (dev / demo without Clerk).
  if (process.env.MOCK_MODE === 'true') return;
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js|jpg|png|svg|ico)).*)', '/(api|trpc)(.*)'],
};
