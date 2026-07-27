'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';

export default function BillingPage() {
  const { getToken } = useAuth();

  const checkout = async (plan: 'pro' | 'enterprise') => {
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Billing</h1>
      <Card>
        <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
        <CardContent>
          <Badge>Free</Badge>
          <p className="mt-2 text-sm text-muted-foreground">10 renders / month</p>
          <Button className="mt-4" variant="outline" onClick={openPortal}>Manage subscription</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Upgrade</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={() => checkout('pro')} className="w-full">Upgrade to Pro — ¥99/mo</Button>
          <Button onClick={() => checkout('enterprise')} variant="outline" className="w-full">Enterprise — Contact us</Button>
        </CardContent>
      </Card>
    </div>
  );
}
