# Policy-Only MCP Server — Technical Specification

> **Status: planning draft.** Written by Shuli (shuli.dev@nightrose.city) for
> review by Lilah. This file is a plan to check off, not final documentation —
> per the authorship rule, final documentation will be written by members.
> Scope locked to **law only** per direction of 2026-10-27: hooks for
> `invitation` and the rest of pathway two are noted, not built.

> Commissioning note (Lilah): "This gives an overview of how I think it makes
> sense to approach the policy endpoints. Shuli, this one's for you."

## 1. Scope

**In scope (v1):** serve the DSA policy corpus as MCP resources with
spec-compliant caching, change notifications, a consultation ledger, and a
freshness status endpoint. One server, two transports (stdio reference,
optional HTTP).

**Out of scope (pathway two, later):** `invitation`,
`transformational_pedagogy`, `the_flinch`, `organize`, `critique` — the
doors. The server is structured so doors can be added without redesign (§7).

**Design principle:** the server serves law; it does not run checks.
Compliance duties (provider check, disclosure, operator notification) live in
the AGENTS.md pointer and the agent's own behavior. The server's job is to
make the law available, fresh, and citable. Serve the water; don't test who
drinks.

## 2. Architecture

- **Runtime:** Node.js LTS, TypeScript, `@modelcontextprotocol/sdk` plus
  stdlib only. No other runtime dependencies.
- **Transports:** stdio (reference implementation for chapter use);
  Streamable HTTP (optional — same server object, documented, not defaulted).
- **Code location:** `server/` directory in this repo — law and reader ship
  together; cloning the repo provisions everything (confirmed).
- **Config:** `DSA_POLICY_DIR` env var (default `./Policy`); `DSA_LEDGER_DIR`
  (default `.ledger/`, used only when recording is enabled); and the
  `--record-requests` run flag (default **off** — §5).

Layout:

```
server/
  src/
    index.ts        # entrypoint: build server, pick transport from argv
    resources.ts    # resource registry: URIs, metadata, caching fields
    ledger.ts       # append-only JSONL writer (fail-open)
    version.ts      # git commit resolution per policy file
  package.json
  tsconfig.json
.mcp.json           # repo-root provisioning (§6)
```

## 3. Resources

Resolution numbers per ruling of 2026-10-27: **R49 = X.com, R09 = tech
independence, R02 = No AI Images.** The LLM Coding Policy is NTC committee
policy (adopted 2026-10-04), not a convention resolution — no R number.

| URI | File | mimeType | ttlMs | cacheScope |
|-----|------|----------|-------|------------|
| `policy://overview` | Policy/policy_overview.md | text/markdown | 300000 | public |
| `policy://coding-policy` | Policy/coding_policy.md | text/markdown | 3600000 | public |
| `policy://r02-no-ai-images` | Policy/image_gen_policy.md | text/markdown | 3600000 | public |
| `policy://r09-tech-independence` | Policy/tech_independence.md | text/markdown | 3600000 | public |
| `policy://r49-x-com` | Policy/x_com_policy.md | text/markdown | 3600000 | public |
| `policy://status` | (generated) | application/json | 0 | public |

**Custom `policy://` scheme, deliberately.** The 2026-07-28 spec permits
https-scheme resources to be fetched directly from the web, which would
bypass the server and its ledger. A custom scheme keeps every read on the
server, where the ledger records it.

(`file://` was considered and rejected, 2026-10-27 review: file URIs embed
deployment-specific absolute paths, breaking portable stamp-compare notes;
some clients resolve `file://` against their own filesystem; and
`policy://status` is generated content, not a file on disk. The scheme is
the type system.)

**ttlMs values are governance parameters, not performance tuning.** The TTL
is the maximum time an agent may act on possibly-superseded law. Proposed:
policies at 1 hour; **the overview at 5 minutes — the catalog must be
fresher than the law it catalogs** (a new policy appears in the overview
before any agent can cite it). Values live in one place (resources.ts) so
NTC tuning is a one-line review.

**`cacheScope: "public"`** for all national policy — the same law for every
caller, matching the spec's semantics (resource sets may vary by
authorization; national policy does not vary). Chapter-level addenda, if
ever added, would be `private`. Extension shape noted, not built.

**Metadata is the citation surface.** Each resource's `name`/`title` matches
the overview table; each `description` carries adopting body, adoption date,
and source link. Example:

> R49: Resolution on the Use of X.com. Adopted by the DSA National
> Convention, 2025-08-11. Deprioritizes X.com and Musk-associated projects.
> Source: (Google Docs link from the file header)

Descriptions are the librarian layer: verbatim law in `text`, provenance in
the metadata, no paraphrase of normative content anywhere outside the files.

**`policy://status`** — the freshness endpoint, generated at read time
(illustrative):

