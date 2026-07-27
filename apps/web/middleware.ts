import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtected = createRouteMatcher(['/dashboard(.*)', '/admin(.*)', '/api(.*)']);

export default clerkMiddleware((auth, req) => {
  if (isProtected(req)) auth().protect();
});

export const config = { matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js|jpg|png|svg|ico)).*)', '/(api|trpc)(.*)'] };
