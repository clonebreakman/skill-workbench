import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Handoff = {
  trainer: { ok: boolean; url: string; detail?: string };
  activePackages: Array<{
    id: string;
    version: number;
    slug?: string;
    subjectName?: string;
    trainingSkillPath: string;
  }>;
  importUrl: string;
};

export function HomePage() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState("");
  const [seedMsg, setSeedMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [dash, ho] = await Promise.all([api.dashboard(), api.handoff()]);
    setSummary(dash.summary);
    setHandoff(ho);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  const active = handoff?.activePackages[0];

  return (
    <>
      <h1>驾驶舱</h1>
      <p className="muted">anyone-skill 七阶段蒸馏 · 双导出 OpenPersona + 培训 Skill</p>
      {error && <p className="error">{error}</p>}
      {seedMsg && (
        <p className="ok">
          {seedMsg} · <Link to="/export">导出</Link> · <Link to="/warehouse">仓库</Link> ·{" "}
          <a href="http://127.0.0.1:8866/import" target="_blank" rel="noreferrer">
            培训端导入
          </a>
        </p>
      )}
      <div className="grid">
        <div className="card"><div className="muted">对象</div><div className="stat">{summary?.subjects ?? "—"}</div></div>
        <div className="card"><div className="muted">素材</div><div className="stat">{summary?.materials ?? "—"}</div></div>
        <div className="card"><div className="muted">草稿 Run</div><div className="stat">{summary?.drafts ?? "—"}</div></div>
        <div className="card"><div className="muted">已发布包</div><div className="stat">{summary?.published ?? "—"}</div></div>
      </div>

      <div className="card">
        <h2>培训端交接</h2>
        <p>
          状态：{" "}
          {handoff ? (
            <strong className={handoff.trainer.ok ? "ok" : "error"}>
              {handoff.trainer.ok ? "在线" : "离线"}
              {handoff.trainer.detail ? ` · ${handoff.trainer.detail}` : ""}
            </strong>
          ) : (
            "检测中…"
          )}
        </p>
        {active ? (
          <p className="muted">
            当前激活：{active.subjectName || active.slug || active.id} v{active.version}
            <br />
            <code style={{ fontSize: "0.85em" }}>{active.trainingSkillPath}</code>
          </p>
        ) : (
          <p className="muted">尚无激活包。先一键演示或发布蒸馏。</p>
        )}
        <p style={{ marginTop: "0.75rem" }}>
          <a href={handoff?.importUrl ?? "http://127.0.0.1:8866/import"} target="_blank" rel="noreferrer">
            打开培训端导入（推荐包）
          </a>{" "}
          <button type="button" className="secondary" onClick={() => refresh().catch((e: Error) => setError(e.message))}>
            刷新状态
          </button>
        </p>
      </div>

      <div className="card">
        <h2>一键演示</h2>
        <p className="muted">创建柜员「王敏」→ 加载合成样本 → 跑通蒸馏并发布双导出（约数秒）。</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            api
              .seedDemo()
              .then(async (r) => {
                const path = r.package?.trainingSkillPath ?? "";
                setSeedMsg(`已发布 ${r.subject.name} · 培训包：${path}`);
                await refresh();
              })
              .catch((e: Error) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "蒸馏中…" : "一键生成王敏演示 Skill"}
        </button>{" "}
        <Link className="btn secondary" to="/export">
          去导出中心
        </Link>
      </div>
      <div className="card">
        <h2>演示路径</h2>
        <p>
          1. 本页一键演示 → 2. 确认培训端在线 → 3. 导入并开练 → 4. 演进纠正 / 回滚
        </p>
      </div>
    </>
  );
}
