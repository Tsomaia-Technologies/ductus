# Task 02 — Skill, Agent, and ContextPolicy Interface Modifications

**Phase:** 0 (Interface Lock)
**Depends on:** Task 00 (Conversation interface), Task 01 (ToolEntity interface)
**Blocks:** Tasks 05, 07, 08, 11

---

## Objective

Modify the existing `SkillEntity` and `AgentEntity` interfaces to support the new agentic layer capabilities: skill-level assertion/retry, agent-level tool attachment, model/transport defaults, context policies, and observation configuration. Define the new `ContextPolicy` interface.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/entities/skill-entity.ts` — current skill entity (will be modified)
- `src/interfaces/entities/agent-entity.ts` — current agent entity (will be modified)
- `src/interfaces/entities/tool-entity.ts` — created in Task 01
- `src/interfaces/entities/model-entity.ts` — `ModelEntity` shape
- `src/interfaces/agent-transport.ts` — created in Task 00
- `src/interfaces/conversation.ts` — created in Task 00
- `src/interfaces/event-generator.ts` — `Injector` type
- `src/interfaces/event.ts` — `BaseEventDefinition`, `EventDefinition`, `Volatility`

Confirm you understand:
- The current `SkillEntity` shape (name, input with schema+payload, output)
- The current `AgentEntity` shape (name, role, persona, skill[], rules, rulesets, scope, handoffs, etc.)
- The `ToolEntity` shape from Task 01
- The `Conversation` interface from Task 00
- The `AgentTransport` interface from Task 00

---

## 2. Implementation

### 2.1 Modify `src/interfaces/entities/skill-entity.ts`

Replace the entire file with the following. The additions are: `assert`, `maxRetries`, and `tools`.

```typescript
import { Schema } from '../schema.js'
import { Injector } from '../event-generator.js'
import { ToolEntity } from './tool-entity.js'

export interface SkillAssertContext<TState = unknown> {
  use: Injector
  getState: () => TState
}

export interface SkillEntity {
  name: string
  input: {
    schema: Schema
    payload?: string
  }
  output: Schema
  assert?: (output: unknown, context: SkillAssertContext) => void | Promise<void>
  maxRetries?: number
  tools?: ToolEntity[]
}
```

### 2.2 Create `src/interfaces/context-policy.ts`

Write this file with the exact interface below. Context policies determine how the framework manages conversation history when approaching token limits.

```typescript
import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'

export type ContextPolicyName = 'replace' | 'truncate' | 'summarize' | 'sliding-window'

export interface ContextPolicy {
  apply(
    conversation: Conversation,
    limit: number,
    transport: AgentTransport,
  ): Promise<Conversation>
}
```

### 2.3 Create `src/interfaces/observation-config.ts`

Write this file with the exact interfaces below. These define how agents declare which framework events they want emitted during invocations.

```typescript
import { BaseEventDefinition, Volatility } from './event.js'
import { SkillEntity } from './entities/skill-entity.js'

export interface ObservationEntry {
  event: BaseEventDefinition
  volatility?: Volatility
}

export interface SkillObservationEntry {
  skill: SkillEntity
  events?: BaseEventDefinition[]
  volatility?: Volatility
}

export interface ObservationConfig {
  events: ObservationEntry[]
  skillEvents: SkillObservationEntry[]
  observeAll?: boolean
  observeAllVolatility?: Volatility
}
```

### 2.4 Modify `src/interfaces/entities/agent-entity.ts`

Add the new fields to `AgentEntity`. The existing fields remain unchanged. New imports are needed for `ToolEntity`, `AgentTransport`, `ContextPolicy`, `ModelEntity`, and `ObservationConfig`.

The updated file should be:

```typescript
import { SkillEntity } from './skill-entity.js'
import { RulesetEntity } from './ruleset-entity.js'
import { ToolEntity } from './tool-entity.js'
import { ModelEntity } from './model-entity.js'
import { Injector } from '../event-generator.js'
import { PromptTemplate } from '../prompt-template.js'
import { AgentTransport } from '../agent-transport.js'
import { ContextPolicy, ContextPolicyName } from '../context-policy.js'
import { ObservationConfig } from '../observation-config.js'

export type AgentScope =
  | { type: 'feature' }
  | { type: 'task' | 'turn'; amount: number }

