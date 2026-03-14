import { DefaultDeferrer } from './default-deferrer.js'

export class Mutex {
  private isLocked = false
  private readonly deferrer = new DefaultDeferrer()

  async lock<T>(execute: () => Promise<T>): Promise<T> {
    if (this.isLocked) {
      await this.deferrer.sleep()
    }

    this.isLocked = true

    try {
      return await execute()
    } finally {
      if (this.deferrer.isWaiting()) {
        this.deferrer.wakeUpNext()
      } else {
        this.isLocked = false
      }
    }
  }
}
