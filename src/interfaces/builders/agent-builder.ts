import { SkillBuilder } from './skill-builder.js'
import { Buildable } from './__internal__.js'
import { AgentEntity, HandoffConfig } from '../entities/agent-entity.js'
import { RulesetBuilder } from './ruleset-builder.js'

/**
 * Reference tuple for use in reaction builder .invoke() calls.
 * Produced by AgentBuilder.skills proxy at builder-time.
 */
export interface SkillRef {
  agent: string
  skill: string
}

export interface AgentBuilder extends Buildable<AgentEntity> {
  name(name: string): this
  role(role: string): this

  /**
   * Static string — framework auto-appends rules/rulesets after the text.
   * Template — rendered with agent config { agent: { name, role }, rules, rulesets }.
   *            User controls rule placement; no auto-append.
   */
  persona(value: string | { template: string }): this

  skill(skill: SkillBuilder): this
  rule(rule: string): this
  ruleset(ruleset: RulesetBuilder): this

  /**
   * Returns a proxy that produces SkillRef tuples.
   * Usage: EngineerAgent.skills.implement → { agent: 'engineer', skill: 'implement' }
   */
  readonly skills: Record<string, SkillRef>

  /**
   * Template path rendered with runtime state at adapter initialization.
   * Provides situational context (WHAT you need to know) separate from
   * persona (WHO you are). Composed with persona into a single system message.
   */
  systemPrompt(template: string): this

  /**
   * Agent leaves for the duration of feature, unless reaches any of the hard limitations (see below).
   */
  scope(type: 'feature'): this

  /**
   * Agent lives <n> tasks/turns, then gets replaced
   */
  scope(type: 'task' | 'turn', amount: number): this

  /**
   * Equivalent of calling: .scope('turn', 1)
   */
  ephemeral(): void // same as .scope('turn', 1)

  /**
   * Maximum number of tokens after which an agent gets replaced.
   */
  maxContextTokens(value: number): this

  /**
   * @note: Rejected code, rejected plan, etc
   *
   * @param value
   */
  maxFailures(value: number): this

  /**
   * Such as:
   * - Invalid output format,
   * - False claims about performed checks (e.g. claiming all checks are green, when system verified otherwise)
   * - Reviewer reporting git diff and implementation report does not match, etc.
   * - Git diff showing more files changed then claimed inventory
   *
   * @param value
   */
  maxRecognizedHallucinations(value: number): this

  /**
   * Timeout, in milliseconds, after which the agent gets replaced - in case there was no event from it in this time.
   */
  timeout(timeoutMs: number): this

  /**
   * Configures context transfer when an agent gets replaced.
   *
   * Instead of relying on AI self-reporting (summarization), the handoff renders
   * current reducer state and relevant events from the ledger into a Moxite template,
   * producing structured context for the replacement adapter.
   *
   * Handoff reasons map to limit triggers:
   * - `overflow` — triggered by maxContextTokens
   * - `failure`  — triggered by maxFailures OR maxRecognizedHallucinations
   *                (all events from failed turns are included automatically)
   * - `scope`   — triggered by scope() quota
   *
   * The template receives: { reason, state, headEvents, tailEvents, failureCount,
   * hallucinationCount, agent }. Each event carries an `isFailed` flag indicating
   * whether it was emitted during a turn the dispatcher marked as failed.
   *
   * Event windows: `headEvents` (default: 2) captures foundational events.
   * `tailEvents` (default: 10) captures recent activity.
   * If total events ≤ headEvents + tailEvents, headEvents gets all events
   * and tailEvents is empty.
   *
   * `agentSummary` (scope only): if true, calls the outgoing adapter for a
   * self-summary before terminating. Available as `{{agentSummary}}` in template.
   *
   * No handoff configured for a reason → replacement starts fresh (no context).
   *
   * @example
   * ```typescript
   * .handoff({ reason: 'overflow', template: 'overflow.mx', headEvents: 5, tailEvents: 50 })
   * .handoff({ reason: 'failure',  template: 'failure.mx' })
   * .handoff({ reason: 'scope',    template: 'rotation.mx', agentSummary: true })
   * ```
   */
  handoff(config: HandoffConfig): this
}
