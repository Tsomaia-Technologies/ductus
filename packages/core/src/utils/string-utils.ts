export function original(strings: string[], ...values: unknown[]) {
  let result = strings[0]

  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1]
  }

  return result
}

export function raw(strings: string[], ...values: unknown[]) {
  return {
    raw: original(strings, ...values),
  }
}
