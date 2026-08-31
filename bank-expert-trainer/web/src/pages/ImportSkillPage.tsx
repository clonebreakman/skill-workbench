import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

type Discovered = {
  dirPath: string;
  slug: string;
  version: number;
  name: string;
  recommended?: boolean;
  isZip?: boolean;
  qualityScore?: number;
};

export function ImportSkillPage() {
  const navigate = useNavigate();
  const [dirPath, setDirPath] = useState("");
  const [zipPath, setZipPath] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [discovered, setDiscovered] = useState<Discovered[]>([]);
  const [roots, setRoots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastSkillId, setLastSkillId] = useState("");

  async function refreshDiscover() {
    const r = await api.discoverSkills();
    setDiscovered(r.skills as Discovered[]);
    setRoots(r.roots);
  }

  useEffect(() => {
    refreshDiscover().catch((e: Error) => setError(e.message));
  }, []);

  function onImported(skill: { id: string; slug: string; version: number }, startTraining: boolean) {
    setMessage(`已导入 ${skill.slug} v${skill.version}（${skill.id}）`);
    setLastSkillId(skill.id);
    if (startTraining) {
      navigate(`/training?skillId=${encodeURIComponent(skill.id)}&autostart=1`);
    }
  }

  function doImport(path: string, isZip = false, startTraining = false) {
    setBusy(true);
    setError("");
    setMessage("");
    setLastSkillId("");
    const req = isZip || path.toLowerCase().endsWith(".zip")
      ? api.importSkillZip({ zipPath: path })
      : api.importSkill(path);
    req
      .then((r) => {
        const skill = r.skill as { id: string; slug: string; version: number };
        if (!isZip) setDirPath(path);
        else setZipPath(path);
        onImported(skill, startTraining);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  function onPickZip(file: File | null, startTraining = false) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setLastSkillId("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const zipBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
      api
        .importSkillZip({ zipBase64, fileName: file.name })
        .then((r) => {
          const skill = r.skill as { id: string; slug: string; version: number };
          onImported(skill, startTraining);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(false));
    };
    reader.onerror = () => {
      setError("读取 ZIP 失败");
      setBusy(false);
    };
    reader.readAsDataURL(file);
  }

  const recommended = discovered.filter((s) => s.recommended);

  return (
    <>
      <h1>导入 Skill</h1>
      <p className="muted">
        扫描 Distill Studio 导出目录 / ZIP；也可上传 Distill「下载 ZIP」。「导入并开练」会自动进入对练。
      </p>
      {error && <p className="error">{error}</p>}
      {message && (
        <p className="ok">
          {message}
          {lastSkillId && (
            <>
              {" · "}
              <Link to={`/training?skillId=${encodeURIComponent(lastSkillId)}&autostart=1`}>
                立即对练
              </Link>
            </>
          )}
        </p>
      )}

      {recommended.length > 0 && (
        <div className="card">
          <h2>推荐导入（激活）</h2>
          <ul>
            {recommended.map((s) => (
              <li key={s.dirPath} style={{ marginBottom: "0.5rem" }}>
                <strong>
                  {s.name || s.slug} v{s.version}
                </strong>{" "}
                <span className="badge">推荐</span>
                {s.isZip ? " · ZIP" : ""}
                {typeof s.qualityScore === "number" ? ` · 质量 ${s.qualityScore}` : ""}{" "}
                <button type="button" disabled={busy} onClick={() => doImport(s.dirPath, !!s.isZip)}>
                  一键导入
                </button>{" "}
                <button type="button" disabled={busy} onClick={() => doImport(s.dirPath, !!s.isZip, true)}>
                  导入并开练
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>从 Distill Studio 发现</h2>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          {roots.length
            ? `已扫描：${roots.join(" · ")}`
            : "未找到导出目录（默认 ~/DistillStudio/data/exports/training-skill）"}
        </p>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => refreshDiscover().catch((e: Error) => setError(e.message))}
        >
          刷新发现
        </button>
        {discovered.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            暂无包。请先在 Distill Studio（8877）一键演示或下载 ZIP。
          </p>
        ) : (
          <ul style={{ marginTop: "1rem" }}>
            {discovered.map((s) => (
              <li key={s.dirPath} style={{ marginBottom: "0.5rem" }}>
                <strong>
                  {s.name || s.slug} v{s.version}
                </strong>
                {s.recommended ? " · 推荐" : ""}
                {s.isZip ? " · ZIP" : ""}
                {typeof s.qualityScore === "number" ? ` · 质量 ${s.qualityScore}` : ""}{" "}
                <button type="button" disabled={busy} onClick={() => doImport(s.dirPath, !!s.isZip)}>
                  导入
                </button>{" "}
                <button type="button" disabled={busy} onClick={() => doImport(s.dirPath, !!s.isZip, true)}>
                  导入并开练
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>上传 ZIP（浏览器）</h2>
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => {
            onPickZip(e.target.files?.[0] ?? null, false);
            e.target.value = "";
          }}
        />
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          对应 Distill 导出中心「下载 ZIP」，无需共享目录。
        </p>
      </div>

      <div className="card">
        <h2>手动路径</h2>
        <label>training-skill 目录</label>
        <input
          value={dirPath}
          onChange={(e) => setDirPath(e.target.value)}
          placeholder="C:\\Users\\...\\training-skill\\slug-v1"
        />
        <label>或 ZIP 绝对路径</label>
        <input
          value={zipPath}
          onChange={(e) => setZipPath(e.target.value)}
          placeholder="C:\\Users\\...\\slug-v1.zip"
        />
        <p style={{ marginTop: "1rem" }}>
          <button type="button" disabled={busy || !dirPath.trim()} onClick={() => doImport(dirPath.trim())}>
            导入目录
          </button>{" "}
          <button
            type="button"
            disabled={busy || !zipPath.trim()}
            onClick={() => doImport(zipPath.trim(), true)}
          >
            导入 ZIP
          </button>{" "}
          <button
            type="button"
            disabled={busy || (!dirPath.trim() && !zipPath.trim())}
            onClick={() =>
              zipPath.trim()
                ? doImport(zipPath.trim(), true, true)
                : doImport(dirPath.trim(), false, true)
            }
          >
            导入并开练
          </button>
        </p>
      </div>
    </>
  );
}
