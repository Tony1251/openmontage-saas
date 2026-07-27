'use client';

import { useState, useCallback } from 'react';
import { useRenders, useCancelRender, timeAgo } from '@/lib/hooks/use-renders';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/dashboard/status-badge';
import EmptyState from '@/components/dashboard/empty-state';
import CreateRenderDialog from '@/components/dashboard/create-render-dialog';
import { Film, Search, X, Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export default function RendersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<Array<any>>([]);

  const { data, isLoading, isFetching } = useRenders({
    limit: 20,
    status: statusFilter || undefined,
    cursor,
  });

  const cancelRender = useCancelRender();

  // Merge paginated results
  const renders = data?.items ?? [];
  const nextCursor = data?.next_cursor;
  const hasMore = !!nextCursor;

  // Simple client-side search filter
  const filtered = searchQuery.trim()
    ? renders.filter(
        (r) =>
          r.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(r.id).includes(searchQuery),
      )
    : renders;

  const handleLoadMore = useCallback(() => {
    if (nextCursor) setCursor(nextCursor);
  }, [nextCursor]);

  const handleCancel = useCallback(
    (id: number) => {
      if (confirm('Cancel this render?')) {
        cancelRender.mutate(id);
      }
    },
    [cancelRender],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Renders</h1>
        <CreateRenderDialog>
          <Button>
            <Film className="mr-1 h-4 w-4" />
            New Render
          </Button>
        </CreateRenderDialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search renders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCursor(undefined);
          }}
          options={STATUS_OPTIONS}
          className="w-40"
        />
      </div>

      {/* Renders table */}
      <Card>
        <CardHeader>
          <CardTitle>All renders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <>
              <EmptyState
                icon={Film}
                title="No renders found"
                description={
                  searchQuery || statusFilter
                    ? 'Try adjusting your filters.'
                    : 'Create your first render to get started.'
                }
              />
              {!searchQuery && !statusFilter && (
                <div className="flex justify-center pb-6">
                  <CreateRenderDialog>
                    <Button>Create a render</Button>
                  </CreateRenderDialog>
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 pr-4 font-medium text-muted-foreground">
                      ID
                    </th>
                    <th className="py-3 pr-4 font-medium text-muted-foreground">
                      Prompt
                    </th>
                    <th className="py-3 pr-4 font-medium text-muted-foreground">
                      Model
                    </th>
                    <th className="py-3 pr-4 font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="py-3 pr-4 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="py-3 pr-4 font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="py-3 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/dashboard/renders/${r.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          #{r.id}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate py-3 pr-4">
                        {r.prompt}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {r.model || '-'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {r.duration_sec}s
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {timeAgo(r.created_at)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/renders/${r.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                          {(r.status === 'queued' ||
                            r.status === 'running') && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancel(r.id)}
                              disabled={cancelRender.isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Load more */}
          {hasMore && filtered.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
