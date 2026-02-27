/**
 * Validation Barrier: DuctusEventSchema must reject invalid payloads at runtime.
 * Task 001-core-event-contracts Definition of Done.
 */

import { DuctusEventSchema } from "../../src/core/event-contracts.js";

describe("DuctusEventSchema", () => {
  const validSha256 = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  const validEvent = {
    id: validUuid,
    type: "TEST_EVENT",
    payload: {},
    authorId: "processor-1",
    timestamp: 0,
    sequence: 0,
    prevHash: validSha256,
    hash: validSha256,
    volatility: "durable" as const,
  };

  it("accepts a valid event", () => {
    const result = DuctusEventSchema.parse(validEvent);
    expect(result).toEqual(validEvent);
  });

  it("throws when authorId is omitted (fail-fast)", () => {
    const invalid: any = { ...validEvent };
    delete invalid.authorId;

    expect(() => DuctusEventSchema.parse(invalid)).toThrow();
  });

  it("throws when authorId is empty string", () => {
    const invalid = { ...validEvent, authorId: "" };

    expect(() => DuctusEventSchema.parse(invalid)).toThrow();
  });

  it("throws when volatility is invalid (not durable|volatile)", () => {
    const invalid = { ...validEvent, volatility: "invalid" };

    expect(() => DuctusEventSchema.parse(invalid)).toThrow();
  });

  it("throws when volatility is durable-draft (committed schema expects committed form)", () => {
    const invalid = { ...validEvent, volatility: "durable-draft" };

    expect(() => DuctusEventSchema.parse(invalid)).toThrow();
  });

  it("throws when id is not a valid UUID", () => {
    const invalid = { ...validEvent, id: "not-a-uuid" };

    expect(() => DuctusEventSchema.parse(invalid)).toThrow();
  });

  it("throws when hash is not a valid SHA-256 hex", () => {
    const invalid = { ...validEvent, hash: "short" };

    expect(() => DuctusEventSchema.parse(invalid)).toThrow();
  });
});
