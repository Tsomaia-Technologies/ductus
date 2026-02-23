export type StreamMode = 'full' | 'tail' | 'hidden'

export interface StreamLayout {
  mode: StreamMode
  maxHeight: number
  tailLines: number
}

/**
 * Breakpoints by stdout rows:
 * >= 30: full, 18 lines
 * 20-29: full, 12 lines
 * 15-19: full, 8 lines
 * 14: tail, 3 lines (minimum usable tail)
 * 12-13: tail, 2 lines (extra-tight windows)
 * < 12: hidden
 */
export function useStreamLayout(rows: number): StreamLayout {
  if (rows >= 30) return { mode: 'full', maxHeight: 18, tailLines: 3 }
  if (rows >= 20) return { mode: 'full', maxHeight: 12, tailLines: 3 }
  if (rows >= 15) return { mode: 'full', maxHeight: 8, tailLines: 3 }
  if (rows >= 14) return { mode: 'tail', maxHeight: 3, tailLines: 3 }
  if (rows >= 12) return { mode: 'tail', maxHeight: 2, tailLines: 2 }
  return { mode: 'hidden', maxHeight: 0, tailLines: 0 }
}
