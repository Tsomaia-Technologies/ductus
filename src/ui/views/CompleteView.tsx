import React from 'react'
import { Box, Text } from 'ink'
import { useRunContext } from '../context/RunContext.js'
import { theme } from '../theme.js'

export function CompleteView() {
  const { tasks } = useRunContext()

  return (
    <Box flexDirection="column">
      {tasks.length === 0 ? (
        <Text color={theme.colors.muted}>No tasks to execute.</Text>
      ) : (
        <Text color={theme.colors.success}>Orchestration complete. All tasks executed.</Text>
      )}
    </Box>
  )
}
