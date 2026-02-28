/**
 * The Type Machine Processor
 * Wraps the pure `ductusReducer` into a Reactive Stream Processor.
 * It strictly adheres to `AsyncIterable<Incoming> -> AsyncIterable<Outgoing>`.
 */

import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { ductusReducer, GENESIS_STATE, type StateMachineContext } from "../core/state-machine-reducer.js";

export class StateMachineProcessor implements EventProcessor {
    private currentState: StateMachineContext = GENESIS_STATE;

    /**
     * For testing or hydration inspection.
     */
    public getState(): StateMachineContext {
        return this.currentState;
    }

    async *process(stream: InputEventStream): OutputEventStream {
        for await (const event of stream) {
            const [nextState, effects] = ductusReducer(this.currentState, event);

            // Update the state tree internal brain memory
            this.currentState = nextState;

            // Yield any calculated side-effects sequentially
            for (const effect of effects) {
                yield effect;
            }
        }
    }
}
