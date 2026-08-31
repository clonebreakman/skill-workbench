import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { classifySubject } from "./phases/classify.js";
import type { AppStore } from "./store.js";
import type { PackageRecord, Subject } from "./types.js";
import { publishRun, runFullPipeline } from "./pipeline.js";

export async function seedDemoTeller(
  store: AppStore,
  options?: { publish?: boolean; samplesDir?: string },
): Promise<{
  subject: Subject;
  materialId: string;
  runId: string;
  package?: PackageRecord;
}> {
  const classified = classifySubject({ hint: "银行柜员优秀员工" });
  const slug = `wang-min-demo-${Date.now().toString(36).slice(-4)}`;
  const subject = await store.createSubject({
    slug,
    name: "王敏（演示）",
    type: classified.type,
    profile: { title: "柜员", org: "演示支行", tags: classified.tags },
  });
  await store.updateSubject(subject.id, {
    tags: classified.tags,
    ethics: {
      consent: true,
      purposeOk: true,
      noRawPiiClaim: true,
      checkedAt: new Date().toISOString(),
    },
    intake: {
      purpose: "柜员培训对练",
      scope: "查余额、代查、投诉安抚",
      taboo: "不报完整卡号、不通融代查、不索要密码",
    },
  });

  const samplesDir = options?.samplesDir;
  let content =
    "理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。家属代查须授权。抱歉久等。";
  if (samplesDir) {
    try {
      content = await readFile(join(samplesDir, "teller-wang-synthetic.md"), "utf8");
    } catch {
      /* use fallback */
    }
  }

  const material = await store.addMaterial({
    subjectId: subject.id,
    kind: "script",
    title: "王敏合成样本",
    sensitivity: "synthetic",
    fileName: "teller-wang-synthetic.md",
    content,
  });

  const run = await runFullPipeline(store, {
    subjectId: subject.id,
    materialIds: [material.id],
  });

  let pkg: PackageRecord | undefined;
  if (options?.publish !== false) {
    const published = await publishRun(store, run.id);
    pkg = published.package;
  }

  const refreshed = (await store.getSubject(subject.id))!;
  return {
    subject: refreshed,
    materialId: material.id,
    runId: run.id,
    package: pkg,
  };
}
