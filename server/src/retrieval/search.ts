import axios from "axios";

export interface DiscussionResult {
  url: string;
  snippet: string;
  source: string;
}

/**
 * Searches for public discussion about a company's interview process.
 * 
 * In a real application, this would use a paid API like Serper, Tavily, or Bing.
 * For this assignment, if no API key is provided, we simulate the search 
 * or use a free tier/scraping approach. Here, we'll gracefully fallback
 * to a mock or an empty array if an actual search API fails or isn't configured,
 * adhering to the "skip and report" requirement.
 */
export async function searchPublicDiscussion(
  companyName: string
): Promise<{ discussion: DiscussionResult[]; error?: string }> {
  // If we had a Serper API key:
  const serperKey = process.env.SERPER_API_KEY;
  
  if (!serperKey) {
    // Graceful fallback for development / assignment testing without API keys
    console.warn(`⚠️ SERPER_API_KEY not set. Skipping real web search for "${companyName}".`);
    return {
      discussion: [],
      error: "SERPER_API_KEY_MISSING",
    };
  }

  const query = `"${companyName}" interview process OR interview questions site:glassdoor.com OR site:reddit.com`;

  try {
    const res = await axios.post(
      "https://google.serper.dev/search",
      { q: query, num: 3 },
      {
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    const organic = res.data?.organic || [];
    const discussion = organic.map((item: any) => ({
      url: item.link,
      snippet: item.snippet,
      source: new URL(item.link).hostname.replace("www.", ""),
    }));

    return { discussion };
  } catch (err: any) {
    // Skip and report - never throw
    return {
      discussion: [],
      error: err.code === "ECONNABORTED" ? "SEARCH_TIMEOUT" : "SEARCH_FAILED",
    };
  }
}
