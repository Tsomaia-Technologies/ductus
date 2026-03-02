import { EventLedger } from '../interfaces/event-ledger.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { getInitialEventHash } from '../utils/crypto-utils.js'
import { CommittedEvent } from '../interfaces/event.js'

export type EventGuard<TEvent> = <T extends TEvent>(
  input: unknown,
  verifiedPrevHash: string,
) => input is T

export interface JsonLedgerOptions<TEvent> {
  fileAdapter: FileAdapter
  ledgerFileAbsolutePath: string
  eventGuard: EventGuard<TEvent>
}

export class JsonlLedger<TEvent> implements EventLedger<TEvent> {
  private readonly fileAdapter: FileAdapter
  private readonly ledgerFileAbsolutePath: string
  private readonly eventGuard: EventGuard<TEvent>

  constructor(options: JsonLedgerOptions<TEvent>) {
    const { fileAdapter, ledgerFileAbsolutePath, eventGuard } = options
    this.fileAdapter = fileAdapter
    this.ledgerFileAbsolutePath = ledgerFileAbsolutePath
    this.eventGuard = eventGuard
  }

  async* readEvents(): AsyncIterable<CommittedEvent<TEvent>> {
    const events = this.fileAdapter.readLinesJsonl(this.ledgerFileAbsolutePath)
    let verifiedPrevHash = getInitialEventHash()

    for await (const event of events) {
      const typedEvent = event as unknown

      if (!this.eventGuard<CommittedEvent<TEvent>>(typedEvent, verifiedPrevHash)) {
        throw new Error('Fatal error: detected invalid entry in the ledger, terminating.')
      }

      if (typedEvent.prevHash !== verifiedPrevHash) {
        throw new Error('Fatal error: tampered entry detected in the ledger, terminating.')
      }

      verifiedPrevHash = typedEvent.hash
      yield typedEvent
    }
  }
}
