// ─── GOVERNANCE PARAMETERS ─────────────────────────────────────────────
// TTL values are the maximum time an agent may act on possibly-superseded
// law. They are governance parameters, not performance tuning.
// See Spec/policy_only_spec.md §3 and §9.3. NTC-tunable, one line each.
// ───────────────────────────────────────────────────────────────────────
export const TTL_POLICY_MS = 3_600_000; // 1 hour — policy resources
export const TTL_OVERVIEW_MS = 300_000; // 5 minutes — the catalog must be
                                        // fresher than the law it catalogs
export const TTL_STATUS_MS = 0;         // immediately stale: every read is
                                        // a real read

export interface PolicyResource {
  uri: string;
  file: string; // relative to DSA_POLICY_DIR
  name: string;
  description: string;
  mimeType: string;
  ttlMs: number;
}

// Resolution numbers per ruling of 2026-10-27:
// R49 = X.com, R09 = tech independence, R02 = No AI Images.
// The LLM Coding Policy is NTC committee policy — no R number.
export const POLICY_RESOURCES: PolicyResource[] = [
  {
    uri: "policy://overview",
    file: "policy_overview.md",
    name: "DSA LLM / GenAI Policy Overview",
    description:
      "Catalog and stance-setting overview of DSA's generative-AI policies. " +
      "Policies enumerated: LLM Coding Policy (NTC, 2026-10-04); R02 No AI " +
      "Images; R09 Technological Independence; R49 Use of X.com (all DSA " +
      "National Convention, 2025-08-11). Source links live in each policy " +
      "file's header.",
    mimeType: "text/markdown",
    ttlMs: TTL_OVERVIEW_MS,
  },
  {
    uri: "policy://coding-policy",
    file: "coding_policy.md",
    name: "LLM Coding Policy",
    description:
      "Adopted by the DSA National Tech Committee, 2026-10-04. Restrictions " +
      "for coding agents: disclosure, authorship boundaries, vendor " +
      "prohibitions (xAI named), data-for-training prohibition. Source: " +
      "https://docs.google.com/document/d/e/2PACX-1vQWxH4uNfSo2D-UeuI7KdKXtXFGaK_GdsqMymRjBVLPiFcj9VPnNEWJCp1Y1RhCgutdaRhgATW8cqGI/pub",
    mimeType: "text/markdown",
    ttlMs: TTL_POLICY_MS,
  },
  {
    uri: "policy://r02-no-ai-images",
    file: "image_gen_policy.md",
    name: "R02: No AI Images",
    description:
      "Adopted by the DSA National Convention, 2025-08-11. Prohibits image " +
      "and video generation for DSA purposes, with limited exceptions. " +
      "Source: https://docs.google.com/document/d/1MQyHv17FJyCqk9FMXB_mfSVQB3O6gkFhnJxmiYwdaGc/edit?pli=1&tab=t.w3ibfjqb4wyr",
    mimeType: "text/markdown",
    ttlMs: TTL_POLICY_MS,
  },
  {
    uri: "policy://r09-tech-independence",
    file: "tech_independence.md",
    name: "R09: Technological Independence Policy",
    description:
      "Adopted by the DSA National Convention, 2025-08-11. Framework for " +
      "DSA and NTC technology choices and the draft tech policy rubric: " +
      "exit from capitalist and Democratic-Party-dependent platforms. " +
      "Source: https://docs.google.com/document/d/1MQyHv17FJyCqk9FMXB_mfSVQB3O6gkFhnJxmiYwdaGc/edit?pli=1&tab=t.w3ibfjqb4wyr",
    mimeType: "text/markdown",
    ttlMs: TTL_POLICY_MS,
  },
  {
    uri: "policy://r49-x-com",
    file: "x_com_policy.md",
    name: "R49: Resolution on the Use of X.com",
    description:
      "Adopted by the DSA National Convention, 2025-08-11. Deprioritizes " +
      "X.com and Musk-associated projects; the basis for the xAI model " +
      "prohibition in the coding policy. " +
      "Source: https://docs.google.com/document/d/1MQyHv17FJyCqk9FMXB_mfSVQB3O6gkFhnJxmiYwdaGc/edit?pli=1&tab=t.w3ibfjqb4wyr",
    mimeType: "text/markdown",
    ttlMs: TTL_POLICY_MS,
  },
];
