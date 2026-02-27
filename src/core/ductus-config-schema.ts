/**
 * DuctusConfig Zod schema - validates user configuration.
 * RFC-001 Rev 06 Section 9, Task 012-session-processor, Task 020-ductus-config-resolution.
 * Strict parsing rejects typos; all nested objects use .strict().
 */

import { z } from "zod";

const CheckConfigSchema = z
  .object({
    command: z.string(),
    boundary: z.enum(["per_iteration", "per_task", "per_feature"]),
    requires_context: z.boolean().optional(),
    timeout: z.number().optional(),
  })
  .strict();

const StrategySchema = z
  .object({
    id: z.string(),
    model: z.string(),
    template: z.string(),
  })
  .strict();

const RoleConfigSchema = z
  .object({
    lifecycle: z.enum(["single-shot", "contextual-burst", "session"]),
    maxRejections: z.number(),
    maxRecognizedHallucinations: z.number(),
    strategies: z.array(StrategySchema).min(1),
  })
  .strict();

const ScopeConfigSchema = z
  .object({
    checks: z.record(z.string(), CheckConfigSchema).default({}),
    roles: z.record(z.string(), RoleConfigSchema),
  })
  .strict();

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
export type ScopeConfig = z.infer<typeof ScopeConfigSchema>;
