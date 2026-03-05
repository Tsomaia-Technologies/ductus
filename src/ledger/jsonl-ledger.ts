import { EventLedger } from '../interfaces/event-ledger.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { FileHandleAdapter } from '../interfaces/file-handle-adapter.js'
import { getInitialEventHash } from '../utils/crypto-utils.js'
import { CommittedEvent } from '../interfaces/event.js'
import { isCommitedEvent } from '../utils/guards.js'

export interface JsonLedgerOptions {
  fileAdapter: FileAdapter
  fileHandleAdapter: FileHandleAdapter
  ledgerFileAbsolutePath: string
}

export class JsonlLedger implements EventLedger {
  private readonly fileAdapter: FileAdapter
  private readonly fileHandleAdapter: FileHandleAdapter
  private readonly ledgerFileAbsolutePath: string
  private openPromise: Promise<void> | null = null

  constructor(options: JsonLedgerOptions) {
    const { fileAdapter, fileHandleAdapter, ledgerFileAbsolutePath } = options
    this.fileAdapter = fileAdapter
    this.fileHandleAdapter = fileHandleAdapter
    this.ledgerFileAbsolutePath = ledgerFileAbsolutePath
  }

  async* readEvents(): AsyncIterable<CommittedEvent> {
    const events = this.fileAdapter.readLinesJsonl(this.ledgerFileAbsolutePath)
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
    let lastEvent: CommittedEvent | null = null
    for await (const event of this.readEvents()) {
      lastEvent = event
    }
    return lastEvent
  }

  async appendEvent(event: CommittedEvent): Promise<void> {
    if (!this.openPromise) {
      this.openPromise = this.fileHandleAdapter.open(this.ledgerFileAbsolutePath, 'a')
    }
    await this.openPromise
    await this.fileHandleAdapter.appendJsonl(event as any)
  }
}