export type HandoffReason = 'overflow' | 'failure' | 'scope'

export type AsyncTemplateResolver =
  (use: Injector, agent: AgentEntity) => Promise<string | { template: string }>

export type PersonaValue = string | { template: string } | AsyncTemplateResolver
export type SystemPromptValue = string | { template: string } | AsyncTemplateResolver

export interface HandoffConfig {
  reason: HandoffReason
  template: string | AsyncTemplateResolver
  headEvents?: number
  tailEvents?: number
  agentSummary?: boolean
}

export interface SkillConfig {
  model?: ModelEntity
  transport?: AgentTransport
  tools?: ToolEntity[]
}

export interface AgentEntity {
  name: string
  role: string
  persona: PromptTemplate<AgentEntity>
  skill: SkillEntity[]
  skillConfigs?: Map<string, SkillConfig>
  rules: string[]
  rulesets: RulesetEntity[]
  tools?: ToolEntity[]
  defaultModel?: ModelEntity
  defaultTransport?: AgentTransport
  contextPolicy?: ContextPolicy | ContextPolicyName
  observation?: ObservationConfig
  scope?: AgentScope
  maxContextTokens?: number
  maxFailures?: number
  maxRecognizedHallucinations?: number
  timeout?: number
  handoffs?: HandoffConfig[]
  systemPrompt?: PromptTemplate<AgentEntity>
}
```

The new fields are:
- `skillConfigs` — per-skill model/transport/tool overrides, keyed by skill name
- `tools` — agent-level tools (available for all skills)
- `defaultModel` — default model for this agent
- `defaultTransport` — default transport for this agent
- `contextPolicy` — string shortcut or full policy implementation
- `observation` — which framework events to emit during invocations

---

## 3. Checks

- Run `npx tsc --noEmit` from the project root. All files must compile without errors.
- Verify existing files that import from `skill-entity.ts` and `agent-entity.ts` still compile. The modifications are additive (new optional fields), so no existing code should break.
- Verify import paths are correct for all new files.
- Grep for all imports of `SkillEntity` and `AgentEntity` to confirm nothing is broken:
  - `src/interfaces/entities/reaction-entity.ts` imports `SkillEntity` and `AgentEntity`
  - `src/interfaces/builders/agent-builder.ts` imports `AgentEntity`
  - `src/interfaces/agent-lifecycle.ts` imports `AgentEntity`
  - `src/core/agent-dispatcher.ts` imports `AgentEntity`
  - `src/builders/immutable-agent-builder.ts` imports `AgentEntity`
  - `src/builders/immutable-skill-builder.ts` imports `SkillEntity`

---

## 4. Report

After completing the task, provide:
- List of files created and modified
- Confirmation that `npx tsc --noEmit` passes
- List of all existing files that import `SkillEntity` or `AgentEntity`, confirming none are broken

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] `SkillEntity.assert` accepts `(output: unknown, context: SkillAssertContext) => void | Promise<void>` — supports both sync and async
- [ ] `SkillEntity.maxRetries` is `number | undefined` (optional)
- [ ] `SkillEntity.tools` is `ToolEntity[] | undefined` (optional)
- [ ] `SkillAssertContext` has `use: Injector` and `getState`, matching the DI pattern
- [ ] `ContextPolicy.apply` returns `Promise<Conversation>` — always async
- [ ] `ContextPolicy.apply` receives `transport` parameter (needed for `SummarizeContextPolicy`)
- [ ] `AgentEntity.skillConfigs` uses `Map<string, SkillConfig>` keyed by skill name
- [ ] `AgentEntity.contextPolicy` accepts both string shortcut and full implementation
- [ ] `ObservationConfig.events` uses `BaseEventDefinition` (the base, not `EventDefinition`)
- [ ] All new fields on `AgentEntity` are optional (existing code must not break)
- [ ] No existing type exports were removed or renamed

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. `SkillConfig` — is `Map<string, SkillConfig>` the right structure, or should skill configs be co-located with the skill array entries?
2. `ObservationConfig` — is this the right shape for merging skill-level and agent-level observations?
3. `ContextPolicy.apply` receiving `AgentTransport` — is this the cleanest dependency, or should the summarize policy receive a more abstract "summarizer" interface?
4. Are there any missing fields on `AgentEntity` that the RFC specifies but this task omits?
