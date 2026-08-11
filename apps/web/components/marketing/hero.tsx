import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-20">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

      <div className="container relative mx-auto flex flex-col items-center gap-12 lg:flex-row lg:items-center">
        {/* Left: text */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Turn text into{' '}
            <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              cinematic video
            </span>
            , in seconds
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
            One API. 89 video tools. Pay per render. From 480p to 1080p.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <Link href="/sign-up">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500">
                Start free &mdash; no credit card
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-white/20">
                View pricing
              </Button>
            </Link>
          </div>
        </div>

        {/* Right: decorative mock dashboard card */}
        <div className="flex-1">
          <div className="mx-auto h-64 w-96 max-w-full rounded-xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-3/4 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
              <div className="mt-6 h-24 rounded-lg bg-white/5" />
              <div className="h-3 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/3 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
