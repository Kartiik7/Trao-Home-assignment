import { promises as dns } from "dns";
import { URL } from "url";

/**
 * Validates a URL to prevent SSRF (Server-Side Request Forgery).
 * Rejects private, loopback, and internal IP addresses unless `allowLocal` is true.
 *
 * @param urlString The URL to validate
 * @param allowLocal If true, bypasses the private IP check (useful for local dev/tests)
 * @returns true if valid, false if invalid or malicious
 */
export async function validateUrl(
  urlString: string,
  allowLocal = false
): Promise<boolean> {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (allowLocal) {
      return true;
    }

    // Resolve the hostname to an IP address
    const addresses = await dns.lookup(url.hostname);
    const ip = addresses.address;

    return !isPrivateIp(ip);
  } catch (err) {
    return false; // Invalid URL format or DNS lookup failure
  }
}

/**
 * Checks if an IP address falls into private, loopback, or link-local ranges.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 loopback (127.0.0.0/8)
  if (/^127\./.test(ip)) return true;
  // IPv4 private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // IPv4 link-local (169.254.0.0/16)
  if (/^169\.254\./.test(ip)) return true;
  // IPv6 loopback and unique local addresses
  if (ip === "::1") return true;
  if (/^fc00:/i.test(ip) || /^fd[0-9a-f]{2}:/i.test(ip)) return true;
  if (/^fe80:/i.test(ip)) return true;

  return false;
}
