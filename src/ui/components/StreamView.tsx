import React from 'react'
import { Box, Text } from 'ink'
import type { StreamLayout } from '../hooks/useStreamLayout'
import { theme } from '../theme'

interface StreamViewProps {
  content: string
  layout: StreamLayout
}

export function StreamView({ content, layout }: StreamViewProps) {
  if (layout.mode === 'hidden') return null

  const lines = content.split('\n').filter(Boolean)
  const displayLines =
    layout.mode === 'tail'
      ? lines.slice(-layout.tailLines)
      : lines.slice(-layout.maxHeight)
  const text = displayLines.join('\n') || ''

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
      <Text dimColor>{text || 'Waiting for output...'}</Text>
    </Box>
  )
}
