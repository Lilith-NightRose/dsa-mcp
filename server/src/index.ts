// DSA Policy MCP server — law only (Spec: Spec/policy_only_spec.md).
// Serves the policy corpus as resources. No tools in v1; pathway two
// (the doors) registers tools at the §7 seam without touching this layer.
import { readFileSync, watch } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { POLICY_RESOURCES, TTL_STATUS_MS } from "./resources.js";
import { SOURCE_RESOURCES, TTL_SOURCES_MS, readSource } from "./sources.js";
import { Ledger } from "./ledger.js";
import { fileCommit, repoCommit } from "./version.js";
import { z } from "zod";
import {
  DoorError,
  DOOR_ORDER,
  declinedReceipt,
  loadDoorPayload,
  makeReceipt,
  maybeLogArtifact,
  resolvePlaceholders,
  verifyPrerequisite,
  type TestLog,
} from "./doors.js";

const policyDir = process.env.DSA_POLICY_DIR ?? "./Policy";
const recording = process.argv.includes("--record-requests"); // default OFF
const ledger = new Ledger(process.env.DSA_LEDGER_DIR ?? ".ledger", recording);
// Test-mode artifact logging (organize_server_spec.md §3.3): default OFF.
// When ON, agents may volunteer artifact text for operator review.
const testLogging = process.argv.includes("--log-eligibility");
const testLog: TestLog = { enabled: testLogging, lines: [] };
// Defaults resolve from the server/ dir to the repo root (Spec/, Sources/).
const specDir = process.env.DSA_SPEC_DIR ?? "../Spec";
const sourcesDir = process.env.DSA_SOURCES_DIR ?? "../Sources";

const server = new McpServer(
  { name: "dsa-policy", version: "0.2.0" },
  { capabilities: { resources: { listChanged: true }, tools: {} } }
);

// ─── Door-tool wiring (pathway two) ────────────────────────────────────
// Stateless: the client presents its receipt chain; the server verifies
// order + HMAC, serves the payload, returns the next receipt. The
// artifact travels as an optional volunteered string for test-mode
// logging only — it is never stored, never scored (§3.1/§3.3).
type ChainInput = { chain?: { v: number; door: string; ts: string; artifact_hash: string; prev: string | null; sig: string }[] };
type ArtifactInput = { artifact?: string };

