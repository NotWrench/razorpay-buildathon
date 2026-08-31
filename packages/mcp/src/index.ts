export {
  CAPABILITIES,
  capabilitiesFor,
  findCapability,
  MCP_SCOPES,
  type McpCapability,
  type McpScope,
  type ToolSetName,
} from "./capabilities";
export { runCapability } from "./dispatch";
export {
  createMcpServer,
  handleMcpRequest,
  type McpRequestScope,
} from "./server";
