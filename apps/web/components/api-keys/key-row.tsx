'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiKey } from '@/lib/types';

interface KeyRowProps {
  apiKey: ApiKey;
  onRevoke: (key: ApiKey) => void;
}

export function KeyRow({ apiKey, onRevoke }: KeyRowProps) {
  const [showFull, setShowFull] = useState(false);

  const masked = apiKey.public_key.length > 12
    ? apiKey.public_key.slice(0, 12) + '••••••••'
    : apiKey.public_key;

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey.public_key);
    toast.success('Public key copied');
  };

  return (
    <tr className="border-b text-sm">
      <td className="py-3 font-medium">{apiKey.label || 'Untitled'}</td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
            {showFull ? apiKey.public_key : masked}
          </code>
          <button onClick={() => setShowFull(!showFull)} className="text-muted-foreground hover:text-foreground">
            {showFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      <td className="py-3">
        <Badge variant={apiKey.status === 'active' ? 'success' : 'destructive'}>
          {apiKey.status}
        </Badge>
      </td>
      <td className="py-3 text-muted-foreground">
        {apiKey.last_used_at
          ? timeAgo(new Date(apiKey.last_used_at))
          : 'Never'}
      </td>
      <td className="py-3 text-muted-foreground">
        {new Date(apiKey.created_at).toLocaleDateString()}
      </td>
      <td className="py-3 text-right">
        <Button variant="ghost" size="sm" onClick={() => onRevoke(apiKey)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
