export type JsonPrimitive = string | number | boolean | null

export type JsonArray = Json[]

export interface JsonObject extends Record<string, Json> {
}

export type Json =
  | JsonPrimitive
  | JsonArray
  | JsonObject
