'use client';

import { useRenders } from '@/lib/hooks/use-renders';
import { useUser } from '@/lib/hooks/use-user';
import { useApiKeys } from '@/lib/hooks/use-api-keys';
import { Film, Key, CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/dashboard/status-badge';
import EmptyState from '@/components/dashboard/empty-state';
import StatCard from '@/components/dashboard/stat-card';
import CreateRenderDialog from '@/components/dashboard/create-render-dialog';
import { timeAgo } from '@/lib/hooks/use-renders';

const isMock =
  typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

export default function DashboardPage() {
  const { data: rendersData, isLoading: rendersLoading } = useRenders({ limit: 20 });
  const { data: userData, isLoading: userLoading } = useUser();
  const { data: apiKeys = [], isLoading: keysLoading } = useApiKeys();

  const renders = rendersData?.items ?? [];
  const recentRenders = renders.slice(0, 5);

  // Plan-aware quota
  const plan = (userData as any)?.plan ?? 'free';
  const rendersUsed =
    (userData as any)?.renders_used ??
    (userData as any)?.monthly_render_quota
      ? (userData as any)?.monthly_render_quota -
        ((userData as any)?.remaining_quota ?? 0)
      : renders.length;
  const quotaMap: Record<string, string> = {
    free: '10',
    pro: '100',
    enterprise: '∞',
  };
  const quotaLabel = quotaMap[plan as string] ?? '10';

  const statCards = [
    {
      label: 'Renders this month',
      value: rendersLoading ? '...' : String(renders.length),
      icon: Film,
    },
    {
      label: 'Quota used',
      value: rendersLoading ? '...' : `${rendersUsed} / ${quotaLabel}`,
      icon: TrendingUp,
    },
    {
      label: 'API keys active',
      value: keysLoading ? '...' : String(apiKeys.length),
      icon: Key,
    },
    {
      label: 'Plan',
      value: userLoading
        ? '...'
        : (userData as any)?.plan
          ? (userData as any)?.plan.charAt(0).toUpperCase() +
            (userData as any)?.plan.slice(1)
          : 'Free',
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-6">
      {isMock && (
        <div className="rounded-md bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-800">
          ⚠️ MOCK MODE — Data is simulated
        </div>
      )}

      <h1 className="text-3xl font-bold">Overview</h1>

      {/* Stat cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Recent renders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent renders</CardTitle>
        </CardHeader>
        <CardContent>
          {rendersLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : recentRenders.length === 0 ? (
            <>
              <EmptyState
                icon={Film}
                title="No renders yet"
                description="Create your first render to get started."
              />
              <div className="flex justify-center pb-6">
                <CreateRenderDialog>
                  <Button>Create a render</Button>
                </CreateRenderDialog>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      ID
                    </th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      Prompt
                    </th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentRenders.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/dashboard/renders/${r.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          #{r.id}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate py-2 pr-4">
                        {r.prompt}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {timeAgo(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <CreateRenderDialog>
            <Button>
              <Film className="mr-1 h-4 w-4" />
              New render
            </Button>
          </CreateRenderDialog>
          <Link href="/dashboard/api-keys">
            <Button variant="outline">
              <Key className="mr-1 h-4 w-4" />
              Copy API key
            </Button>
          </Link>
          <Link
            href="https://docs.openmontage.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost">
              <CreditCard className="mr-1 h-4 w-4" />
              View docs
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
