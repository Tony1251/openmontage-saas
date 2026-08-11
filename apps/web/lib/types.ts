// Shared types for openmontage-saas web app.
// Mirrors apps/api models for frontend use.

export type Plan = 'free' | 'pro' | 'enterprise';
export type RenderStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface Render {
  id: number; workspace_id: number; ark_task_id: string | null;
  prompt: string; model: string; duration_sec: number; resolution: string;
  status: RenderStatus; video_url: string | null; error: string | null;
  cost_cents: number; created_at: string; completed_at: string | null;
}

export interface ApiKey {
  id: number; workspace_id: number; public_key: string;
  label: string | null; status: 'active' | 'revoked';
  last_used_at: string | null; created_at: string;
}

export interface BillingPlan {
  plan: Plan;
  status: string;
  current_period_end: string | null;
  monthly_render_quota: number;
  renders_used: number;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'uncollectible' | 'void';
  pdf_url: string | null;
}

export interface WebhookEndpoint {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
}

export interface CheckoutResponse {
  url: string;
}

export interface PlanInfo {
  id: Plan;
  name: string;
  price: number;
  description: string;
  features: string[];
  accent: string;
}