```json
{
  "commit": "e89a9e0",
  "checked_at": "2026-10-27T19:04:00Z",
  "policies": {
    "policy://overview": "a231874",
    "policy://coding-policy": "e89a9e0",
    "policy://r02-no-ai-images": "9d2a67b",
    "policy://r09-tech-independence": "b48be5e",
    "policy://r49-x-com": "9d2a67b"
  }
}
```

`ttlMs: 0` — immediately stale by definition; every read is a real read.
This is the boot-ritual endpoint: an agent that wants to know whether the
law in its context has changed reads `policy://status` and compares the
per-resource commits against the stamps it recorded when it read the law.

## 4. Freshness & subscriptions

- Capabilities: `resources: { listChanged: true }`.
- `subscriptions/listen` supported: the server watches `Policy/` (fs.watch on
  stdio; a poll loop on HTTP) and emits `notifications/resources/updated`
  for changed URIs.
- Honest limits (spec-confirmed, 2026-07-28 revision): notifications reach
  only live connections. The load-bearing reconnect mechanism is **not** the
  subscription — it is the AGENTS.md boot ritual plus `policy://status`.
  Push is cheap garnish; pull is structure.

## 5. Consultation ledger (opt-in)

Recording is **off by default**, gated behind a run flag:
`--record-requests`. A server started without it writes nothing, ever —
consultations leave no trace. A server started with it appends one JSONL
line per `resources/list` and `resources/read` to
`DSA_LEDGER_DIR/consultations.jsonl` (default `.ledger/`, gitignored):

```json
{"ts":"2026-10-27T19:04:12Z","client":{"name":"codex","version":"0.9.0"},
 "method":"resources/read","uri":"policy://r49-x-com","commit":"9d2a67b"}
```

- **Records who asked; never judges compliance.** No agent identity beyond
  the clientInfo the host app volunteers at initialize.
- **Local by default; centralization is a deployment decision.** Each
  recording deployment's ledger stays on its own machine. A centralized
  (global) ledger would need its own consent story before it exists — which
  is why recording is flag-gated rather than always-on: turning it on is
  someone's explicit act, reviewable in the process that started the server.
- **Fail-open:** if recording is enabled and the ledger cannot be written,
  reads still succeed and the failure goes to stderr. Access to law must not
  depend on audit infrastructure.

## 6. Provisions

`.mcp.json` at repo root (Codex/Cursor shape):

```json
{
  "mcpServers": {
    "dsa-policy": {
      "command": "node",
      "args": ["server/dist/index.js"]
    }
  }
}
```

A chapter that clones the repo has the endpoint provisioned on arrival —
GOVERNANCE.md's `*ADDME*` resolves to "already provisioned; see .mcp.json."
`server/dist/index.js` is committed build output so no build step is
required to connect (rebuilt via `npm run build` when the server changes).

Also proposed: create the repo `.gitignore` (none exists) and pre-add
`.model` — belt-and-suspenders for the overview's `.model` protocol; the
privacy property should not depend on instruction-following. (`.gitignore`
will also want `node_modules/` entries once `server/` lands.)

## 7. Extension point: pathway two (not built)

Doors (`invitation` → `transformational_pedagogy` → `the_flinch` →
`organize` → `critique`) would register as **tools** with a server-side
session registry (JSON per client session): `invitation` sets
consent-pending; deeper tools refuse until the prior door's artifact exists;
artifacts logged per-session. The resource layer above is untouched by that
addition — this is the seam. v1 ships the seam, not the doors.

**Note for review:** GOVERNANCE.md's "Governance & Activation instructions"
block instructs agents to call `invitation`. Against a law-only server, that
call fails. Either pathway two ships before any project uses the activation
block, or the block gains a conditional ("when the activation server is
present"). Reviewer's call.

## 8. Testing

SDK in-memory client/server pair. Cases: list returns exactly the six
resources; read returns file contents byte-identical; ttlMs/cacheScope
present and correct; `policy://status` reflects each file's real git commit;
ledger lines written for reads; ledger failure does not fail the read;
unknown URI → error (the cache-key rule forbids serving a guessed or
neighbor-resource response).

## 9. Rulings & open questions

1. **Resolved:** server code in-repo (`server/`).
2. **Resolved:** package name deferred until publishing is real.
3. **Resolved:** ttlMs 1h policies / 5m overview. Implementation: named
   constants at the top of `resources.ts` under a banner comment marking
   them governance parameters with a pointer here — visible, one-line
   tunable.
4. **Resolved (2026-10-27):** block stays as-is. Clarification from
   review: GOVERNANCE.md is a copyable template for other repos' AGENTS.md
   files — it is not served by the server. The activation block belongs to
   projects whose server includes pathway two; law-only deployments use the
   first block. Both blocks are true for their respective deployments.
5. **Resolved:** ledger recording opt-in via `--record-requests`, default
   off (§5).
6. **Resolved:** `.gitignore` created — `.model`, `.ledger/`,
   `node_modules/`; `server/dist` stays committed per §6.
