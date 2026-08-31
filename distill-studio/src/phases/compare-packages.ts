import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppStore } from "../store.js";
import type { PackageRecord, Persona, WorkSkill } from "../types.js";

export type PackageDiff = {
  a: PackageRecord;
  b: PackageRecord;
  summary: string[];
  work: {
    addedWorkflows: string[];
    removedWorkflows: string[];
    addedForbidden: string[];
    removedForbidden: string[];
    addedRules: string[];
    removedRules: string[];
  };
  persona: {
    identityChanged: boolean;
    addedAntiPatterns: string[];
    removedAntiPatterns: string[];
    addedExpression: string[];
    removedExpression: string[];
  };
};

function setDiff(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((x) => !b.has(x)),
    removed: before.filter((x) => !a.has(x)),
  };
}

async function loadWorkPersona(dir: string): Promise<{ work: WorkSkill; persona: Persona }> {
  const work = JSON.parse(await readFile(join(dir, "work-skill.json"), "utf8")) as WorkSkill;
  const persona = JSON.parse(await readFile(join(dir, "persona.json"), "utf8")) as Persona;
  return { work, persona };
}

export async function comparePackages(
  store: AppStore,
  packageIdA: string,
  packageIdB: string,
): Promise<PackageDiff> {
  const a = await store.getPackage(packageIdA);
  const b = await store.getPackage(packageIdB);
  if (!a || !b) {
    throw new Error("PACKAGE_NOT_FOUND");
  }
  if (a.subjectId !== b.subjectId) {
    throw new Error("PACKAGE_SUBJECT_MISMATCH");
  }

  const left = await loadWorkPersona(a.trainingSkillPath);
  const right = await loadWorkPersona(b.trainingSkillPath);

  const workflows = setDiff(left.work.workflows, right.work.workflows);
  const forbidden = setDiff(left.work.forbidden, right.work.forbidden);
  const rules = setDiff(left.work.decisionRules, right.work.decisionRules);
  const anti = setDiff(left.persona.antiPatterns, right.persona.antiPatterns);
  const expr = setDiff(left.persona.expression, right.persona.expression);
  const identityChanged = left.persona.identity !== right.persona.identity;

  const summary: string[] = [];
  if (a.version !== b.version) summary.push(`版本 ${a.version} → ${b.version}`);
  if (identityChanged) summary.push("身份描述有变化");
  if (workflows.added.length || workflows.removed.length) {
    summary.push(`流程 ±${workflows.added.length + workflows.removed.length}`);
  }
  if (forbidden.added.length || forbidden.removed.length) {
    summary.push(`禁区 ±${forbidden.added.length + forbidden.removed.length}`);
  }
  if (anti.added.length || anti.removed.length) {
    summary.push(`反模式 ±${anti.added.length + anti.removed.length}`);
  }
  if (summary.length === 0) summary.push("Work / Persona 关键字段无明显差异");

  return {
    a,
    b,
    summary,
    work: {
      addedWorkflows: workflows.added,
      removedWorkflows: workflows.removed,
      addedForbidden: forbidden.added,
      removedForbidden: forbidden.removed,
      addedRules: rules.added,
      removedRules: rules.removed,
    },
    persona: {
      identityChanged,
      addedAntiPatterns: anti.added,
      removedAntiPatterns: anti.removed,
      addedExpression: expr.added,
      removedExpression: expr.removed,
    },
  };
}
