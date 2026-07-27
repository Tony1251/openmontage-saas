import { Check, Minus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import FAQ from '@/components/marketing/faq';

const comparisonRows = [
  { feature: 'Video models', free: true, pro: true, enterprise: true },
  { feature: 'Renders / month', free: '10', pro: '200', enterprise: 'Unlimited' },
  { feature: 'Concurrent renders', free: '1', pro: '5', enterprise: 'Unlimited' },
  { feature: 'Team members', free: '1', pro: '5', enterprise: 'Unlimited' },
  { feature: 'Support', free: 'Community', pro: 'Email', enterprise: 'Phone + dedicated' },
  { feature: 'Webhooks', free: false, pro: true, enterprise: true },
  { feature: 'Custom models', free: false, pro: false, enterprise: true },
  { feature: 'SSO', free: false, pro: false, enterprise: true },
  { feature: 'Dedicated infra', free: false, pro: false, enterprise: true },
];

function BoolIcon({ value }: { value: boolean | string }) {
  if (value === true || value === 'true')
    return <Check className="mx-auto h-5 w-5 text-purple-400" />;
  if (value === false || value === 'false')
    return <Minus className="mx-auto h-5 w-5 text-muted-foreground/40" />;
  return <span className="text-sm text-foreground">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      {/* Breadcrumb */}
      <p className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Pricing</span>
      </p>

      {/* Hero */}
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">Scale as you grow.</p>
      </div>

      {/* Comparison table */}
      <div className="mx-auto mb-20 max-w-4xl overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Feature</th>
              <th className="p-4 text-center text-sm font-semibold">Free</th>
              <th className="rounded-t-xl bg-purple-600/10 p-4 text-center text-sm font-semibold text-purple-400">
                Pro
              </th>
              <th className="p-4 text-center text-sm font-semibold">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, i) => (
              <tr key={row.feature} className={i % 2 === 0 ? 'border-b border-white/5' : 'border-b border-white/5 bg-white/[0.02]'}>
                <td className="p-4 text-sm text-foreground">{row.feature}</td>
                <td className="p-4 text-center"><BoolIcon value={row.free} /></td>
                <td className="bg-purple-600/5 p-4 text-center"><BoolIcon value={row.pro} /></td>
                <td className="p-4 text-center"><BoolIcon value={row.enterprise} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA cards */}
      <div className="mx-auto mb-20 grid max-w-4xl gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <h3 className="text-xl font-bold">Free</h3>
          <p className="mt-2 text-3xl font-bold">$0</p>
          <p className="mt-1 text-sm text-muted-foreground">10 renders / mo</p>
          <Link href="/sign-up" className="mt-6 w-full">
            <Button variant="outline" className="w-full">Get started</Button>
          </Link>
        </div>
        <div className="relative flex flex-col items-center rounded-xl border border-purple-500 bg-white/5 p-8 shadow-xl shadow-purple-500/10 backdrop-blur-sm">
          <div className="absolute -top-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1 text-xs font-semibold text-white">
            Most popular
          </div>
          <h3 className="text-xl font-bold">Pro</h3>
          <p className="mt-2 text-3xl font-bold">$29</p>
          <p className="mt-1 text-sm text-muted-foreground">200 renders / mo</p>
          <Link href="/sign-up" className="mt-6 w-full">
            <Button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500">
              Start free trial
            </Button>
          </Link>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <h3 className="text-xl font-bold">Enterprise</h3>
          <p className="mt-2 text-3xl font-bold">$299</p>
          <p className="mt-1 text-sm text-muted-foreground">Unlimited renders</p>
          <Link href="#" className="mt-6 w-full">
            <Button variant="outline" className="w-full">Contact sales</Button>
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center text-2xl font-bold">Frequently asked questions</h2>
        <FAQ />
      </div>
    </div>
  );
}
