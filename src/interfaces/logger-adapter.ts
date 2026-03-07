import { Json } from './json.js'
import { Token } from './event-generator.js'

export const LoggerAdapter = Token<LoggerAdapter>()

export interface LoggerAdapter {
  info(message: Json): void

  warn(message: Json): void

  error(message: Json): void

  debug(message: Json): void
}
