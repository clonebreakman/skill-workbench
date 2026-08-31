import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppStore } from "../store.js";
import type { DistillJob, PublishedSkill } from "../types.js";
import { canPublish } from "./evidence.js";
import { renderSkillMarkdown } from "./export-skill.js";

export async function markReviewed(job: DistillJob): Promise<DistillJob> {
  if (job.status !== "draft" && job.status !== "reviewed") {
    throw new Error("JOB_NOT_REVIEWABLE");
  }
  if (!job.draft) {
    throw new Error("DRAFT_MISSING");
  }
  return {
    ...job,
    status: "reviewed",
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function publishJob(
  store: AppStore,
  jobId: string,
): Promise<PublishedSkill> {
  const job = await store.getJob(jobId);
  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }
  if (job.status !== "reviewed" || !job.draft) {
    throw new Error("JOB_NOT_REVIEWED");
  }
  const gate = canPublish(job.draft.evidence);
  if (!gate.ok) {
    throw new Error(gate.reason);
  }

  const db = await store.load();
  const employee = db.employees.find((item) => item.id === job.employeeId);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  const latest = await store.getLatestSkill(job.employeeId);
  const version = (latest?.version ?? 0) + 1;
  const dirName = `${employee.slug}-v${version}`;
  const dirPath = join(store.skillsDir, dirName);
  await mkdir(dirPath, { recursive: true });

  const skill: PublishedSkill = {
    id: `SKL-${randomUUID().slice(0, 8)}`,
    employeeId: employee.id,
    version,
    slug: employee.slug,
    workSkill: job.draft.workSkill,
    persona: job.draft.persona,
    evidence: job.draft.evidence,
    publishedAt: new Date().toISOString(),
    synthetic: true,
    dirPath,
  };

  await writeFile(join(dirPath, "SKILL.md"), renderSkillMarkdown(skill, employee.name), "utf8");
  await writeFile(join(dirPath, "work-skill.json"), JSON.stringify(skill.workSkill, null, 2), "utf8");
  await writeFile(join(dirPath, "persona.json"), JSON.stringify(skill.persona, null, 2), "utf8");
  await writeFile(
    join(dirPath, "evidence.jsonl"),
    skill.evidence.map((item) => JSON.stringify(item)).join("\n") + "\n",
    "utf8",
  );
  await writeFile(
    join(dirPath, "meta.json"),
    JSON.stringify(
      {
        employeeId: skill.employeeId,
        version: skill.version,
        publishedAt: skill.publishedAt,
        synthetic: true,
      },
      null,
      2,
    ),
    "utf8",
  );

  await store.addSkill(skill);
  return skill;
}
