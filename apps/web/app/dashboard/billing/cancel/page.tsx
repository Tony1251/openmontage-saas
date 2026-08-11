'use client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, RefreshCw, CreditCard } from 'lucide-react';

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <XCircle className="h-10 w-10 text-yellow-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Checkout canceled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your payment was not completed. Your plan remains unchanged.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/dashboard/billing">
              <Button className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
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
