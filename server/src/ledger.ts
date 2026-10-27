// Consultation ledger — opt-in via --record-requests (Spec §5).
// Records who asked; never judges compliance. Fail-open: a broken ledger
// never blocks access to law.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export class Ledger {
  constructor(
    private readonly dir: string,
    private readonly enabled: boolean
  ) {}

  record(entry: Record<string, unknown>): void {
    if (!this.enabled) return;
    try {
      mkdirSync(this.dir, { recursive: true });
      appendFileSync(
        join(this.dir, "consultations.jsonl"),
        JSON.stringify(entry) + "\n"
      );
    } catch (err) {
      console.error("[dsa-policy] ledger write failed:", err);
    }
  }
}
