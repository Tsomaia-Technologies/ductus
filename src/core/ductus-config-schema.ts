/**
 * DuctusConfig Zod schema - validates user configuration.
 * RFC-001 Rev 06 Section 9, Task 012-session-processor.
 */

import { z } from "zod";

const CheckConfigSchema = z.object({
  command: z.string(),
  boundary: z.enum(["per_iteration", "per_task", "per_feature"]),
  requires_context: z.boolean().optional(),
  timeout: z.number().optional(),
});

const StrategySchema = z.object({
  id: z.string(),
  model: z.string(),
  template: z.string(),
});

const RoleConfigSchema = z.object({
  lifecycle: z.enum(["single-shot", "contextual-burst", "session"]),
  maxRejections: z.number(),
  maxRecognizedHallucinations: z.number(),
  strategies: z.array(StrategySchema).min(1),
});

const ScopeConfigSchema = z.object({
  checks: z.record(z.string(), CheckConfigSchema).default({}),
  roles: z.record(z.string(), RoleConfigSchema),
});

const ScopeWithMatchSchema = ScopeConfigSchema.extend({
  match: z.array(z.string()).optional(),
});

export const DuctusConfigSchema = z
  .object({
    default: ScopeConfigSchema,
    scopes: z.record(z.string(), ScopeWithMatchSchema).default({}),
  })
  .strict();

export type DuctusConfig = z.infer<typeof DuctusConfigSchema>;
