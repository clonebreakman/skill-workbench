import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Handoff = {
  distill: { ok: boolean; url: string; detail?: string };
  recommended: Array<{
    dirPath: string;
    slug: string;
    version: number;
    name: string;
    recommended?: boolean;
    qualityScore?: number;
  }>;
  evolveUrl: string;
  discoverCount: number;
};

export function HomePage() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const [dash, ho] = await Promise.all([api.dashboard(), api.handoff()]);
    setSummary(dash.summary);
    setHandoff(ho);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  const rec = handoff?.recommended[0];

  return (
    <>
      <h1>驾驶舱</h1>
      <p className="muted">培训端：导入 Distill Studio 的 Skill，做 Posh 风格情景对练。</p>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        <div className="card">
          <div className="muted">已导入 Skill</div>
          <div className="stat">{summary?.publishedSkills ?? "—"}</div>
        </div>
        <div className="card">
          <div className="muted">培训场次</div>
          <div className="stat">{summary?.trainingSessions ?? "—"}</div>
        </div>
        <div className="card">
          <div className="muted">已完成培训</div>
          <div className="stat">{summary?.completedTrainings ?? "—"}</div>
        </div>
      </div>

      <div className="card">
        <h2>蒸馏端交接</h2>
        <p>
          状态：{" "}
          {handoff ? (
            <strong className={handoff.distill.ok ? "ok" : "error"}>
              {handoff.distill.ok ? "在线" : "离线"}
              {handoff.distill.detail ? ` · ${handoff.distill.detail}` : ""}
            </strong>
          ) : (
            "检测中…"
          )}
        </p>
        <p className="muted">
          可发现包 {handoff?.discoverCount ?? "—"} 个
          {rec
            ? ` · 推荐 ${rec.name || rec.slug} v${rec.version}${
                rec.qualityScore != null ? ` · 质量 ${rec.qualityScore}` : ""
              }`
            : " · 暂无推荐（先在 Distill 发布并激活）"}
        </p>
        <p style={{ marginTop: "0.75rem" }}>
          <a href={handoff?.distill.url ?? "http://127.0.0.1:8877/"} target="_blank" rel="noreferrer">
            打开 Distill Studio
          </a>{" "}
          <a href={handoff?.evolveUrl ?? "http://127.0.0.1:8877/evolve"} target="_blank" rel="noreferrer">
            演进页
          </a>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => refresh().catch((e: Error) => setError(e.message))}
          >
            刷新状态
          </button>
        </p>
      </div>

      <div className="card">
        <h2>快速开始</h2>
        <p>1. Distill Studio（8877）一键演示或蒸馏发布</p>
        <p>2. 「导入 Skill」选推荐包 → 导入并开练</p>
        <p>3. 对练结束后评分，可把纠正回传 Distill 升版</p>
        <p>
          <Link className="btn" to="/import">
            导入 Skill
          </Link>{" "}
          <Link className="btn secondary" to="/training">
            培训对练
          </Link>{" "}
          <Link className="btn secondary" to="/skills">
            Skill 仓库
          </Link>
        </p>
      </div>
    </>
  );
}
