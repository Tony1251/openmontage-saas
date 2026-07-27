/**
 * openmontage-saas — Database schema (Drizzle ORM, Postgres 16)
 *
 * Tables:
 *   users          — Clerk user mirror (we cache Clerk IDs for fast lookups)
 *   api_keys       — issued API keys (sk_live_xxx, sk_test_xxx)
 *   workspaces     — multi-user workspaces (Free: 1 user, Pro+: 5 users)
 *   workspace_members
 *   renders        — every video render request
 *   quota_usage    — monthly aggregated usage per workspace
 *   subscriptions  — Stripe subscription state
 *   webhook_endpoints — per-workspace webhook URLs
 *   audit_log      — every API call for debugging + compliance
 */

import {
  pgTable, serial, text, varchar, timestamp, integer, boolean,
  jsonb, uniqueIndex, index, pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ────────────────────────── Enums ──────────────────────────

export const planEnum = pgEnum("plan", ["free", "pro", "enterprise"]);
export const renderStatusEnum = pgEnum("render_status", [
  "queued", "running", "succeeded", "failed", "cancelled",
]);
export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "revoked"]);

// ────────────────────────── Users (Clerk mirror) ──────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────── Workspaces ──────────────────────────

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }).unique(),
  monthlyRenderQuota: integer("monthly_render_quota").notNull().default(10),  // Free: 10
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index("workspaces_owner_idx").on(t.ownerId),
}));

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 16 }).notNull().default("member"),  // owner | admin | member
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueMembership: uniqueIndex("workspace_members_unique").on(t.workspaceId, t.userId),
}));

// ────────────────────────── API Keys ──────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  // Public prefix (e.g. "sk_live_a1b2c3") shown in dashboard; full key only returned once at creation.
  publicKey: varchar("public_key", { length: 32 }).notNull().unique(),
  // SHA-256 hash of full key (we never store the secret in plaintext).
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  label: text("label"),
  status: apiKeyStatusEnum("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  workspaceIdx: index("api_keys_workspace_idx").on(t.workspaceId),
}));

// ────────────────────────── Renders ──────────────────────────

export const renders = pgTable("renders", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  // ARK task id (we submit to OpenMontage MCP → it submits to ARK → returns task id)
  arkTaskId: varchar("ark_task_id", { length: 128 }),
  prompt: text("prompt").notNull(),
  model: varchar("model", { length: 64 }).notNull().default("doubao-seedance-2-0-260128"),
  durationSec: integer("duration_sec").notNull().default(5),
  resolution: varchar("resolution", { length: 16 }).notNull().default("720p"),
  status: renderStatusEnum("status").notNull().default("queued"),
  videoUrl: text("video_url"),       // OSS / S3 signed URL when done
  error: text("error"),
  costCents: integer("cost_cents").notNull().default(0),
  metadata: jsonb("metadata"),       // extra params (image refs, audio, etc.)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  workspaceStatusIdx: index("renders_workspace_status_idx").on(t.workspaceId, t.status),
  arkTaskIdx: index("renders_ark_task_idx").on(t.arkTaskId),
}));

// ────────────────────────── Quota usage (monthly aggregates) ──────────────────────────

export const quotaUsage = pgTable("quota_usage", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),  // first day of month
  rendersUsed: integer("renders_used").notNull().default(0),
  apiCallsUsed: integer("api_calls_used").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePeriod: uniqueIndex("quota_usage_unique").on(t.workspaceId, t.periodStart),
}));

// ────────────────────────── Subscriptions (Stripe mirror) ──────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }).unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }).notNull().unique(),
  stripePriceId: varchar("stripe_price_id", { length: 64 }).notNull(),
  plan: planEnum("plan").notNull(),
  status: varchar("status", { length: 32 }).notNull(),  // active, past_due, canceled, ...
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────── Webhook endpoints ──────────────────────────

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 64 }).notNull(),  // for HMAC signing
  events: jsonb("events").$type<string[]>().notNull().default(["render.succeeded", "render.failed"]),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────── Audit log ──────────────────────────

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  action: varchar("action", { length: 64 }).notNull(),
  resourceType: varchar("resource_type", { length: 32 }),
  resourceId: varchar("resource_id", { length: 64 }),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  workspaceCreatedIdx: index("audit_workspace_created_idx").on(t.workspaceId, t.createdAt),
}));

// ────────────────────────── Relations ──────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  memberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  apiKeys: many(apiKeys),
  renders: many(renders),
  subscription: one(subscriptions),
  webhookEndpoints: many(webhookEndpoints),
  quotaUsage: many(quotaUsage),
}));

export const rendersRelations = relations(renders, ({ one }) => ({
  workspace: one(workspaces, { fields: [renders.workspaceId], references: [workspaces.id] }),
  apiKey: one(apiKeys, { fields: [renders.apiKeyId], references: [apiKeys.id] }),
}));

// ────────────────────────── Inferred TS types ──────────────────────────

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Render = typeof renders.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
