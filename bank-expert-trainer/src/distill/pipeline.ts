import { randomUUID } from "node:crypto";
import type { AppStore } from "../store.js";
import type { DistillJob } from "../types.js";
import { mockExtract } from "./mock-extractor.js";
import { sliceText } from "./slice.js";

export async function runDistillJob(
  store: AppStore,
  input: { employeeId: string; materialIds: string[] },
): Promise<DistillJob> {
  const now = new Date().toISOString();
  const job: DistillJob = {
    id: `JOB-${randomUUID().slice(0, 8)}`,
    employeeId: input.employeeId,
    materialIds: input.materialIds,
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
  await store.upsertJob(job);

  try {
    if (input.materialIds.length === 0) {
      throw new Error("NO_MATERIALS");
    }
    const db = await store.load();
    const materials = db.materials.filter(
      (material) =>
        material.employeeId === input.employeeId &&
        input.materialIds.includes(material.id),
    );
    if (materials.length !== input.materialIds.length) {
      throw new Error("MATERIAL_NOT_FOUND");
    }

    const chunks = [];
    for (const material of materials) {
      const content = await store.readMaterialContent(material);
      chunks.push(
        ...sliceText({
          materialId: material.id,
          employeeId: input.employeeId,
          text: content,
        }),
      );
    }

    const draft = mockExtract(chunks);
    job.status = "draft";
    job.draft = draft;
    job.updatedAt = new Date().toISOString();
    await store.upsertJob(job);
    return job;
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "DISTILL_FAILED";
    job.updatedAt = new Date().toISOString();
    await store.upsertJob(job);
    return job;
  }
}
