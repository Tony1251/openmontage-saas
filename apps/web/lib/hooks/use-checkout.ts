'use client';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Plan, CheckoutResponse } from '@/lib/types';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true';

export function useCreateCheckoutSession(getToken?: () => Promise<string | null>) {
  return useMutation({
    mutationFn: async (plan: Plan) => {
      if (plan === 'free') throw new Error('Free plan cannot be checked out');
      if (isMock) {
        return { url: `/dashboard/billing/success?plan=${plan}` };
      }
      const token = getToken ? await getToken() : null;
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<CheckoutResponse>('/v1/billing/checkout', { plan });
      return r.data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePortalSession(getToken?: () => Promise<string | null>) {
  return useMutation({
    mutationFn: async () => {
      if (isMock) {
        return { url: '/dashboard/billing' };
      }
      const token = getToken ? await getToken() : null;
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<CheckoutResponse>('/v1/billing/portal');
      return r.data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
