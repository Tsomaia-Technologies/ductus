import { Json } from './json.js'

export interface LoggerAdapter {
  info(message: Json): void
  warn(message: Json): void
  error(message: Json): void
  debug(message: Json): void
}
