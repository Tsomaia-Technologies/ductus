import React from 'react'
import { Box, Text } from 'ink'
import { useRunContext } from '../context/RunContext'
import { theme } from '../theme'

export function ErrorView() {
  const { error } = useRunContext()

  return (
    <Box flexDirection="column">
      <Text color={theme.colors.error}>{error ?? 'An error occurred.'}</Text>
    </Box>
  )
}
