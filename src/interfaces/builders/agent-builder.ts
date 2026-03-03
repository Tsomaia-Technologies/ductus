import { SkillBuilder } from './skill-builder.js'
import { Buildable } from './__internal__.js'
import { AgentEntity } from '../entities/agent-entity.js'
import { RulesetBuilder } from './ruleset-builder.js'

export interface AgentBuilder extends Buildable<AgentEntity> {
  name(name: string): this
  role(role: string): this
  persona(persona: string): this
  skill(skill: SkillBuilder): this
  rule(rule: string): this
  ruleset(ruleset: RulesetBuilder): this

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
   *
   * Replacement policies are as follows:
   * - summarize: Asks the agent to summarize its own context, and passed that context to replacement.
   * - truncate: Truncates first few messages and passes the rest to replacement
   * - fresh: starts fresh instance
   */
  maxContextTokens(value: number, overflowPolicy?: 'summarize' | 'truncate' | 'fresh'): this

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
}
