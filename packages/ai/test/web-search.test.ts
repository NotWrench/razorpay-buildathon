process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5443/razorpay_project";
process.env.AGENT_DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5445/razorpay_agent_memory";

import { describe, expect, test } from "bun:test";
import type { AgentContext } from "../src/context";

const { webSearchTools } = await import("../src/tools/web-search");

import type { WebSearchOutput } from "../src/tools/web-search";

const mockContext: AgentContext = {
  actor: {
    identifier: "test-buyer@example.com",
    type: "human",
    userId: "00000000-0000-0000-0000-000000000002",
  },
  autoApproveCeilingPaise: 0,
  conversationId: "00000000-0000-0000-0000-000000000003",
  merchantId: "00000000-0000-0000-0000-000000000001",
  spendCapPaise: 5_000_000,
  storeSlug: "nova-electronics",
};

describe("webSearchTools", () => {
  test("defines searchWeb with expected schema and description", () => {
    const tools = webSearchTools(mockContext);
    expect(tools.searchWeb).toBeDefined();
    expect(tools.searchWeb.description).toContain("Firecrawl");
    expect(tools.searchWeb.description).toContain("guardrails");
  });

  test("blocks off-topic queries before making any network call", async () => {
    const tools = webSearchTools(mockContext);
    const result = (await tools.searchWeb.execute?.(
      { query: "best chocolate cake recipe" },
      {} as never
    )) as WebSearchOutput;

    expect(result.blocked).toBe(true);
    expect(result.count).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.error).toContain("blocked by guardrail");
  });

  test("blocks queries that lack PC hardware or gaming context", async () => {
    const tools = webSearchTools(mockContext);
    const result = (await tools.searchWeb.execute?.(
      { query: "how to train a golden retriever puppy" },
      {} as never
    )) as WebSearchOutput;

    expect(result.blocked).toBe(true);
    expect(result.count).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.error).toContain("does not appear to be related");
  });

  test("processes valid PC query through Firecrawl parser when mocked", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FIRECRAWL_API_KEY;

    try {
      process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";

      // Mock Firecrawl response
      globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
        expect(url.toString()).toContain("api.firecrawl.dev");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toBeDefined();

        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  description:
                    "NVIDIA GeForce RTX 5090 Blackwell architecture specs and benchmarks.",
                  title: "GeForce RTX 5090 Preview",
                  url: "https://example.com/rtx-5090",
                },
                {
                  description:
                    "Complete performance breakdown and power draw analysis.",
                  title: "RTX 5090 Benchmarks",
                  url: "https://example.com/benchmarks",
                },
              ],
              success: true,
            }),
            { headers: { "Content-Type": "application/json" }, status: 200 }
          )
        );
      }) as unknown as typeof fetch;

      const tools = webSearchTools(mockContext);
      const result = (await tools.searchWeb.execute?.(
        { query: "RTX 5090 GPU benchmarks and power specs" },
        {} as never
      )) as WebSearchOutput;

      expect(result.blocked).toBe(false);
      expect(result.count).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.title).toBe("GeForce RTX 5090 Preview");
      expect(result.results[0]?.url).toBe("https://example.com/rtx-5090");
      expect(result.results[0]?.snippet).toContain("Blackwell");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.FIRECRAWL_API_KEY = originalApiKey;
    }
  });

  test("handles Firecrawl server failure gracefully without crashing the turn", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.FIRECRAWL_API_KEY;

    try {
      process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";

      globalThis.fetch = (() =>
        Promise.resolve(
          new Response("Internal Server Error", {
            status: 500,
          })
        )) as unknown as typeof fetch;

      const tools = webSearchTools(mockContext);
      const result = (await tools.searchWeb.execute?.(
        { query: "RTX 4080 Super vs RX 7900 XTX benchmarks" },
        {} as never
      )) as WebSearchOutput;

      expect(result.blocked).toBe(false);
      expect(result.count).toBe(0);
      expect(result.results).toEqual([]);
      expect(result.error).toContain("Firecrawl search failed with status 500");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.FIRECRAWL_API_KEY = originalApiKey;
    }
  });
});
