export const queryKeys = {
  smartHome: {
    status: (deviceId: string) => ["smart-home", "status", deviceId] as const,
  },
};
