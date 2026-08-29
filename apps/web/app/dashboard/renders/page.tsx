'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { api, InsufficientCreditsError } from '@/lib/api';
import type { Render } from '@/lib/types';
import { estimateUnits, normalizeResolution, formatUnits, type Resolution } from '@/lib/pricing';
import { useWorkspace, workspaceQueryKey } from '@/hooks/use-workspace';
import Link from 'next/link';

interface CreateBody {
  prompt: string;
  duration_sec: number;
  resolution: Resolution;
}

export default function RendersPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState<Resolution>('720p');

  const { data: workspace, isLoading: balanceLoading } = useWorkspace();
  const balance = workspace?.credits_balance_units ?? 0;
  const estimated = estimateUnits(resolution, duration);
  const insufficient = !balanceLoading && estimated > balance;

  const { data, isLoading } = useQuery({
    queryKey: ['renders'],
    queryFn: async () => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.get<{ items: Render[] }>('/v1/renders');
      return r.data.items ?? [];
    },
    // Poll while any render is queued/running so the list converges to terminal state.
    refetchInterval: (q) => {
      const list = q.state.data as Render[] | undefined;
      return list?.some((r) => r.status === 'queued' || r.status === 'running') ? 3000 : false;
    },
  });

  // A render that transitioned to failed means the pre-deducted credits were
  // refunded (PRICING.md §5.1) — refetch the balance so it doesn't look "burned".
  const hasFailed = data?.some((r) => r.status === 'failed') ?? false;
  useEffect(() => {
    if (hasFailed) qc.invalidateQueries({ queryKey: workspaceQueryKey() });
  }, [hasFailed, qc]);

  const create = useMutation({
    mutationFn: async (body: CreateBody) => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<Render>('/v1/renders', body);
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renders'] });
      qc.invalidateQueries({ queryKey: workspaceQueryKey() }); // balance decremented server-side
      setOpen(false);
      setPrompt('');
      toast.success('Render queued');
    },
    onError: (e) => {
      if (e instanceof InsufficientCreditsError) {
        toast.error(`Not enough credits: need ${formatUnits(e.credits_required)}, have ${formatUnits(e.credits_available)}`);
        qc.invalidateQueries({ queryKey: workspaceQueryKey() }); // server may have newer balance
      } else {
        toast.error(e.message);
      }
    },
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    create.mutate({ prompt, duration_sec: duration, resolution });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Renders</h1>
        <div className="flex items-center gap-3">
          <div className="rounded-md border px-3 py-1.5 text-sm">
            Balance: <span className="font-semibold">{balanceLoading ? '…' : formatUnits(balance)}</span>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>New render</Button></DialogTrigger>
            <DialogContent className="w-[480px] rounded-lg border bg-card p-6 shadow">
              <DialogTitle className="text-lg font-semibold">New render</DialogTitle>
              <form onSubmit={submit} className="mt-4 space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} required minLength={1} maxLength={2000} placeholder="A giant robot fighting a monster" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="duration">Duration (sec)</Label>
                    <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={1} max={30} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="resolution">Resolution</Label>
                    <select
                      id="resolution"
                      value={resolution}
                      onChange={(e) => setResolution(normalizeResolution(e.target.value))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="480p">480p</option>
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Estimated cost</span>
                  <span className="font-semibold">{formatUnits(estimated)}</span>
                </div>

                {insufficient && (
                  <div className="rounded-md border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700">
                    Not enough credits: this render needs {formatUnits(estimated)}, you have {formatUnits(balance)}.{' '}
                    <Link href="/dashboard/billing" className="font-semibold underline">Upgrade →</Link>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={create.isPending || insufficient || balanceLoading}>
                    {create.isPending ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent renders</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading...</p> :
           !data || data.length === 0 ? <p className="text-sm text-muted-foreground">No renders yet. Create your first one.</p> :
           <div className="space-y-3">
             {data.map((r) => (
               <div key={r.id} className="flex items-start gap-4 rounded-lg border p-3">
                 <div className="min-w-0 flex-1">
                   <div className="flex items-center gap-2">
                     <span className="text-xs text-muted-foreground">#{r.id}</span>
                     <Badge variant={r.status === 'succeeded' ? 'success' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                     {typeof r.credits_consumed_units === 'number' && (
                       <span className="text-xs text-muted-foreground">{formatUnits(r.credits_consumed_units)}</span>
                     )}
                   </div>
                   <p className="mt-1 truncate text-sm">{r.prompt}</p>
                   <p className="text-xs text-muted-foreground">{r.resolution} · {r.duration_sec}s · {new Date(r.created_at).toLocaleString()}</p>
                 </div>
                 {r.status === 'succeeded' && r.video_url && (
                   <video src={r.video_url} controls className="h-24 w-40 rounded border bg-black" />
                 )}
                 {r.status === 'failed' && r.error && (
                   <span className="text-xs text-destructive">{r.error}</span>
                 )}
               </div>
             ))}
           </div>}
        </CardContent>
      </Card>
    </div>
  );
}
