import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { startServer } from "../src/server.js";

describe("Distill Studio API", () => {
  let url = "";
  let close: (() => Promise<void>) | undefined;

  it(
    "supports subject → ethics → intake → material → run → publish",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "ds-api-"));
      const store = new AppStore(dir);
      await store.init();
      const handle = await startServer({ store, port: 0 });
      url = handle.url;
      close = handle.close;

      const health = await fetch(`${url}/health`).then((r) => r.json());
      expect(health.ok).toBe(true);

      const subRes = await fetch(`${url}/api/subjects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "wang-min-api",
          name: "王敏",
          hint: "银行柜员优秀员工",
          profile: { title: "柜员", org: "演示支行" },
        }),
      });
      const subBody = (await subRes.json()) as { subject: { id: string; type: string } };
      expect(subRes.status).toBe(200);
      expect(subBody.subject.type).toBe("known");
      const subjectId = subBody.subject.id;

      await fetch(`${url}/api/subjects/${subjectId}/ethics`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent: true, purposeOk: true, noRawPiiClaim: true }),
      });

      await fetch(`${url}/api/subjects/${subjectId}/intake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "培训",
          scope: "柜面话术",
          taboo: "不报完整卡号",
        }),
      });

      const matRes = await fetch(`${url}/api/materials`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectId,
          kind: "script",
          title: "话术",
          sensitivity: "synthetic",
          fileName: "api.md",
          content: "理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。",
        }),
      });
      const matBody = (await matRes.json()) as { material: { id: string } };
      expect(matRes.status).toBe(200);

      const matPreview = (await fetch(`${url}/api/materials/${matBody.material.id}`).then((r) =>
        r.json(),
      )) as { content: string; ok: boolean };
      expect(matPreview.ok).toBe(true);
      expect(matPreview.content).toContain("核对身份");

      const runRes = await fetch(`${url}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId, materialIds: [matBody.material.id] }),
      });
      const runBody = (await runRes.json()) as { run: { id: string; status: string } };
      expect(runRes.status).toBe(200);
      expect(runBody.run.status).toBe("draft");

      const pubRes = await fetch(`${url}/api/runs/${runBody.run.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const pubBody = (await pubRes.json()) as {
        package: { id: string; version: number; qualityScore?: number };
      };
      expect(pubRes.status).toBe(200);
      expect(pubBody.package.version).toBe(1);
      expect(typeof pubBody.package.qualityScore).toBe("number");

      const preview = (await fetch(
        `${url}/api/packages/${pubBody.package.id}/preview`,
      ).then((r) => r.json())) as { skillMarkdown: string; ok: boolean };
      expect(preview.ok).toBe(true);
      expect(preview.skillMarkdown).toContain("PART A");

      const dl = await fetch(`${url}/api/packages/${pubBody.package.id}/download`);
      expect(dl.status).toBe(200);
      expect(dl.headers.get("content-type")).toMatch(/zip/);
      const buf = Buffer.from(await dl.arrayBuffer());
      expect(buf.length).toBeGreaterThan(32);
      expect(buf[0]).toBe(0x50); // 'P' of PK zip magic
      expect(buf[1]).toBe(0x4b);

      const pkgs = (await fetch(`${url}/api/packages`).then((r) => r.json())) as {
        packages: unknown[];
      };
      expect(pkgs.packages.length).toBeGreaterThanOrEqual(1);

      const settings = (await fetch(`${url}/api/settings`).then((r) => r.json())) as {
        settings: { adapter: string };
      };
      expect(settings.settings.adapter).toBe("mock");

      const put = await fetch(`${url}/api/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adapter: "mock" }),
      });
      expect(put.status).toBe(200);

      const corrPkgId = (
        (await fetch(`${url}/api/packages`).then((r) => r.json())) as {
          packages: { id: string }[];
        }
      ).packages[0]!.id;
      const corr = await fetch(`${url}/api/packages/${corrPkgId}/corrections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scene: "代查",
          wrong: "通融",
          right: "必须本人或授权",
        }),
      });
      expect(corr.status).toBe(200);
    },
    60_000,
  );

  afterAll(async () => {
    if (close) await close();
  });
});
