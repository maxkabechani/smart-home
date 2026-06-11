import { Static, Type } from "@sinclair/typebox";

const bulbStateSchema = Type.Object({
  enabled: Type.Boolean(),
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

export const bulbResponseSchema = Type.Object({
  success: Type.Literal(true),
  data: bulbStateSchema,
});
