import { Static, Type } from "@sinclair/typebox";

const bulbStateSchema = Type.Object({
  enabled: Type.Boolean(),
  pendingRfid: Type.Boolean(),
  requestedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  authorizedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  lastRfidUid: Type.Union([Type.String(), Type.Null()]),
  lastRfidStatus: Type.Union([
    Type.Literal("authorized"),
    Type.Literal("denied"),
    Type.Literal("ignored"),
    Type.Null(),
  ]),
  lastRfidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  updatedAt: Type.String({ format: "date-time" }),
});

export const bulbInputSchema = Type.Object(
  {
    enabled: Type.Boolean(),
  },
  {
    additionalProperties: false,
  },
);

export type BulbInput = Static<typeof bulbInputSchema>;

export const rfidScanInputSchema = Type.Object(
  {
    uid: Type.String({ minLength: 1 }),
  },
  {
    additionalProperties: false,
  },
);

export type RfidScanInput = Static<typeof rfidScanInputSchema>;

export const bulbResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: bulbStateSchema,
});
