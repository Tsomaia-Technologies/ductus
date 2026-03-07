import { LoggerAdapter } from '../interfaces/logger-adapter.js'
import { Json } from '../interfaces/json.js'

export class ConsoleLogger implements LoggerAdapter {
  info(message: Json) {
    console.log(this.getMessage(message))
  }

  warn(message: Json) {
    console.warn(this.getMessage(message))
  }

  error(message: Json) {
    console.error(this.getMessage(message))
  }

  debug(message: Json) {
    console.debug(this.getMessage(message))
  }

  private getMessage(message: Json) {
    return typeof message === 'string'
      ? message
      : JSON.stringify(message, void 0, 2)
  }
}
