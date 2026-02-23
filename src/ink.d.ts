declare module 'ink' {
  import * as React from 'react'
  export const Box: React.FC<any>
  export const Text: React.FC<any>
  export function render(element: React.ReactElement): Promise<{ waitUntilExit: () => Promise<void>; unmount: () => void }>
  export function useStdout(): { stdout: NodeJS.WriteStream }
}

declare module 'ink-spinner' {
  import * as React from 'react'
  const Spinner: React.FC<{ type?: string }>
  export default Spinner
}

declare module 'ink-text-input' {
  import * as React from 'react'
  export type TextInputProps = {
    value: string
    onChange: (value: string) => void
    onSubmit?: (value: string) => void
    placeholder?: string
    focus?: boolean
  }
  const TextInput: React.FC<TextInputProps>
  export default TextInput
}

declare module 'ink-use-stdout-dimensions' {
  function useStdoutDimensions(): [number, number]
  export default useStdoutDimensions
}
