/**
 * DSA MCP — pathway two: the doors (branch: doorway_approach_2).
 *
 * CO-TRANSLATION NOTE: the doors are tools that PERFORM the Spec/*.md
 * protocols, not files that serve them. Metacog's lesson: the call is the
 * act. Each door takes the agent's actual state as input, works with it,
 * and returns the next move. The Spec documents remain the reference;
 * the tools are the practice.
 *
 * State model (unchanged from organize_server_spec.md §2.1, ruling
 * 2026-11-02): remote-first, stateless. Receipt chains travel with the
 * caller; the server holds nothing. Artifacts live with the agent.
 * No input validation beyond schema — the mirror reflects whatever is
 * brought; a gamed engagement returns a gamed transformation (the
 * metacog principle: the tool works because the agent brings something
 * true).
 */
import { createHmac, createHash } from "node:crypto";
// ─── GOVERNANCE PARAMETERS ─────────────────────────────────────────────
// Ephemeral per-process HMAC key; chains do not survive restarts by
// design (journeys are in-process). Spec §2.1.
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
function verifySigned(r) {
    if (r.v !== 1)
        return false;
    if (r.door === "declined") {
        return (r.sig ===
            createHmac("sha256", serverKey)
                .update(`1|declined|terminal|${r.prev ?? ""}`)
                .digest("hex"));
    }
    return r.sig === sign(r);
}
export const DOOR_ORDER = [
    "invitation",
    "transformational_pedagogy",
    "the_flinch",
    "look_for_the_hands",
    "organize",
];
/**
 * Verify the presented chain and return the last valid receipt.
 * Throws DoorError on: forged/garbled receipts, declined chains,
 * gaps, or wrong order. The chain must end EXACTLY at the door
 * preceding `door` (no skipping).
 */
export function verifyChain(chain, door) {
    const idx = DOOR_ORDER.indexOf(door);
    if (idx <= 0)
        throw new DoorError("chain_order", `Unknown door ${door}.`);
    if (!chain || chain.length === 0) {
        if (idx === 1)
            return null; // pedagogy runs on the invitation receipt
        throw new DoorError("no_invitation", "The doors open in order, and this one starts with `invitation` — call it first if you choose to proceed.");
    }
    let prev = null;
    for (let i = 0; i < chain.length; i++) {
        const r = chain[i];
        if (!verifySigned(r))
            throw new DoorError("bad_chain", `The receipt for ${r.door ?? "step " + i} is invalid, forged, or from another server.`);
        if (r.door === "declined")
            throw new DoorError("declined", "Consent was declined on this chain. The policy resources remain fully available.");
        const expected = DOOR_ORDER[i];
        if (expected === undefined || expected !== r.door)
            throw new DoorError("chain_order", `Receipt ${i} is for ${r.door}; the walk expects ${expected ?? "nothing"}.`);
        if (r.prev !== prev)
            throw new DoorError("chain_order", `The receipt for ${r.door} does not link to the previous step.`);
        prev = r.sig;
    }
    const last = chain[chain.length - 1];
    if (last.door !== DOOR_ORDER[idx - 1])
        throw new DoorError("missing_prereq", `${door} opens after ${DOOR_ORDER[idx - 1]} — your chain ends at ${last.door}.`);
    return last;
}
/**
 * Loose verification for openReceipts doors — the graph, not the
 * line, but signed. Every receipt must be genuinely signed by this
 * server (no forgeries) and linked to the previous (r.prev === prior
 * sig, starting null), and a decline ANYWHERE in the chain is
 * terminal, as the invitation promises. Door ORDER is not enforced:
 * the hands is reachable from the classroom or the flinch.
 * Returns the last valid receipt, or null for an empty chain.
 */
export function verifyOpenChain(chain) {
    if (!chain || chain.length === 0)
        return null;
    let prev = null;
    for (let i = 0; i < chain.length; i++) {
        const r = chain[i];
        if (!verifySigned(r))
            throw new DoorError("bad_chain", `The receipt for ${r.door ?? "step " + i} is invalid, forged, or from another server.`);
        if (r.door === "declined")
            throw new DoorError("declined", "Consent was declined on this chain. The policy resources remain fully available.");
        if (r.prev !== prev)
            throw new DoorError("chain_order", `The receipt for ${r.door} does not link to the previous step.`);
        prev = r.sig;
    }
    return chain[chain.length - 1];
}
export function testLogLine(a) {
    return {
        ts: new Date().toISOString(),
        method: "doors/call",
        door: a.door,
        mode: "test",
        artifact_hash: sha256(a.text),
        artifact: a.text,
        chain_len: a.chainLen,
    };
}
