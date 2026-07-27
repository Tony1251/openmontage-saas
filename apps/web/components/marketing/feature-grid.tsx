import { Film, Clock, Monitor, Code, Users, CreditCard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: Film,
    title: 'Cinematic Quality',
    description:
      'Pre-built orchestrations across Seedance, Kling, Runway, MiniMax',
  },
  {
    icon: Clock,
    title: '5\u201310 second clips',
    description:
      'Fine-tuned durations for social media, ads, and demos',
  },
  {
    icon: Monitor,
    title: '480p\u20131080p',
    description:
      'Output resolution per render. Web-optimised presets.',
  },
  {
    icon: Code,
    title: 'API-first',
    description:
      'Single POST /v1/renders. Webhooks on completion.',
  },
  {
    icon: Users,
    title: 'Workspace + team',
    description:
      'Multi-member workspaces with role-based access.',
  },
  {
    icon: CreditCard,
    title: 'Stripe billing',
    description:
      'Per-workspace quotas. Metered billing. Invoicing.',
  },
];

export default function FeatureGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title} className="border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader>
            <feature.icon className="h-8 w-8 text-purple-400" />
            <CardTitle className="text-lg text-foreground">{feature.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
