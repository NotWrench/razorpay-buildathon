import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AgentContext } from "@workspace/ai";
import { capabilitiesFor, type McpScope } from "./capabilities";
import { runCapability } from "./dispatch";

/**
 * The MCP endpoint.
 *
 * Stateless: a server is built per request from an already-resolved context
 * and scope, and thrown away. That is not only a serverless convenience — it
 * means a connection cannot outlive the authorization that opened it. There is
 * no session to hold a stale scope, and no way for a second request to inherit
 * the first one's identity.
 *
 * The scope is decided before this function is called and is not a parameter
 * the caller can influence; see `apps/web/app/api/mcp/[slug]/route.ts`.
 */

export interface McpRequestScope {
  ctx: AgentContext;
  scope: McpScope;
  storeName: string;
}

const SERVER_VERSION = "1.0.0";

/** Builds a server exposing exactly the capabilities this scope may reach. */
export function createMcpServer(request: McpRequestScope): McpServer {
  const server = new McpServer(
    {
      name: `${request.storeName} (${request.scope})`,
      version: SERVER_VERSION,
    },
    { capabilities: { tools: {} } }
  );

  for (const capability of capabilitiesFor(request.scope)) {
    server.registerTool(
      capability.name,
      {
        description: capability.description,
        inputSchema: capability.inputSchema,
      },
      async (input: unknown) => {
        try {
          const result = await runCapability(capability, request.ctx, input);

          return {
            content: [
              { text: JSON.stringify(result, null, 2), type: "text" as const },
            ],
          };
        } catch (error) {
          // A domain refusal — out of stock, not your build, no such product —
          // is a result the calling agent should read and act on, not a
          // transport failure. It comes back as content with isError set.
          return {
            content: [
              {
                text: (error as Error).message,
                type: "text" as const,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}

/**
 * Serves one MCP request.
 *
 * `enableJsonResponse` keeps this a plain request/response exchange: none of
 * these capabilities stream, and a serverless function holding an SSE stream
 * open buys nothing.
 */
export async function handleMcpRequest(
  request: McpRequestScope,
  httpRequest: Request
): Promise<Response> {
  const server = createMcpServer(request);

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    // No generator means no session: see the note above.
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(httpRequest);
  } finally {
    await transport.close();
  }
}
