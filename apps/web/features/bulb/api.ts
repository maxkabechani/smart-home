export type BulbState = {
  enabled: boolean;
  updatedAt: string;
};

export type BulbResponse = {
  success: true;
  data: BulbState;
};

export function buildBulbUrl(path = "/bulb") {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

export function buildBulbWsUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

  if (!apiBaseUrl && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/bulb/ws`;
  }

  const url = new URL(apiBaseUrl ? `${apiBaseUrl}/bulb/ws` : "/bulb/ws");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
}
