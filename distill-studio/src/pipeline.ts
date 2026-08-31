import { randomUUID } from "node:crypto";
import { evaluateEthics } from "./phases/ethics.js";
import { validateIntake } from "./phases/intake.js";
import { assertPublishableSensitivity } from "./phases/materials.js";
import { runExtract } from "./phases/extract.js";
import { canPublish, gradeEvidence } from "./phases/evidence.js";
import { exportPackages } from "./phases/export-packages.js";
import { activatePackage } from "./phases/evolve.js";
import type { AppStore } from "./store.js";
import type { DistillRun, Material, PackageRecord } from "./types.js";

function shortId(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

export async function runFullPipeline(
  store: AppStore,
  opts: { subjectId: string; materialIds: string[] },
): Promise<DistillRun> {
  const subject = await store.getSubject(opts.subjectId);
  if (!subject) {
    throw new Error("SUBJECT_NOT_FOUND");
  }

  const ethics = subject.ethics;
  if (!ethics) {
    throw new Error("ETHICS_BLOCKED");
  }
  const ethicsResult = evaluateEthics(ethics);
  if (!ethicsResult.ok) {
    throw new Error(ethicsResult.reason ?? "ETHICS_BLOCKED");
  }

  if (!subject.intake) {
    throw new Error("INTAKE_INCOMPLETE");
  }
  const intakeResult = validateIntake(subject.intake);
  if (!intakeResult.ok) {
    throw new Error(intakeResult.reason ?? "INTAKE_INCOMPLETE");
  }

  const db = await store.load();
  const texts: string[] = [];
  for (const materialId of opts.materialIds) {
    const material = db.materials.find((m: Material) => m.id === materialId);
    if (!material) {
      throw new Error("MATERIAL_NOT_FOUND");
    }
    const sens = assertPublishableSensitivity(material.sensitivity);
    if (!sens.ok) {
      throw new Error(sens.reason ?? "RAW_NOT_ALLOWED");
    }
    texts.push(await store.readMaterialContent(materialId));
  }

  const settings = db.settings;
  const { dimensions, adapterUsed } = await runExtract({
    adapter: settings.adapter,
    subjectName: subject.name,
    texts,
    llm: settings.llm,
  });
  const evidence = gradeEvidence(dimensions, texts);

  const now = new Date().toISOString();
  const run: DistillRun = {
    id: shortId("RUN-"),
    subjectId: subject.id,
    materialIds: [...opts.materialIds],
    phase: 5,
    dimensions,
    evidence,
    adapter: adapterUsed,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  await store.upsertRun(run);
  return run;
}

export async function publishRun(
  store: AppStore,
  runId: string,
): Promise<{ run: DistillRun; package: PackageRecord }> {
  const run = await store.getRun(runId);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }
  if (run.status !== "draft" && run.status !== "reviewed") {
    throw new Error("RUN_NOT_PUBLISHABLE");
  }
  if (!run.dimensions || !run.evidence) {
    throw new Error("RUN_INCOMPLETE");
  }

  const gate = canPublish(run.evidence);
  if (!gate.ok) {
    throw new Error(gate.reason ?? "EVIDENCE_BELOW_THRESHOLD");
  }

  const existing = await store.listPackages(run.subjectId);
  const maxVersion = existing.reduce(
    (max, p) => Math.max(max, p.version),
    0,
  );
  const version = maxVersion + 1;

  const { package: pkg } = await exportPackages(store, {
    subjectId: run.subjectId,
    version,
    dimensions: run.dimensions,
    evidence: run.evidence,
  });

  const published: DistillRun = {
    ...run,
    status: "published",
    phase: 6,
    updatedAt: new Date().toISOString(),
  };
  await store.upsertRun(published);
  const activated = await activatePackage(store, pkg.id);

  return { run: published, package: activated };
}
