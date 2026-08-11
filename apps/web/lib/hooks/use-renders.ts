import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Render } from '@/lib/types';

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

// GET /v1/renders?limit=20&status=...&cursor=...
export function useRenders(params?: { limit?: number; status?: string; cursor?: string }) {
  return useQuery({
    queryKey: ['renders', params],
    queryFn: async () => {
      const token = await getAuthToken();
      const r = await api.get<{ items: Render[]; next_cursor?: string }>('/v1/renders', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.data;
    },
  });
}

// GET /v1/renders/{id}
export function useRender(id: number | string) {
  return useQuery({
    queryKey: ['render', id],
    queryFn: async () => {
      const token = await getAuthToken();
      const r = await api.get<Render>(`/v1/renders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.data;
    },
    // 如果 status 是 running/queued，每 5s 轮询
    refetchInterval: (query: any) => {
      const data = query?.state?.data as Render | undefined;
      return (data?.status === 'running' || data?.status === 'queued') ? 5000 : false;
    },
  });
}

// POST /v1/renders
export function useCreateRender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      prompt: string;
      model?: string;
      duration_sec: number;
      resolution: string;
    }) => {
      const token = await getAuthToken();
      const r = await api.post<Render>('/v1/renders', body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renders'] });
      toast.success('Render queued successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// DELETE /v1/renders/{id} (cancel)
export function useCancelRender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getAuthToken();
      await api.delete(`/v1/renders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renders'] });
      toast.success('Render cancelled');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Display helper
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
