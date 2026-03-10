# Ductus Framework

Ductus is an event sourcing framework built on async generators in TypeScript. It provides declarative primitives for processors, reactions, reducers, backpressure management, and agentic workflows.

## Directory Map

```
src/
  interfaces/           Type definitions and builder interfaces
    builders/           Fluent builder interfaces (SkillBuilder, AgentBuilder, etc.)
    entities/           Entity data shapes (SkillEntity, AgentEntity, etc.)
    coordination/       Cluster and scaling interfaces
  builders/             Immutable builder implementations
  core/                 Runtime (kernel, dispatcher, multiplexers, coordination)
  events/               Event definitions
  utils/                Shared utilities (event factories, schema, guards)
  factories.ts          Ductus.* DSL entry point
  index.ts              Public export surface
rfc/                    RFC specifications and implementation plan
  tasks/                Task briefs for RFC 0001 implementation
  prompts/              Agent prompts for engineer and reviewer roles
sample2/tests/          Integration tests
```

## Code Conventions

- **ESM imports with `.js` extensions:** `import { X } from './foo.js'`
- **Clone-on-write builders:** every builder method returns a new instance. Never mutate `this`.
- **`BUILD` symbol:** builders implement `Buildable<T>` from `src/interfaces/builders/__internal__.ts`. The `[BUILD]()` method produces the final entity.
- **`isBuildable()` and `build()`:** use these from `__internal__.ts` when accepting `Builder | Entity` parameters.
- **Named exports only** on interfaces and entities. No default exports.
- **`unknown` over `any`** in new code.
- **Events:** durable via `event()`, volatile via `signal()` from `src/utils/event-utils.ts`. Framework events use `Ductus/` type prefix.
- **Schema:** `Schema = ZodSchema`. Payload shapes use helpers from `src/utils/schema-utils.ts`.
- **No narrating comments.** Comments only for non-obvious intent, trade-offs, or constraints.

## Active Work

The agentic layer redesign (RFC 0001) is in progress. If working on this, read `rfc/tasks/README.md` first. It contains the dependency graph, phase overview, and task status.
