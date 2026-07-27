import { ArrowRight } from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Get your API key',
    code: `curl -X POST https://api.openmontage.dev/v1/renders \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"A cinematic sunrise over mountains","duration_sec":8,"resolution":"1080p"}'`,
  },
  {
    number: 2,
    title: 'Poll for status',
    code: `curl -s https://api.openmontage.dev/v1/renders/{id} | jq .status`,
  },
  {
    number: 3,
    title: 'Download your video',
    code: `{
  "id": "rnd_abc123",
  "status": "completed",
  "output_url": "https://storage.openmontage.dev/renders/abc123.mp4",
  "duration_sec": 8,
  "resolution": "1080p",
  "cost_credits": 1
}`,
  },
];

export default function HowItWorks() {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {steps.map((step, i) => (
        <div key={step.number} className="relative">
          {i < steps.length - 1 && (
            <div className="absolute right-0 top-1/3 hidden -translate-y-1/2 md:block">
              <ArrowRight className="h-6 w-6 text-purple-400/50" />
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-muted/50 p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-sm font-bold text-white">
              {step.number}
            </div>
            <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-green-400">
              <code>{step.code}</code>
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}
