import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readStdin() {
    return new Promise<string>((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data);
        });
        // If stdin is already finished
        if (process.stdin.readableEnded) {
            resolve(data);
        }
    });
}

/**
 * Fake Agent Emulator for Sample 2 Integration Tests.
 */
async function runEmulator() {
    process.stderr.write(`[EMULATOR] Starting... CWD: ${process.cwd()}\n`);

    // Read the prompt from stdin
    const prompt = await readStdin();
    process.stderr.write(`[EMULATOR] Received prompt of length: ${prompt.length}\n`);

    // The CliAgentAdapter passes the AgentContext in DUCTUS_CONTEXT env var
    const contextStr = process.env.DUCTUS_CONTEXT || '{}';
    process.stderr.write(`[EMULATOR] Context: ${contextStr}\n`);

    const context = JSON.parse(contextStr);
    const role = context.role || 'unknown';
    process.stderr.write(`[EMULATOR] Matched Role: ${role}\n`);

    // Simulate thinking/processing
    await new Promise(resolve => setTimeout(resolve, 500));

    if (role.toLowerCase().includes('engineer')) {
        // Output ImplementationReport
        const response = {
            summary: "I have implemented the requested task.",
            checks: [
                {
                    command: "npm test",
                    cwd: "./",
                    result: { success: true }
                }
            ]
        };
        const output = JSON.stringify(response);
        process.stderr.write(`[EMULATOR] Engineer Output: ${output}\n`);
        process.stdout.write(output + '\n');
    } else if (role.toLowerCase().includes('reviewer')) {
        // Output Approval
        const response = {
            status: "decision"
        };
        const output = JSON.stringify(response);
        process.stderr.write(`[EMULATOR] Reviewer Output: ${output}\n`);
        process.stdout.write(output + '\n');
    } else {
        process.stderr.write(`[EMULATOR] ERROR: Unknown role: ${role}\n`);
        process.exit(1);
    }
}

runEmulator().catch(err => {
    process.stderr.write(`[EMULATOR] FATAL ERROR: ${err.stack}\n`);
    process.exit(1);
});
