'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import type { PlanInfo } from '@/lib/types';

interface PlanCardProps {
  plan: PlanInfo;
  currentPlan: string;
  onSelect: (planId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function PlanCard({ plan, currentPlan, onSelect, isLoading, disabled }: PlanCardProps) {
  const isCurrent = currentPlan === plan.id;

  return (
    <Card className={`relative flex flex-col border-2 ${plan.accent} ${isCurrent ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{plan.name}</span>
          <span className="text-2xl font-bold">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="mb-6 flex-1 space-y-2">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {isCurrent ? (
          <Button variant="outline" disabled className="w-full">Current plan</Button>
        ) : (
          <Button
            variant={plan.id === 'free' ? 'outline' : 'default'}
            className="w-full"
            disabled={disabled || isLoading}
            onClick={() => onSelect(plan.id)}
          >
            {isLoading ? 'Redirecting...' : plan.id === 'free' ? 'Downgrade' : `Upgrade to ${plan.name}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
