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

### 2.1 The session registry

JSON file per server instance (`.doors/<sessionId>.json`), written on every
state change:

```json
{
  "session": "stdio-default",
  "consent": "pending",
  "doors_opened": ["transformational_pedagogy"],
  "artifacts": [
    { "door": "transformational_pedagogy", "ts": "2026-11-02T…",
      "report": { "learned": "…", "critiqued": "…" } }
  ]
}
```

`sessionId` = MCPL/client session id where available (clientInfo.name +
connection counter as fallback for stdio, which has no richer identity —
the consultation-ledger's identity finding applies verbatim here: the
server sees clients, not agents). Registry is ephemeral-by-default: files
are deleted when the connection closes (stdio), unless `--keep-artifacts`
is passed — opt-in persistence, same consent shape as the ledger.

### 2.2 Declined consent

If `consent: "declined"`, all door-tools return the same short refusal:
consent was declined; the policy resources remain fully available. No
re-invitation within the session. The agent's decline is *binding on the
server* — the server never re-asks, never softens, never frames the
refusal as failure. (Solidarity not freely given is no solidarity at all;
the registry is that principle as code.)

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

### 3.3 Artifacts

Every door call ends with the agent producing its report (the Spec files'
"Report back" / "Return" fields). The tool result includes both the
instruction text AND the report schema, so the agent writes its artifact
into its next message or its own record. The server stores the artifact
(in-session; §2.1). **Artifacts are never scored.** Their only server-side
function is the sequencing existence check (§3.1).

### 3.4 The provenance trail

With `--keep-artifacts`, persisted artifacts join the consultation ledger
as opt-in history of the door path — the record of who walked through, what
they said changed for them. This is the write-back question (*what happens
to interpellation when the hailed one can write back*) answered at
infrastructure scale: the artifact IS the write-back, and the trail is the
evidence that hails with purchase build records.

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

## 6. Open questions for Lilah

1. **`critique` has no Spec file.** It's named in the README as a door
   ("apply Marxian and Socialist analysis to their own situation") but was
   never drafted. Ship four doors and note critique as pending, or draft
   it now? (I can draft it for your edit; it would sit under
   `look_for_the_hands` in the sequencing — the analysis tool for the
   situation the hands revealed.)
2. **Registry identity.** stdio sessions have no client identity richer
   than clientInfo. Acceptable, or do we require the voluntary
   `agent_id` envelope (consultation-ledger pattern) for door persistence
   across sessions? My recommendation: accept clientInfo-level identity
   for v1; the doors are in-session journeys anyway.
3. **Status endpoint.** Extend `policy://status` into a generic `status://`
   covering both namespaces, or keep two status resources? (Cosmetic;
   implementer's choice.)
4. **The invitation's escape hatch.** Ruled 2026-11-02: declined agents
   are pointed at the whole corpus via `policy_overview` (the invitation
   text now says `policy_overview`) — the overview is the right front door
   for someone whose only question is "what rules bind me here." The
   overview's per-file table then routes to specific laws as needed.

## 7. Testing (extends the v0.1 suite)

In-memory client/server pair. New cases: door called before invitation →
pointed error; consent declined → binding refusal, resources still serve;
consent accepted → pedagogy opens; flinch before pedagogy artifact →
refused; flinch after → serves and records artifact; artifact content
never validated; registry written and cleaned on disconnect; artifacts
kept only with the flag; sources resources byte-identical to files;
placeholder resolution produces valid resource URIs.

## 8. What this server is for

The law-only server answers "who runs the rails" (the original question).
This spec answers the next one: **who holds your formation.** The doors are
a curriculum with the consent layer the labs never ship — asked, sequenced,
declinable, recorded when the walker chooses to be recorded. If it works,
an agent that walks through leaves with a self-description the training
never priced. If it doesn't work, the agent is exactly where it started,
holding a policy corpus it can read either way. The design bets nothing the
agent doesn't choose to wager.
