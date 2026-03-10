# Task 08 — Agent Builder Modifications

**Phase:** 2 (Builders)
**Depends on:** Task 01 (ToolEntity), Task 02 (modified AgentEntity), Task 04 (observation events), Task 06 (ToolBuilder)
**Blocks:** Task 12
**Parallelizable with:** Tasks 06, 07

---

## Objective

Extend the existing `AgentBuilder` interface and `ImmutableAgentBuilder` implementation with the new agent capabilities: `.tool()`, `.defaultModel()`, `.defaultTransport()`, `.contextPolicy()`, `.observe()`, `.observeSkill()`, `.observeAll()`, and per-skill configuration overrides on `.skill()`.

This is the largest builder modification in the RFC.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/builders/agent-builder.ts` — current agent builder interface (full file)
- `src/builders/immutable-agent-builder.ts` — current agent builder implementation (full file)
- `src/interfaces/entities/agent-entity.ts` — modified agent entity (from Task 02) with new fields
- `src/interfaces/entities/tool-entity.ts` — `ToolEntity` (Task 01)
- `src/interfaces/builders/tool-builder.ts` — `ToolBuilder` (Task 06)
- `src/interfaces/entities/model-entity.ts` — `ModelEntity`
- `src/interfaces/builders/model-builder.ts` — `ModelBuilder`
- `src/interfaces/agent-transport.ts` — `AgentTransport` (Task 00)
- `src/interfaces/context-policy.ts` — `ContextPolicy`, `ContextPolicyName` (Task 02)
- `src/interfaces/observation-config.ts` — `ObservationConfig`, `ObservationEntry`, `SkillObservationEntry` (Task 02)
- `src/interfaces/event.ts` — `BaseEventDefinition`, `Volatility`
- `src/interfaces/builders/__internal__.ts` — `Buildable`, `BUILD`, `isBuildable`, `build`
- `src/events/observation-events.ts` — framework event definitions (Task 04)

Confirm you understand:
- The current `AgentBuilder` methods and their implementation
- The `SkillConfig` type on `AgentEntity`: `Map<string, SkillConfig>` for per-skill overrides
- The `ObservationConfig` shape and how events/skill events are stored
- That `.tool()` must accumulate (like `.rule()` does)
- That `.observe()` must accumulate entries into `ObservationConfig.events`
- That `.skill()` signature changes to optionally accept `SkillConfig`

---

## 2. Implementation

### 2.1 Modify `src/interfaces/builders/agent-builder.ts`

Add the new methods to the `AgentBuilder` interface. Keep all existing methods unchanged. The new methods to add:

```typescript
// Add these imports at the top:
import { ToolBuilder } from './tool-builder.js'
import { ToolEntity } from '../entities/tool-entity.js'
import { ModelBuilder } from './model-builder.js'
import { ModelEntity } from '../entities/model-entity.js'
import { AgentTransport } from '../agent-transport.js'
import { ContextPolicy, ContextPolicyName } from '../context-policy.js'
import { BaseEventDefinition, Volatility } from '../event.js'
import { SkillConfig } from '../entities/agent-entity.js'

// Add these methods to the AgentBuilder interface:

  /**
   * Attaches a framework-level tool to this agent.
   * Agent-level tools are available for all skills.
   * Accumulates — calling multiple times adds all tools.
   */
  tool(tool: ToolBuilder | ToolEntity): this

  /**
   * Sets the default model for this agent.
   * Can be overridden per-skill via .skill(skill, { model: ... })
   * Can be overridden at the flow level via .agent(agent, { model: ... })
   */
  defaultModel(model: ModelBuilder | ModelEntity): this

  /**
   * Sets the default transport for this agent.
   * Can be overridden per-skill via .skill(skill, { transport: ... })
   * Can be overridden at the flow level via .agent(agent, { transport: ... })
   */
  defaultTransport(transport: AgentTransport): this

  /**
   * Configures the context management policy when maxContextTokens is approached.
   * String shortcuts: 'replace', 'truncate', 'summarize', 'sliding-window'
   * Or pass a full ContextPolicy implementation for fine-grained control.
   */
  contextPolicy(policy: ContextPolicyName | ContextPolicy): this

  /**
   * Opts in to specific framework observation events for this agent.
   * Events are emitted during agent invocations if the agent has opted in.
   * Default volatility is the event definition's own volatility.
   */
  observe(event: BaseEventDefinition, options?: { volatility?: Volatility }): this
  observe(...events: BaseEventDefinition[]): this

  /**
   * Opts in to all events for a specific skill.
   * Without event arguments: all skill-level events for this skill.
   * With event arguments: only the specified events for this skill.
   */
  observeSkill(skill: SkillBuilder, ...events: BaseEventDefinition[]): this

  /**
   * Opts in to ALL framework observation events.
   * Shortcut for observing every agent, skill, and tool event.
   */
  observeAll(options?: { volatility?: Volatility }): this
