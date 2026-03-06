import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(__dirname, 'emulator.log');

function log(msg) {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
}

/**
 * Fake Agent Emulator for Sample 2 Integration Tests.
 */
async function runEmulator() {
    log(`Started. CWD: ${process.cwd()}`);

    let inputBuffer = '';
    try {
        inputBuffer = fs.readFileSync(0, 'utf-8');
    } catch (e) {
        log(`Stdin Read Error: ${e.message}`);
    }

    const contextStr = process.env.DUCTUS_CONTEXT || '{}';
    const context = JSON.parse(contextStr);

    // Identify role by looking at messages (persona/role strings)
    const allContent = context.messages?.map(m => m.content).join(' ') || '';

    let role = 'unknown';
    if (allContent.toLowerCase().includes('implement task')) {
        role = 'engineer';
    } else if (allContent.toLowerCase().includes('hostile reviewer')) {
        role = 'reviewer';
    }

    log(`Role identified as ${role} based on content: ${allContent.substring(0, 100)}...`);

    // Simulate thinking
    await new Promise(resolve => setTimeout(resolve, 100));

    let response;
    if (role === 'engineer') {
        response = {
            summary: "I have implemented the greeting function.",
            checks: [{ command: "npm test", cwd: "./", result: { success: true } }]
        };
    } else if (role === 'reviewer') {
        response = { status: "decision" };
    } else {
        log(`ERROR: Could not identify role. Content: ${allContent}`);
        process.exit(1);
    }

    const output = JSON.stringify(response);
    process.stdout.write(output + '\n');
    log("Exiting.");
}

// Clear log
fs.writeFileSync(logFile, '');

runEmulator().catch(err => {
    log(`FATAL ERROR: ${err.stack}`);
    process.exit(1);
});