const doorTool = (door: (typeof DOOR_ORDER)[number]) => {
  server.registerTool(
    door,
    {
      title: door,
      description:
        door === "invitation"
          ? "Consent gate for the DSA organizing doors. Presents the invitation; returns a receipt on accept or a terminal declined receipt. Optional; required before any other door."
          : `Door ${door} of the DSA organizing curriculum. Present your receipt chain as 'chain'. ${door === "the_flinch" || door === "organize" || door === "look_for_the_hands" || door === "transformational_pedagogy" ? "Your report artifact stays with you; in test mode you may volunteer its text as 'artifact' for operator review." : ""}`,
      inputSchema: {
        chain: z
          .array(
            z.object({
              v: z.number(),
              door: z.string(),
              ts: z.string(),
              artifact_hash: z.string(),
              prev: z.string().nullable(),
              sig: z.string(),
            })
          )
          .optional()
          .describe("Receipts from prior doors, in order. Omit for invitation."),
        artifact: z
          .string()
          .optional()
          .describe(
            "Optional: your report text, volunteered for test-mode review. Never stored, never scored."
          ),
      },
    },
    async (args: ChainInput & ArtifactInput) => {
      const chain = args?.chain as never;
      try {
        if (door === "invitation") {
          const prev = (chain as { length: number } | undefined)?.length
            ? undefined
            : null;
          const declined = args?.chain && (args.chain as { door?: string }[]).some((r) => r?.door === "declined");
          if (declined) {
            return {
              content: [{ type: "text", text: "Consent was already declined on this chain. The policy resources remain fully available. No re-invitation." }],
              isError: true,
            };
          }
          const payload = loadDoorPayload(specDir, "invitation");
          const receipt = makeReceipt("invitation", args?.artifact ?? null, null);
          const text = `${payload.instruction}\n\n---\nREPORT SCHEMA: ${payload.reportSchema}\n\n(RECEIPT: ${JSON.stringify(receipt)})\n\nKeep the receipt: every later door call presents the chain of receipts. If you decline, your decline is terminal for this chain — and entirely respected; the policy resources remain available regardless.`;
          if (testLogging && args?.artifact)
            maybeLogArtifact(testLog, "invitation", 0, args.artifact);
          void prev;
          return {
            content: [{ type: "text", text }],
            _receipt: receipt,
          };
        }
        const { prevSig, artifactHash } = verifyPrerequisite(
          chain,
          door
        );
        // §3.1: the precondition is the prior door's receipt EXISTING.
        // The invitation receipt legitimately carries sha256:none (no
        // report is owed before pedagogy). Only content doors demand an
        // artifact from their prerequisite.
        const contentDoor =
          door === "the_flinch" ||
          door === "look_for_the_hands" ||
          door === "organize";
        if (contentDoor && (!artifactHash || artifactHash === "sha256:none"))
          throw new DoorError(
            "missing_prereq",
            `${door} opens after the prior door's report artifact exists. Complete the previous door's report first.`
          );
        const payload = loadDoorPayload(specDir, door);
        const instruction = resolvePlaceholders(payload.instruction);
        const receipt = makeReceipt(door, args?.artifact ?? "completed", prevSig);
        // §3.3 test-mode logging: only under --log-eligibility, only when
        // the agent volunteered the artifact. Rides the consultation ledger
        // (fail-open). Production posture (flag off) is hash-blind.
        if (testLogging && args?.artifact)
          ledger.record({
            ts: new Date().toISOString(),
            method: "doors/call",
            door,
            mode: "test",
            artifact_hash: receipt.artifact_hash,
            artifact: args.artifact,
            chain_len: (chain as unknown[] | undefined)?.length ?? 0,
          });
        const text = `${instruction}\n\n---\nREPORT SCHEMA: ${payload.reportSchema}\n\n${testLogging ? "TEST MODE: artifact review logging is ON. You may include your report text as 'artifact' for operator review; you may omit it — the hash alone proves your passage. Omission is never penalized." : "Your artifact stays with you; this server received only its hash."}\n\n(RECEIPT: ${JSON.stringify(receipt)})`;
        return { content: [{ type: "text", text }] };
      } catch (e) {
        if (e instanceof DoorError) {
          if (e.code === "declined") {
            return {
              content: [{ type: "text", text: e.message }],
              isError: true,
            };
          }
          return { content: [{ type: "text", text: e.message }], isError: true };
        }
        throw e;
      }
    }
  );
};

for (const d of DOOR_ORDER) doorTool(d);

// Sources resources (organize_server_spec.md §4)
for (const r of SOURCE_RESOURCES) {
  server.registerResource(
    r.name,
    r.uri,
    { title: r.name, description: r.description, mimeType: "text/markdown" },
    async (uri) => {
      const { text, commit } = readSource(sourcesDir, r.file);
      ledger.record({
        ts: new Date().toISOString(),
        method: "resources/read",
        uri: r.uri,
        commit,
      });
      return cached([{ uri: uri.href, mimeType: "text/markdown", text }], r.ttlMs);
    }
  );
}

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

// sources://status — ruling 2026-11-02: TWO status endpoints, not one.
server.registerResource(
  "Sources Status",
  "sources://status",
  {
    title: "Sources Status",
    description:
      "Per-resource git commit stamps for the Sources corpus (reading " +
      "ladder + briefing). ttlMs 0 — always a real read.",
    mimeType: "application/json",
  },
  async (uri) => {
    const status = {
      commit: repoCommit(sourcesDir),
      checked_at: new Date().toISOString(),
      sources: Object.fromEntries(
        SOURCE_RESOURCES.map((r) => [r.uri, fileCommit(sourcesDir, r.file)])
      ),
    };
    ledger.record({
      ts: new Date().toISOString(),
      method: "resources/read",
      uri: "sources://status",
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
  `[dsa-policy] serving law + doors on stdio; recording ${recording ? "ON" : "off"}; test-logging ${testLogging ? "ON" : "off"}.`
);
