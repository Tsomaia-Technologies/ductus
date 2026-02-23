import React, { useState, useCallback } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { useRunContext } from '../context/RunContext.js'
import { theme } from '../theme.js'

export function TaskReviewView() {
  const { tasks, submitTaskApproval } = useRunContext()
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      submitTaskApproval(trimmed === '' ? null : trimmed)
      setValue('')
    },
    [submitTaskApproval],
  )

  return (
    <Box flexDirection="column">
      {tasks.map((task, i) => (
        <Text key={task.id}>
          {i + 1}. {task.summary}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text color={theme.colors.primary}>
          Accept these tasks? (press Enter to accept, or describe changes):{' '}
        </Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
    </Box>
  )
}
