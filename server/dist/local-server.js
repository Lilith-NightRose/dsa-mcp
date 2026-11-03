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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POLICY_RESOURCES, TTL_STATUS_MS } from "./resources.js";
import { Ledger } from "./ledger.js";
import { fileCommit, repoCommit } from "./version.js";
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
const cached = (contents, ttlMs) => ({ contents, ttlMs, cacheScope: "public" });
for (const r of POLICY_RESOURCES) {
    server.registerResource(r.name, r.uri, { title: r.name, description: r.description, mimeType: r.mimeType }, async (uri) => {
        const text = readFileSync(join(policyDir, r.file), "utf8");
        ledger.record({
            ts: new Date().toISOString(),
            method: "resources/read",
            uri: r.uri,
            commit: fileCommit(policyDir, r.file),
        });
        return cached([{ uri: uri.href, mimeType: r.mimeType, text }], r.ttlMs);
    });
}
server.registerResource("Policy Status", "policy://status", {
    title: "Policy Status",
    description: "Per-resource git commit stamps for the policy corpus.",
    mimeType: "application/json",
}, async (uri) => {
    const status = {
        commit: repoCommit(policyDir),
        checked_at: new Date().toISOString(),
        policies: Object.fromEntries(POLICY_RESOURCES.map((r) => [r.uri, fileCommit(policyDir, r.file)])),
    };
    ledger.record({
        ts: new Date().toISOString(),
        method: "resources/read",
        uri: "policy://status",
        commit: status.commit,
    });
    return cached([{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(status, null, 2) }], TTL_STATUS_MS);
});
await registerDoorTools(server, doorCtx);
await server.connect(new StdioServerTransport());
console.error(`[dsa-policy] (local) law + doors on stdio; recording ${recording ? "ON" : "off"}; test-logging ${testLogging ? "ON" : "off"}.`);
