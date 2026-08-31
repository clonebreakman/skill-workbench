import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PackageRecord } from "../api";

export function ExportPage() {
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [zipPath, setZipPath] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    api
      .packages()
      .then((r) => {
        setPackages(r.packages);
        const active = r.packages.find((p) => p.active) ?? r.packages.at(-1);
        if (active) setSelectedId(active.id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const selected = packages.find((p) => p.id === selectedId) ?? packages.find((p) => p.active);

  function copyPath(path: string) {
    void navigator.clipboard.writeText(path).then(
      () => {
        setCopied(path);
        setTimeout(() => setCopied(""), 2000);
      },
      () => setError("剪贴板不可用，请手动复制路径"),
    );
  }

  return (
    <>
      <h1>导出中心</h1>
      <p className="muted">
        默认展示<strong>当前激活</strong>包（回滚后以激活指针为准，而非最新版本号）。培训端可自动发现目录。
      </p>
      {error && <p className="error">{error}</p>}
      {copied && <p className="ok">已复制路径</p>}
      <div className="card">
        {!selected && <p className="muted">尚无导出。请先走蒸馏向导发布，或首页一键演示。</p>}
        {selected && (
          <>
            <label>选择导出包</label>
            <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.subjectName || p.slug || p.id} · v{p.version}
                  {p.active ? " · 激活" : ""}
                </option>
              ))}
            </select>
            <h2 style={{ marginTop: "1rem" }}>
              v{selected.version} · {selected.id}
              {selected.active ? " · 激活" : ""}
              {typeof selected.qualityScore === "number" ? ` · 质量 ${selected.qualityScore}` : ""}
            </h2>
            <p>
              <strong>培训兼容包</strong>
              <br />
              <code>{selected.trainingSkillPath}</code>
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={() => copyPath(selected.trainingSkillPath)}>
                复制培训包路径
              </button>{" "}
              <a href="http://127.0.0.1:8866/import" target="_blank" rel="noreferrer">
                打开培训端导入页
              </a>{" "}
              <Link to="/warehouse">仓库预览</Link>
            </p>
            <p>
              <strong>OpenPersona 包</strong>
              <br />
              <code>{selected.openPersonaPath}</code>
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                api
                  .zipPackage(selected.id)
                  .then((r) => setZipPath(r.zipPath))
                  .catch((e: Error) => setError(e.message));
              }}
            >
              打包 training-skill ZIP
            </button>{" "}
            <a
              href={`/api/packages/${encodeURIComponent(selected.id)}/download`}
              download
            >
              下载 ZIP
            </a>
            {zipPath && (
              <p style={{ marginTop: "0.75rem" }}>
                ZIP：<code>{zipPath}</code>
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
