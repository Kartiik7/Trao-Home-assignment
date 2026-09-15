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
  // If we had a Tavily API key:
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyKey) {
    // Graceful fallback for development / assignment testing without API keys
    console.warn(`⚠️ TAVILY_API_KEY not set. Skipping real web search for "${companyName}".`);
    return {
      discussion: [],
      error: "TAVILY_API_KEY_MISSING",
    };
  }

  const query = `"${companyName}" interview process OR interview questions site:glassdoor.com OR site:reddit.com`;

  try {
    const res = await axios.post(
      "https://api.tavily.com/search",
      {
        query,
        include_answer: false,
        include_raw_content: false,
        max_results: 3,
        include_domains: ["glassdoor.com", "reddit.com"],
      },
      {
        headers: {
          "Authorization": `Bearer ${tavilyKey}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    const results = res.data?.results || [];
    const discussion = results.map((item: any) => ({
      url: item.url,
      snippet: item.content,
      source: new URL(item.url).hostname.replace("www.", ""),
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
