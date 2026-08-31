import { useEffect, useState } from "react";
import { api, type AppSettings } from "../api";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({ adapter: "mock" });
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [feishuAppId, setFeishuAppId] = useState("");
  const [feishuAppSecret, setFeishuAppSecret] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pingBusy, setPingBusy] = useState(false);
  const [feishuBusy, setFeishuBusy] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((r) => {
        setSettings(r.settings);
        setBaseUrl(r.settings.llm?.baseUrl ?? "");
        setApiKey(r.settings.llm?.apiKey ?? "");
        setModel(r.settings.llm?.model ?? "gpt-4o-mini");
        setFeishuAppId(r.settings.feishu?.appId ?? "");
        setFeishuAppSecret(r.settings.feishu?.appSecret ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function saveAll(extraMsg?: string) {
    setError("");
    return api
      .putSettings({
        adapter: settings.adapter,
        llm: baseUrl ? { baseUrl, apiKey, model } : undefined,
        feishu:
          feishuAppId.trim() || feishuAppSecret.trim()
            ? { appId: feishuAppId, appSecret: feishuAppSecret }
            : undefined,
      })
      .then((r) => {
        setSettings(r.settings);
        setMsg(extraMsg ?? "已保存");
      });
  }

  return (
    <>
      <h1>设置</h1>
      <p className="muted">默认 Mock；可配置 LLM 与飞书应用凭证（仅本机）。</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <div className="card">
        <label>适配器</label>
        <select
          value={settings.adapter}
          onChange={(e) => setSettings({ ...settings, adapter: e.target.value })}
        >
          <option value="mock">mock</option>
          <option value="llm">llm</option>
        </select>
        <label>LLM baseUrl</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <label>model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} />
        <label>apiKey（仅本机）</label>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          选择 <code>llm</code> 后，蒸馏会调用 OpenAI 兼容接口；失败或超时自动回退 Mock。
        </p>
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              saveAll().catch((e: Error) => setError(e.message));
            }}
          >
            保存
          </button>{" "}
          <button
            type="button"
            className="secondary"
            disabled={pingBusy || !baseUrl.trim()}
            onClick={() => {
              setPingBusy(true);
              setError("");
              setMsg("");
              api
                .llmPing({ baseUrl, apiKey, model })
                .then((r) => {
                  const ping = r.ping;
                  if (ping.ok) setMsg(ping.detail);
                  else setError(`探测失败：${ping.detail}`);
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setPingBusy(false));
            }}
          >
            {pingBusy ? "探测中…" : "测试 LLM 连通"}
          </button>
        </p>
      </div>

      <div className="card">
        <h2>飞书应用凭证</h2>
        <p className="muted">自建应用 App ID / Secret，用于拉取云文档正文（tenant_access_token）。</p>
        <label>App ID</label>
        <input value={feishuAppId} onChange={(e) => setFeishuAppId(e.target.value)} />
        <label>App Secret</label>
        <input
          type="password"
          value={feishuAppSecret}
          onChange={(e) => setFeishuAppSecret(e.target.value)}
        />
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              saveAll("飞书凭证已保存").catch((e: Error) => setError(e.message));
            }}
          >
            保存飞书凭证
          </button>{" "}
          <button
            type="button"
            className="secondary"
            disabled={feishuBusy || !feishuAppId.trim() || !feishuAppSecret.trim()}
            onClick={() => {
              setFeishuBusy(true);
              setError("");
              setMsg("");
              api
                .feishuPing({ appId: feishuAppId, appSecret: feishuAppSecret })
                .then((r) => setMsg(`飞书连通 OK · token 约 ${r.ping.expiresIn}s 有效`))
                .catch((e: Error) => setError(e.message))
                .finally(() => setFeishuBusy(false));
            }}
          >
            {feishuBusy ? "探测中…" : "测试飞书连通"}
          </button>
        </p>
      </div>
    </>
  );
}
