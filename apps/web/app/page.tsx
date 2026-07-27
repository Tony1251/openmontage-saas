import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Film, Zap, Shield, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">OpenMontage</Link>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Get started</Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Generate cinematic videos with AI
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            One API call. 89 video tools. Pay only for what you render.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg">Start free <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button size="lg">Open dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </SignedIn>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader><Film className="h-8 w-8 text-primary" /><CardTitle>89 video tools</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Seedance, Kling, Runway, MiniMax — choose any model per render.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><Zap className="h-8 w-8 text-primary" /><CardTitle>Fast API</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Submit a render in 1 HTTP call. Get webhook when done. Pay per video.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><Shield className="h-8 w-8 text-primary" /><CardTitle>Quota & webhooks</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Per-workspace quotas, signed webhooks, Stripe billing built-in.</p></CardContent>
          </Card>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-3xl font-bold">Pricing</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { name: 'Free', price: '¥0', quota: '10 renders/mo', features: ['All video models', 'Webhooks', 'Community support'] },
              { name: 'Pro', price: '¥99', quota: '200 renders/mo', features: ['All Free features', '5 concurrent renders', 'Email support', '5 team members'], highlight: true },
              { name: 'Enterprise', price: 'Custom', quota: 'Unlimited', features: ['All Pro features', 'Custom quota', 'SSO', 'Dedicated support'] },
            ].map((plan) => (
              <Card key={plan.name} className={plan.highlight ? 'border-primary shadow-lg' : ''}>
                <CardHeader><CardTitle>{plan.name}</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{plan.price}</div>
                  <div className="text-sm text-muted-foreground">{plan.quota}</div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {plan.features.map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <Button className="mt-6 w-full" variant={plan.highlight ? 'default' : 'outline'}>Start</Button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <Link href="/dashboard/billing">
                      <Button className="mt-6 w-full" variant={plan.highlight ? 'default' : 'outline'}>Choose</Button>
                    </Link>
                  </SignedIn>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 OpenMontage SaaS
      </footer>
    </div>
  );
}
