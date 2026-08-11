'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRender, useCancelRender, timeAgo } from '@/lib/hooks/use-renders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/dashboard/status-badge';
import {
  ArrowLeft,
  Trash2,
  AlertCircle,
  Video,
  Clock,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';

export default function RenderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: render, isLoading, isError, error } = useRender(id);
  const cancelRender = useCancelRender();

  const [showRaw, setShowRaw] = useState(false);

  const handleCancel = () => {
    if (confirm('Cancel this render?')) {
      cancelRender.mutate(Number(id), {
        onSuccess: () => {
          // The query will auto-refetch via refetchInterval
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="aspect-video w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/renders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to renders
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Failed to load render</p>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message ?? 'Render not found or API error.'}
            </p>
            <Button onClick={() => router.refresh()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!render) return null;

  const title =
    render.prompt.length > 80
      ? render.prompt.slice(0, 80) + '...'
      : render.prompt;

  const metadata = [
    { label: 'Model', value: render.model || '-' },
    { label: 'Duration', value: `${render.duration_sec}s` },
    { label: 'Resolution', value: render.resolution },
    { label: 'Created', value: timeAgo(render.created_at) },
    {
      label: 'Completed',
      value: render.completed_at ? timeAgo(render.completed_at) : '-',
    },
    { label: 'Cost', value: `${(render.cost_cents / 100).toFixed(2)} USD` },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/renders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to renders
      </Link>

      {/* Title row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          <StatusBadge status={render.status} />
        </div>
        <div className="flex items-center gap-2">
          {(render.status === 'queued' || render.status === 'running') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelRender.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
          {render.status === 'queued' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Auto-refreshing
            </Badge>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metadata.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Video player */}
      {render.status === 'succeeded' && render.video_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video
              controls
              src={render.video_url}
              className="w-full max-w-2xl rounded-lg border"
              poster={
                render.video_url
                  ? undefined
                  : undefined
              }
            >
              Your browser does not support the video tag.
            </video>
          </CardContent>
        </Card>
      )}

      {/* Running / queued state */}
      {render.status === 'running' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium">Render is running...</p>
            <p className="text-sm text-muted-foreground">
              This page auto-refreshes every 5 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {render.status === 'queued' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Render is queued</p>
            <p className="text-sm text-muted-foreground">
              It will start processing shortly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {render.status === 'failed' && render.error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{render.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Raw JSON toggle */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Terminal className="h-4 w-4" />
            Raw JSON
          </button>
        </CardHeader>
        {showRaw && (
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(render, null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
