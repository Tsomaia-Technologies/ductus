import { SkillBuilder } from './skill-builder.js'
import { Buildable } from './__internal__.js'
import { AgentEntity, HandoffConfig, PersonaValue, SystemPromptValue } from '../entities/agent-entity.js'
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
  /**
   * Returns a proxy that produces SkillRef tuples.
   * Usage: EngineerAgent.skills.implement → { agent: 'engineer', skill: 'implement' }
   */
  readonly skills: Record<string, SkillRef>

  name(name: string): this

  role(role: string): this

  /**
   * Defines the agent's identity (WHO).
   *
   * - Static string: framework auto-appends rules/rulesets after the text.
   * - Template object: rendered with agent config { agent, rules, rulesets }.
   *   User controls rule placement; no auto-append.
   * - Async resolver: called at runtime with (use, agent) to fetch persona
   *   from external sources (CMS, database, API).
   */
  persona(value: PersonaValue): this

  skill(skill: SkillBuilder): this

  rule(rule: string): this

  ruleset(ruleset: RulesetBuilder): this

  /**
   * Defines situational context (WHAT you need to know).
   *
   * - Static string: Literal, unrendered text appended to the system message.
   * - Template object: `template` path rendered with runtime state { state }.
   * - Async resolver: called at runtime with (use, agent) to fetch literal or template
   *   from external sources.
   *
   * Composed with persona into a single system message at initialization.
   */
  systemPrompt(value: SystemPromptValue): this

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
   * Renders current reducer state and relevant events from the ledger into a
   * template, producing structured context for the replacement adapter.
   *
   * Handoff reasons map to limit triggers:
   * - `overflow` — triggered by maxContextTokens
   * - `failure`  — triggered by maxFailures OR maxRecognizedHallucinations
   *                (all events from failed turns are included automatically)
   * - `scope`   — triggered by scope() quota
   *
   * The template receives: { reason, state, headEvents, tailEvents, failureCount,
   * hallucinationCount, agent }. Each event carries an `isFailed` flag.
   *
   * Event windows: `headEvents` (default: 2), `tailEvents` (default: 10).
   * If total events ≤ headEvents + tailEvents, headEvents gets all, tailEvents empty.
   *
   * `agentSummary` (scope only): calls outgoing adapter for self-summary.
   * Template field accepts string path or async resolver (use, agent) => Promise<string>.
   *
   * No handoff configured for a reason → replacement starts fresh.
   *
   * @example
   * ```typescript
   * .handoff({ reason: 'overflow', template: 'overflow.mx', headEvents: 5, tailEvents: 50 })
   * .handoff({ reason: 'failure',  template: 'failure.mx' })
   * .handoff({ reason: 'scope',    template: async (use) => use(CMS).loadTemplate('rotation'), agentSummary: true })
   * ```
   */
  handoff(config: HandoffConfig): this
}
