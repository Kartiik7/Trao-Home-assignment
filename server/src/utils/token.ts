/**
 * Rough heuristic to estimate the number of tokens in a text string.
 * This assumes an average of 4 characters per token.
 * 
 * @param text The string to estimate tokens for
 * @returns The estimated number of tokens
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
