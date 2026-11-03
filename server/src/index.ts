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
import { readFileSync, watch, existsSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { POLICY_RESOURCES, TTL_STATUS_MS } from "./resources.js";
import { Ledger } from "./ledger.js";
import { fileCommit, repoCommit } from "./version.js";

// ─── Flags & context ───────────────────────────────────────────────────
const policyDir = process.env.DSA_POLICY_DIR ?? "../Policy";
const recording = process.argv.includes("--record-requests"); // default OFF
// Test-mode artifact logging (organize_server_spec.md §3.3): default OFF.
const testLogging = process.argv.includes("--log-eligibility");

const ledger = new Ledger(process.env.DSA_LEDGER_DIR ?? ".ledger", recording);

const doorCtx: import("./doors.js").DoorContext = {
  testLogging,
  record: (line) => ledger.record(line),
};

const server = new McpServer(
  { name: "dsa-policy", version: "0.3.0" },
  { capabilities: { resources: { listChanged: true }, tools: {} } }
);

// ttlMs / cacheScope are 2026-07-28 caching fields; the SDK's result type
// predates them, so the extra fields are asserted through — they ride on
// the wire regardless.
const cached = (
  contents: ReadResourceResult["contents"],
  ttlMs: number
): ReadResourceResult =>
  ({ contents, ttlMs, cacheScope: "public" }) as unknown as ReadResourceResult;

// ─── Pathway 1: law as resources ───────────────────────────────────────
for (const r of POLICY_RESOURCES) {
  server.registerResource(
    r.name,
    r.uri,
    { title: r.name, description: r.description, mimeType: r.mimeType },
    async (uri) => {
      const text = readFileSync(join(policyDir, r.file), "utf8");
      ledger.record({
        ts: new Date().toISOString(),
        method: "resources/read",
        uri: r.uri,
        commit: fileCommit(policyDir, r.file),
      });
      return cached([{ uri: uri.href, mimeType: r.mimeType, text }], r.ttlMs);
    }
  );
}

// policy://status — the freshness endpoint: ttlMs 0, generated at read time.
server.registerResource(
  "Policy Status",
  "policy://status",
  {
    title: "Policy Status",
    description:
      "Per-resource git commit stamps for the policy corpus. Boot-ritual " +
      "endpoint: compare against stamps recorded at last read; re-read any " +
      "resource whose commit changed. ttlMs 0 — always a real read.",
    mimeType: "application/json",
  },
  async (uri) => {
    const status = {
      commit: repoCommit(policyDir),
      checked_at: new Date().toISOString(),
      policies: Object.fromEntries(
        POLICY_RESOURCES.map((r) => [r.uri, fileCommit(policyDir, r.file)])
      ),
    };
    ledger.record({
      ts: new Date().toISOString(),
      method: "resources/read",
      uri: "policy://status",
      commit: status.commit,
    });
    return cached(
      [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(status, null, 2),
        },
      ],
      TTL_STATUS_MS
    );
  }
);

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
  const { registerDoorTools } = (await import(spec)) as {
    registerDoorTools: (
      s: McpServer,
      ctx: import("./doors.js").DoorContext
    ) => Promise<void>;
  };
  await registerDoorTools(server, doorCtx);
  console.error("[dsa-policy] door tools registered.");
} else {
  console.error(
    "[dsa-policy] tools.ts not yet written — serving law only (door seam stubbed)."
  );
}

// Change notifications (Spec §4): push is garnish; the boot ritual is
// structure. Defensive send — SDK surface varies by version.
try {
  watch(policyDir, { persistent: false }, (_event, filename) => {
    if (!filename) return;
    const r = POLICY_RESOURCES.find((x) => x.file === filename);
    if (!r) return;
    const low = (
      server as unknown as {
        server?: {
          sendResourceUpdated?: (p: { uri: string }) => Promise<void>;
        };
      }
    ).server;
    if (low?.sendResourceUpdated) {
      low.sendResourceUpdated({ uri: r.uri }).catch(() => {});
    }
  });
} catch (err) {
  console.error("[dsa-policy] fs.watch unavailable:", err);
}

await server.connect(new StdioServerTransport());
console.error(
  `[dsa-policy] serving law on stdio; recording ${recording ? "ON" : "off"}; test-logging ${testLogging ? "ON" : "off"}.`
);
