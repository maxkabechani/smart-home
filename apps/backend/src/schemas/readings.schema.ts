import { Static, Type } from "@sinclair/typebox";

export const readingInputSchema = Type.Object(
  {
    temperature: Type.Number({ minimum: -40, maximum: 80 }),
    humidity: Type.Number({ minimum: 0, maximum: 100 }),
  },
  {
    additionalProperties: false,
  },
);

export type ReadingInput = Static<typeof readingInputSchema>;

const readingSchema = Type.Object({
  temperature: Type.Number(),
  humidity: Type.Number(),
  status: Type.Union([Type.Literal("online"), Type.Literal("offline")]),
  createdAt: Type.String({ format: "date-time" }),
});

export const readingResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.Optional(Type.String()),
  data: Type.Union([readingSchema, Type.Null()]),
});
