import React from 'react'
import { Box, Text } from 'ink'
import { useRunContext } from '../context/RunContext'
import { theme } from '../theme'

export function ErrorView() {
  const { error, errorContext } = useRunContext()

  const hasContext =
    errorContext &&
    (errorContext.taskId != null ||
      errorContext.taskIndex != null ||
      errorContext.attempt != null)

  return (
    <Box flexDirection="column">
      {hasContext && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Pipeline failed with context:</Text>
          {errorContext!.taskId != null && (
            <Text dimColor>  Task: {errorContext!.taskId}</Text>
          )}
          {errorContext!.taskIndex != null && (
            <Text dimColor>  Index: {errorContext!.taskIndex + 1}</Text>
          )}
          {errorContext!.attempt != null && errorContext!.attempt > 0 && (
            <Text dimColor>  Attempt: {errorContext!.attempt + 1}</Text>
          )}
        </Box>
      )}
      <Text color={theme.colors.error} bold>
        {error ?? 'An error occurred.'}
      </Text>
    </Box>
  )
}
