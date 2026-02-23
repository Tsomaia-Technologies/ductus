import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { useRunContext } from '../context/RunContext'
import { theme } from '../theme'

export function ArchitectView() {
  const { streamContent, streamActive } = useRunContext()

  return (
    <Box flexDirection="column">
      {streamActive && !streamContent && (
        <Text>
          <Text color={theme.colors.primary}>
            <Spinner type="dots" />
          </Text>
          {' Architect working...'}
        </Text>
      )}
      {streamContent && (
        <Text dimColor>Streaming output above (see stream panel)</Text>
      )}
    </Box>
  )
}
