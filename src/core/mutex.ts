import { LinkedList } from './linked-list.js'

export class Mutex {
    private isLocked = false
    private readonly waiters = new LinkedList<() => void>()

    async lock<T>(execute: () => Promise<T>): Promise<T> {
        if (this.isLocked) {
            await new Promise<void>(resolve => {
                this.waiters.insertLast(resolve)
            })
        }

        this.isLocked = true

        try {
            return await execute()
        } finally {
            const nextWaiter = this.waiters.removeFirst()
            if (nextWaiter) {
                nextWaiter()
            } else {
                this.isLocked = false
            }
        }
    }
}
