import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AppStore } from "../store.js";
import type { PackageRecord } from "../types.js";

export type ActivePointerFile = {
  updatedAt: string;
  bySlug: Record<
    string,
    {
      dirName: string;
      version: number;
      packageId: string;
      subjectId: string;
      name?: string;
      trainingSkillPath: string;
    }
  >;
};

const POINTER_NAME = "active-pointer.json";

/** Persist Distill → Trainer handoff pointer under training-skill export root. */
export async function writeActivePointer(
  store: AppStore,
  pkg: PackageRecord,
): Promise<string> {
  const subject = await store.getSubject(pkg.subjectId);
  const root = join(store.exportsDir, "training-skill");
  await mkdir(root, { recursive: true });
  const path = join(root, POINTER_NAME);

  let current: ActivePointerFile = { updatedAt: "", bySlug: {} };
  try {
    current = JSON.parse(await readFile(path, "utf8")) as ActivePointerFile;
    if (!current.bySlug) current.bySlug = {};
  } catch {
    /* fresh */
  }

  const slug = pkg.slug || subject?.slug || basename(pkg.trainingSkillPath);
  current.updatedAt = new Date().toISOString();
  current.bySlug[slug] = {
    dirName: basename(pkg.trainingSkillPath),
    version: pkg.version,
    packageId: pkg.id,
    subjectId: pkg.subjectId,
    name: pkg.subjectName ?? subject?.name,
    trainingSkillPath: pkg.trainingSkillPath,
  };

  await writeFile(path, JSON.stringify(current, null, 2), "utf8");
  return path;
}

export function activePointerPath(exportsDir: string): string {
  return join(exportsDir, "training-skill", POINTER_NAME);
}
