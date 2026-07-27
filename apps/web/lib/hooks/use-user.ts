import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

async function getAuthToken(): Promise<string> {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
    return localStorage.getItem('mock_token') ?? 'sk_test_demo';
  }
  try {
    const { useAuth } = await import('@clerk/nextjs');
    const { getToken } = useAuth();
    return (await getToken()) ?? '';
  } catch {
    return localStorage.getItem('mock_token') ?? 'sk_test_demo';
  }
}

// GET /v1/users/me
export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = await getAuthToken();
      const r = await api.get('/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.data;
    },
  });
}
