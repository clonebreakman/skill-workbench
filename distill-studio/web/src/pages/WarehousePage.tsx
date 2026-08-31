import { useEffect, useMemo, useState } from "react";
import { api, type PackageDiff, type PackageRecord } from "../api";

function bullet(items: string[], prefix: string) {
  if (!items.length) return null;
  return (
    <ul>
      {items.map((x) => (
        <li key={`${prefix}-${x}`}>
          {prefix} {x}
        </li>
      ))}
    </ul>
  );
}

export function WarehousePage() {
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [preview, setPreview] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [diff, setDiff] = useState<PackageDiff | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function loadPackages() {
    const r = await api.packages();
    const list = [...r.packages].reverse();
    setPackages(list);
    const bySubject = new Map<string, PackageRecord[]>();
    for (const p of list) {
      const arr = bySubject.get(p.subjectId) ?? [];
      arr.push(p);
      bySubject.set(p.subjectId, arr);
    }
    for (const group of bySubject.values()) {
      if (group.length >= 2) {
        setCompareA(group[1]!.id);
        setCompareB(group[0]!.id);
        break;
      }
    }
  }

  useEffect(() => {
    loadPackages().catch((e: Error) => setError(e.message));
  }, []);

  const compareOptions = useMemo(() => {
    const a = packages.find((p) => p.id === compareA);
    if (!a) return packages;
    return packages.filter((p) => p.subjectId === a.subjectId);
  }, [packages, compareA]);

  return (
    <>
      <h1>Skill 仓库</h1>
      <p className="muted">预览 SKILL.md、对比同对象版本差异；质量分为导出时启发式评分（0–100）。</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <div className="card">
        <p style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setError("");
              setMsg("");
              if (!window.confirm("每个对象最多保留 2 个版本（含激活包），并删除多余导出目录。继续？")) {
                return;
              }
              api
                .prunePackages({ keepPerSubject: 2, deleteFiles: true })
                .then(async (r) => {
                  setMsg(`已清理：删除 ${r.removed} 个包记录，目录 ${r.deletedDirs} 个；保留 ${r.kept}`);
                  setPreview("");
                  setDiff(null);
                  await loadPackages();
                })
                .catch((e: Error) => setError(e.message));
            }}
          >
            清理旧包（每对象保留 2 版）
          </button>
        </p>
        {packages.length === 0 && <p className="muted">暂无发布包。首页一键演示或走蒸馏向导发布。</p>}
        {packages.map((p) => (
          <div key={p.id} style={{ marginBottom: "1.25rem" }}>
            <strong>
              {p.subjectName || p.slug || p.id} · v{p.version}
              {p.active ? " · 激活" : ""}
            </strong>
            <div className="muted">
              {p.id}
              {typeof p.qualityScore === "number" ? ` · 质量 ${p.qualityScore}` : ""}
            </div>
            <div className="muted" style={{ fontSize: "0.85em", wordBreak: "break-all" }}>
              {p.trainingSkillPath}
            </div>
            <p style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setError("");
                  api
                    .previewPackage(p.id)
                    .then((r) => {
                      setPreviewId(p.id);
                      setPreview(r.skillMarkdown || "(空 SKILL.md)");
                    })
                    .catch((e: Error) => setError(e.message));
                }}
              >
                预览 SKILL.md
              </button>
            </p>
          </div>
        ))}
      </div>

      {packages.length >= 2 && (
        <div className="card">
          <h2>版本对比</h2>
          <label>基准（旧）</label>
          <select
            value={compareA}
            onChange={(e) => {
              setCompareA(e.target.value);
              setDiff(null);
            }}
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.subjectName || p.slug || p.id} · v{p.version}
                {p.active ? " · 激活" : ""}
              </option>
            ))}
          </select>
          <label>对比（新）</label>
          <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
            {compareOptions.map((p) => (
              <option key={p.id} value={p.id}>
                v{p.version}
                {p.active ? " · 激活" : ""} · {p.id}
              </option>
            ))}
          </select>
          <p style={{ marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => {
                setError("");
                api
                  .comparePackages(compareA, compareB)
                  .then((r) => setDiff(r.diff))
                  .catch((e: Error) => setError(e.message));
              }}
            >
              对比
            </button>
          </p>
          {diff && (
            <div style={{ marginTop: "1rem" }}>
              <p>
                <strong>{diff.summary.join(" · ")}</strong>
              </p>
              {bullet(diff.work.addedWorkflows, "+流程")}
              {bullet(diff.work.removedWorkflows, "−流程")}
              {bullet(diff.work.addedForbidden, "+禁区")}
              {bullet(diff.work.removedForbidden, "−禁区")}
              {bullet(diff.work.addedRules, "+规则")}
              {bullet(diff.work.removedRules, "−规则")}
              {bullet(diff.persona.addedAntiPatterns, "+反模式")}
              {bullet(diff.persona.removedAntiPatterns, "−反模式")}
              {bullet(diff.persona.addedExpression, "+表达")}
              {bullet(diff.persona.removedExpression, "−表达")}
              {diff.persona.identityChanged && <p className="muted">身份描述已变化</p>}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="card">
          <h2>预览 · {previewId}</h2>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: "28rem", overflow: "auto" }}>{preview}</pre>
        </div>
      )}
    </>
  );
}
