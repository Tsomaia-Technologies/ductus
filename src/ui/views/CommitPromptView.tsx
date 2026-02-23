import React, { useState, useCallback } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { theme } from '../theme'

export type CommitPromptResult = { ignoreHooks: boolean; remember: boolean } | null

interface CommitPromptViewProps {
  onSubmit: (result: CommitPromptResult) => void
}

export function CommitPromptView({ onSubmit }: CommitPromptViewProps) {
  const [step, setStep] = useState<'q1' | 'q2'>('q1')
  const [value, setValue] = useState('')

  const handleQ1 = useCallback(
    (val: string) => {
      const yes = /^y(es)?$/i.test(val.trim())
      if (!yes) {
        onSubmit({ ignoreHooks: false, remember: false })
        return
      }
      setStep('q2')
      setValue('')
    },
    [onSubmit],
  )

  const handleQ2 = useCallback(
    (val: string) => {
      const remember = /^y(es)?$/i.test(val.trim())
      onSubmit({ ignoreHooks: true, remember })
    },
    [onSubmit],
  )

  if (step === 'q1') {
    return (
      <Box flexDirection="column">
        <Text color={theme.colors.warning}>
          Commit failed (likely due to hooks). Ignore hooks and commit anyway? (y/n):{' '}
        </Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleQ1} />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color={theme.colors.warning}>
        Remember this decision for future runs? (y/n):{' '}
      </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleQ2} />
    </Box>
  )
}
