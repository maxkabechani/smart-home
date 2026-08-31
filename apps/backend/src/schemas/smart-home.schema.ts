import { Static, Type } from "@sinclair/typebox";

export const controlModeSchema = Type.Union([
  Type.Literal("AUTO"),
  Type.Literal("ON"),
  Type.Literal("OFF"),
]);

export const telemetryInputSchema = Type.Object({
  temperature: Type.Number(),
  humidity: Type.Number({ minimum: 0, maximum: 100 }),
  fanOn: Type.Boolean(),
  fanMode: controlModeSchema,
  tankPercent: Type.Integer({ minimum: 0, maximum: 100 }),
  tankDistanceCm: Type.Number({ minimum: 0 }),
  pumpOn: Type.Boolean(),
  pumpMode: controlModeSchema,
  gateOpen: Type.Boolean(),
  securityArmed: Type.Boolean(),
  motion: Type.Boolean(),
  outsideLightOn: Type.Boolean(),
  outsideLightMode: controlModeSchema,
  insideLightOn: Type.Boolean(),
  insideLightMode: controlModeSchema,
  wifiRssi: Type.Integer(),
}, { additionalProperties: false });

export const commandInputSchema = Type.Object({
  deviceId: Type.String({ minLength: 1, maxLength: 80 }),
  command: Type.String({
    pattern: "^(OPEN_GATE|CLOSE_GATE|TRIGGER_ALARM|STOP_ALARM|SET_SECURITY:(armed|off)|SET_(FAN|PUMP|OUTSIDE_LIGHT|INSIDE_LIGHT)_MODE:(auto|on|off))$",
  }),
}, { additionalProperties: false });

export type TelemetryInput = Static<typeof telemetryInputSchema>;
export type CommandInput = Static<typeof commandInputSchema>;

export function isSmartHomeCommand(value: unknown): value is string {
  return typeof value === "string" && /^(OPEN_GATE|CLOSE_GATE|TRIGGER_ALARM|STOP_ALARM|SET_SECURITY:(armed|off)|SET_(FAN|PUMP|OUTSIDE_LIGHT|INSIDE_LIGHT)_MODE:(auto|on|off))$/.test(value);
}
