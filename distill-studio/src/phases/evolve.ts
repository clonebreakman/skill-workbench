import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exportPackages } from "./export-packages.js";
import { writeActivePointer } from "./active-pointer.js";
import type { AppStore } from "../store.js";
import type {
  Correction,
  DimensionBundle,
  EvidenceItem,
  PackageRecord,
  Persona,
  WorkSkill,
} from "../types.js";

function shortId(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

export async function applyCorrection(
  store: AppStore,
  opts: { packageId: string; scene: string; wrong: string; right: string },
): Promise<Correction> {
  const pkg = await store.getPackage(opts.packageId);
  if (!pkg) {
    throw new Error("PACKAGE_NOT_FOUND");
  }
  const correction: Correction = {
    id: shortId("COR-"),
    packageId: opts.packageId,
    scene: opts.scene,
    wrong: opts.wrong,
    right: opts.right,
    at: new Date().toISOString(),
  };
  await store.addCorrection(correction);
  return correction;
}

/** Rebuild DimensionBundle + evidence from an on-disk training-skill export. */
export async function loadBundleFromTrainingSkill(
  trainingSkillPath: string,
): Promise<{ dimensions: DimensionBundle; evidence: EvidenceItem[] }> {
  const workSkill = JSON.parse(
    await readFile(join(trainingSkillPath, "work-skill.json"), "utf8"),
  ) as WorkSkill;
  const persona = JSON.parse(
    await readFile(join(trainingSkillPath, "persona.json"), "utf8"),
  ) as Persona;
  const dimensions: DimensionBundle = {
    procedure: workSkill,
    interaction: {
      expression: persona.expression,
      heuristics: persona.heuristics,
      interpersonal: persona.interpersonal,
    },
    memory: { refs: workSkill.knowledgeRefs },
    personality: {
      identity: persona.identity,
      antiPatterns: persona.antiPatterns,
      limits: persona.limits,
      layers: persona.layers,
    },
  };
  let evidence: EvidenceItem[] = [];
  try {
    const lines = (await readFile(join(trainingSkillPath, "evidence.jsonl"), "utf8"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    evidence = lines.map((line, i) => {
      const row = JSON.parse(line) as EvidenceItem;
      return {
        id: row.id ?? `EV-${i}`,
        level: row.level,
        claim: row.claim,
        quote: row.quote,
        sourceRef: row.sourceRef,
        chunkId: row.chunkId,
      };
    });
  } catch {
    evidence = [{ id: "EV-fallback", level: "L2", claim: "imported package baseline" }];
  }
  return { dimensions, evidence };
}

function mergeCorrectionIntoDimensions(
  dimensions: DimensionBundle,
  right: string,
): DimensionBundle {
  return {
    ...dimensions,
    personality: {
      ...dimensions.personality,
      antiPatterns: [...dimensions.personality.antiPatterns, right],
    },
    interaction: {
      ...dimensions.interaction,
      expression: [...dimensions.interaction.expression, right],
    },
  };
}

export async function republishWithCorrection(
  store: AppStore,
  opts: {
    subjectId: string;
    packageId: string;
    scene: string;
    wrong: string;
    right: string;
    dimensions: DimensionBundle;
    evidence: EvidenceItem[];
  },
): Promise<PackageRecord> {
  await applyCorrection(store, {
    packageId: opts.packageId,
    scene: opts.scene,
    wrong: opts.wrong,
    right: opts.right,
  });

  const merged = mergeCorrectionIntoDimensions(opts.dimensions, opts.right);
  const existing = await store.listPackages(opts.subjectId);
  const maxVersion = existing.reduce(
    (max, p) => Math.max(max, p.version),
    0,
  );
  const version = maxVersion + 1;

  const { package: pkg } = await exportPackages(store, {
    subjectId: opts.subjectId,
    version,
    dimensions: merged,
    evidence: opts.evidence,
  });
  return activatePackage(store, pkg.id);
}

/** Correct then republish from the package's training-skill files on disk. */
export async function correctAndRepublish(
  store: AppStore,
  opts: { packageId: string; scene: string; wrong: string; right: string },
): Promise<{ correction: Correction; package: PackageRecord }> {
  const pkg = await store.getPackage(opts.packageId);
  if (!pkg) {
    throw new Error("PACKAGE_NOT_FOUND");
  }
  const { dimensions, evidence } = await loadBundleFromTrainingSkill(pkg.trainingSkillPath);
  const next = await republishWithCorrection(store, {
    subjectId: pkg.subjectId,
    packageId: opts.packageId,
    scene: opts.scene,
    wrong: opts.wrong,
    right: opts.right,
    dimensions,
    evidence,
  });
  const corrections = await store.listCorrections(opts.packageId);
  const correction = corrections.at(-1)!;
  return { correction, package: next };
}

/** Activate a prior package version for the subject (pointer rollback). */
export async function rollbackPackage(
  store: AppStore,
  subjectId: string,
  version: number,
): Promise<PackageRecord> {
  const pkgs = await store.listPackages(subjectId);
  const found = pkgs.find((p) => p.version === version);
  if (!found) {
    throw new Error("PACKAGE_VERSION_NOT_FOUND");
  }
  return activatePackage(store, found.id);
}

/** Mark package as the subject's active export pointer (+ filesystem handoff). */
export async function activatePackage(
  store: AppStore,
  packageId: string,
): Promise<PackageRecord> {
  const pkg = await store.getPackage(packageId);
  if (!pkg) {
    throw new Error("PACKAGE_NOT_FOUND");
  }
  await store.updateSubject(pkg.subjectId, {
    activePackageId: pkg.id,
    status: "published",
  });
  await writeActivePointer(store, pkg);
  return pkg;
}
