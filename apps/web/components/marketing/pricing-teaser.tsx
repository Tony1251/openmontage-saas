import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const plans = [
  {
    name: 'Free',
    price: '$0',
    monthly: '/mo',
    renders: '10 renders/mo',
    features: ['All video models', 'Community support', '1 member'],
    cta: 'Get started',
    href: '/sign-up',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    monthly: '/mo',
    renders: '200 renders/mo',
    features: ['Priority queue', '5 members', 'Email support', 'Webhooks'],
    cta: 'Start free trial',
    href: '/sign-up',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$299',
    monthly: '/mo',
    renders: 'Unlimited renders',
    features: ['Custom models', 'SSO', 'Dedicated infra', 'Phone support'],
    cta: 'Contact sales',
    href: '#',
    highlight: false,
  },
];

export default function PricingTeaser() {
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={
            plan.highlight
              ? 'relative border-purple-500 shadow-xl shadow-purple-500/10'
              : 'border-white/10 bg-white/5 backdrop-blur-sm'
          }
        >
          {plan.highlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1 text-xs font-semibold text-white">
              Most popular
            </div>
          )}
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{plan.name}</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground">{plan.monthly}</span>
            </div>
            <p className="text-sm text-muted-foreground">{plan.renders}</p>
          </CardHeader>
          <CardContent>
            <ul className="mb-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-purple-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={plan.href}>
              <Button
                className={`w-full ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'
                    : ''
                }`}
                variant={plan.highlight ? 'default' : 'outline'}
              >
                {plan.cta}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
