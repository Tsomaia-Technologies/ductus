import { useState, useEffect } from 'react'
import { useStdout } from 'ink'

/** Returns [columns, rows] of stdout, updated on resize. Replaces ink-use-stdout-dimensions (CJS) to avoid require("ink"). */
export function useStdoutDimensions(): [number, number] {
  const { stdout } = useStdout()
  const [dimensions, setDimensions] = useState<[number, number]>([
    stdout.columns,
    stdout.rows,
  ])
  useEffect(() => {
    const handler = () => setDimensions([stdout.columns, stdout.rows])
    stdout.on('resize', handler)
    return () => {
      stdout.off('resize', handler)
    }
  }, [stdout])
  return dimensions
}
