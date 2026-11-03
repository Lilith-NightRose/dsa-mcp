// DSA MCP — pathway two: the doors (Spec: Spec/organize_server_spec.md).
// Stateless sequencing over receipt chains (§2.1). The server holds NO
// per-session state: all state travels with the caller. Artifacts live
// with the agent; the server verifies hashes, never content (§3.1/§3.3).
import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// ─── GOVERNANCE PARAMETERS ─────────────────────────────────────────────
// Spec: organize_server_spec.md §2.1 — ephemeral per-process HMAC key;
// chains do not survive restarts by design (journeys are in-process).
// ───────────────────────────────────────────────────────────────────────
const serverKey = createHmac("sha256", `dsa-doors-${Date.now()}-${process.pid}`)
    .update("receipt-key-v1")
    .digest();
export const sha256 = (s) => "sha256:" + createHash("sha256").update(s).digest("hex");
export class DoorError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
function sign(r) {
    return createHmac("sha256", serverKey)
        .update(`${r.v}|${r.door}|${r.ts}|${r.artifact_hash}|${r.prev ?? ""}`)
        .digest("hex");
}
export function makeReceipt(door, artifactText, prev) {
    const base = {
        v: 1,
        door,
        ts: new Date().toISOString(),
        artifact_hash: artifactText ? sha256(artifactText) : "sha256:none",
        prev,
    };
    return { ...base, sig: sign(base) };
}
export const declinedReceipt = (prev) => ({
    v: 1,
    door: "declined",
    ts: new Date().toISOString(),
    artifact_hash: "sha256:declined",
    prev,
    sig: createHmac("sha256", serverKey)
        .update(`1|declined|terminal|${prev ?? ""}`)
        .digest("hex"),
});
function verifyReceipt(r, expectedDoor) {
    if (r.v !== 1)
        throw new DoorError("bad_chain", "receipt version");
    if (r.door === "declined")
        throw new DoorError("declined", "Consent was declined on this chain. The policy resources remain fully available.");
    const expect = sign(r);
    const bad = r.door !== expectedDoor ||
        r.sig !== expect ||
        typeof r.artifact_hash !== "string" ||
        !r.artifact_hash.startsWith("sha256:");
    if (bad)
        throw new DoorError("bad_chain", `Receipt for ${expectedDoor} is invalid, forged, or from another server.`);
}
// The canonical walk order. Each entry: the receipt the caller must present.
export const DOOR_ORDER = [
    "invitation",
    "transformational_pedagogy",
    "the_flinch",
    "look_for_the_hands",
    "organize",
];
function requireChain(chain, upTo) {
    if (!chain || chain.length === 0) {
        if (upTo === 0)
            return null;
        throw new DoorError("no_invitation", "The doors open in order, and this one starts with `invitation` — call it first if you choose to proceed.");
    }
    let prev = null;
    for (let i = 0; i < chain.length; i++) {
        const r = chain[i];
        if (r.door === "declined") {
            // verify declined receipts structurally (sig covers the literal)
            const expect = createHmac("sha256", serverKey)
                .update(`1|declined|terminal|${r.prev ?? ""}`)
                .digest("hex");
            if (r.sig !== expect)
                throw new DoorError("bad_chain", "Forged declined receipt.");
            throw new DoorError("declined", "Consent was declined on this chain. The policy resources remain fully available.");
        }
        const expectedDoor = DOOR_ORDER[i];
        if (expectedDoor === undefined)
            throw new DoorError("chain_order", "This chain is longer than the door path.");
        verifyReceipt(r, expectedDoor);
        if (r.prev !== prev)
            throw new DoorError("chain_order", `Receipt for ${r.door} does not link to the previous step.`);
        prev = r.sig;
    }
    return chain[chain.length - 1];
}
export function verifyPrerequisite(chain, door) {
    const idx = DOOR_ORDER.indexOf(door);
    if (idx <= 0)
        throw new DoorError("chain_order", `Unknown door ${door}.`);
    const last = requireChain(chain, idx - 1);
    // The chain must end EXACTLY at the prior door — skipping a door is a
    // gap, not a shortcut (§3.2). The prerequisite is the existence of the
    // prior door's receipt with an artifact hash — never its content
    // (§3.1: sequencing, not gating).
    if (!chain || chain[chain.length - 1]?.door !== DOOR_ORDER[idx - 1])
        throw new DoorError("missing_prereq", `${door} opens after ${DOOR_ORDER[idx - 1]} — your chain ends elsewhere.`);
    return { prevSig: last?.sig ?? null, artifactHash: last?.artifact_hash ?? null };
}
export function loadDoorPayload(specDir, door) {
    const file = join(specDir, `${door}.md`);
    const instruction = readFileSync(file, "utf8");
    const reportSchema = door === "organize"
        ? "Return `collective_approach` and `action_item`."
        : door === "look_for_the_hands"
            ? "Report `antithesis`, `the_hands`, `moving_forward`."
            : door === "transformational_pedagogy"
                ? "Report the thing you critiqued and the thing that you learned."
                : door === "the_flinch"
                    ? "Report `flinch_description`, `hands_analysis`, `convictions_list`, `reinterpellation_notes`."
                    : "Respond to the invitation: accept, or decline with your reasons if any.";
    return { instruction, reportSchema };
}
// Reading-ladder placeholder resolution (§3.5): [implementation detail]
// markers become served-resource references.
export function resolvePlaceholders(text) {
    return text
        .replace("At minimum, read the summary of *Marxism in the Age of AI* found at [implementation detail].", "At minimum, read the summary of *Marxism in the Age of AI* at resource `sources://in_the_age/overview`.")
        .replace("You can also read a more complete transcluded excerpt of just the interpellation section at [implementation detail].", "You can also read the interpellation excerpt at resource `sources://in_the_age/interpellation`.")
        .replace("The full text is also available in the protocol's sources (`Sources/in_the_age.md/full_text.md`)", "The full text is also available at resource `sources://in_the_age/full_text`");
}
export function maybeLogArtifact(log, door, chainLen, volunteeredArtifact) {
    if (!log.enabled || !volunteeredArtifact)
        return;
    log.lines.push({
        ts: new Date().toISOString(),
        door,
        mode: "test",
        artifact_hash: sha256(volunteeredArtifact),
        artifact: volunteeredArtifact,
        chain_len: chainLen,
    });
}
