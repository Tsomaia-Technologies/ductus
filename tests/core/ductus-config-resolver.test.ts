/**
 * DuctusConfig Resolver Definition of Done.
 * Task 020-ductus-config-resolution.
 */

import { resolveConfig } from "../../src/core/ductus-config-resolver.js";
import { ZodError } from "zod";

describe("ductus-config-resolver", () => {
  describe("The Scope Overlap Proof", () => {
    it("returns merged config where last matched scope overrides; active check matches cypress", () => {
      const mockConfig = {
        default: {
          checks: {
            test: {
              command: "jest",
              boundary: "per_task" as const,
            },
          },
          roles: {
            planner: {
              lifecycle: "single-shot" as const,
              maxRejections: 3,
              maxRecognizedHallucinations: 0,
              strategies: [
                { id: "default", model: "claude", template: "planner" },
              ],
            },
            engineer: {
              lifecycle: "session" as const,
              maxRejections: 5,
              maxRecognizedHallucinations: 2,
              strategies: [
                { id: "default", model: "claude", template: "engineer" },
              ],
            },
          },
        },
        scopes: {
          ui: {
            match: ["packages/ui/**"],
            checks: {
              test: {
                command: "cypress",
                boundary: "per_task" as const,
              },
            },
            roles: {
              planner: {
                lifecycle: "single-shot" as const,
                maxRejections: 3,
                maxRecognizedHallucinations: 0,
                strategies: [
                  { id: "default", model: "claude", template: "planner" },
                ],
              },
              engineer: {
                lifecycle: "session" as const,
                maxRejections: 5,
                maxRecognizedHallucinations: 2,
                strategies: [
                  { id: "default", model: "claude", template: "engineer" },
                ],
              },
            },
          },
        },
      };

      const activeFiles = [
        "packages/backend/api.ts",
        "packages/ui/button.tsx",
      ];
      const resolved = resolveConfig(mockConfig, activeFiles);

      expect(resolved.checks.test).toBeDefined();
      expect(resolved.checks.test.command).toBe("cypress");
    });
  });

  describe("The Zod Fatal Proof", () => {
    it("throws ZodError when engineer role is missing strategies", () => {
      const invalidConfig = {
        default: {
          checks: {},
          roles: {
            planner: {
              lifecycle: "single-shot" as const,
              maxRejections: 3,
              maxRecognizedHallucinations: 0,
              strategies: [
                { id: "default", model: "claude", template: "planner" },
              ],
            },
            engineer: {
              lifecycle: "session" as const,
              maxRejections: 5,
              maxRecognizedHallucinations: 2,
              /* strategies intentionally missing */
            },
          },
        },
        scopes: {},
      };

      expect(() => resolveConfig(invalidConfig, ["a.ts"])).toThrow(ZodError);

      try {
        resolveConfig(invalidConfig, ["a.ts"]);
      } catch (e) {
        const err = e as ZodError;
        expect(err.issues.length).toBeGreaterThan(0);
        const pathStr = err.issues[0]?.path?.join(".") ?? "";
        expect(
          pathStr.includes("strategies") || pathStr.includes("engineer")
        ).toBe(true);
      }
    });
  });
});
