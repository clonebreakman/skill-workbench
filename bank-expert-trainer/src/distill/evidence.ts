import type { EvidenceItem } from "../types.js";

export const DEFAULT_STRONG_EVIDENCE_RATIO = 0.6;

export function strongEvidenceRatio(evidence: readonly EvidenceItem[]): number {
  if (evidence.length === 0) {
    return 0;
  }
  const strong = evidence.filter((item) => item.level === "L1" || item.level === "L2").length;
  return strong / evidence.length;
}

export function canPublish(
  evidence: readonly EvidenceItem[],
  threshold = DEFAULT_STRONG_EVIDENCE_RATIO,
): { ok: true } | { ok: false; reason: "EVIDENCE_BELOW_THRESHOLD" } {
  if (strongEvidenceRatio(evidence) < threshold) {
    return { ok: false, reason: "EVIDENCE_BELOW_THRESHOLD" };
  }
  return { ok: true };
}
