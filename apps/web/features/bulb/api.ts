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
