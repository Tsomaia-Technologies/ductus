/**
 * Configuration Resolver - pure logic for scope resolution via git diff glob matching.
 * No file I/O. SessionProcessor handles reading config from disk.
 * RFC-001 Task 020-ductus-config-resolution, Rev 06 Section 9.1, 9.2.
 */

import micromatch from "micromatch";
import { DuctusConfigSchema, type DuctusConfig, type ScopeConfig } from "./ductus-config-schema.js";

/**
 * Deep-merge source into target. Mutates target. Arrays and non-plain-objects are replaced, not merged.
 * Conflict resolution: last matched scope overrides previous (MVP per task).
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      );
    } else {
      (target as Record<string, unknown>)[key] = srcVal;
    }
  }
  return target;
}

/**
 * Parses and validates raw config, then resolves scope by matching activeFiles against scope.match globs.
 * Last matched scope overrides previous when multiple scopes match.
 * @param rawConfig - Parsed JSON object (from ductus.config.json/ts)
 * @param activeFiles - File paths from git diff (e.g. ['packages/ui/button.tsx', 'packages/backend/api.ts'])
 * @returns Resolved ScopeConfig (default + matched scopes merged). Throws ZodError on invalid config.
 */
export function resolveConfig(
  rawConfig: unknown,
  activeFiles: string[]
): ScopeConfig {
  const config = DuctusConfigSchema.parse(rawConfig) as DuctusConfig;

  const scopeNames = Object.keys(config.scopes);
  const matchingScopes: string[] = [];
  for (let i = 0; i < scopeNames.length; i++) {
    const name = scopeNames[i]!;
    const scope = config.scopes[name];
    if (!scope) continue;
    const patterns = scope.match;
    if (!patterns || patterns.length === 0) continue;
    const matched = micromatch(activeFiles, patterns);
    if (matched.length > 0) {
      matchingScopes.push(name);
    }
  }

  const base = JSON.parse(
    JSON.stringify(config.default)
  ) as Record<string, unknown>;
  for (let i = 0; i < matchingScopes.length; i++) {
    const name = matchingScopes[i]!;
    const scope = config.scopes[name];
    if (scope) {
      const overlay = JSON.parse(
        JSON.stringify(scope)
      ) as Record<string, unknown>;
      delete overlay.match;
      deepMerge(base, overlay);
    }
  }

  return base as ScopeConfig;
}
