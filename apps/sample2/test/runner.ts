import kernel from './test-kernel.js';
import { TaskEvent, TaskCompleteEvent } from '../static/events/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIntegrationTest() {
    console.log("🚀 Starting Sample 2 Integration Test...");

    // Clean up previous ledger if any
    const ledgerPath = path.join(__dirname, 'test-ledger.jsonl');
    if (fs.existsSync(ledgerPath)) {
        fs.unlinkSync(ledgerPath);
    }
    fs.writeFileSync(ledgerPath, ''); // Ensure the file exists

    try {
        await kernel.boot();
        console.log("✅ Kernel booted.");

        // Access the multiplexer from the kernel (it was passed in test-kernel.ts)
        // Since it's private in DuctusKernel, we'll use the one we exported from the kernel config or discovery.
        // Actually, let's just use it via 'any' since it's an integration test.
        const multiplexer = (kernel as any).multiplexer;

        const completionPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Test timed out after 30 seconds."));
            }, 30000);

            // Subscribe to Multiplexer to watch for the final event
            const subscriber = multiplexer.subscribe();

            (async () => {
                for await (const event of subscriber.streamEvents()) {
                    console.log(`[EVENT] ${event.type} (seq: ${event.sequenceNumber})`);
                    if (event.type === 'TaskCompleteEvent') {
                        clearTimeout(timeout);
                        resolve();
                        break;
                    }
                }
            })().catch(reject);
        });

        // Trigger the initial task
        console.log("📣 Broadcasting TaskEvent...");

        // Event creation in Ductus flow: TaskEvent is a function that returns BaseEvent
        await multiplexer.broadcast(TaskEvent({
            description: "Write a function that returns 'Hello, World!'",
            requirements: ["must be in typescript", "must be clean code"]
        }));

        await completionPromise;
        console.log("✨ Integration Test SUCCESS: TaskCompleteEvent reached.");

    } catch (err) {
        console.error("❌ Integration Test FAILED:");
        console.error(err);
        process.exit(1);
    } finally {
        await kernel.shutdown();
        console.log("🛑 Kernel shut down.");
    }
}

runIntegrationTest();
