import Link from 'next/link';
import { ArrowRight, BookOpen, Lock, Webhook, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      {/* Breadcrumb */}
      <p className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Docs</span>
      </p>

      {/* Hero */}
      <div className="mx-auto mb-20 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Documentation
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Everything you need to integrate OpenMontage into your application.
        </p>
      </div>

      {/* Quickstart */}
      <section className="mb-20">
        <h2 className="mb-8 text-2xl font-bold">Quickstart: Get started in 3 steps</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: 1,
              title: 'Get your API key',
              desc: 'Sign up and generate an API key from the dashboard.',
              code: '# Your API key is available at:\n# Dashboard → API Keys\n# \n# Store it securely as an environment variable\nexport OPENMONTAGE_API_KEY="om_key_abc123"',
            },
            {
              step: 2,
              title: 'Submit a render',
              desc: 'POST your prompt, duration, and resolution.',
              code: `curl -X POST https://api.openmontage.dev/v1/renders \\
  -H "Authorization: Bearer $OPENMONTAGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A cinematic sunrise over mountains",
    "duration_sec": 8,
    "resolution": "1080p"
  }'`,
            },
            {
              step: 3,
              title: 'Monitor & download',
              desc: 'Poll the render status or set up a webhook.',
              code: `curl -s https://api.openmontage.dev/v1/renders/rnd_abc123 \\
  -H "Authorization: Bearer $OPENMONTAGE_API_KEY" | jq .status

# Response when complete:
# "status": "completed"
# "output_url": "https://storage.openmontage.dev/..."`,
            },
          ].map((item) => (
            <Card key={item.step} className="border-white/10 bg-white/5 backdrop-blur-sm">
              <CardHeader>
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-sm font-bold text-white">
                  {item.step}
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-green-400">
                  <code>{item.code}</code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* API Reference */}
      <section className="mb-20">
        <div className="flex items-center gap-3">
          <Code className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold">API Reference</h2>
        </div>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Our API is built with FastAPI and follows RESTful conventions. Explore the full interactive OpenAPI documentation.
        </p>
        <div className="mt-6">
          <Link href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2 border-white/20">
              <BookOpen className="h-4 w-4" />
              OpenAPI Docs (localhost:8000/docs)
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Authentication */}
      <section className="mb-20">
        <div className="flex items-center gap-3">
          <Lock className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold">Authentication</h2>
        </div>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          All API requests require a Bearer token in the Authorization header. Generate your API key from the dashboard and keep it secure. Never expose your API key in client-side code.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-green-400">
          <code>{`# Required header for all requests
Authorization: Bearer $OPENMONTAGE_API_KEY

# Example using fetch
fetch('https://api.openmontage.dev/v1/renders', {
  headers: {
    'Authorization': \`Bearer \${process.env.OPENMONTAGE_API_KEY}\`,
    'Content-Type': 'application/json',
  },
})`}</code>
        </pre>
      </section>

      {/* Webhooks */}
      <section className="mb-20">
        <div className="flex items-center gap-3">
          <Webhook className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold">Webhooks</h2>
        </div>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          When a render completes, OpenMontage sends a POST request to your registered webhook URL. Payloads are signed using HMAC-SHA256 so you can verify they came from us.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-green-400">
          <code>{`// Webhook payload
{
  "event": "render.completed",
  "render_id": "rnd_abc123",
  "status": "completed",
  "output_url": "https://storage.openmontage.dev/renders/abc123.mp4",
  "duration_sec": 8,
  "resolution": "1080p",
  "cost_credits": 1,
  "timestamp": "2026-07-27T12:00:00Z"
}

// Verify signature (Node.js example)
const crypto = require('crypto');
const sig = req.headers['x-openmontage-signature'];
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (sig !== expected) throw new Error('Invalid signature');`}</code>
        </pre>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-bold">Ready to build?</h2>
        <p className="mt-4 text-muted-foreground">
          Start generating cinematic videos in minutes. No credit card required.
        </p>
        <Link href="/sign-up" className="mt-6 inline-block">
          <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500">
            Sign up &mdash; it&rsquo;s free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
