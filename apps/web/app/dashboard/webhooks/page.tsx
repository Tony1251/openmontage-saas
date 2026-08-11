'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Webhook, Plus, Send, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { useWebhooks } from '@/lib/hooks/use-webhooks';
import type { WebhookEndpoint } from '@/lib/types';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true';

const eventOptions = [
  { value: 'render.succeeded', label: 'Render succeeded' },
  { value: 'render.failed', label: 'Render failed' },
  { value: 'render.queued', label: 'Render queued' },
];

export default function WebhooksPage() {
  const auth = isMock ? { getToken: async () => 'sk_test_demo' } : useAuth();
  const { getToken } = auth;
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: webhooks, isLoading } = useWebhooks(getToken);

  const createWebhook = useMutation({
    mutationFn: async (body: { url: string; events: string[] }) => {
      if (isMock) {
        return { id: Date.now(), url: body.url, events: body.events, enabled: true, created_at: new Date().toISOString() };
      }
      const token = await getToken();
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const r = await api.post('/v1/webhooks', body);
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      setCreateOpen(false);
      setUrl('');
      setSelectedEvents([]);
      toast.success('Webhook endpoint created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testWebhook = useMutation({
    mutationFn: async (webhookId: number) => {
      if (isMock) {
        await new Promise((r) => setTimeout(r, 500));
        return;
      }
      const token = await getToken();
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      await api.post(`/v1/webhooks/${webhookId}/test`);
    },
    onSuccess: () => toast.success('Test event sent'),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      if (isMock) return;
      const token = await getToken();
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
      await api.patch(`/v1/webhooks/${id}`, { enabled });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || selectedEvents.length === 0) return;
    createWebhook.mutate({ url, events: selectedEvents });
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send real-time events to your endpoints
            {isMock && <span className="ml-2 text-xs text-yellow-600">(mock data)</span>}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add endpoint</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add webhook endpoint</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 p-6">
              <div>
                <Label htmlFor="url">Endpoint URL</Label>
                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/callback" required className="mt-1" />
              </div>
              <div>
                <Label>Events</Label>
                <div className="mt-2 space-y-2">
                  {eventOptions.map((ev) => (
                    <label key={ev.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev.value)}
                        onChange={() => toggleEvent(ev.value)}
                        className="rounded border-gray-300"
                      />
                      {ev.label}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createWebhook.isPending || !url || selectedEvents.length === 0}>
                  {createWebhook.isPending ? 'Creating...' : 'Create endpoint'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Webhook className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mb-1 font-medium">No webhook endpoints</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Add an endpoint to receive render status updates via webhook.
              </p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add endpoint
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <Card key={wh.id} className={wh.enabled ? '' : 'opacity-60'}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="truncate rounded bg-muted px-2 py-0.5 text-xs font-mono">
                          {wh.url}
                        </code>
                        <Badge variant={wh.enabled ? 'success' : 'secondary'}>
                          {wh.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <Badge key={ev} variant="outline" className="text-xs">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {new Date(wh.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleWebhook.mutate({ id: wh.id, enabled: !wh.enabled })}
                        disabled={toggleWebhook.isPending}
                        title={wh.enabled ? 'Disable' : 'Enable'}
                      >
                        {wh.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testWebhook.mutate(wh.id)}
                        disabled={testWebhook.isPending || !wh.enabled}
                        title="Send test event"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
