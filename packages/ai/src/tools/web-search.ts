import { tool } from "ai";
import { z } from "zod";
import {
  AuditAction,
  auditActorType,
  recordAudit,
  recordFailure,
} from "../audit";
import type { AgentContext } from "../context";
import {
  checkPcSearchQuery,
  PC_SEARCH_LIMITS,
  recordSearchGuardrailBreach,
} from "../guardrails";

export interface WebSearchResult {
  snippet: string;
  title: string;
  url: string;
}

export interface WebSearchOutput {
  blocked?: boolean;
  count?: number;
  error?: string;
  query: string;
  results: WebSearchResult[];
}

/**
 * Searches the web via Firecrawl API.
 */
async function searchWithFirecrawl(
  query: string,
  limit = PC_SEARCH_LIMITS.defaultLimit
): Promise<WebSearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.replace(/^"|"$/g, "").trim();

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured.");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    body: JSON.stringify({
      limit: Math.min(limit, PC_SEARCH_LIMITS.maxLimit),
      query,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Unknown network error");
    throw new Error(
      `Firecrawl search failed with status ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as {
    data?: Array<{
      description?: string;
      markdown?: string;
      title?: string;
      url?: string;
    }>;
    success?: boolean;
  };

  const items = data.data ?? [];

  return items.map((item) => ({
    snippet: (item.description ?? item.markdown ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300),
    title: item.title?.trim() || "Untitled result",
    url: item.url?.trim() || "",
  }));
}

/**
 * Web search tool scoped to PC hardware, components, and PC gaming.
 */
export function webSearchTools(ctx: AgentContext) {
  const actorType = auditActorType(ctx.actor.type);

  return {
    searchWeb: tool({
      description:
        "Search the web via Firecrawl to identify the latest PC hardware trends, " +
        "new component releases, benchmarks, and PC game system requirements. " +
        "Strictly restricted by guardrails to PC hardware, components, and gaming topics. " +
        "Use this for broader tech market context; use searchProducts for store inventory and prices.",
      execute: async ({ query }): Promise<WebSearchOutput> => {
        const validation = checkPcSearchQuery(query);

        if (!validation.allowed) {
          const reason =
            validation.reason ??
            "Search query blocked: queries must be strictly related to PC hardware, components, PC gaming, or computing trends.";

          await recordSearchGuardrailBreach(ctx, query, reason);

          return {
            blocked: true,
            count: 0,
            error: reason,
            query,
            results: [],
          };
        }

        try {
          const results = await searchWithFirecrawl(query);

          await recordAudit({
            action: AuditAction.WEB_SEARCH,
            actorId: ctx.actor.userId ?? ctx.actor.identifier,
            actorType,
            explanation: `Searched web for PC trends: "${query}" (${results.length} results)`,
            merchantId: ctx.merchantId,
            metadata: {
              query,
              resultCount: results.length,
            },
          });

          return {
            blocked: false,
            count: results.length,
            query,
            results,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unknown web search failure";

          await recordFailure({
            errorMessage: `Web search failed for query "${query}": ${errorMessage}`,
            errorType: "WEB_SEARCH_FAILED",
          });

          return {
            blocked: false,
            count: 0,
            error: errorMessage,
            query,
            results: [],
          };
        }
      },
      inputSchema: z.object({
        query: z
          .string()
          .min(PC_SEARCH_LIMITS.minQueryLength)
          .max(PC_SEARCH_LIMITS.maxQueryLength)
          .describe(
            "Search query strictly related to PC hardware, components, PC gaming, benchmarks, or computing trends."
          ),
      }),
    }),
  };
}
