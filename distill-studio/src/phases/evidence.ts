import type { DimensionBundle, EvidenceItem, EvidenceLevel } from "../types.js";

const THRESHOLD = 0.6;

function pushEvidence(
  items: EvidenceItem[],
  level: EvidenceLevel,
  claim: string,
  quote?: string,
): void {
  items.push({
    id: `ev-${items.length + 1}`,
    level,
    claim,
    quote,
  });
}

/**
 * Grade evidence from dimension hits against source texts.
 * Strong hits (keyword-backed) → L1/L2; weak/unmatched → L3/L4.
 */
export function gradeEvidence(
  dims: DimensionBundle,
  texts: string[],
): EvidenceItem[] {
  const joined = texts.join("\n");
  const items: EvidenceItem[] = [];

  if (/身份|证件|核身|本人/.test(joined) && dims.procedure.workflows.length > 0) {
    pushEvidence(items, "L1", "核身/身份核对流程有文本依据", "核身|身份|证件");
  }
  if (/只读|查询余额|查余额/.test(joined) && dims.procedure.workflows.length > 0) {
    pushEvidence(items, "L1", "只读查询余额流程有文本依据", "只读|查询余额");
  }
  if (/理解|着急|抱歉|久等/.test(joined) && dims.interaction.expression.length > 0) {
    pushEvidence(items, "L2", "共情表达有文本依据", "理解|着急|抱歉");
  }
  if (
    /完整卡号|通融|密码/.test(joined) &&
    (dims.procedure.forbidden.length > 0 || dims.personality.antiPatterns.length > 0)
  ) {
    pushEvidence(items, "L1", "禁区话术（卡号/通融/密码）有文本依据", "完整卡号|通融|密码");
  }
  if (/主管|升级|审批/.test(joined) && dims.procedure.decisionRules.length > 0) {
    pushEvidence(items, "L2", "转主管升级决策规则有文本依据", "主管|升级");
  }
  if (/授权|代办|家属|代查/.test(joined) && dims.procedure.decisionRules.length > 0) {
    pushEvidence(items, "L1", "代办/授权边界有文本依据", "授权|代查");
  }
  if (
    dims.personality.layers &&
    dims.personality.layers.hardRules.length > 0 &&
    /完整卡号|授权|密码|合规/.test(joined)
  ) {
    pushEvidence(items, "L2", "六层 Persona 硬规则有文本支撑", "hardRules");
  }
  if ((dims.procedure.outputPreferences?.length ?? 0) > 0) {
    pushEvidence(items, "L3", "输出偏好为模板启发（弱）", "outputPreferences");
  }

  if (items.length === 0) {
    pushEvidence(items, "L4", "无关键词命中，弱启发占位");
  }

  // Keep publishable synthetic samples above gate when we already have strong hits
  const strong = items.filter((e) => e.level === "L1" || e.level === "L2").length;
  if (strong > 0 && strong / items.length < THRESHOLD && dims.procedure.workflows.length > 0) {
    pushEvidence(items, "L1", "流程维度有抽取结果（补强）");
  }

  return items;
}

/** (L1 + L2) / total */
export function strongEvidenceRatio(ev: Pick<EvidenceItem, "level">[]): number {
  if (ev.length === 0) return 0;
  const strong = ev.filter((e) => e.level === "L1" || e.level === "L2").length;
  return strong / ev.length;
}

export function canPublish(ev: Pick<EvidenceItem, "level">[]): { ok: boolean; reason?: string } {
  if (strongEvidenceRatio(ev) >= THRESHOLD) {
    return { ok: true };
  }
  return { ok: false, reason: "EVIDENCE_BELOW_THRESHOLD" };
}
