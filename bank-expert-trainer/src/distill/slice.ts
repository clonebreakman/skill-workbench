import { randomUUID } from "node:crypto";
import type { TextChunk } from "../types.js";

export function sliceText(options: {
  materialId: string;
  employeeId: string;
  text: string;
}): TextChunk[] {
  const blocks = options.text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    throw new Error("EMPTY_MATERIAL");
  }

  return blocks.map((text, index) => ({
    id: `CHK-${randomUUID().slice(0, 8)}`,
    materialId: options.materialId,
    employeeId: options.employeeId,
    text,
    index,
  }));
}
