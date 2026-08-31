import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { activePointerPath } from "../src/phases/active-pointer.js";
import { publishRun, runFullPipeline } from "../src/pipeline.js";
import { rollbackPackage } from "../src/phases/evolve.js";

const SAMPLE = `理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。`;

describe("active-pointer", () => {
  it(
    "writes active-pointer.json on publish and updates on rollback",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "ds-ptr-"));
      const store = new AppStore(dir);
      await store.init();
      const subject = await store.createSubject({
        slug: "ptr-wang",
        name: "王敏指针",
        type: "known",
        profile: { title: "柜员" },
      });
      await store.updateSubject(subject.id, {
        ethics: {
          consent: true,
          purposeOk: true,
          noRawPiiClaim: true,
          checkedAt: new Date().toISOString(),
        },
        intake: { purpose: "培训", scope: "查询", taboo: "卡号" },
      });
      const mat = await store.addMaterial({
        subjectId: subject.id,
        kind: "script",
        title: "样本",
        sensitivity: "synthetic",
        fileName: "a.md",
        content: SAMPLE,
      });
      const draft = await runFullPipeline(store, {
        subjectId: subject.id,
        materialIds: [mat.id],
      });
      const { package: pkg } = await publishRun(store, draft.id);
      const pointerFile = activePointerPath(store.exportsDir);
      const raw = JSON.parse(await readFile(pointerFile, "utf8")) as {
        bySlug: Record<string, { version: number; dirName: string }>;
      };
      expect(raw.bySlug["ptr-wang"]?.version).toBe(1);
      expect(raw.bySlug["ptr-wang"]?.dirName).toContain("v1");

      // create v2 via second publish path: bump by re-export through rollback stays v1
      await rollbackPackage(store, subject.id, 1);
      const after = JSON.parse(await readFile(pointerFile, "utf8")) as {
        bySlug: Record<string, { packageId: string; version: number }>;
      };
      expect(after.bySlug["ptr-wang"]?.packageId).toBe(pkg.id);
      expect(after.bySlug["ptr-wang"]?.version).toBe(1);
    },
    30_000,
  );
});
