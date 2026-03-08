interface LinkedListNode<T> {
  value: T
  token: symbol
  previous: LinkedListNode<T> | null
  next: LinkedListNode<T> | null
}

export class LinkedList<T> {
  private first: LinkedListNode<T> | null = null
  private last: LinkedListNode<T> | null = null
  private registry = new Map<symbol, LinkedListNode<T>>()
  private length: number = 0

  get size(): number {
    return this.length
  }

  insertFirst(value: T) {
    const token = Symbol()
    const newNode: LinkedListNode<T> = {
      value,
      token,
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
    this.registry.set(token, newNode)

    return token
  }

  insertLast(value: T) {
    const token = Symbol()
    const newNode: LinkedListNode<T> = {
      value,
      token,
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
    this.registry.set(token, newNode)

    return token
  }

  removeFirst(): T | null {
    if (!this.first) {
      return null
    }

    const node = this.first
    this.first = this.first.next
    if (this.first) {
      this.first.previous = null
    } else {
      this.last = null
    }

    node.previous = null
    node.next = null

    --this.length
    this.registry.delete(node.token)

    return node.value
  }

  removeLast(): T | null {
    if (!this.last) {
      return null
    }

    const node = this.last
    this.last = this.last.previous
    if (this.last) {
      this.last.next = null
    } else {
      this.first = null
    }

    node.previous = null
    node.next = null

    --this.length
    this.registry.delete(node.token)

    return node.value
  }

  removeByToken(token: symbol): T | null {
    const node = this.registry.get(token)
    if (!node) return null

    const prev = node.previous
    const next = node.next

    if (prev) prev.next = next
    else this.first = next

    if (next) next.previous = prev
    else this.last = prev

    this.registry.delete(token)
    --this.length

    node.previous = null
    node.next = null

    return node.value
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
    this.registry.clear()
  }

  *values() {
    let current = this.first

    while (current) {
      yield current.value
      current = current.next
    }
  }

  *backwards() {
    let current = this.last

    while (current) {
      yield current.value
      current = current.previous
    }
  }

  *[Symbol.iterator]() {
    yield* this.values()
  }
}
