import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <h1 className="text-8xl font-bold tracking-tight text-purple-400 sm:text-9xl">404</h1>
      <p className="mt-6 text-xl text-muted-foreground">
        Page not found &mdash; the render queue is empty here.
      </p>
      <Link href="/" className="mt-8">
        <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500">
          Go home
        </Button>
      </Link>
    </div>
  );
}
