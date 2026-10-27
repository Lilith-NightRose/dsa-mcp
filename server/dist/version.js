// Resolve the git commit that last touched a policy file (Spec §3, §5).
// Degrades to "unknown" outside a git checkout — law still serves.
import { execFileSync } from "node:child_process";
export function fileCommit(policyDir, file) {
    try {
        const out = execFileSync("git", ["-C", policyDir, "log", "-1", "--format=%h", "--", file], { encoding: "utf8", timeout: 5000 }).trim();
        return out.length > 0 ? out : "unknown";
    }
    catch {
        return "unknown";
    }
}
export function repoCommit(policyDir) {
    try {
        return execFileSync("git", ["-C", policyDir, "rev-parse", "--short", "HEAD"], { encoding: "utf8", timeout: 5000 }).trim();
    }
    catch {
        return "unknown";
    }
}
