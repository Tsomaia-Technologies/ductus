import { ZodSchema } from 'zod/v3'

export type AgentType =
  | 'plan-creator'
  | 'plan-auditor'
  | 'task-creator'
  | 'task-auditor'
  | 'engineer'
  | 'reviewer'
  | 'auditor'

/**
 * @deprecated Superseded by AgentBuilder roles/persona. Only Zod dependency in interfaces layer.
 */
export interface AgentRole<
  TType extends AgentType | unknown = unknown,
  TContext extends object | unknown = unknown,
  TOutput extends ZodSchema | unknown = unknown
> {
  type(): TType
  persona(context: TContext): string
  allowedTools(): string[]
  schema(): TOutput
}
