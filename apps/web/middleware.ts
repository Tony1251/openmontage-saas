const isMock = process.env.MOCK_MODE === 'true';

export default async function middleware(req: any) {
  if (isMock) return; // bypass auth in dev mock mode

  // Dynamic import to avoid eager key validation
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isProtected = createRouteMatcher(['/dashboard(.*)', '/admin(.*)', '/api(.*)']);
  return clerkMiddleware((auth: any, req2: any) => {
    if (isProtected(req2)) auth().protect();
  })(req);
}

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js|jpg|png|svg|ico)).*)', '/(api|trpc)(.*)'],
};
