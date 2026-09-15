import { fetchPage } from "./fetcher";
import { cleanPage } from "./cleaner";

export interface CrawledPage {
  url: string;
  text: string;
  category: "homepage" | "about" | "hiring" | "other";
}

export interface CrawlFailure {
  url: string;
  reason: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  failures: CrawlFailure[];
}

const DELAY_MS = 1000;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scores a URL and its context to determine relevance to hiring/company info.
 */
export function rankLinks(links: string[]): string[] {
  const scored = links.map((link) => {
    const lowerLink = link.toLowerCase();
    let score = 0;

    // High priority: careers, jobs
    if (/(career|job|hiring|join|lever\.co|greenhouse\.io)/.test(lowerLink)) score += 5;
    
    // Medium priority: about, team, company
    if (/(about|team|company|culture|engineering)/.test(lowerLink)) score += 3;
    
    // Negative priority: legal, auth
    if (/(login|signup|signin|terms|privacy|policy|legal)/.test(lowerLink)) score -= 5;
    
    // Penalize very long or deep paths (often blog posts or specific items rather than overviews)
    const depth = (link.match(/\//g) || []).length;
    if (depth > 4) score -= 2;

    return { link, score };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.link.length - b.link.length;
    })
    .map((s) => s.link);
}

/**
 * Categorize a URL.
 */
function categorizeUrl(url: string, baseUrl: string): CrawledPage["category"] {
  const lower = url.toLowerCase();
  if (url === baseUrl || url === baseUrl + "/") return "homepage";
  if (/(career|job|hiring|join)/.test(lower)) return "hiring";
  if (/(about|team|company|culture)/.test(lower)) return "about";
  return "other";
}

/**
 * Fetches a single page with bounded retries and exponential backoff.
 */
async function fetchWithRetry(url: string, allowLocal: boolean, attempt = 1): Promise<any> {
  const res = await fetchPage(url, { allowLocal });
  if (res.ok) return res;

  // Don't retry these errors
  if (res.reason === "NOT_FOUND" || res.reason === "INVALID_URL" || res.reason === "ROBOTS_DISALLOWED") {
    return res;
  }

  if (attempt <= MAX_RETRIES) {
    const backoff = DELAY_MS * Math.pow(2, attempt - 1);
    await sleep(backoff);
    return fetchWithRetry(url, allowLocal, attempt + 1);
  }

  return res;
}

/**
 * Crawls a company site starting from the homepage.
 * 1. Fetches homepage.
 * 2. Extracts and ranks internal links.
 * 3. Fetches top N links sequentially to avoid rate limits.
 */
export async function crawlCompanySite(
  baseUrl: string,
  options: { allowLocal?: boolean; maxPages?: number } = {}
): Promise<CrawlResult> {
  const allowLocal = options.allowLocal ?? false;
  const maxPages = options.maxPages ?? 5; // Homepage + top 4 links

  const pages: CrawledPage[] = [];
  const failures: CrawlFailure[] = [];
  const visited = new Set<string>();

  // 1. Fetch homepage
  const homeRes = await fetchWithRetry(baseUrl, allowLocal);
  visited.add(baseUrl);

  if (!homeRes.ok) {
    failures.push({ url: baseUrl, reason: homeRes.reason });
    return { pages, failures }; // If homepage fails, we can't discover links
  }

  const cleanHome = cleanPage(homeRes.html, baseUrl);
  pages.push({
    url: baseUrl,
    text: cleanHome.text,
    category: "homepage",
  });

  // 2. Rank links
  const rankedLinks = rankLinks(cleanHome.links)
    .filter(link => !visited.has(link)) // Exclude already visited
    .slice(0, maxPages - 1); // Get top N

  // 3. Fetch top links sequentially
  for (const link of rankedLinks) {
    visited.add(link);
    await sleep(DELAY_MS); // Rate limiting

    const res = await fetchWithRetry(link, allowLocal);
    
    if (res.ok) {
      const clean = cleanPage(res.html, link);
      pages.push({
        url: link,
        text: clean.text,
        category: categorizeUrl(link, baseUrl),
      });
    } else {
      failures.push({ url: link, reason: res.reason });
    }
  }

  return { pages, failures };
}
