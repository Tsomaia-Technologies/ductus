import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { useRunContext } from '../context/RunContext.js'
import { theme } from '../theme.js'

export function ReviewerView() {
  const { streamContent, streamActive } = useRunContext()

  return (
    <Box flexDirection="column">
      {streamActive && !streamContent && (
        <Text>
          <Text color={theme.colors.primary}>
            <Spinner type="dots" />
          </Text>
          {' Reviewer analyzing...'}
        </Text>
      )}
      {streamContent && (
        <Text dimColor>Review in progress</Text>
      )}
    </Box>
  )
}