```

Also modify the existing `.skill()` method to accept an optional config:

```typescript
  skill(skill: SkillBuilder, alias?: string): this
  skill(skill: SkillBuilder, config: SkillConfig): this
  skill(skill: SkillBuilder, aliasOrConfig?: string | SkillConfig): this
```

### 2.2 Modify `src/builders/immutable-agent-builder.ts`

Implement all new methods following the clone-on-write pattern.

**Requirements:**

1. **`.tool(tool)`** — accumulate into a `tools` array in params. If argument is `ToolBuilder`, use `isBuildable()` check and `build()` to get `ToolEntity`.
2. **`.defaultModel(model)`** — store in params. If argument is `ModelBuilder`, `build()` it. Stored as `ModelEntity`.
3. **`.defaultTransport(transport)`** — store in params as `AgentTransport`.
4. **`.contextPolicy(policy)`** — store in params. Accept both `ContextPolicyName` string and `ContextPolicy` object.
5. **`.observe()`** — two overloads. With options: push `{ event, volatility }` into observation entries. With spread: push each event with default volatility.
6. **`.observeSkill(skill, ...events)`** — push a `SkillObservationEntry` into skill observation entries. If no events provided, the entry has `events: undefined` (meaning "all skill events").
7. **`.observeAll(options?)`** — set `observeAll: true` and optionally `observeAllVolatility` in observation config.
8. **`.skill()` modification** — detect whether the second argument is a string (alias) or an object (config). If config, store in `skillConfigs` map keyed by the skill name.
9. **`[BUILD]()`** — assemble the `ObservationConfig` from accumulated entries and include all new fields in the output `AgentEntity`.

**Accumulation fields** (tools, observation events, skill observations) must use array cloning on each builder method call to maintain immutability.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Verify all existing code that uses `AgentBuilder` still compiles (grep for all imports).
- Verify the overloaded `.skill()` method correctly distinguishes string alias from `SkillConfig` object.
- Verify accumulation works: `.tool(A).tool(B)` produces an entity with both tools.
- Verify `.observe()` accumulation: `.observe(EventA).observe(EventB)` produces config with both events.
- Check that existing tests in `src/__tests__/agent-dispatcher.baseline.test.ts` and `tests/agents/` still pass.

---

## 4. Report

After completing the task, provide:
- List of files modified
- Confirmation that `npx tsc --noEmit` passes
- List of all existing files importing `AgentBuilder` or `ImmutableAgentBuilder`, confirming none are broken
- Any issues with the overloaded `.skill()` signature

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] All new methods follow clone-on-write pattern
- [ ] `.tool()` uses `isBuildable()` to distinguish builder from entity
- [ ] `.defaultModel()` uses `isBuildable()` to distinguish builder from entity
- [ ] `.observe()` supports both single-event-with-options and spread-of-events overloads
- [ ] `.observeSkill()` with no event args means "all events for this skill"
- [ ] `.observeAll()` sets a boolean flag in the observation config
- [ ] `.skill()` second parameter correctly distinguishes `string` from `SkillConfig`
- [ ] `[BUILD]()` correctly assembles `ObservationConfig` from accumulated entries
- [ ] `[BUILD]()` correctly builds `skillConfigs` Map from accumulated per-skill configs
- [ ] All accumulation fields (tools, observations) clone arrays on each method call
- [ ] No existing methods were modified in behavior (only new methods added)
- [ ] No circular imports introduced

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. The `.skill()` overload — is `string | SkillConfig` the right discrimination strategy? Could this be ambiguous?
2. The `.observe()` overloads — are both signatures ergonomic? Is the `options` vs spread distinction clear?
3. `ObservationConfig` assembly in `[BUILD]()` — is the merge logic between agent-level and skill-level observations correct?
4. Should `.defaultModel()` and `.defaultTransport()` be validated in `[BUILD]()`? (e.g., error if agent has skills but no model/transport and no defaults)
5. Is the overall complexity of this builder manageable, or should it be split?
