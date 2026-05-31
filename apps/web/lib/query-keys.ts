export const queryKeys = {
  readings: {
    all: ["readings"] as const,
    latest: () => [...queryKeys.readings.all, "latest"] as const,
  },
};
