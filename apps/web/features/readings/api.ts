export type Reading = {
  temperature: number;
  humidity: number;
  status: "online" | "offline";
  createdAt: string;
};

export type ReadingResponse =
  | { success: true; data: Reading }
  | { success: false; message: string; data: null };

export type ReadingInput = {
  temperature: number;
  humidity: number;
};

export function buildReadingsUrl(path: string) {
  return path;
}
