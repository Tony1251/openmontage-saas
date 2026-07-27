export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left: gradient with tagline */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 p-12 md:flex">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Generate cinematic videos with AI.
          </h1>
          <p className="mt-4 text-lg text-purple-200/80">
            No editing skills required.
          </p>
          <blockquote className="mt-8 border-l-2 border-purple-400 pl-4 italic text-purple-200/60">
            &ldquo;We cut our video production time by 90%.&rdquo;
            <footer className="mt-2 text-sm not-italic text-purple-300/50">
              &mdash; Sarah Chen, Head of Content at Luma
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right: card container */}
      <main className="flex flex-1 items-center justify-center p-8">
        {children}
      </main>
    </div>
  );
}
