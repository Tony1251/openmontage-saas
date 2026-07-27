'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BillingPlan } from '@/lib/types';

export function usePlan() {
  return useQuery({
    queryKey: ['billing-plan'],
    queryFn: async (): Promise<BillingPlan> => {
      if (process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true') {
        return {
          plan: 'free',
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          monthly_render_quota: 10,
          renders_used: 3,
        };
      }
      const r = await api.get<BillingPlan>('/v1/billing/plan');
      return r.data;
    },
    staleTime: 60_000,
  });
}
