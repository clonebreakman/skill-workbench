import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { prunePackages } from "../src/phases/prune-packages.js";
import type { PackageRecord } from "../src/types.js";

async function addPkg(
  store: AppStore,
  subjectId: string,
  version: number,
): Promise<PackageRecord> {
  const pkg: PackageRecord = {
    id: `PKG-v${version}-${subjectId.slice(-4)}`,
    subjectId,
    version,
    openPersonaPath: join(store.exportsDir, "openpersona", `s-v${version}`),
    trainingSkillPath: join(store.exportsDir, "training-skill", `s-v${version}`),
    publishedAt: new Date().toISOString(),
    synthetic: true,
    slug: "s",
  };
  await store.addPackage(pkg);
  return pkg;
}

describe("prunePackages", () => {
  it("keeps active plus latest versions up to keepPerSubject", async () => {
    const root = await mkdtemp(join(tmpdir(), "ds-prune-"));
    const store = new AppStore(root);
    await store.init();
    const subject = await store.createSubject({
      slug: "prune-demo",
      name: "清理",
      type: "known",
      profile: {},
    });
    const v1 = await addPkg(store, subject.id, 1);
    await addPkg(store, subject.id, 2);
    const v3 = await addPkg(store, subject.id, 3);
    await store.updateSubject(subject.id, { activePackageId: v1.id });

    const result = await prunePackages(store, { keepPerSubject: 2, deleteFiles: false });
    expect(result.removed.length).toBe(1);
    const left = await store.listPackages(subject.id);
    expect(left.map((p) => p.version).sort()).toEqual([1, 3]);
    expect(left.some((p) => p.id === v1.id)).toBe(true);
    expect(left.some((p) => p.id === v3.id)).toBe(true);
  });
});
