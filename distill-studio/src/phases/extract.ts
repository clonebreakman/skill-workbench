import { llmExtract } from "../adapters/llm.js";
import { mockExtract } from "../adapters/mock.js";
import type { AdapterKind, DimensionBundle } from "../types.js";

export async function runExtract(opts: {
  adapter: AdapterKind;
  subjectName: string;
  texts: string[];
  llm?: { baseUrl: string; apiKey: string; model: string };
}): Promise<{ dimensions: DimensionBundle; adapterUsed: AdapterKind }> {
  if (opts.adapter === "mock") {
    return {
      dimensions: mockExtract({
        subjectName: opts.subjectName,
        texts: opts.texts,
      }),
      adapterUsed: "mock",
    };
  }

  try {
    if (!opts.llm?.baseUrl || !opts.llm?.apiKey) {
      throw new Error("LLM settings required");
    }
    const dimensions = await llmExtract({
      ...opts.llm,
      subjectName: opts.subjectName,
      texts: opts.texts,
    });
    if (!dimensions.procedure?.workflows || !Array.isArray(dimensions.procedure.workflows)) {
      throw new Error("LLM response not a DimensionBundle");
    }
    return { dimensions, adapterUsed: "llm" };
  } catch {
    return {
      dimensions: mockExtract({
        subjectName: opts.subjectName,
        texts: opts.texts,
      }),
      adapterUsed: "mock",
    };
  }
}
