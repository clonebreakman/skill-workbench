import { afterEach, describe, expect, it, vi } from "vitest";
import { FeishuClient, parseFeishuDocToken } from "../src/adapters/feishu.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseFeishuDocToken", () => {
  it("extracts token from docx url", () => {
    expect(parseFeishuDocToken("https://xxx.feishu.cn/docx/AbCdEf1234567890")).toBe(
      "AbCdEf1234567890",
    );
  });

  it("extracts token from docs url", () => {
    expect(parseFeishuDocToken("https://xxx.feishu.cn/docs/TokEn_abc-123")).toBe("TokEn_abc-123");
  });

  it("returns raw token if no url", () => {
    expect(parseFeishuDocToken("AbCdEf1234567890")).toBe("AbCdEf1234567890");
  });

  it("throws FEISHU_BAD_URL on garbage", () => {
    expect(() => parseFeishuDocToken("https://example.com/x")).toThrow("FEISHU_BAD_URL");
  });
});

describe("FeishuClient", () => {
  it("caches tenant token until near expiry", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, tenant_access_token: "t-1", expire: 7200 }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new FeishuClient({ appId: "id", appSecret: "sec" });
    await client.getTenantToken();
    await client.getTenantToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetchDocPlainText returns content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("tenant_access_token")) {
        return new Response(
          JSON.stringify({ code: 0, tenant_access_token: "t-1", expire: 7200 }),
          { status: 200 },
        );
      }
      if (url.includes("/raw_content")) {
        return new Response(JSON.stringify({ code: 0, data: { content: "柜员核身话术" } }), {
          status: 200,
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new FeishuClient({ appId: "id", appSecret: "sec" });
    const text = await client.fetchDocPlainText("AbCdEf1234567890");
    expect(text).toContain("核身");
  });

  it("maps auth failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 10014, msg: "bad" }), { status: 200 }),
      ),
    );
    const client = new FeishuClient({ appId: "id", appSecret: "sec" });
    await expect(client.getTenantToken()).rejects.toThrow("FEISHU_AUTH_FAILED");
  });
});
