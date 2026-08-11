'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [saving, setSaving] = useState(false);

  // Load mock data on mount
  useEffect(() => {
    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
    if (isMock) {
      setWorkspaceName('OpenMontage Demo');
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
      if (isMock) {
        // Simulate API call
        await new Promise((r) => setTimeout(r, 500));
        toast.success('Workspace name updated');
      } else {
        await api.patch('/v1/users/me', { workspace_name: workspaceName });
        toast.success('Workspace name updated');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isMock = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
  const slug = workspaceName.toLowerCase().replace(/\s+/g, '-');
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your workspace preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Name</CardTitle>
          <p className="text-sm text-muted-foreground">This is the name displayed across the dashboard.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Slug</CardTitle>
          <p className="text-sm text-muted-foreground">Your unique workspace identifier.</p>
        </CardHeader>
        <CardContent>
          <Input value={slug} readOnly className="mt-1 font-mono text-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Base URL</CardTitle>
          <p className="text-sm text-muted-foreground">The endpoint all API requests use.</p>
        </CardHeader>
        <CardContent>
          <Input value={apiBaseUrl} readOnly className="mt-1 font-mono text-sm" />
          {isMock && (
            <p className="text-xs text-yellow-600 mt-2">
              ⚡ Running in mock mode — no real API calls are made.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <p className="text-sm text-muted-foreground">Irreversible actions for your workspace.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Once you delete your workspace, there is no going back. Please be certain.
          </p>
          <Button variant="outline" disabled className="border-red-500/50 text-red-600">
            Delete workspace — Coming soon
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
