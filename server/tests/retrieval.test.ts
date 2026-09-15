import { describe, it, expect, vi } from "vitest";
import { validateUrl } from "../src/retrieval/validator";
import { rankLinks } from "../src/retrieval/crawler";
import { fetchPage } from "../src/retrieval/fetcher";
import axios from "axios";

// Mock axios to avoid actual network requests during fetchPage tests
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("Retrieval Layer Tests", () => {
  describe("validateUrl", () => {
    it("should reject private IPs (e.g. loopback)", async () => {
      const isValid = await validateUrl("http://127.0.0.1:8080");
      expect(isValid).toBe(false);
    });

    it("should reject localhosts mapped via DNS (e.g. localhost)", async () => {
      const isValid = await validateUrl("http://localhost:3000");
      expect(isValid).toBe(false);
    });

    it("should allow loopback if allowLocal is true", async () => {
      const isValid = await validateUrl("http://127.0.0.1:8080", true);
      expect(isValid).toBe(true);
    });

    it("should allow public IPs/domains", async () => {
      const isValid = await validateUrl("https://example.com");
      expect(isValid).toBe(true);
    });
  });

  describe("rankLinks", () => {
    it("should rank hiring-related links higher than about or login links", () => {
      const links = [
        "https://acme.com/login",
        "https://acme.com/careers/backend-engineer",
        "https://acme.com/about-us",
        "https://acme.com/terms",
        "https://acme.com/jobs",
      ];

      const ranked = rankLinks(links);

      // 'jobs' (score 5, depth 1) should be first
      // 'careers/backend-engineer' (score 5, depth 2) should be second
      // 'about-us' (score 3) should be third
      // 'login' (score -5) and 'terms' (score -5) should be last
      
      expect(ranked[0]).toBe("https://acme.com/jobs");
      expect(ranked[1]).toBe("https://acme.com/careers/backend-engineer");
      expect(ranked[2]).toBe("https://acme.com/about-us");
      expect(["https://acme.com/login", "https://acme.com/terms"]).toContain(ranked[3]);
      expect(["https://acme.com/login", "https://acme.com/terms"]).toContain(ranked[4]);
    });
  });

  describe("fetchPage (Skip-and-Report Behavior)", () => {
    it("should return a TIMEOUT reason instead of throwing on timeout", async () => {
      // Mock axios.get to reject with a timeout error
      mockedAxios.get.mockRejectedValueOnce({
        code: "ECONNABORTED",
        message: "timeout of 10000ms exceeded",
      });

      const res = await fetchPage("https://example.com/slow", { allowLocal: true, ignoreRobots: true });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("TIMEOUT");
        expect(res.url).toBe("https://example.com/slow");
      }
    });

    it("should return NOT_FOUND on 404 instead of throwing", async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 404 },
      });

      const res = await fetchPage("https://example.com/missing", { allowLocal: true, ignoreRobots: true });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("NOT_FOUND");
      }
    });

    it("should return UNSUPPORTED_TYPE if content-type is not html", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        headers: { "content-type": "application/pdf" },
        data: "mock-pdf-data",
      });

      const res = await fetchPage("https://example.com/doc.pdf", { allowLocal: true, ignoreRobots: true });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("UNSUPPORTED_TYPE");
      }
    });
  });
});
