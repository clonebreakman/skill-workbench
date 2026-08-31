/**
 * Offline material normalizers (Distilly-style parsers without live Feishu API).
 */

export type NormalizedMaterial = {
  title: string;
  fileName: string;
  content: string;
  kind: "transcript" | "script" | "case" | "policy" | "other";
};

/** Detect and parse pasted Feishu/Lark message export JSON or plain text. */
export function normalizeImportPayload(raw: string, titleHint = "导入素材"): NormalizedMaterial {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("EMPTY_IMPORT");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const fromFeishu = tryParseFeishuExport(parsed, titleHint);
      if (fromFeishu) return fromFeishu;
    } catch {
      // fall through to plain text
    }
  }

  return {
    title: titleHint,
    fileName: sanitizeFileName(`${titleHint}.md`),
    content: trimmed,
    kind: "script",
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-").slice(0, 80);
}

/**
 * Accepts common shapes:
 * - { data: { items: [{ sender_name, body: { content } }] } }
 * - { items: [...] }
 * - [ { sender_name / name / from, content / text / body } ]
 */
export function tryParseFeishuExport(
  parsed: unknown,
  titleHint: string,
): NormalizedMaterial | null {
  const items = extractMessageItems(parsed);
  if (!items || items.length === 0) return null;

  const lines: string[] = ["# 飞书/聊天导出（离线解析）", ""];
  for (const item of items) {
    const speaker = item.speaker || "未知";
    const text = item.text.trim();
    if (!text) continue;
    lines.push(`${speaker}：${text}`);
    lines.push("");
  }
  if (lines.length <= 2) return null;

  return {
    title: `${titleHint}（飞书导出）`,
    fileName: sanitizeFileName(`${titleHint}-feishu.md`),
    content: lines.join("\n"),
    kind: "transcript",
  };
}

function extractMessageItems(
  parsed: unknown,
): Array<{ speaker: string; text: string }> | null {
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeOneMessage).filter(Boolean) as Array<{
      speaker: string;
      text: string;
    }>;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const candidates =
    (root.items as unknown) ??
    (root.messages as unknown) ??
    ((root.data as Record<string, unknown> | undefined)?.items as unknown) ??
    ((root.data as Record<string, unknown> | undefined)?.messages as unknown);

  if (!Array.isArray(candidates)) return null;
  return candidates.map(normalizeOneMessage).filter(Boolean) as Array<{
    speaker: string;
    text: string;
  }>;
}

function normalizeOneMessage(raw: unknown): { speaker: string; text: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const speaker = String(
    m.sender_name ?? m.name ?? m.from ?? m.sender ?? m.user_name ?? "未知",
  );
  let text = "";
  if (typeof m.content === "string") text = m.content;
  else if (typeof m.text === "string") text = m.text;
  else if (m.body && typeof m.body === "object") {
    const body = m.body as Record<string, unknown>;
    text = String(body.content ?? body.text ?? "");
  } else if (typeof m.msg_content === "string") {
    text = m.msg_content;
  }
  // Feishu sometimes nests JSON string in content
  if (text.startsWith("{") && text.includes("text")) {
    try {
      const inner = JSON.parse(text) as { text?: string };
      if (inner.text) text = inner.text;
    } catch {
      /* keep */
    }
  }
  if (!text.trim()) return null;
  return { speaker, text };
}
