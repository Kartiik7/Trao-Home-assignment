import * as cheerio from "cheerio";
import { URL } from "url";

export interface CleanedPage {
  text: string;
  links: string[];
}

/**
 * Strips HTML down to readable text and extracts internal links.
 * 
 * @param html The raw HTML string
 * @param baseUrl The base URL to resolve relative links against
 */
export function cleanPage(html: string, baseUrl: string): CleanedPage {
  const $ = cheerio.load(html);

  // 1. Remove boilerplate and non-content tags
  $("script, style, noscript, svg, nav, footer, header, aside, iframe, path").remove();

  // 2. Extract internal links
  const links = new Set<string>();
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl);
      
      // Keep only HTTP/HTTPS
      if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") {
        return;
      }

      // Filter to internal links only (same hostname)
      const baseHostname = new URL(baseUrl).hostname;
      if (absoluteUrl.hostname === baseHostname) {
        // Strip fragments (hashes)
        absoluteUrl.hash = "";
        links.add(absoluteUrl.toString());
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  });

  // 3. Extract text
  // Replace <br> and block elements with spaces/newlines to maintain readability
  $("p, div, section, article, h1, h2, h3, h4, h5, h6, li").append("\n");
  let text = $.text();

  // Clean up whitespace: replace multiple spaces/newlines with a single space/newline
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n");
  text = text.trim();

  return {
    text,
    links: Array.from(links),
  };
}
