'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Render } from '@/lib/types';

export default function RendersPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['renders'],
    queryFn: async () => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.get<{ items: Render[] }>('/v1/renders');
      return r.data.items ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (body: { prompt: string; duration_sec: number; resolution: string }) => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post('/v1/renders', body);
      return r.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['renders'] }); setOpen(false); toast.success('Render queued'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Renders</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>New render</Button></DialogTrigger>
          <DialogContent>
            <DialogTitle className="text-lg font-semibold">New render</DialogTitle>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate({ prompt: fd.get('prompt') as string, duration_sec: Number(fd.get('duration')), resolution: fd.get('resolution') as string }); }}>
              <div className="space-y-4">
                <div><Label>Prompt</Label><Input name="prompt" required minLength={1} maxLength={2000} /></div>
                <div><Label>Duration</Label><Input name="duration" type="number" defaultValue={5} min={5} max={10} /></div>
                <div><Label>Resolution</Label><Input name="resolution" defaultValue="720p" /></div>
              </div>
              <div className="mt-4 flex justify-end"><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Submitting...' : 'Submit'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent renders</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading...</p> :
           !data || data.length === 0 ? <p className="text-sm text-muted-foreground">No renders yet. Create your first one.</p> :
           <table className="w-full text-sm">
             <thead><tr className="border-b text-left"><th className="py-2">ID</th><th>Prompt</th><th>Status</th><th>Created</th></tr></thead>
             <tbody>
               {data.map((r) => (
                 <tr key={r.id} className="border-b">
                   <td className="py-2">#{r.id}</td>
                   <td className="max-w-md truncate">{r.prompt}</td>
                   <td><Badge variant={r.status === 'succeeded' ? 'success' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge></td>
                   <td>{new Date(r.created_at).toLocaleString()}</td>
                 </tr>
               ))}
             </tbody>
           </table>}
        </CardContent>
      </Card>
    </div>
  );
}
