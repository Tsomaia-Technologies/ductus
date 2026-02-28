import { EventLedger } from '../interfaces/event-ledger.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { getInitialEventHash } from '../utils/crypto-utils.js'

export type EventGuard<TCommitedEvent> = <T extends TCommitedEvent>(
  input: unknown,
  verifiedPrevHash: string,
) => input is T

export type BaseCommitedEvent = { hash: string; prevHash: string }

export interface JsonLedgerOptions<TCommitedEvent extends BaseCommitedEvent> {
  fileAdapter: FileAdapter
  ledgerFileAbsolutePath: string
  eventGuard: EventGuard<TCommitedEvent>
}

export class JsonlLedger<TCommitedEvent extends BaseCommitedEvent> implements EventLedger<TCommitedEvent> {
  private readonly fileAdapter: FileAdapter
  private readonly ledgerFileAbsolutePath: string
  private readonly eventGuard: EventGuard<TCommitedEvent>

  constructor(options: JsonLedgerOptions<TCommitedEvent>) {
    const { fileAdapter, ledgerFileAbsolutePath, eventGuard } = options
    this.fileAdapter = fileAdapter
    this.ledgerFileAbsolutePath = ledgerFileAbsolutePath
    this.eventGuard = eventGuard
  }

  async* readEvents(): AsyncIterable<TCommitedEvent> {
    const events = this.fileAdapter.readLinesJsonl(this.ledgerFileAbsolutePath)
    let verifiedPrevHash = getInitialEventHash()

    for await (const event of events) {
      const typedEvent = event as unknown

      if (!this.eventGuard<TCommitedEvent>(typedEvent, verifiedPrevHash)) {
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
