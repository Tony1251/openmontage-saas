'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, Shield, Plus } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { CreateKeyDialog } from '@/components/api-keys/create-key-dialog';
import { KeyRow } from '@/components/api-keys/key-row';
import { RevokeConfirmDialog } from '@/components/api-keys/revoke-confirm-dialog';
import { useApiKeys, useRevokeApiKey } from '@/lib/hooks/use-api-keys';
import type { ApiKey } from '@/lib/types';

const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true';

export default function ApiKeysPage() {
  const auth = isMock ? { getToken: async () => 'sk_test_demo' } : useAuth();
  const { getToken } = auth;

  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const { data: keys, isLoading } = useApiKeys(getToken);
  const revokeKey = useRevokeApiKey(getToken);

  const handleRevoke = () => {
    if (!revokeTarget) return;
    revokeKey.mutate(revokeTarget.id, {
      onSuccess: () => setRevokeTarget(null),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage API keys for programmatic access</p>
        </div>
        <CreateKeyDialog getToken={getToken} open={createOpen} onOpenChange={setCreateOpen} />
      </div>

      {/* Security tip */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Security tip</p>
            <p className="text-xs text-blue-700">
              Treat API keys like passwords. Store them securely, use environment variables,
              and rotate keys regularly. Never expose keys in client-side code.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Keys table */}
      <Card>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : !keys || keys.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <KeyRound className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mb-1 font-medium">No API keys yet</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first API key to start integrating with the API.
              </p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create API key
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-medium">Label</th>
                  <th className="py-2 font-medium">Key</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Last used</th>
                  <th className="py-2 font-medium">Created</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <KeyRow key={k.id} apiKey={k} onRevoke={setRevokeTarget} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <RevokeConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(v) => { if (!v) setRevokeTarget(null); }}
        keyLabel={revokeTarget?.label || 'Untitled'}
        onConfirm={handleRevoke}
        isLoading={revokeKey.isPending}
      />
    </div>
  );
}
