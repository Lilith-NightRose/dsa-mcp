// DSA Policy MCP server — law only (Spec: Spec/policy_only_spec.md).
// Serves the policy corpus as resources. No tools in v1; pathway two
// (the doors) registers tools at the §7 seam without touching this layer.
import { readFileSync, watch } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { POLICY_RESOURCES, TTL_STATUS_MS } from "./resources.js";
import { Ledger } from "./ledger.js";
import { fileCommit, repoCommit } from "./version.js";

const policyDir = process.env.DSA_POLICY_DIR ?? "./Policy";
const recording = process.argv.includes("--record-requests"); // default OFF
const ledger = new Ledger(process.env.DSA_LEDGER_DIR ?? ".ledger", recording);

const server = new McpServer(
  { name: "dsa-policy", version: "0.1.0" },
  { capabilities: { resources: { listChanged: true } } }
);

// ttlMs / cacheScope are 2026-07-28 caching fields; the SDK's result type
// predates them, so the extra fields are asserted through — they ride on
// the wire regardless.
const cached = (
  contents: ReadResourceResult["contents"],
  ttlMs: number
): ReadResourceResult =>
  ({ contents, ttlMs, cacheScope: "public" }) as unknown as ReadResourceResult;

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
  `[dsa-policy] serving law on stdio; recording ${recording ? "ON" : "off"}.`
);
