import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { runFullPipeline } from "../src/pipeline.js";

const SAMPLE = `理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。`;

async function readySubject(store: AppStore) {
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
  return subject;
}

describe("runFullPipeline", () => {
  it("throws ETHICS_BLOCKED when ethics fail", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-pipe-"));
    const store = new AppStore(dir);
    await store.init();
    const subject = await store.createSubject({
      slug: "wang-min",
      name: "王敏",
      type: "known",
      profile: {},
    });
    await store.updateSubject(subject.id, {
      ethics: {
        consent: false,
        purposeOk: true,
        noRawPiiClaim: true,
      },
      intake: {
        purpose: "培训",
        scope: "话术",
        taboo: "不报完整卡号",
      },
    });
    const mat = await store.addMaterial({
      subjectId: subject.id,
      kind: "script",
      title: "样本",
      sensitivity: "synthetic",
      fileName: "a.md",
      content: SAMPLE,
    });

    await expect(
      runFullPipeline(store, {
        subjectId: subject.id,
        materialIds: [mat.id],
      }),
    ).rejects.toThrow(/ETHICS_BLOCKED|CONSENT_REQUIRED/);
  });

  it("happy path yields draft run with dimensions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-pipe-"));
    const store = new AppStore(dir);
    await store.init();
    const subject = await readySubject(store);
    const mat = await store.addMaterial({
      subjectId: subject.id,
      kind: "script",
      title: "样本",
      sensitivity: "synthetic",
      fileName: "sample.md",
      content: SAMPLE,
    });

    const run = await runFullPipeline(store, {
      subjectId: subject.id,
      materialIds: [mat.id],
    });

    expect(run.status).toBe("draft");
    expect(run.dimensions).toBeDefined();
    expect(run.dimensions!.procedure.workflows.length).toBeGreaterThan(0);
    expect(run.evidence?.length).toBeGreaterThan(0);
    expect(run.adapter).toBe("mock");
  });
});
