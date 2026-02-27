# Task: 020-ductus-config-resolution

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Config interpolation rules)
- `rfc-001.revision-06.md` (Section 9.0 Configuration Manifest & Interpolation)

## 1. Objective & Responsibility
Implement the fundamental Configuration Resolver engine, exposing isolated logic (`resolveConfig`) and strict schemas (`DuctusConfigSchema`). This utility is invoked early in the system lifecycle. It enforces the rigid mathematical shape of the user's `ductus.config.ts`, handles the deep-merging of granular project scopes via git diff glob matching, and parses the critical `.mx` template mappings for the AI processors.

## 2. Invariants & Global Contracts (The Happy Path)
- **Strict Zod Parsing:** The user's parsed config object MUST be forced through an exhaustive `z.object().strict()` validation. Typos in user configurations cannot be allowed to trickle down into the internal processor mechanisms.
- **Scope Specificity:** The system allows deep config overrides based on physical file paths. If a user defines a `scope` (e.g., `packages/ui/**`) that introduces an aggressive linting check, and the running active task touches a file in `packages/ui/button.tsx`, the resolver MUST deeply merge the specific scope configuration over the `default` configuration.

## 3. I/O Boundaries & Dependencies
- **Physical Decoupling:** The actual reading of the native `ductus.config.ts` from disk is NOT the responsibility of this file. `SessionProcessor` handles file I/O. This package purely provides the logic and mathematical typing needed to parse the raw JS object.
- **Micromatch Native:** Integrating dynamic file globs requires importing `micromatch` or an equivalent glob parsing dependency.

## 4. Exact Event Signatures (Contract Adherence)
- *N/A (This provides deterministic Configuration Objects to be yielded inside `CONTEXT_LOADED` payloads).*

## 5. Lifecycle & Unhappy Path
- **Configuration Parsing Failures:** The parser MUST catch malformed `config` objects, immediately halting resolution and tossing a verbose Zod format error outward. The engine refuses to boot on partial configurations.
- **Scope Overlapping:** If an active session touches files spanning across two distinct, conflicting scopes (e.g. `packages/ui/**` and `packages/db/**`), the parser must employ a documented conflict resolution strategy (e.g., highest array index wins, or strict erroring). For this MVP, apply the standard "last matched scope in the array overrides previous."

## 6. Required Execution Constraints
- Expand `DuctusConfigSchema` using Zod to map precisely to Section 9.0 of the RFC. Define the `checks`, `roles`, `strategies`, and `.mx` template string mapping.
- Implement the `resolveConfig(rawConfig, activeFiles)` pure function containing the deep-merge recursion logic utilizing `micromatch(activeFiles, scope.match)`.

## 7. Definition of Done
1. **The Scope Overlap Proof:** Supply a mock configuration mapping `default` to a `jest` command. Apply `packages/ui/**` scope to a `cypress` command. Provide an array of active files `['packages/backend/api.ts', 'packages/ui/button.tsx']`. Assert that the `resolveConfig` explicitly returned an object where the active check matches the `cypress` command, correctly recognizing the overlapping context.
2. **The Zod Fatal Proof:** Supply a mock config completely missing the primary `strategies` object for the `EngineerRole`. Provide `['a.ts']`. Assert that parsing forcefully throws a detailed ZodError tracing back to the missing property.
