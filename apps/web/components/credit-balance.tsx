'use client';

import { useWorkspace } from '@/hooks/use-workspace';
import { formatUnits } from '@/lib/pricing';
import { PLANS } from '@/lib/pricing';
import Link from 'next/link';

export function CreditBalance() {
  const { data, isLoading } = useWorkspace();
  if (isLoading) return <div className="text-3xl font-bold">…</div>;
  const balance = data?.credits_balance_units ?? 0;
  const planName = data ? PLANS[data.plan].name : 'Free';
  return (
    <>
      <div className="text-3xl font-bold">{formatUnits(balance)}</div>
      <p className="text-sm text-muted-foreground">
        {planName} plan · <Link href="/dashboard/billing" className="text-primary">manage →</Link>
      </p>
    </>
  );
}
