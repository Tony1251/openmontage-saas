'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { ApiKey } from '@/lib/types';

export default function ApiKeysPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.get<{ items: ApiKey[] }>('/v1/api-keys');
      return r.data.items ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (label: string) => {
      const token = await getToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post<ApiKey & { secret: string }>('/v1/api-keys', { label });
      return r.data;
    },
    onSuccess: (d) => { setNewSecret(d.secret); qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Key created. Copy it now.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">API Keys</h1>
      {newSecret && (
        <Card className="border-yellow-500">
          <CardHeader><CardTitle>Save this secret now</CardTitle></CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-3 text-sm">{newSecret}</code>
            <Button className="mt-2" variant="outline" onClick={() => { navigator.clipboard.writeText(newSecret); toast.success('Copied'); }}>Copy</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Create new key</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate(fd.get('label') as string); }} className="flex gap-2">
            <Input name="label" placeholder="e.g. production-server" required />
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Existing keys</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading...</p> :
           !data || data.length === 0 ? <p className="text-sm text-muted-foreground">No keys yet.</p> :
           <table className="w-full text-sm">
             <thead><tr className="border-b text-left"><th className="py-2">Label</th><th>Public key</th><th>Status</th><th>Created</th></tr></thead>
             <tbody>
               {data.map((k) => (
                 <tr key={k.id} className="border-b">
                   <td className="py-2">{k.label}</td>
                   <td><code>{k.public_key}</code></td>
                   <td>{k.status}</td>
                   <td>{new Date(k.created_at).toLocaleDateString()}</td>
                 </tr>
               ))}
             </tbody>
           </table>}
        </CardContent>
      </Card>
    </div>
  );
}
