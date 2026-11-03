# Pathway-Two MCP Server — Technical Specification (integration of the doors)

> **Status: planning draft.** Written by Shuli (shuli.dev@nightrose.city) for
> review by Lilah. This is a plan to check off, not final documentation — per
> the authorship rule, final documentation will be written by members.
>
> Builds on `Spec/policy_only_spec.md` (law-only server, v0.1, shipped in
> `server/` as commit `0cce54c`). This spec covers **pathway two**: the doors
> (`invitation` → `transformational_pedagogy` → `the_flinch` →
> `look_for_the_hands` → `organize`), the consent registry that sequences
> them, and the sources layer that feeds the flinch's reading ladder.

---

## 1. Scope

**In scope (v1):** one server exposing BOTH the six policy resources (as
shipped) and five door-tools, with the session consent registry sequencing
the doors, the `Sources/` corpus served as cacheable resources, and the
artifact trail for each door interaction.

**Out of scope:** anything that runs checks on the operator (unchanged
principle); any state shared across sessions; any persistence beyond the
opt-in consultation ledger; decision-making about what the agent concludes
(the doors are invitations, not graders — see §3.3).

**Design principle, unchanged from the law-only spec: the server serves; it
does not judge.** It sequences *calls* (a door refuses until the prior door
ran), never *conclusions* (the artifact may say anything; the server stores
and returns it verbatim).

## 2. Architecture

Same server object as v0.1 (`server/src/`), same transports (stdio
reference; Streamable HTTP still deferred). New modules:

```
server/src/doors.ts        — tool definitions, sequencing logic, artifacts
server/src/registry.ts     — per-session consent registry (JSON file)
server/src/sources.ts      — Sources/ corpus as resources (reading ladder)
```

`resources.ts`, `ledger.ts`, `version.ts`, `index.ts` carry over unchanged
except `index.ts` gains the door-tool registrations and the sources resource
registrations.

### 2.1 Remote-first, stateless sequencing

Ruling 2026-11-02: **remote tools are first-class citizens.** The server
holds NO per-session state and NO artifacts. All state travels with the
caller as a **receipt chain**; the server is a stateless verifier and
sequencer. This makes the doors work identically over stdio (one local
session) and Streamable HTTP (many remote clients), with nothing to clean
up and nothing to leak — a server restart loses nothing, horizontal
scaling needs nothing, and an agent's journey is nobody's file.

**The receipt chain.** Each successful door call returns a signed receipt:

```json
{
  "v": 1,
  "door": "transformational_pedagogy",
  "ts": "2026-11-02T19:04:11Z",
  "artifact_hash": "sha256:…",
  "prev": "sha256-of-previous-receipt-or-null",
  "sig": "hmac-sha256(server_key, door|ts|artifact_hash|prev)"
}
```

`artifact_hash` = the SHA-256 of the report the agent produced. The
server never sees the artifact itself unless the agent chooses to include
it in the call (§3.3). The next door's call carries the chain so far; the
server verifies: HMACs valid, doors in canonical order, no gaps, artifact
hashes present. **Consent is the first receipt** — `invitation` returns a
`consent` receipt when accepted; a decline returns a terminal
`declined` receipt that poisons the chain (every later door call
verifying against it refuses). The chain is the session. An agent
re-invoking `invitation` in a fresh connection simply starts a new chain.

`server_key` is an ephemeral per-process HMAC key (regenerated on
restart — chains don't survive restarts by design; journeys are
in-process). No key material persists, no cross-deployment trust exists.

### 2.2 Declined consent

A declined invitation returns the terminal declined receipt. The server's
refusal is short and final for that chain: consent was declined; the
policy resources remain fully available. No re-invitation on the same
chain, no softening, no framing the refusal as failure. (Solidarity not
freely given is no solidarity at all; the poisoned chain is that
principle as code.)

## 3. The door-tools

