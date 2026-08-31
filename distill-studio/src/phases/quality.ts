import type { DimensionBundle } from "../types.js";

export interface DistillQuality {
  score: number;
  workCoverage: number;
  personaCoverage: number;
  notes: string[];
}

/** Heuristic quality score 0–100 for Distilly-style completeness. */
export function scoreDistillQuality(dims: DimensionBundle): DistillQuality {
  const notes: string[] = [];
  let work = 0;
  let persona = 0;

  if (dims.procedure.workflows.length >= 2) work += 30;
  else if (dims.procedure.workflows.length === 1) work += 15;
  else notes.push("流程步骤偏少");

  if (dims.procedure.decisionRules.length > 0) work += 20;
  else notes.push("缺少决策规则");

  if (dims.procedure.forbidden.length > 0) work += 20;
  else notes.push("缺少禁区");

  if ((dims.procedure.outputPreferences?.length ?? 0) > 0) work += 15;
  if ((dims.procedure.experienceNotes?.length ?? 0) > 0) work += 15;

  const layers = dims.personality.layers;
  if (layers?.hardRules?.length) persona += 20;
  else notes.push("缺少硬规则层");
  if (layers?.identity || dims.personality.identity) persona += 15;
  if ((layers?.expression?.length ?? 0) + dims.interaction.expression.length > 0) persona += 20;
  else notes.push("缺少表达层");
  if ((layers?.decisions?.length ?? 0) + dims.interaction.heuristics.length > 0) persona += 15;
  if (layers?.interpersonal || dims.interaction.interpersonal) persona += 15;
  if (dims.personality.antiPatterns.length > 0 || dims.personality.limits.length > 0) persona += 15;

  const score = Math.round(Math.min(100, work * 0.55 + persona * 0.45));
  if (notes.length === 0) notes.push("Work + 六层 Persona 覆盖良好");
  return {
    score,
    workCoverage: Math.min(100, work),
    personaCoverage: Math.min(100, persona),
    notes,
  };
}
