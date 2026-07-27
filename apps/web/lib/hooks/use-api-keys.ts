'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { ApiKey } from '@/lib/types';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true';
const mockApiKeys: ApiKey[] = [];

export function useApiKeys(getToken?: () => Promise<string | null>) {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async (): Promise<ApiKey[]> => {
      if (isMock) return mockApiKeys;
      const token = getToken ? await getToken() : null;
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.get<{ items?: ApiKey[] }>('/v1/api-keys');
      return r.data.items ?? (r.data as unknown as ApiKey[]) ?? [];
    },
  });
}

export function useCreateApiKey(getToken?: () => Promise<string | null>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      if (isMock) {
        const id = mockApiKeys.length + 1;
        const key: ApiKey = {
          id,
          workspace_id: 1,
          public_key: `sk_test_mock${String(id).padStart(8, '0')}`,
          label,
          status: 'active',
          last_used_at: null,
          created_at: new Date().toISOString(),
        };
        mockApiKeys.push(key);
        return { ...key, secret: `sk_test_mock${String(id).padStart(8, '0')}full_secret_only_shown_once` };
      }
      const token = getToken ? await getToken() : null;
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<ApiKey & { secret: string }>('/v1/api-keys', { label });
      return r.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeApiKey(getToken?: () => Promise<string | null>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: number) => {
      if (isMock) {
        const idx = mockApiKeys.findIndex(k => k.id === keyId);
        if (idx >= 0) mockApiKeys.splice(idx, 1);
        return;
      }
      const token = getToken ? await getToken() : null;
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      await api.delete(`/v1/api-keys/${keyId}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('API key revoked'); },
    onError: (e: Error) => toast.error(e.message),
  });
}
