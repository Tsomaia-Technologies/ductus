/**
 * NodeOSAdapter - Concrete OSAdapter using execa.
 * Bootstrapper is the ONLY file that instantiates this.
 * RFC-001 Task 003, 008.
 */

import { execa } from "execa";
import type { OSAdapter } from "../interfaces/adapters.js";

export class NodeOSAdapter implements OSAdapter {
  async exec(
    command: string,
    args: string[],
    options: import("../interfaces/adapters.js").OSAdapterExecOptions
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = await execa(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      reject: false,
      stdin: "ignore",
      signal: options.signal,
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exitCode ?? (result.failed ? 1 : 0),
    };
  }
}
