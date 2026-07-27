export type Plan = "free" | "pro" | "enterprise";
export type RenderStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type ApiKeyStatus = "active" | "revoked";

export interface User { id: number; clerk_user_id: string; email: string; name: string | null; avatar_url: string | null; }
export interface Workspace { id: number; owner_id: number; name: string; slug: string; plan: Plan; monthly_render_quota: number; stripe_customer_id: string | null; }
export interface ApiKey { id: number; workspace_id: number; public_key: string; label: string | null; status: ApiKeyStatus; last_used_at: string | null; created_at: string; }
export interface ApiKeyWithSecret extends ApiKey { secret: string; }
export interface Render { id: number; workspace_id: number; ark_task_id: string | null; prompt: string; model: string; duration_sec: number; resolution: string; status: RenderStatus; video_url: string | null; error: string | null; cost_cents: number; metadata: Record<string, unknown> | null; created_at: string; completed_at: string | null; }
export interface QuotaStatus { used: number; limit: number; period_end: string; }
export interface ApiError { error: string; message: string; details?: Record<string, unknown>; }
