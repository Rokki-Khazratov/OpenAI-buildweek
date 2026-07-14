/** Server-only upstream URL. Browser requests go through same-origin route handlers. */
export const apiBaseUrl = process.env.API_URL ?? "http://127.0.0.1:8010/api/v1";
