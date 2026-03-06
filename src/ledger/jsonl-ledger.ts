import { EventLedger } from '../interfaces/event-ledger.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { FileHandleAdapter } from '../interfaces/file-handle-adapter.js'
import { getInitialEventHash } from '../utils/crypto-utils.js'
import { CommittedEvent } from '../interfaces/event.js'
import { isCommitedEvent } from '../utils/guards.js'
import { LedgerFileAdapter } from '../interfaces/ledger-file-adapter.js'

export interface JsonLedgerOptions {
  fileAdapter: LedgerFileAdapter
  ledgerFileAbsolutePath: string
}

export class JsonlLedger implements EventLedger {
  private readonly fileAdapter: LedgerFileAdapter
  private readonly ledgerFileAbsolutePath: string
  private handlePromise: Promise<FileHandleAdapter> | null = null

  constructor(options: JsonLedgerOptions) {
    const { fileAdapter, ledgerFileAbsolutePath } = options
    this.fileAdapter = fileAdapter
    this.ledgerFileAbsolutePath = ledgerFileAbsolutePath
  }

  async* readEvents(options?: { afterSequence?: number }): AsyncIterable<CommittedEvent> {
    const afterSequence = options?.afterSequence
    const events = afterSequence != null
      ? this.fileAdapter.readLinesJsonlAfter(this.ledgerFileAbsolutePath, afterSequence)
      : this.fileAdapter.readLinesJsonl(this.ledgerFileAbsolutePath)
    let verifiedPrevHash = getInitialEventHash()

    for await (const event of events) {
      const typedEvent = event as unknown

      if (!isCommitedEvent(typedEvent)) {
        throw new Error('Fatal error: detected invalid entry in the ledger, terminating.')
      }

      if (typedEvent.prevHash !== verifiedPrevHash) {
        throw new Error('Fatal error: tampered entry detected in the ledger, terminating.')
      }

      verifiedPrevHash = typedEvent.hash
      yield typedEvent
    }
  }

  async readLastEvent(): Promise<CommittedEvent | null> {
    const rawEvent = await this.fileAdapter.readLastLineJsonl(this.ledgerFileAbsolutePath)
    if (!rawEvent) return null

    if (!isCommitedEvent(rawEvent)) {
      throw new Error('Fatal error: detected invalid entry at the tail of the ledger.')
    }

    return rawEvent
  }

  async appendEvent(event: CommittedEvent): Promise<void> {
    if (!this.handlePromise) {
      this.handlePromise = this.fileAdapter.open(this.ledgerFileAbsolutePath, 'a').catch(err => {
        this.handlePromise = null
        throw err
      })
    }
    const handle = await this.handlePromise
    await handle.appendJsonl(event as any)
  }
}
