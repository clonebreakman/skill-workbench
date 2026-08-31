import { rm } from "node:fs/promises";
import type { AppStore } from "../store.js";
import type { PackageRecord } from "../types.js";
import { writeActivePointer } from "./active-pointer.js";

export type PruneResult = {
  kept: PackageRecord[];
  removed: PackageRecord[];
  deletedDirs: string[];
};

/** Per subject keep active + fill with highest versions up to keepPerSubject. */
export async function prunePackages(
  store: AppStore,
  options?: { keepPerSubject?: number; deleteFiles?: boolean },
): Promise<PruneResult> {
  const keepPerSubject = Math.max(1, options?.keepPerSubject ?? 2);
  const deleteFiles = options?.deleteFiles === true;
  const subjects = await store.listSubjects();
  const all = await store.listPackages();
  const bySubject = new Map<string, PackageRecord[]>();
  for (const pkg of all) {
    const list = bySubject.get(pkg.subjectId) ?? [];
    list.push(pkg);
    bySubject.set(pkg.subjectId, list);
  }

  const keepIds = new Set<string>();
  for (const subject of subjects) {
    const list = (bySubject.get(subject.id) ?? []).slice().sort((a, b) => b.version - a.version);
    if (list.length === 0) continue;
    const selected: PackageRecord[] = [];
    if (subject.activePackageId) {
      const active = list.find((p) => p.id === subject.activePackageId);
      if (active) selected.push(active);
    }
    for (const pkg of list) {
      if (selected.length >= keepPerSubject) break;
      if (selected.some((s) => s.id === pkg.id)) continue;
      selected.push(pkg);
    }
    if (selected.length === 0 && list[0]) selected.push(list[0]);
    for (const pkg of selected) keepIds.add(pkg.id);
  }

  const kept = all.filter((p) => keepIds.has(p.id));
  const removed = all.filter((p) => !keepIds.has(p.id));
  await store.removePackages(removed.map((p) => p.id));

  const deletedDirs: string[] = [];
  if (deleteFiles) {
    for (const pkg of removed) {
      for (const dir of [pkg.trainingSkillPath, pkg.openPersonaPath]) {
        try {
          await rm(dir, { recursive: true, force: true });
          deletedDirs.push(dir);
        } catch {
          /* ignore */
        }
      }
    }
  }

  for (const subject of subjects) {
    if (!subject.activePackageId) continue;
    const pkg = kept.find((p) => p.id === subject.activePackageId);
    if (pkg) await writeActivePointer(store, pkg);
  }

  return { kept, removed, deletedDirs };
}