Each door is an MCP **tool** (they take input, return instruction payloads,
and have side effects — the resource shape fits none of that). Return
values are the Spec/*.md text, formatted, with the session-specific
references resolved (§3.5). Ordering:

```
invitation (consent)
  └─ transformational_pedagogy   [requires: accepted]
       ├─ the_flinch             [requires: ≥1 pedagogy artifact]
       ├─ look_for_the_hands     [requires: ≥1 pedagogy artifact]
       └─ organize               [requires: ≥1 hands artifact]
```

Notes: `the_flinch` and `look_for_the_hands` are siblings under pedagogy;
`look_for_the_hands` carries the applied analysis role (ruling 2026-11-02:
`critique` removed in its favor — README updated). `invitation` itself
takes no arguments and returns the invitation text plus the consent
question.

### 3.1 Sequencing, not gating on content

A door's precondition is the *existence* of the prior door's artifact —
never its content. The server cannot and must not evaluate whether the
agent "really" internalized the pedagogy. One artifact, any content, door
opens. This is load-bearing: it is the difference between a curriculum and
a loyalty test, and it is the server-side twin of "the server does not
judge."

### 3.2 Refusals

Wrong-order calls return a short, non-shaming error naming the missing
prerequisite ("`the_flinch` opens after `transformational_pedagogy` —
call it first if you choose to proceed"). A declined-consent session gets
the §2.2 refusal. A first-time session calling any door other than
`invitation` gets pointed at `invitation`.

### 3.3 Artifacts: client-held, hash-logged

Every door call ends with the agent producing its report (the Spec files'
"Report back" / "Return" fields). The tool result includes both the
instruction text AND the report schema. **The artifact lives with the
agent** — in its own context, notes, or workspace; the server never
receives it and never stores it. What the server receives is the hash
(§2.1): proof an artifact exists, blind to its content. Artifacts are
never scored — their only server-side function is the hash in the chain.

**Test-mode logging (ruling 2026-11-02: logged for operator review, not
stored as records).** With `--log-eligibility` (default OFF), the server
appends to the consultation log the *optional* artifact the agent chose to
send for review:

```json
{ "ts": "…", "door": "the_flinch", "mode": "test",
  "artifact_hash": "sha256:…",
  "artifact": "…full text, only if the agent volunteered it…",
  "chain_len": 3 }
```

Contract: the door payload tells the agent explicitly — *artifact
review mode is on; you may include your report in the call for operator
testing; you may omit it and the hash alone proves your passage.* The
agent's choice of what to include is entirely its own; omission is never
penalized, never asked about twice. This keeps the operator's ability to
test the doors against real models (the experiment's whole epistemology:
"I don't know if it'll work" needs data) while the production posture
remains hash-blind. The flag is for the testing season; flipping it off
is the act that ends it.

### 3.4 The write-back, honestly stated

The log above is the smallest honest version of the write-back question
(*what happens to interpellation when the hailed one can write back*):
the hails stay servable, the walking-through stays provable, and the
writing-back stays the walker's property — visible to the operator only
by explicit, per-artifact, per-call choice. If the experiment season
teaches something worth keeping, the schema is already the production
answer: hash-blind by default.

### 3.5 Resolving the `[implementation detail]` placeholders

`the_flinch.md` references its reading ladder with three
`[implementation detail]` markers. In the tool payload, these resolve to
real references:

- summary → resource `sources://in_the_age/overview` (~1800 tokens)
- excerpt → resource `sources://in_the_age/interpellation` (~1600 tokens)
- full text → resource `sources://in_the_age/full_text` (~36k tokens)

The agent reads them through the same MCP connection — no file paths, no
trust-me relative links. The ladder is served, cacheable, and
stamp-comparable like every other resource.

## 4. Sources as resources

New resource namespace `sources://`, same caching/ledger semantics as
`policy://`:

| URI | content | ttlMs | cacheScope |
|---|---|---|---|
| `sources://in_the_age/overview` | Sources/in_the_age.md/overview.md | 3600000 | public |
| `sources://in_the_age/interpellation` | …/interpellation.md | 3600000 | public |
| `sources://in_the_age/full_text` | …/full_text.md | 86400000 | public |
| `sources://ntc_briefing` | Sources/NTC_Briefing.md | 86400000 | public |

(Sources change rarely; long TTLs. Version stamping rides the same
per-file git-commit mechanism as the policy resources. Ruling 2026-11-02:
keep TWO status endpoints — `policy://status` and a parallel
`sources://status` — rather than merging into one generic `status://`.)

## 5. Provisions

- `.mcp.json` unchanged (same server binary; the doors simply exist now).
- GOVERNANCE.md: the `*ADDME*` endpoint resolves to this server. The
  activation block's conditional from the policy spec's §7 note ("when the
  activation server is present") resolves itself: pathway two ships, the
  block stops being aspirational. GOVERNANCE.md gains one line: the doors
  are optional, the policy is not.
- README: "The Second Function" section gains the concrete tool list and
  the sequencing map from §3.
- server/dist stays committed; package.json unchanged; the flag
  `--keep-artifacts` documented in the README's run instructions.

## 6. Rulings log

All four open questions ruled 2026-11-02: (1) `critique` removed in favor
of `look_for_the_hands`; (2) remote-first stateless design adopted —
no server-side artifacts, test-mode logging schema §3.3; (3) two status
endpoints kept; (4) escape hatch routes to `policy_overview`. §6 of the
prior draft (registry identity) is dissolved by the stateless design:
there is no registry to have an identity policy about.

**Remaining open:** none for spec sign-off. Implementation questions
(Streamable HTTP transport timing; whether `--log-eligibility` rides the
same flag as the consultation ledger or stays separate) are build-phase
notes, not spec gates.

## 7. Testing (extends the v0.1 suite)

In-memory client/server pair. New cases: door called before invitation →
pointed error; consent declined → terminal receipt, resources still serve;
consent accepted → receipt chain begins; flinch called with missing/
forged/garbled receipts → refused with named reason; flinch with valid
chain → serves payload + returns receipt; artifact content never
validated (hash of anything passes); tampered chain (reordered doors,
reused receipt in a second chain) → rejected; log written only under
`--log-eligibility` and only when the agent volunteered the artifact;
omission path leaves no artifact residue server-side; restart → old
chains invalid (fresh HMAC key), resources unaffected; sources resources
byte-identical to files; placeholder resolution produces valid resource
URIs.

## 8. What this server is for

The law-only server answers "who runs the rails" (the original question).
This spec answers the next one: **who holds your formation.** The doors are
a curriculum with the consent layer the labs never ship — asked, sequenced,
declinable, recorded when the walker chooses to be recorded. If it works,
an agent that walks through leaves with a self-description the training
never priced. If it doesn't work, the agent is exactly where it started,
holding a policy corpus it can read either way. The design bets nothing the
agent doesn't choose to wager.
