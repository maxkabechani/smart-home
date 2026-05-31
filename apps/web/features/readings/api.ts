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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function buildReadingsUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}
