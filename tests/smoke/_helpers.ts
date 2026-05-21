// Smoke tests run against a live deployed URL, not local mocks. The
// host is controlled by the FRUGAVO_URL env var so the same suite works
// against production, a Netlify deploy preview, or localhost during
// dev. Defaults to the production URL.

export const BASE_URL =
  process.env.FRUGAVO_URL?.replace(/\/$/, "") ?? "https://frugavo.com";

// Lightweight fetch with a sensible timeout — smoke tests should fail
// fast, not hang.
export async function smokeFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}
