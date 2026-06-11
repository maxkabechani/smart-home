export const queryKeys = {
  bulb: {
    state: () => ["bulb", "state"] as const,
  },
  readings: {
    all: ["readings"] as const,
    latest: () => [...queryKeys.readings.all, "latest"] as const,
    history: (range: string) =>
      [...queryKeys.readings.all, "history", range] as const,
  },
};
