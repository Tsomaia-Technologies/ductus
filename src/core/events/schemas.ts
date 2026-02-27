import { z } from "zod";
import type { CommittedEvent, Volatility } from "../../interfaces/event.js";

// SHA-256 hex: 64 lowercase hex chars.
const Sha256HexSchema = z.string().length(64).regex(/^[a-f0-9]+$/);

export const VolatilitySchema = z.enum(["durable", "volatile"]);

/**
 * Validates canonical ledger event shape loaded from JSONL.
 */
export const DuctusEventSchema = z.object({
    eventId: z.string().uuid(),
    type: z.string(),
    payload: z.unknown(),
    authorId: z.string().min(1),
    timestamp: z.number(),
    sequenceNumber: z.number().int().nonnegative(),
    prevHash: Sha256HexSchema,
    hash: Sha256HexSchema,
    volatility: VolatilitySchema,
}) satisfies z.ZodType<CommittedEvent>;
