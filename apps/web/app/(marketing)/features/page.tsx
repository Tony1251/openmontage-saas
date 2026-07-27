import Link from 'next/link';
import { Film, Clock, Monitor, Code, Users, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeatureDetailProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  descriptions: string[];
  code?: string;
  visual?: React.ReactNode;
  reverse?: boolean;
}

function FeatureDetail({ icon: Icon, title, descriptions, code, visual, reverse }: FeatureDetailProps) {
  return (
    <div className={`flex flex-col items-center gap-12 ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
      <div className="flex-1">
        <div className="mb-4 flex items-center gap-3">
          <Icon className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        {descriptions.map((desc, i) => (
          <p key={i} className="mt-4 text-muted-foreground leading-relaxed">
            {desc}
          </p>
        ))}
        {code && (
          <pre className="mt-6 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-green-400">
            <code>{code}</code>
          </pre>
        )}
      </div>
      <div className="flex-1">
        {visual ?? (
          <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <Icon className="h-16 w-16 text-purple-400/30" />
          </div>
        )}
      </div>
    </div>
  );
}

const sections = [
  {
    icon: Film,
    title: 'Cinematic Quality',
    descriptions: [
      'OpenMontage orchestrates across multiple state-of-the-art video models including Seedance, Kling, Runway, and MiniMax. Each render selects the optimal model pipeline for your prompt, delivering results that rival traditional video production.',
      'Our orchestration layer handles model selection, parameter tuning, and post-processing automatically. You get cinematic quality without needing a degree in film production or prompt engineering.',
    ],
    visual: (
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-48 rounded-lg border border-white/20 bg-black/40 shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="ml-2 text-[10px] text-muted-foreground">preview.mp4</span>
            </div>
            <div className="flex h-full items-center justify-center p-4">
              <Film className="h-10 w-10 text-purple-400/50" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Clock,
    title: '5\u201310 second clips',
    descriptions: [
      'Fine-tune your video duration per render. Whether you need a 5-second social clip, an 8-second ad spot, or a 10-second product demo, specify the duration in your API request and we handle the rest.',
      'Each supported video model has been tuned for optimal results at common social media durations. No more guessing — just set duration_sec and render.',
    ],
    reverse: true,
  },
  {
    icon: Monitor,
    title: '480p\u20131080p resolution',
    descriptions: [
      'Choose output resolution per render — from 480p for quick previews to full 1080p for production use. Web-optimised presets ensure fast delivery without sacrificing visual quality.',
      'Higher resolutions are billed at proportionally higher credit costs, so you only pay for what you need. Upgrade to 1080p for your final deliverables and use 480p for iteration.',
    ],
  },
  {
    icon: Code,
    title: 'API-first architecture',
    descriptions: [
      'A single POST /v1/renders kicks off your render. Include your prompt, duration, and resolution. We return a render ID immediately so your application can continue without blocking.',
      'Webhooks notify your server when rendering completes, with the video URL ready for download. No polling required — unless you want to.',
    ],
    code: `// Submit a render
POST /v1/renders
Authorization: Bearer $API_KEY
Content-Type: application/json

{
  "prompt": "A cinematic sunrise over mountains",
  "duration_sec": 8,
  "resolution": "1080p",
  "model": "seedance",
  "webhook_url": "https://api.myapp.com/webhooks/openmontage"
}

// Response
{
  "id": "rnd_abc123",
  "status": "queued",
  "estimated_completion_sec": 45
}`,
    reverse: true,
  },
  {
    icon: Users,
    title: 'Workspace + team',
    descriptions: [
      'Multi-member workspaces with role-based access control. Invite your team, assign roles (admin, member, viewer), and collaborate on renders seamlessly.',
      'Each workspace has its own quota, API keys, and billing. Manage everything from a single dashboard.',
    ],
    visual: (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace switcher
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-xs font-bold text-white">
              OM
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">OpenMontage Labs</p>
              <p className="text-xs text-muted-foreground">Pro plan · 142/200 renders</p>
            </div>
            <Badge variant="default" className="bg-purple-600 text-xs">Active</Badge>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 p-3 opacity-60">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-muted-foreground">
              P
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Personal</p>
              <p className="text-xs text-muted-foreground">Free plan · 8/10 renders</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: CreditCard,
    title: 'Stripe billing',
    descriptions: [
      'Per-workspace prepaid credits. Each render deducts from your credit balance based on resolution, duration, and model. Top up anytime via the dashboard.',
      'Enterprise plans include monthly invoicing, custom quota limits, and dedicated account management. Stripe-powered, PCI-compliant, and transparent.',
    ],
    reverse: true,
  },
];

export default function FeaturesPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      {/* Breadcrumb */}
      <p className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Features</span>
      </p>

      {/* Hero */}
      <div className="mx-auto mb-20 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Everything you need to build with AI video
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          From cinematic quality to team collaboration &mdash; one API, infinite possibilities.
        </p>
      </div>

      {/* Feature sections */}
      <div className="mx-auto max-w-5xl space-y-32">
        {sections.map((section) => (
          <FeatureDetail key={section.title} {...section} />
        ))}
      </div>
    </div>
  );
}
