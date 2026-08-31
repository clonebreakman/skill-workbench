import { useEffect, useState } from "react";
import { api, type CorrectionRecord, type PackageRecord } from "../api";

export function EvolvePage() {
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [packageId, setPackageId] = useState("");
  const [scene, setScene] = useState("家属代查");
  const [wrong, setWrong] = useState("通融代查");
  const [right, setRight] = useState("必须本人或合法授权");
  const [republish, setRepublish] = useState(true);
  const [rollbackVersion, setRollbackVersion] = useState(1);
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function loadCorrections(id: string) {
    if (!id) {
      setCorrections([]);
      return;
    }
    const r = await api.corrections(id);
    setCorrections([...r.corrections].reverse());
  }

  async function refresh() {
    const r = await api.packages();
    const list = [...r.packages].reverse();
    setPackages(list);
    const active = list.find((p) => p.active) ?? list[0];
    const nextId = packageId || active?.id || "";
    if (active && !packageId) {
      setPackageId(active.id);
      setRollbackVersion(active.version > 1 ? active.version - 1 : 1);
    }
    if (nextId) await loadCorrections(nextId);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!packageId) return;
    loadCorrections(packageId).catch((e: Error) => setError(e.message));
  }, [packageId]);

  const selected = packages.find((p) => p.id === packageId);
  const subjectPkgs = packages
    .filter((p) => p.subjectId === selected?.subjectId)
    .sort((a, b) => b.version - a.version);

  return (
    <>
      <h1>演进 / 纠正</h1>
      <p className="muted">
        Phase 7：纠正可升版重导出；回滚写入 active-pointer.json，培训端会标「推荐」。
      </p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <div className="card">
        <label>包</label>
        <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.subjectName || p.slug || p.id} · v{p.version}
              {p.active ? " · 激活" : ""}
            </option>
          ))}
        </select>
        <label>场景</label>
        <input value={scene} onChange={(e) => setScene(e.target.value)} />
        <label>错误行为</label>
        <input value={wrong} onChange={(e) => setWrong(e.target.value)} />
        <label>正确行为</label>
        <input value={right} onChange={(e) => setRight(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: "0.8rem" }}>
          <input
            type="checkbox"
            checked={republish}
            onChange={(e) => setRepublish(e.target.checked)}
            style={{ width: "auto" }}
          />
          纠正后升版重导出（v+1）
        </label>
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              setError("");
              api
                .correct(packageId, { scene, wrong, right, republish })
                .then(async (r) => {
                  if (r.package) {
                    setMsg(`已纠正并发布 v${r.package.version} → ${r.package.trainingSkillPath}`);
                    setPackageId(r.package.id);
                  } else {
                    setMsg("纠正已记录（未重导出）");
                  }
                  await refresh();
                  await loadCorrections(packageId);
                })
                .catch((e: Error) => setError(e.message));
            }}
          >
            提交纠正
          </button>
        </p>
      </div>

      <div className="card">
        <h2>回滚激活版本</h2>
        {!selected && <p className="muted">请先选择包</p>}
        {selected && (
          <>
            <p className="muted">
              对象 {selected.subjectId} · 当前选中 v{selected.version}
              {selected.active ? "（已激活）" : ""}
            </p>
            <label>回滚到版本</label>
            <select
              value={rollbackVersion}
              onChange={(e) => setRollbackVersion(Number(e.target.value))}
            >
              {subjectPkgs.map((p) => (
                <option key={p.id} value={p.version}>
                  v{p.version}
                  {p.active ? " · 激活" : ""} · {p.id}
                </option>
              ))}
            </select>
            <p style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (!selected) return;
                  setError("");
                  api
                    .rollback(selected.subjectId, rollbackVersion)
                    .then(async (r) => {
                      setMsg(`已激活 v${r.package.version} → ${r.package.trainingSkillPath}`);
                      setPackageId(r.package.id);
                      await refresh();
                    })
                    .catch((e: Error) => setError(e.message));
                }}
              >
                激活该版本
              </button>
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>纠正历史</h2>
        {corrections.length === 0 ? (
          <p className="muted">当前包尚无纠正记录</p>
        ) : (
          <ul>
            {corrections.map((c) => (
              <li key={c.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{c.scene}</strong>：{c.wrong} → {c.right}
                <div className="muted" style={{ fontSize: "0.85em" }}>
                  {c.at} · {c.id}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
