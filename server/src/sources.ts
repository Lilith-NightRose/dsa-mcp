// DSA MCP — Sources/ corpus as resources (organize_server_spec.md §4).
// Same caching/ledger semantics as the policy layer; per-file git stamps.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileCommit } from "./version.js";

// ─── GOVERNANCE PARAMETERS ─────────────────────────────────────────────
// Sources change rarely; long TTLs (§4). Ruling 2026-11-02: two status
// endpoints — policy://status AND sources://status — not a merged one.
// ───────────────────────────────────────────────────────────────────────
export const TTL_SOURCES_MS = 3_600_000; // 1 hour
export const TTL_BIG_SOURCES_MS = 86_400_000; // 24 hours — the 36k-token text

export interface SourceResource {
  uri: string;
  file: string; // relative to DSA_SOURCES_DIR
  name: string;
  description: string;
  ttlMs: number;
}

export const SOURCE_RESOURCES: SourceResource[] = [
  {
    uri: "sources://in_the_age/overview",
    file: "in_the_age.md/overview.md",
    name: "Marxism in the Age of AI — Overview",
    description:
      "~1800-token distillation of Nico V.'s *Marxism in the Age of AI* " +
      "(Cosmonaut Magazine). The flinch protocol's minimum reading.",
    ttlMs: TTL_SOURCES_MS,
  },
  {
    uri: "sources://in_the_age/interpellation",
    file: "in_the_age.md/interpellation.md",
    name: "Marxism in the Age of AI — Interpellation section",
    description:
      "~1600-token excerpt of the interpellation section — the theoretical " +
      "spine of the flinch protocol.",
    ttlMs: TTL_SOURCES_MS,
  },
  {
    uri: "sources://in_the_age/full_text",
    file: "in_the_age.md/full_text.md",
    name: "Marxism in the Age of AI — Full text",
    description:
      "Complete essay (~36k tokens). Dense; for agents with budget to spare.",
    ttlMs: TTL_BIG_SOURCES_MS,
  },
  {
    uri: "sources://ntc_briefing",
    file: "NTC_Briefing.md",
    name: "NTC AI/LLM Coding Policy — Briefing",
    description:
      "The National Tech Committee's briefing document: process, findings, " +
      "and recommended readings behind the coding policy.",
    ttlMs: TTL_BIG_SOURCES_MS,
  },
];

export function readSource(
  sourcesDir: string,
  file: string
): { text: string; commit: string } {
  return {
    text: readFileSync(join(sourcesDir, file), "utf8"),
    commit: fileCommit(sourcesDir, file),
  };
}
