export type Reading = {
  temperature: number;
  humidity: number;
  status: "online" | "offline";
  createdAt: string;
};

export type ReadingResponse =
  | { success: true; data: Reading }
  | { success: false; message: string; data: null };

export type ReadingsHistoryResponse = { success: true; data: Reading[] };

export type ReadingsHistoryRange = "day" | "week" | "month";

export type ReadingInput = {
  temperature: number;
  humidity: number;
};

export function buildReadingsUrl(path: string) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}
