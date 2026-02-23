import React from 'react'
import { Box, Text } from 'ink'
import useStdoutDimensions from 'ink-use-stdout-dimensions'
import { useRunContext } from '../context/RunContext'
import { useStreamLayout } from '../hooks/useStreamLayout'
import { StreamView } from './StreamView'
import { theme } from '../theme'

export function Layout({ children }: { children: React.ReactNode }) {
  const { phase, feature, tasks, currentTaskIndex, streamContent, streamActive, error } =
    useRunContext()
  const [columns, rows] = useStdoutDimensions()
  const streamLayout = useStreamLayout(rows)

  const totalTasks = tasks.length
  const currentTask = totalTasks > 0 ? tasks[currentTaskIndex] : null
  const taskLabel =
    totalTasks > 0
      ? `Task ${currentTaskIndex + 1}/${totalTasks} ${currentTask?.id ?? ''}`
      : ''

  return (
    <Box flexDirection="column" width={columns}>
      <Box marginBottom={1}>
        <Text color={theme.colors.primary} bold>
          DUCTUS
        </Text>
        <Text> {feature} </Text>
        <Text dimColor>Phase: {phase}</Text>
        {streamActive && streamLayout.mode === 'hidden' && (
          <Text color={theme.colors.muted}> Running...</Text>
        )}
      </Box>

      <Box flexDirection="column" flexGrow={1} minHeight={5}>
        {children}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}

      {streamActive && streamLayout.mode !== 'hidden' && (
        <Box marginTop={1}>
          <StreamView content={streamContent} layout={streamLayout} />
        </Box>
      )}

      {taskLabel && (
        <Box marginTop={1}>
          <Text dimColor>{taskLabel}</Text>
        </Box>
      )}
    </Box>
  )
}
