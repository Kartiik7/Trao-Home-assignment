import axios from "axios";
import { URL } from "url";
import robotsParser, { Robot } from "robots-parser";
import { validateUrl } from "./validator";

export type FetchResult =
  | { ok: true; html: string; url: string }
  | {
      ok: false;
      reason:
        | "TIMEOUT"
        | "NOT_FOUND"
        | "INVALID_URL"
        | "TOO_LARGE"
        | "UNSUPPORTED_TYPE"
        | "FETCH_ERROR"
        | "ROBOTS_DISALLOWED";
      url: string;
    };

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 10000; // 10 seconds

// Simple in-memory cache for parsed robots.txt files (keyed by origin)
const robotsCache: Record<string, Robot> = {};

/**
 * Fetches and caches the robots.txt for a given origin.
 */
async function getRobotsTxt(origin: string): Promise<Robot | null> {
  if (robotsCache[origin]) {
    return robotsCache[origin];
  }

  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await axios.get(robotsUrl, { timeout: 5000, validateStatus: () => true });
    const robots = robotsParser(robotsUrl, typeof res.data === 'string' ? res.data : "");
    robotsCache[origin] = robots;
    return robots;
  } catch (err) {
    // If we can't fetch robots.txt, assume everything is allowed
    const emptyRobots = robotsParser(robotsUrl, "");
    robotsCache[origin] = emptyRobots;
    return emptyRobots;
  }
}

/**
 * Fetches a webpage securely, enforcing size limits, timeouts, and robots.txt.
 * Never throws — returns a safe FetchResult union.
 */
export async function fetchPage(
  urlString: string,
  options: { allowLocal?: boolean; ignoreRobots?: boolean } = {}
): Promise<FetchResult> {
  try {
    // 1. URL Validation (SSRF protection)
    const isValid = await validateUrl(urlString, options.allowLocal);
    if (!isValid) {
      return { ok: false, reason: "INVALID_URL", url: urlString };
    }

    const url = new URL(urlString);
    const origin = url.origin;

    // 2. Robots.txt check
    if (!options.ignoreRobots && !options.allowLocal) { // Usually skip robots for local testing
      const robots = await getRobotsTxt(origin);
      if (robots && robots.isAllowed(urlString, "AI-Interview-Prep-Bot") === false) {
        return { ok: false, reason: "ROBOTS_DISALLOWED", url: urlString };
      }
    }

    // 3. Fetch with limits
    const response = await axios.get(urlString, {
      timeout: TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_SIZE,
      maxBodyLength: MAX_RESPONSE_SIZE,
      headers: {
        "User-Agent": "AI-Interview-Prep-Bot/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      responseType: "text",
      validateStatus: (status) => status < 400, // Reject 4xx and 5xx
    });

    // 4. Validate Content-Type
    const contentType = response.headers["content-type"] || "";
    if (!contentType.includes("text/html")) {
      return { ok: false, reason: "UNSUPPORTED_TYPE", url: urlString };
    }

    return { ok: true, html: response.data, url: urlString };
  } catch (err: any) {
    let reason: FetchResult["reason"] = "FETCH_ERROR";

    if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
      reason = "TIMEOUT";
    } else if (err.response?.status === 404) {
      reason = "NOT_FOUND";
    } else if (err.message?.includes("maxContentLength")) {
      reason = "TOO_LARGE";
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      reason = "FETCH_ERROR";
    }

    return { ok: false, reason, url: urlString };
  }
}
