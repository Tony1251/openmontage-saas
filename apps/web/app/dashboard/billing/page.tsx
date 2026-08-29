'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { PLANS, formatUnits, type Plan } from '@/lib/pricing';
import { useWorkspace } from '@/hooks/use-workspace';

export default function BillingPage() {
  const { getToken } = useAuth();
  const { data: workspace } = useWorkspace();
  const currentPlan: Plan = workspace?.plan ?? 'free';
  const balance = workspace?.credits_balance_units ?? 0;

  const checkout = async (plan: Exclude<Plan, 'enterprise'>) => {
    try {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<{ url: string }>('/v1/billing/checkout', { plan });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openPortal = async () => {
    try {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<{ url: string }>('/v1/billing/portal');
      window.location.href = r.data.url;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const order: Plan[] = ['free', 'pro', 'business', 'enterprise'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Billing</h1>

      <Card>
        <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge>{PLANS[currentPlan].name}</Badge>
            <span className="text-sm text-muted-foreground">
              Balance: {formatUnits(balance)}
            </span>
          </div>
          {PLANS[currentPlan].includedUnits != null && (
            <p className="mt-2 text-sm text-muted-foreground">
              {formatUnits(PLANS[currentPlan].includedUnits!)} included / month
            </p>
          )}
          <Button className="mt-4" variant="outline" onClick={openPortal}>Manage subscription</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plans</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {order.map((planId) => {
              const p = PLANS[planId];
              const isCurrent = planId === currentPlan;
              return (
                <div key={planId} className={`rounded-lg border p-4 ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    {isCurrent && <Badge variant="secondary">Current</Badge>}
                  </div>
                  <p className="mt-1 text-2xl font-bold">
                    {p.monthlyCents == null ? 'Custom' : p.monthlyCents === 0 ? 'Free' : `$${(p.monthlyCents / 100).toFixed(0)}/mo`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.includedUnits != null ? `${formatUnits(p.includedUnits)} included` : 'Custom credits'}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {p.features.map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                  <div className="mt-4">
                    {planId === 'free' && (
                      <span className="text-xs text-muted-foreground">Included with signup</span>
                    )}
                    {planId === 'pro' || planId === 'business' ? (
                      <Button className="w-full" onClick={() => checkout(planId)} disabled={isCurrent}>
                        {isCurrent ? 'Current plan' : 'Upgrade'}
                      </Button>
                    ) : planId === 'enterprise' ? (
                      <Button variant="outline" className="w-full" onClick={openPortal}>Contact us</Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
