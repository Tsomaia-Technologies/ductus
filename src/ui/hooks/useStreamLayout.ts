export type StreamMode = 'full' | 'tail' | 'hidden'

export interface StreamLayout {
  mode: StreamMode
  maxHeight: number
  tailLines: number
}

/**
 * Breakpoints by stdout rows:
 * >= 30: full, 18 lines
 * 15-29: full, 10 lines
 * 12-14: tail, 3 lines
 * < 12: hidden
 */
export function useStreamLayout(rows: number): StreamLayout {
  if (rows >= 30) return { mode: 'full', maxHeight: 18, tailLines: 3 }
  if (rows >= 15) return { mode: 'full', maxHeight: 10, tailLines: 3 }
  if (rows >= 12) return { mode: 'tail', maxHeight: 3, tailLines: 3 }
  return { mode: 'hidden', maxHeight: 0, tailLines: 0 }
}
