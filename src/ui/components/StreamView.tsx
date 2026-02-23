import React from 'react'
import { Box, Text } from 'ink'
import type { StreamLayout } from '../hooks/useStreamLayout.js'
import { theme } from '../theme.js'

const ANSI_REGEX = /\x1b\[[0-9;]*m|\x1b\]8;[^;]*;[^\x1b]*\x1b\\/g

interface StreamViewProps {
  content: string
  layout: StreamLayout
}

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '')
}

export function StreamView({ content, layout }: StreamViewProps) {
  if (layout.mode === 'hidden') return null

  const rawLines = content.split('\n').filter(Boolean)
  const displayLines =
    layout.mode === 'tail'
      ? rawLines.slice(-layout.tailLines)
      : rawLines.slice(-layout.maxHeight)
  const hasMore = rawLines.length > displayLines.length
  const text = displayLines.map(stripAnsi).join('\n') || ''

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.border.style}
      borderColor={theme.border.color}
      paddingX={theme.padding.x}
      paddingY={theme.padding.y}
      height={Math.min(displayLines.length + 2, layout.maxHeight + 2)}
      overflow="hidden"
    >
      {layout.mode === 'tail' && hasMore && (
        <Text dimColor italic>
          … last {layout.tailLines} line{layout.tailLines !== 1 ? 's' : ''} · {rawLines.length - layout.tailLines} above
        </Text>
      )}
      <Text dimColor>{text || 'Waiting for output...'}</Text>
    </Box>
  )
}
