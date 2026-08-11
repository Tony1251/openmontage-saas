'use client';

import { Badge } from '@/components/ui/badge';
import type { RenderStatus } from '@/lib/types';

const statusConfig: Record<
  RenderStatus,
  { variant: 'warning' | 'secondary' | 'success' | 'destructive' | 'outline'; label: string }
> = {
  queued: { variant: 'warning', label: 'Queued' },
  running: { variant: 'secondary', label: 'Running' },
  succeeded: { variant: 'success', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
  cancelled: { variant: 'outline', label: 'Cancelled' },
};

interface StatusBadgeProps {
  status: RenderStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
