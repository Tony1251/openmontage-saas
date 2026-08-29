'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Workspace } from '@/lib/types';

const WORKSPACE_QUERY_KEY = ['workspace'] as const;

// Fetch the current workspace (includes credits_balance_units per PRICING.md §5.1).
export function useWorkspace() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.get<Workspace>('/v1/workspace');
      return r.data;
    },
  });
}

export function workspaceQueryKey() {
  return WORKSPACE_QUERY_KEY;
}
