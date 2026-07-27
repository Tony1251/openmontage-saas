'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const endpoints = [
  { method: 'POST', path: '/v1/renders', desc: 'Create a render' },
  { method: 'GET', path: '/v1/renders', desc: 'List renders' },
  { method: 'GET', path: '/v1/renders/:id', desc: 'Get render detail' },
  { method: 'DELETE', path: '/v1/renders/:id', desc: 'Cancel a render' },
  { method: 'POST', path: '/v1/api-keys', desc: 'Create API key' },
  { method: 'GET', path: '/v1/api-keys', desc: 'List API keys' },
  { method: 'DELETE', path: '/v1/api-keys/:id', desc: 'Revoke API key' },
  { method: 'GET', path: '/v1/billing/plan', desc: 'Get current plan' },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const renderExample = `{
  "id": 42,
  "workspace_id": 1,
  "prompt": "A serene sunset over a mountain lake",
  "model": "openmontage-v1",
  "duration_sec": 5,
  "resolution": "720p",
  "status": "succeeded",
  "video_url": "https://storage.example.com/videos/abc123.mp4",
  "error": null,
  "cost_cents": 50,
  "created_at": "2026-07-27T10:00:00Z",
  "completed_at": "2026-07-27T10:05:00Z"
}`;

export default function DocsPage() {
  const [tab, setTab] = useState('quickstart');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integrate video generation into your application with the OpenMontage API.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="quickstart">Quickstart</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="response">Response Format</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
        </TabsList>

        <TabsContent value="quickstart" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quickstart</CardTitle>
              <p className="text-sm text-muted-foreground">Generate your first video in seconds.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a POST request to create a render. Replace <code>YOUR_API_KEY</code> with a key from the{' '}
                <a href="/dashboard/api-keys" className="text-primary underline underline-offset-2">API Keys</a> page.
              </p>
              <pre className="rounded-lg bg-muted p-4 overflow-x-auto text-sm">
                <code>{`curl -X POST https://api.openmontage.com/v1/renders \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"your prompt","duration_sec":5,"resolution":"720p"}'`}</code>
              </pre>
              <p className="text-sm text-muted-foreground">
                The API returns a render object with a <code>status</code> of <code>queued</code>. Poll{' '}
                <code>GET /v1/renders/:id</code> until <code>status</code> is <code>succeeded</code> (or{' '}
                <code>failed</code>).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Endpoints</CardTitle>
              <p className="text-sm text-muted-foreground">All API endpoints available in the current version.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="py-3 px-4 text-left font-medium">Method</th>
                      <th className="py-3 px-4 text-left font-medium">Path</th>
                      <th className="py-3 px-4 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((ep) => (
                      <tr key={ep.path} className="border-b last:border-0">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${methodColors[ep.method] ?? 'bg-gray-100 text-gray-700'}`}
                          >
                            {ep.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{ep.path}</td>
                        <td className="py-3 px-4 text-muted-foreground">{ep.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Format</CardTitle>
              <p className="text-sm text-muted-foreground">All responses return JSON. Below is a Render object example.</p>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 overflow-x-auto text-sm">
                <code>{renderExample}</code>
              </pre>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p><code className="font-medium text-foreground">status</code> — One of: <code>queued</code>, <code>running</code>, <code>succeeded</code>, <code>failed</code>, <code>cancelled</code>.</p>
                <p><code className="font-medium text-foreground">video_url</code> — Available once <code>status</code> is <code>succeeded</code>. Expires after 24 hours.</p>
                <p><code className="font-medium text-foreground">cost_cents</code> — Cost in cents. Depends on duration and resolution.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <p className="text-sm text-muted-foreground">API requests must be authenticated with a bearer token.</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="font-medium text-amber-800 dark:text-amber-300">🔑 All API requests require authentication</p>
              </div>
              <p className="text-muted-foreground">
                Pass your API key in the <code>Authorization</code> header:
              </p>
              <pre className="rounded-lg bg-muted p-3 text-sm">
                <code>Authorization: Bearer om_live_xxxxxxxxxxxx</code>
              </pre>
              <p className="text-muted-foreground">
                Keys are created and managed from the{' '}
                <a href="/dashboard/api-keys" className="text-primary underline underline-offset-2">API Keys</a> page.
                Keep your secret keys secure — do not share them or expose them in client-side code.
              </p>
              <div className="mt-4">
                <h4 className="font-medium mb-1">Rate Limits</h4>
                <p className="text-muted-foreground">
                  Free plan: 10 renders/month, 5 requests/second. Pro and Enterprise plans have higher limits.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
