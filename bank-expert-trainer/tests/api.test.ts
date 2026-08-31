import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";
import { startServer } from "../src/server.js";

const handles: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  while (handles.length) {
    await handles.pop()?.close();
  }
});

describe("API", () => {
  it("supports employee → material → distill → review → publish → export", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bet-api-"));
    const store = new AppStore(dir);
    await store.init();
    const handle = await startServer({ store, port: 0 });
    handles.push(handle);

    const health = await fetch(`${handle.url}/health`);
    expect(await health.json()).toEqual({ ok: true, syntheticOnly: true });

    const empRes = await fetch(`${handle.url}/api/employees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "王敏", title: "柜员", branch: "演示支行", slug: "wang-min" }),
    });
    const emp = (await empRes.json()) as { employee: { id: string } };
    expect(empRes.status).toBe(200);

    const matRes = await fetch(`${handle.url}/api/materials`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId: emp.employee.id,
        kind: "script",
        title: "话术",
        sensitivity: "synthetic",
        content: "柜员：先核对身份。\n\n柜员：再查询余额。\n\n柜员：转账转主管。",
      }),
    });
    const mat = (await matRes.json()) as { material: { id: string } };
    expect(matRes.status).toBe(200);

    const jobRes = await fetch(`${handle.url}/api/distill/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId: emp.employee.id,
        materialIds: [mat.material.id],
      }),
    });
    const jobBody = (await jobRes.json()) as { job: { id: string; status: string } };
    expect(jobBody.job.status).toBe("draft");

    await fetch(`${handle.url}/api/distill/jobs/${jobBody.job.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const pub = await fetch(`${handle.url}/api/skills/${emp.employee.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: jobBody.job.id }),
    });
    const pubBody = (await pub.json()) as { skill: { id: string } };
    expect(pub.status).toBe(200);

    const exp = await fetch(`${handle.url}/api/skills/${pubBody.skill.id}/export`);
    const expBody = (await exp.json()) as { skillMarkdown: string };
    expect(expBody.skillMarkdown).toContain("name:");
  });
});
