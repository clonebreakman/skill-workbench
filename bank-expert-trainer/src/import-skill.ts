import { cp, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppStore } from "./store.js";
import type { EvidenceItem, Persona, PublishedSkill, WorkSkill } from "./types.js";

export async function importTrainingSkill(
  store: AppStore,
  dirPath: string,
): Promise<PublishedSkill> {
  const metaRaw = (await readFile(join(dirPath, "meta.json"), "utf8")).replace(/^\uFEFF/, "");
  const meta = JSON.parse(metaRaw) as {
    source?: string;
    slug?: string;
    version?: number;
    subjectId?: string;
    synthetic?: boolean;
    packageId?: string;
  };
  if (meta.source && meta.source !== "distill-studio") {
    throw new Error("UNSUPPORTED_SKILL_SOURCE");
  }

  await readFile(join(dirPath, "SKILL.md"), "utf8");
  const workSkill = JSON.parse(await readFile(join(dirPath, "work-skill.json"), "utf8")) as WorkSkill;
  const persona = JSON.parse(await readFile(join(dirPath, "persona.json"), "utf8")) as Persona;
  let evidence: EvidenceItem[] = [];
  try {
    const lines = (await readFile(join(dirPath, "evidence.jsonl"), "utf8"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    evidence = lines.map((line) => {
      const row = JSON.parse(line) as {
        id?: string;
        level: EvidenceItem["level"];
        claim: string;
        quote?: string;
        chunkId?: string;
      };
      return {
        id: row.id ?? `EV-${randomUUID().slice(0, 8)}`,
        chunkId: row.chunkId ?? "imported",
        level: row.level,
        claim: row.claim,
        quote: row.quote ?? "",
      };
    });
  } catch {
    evidence = [];
  }

  const slug = meta.slug ?? "imported-skill";
  const version = Number(meta.version ?? 1);
  const employeeId = meta.subjectId ?? `IMP-${randomUUID().slice(0, 8)}`;
  const targetDir = join(store.skillsDir, `${slug}-v${version}`);
  await mkdir(targetDir, { recursive: true });
  await cp(dirPath, targetDir, { recursive: true });

  const skill: PublishedSkill = {
    id: `SKL-${randomUUID().slice(0, 8)}`,
    employeeId,
    version,
    slug,
    workSkill,
    persona,
    evidence,
    publishedAt: new Date().toISOString(),
    synthetic: true,
    dirPath: targetDir,
    sourcePackageId: meta.packageId,
  };
  await store.addSkill(skill);
  return skill;
}
