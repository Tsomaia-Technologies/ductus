/**
 * NodeFsAdapter - Concrete FileAdapter using fs and readline.
 * Bootstrapper is the ONLY file that instantiates this.
 * RFC-001 Task 003, 008.
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { FileAdapter } from "../interfaces/adapters.js";

export class NodeFsAdapter implements FileAdapter {
  async append(filePath: string, line: string): Promise<void> {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(filePath, line, "utf8");
  }

  async *readStream(filePath: string): AsyncIterable<string> {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (line) yield line;
    }
  }

  async read(filePath: string): Promise<string> {
    return readFile(filePath, "utf8");
  }

  async exists(filePath: string): Promise<boolean> {
    const { access } = await import("node:fs/promises");
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
