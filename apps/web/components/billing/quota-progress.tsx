'use client';
import { cn } from '@/lib/utils';

interface QuotaProgressProps {
  used: number;
  limit: number;
  planName: string;
}

export function QuotaProgress({ used, limit, planName }: QuotaProgressProps) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const isLow = pct >= 80;
  const isExhausted = used >= limit;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {used} / {limit} renders used
        </span>
        <span className={cn('font-medium', isExhausted ? 'text-destructive' : isLow ? 'text-yellow-600' : 'text-muted-foreground')}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isExhausted ? 'bg-destructive' : isLow ? 'bg-yellow-500' : 'bg-primary',
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {isExhausted && (
        <p className="text-xs text-destructive">Quota exhausted. Upgrade to continue rendering.</p>
      )}
      {isLow && !isExhausted && (
        <p className="text-xs text-yellow-600">Running low on {planName} quota. Upgrade for more.</p>
      )}
    </div>
  );
}
