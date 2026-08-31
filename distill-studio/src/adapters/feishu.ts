export type FeishuCredentials = { appId: string; appSecret: string };

const TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

export function parseFeishuDocToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("FEISHU_BAD_URL");
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^[A-Za-z0-9_-]{8,}$/.test(trimmed)) return trimmed;
    throw new Error("FEISHU_BAD_URL");
  }
  try {
    const u = new URL(trimmed);
    const m = u.pathname.match(/\/(?:docx|docs|wiki)\/([A-Za-z0-9_-]+)/);
    if (m?.[1]) return m[1];
  } catch {
    throw new Error("FEISHU_BAD_URL");
  }
  throw new Error("FEISHU_BAD_URL");
}

type TokenCache = { token: string; expiresAtMs: number };

export class FeishuClient {
  private cache: TokenCache | null = null;

  constructor(private readonly creds: FeishuCredentials) {}

  async getTenantToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAtMs > now + 60_000) {
      return this.cache.token;
    }
    const appId = this.creds.appId.trim();
    const appSecret = this.creds.appSecret.trim();
    if (!appId || !appSecret) throw new Error("FEISHU_NOT_CONFIGURED");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const body = (await res.json()) as {
      code?: number;
      msg?: string;
      tenant_access_token?: string;
      expire?: number;
    };
    if (!res.ok || body.code !== 0 || !body.tenant_access_token) {
      throw new Error("FEISHU_AUTH_FAILED");
    }
    const expireSec = Number(body.expire ?? 7200);
    this.cache = {
      token: body.tenant_access_token,
      expiresAtMs: now + expireSec * 1000,
    };
    return this.cache.token;
  }

  async ping(): Promise<{ ok: true; expiresIn: number }> {
    const before = Date.now();
    await this.getTenantToken();
    const expiresIn = Math.max(
      0,
      Math.floor(((this.cache?.expiresAtMs ?? before) - Date.now()) / 1000),
    );
    return { ok: true, expiresIn };
  }

  async fetchDocPlainText(docTokenOrUrl: string): Promise<string> {
    const documentId = parseFeishuDocToken(docTokenOrUrl);
    const token = await this.getTenantToken();
    const url = `https://open.feishu.cn/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}/raw_content`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: { content?: string };
    };
    if (body.code === 1770032 || body.code === 99991672) {
      throw new Error("FEISHU_DOC_NOT_FOUND");
    }
    if (body.code === 99991663 || res.status === 403) {
      throw new Error("FEISHU_FORBIDDEN");
    }
    if (!res.ok || body.code !== 0) {
      throw new Error("FEISHU_DOC_NOT_FOUND");
    }
    const content = String(body.data?.content ?? "").trim();
    if (!content) throw new Error("FEISHU_EMPTY_CONTENT");
    return content;
  }
}
