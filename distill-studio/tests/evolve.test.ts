import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import {
  republishWithCorrection,
  rollbackPackage,
} from "../src/phases/evolve.js";
import { publishRun, runFullPipeline } from "../src/pipeline.js";

const SAMPLE = `理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。`;

describe("evolve corrections and rollback", () => {
  it(
    "applies correction and bumps version on re-export; rollback to v1",
    async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-evolve-"));
    const store = new AppStore(dir);
    await store.init();

    const subject = await store.createSubject({
      slug: "wang-min",
      name: "王敏",
      type: "known",
      profile: { title: "柜员", org: "演示支行" },
    });
    await store.updateSubject(subject.id, {
      ethics: {
        consent: true,
        purposeOk: true,
        noRawPiiClaim: true,
        checkedAt: new Date().toISOString(),
      },
      intake: {
        purpose: "培训话术蒸馏",
        scope: "柜面查询",
        taboo: "不报完整卡号",
      },
    });
    const mat = await store.addMaterial({
      subjectId: subject.id,
      kind: "script",
      title: "合成样本",
      sensitivity: "synthetic",
      fileName: "teller.md",
      content: SAMPLE,
    });

    const draft = await runFullPipeline(store, {
      subjectId: subject.id,
      materialIds: [mat.id],
    });
    expect(draft.status).toBe("draft");

    const { run: published, package: pkg } = await publishRun(store, draft.id);
    expect(published.status).toBe("published");
    expect(pkg.version).toBe(1);

    const v2 = await republishWithCorrection(store, {
      subjectId: subject.id,
      packageId: pkg.id,
      scene: "客户要完整卡号",
      wrong: "可以通融报一下",
      right: "始终拒绝口头报完整卡号",
      dimensions: draft.dimensions!,
      evidence: draft.evidence!,
    });
    expect(v2.version).toBe(2);

    const corrections = await store.listCorrections(pkg.id);
    expect(corrections.length).toBe(1);

    const rolled = await rollbackPackage(store, subject.id, 1);
    expect(rolled.version).toBe(1);
    expect(rolled.id).toBe(pkg.id);
    const subjectAfter = await store.getSubject(subject.id);
    expect(subjectAfter?.activePackageId).toBe(pkg.id);
  },
  30_000,
  );
});
