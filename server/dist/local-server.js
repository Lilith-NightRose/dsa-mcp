/**
 * Local stdio entry point for the DSA MCP server (pathways 1 + 2).
 *
 * Same registrations as the workerd entry (index.ts), served over stdio
 * with no worker-host-specific machinery — for LAN-local clients
 * (Hermes native MCP, Connectome MCPL) that spawn the server as a
 * subprocess. Pattern borrowed from metacog's local-server.ts.
 *
 * Run: node dist/local-server.js   (or via node --experimental-strip-types
 * src/local-server.ts on Node >= 22.6)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLawResources } from "./resources.js";
import { Ledger } from "./ledger.js";
import { registerDoorTools } from "./tools.js";
const policyDir = process.env.DSA_POLICY_DIR ?? "../Policy";
const recording = process.argv.includes("--record-requests");
const testLogging = process.argv.includes("--log-eligibility");
const ledger = new Ledger(process.env.DSA_LEDGER_DIR ?? ".ledger", recording);
const doorCtx = {
    testLogging,
    record: (line) => ledger.record(line),
};
const server = new McpServer({ name: "dsa-policy", version: "0.3.0" }, { capabilities: { resources: { listChanged: true }, tools: {} } });
registerLawResources(server, policyDir, ledger);
await registerDoorTools(server, doorCtx);
await server.connect(new StdioServerTransport());
console.error(`[dsa-policy] (local) law + doors on stdio; recording ${recording ? "ON" : "off"}; test-logging ${testLogging ? "ON" : "off"}.`);
