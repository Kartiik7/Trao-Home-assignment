const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Typed fetch wrapper for the backend API.
 * - Prepends the API base URL
 * - Includes credentials (cookies) on every request
 * - On 401, redirects to /login (avoids stale UI)
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    credentials: "include", // send httpOnly cookies cross-origin
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Global 401 handler — redirect to login ONLY for protected endpoints.
  // For auth endpoints (/auth/login, /auth/register), a 401 means wrong credentials
  // and the calling page needs to show the error — do NOT redirect.
  if (res.status === 401) {
    const isAuthEndpoint = endpoint.startsWith("/auth/login") || endpoint.startsWith("/auth/register");
    if (!isAuthEndpoint && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    const errData = await res.json().catch(() => ({}));
    throw new ApiError(401, (errData as any)?.message || "Unauthorized", errData);
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.error || data.message || "Request failed", data);
  }

  return data as T;
}

/** Custom error class carrying status code and server response body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}
