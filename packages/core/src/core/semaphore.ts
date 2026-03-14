// src/core/semaphore.ts

import { DefaultDeferrer } from './default-deferrer.js'

export class Semaphore {
  private permits: number
  private readonly deferrer = new DefaultDeferrer()

  constructor(maxPermits: number) {
    this.permits = maxPermits
  }

  async acquire(): Promise<void> {
    while (this.permits <= 0) {
      await this.deferrer.sleep()
    }
    this.permits--
  }

  release(): void {
    this.permits++
    this.deferrer.wakeUpNext()
  }
}
