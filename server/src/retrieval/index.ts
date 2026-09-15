import { crawlCompanySite, CrawledPage, CrawlFailure } from "./crawler";
import { searchPublicDiscussion, DiscussionResult } from "./search";

export interface ResearchResult {
  pages: CrawledPage[];
  discussion: DiscussionResult[];
  failures: CrawlFailure[];
}

/**
 * Orchestrates the retrieval phase for a company.
 * 1. Crawls the company's website for hiring/about info.
 * 2. Searches public forums (e.g. Reddit, Glassdoor) for interview discussions.
 * 
 * Runs both concurrently and aggregates the results, never throwing
 * an error that would abort a larger batch process.
 */
export async function researchCompany(
  companyUrl: string,
  companyName: string,
  options: { allowLocal?: boolean; maxPages?: number } = {}
): Promise<ResearchResult> {
  // Run crawl and search concurrently
  const [crawlResult, searchResult] = await Promise.all([
    crawlCompanySite(companyUrl, options),
    searchPublicDiscussion(companyName),
  ]);

  const failures = [...crawlResult.failures];
  if (searchResult.error) {
    failures.push({ url: `search:${companyName}`, reason: searchResult.error });
  }

  return {
    pages: crawlResult.pages,
    discussion: searchResult.discussion,
    failures,
  };
}
