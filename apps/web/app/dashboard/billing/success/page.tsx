'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Film, CreditCard } from 'lucide-react';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'pro';
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                fontSize: `${16 + Math.random() * 24}px`,
                animationDuration: `${1 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 0.5}s`,
                opacity: 0.8,
              }}
            >
              {['🎉', '✨', '⭐', '🌟', '💫', '🎊'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>
      )}
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Payment successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Welcome to the <span className="font-semibold text-foreground">{plan === 'enterprise' ? 'Enterprise' : 'Pro'}</span> plan.
            You can now generate more videos with higher quality.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/dashboard/renders">
              <Button className="w-full">
                <Film className="mr-2 h-4 w-4" />
                Create a render
              </Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button variant="outline" className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                Back to billing
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
