import { apiBaseUrl } from "@/lib/api/config";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
};

export async function apiRequest(path: string, init?: RequestInit) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...init?.headers },
  });
}

export async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail[0]?.msg ?? fallback;
  } catch {}
  return fallback;
}
