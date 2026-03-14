import { BaseEventDefinition, Volatility } from './event.js'
import { SkillEntity } from './entities/skill-entity.js'

export interface ObservationEntry {
  event: BaseEventDefinition
  volatility?: Volatility
}

export interface SkillObservationEntry {
  skill: SkillEntity
  events?: BaseEventDefinition[]
  volatility?: Volatility
}

export interface ObservationConfig {
  events: ObservationEntry[]
  skillEvents: SkillObservationEntry[]
  observeAll?: boolean
  observeAllVolatility?: Volatility
}
