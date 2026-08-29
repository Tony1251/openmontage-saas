// Re-export shared types. In monorepo workspaces, this resolves to @openmontage/shared.
// For now, define inline so the app is self-contained.
export type Plan = 'free' | 'pro' | 'business' | 'enterprise';
export type RenderStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface Render {
  id: number; workspace_id: number; ark_task_id: string | null;
  prompt: string; model: string; duration_sec: number; resolution: string;
  status: RenderStatus; video_url: string | null; error: string | null;
  cost_cents: number; created_at: string; completed_at: string | null;
  // v1 credit accounting (docs/PRICING.md §4): settled units at creation.
  credits_consumed_units?: number;
}
export interface ApiKey {
  id: number; workspace_id: number; public_key: string;
  label: string | null; status: 'active' | 'revoked';
  last_used_at: string | null; created_at: string;
}
export interface Workspace {
  id: number;
  name: string;
  plan: Plan;
  // Denormalized credit balance, integer units (docs/PRICING.md §5.1). Always non-negative.
  credits_balance_units: number;
  created_at: string;
}
