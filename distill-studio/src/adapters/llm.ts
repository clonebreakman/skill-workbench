import type { DimensionBundle, WorkSkill, InteractionDimension, PersonalityDimension, MemoryDimension } from "../types.js";
import { mockExtract } from "./mock.js";

const SYSTEM = `你是 Distill Studio 的蒸馏引擎，对齐 Distilly colleague + anyone-skill。
从银行柜员等「known」对象的合成/脱敏材料中抽取：
1) Work Skill（procedure）
2) 六层 Persona（hardRules→identity→expression→decisions→interpersonal→corrections）
只依据给定材料，不要编造未出现的敏感事实。输出严格 JSON，不要 Markdown 围栏。`;

function buildUserPrompt(subjectName: string, texts: string[]): string {
  return `对象姓名：${subjectName}

材料：
---
${texts.join("\n\n").slice(0, 12000)}
---

请输出 JSON，结构如下（字段必须齐全，数组可为空）：
{
  "procedure": {
    "scope": "string",
    "workflows": ["string"],
    "decisionRules": ["string"],
    "forbidden": ["string"],
    "knowledgeRefs": ["string"],
    "outputPreferences": ["string"],
    "experienceNotes": ["string"]
  },
  "interaction": {
    "expression": ["string"],
    "heuristics": ["string"],
    "interpersonal": "string"
  },
  "memory": {
    "refs": ["string"],
    "notes": ["string"]
  },
  "personality": {
    "identity": "string",
    "antiPatterns": ["string"],
    "limits": ["string"],
    "layers": {
      "hardRules": ["string"],
      "identity": "string",
      "expression": ["string"],
      "decisions": ["string"],
      "interpersonal": "string",
      "corrections": ["string"]
    }
  }
}`;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter((s) => s.trim().length > 0);
}

/** Strip ```json fences and parse. */
export function parseLlmJsonContent(content: string): unknown {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  return JSON.parse(text);
}

/** Coerce LLM JSON into DimensionBundle; fill gaps from mock. */
export function normalizeDimensionBundle(
  raw: unknown,
  fallback: DimensionBundle,
): DimensionBundle {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const proc = (obj.procedure ?? {}) as Record<string, unknown>;
  const inter = (obj.interaction ?? {}) as Record<string, unknown>;
  const mem = (obj.memory ?? {}) as Record<string, unknown>;
  const pers = (obj.personality ?? {}) as Record<string, unknown>;
  const layersRaw = (pers.layers ?? {}) as Record<string, unknown>;

  const procedure: WorkSkill = {
    scope: String(proc.scope ?? fallback.procedure.scope),
    workflows: asStringArray(proc.workflows).length
      ? asStringArray(proc.workflows)
      : fallback.procedure.workflows,
    decisionRules: asStringArray(proc.decisionRules).length
      ? asStringArray(proc.decisionRules)
      : fallback.procedure.decisionRules,
    forbidden: asStringArray(proc.forbidden).length
      ? asStringArray(proc.forbidden)
      : fallback.procedure.forbidden,
    knowledgeRefs: asStringArray(proc.knowledgeRefs).length
      ? asStringArray(proc.knowledgeRefs)
      : fallback.procedure.knowledgeRefs,
    outputPreferences: asStringArray(proc.outputPreferences).length
      ? asStringArray(proc.outputPreferences)
      : fallback.procedure.outputPreferences,
    experienceNotes: asStringArray(proc.experienceNotes).length
      ? asStringArray(proc.experienceNotes)
      : fallback.procedure.experienceNotes,
  };

  const interaction: InteractionDimension = {
    expression: asStringArray(inter.expression).length
      ? asStringArray(inter.expression)
      : fallback.interaction.expression,
    heuristics: asStringArray(inter.heuristics).length
      ? asStringArray(inter.heuristics)
      : fallback.interaction.heuristics,
    interpersonal: String(inter.interpersonal || fallback.interaction.interpersonal),
  };

  const memory: MemoryDimension = {
    refs: asStringArray(mem.refs).length ? asStringArray(mem.refs) : fallback.memory.refs,
    notes: asStringArray(mem.notes).length ? asStringArray(mem.notes) : fallback.memory.notes,
  };

  const fbLayers = fallback.personality.layers!;
  const personality: PersonalityDimension = {
    identity: String(pers.identity || fallback.personality.identity),
    antiPatterns: asStringArray(pers.antiPatterns).length
      ? asStringArray(pers.antiPatterns)
      : fallback.personality.antiPatterns,
    limits: asStringArray(pers.limits).length
      ? asStringArray(pers.limits)
      : fallback.personality.limits,
    layers: {
      hardRules: asStringArray(layersRaw.hardRules).length
        ? asStringArray(layersRaw.hardRules)
        : fbLayers.hardRules,
      identity: String(layersRaw.identity || fbLayers.identity),
      expression: asStringArray(layersRaw.expression).length
        ? asStringArray(layersRaw.expression)
        : fbLayers.expression,
      decisions: asStringArray(layersRaw.decisions).length
        ? asStringArray(layersRaw.decisions)
        : fbLayers.decisions,
      interpersonal: String(layersRaw.interpersonal || fbLayers.interpersonal),
      corrections: asStringArray(layersRaw.corrections),
    },
  };

  return { procedure, interaction, memory, personality };
}

/**
 * OpenAI-compatible chat completions → DimensionBundle.
 * Throws on HTTP/parse failure (caller falls back to mock).
 */
export async function llmExtract(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  subjectName: string;
  texts: string[];
}): Promise<DimensionBundle> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const url = /\/v1$/.test(base)
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;

  const fallback = mockExtract({
    subjectName: opts.subjectName,
    texts: opts.texts,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildUserPrompt(opts.subjectName, opts.texts) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM empty content");
    }
    const parsed = parseLlmJsonContent(content);
    return normalizeDimensionBundle(parsed, fallback);
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight connectivity check against OpenAI-compatible /models or chat. */
export async function llmPing(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): Promise<{ ok: true; latencyMs: number; detail: string } | { ok: false; detail: string }> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const modelsUrl = /\/v1$/.test(base) ? `${base}/models` : `${base}/v1/models`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(modelsUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
      },
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}（${latencyMs}ms）` };
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((m) => m.id).filter(Boolean) as string[];
    const hasModel = !opts.model || ids.length === 0 || ids.includes(opts.model);
    return {
      ok: true,
      latencyMs,
      detail: hasModel
        ? `连通正常（${latencyMs}ms）${ids.length ? ` · 可见模型 ${ids.length} 个` : ""}`
        : `连通正常（${latencyMs}ms），但列表中未见 model=${opts.model}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.includes("abort") ? "超时（12s）" : msg };
  } finally {
    clearTimeout(timer);
  }
}
