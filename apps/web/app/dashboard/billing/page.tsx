'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlanCard } from '@/components/billing/plan-card';
import { QuotaProgress } from '@/components/billing/quota-progress';
import { InvoiceRow } from '@/components/billing/invoice-row';
import { useCreateCheckoutSession, useCreatePortalSession } from '@/lib/hooks/use-checkout';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import type { BillingPlan, PlanInfo, Invoice } from '@/lib/types';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true';

const plans: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'For individuals getting started',
    features: ['10 renders per month', '720p resolution', '5-10 second clips', 'Community support'],
    accent: 'border-muted',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    description: 'For content creators and small teams',
    features: ['200 renders per month', 'Up to 1080p resolution', 'Up to 30 second clips', 'Priority support', 'Stripe billing', 'Webhook integration'],
    accent: 'border-purple-400',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    description: 'For production workloads at scale',
    features: ['10,000 renders per month', 'Up to 4K resolution', 'Up to 60 second clips', 'Dedicated support', 'SLA guarantee', 'Custom model fine-tuning', 'SSO & audit logs'],
    accent: 'border-blue-400',
  },
];

const mockInvoices: Invoice[] = [
  { id: 'in_1', date: new Date(Date.now() - 30 * 86400000).toISOString(), amount: 2900, currency: 'usd', status: 'paid', pdf_url: null },
  { id: 'in_2', date: new Date(Date.now() - 60 * 86400000).toISOString(), amount: 2900, currency: 'usd', status: 'paid', pdf_url: null },
  { id: 'in_3', date: new Date(Date.now() - 90 * 86400000).toISOString(), amount: 0, currency: 'usd', status: 'paid', pdf_url: null },
  { id: 'in_4', date: new Date(Date.now() - 120 * 86400000).toISOString(), amount: 2900, currency: 'usd', status: 'paid', pdf_url: null },
  { id: 'in_5', date: new Date(Date.now() - 150 * 86400000).toISOString(), amount: 2900, currency: 'usd', status: 'paid', pdf_url: null },
];

export default function BillingPage() {
  const auth = isMock ? { getToken: async () => 'sk_test_demo' } : useAuth();
  const { getToken } = auth;

  const checkout = useCreateCheckoutSession(getToken);
  const portal = useCreatePortalSession(getToken);

  // Mock billing plan data
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['billing-plan'],
    queryFn: async () => {
      if (isMock) {
        return {
          plan: 'free' as const,
          status: 'active',
          current_period_end: null,
          monthly_render_quota: 10,
          renders_used: 3,
        };
      }
      const token = await getToken();
      if (token) {
        const { api } = await import('@/lib/api');
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        const r = await api.get<BillingPlan>('/v1/billing/plan');
        return r.data;
      }
      throw new Error('Not authenticated');
    },
    staleTime: 60_000,
  });

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') {
      toast.info('Free plan is your current plan');
      return;
    }
    if (isMock) {
      window.location.href = `/dashboard/billing/success?plan=${planId}`;
      return;
    }
    checkout.mutate(planId as 'pro' | 'enterprise', {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  };

  const handlePortal = () => {
    if (isMock) {
      toast.info('Mock mode: billing portal not available');
      return;
    }
    portal.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  };

  const currentPlan = planData?.plan || 'free';
  const isProOrEnterprise = currentPlan === 'pro' || currentPlan === 'enterprise';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and usage quota</p>
      </div>

      {/* Current plan card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Current plan</CardTitle>
          <Badge variant={isProOrEnterprise ? 'success' : 'secondary'}>
            {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {planLoading ? (
            <div className="h-16 animate-pulse rounded-md bg-muted" />
          ) : planData ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly quota</p>
                  <QuotaProgress
                    used={planData.renders_used}
                    limit={planData.monthly_render_quota}
                    planName={currentPlan}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing period</p>
                  <p className="mt-1 text-sm font-medium">
                    {planData.current_period_end
                      ? `Renews ${new Date(planData.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : 'Free plan — no billing cycle'}
                  </p>
                </div>
              </div>
              {isProOrEnterprise && (
                <Button variant="outline" onClick={handlePortal} disabled={portal.isPending}>
                  {portal.isPending ? 'Loading...' : 'Manage billing portal'}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-destructive">Failed to load plan data</p>
          )}
        </CardContent>
      </Card>

      {/* Pricing cards */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Plans</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              currentPlan={currentPlan}
              onSelect={handleUpgrade}
              isLoading={checkout.isPending}
              disabled={currentPlan === 'enterprise' && p.id !== 'enterprise'}
            />
          ))}
        </div>
      </div>

      {/* Invoice history */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice history</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {mockInvoices.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No invoices yet</td></tr>
              ) : (
                mockInvoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
