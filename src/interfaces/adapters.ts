/**
 * Headless abstraction boundaries for OS, File, and Terminal.
 * Pure TypeScript interfaces; no fs, child_process, readline, or inquirer.
 * RFC-001 Impl Guide Appendix A.1, Task 003-adapter-interfaces.
 */

import type { ZodSchema } from "zod";

export interface OSAdapter {
  exec(
    command: string,
    args: string[],
    options: { timeoutMs: number; cwd: string }
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}

export interface FileAdapter {
  append(filePath: string, line: string): Promise<void>;
  readStream(filePath: string): AsyncIterable<string>;
  read(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
}

export interface TerminalAdapter {
  ask<T>(question: string, schema: ZodSchema<T>): Promise<T>;
  confirm(message: string): Promise<boolean>;
  log(message: string): void;
}
