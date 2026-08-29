// Single source of truth for the client-side pricing model.
// Mirrors docs/PRICING.md — do NOT drift. All balances/estimates are integer units.
export type Resolution = '480p' | '720p' | '1080p';
export type Plan = 'free' | 'pro' | 'business' | 'enterprise';

// units per second of generated video (integer, never float).
export const UNITS_PER_SEC: Record<Resolution, number> = {
  '480p': 1,
  '720p': 2,
  '1080p': 5,
};

export interface PlanMeta {
  id: Plan;
  name: string;
  monthlyCents: number | null; // null = custom/contract
  includedUnits: number | null; // null = custom/enterprise
  allowsOverage: boolean;
  maxRes: Resolution;
  features: string[];
}

export const PLANS: Record<Plan, PlanMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyCents: 0,
    includedUnits: 40,
    allowsOverage: false,
    maxRes: '720p',
    features: ['720p max', 'Community queue', '1 API key', 'Watermark-free (queue deprioritized)'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyCents: 1900,
    includedUnits: 800,
    allowsOverage: true,
    maxRes: '1080p',
    features: ['Up to 1080p', 'Priority queue', '5 API keys', 'Webhooks'],
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyCents: 9900,
    includedUnits: 5000,
    allowsOverage: true,
    maxRes: '1080p',
    features: ['Team collaboration', 'Usage API', 'SLA', 'Up to 1080p'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyCents: null,
    includedUnits: null,
    allowsOverage: true,
    maxRes: '1080p',
    features: ['Private deployment', 'Dedicated model', 'Dedicated support', 'Custom terms'],
  },
};

// Cost of a render in integer units = resolution units/sec × duration seconds.
export function estimateUnits(resolution: Resolution | string, durationSec: number): number {
  const perSec = UNITS_PER_SEC[resolution as Resolution] ?? UNITS_PER_SEC['720p'];
  const dur = Math.max(0, Math.floor(durationSec));
  return perSec * dur;
}

// Parse a resolution string into a known Resolution (default 720p).
export function normalizeResolution(resolution: string | null | undefined): Resolution {
  return resolution === '480p' || resolution === '1080p' ? resolution : '720p';
}

export function formatUnits(units: number): string {
  return `${units.toLocaleString()}u`;
}
