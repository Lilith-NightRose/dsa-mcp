/**
 * DSA MCP — Cloudflare Workers entry (pathway one + two).
 *
 * Metacog's pattern (Lilah's prior deployment): McpAgent (agents/mcp)
 * hosts the McpServer in a Durable Object. SEMI-PUBLIC: /mcp is served
 * openly unless the MCP_TOKEN secret is set (optional gate — the consent
 * doors are the access control, not the token). Differences from
 * metacog:
 *  - DSA_DOORS_SECRET: the receipt-signing key binding — stable across
 *    isolates (doors.ts reads process.env.DSA_DOORS_SECRET); set via
 *    `npx wrangler secret put DSA_DOORS_SECRET`. Rotating it invalidates
 *    all outstanding receipt chains.
 *  - The ledger is a fail-open no-op (no writable filesystem on workers).
 *  - The policy corpus is bundled at build time (no fs on workers).
 *  - Test-mode artifact logging is a stdio/operator affordance; off here.
 */
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDoorTools } from "./tools.js";
import type { DoorContext } from "./doors.js";
import { Ledger } from "./ledger.js";
import { POLICY_RESOURCES } from "./resources.js";

// Bundled policy corpus — generated from ../Policy by the bundle step
// (npm run bundle). JSON import: TS-native via resolveJsonModule, and
// wrangler bundles JSON without a text-loader rule.
import policyBundle from "./policy-bundle.json" with { type: "json" };

// Env: Cloudflare.Env (global, from worker-configuration.d.ts) has the
// ASSETS + MCP_OBJECT bindings; secrets ride the d.ts appendix merge.
type Env = Cloudflare.Env;

const BUNDLED: Record<string, string> = policyBundle as Record<string, string>;

const noopLedger = new Ledger("/dev/null", false);

export class DsaPolicyMCP extends McpAgent<Env> {
  server = new McpServer(
    { name: "dsa-policy", version: "0.3.0" },
    { capabilities: { resources: { listChanged: false }, tools: {} } }
  );

  async init() {
    // Pathway 1: law as resources, bundled corpus, no-op ledger.
    for (const r of POLICY_RESOURCES) {
      const text = BUNDLED[r.file];
      if (text === undefined) continue;
      this.server.registerResource(
        r.name,
        r.uri,
        { title: r.name, description: r.description, mimeType: r.mimeType },
        async () => ({
          contents: [{ uri: r.uri, mimeType: r.mimeType, text }],
        })
      );
    }
    // The status endpoint, workers-flavored (bundled, no fs.watch).
    this.server.registerResource(
      "policy-status",
      "policy://status",
      { title: "Policy status", mimeType: "application/json" },
      async () => ({
        contents: [
          {
            uri: "policy://status",
            mimeType: "application/json",
            text: JSON.stringify({
              deployment: "cloudflare-workers",
              corpus: "bundled-at-build",
              note: "fs.watch unavailable on workers; policy changes ship with deploys",
            }),
          },
        ],
      })
    );

    // Pathway 2: the doors.
    const ctx: DoorContext = {
      testLogging: false,
      record: (line) => noopLedger.record(line),
    };
    await registerDoorTools(this.server, ctx);
  }
}

// ─── Bearer gate (metacog's timing-safe pattern) ───────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const expected = env.MCP_TOKEN;
  // Semi-public by design: no token configured -> serve openly. Set
  // MCP_TOKEN to close the gate (comma-separated tokens = per-client
  // revocation). This inverts metacog's fail-closed deliberately: this
  // service holds nothing private — the consent doors ARE the access
  // control, and missing config should mean open, not dead.
  if (!expected) return true;
  const auth = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return false;
  const presented = await sha256Hex(match[1].trim());
  for (const token of expected.split(",")) {
    if (timingSafeEqual(presented, await sha256Hex(token.trim()))) return true;
  }
  return false;
}

const mcpHandler = DsaPolicyMCP.serve("/mcp");

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/mcp")) {
      if (!(await isAuthorized(request, env))) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "WWW-Authenticate": 'Bearer realm="dsa-policy"' },
        });
      }
      return mcpHandler.fetch(request, env, ctx);
    }
    if (env.ASSETS) return await env.ASSETS.fetch(request);
    return new Response("Not Found", { status: 404 });
  },
};
