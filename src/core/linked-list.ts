interface LinkedListNode<T> {
  value: T
  previous: LinkedListNode<T> | null
  next: LinkedListNode<T> | null
}

export class LinkedList<T> {
  private first: LinkedListNode<T> | null = null
  private last: LinkedListNode<T> | null = null
  private length: number = 0

  get size(): number {
    return this.length
  }

  insertFirst(value: T) {
    const newNode: LinkedListNode<T> = {
      value,
      previous: null,
      next: this.first,
    }

    if (this.first) {
      this.first.previous = newNode
    } else {
      this.last = newNode
    }
    this.first = newNode
    ++this.length
  }

  insertLast(value: T) {
    const newNode: LinkedListNode<T> = {
      value,
      previous: this.last,
      next: null,
    }

    if (this.last) {
      this.last.next = newNode
    } else {
      this.first = newNode
    }
    this.last = newNode
    ++this.length
  }

  removeFirst(): T | null {
    if (!this.first) {
      return null
    }

    const value = this.first.value
    this.first = this.first.next
    if (this.first) {
      this.first.previous = null
    } else {
      this.last = null
    }
    --this.length

    return value
  }

  removeLast(): T | null {
    if (!this.last) {
      return null
    }

    const value = this.last.value
    this.last = this.last.previous
    if (this.last) {
      this.last.next = null
    } else {
      this.first = null
    }
    --this.length

    return value
  }

  toArray() {
    const list = []
    let current = this.first

    while (current) {
      list.push(current.value)
      current = current.next
    }

    return list
  }

  clear(): void {
    if (this.first) this.first.next = null
    if (this.last) this.last.previous = null
    this.first = null
    this.last = null
    this.length = 0
  }
}
