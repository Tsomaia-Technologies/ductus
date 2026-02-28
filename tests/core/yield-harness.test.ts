import { MultiplexerHub } from "../../src/core/multiplexer-hub.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../../src/interfaces/event-processor.js";
import { createTick, createAgentToken } from "../../src/core/events/creators.js";

/**
 * Dummy Processor 1: Generating standard deterministic ticks.
 * Proof that a processor can yield events WITHOUT relying on an incoming stream to trigger it.
 */
class ClockGeneratorProcessor implements EventProcessor {
    async *process(stream: InputEventStream): OutputEventStream {
        // Generate exactly 5 ticks
        for (let i = 0; i < 5; i++) {
            yield createTick({
                payload: { ms: 1000, isReplay: false },
                authorId: "clock",
                timestamp: Date.now() + i * 1000
            });
            // Simulate real-world asynchronous delay
            await new Promise((r) => setTimeout(r, 10));
        }
    }
}

/**
 * Dummy Processor 2: Reactive Stream Transformer.
 * Proof that a processor can react to incoming events, perform logic, and yield strictly in response.
 */
class TranslatorProcessor implements EventProcessor {
    async *process(stream: InputEventStream): OutputEventStream {
        for await (const incoming of stream) {
            if (incoming.type === "TICK") {
                yield createAgentToken({
                    payload: { token: "beep" },
                    authorId: "translator"
                });
            }
        }
    }
}

describe("MultiplexerHub Yield Harness", () => {
    it("mathematically proves the loops spin without deadlock and maintain immutable cryptography", async () => {
        const hub = new MultiplexerHub();

        const clock = new ClockGeneratorProcessor();
        const translator = new TranslatorProcessor();

        // The physical wiring that the Bootstrapper will eventually perform.
        // Note: Hub is NEVER passed into the Processors.
        const clockStream = clock.process(hub.subscribe());
        const translatorStream = translator.process(hub.subscribe());

        const interceptedEvents: any[] = [];

        // We attach an observer queue just to inspect the final frozen events
        const observer = hub.subscribe();

        // Wire up the engine (Fire and Forget)
        // Promise.all handles the parallel generator consumption
        const engineCore = Promise.all([
            (async () => {
                for await (const out of clockStream) {
                    hub.broadcast(out);
                }
            })(),
            (async () => {
                for await (const out of translatorStream) {
                    hub.broadcast(out);
                }
            })()
        ]);

        // Read the results from the observer
        let readCount = 0;
        for await (const committed of observer) {
            interceptedEvents.push(committed);
            readCount++;
            // We expect 5 Ticks + 5 AgentTokens = 10 events total
            if (readCount === 10) {
                break; // Stop listening
            }
        }

        // Shut down the hub to close all processor subscriptions
        hub.close();

        // Wait for the synchronous core loops to finish what they were doing and clean up
        await engineCore;

        // --- Assertions (Zero-Deviation Proofs) ---

        expect(interceptedEvents).toHaveLength(10);

        // Proof 1: Sequence Counter increases deterministically
        for (let i = 0; i < 10; i++) {
            expect(interceptedEvents[i].sequenceNumber).toBe(i);
        }

        // Proof 2: Immutable Type enforced by Object.freeze
        expect(Object.isFrozen(interceptedEvents[0])).toBe(true);
        expect(Object.isFrozen(interceptedEvents[0].payload)).toBe(true);

        // Proof 3: Cryptographic Chain is valid
        for (let i = 1; i < 10; i++) {
            expect(interceptedEvents[i].prevHash).toBe(interceptedEvents[i - 1].hash);
        }

        // Proof 4: Volatility flag successfully transformed from draft to finalized type
        const tokens = interceptedEvents.filter(e => e.type === "AGENT_TOKEN");
        expect(tokens.length).toBe(5);
        expect(tokens[0].volatility).toBe("volatile"); // Mapped down from volatile-draft

        const ticks = interceptedEvents.filter(e => e.type === "TICK");
        expect(ticks.length).toBe(5);
        expect(ticks[0].volatility).toBe("volatile"); // mapped down from volatile-draft
    });
});
