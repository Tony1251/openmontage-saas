'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <h1 className="text-6xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Our rendering engine hit an unexpected error.
      </p>
      <div className="mt-8 flex gap-4">
        <Button
          onClick={reset}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500"
        >
          Try again
        </Button>
        <Link href="/">
          <Button variant="outline" className="border-white/20">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  );
}
