import React, { useRef, useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import { ScrollView, type ScrollViewRef } from 'ink-scroll-view'
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
  const scrollRef = useRef<ScrollViewRef>(null)
  const { stdout } = useStdout()

  if (layout.mode === 'hidden') return null

  const rawLines = content.split('\n').filter(Boolean)
  const displayLines =
    layout.mode === 'tail'
      ? rawLines.slice(-layout.tailLines)
      : rawLines.slice(-layout.maxHeight)
  const hasMore = rawLines.length > displayLines.length
  const strippedLines = displayLines.map(stripAnsi)

  useEffect(() => {
    scrollRef.current?.scrollToBottom()
  }, [content])

  useEffect(() => {
    const onResize = () => scrollRef.current?.remeasure()
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  const lineCount = strippedLines.length
  const boxHeight = Math.min(lineCount + 2, layout.maxHeight + 2)

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.border.style}
      borderColor={theme.border.color}
      paddingX={theme.padding.x}
      paddingY={theme.padding.y}
      height={boxHeight}
      overflow="hidden"
    >
      <ScrollView ref={scrollRef}>
        {layout.mode === 'tail' && hasMore && (
          <Text key="__trunc__" dimColor italic>
            … last {layout.tailLines} line{layout.tailLines !== 1 ? 's' : ''} ·{' '}
            {rawLines.length - layout.tailLines} above
          </Text>
        )}
        {strippedLines.length === 0 ? (
          <Text key="__empty__">Waiting for output...</Text>
        ) : (
          strippedLines.map((line, i) => (
            <Text key={`line-${rawLines.length - strippedLines.length + i}`} dimColor>
              {line}
            </Text>
          ))
        )}
      </ScrollView>
    </Box>
  )
}
