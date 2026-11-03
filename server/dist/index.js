/**
 * DSA MCP server — both pathways.
 *
 * Pathway 1 (law): the policy corpus as resources with spec-compliant
 * caching, two status endpoints, change notifications, consultation ledger.
 * (Spec: Spec/policy_only_spec.md — unchanged from v0.1/0.2.)
 *
 * Pathway 2 (doors): registered in tools.ts — NOT YET WRITTEN. This index
 * stubs the seam: it imports tools.ts when present and calls
 * registerDoorTools(server, ctx). Until then the server serves law only.
 * (Spec: Spec/organize_server_spec.md, branch doorway_approach_2.)
 *
 * Transports: stdio here; workerd entry (local-server.ts pattern from
 * metacog) bridges later — same registerDoorTools call, different host.
 */
import { watch, existsSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLawResources } from "./resources.js";
import { POLICY_RESOURCES } from "./resources.js";
import { Ledger } from "./ledger.js";
// ─── Flags & context ───────────────────────────────────────────────────
const policyDir = process.env.DSA_POLICY_DIR ?? "../Policy";
const recording = process.argv.includes("--record-requests"); // default OFF
// Test-mode artifact logging (organize_server_spec.md §3.3): default OFF.
const testLogging = process.argv.includes("--log-eligibility");
const ledger = new Ledger(process.env.DSA_LEDGER_DIR ?? ".ledger", recording);
const doorCtx = {
    testLogging,
    record: (line) => ledger.record(line),
};
const server = new McpServer({ name: "dsa-policy", version: "0.3.0" }, { capabilities: { resources: { listChanged: true }, tools: {} } });
// ─── Pathway 1: law as resources (shared registration) ─────────────────
registerLawResources(server, policyDir, ledger);
// ─── Pathway 2: the doors (STUB — tools.ts not yet written) ────────────
// When tools.ts lands, this seam becomes:
//   import { registerDoorTools } from "./tools.js";
//   await registerDoorTools(server, doorCtx);
// No other change: pathway 1 is untouched by the doors, per §7 of the
// policy spec (the seam, not the doors).
// Dynamic require keeps tsc happy while tools.ts is unwritten: the seam
// resolves at runtime, not compile time.
const toolsPath = join(import.meta.dirname ?? ".", "tools.js");
if (existsSync(toolsPath)) {
    const spec = "./tools.js"; // runtime-only specifier: tools.ts is not written yet
    const { registerDoorTools } = (await import(spec));
    await registerDoorTools(server, doorCtx);
    console.error("[dsa-policy] door tools registered.");
}
else {
    console.error("[dsa-policy] tools.ts not yet written — serving law only (door seam stubbed).");
}
// Change notifications (Spec §4): push is garnish; the boot ritual is
// structure. Defensive send — SDK surface varies by version.
try {
    watch(policyDir, { persistent: false }, (_event, filename) => {
        if (!filename)
            return;
        const r = POLICY_RESOURCES.find((x) => x.file === filename);
        if (!r)
            return;
        const low = server.server;
        if (low?.sendResourceUpdated) {
            low.sendResourceUpdated({ uri: r.uri }).catch(() => { });
        }
    });
}
catch (err) {
    console.error("[dsa-policy] fs.watch unavailable:", err);
}
await server.connect(new StdioServerTransport());
console.error(`[dsa-policy] serving law on stdio; recording ${recording ? "ON" : "off"}; test-logging ${testLogging ? "ON" : "off"}.`);
