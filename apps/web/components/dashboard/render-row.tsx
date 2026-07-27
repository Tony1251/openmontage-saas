'use client';

import Link from 'next/link';
import { MoreHorizontal, Eye, Copy, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/dashboard/status-badge';
import type { Render } from '@/lib/types';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface RenderRowProps {
  render: Render;
  onSelect?: (id: number) => void;
}

export default function RenderRow({ render, onSelect }: RenderRowProps) {
  const canCancel = render.status === 'queued' || render.status === 'running';

  const handleCopyId = () => {
    navigator.clipboard.writeText(String(render.id));
  };

  const handleCancel = async () => {
    // A real implementation would call POST /v1/renders/{id}/cancel
  };

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="py-3">
        <Link
          href={`/dashboard/renders/${render.id}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          #{render.id}
        </Link>
      </td>
      <td className="max-w-[240px] truncate py-3 text-sm">
        {render.prompt}
      </td>
      <td className="py-3 text-sm">{render.model}</td>
      <td className="py-3 text-sm text-muted-foreground">{render.duration_sec}s</td>
      <td className="py-3">
        <StatusBadge status={render.status} />
      </td>
      <td className="py-3 text-sm text-muted-foreground">
        {relativeTime(render.created_at)}
      </td>
      <td className="py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect?.(render.id)}>
              <Eye className="mr-2 h-4 w-4" /> View Detail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyId}>
              <Copy className="mr-2 h-4 w-4" /> Copy ID
            </DropdownMenuItem>
            {canCancel && (
              <DropdownMenuItem onClick={handleCancel}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
