import { BUILD } from '../interfaces/builders/__internal__.js'
import { ProcessorBuilder } from '../interfaces/builders/processor-builder.js'
import { ProcessorEntity } from '../interfaces/entities/processor-entity.js'
import { EventGenerator } from '../interfaces/event-generator.js'
import { BaseEvent } from '../interfaces/event.js'

export class DefaultProcessorBuilder<TEvent extends BaseEvent, TState>
    implements ProcessorBuilder<TEvent, TState> {
    private _generator?: EventGenerator<TEvent, TState>

    processor(generator: EventGenerator<TEvent, TState>): this {
        this._generator = generator
        return this
    }

    [BUILD](): ProcessorEntity<TEvent, TState> {
        if (!this._generator) throw new Error('Processor requires a generator function.')

        return {
            processor: this._generator,
        }
    }
}
