import { useEffect, useState } from "react";
import { api, type Material, type Subject } from "../api";

const SAMPLE = `理解您着急，我先帮您核对身份。请出示证件做核身。
抱歉，不得口头报完整卡号。我可以只读查询余额并展示。
大额或异常转账需转主管升级。
家属代查必须合法授权，不能通融，也不能让您报密码。
抱歉让您久等了；投诉场景先承接情绪再办理。`;

const FEISHU_SAMPLE = `[
  {"sender_name":"客户","content":"我爸不方便来，能不能通融代查余额？"},
  {"sender_name":"王敏","body":{"content":"理解您着急。必须本人或合法授权，不能通融代查，也不能报密码。"}},
  {"sender_name":"客户","content":"那完整卡号告诉我一下？"},
  {"sender_name":"王敏","text":"抱歉，不得口头报完整卡号。我可以只读查询后屏幕展示。"}
]`;

export function MaterialsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [content, setContent] = useState(SAMPLE);
  const [importRaw, setImportRaw] = useState(FEISHU_SAMPLE);
  const [feishuUrl, setFeishuUrl] = useState("");
  const [feishuTitle, setFeishuTitle] = useState("");
  const [feishuBusy, setFeishuBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);

  async function refresh(sid = subjectId) {
    const [s, m] = await Promise.all([api.subjects(), api.materials(sid || undefined)]);
    setSubjects(s.subjects);
    setMaterials(m.materials);
    if (!sid && s.subjects[0]) setSubjectId(s.subjects[0].id);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  function onPickFile(file: File | null) {
    if (!file || !subjectId) return;
    setError("");
    setMsg("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lower = file.name.toLowerCase();
      const isJson = lower.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[");
      const run = isJson
        ? api.importMaterial({ subjectId, raw: text, title: file.name })
        : api.addMaterial({
            subjectId,
            kind: "script",
            title: file.name.replace(/\.[^.]+$/, "") || "文件素材",
            sensitivity: "synthetic",
            fileName: file.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || `file-${Date.now()}.md`,
            content: text,
          });
      run
        .then(() => {
          setMsg(`已入库：${file.name}`);
          return refresh(subjectId);
        })
        .catch((e: Error) => setError(e.message));
    };
    reader.onerror = () => setError("读取文件失败");
    reader.readAsText(file, "utf-8");
  }

  return (
    <>
      <h1>素材库</h1>
      <p className="muted">
        粘贴文本、本地文件、飞书云文档在线拉取，或飞书导出 JSON（离线）。仅 synthetic/redacted 可发布。
      </p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <div className="card">
        <label>对象</label>
        <select
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            api.materials(e.target.value).then((r) => setMaterials(r.materials));
          }}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.slug})
            </option>
          ))}
        </select>
        <label>从文件导入</label>
        <input
          type="file"
          accept=".md,.txt,.json,text/plain,application/json"
          onChange={(e) => {
            onPickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <label>合成话术</label>
        <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              api
                .addMaterial({
                  subjectId,
                  kind: "script",
                  title: "合成话术",
                  sensitivity: "synthetic",
                  fileName: `mat-${Date.now()}.md`,
                  content,
                })
                .then(() => refresh(subjectId))
                .catch((e: Error) => setError(e.message));
            }}
          >
            上传合成素材
          </button>
        </p>
      </div>
      <div className="card">
        <h2>飞书云文档（在线）</h2>
        <p className="muted">需在「设置」填写 App ID / Secret，并给应用开通云文档读权限、文档对应用可见。</p>
        <label>文档 URL 或 token</label>
        <input
          value={feishuUrl}
          onChange={(e) => setFeishuUrl(e.target.value)}
          placeholder="https://xxx.feishu.cn/docx/xxxx 或 document_id"
        />
        <label>标题（可选）</label>
        <input value={feishuTitle} onChange={(e) => setFeishuTitle(e.target.value)} />
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            disabled={feishuBusy || !subjectId || !feishuUrl.trim()}
            onClick={() => {
              setFeishuBusy(true);
              setError("");
              setMsg("");
              api
                .importFeishuDoc({
                  subjectId,
                  url: feishuUrl.trim(),
                  title: feishuTitle.trim() || undefined,
                  sensitivity: "synthetic",
                })
                .then((r) => {
                  setMsg(`已拉取飞书文档 → ${r.material.title}`);
                  return refresh(subjectId);
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setFeishuBusy(false));
            }}
          >
            {feishuBusy ? "拉取中…" : "在线导入"}
          </button>
        </p>
      </div>
      <div className="card">
        <h2>离线导入（飞书 JSON / 文本）</h2>
        <textarea rows={8} value={importRaw} onChange={(e) => setImportRaw(e.target.value)} />
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              api
                .importMaterial({ subjectId, raw: importRaw, title: "飞书导出" })
                .then(() => refresh(subjectId))
                .catch((e: Error) => setError(e.message));
            }}
          >
            解析并入库
          </button>
        </p>
      </div>
      <div className="card">
        <h2>已入库</h2>
        <ul>
          {materials.map((m) => (
            <li key={m.id} style={{ marginBottom: "0.5rem" }}>
              {m.title} · {m.sensitivity} · {m.id}{" "}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setError("");
                  api
                    .getMaterial(m.id)
                    .then((r) => setPreview({ title: r.material.title, content: r.content }))
                    .catch((e: Error) => setError(e.message));
                }}
              >
                预览
              </button>
            </li>
          ))}
        </ul>
      </div>
      {preview && (
        <div className="card">
          <h2>预览 · {preview.title}</h2>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: "24rem", overflow: "auto" }}>
            {preview.content}
          </pre>
          <button type="button" className="secondary" onClick={() => setPreview(null)}>
            关闭
          </button>
        </div>
      )}
    </>
  );
}
