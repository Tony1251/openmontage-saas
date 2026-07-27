// Mock auth helper for MOCK_MODE — bypasses Clerk dependency.
// In MOCK_MODE, returns a fake token so API calls succeed.

const isMock = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('mock') === 'true' ||
    document.cookie.includes('mock_mode=true') ||
    process.env.NEXT_PUBLIC_MOCK_MODE === 'true' ||
    (typeof process !== 'undefined' && process.env.MOCK_MODE === 'true')
  : process.env.MOCK_MODE === 'true';

export function isMockMode(): boolean {
  return isMock;
}

// Mock useAuth for MOCK_MODE — replaces Clerk's useAuth()
export function useMockAuth() {
  return {
    userId: 'mock-user-1',
    getToken: async () => 'sk_test_demo_mock_token_for_dev',
    isLoaded: true,
    isSignedIn: true,
    sessionId: 'mock-session-1',
    orgId: null,
    orgRole: null,
    orgSlug: null,
    signOut: () => {},
  };
}
