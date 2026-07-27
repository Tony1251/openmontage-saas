'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WebhookEndpoint } from '@/lib/types';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true';

export function useWebhooks(getToken?: () => Promise<string | null>) {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async (): Promise<WebhookEndpoint[]> => {
      if (isMock) {
        return [
          {
            id: 1,
            url: 'https://hooks.example.com/render-complete',
            events: ['render.succeeded', 'render.failed'],
            enabled: true,
            created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
          },
          {
            id: 2,
            url: 'https://hooks.example.com/analytics',
            events: ['render.succeeded'],
            enabled: false,
            created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
          },
        ];
      }
      const token = getToken ? await getToken() : null;
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.get<{ items?: WebhookEndpoint[] }>('/v1/webhooks');
      return r.data.items ?? [];
    },
  });
}
