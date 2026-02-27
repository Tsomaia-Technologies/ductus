/**
 * CliTerminalAdapter - Concrete TerminalAdapter for CLI.
 * Bootstrapper is the ONLY file that instantiates this.
 * RFC-001 Task 003, 008.
 */

import type { TerminalAdapter } from "../interfaces/adapters.js";
import type { ZodSchema } from "zod";

export class CliTerminalAdapter implements TerminalAdapter {
  log(message: string): void {
    process.stdout.write(message + "\n");
  }

  async ask<T>(
    question: string,
    schema: ZodSchema<T>
  ): Promise<T> {
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(schema.parse(answer) as T);
      });
    });
  }

  async confirm(message: string): Promise<boolean> {
    const { z } = await import("zod");
    const answer = await this.ask(
      `${message} (y/n): `,
      z.enum(["y", "n", "Y", "N"]).transform((x) => x.toLowerCase() === "y")
    );
    return answer as boolean;
  }
}
