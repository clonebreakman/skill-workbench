import { useEffect, useState } from "react";

type Status = {
  distill: { ok: boolean; url: string };
  trainer: { ok: boolean; url: string };
};

type Tab = "overview" | "distill" | "trainer";

export function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [trainerFrameUrl, setTrainerFrameUrl] = useState("");

  async function refresh() {
    const res = await fetch("/api/status");
    const data = (await res.json()) as Status & { ok?: boolean };
    setStatus(data);
  }

  useEffect(() => {
    refresh().catch(() => setStatus(null));
    const id = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const distillUrl = status?.distill.url ?? "http://127.0.0.1:8877/";
  const trainerHome = status?.trainer.url ?? "http://127.0.0.1:8866/";
  const trainerUrl = trainerFrameUrl || trainerHome;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Skill Workbench</div>
        <nav className="nav">
          <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            总览
          </button>
          <button type="button" className={tab === "distill" ? "active" : ""} onClick={() => setTab("distill")}>
            蒸馏
          </button>
          <button
            type="button"
            className={tab === "trainer" ? "active" : ""}
            onClick={() => {
              setTrainerFrameUrl("");
              setTab("trainer");
            }}
          >
            培训
          </button>
        </nav>
        <div className="status">
          <span>
            <i className={`dot ${status?.distill.ok ? "ok" : "bad"}`} />
            蒸馏 {status?.distill.ok ? "在线" : "离线"}
          </span>
          <span>
            <i className={`dot ${status?.trainer.ok ? "ok" : "bad"}`} />
            培训 {status?.trainer.ok ? "在线" : "离线"}
          </span>
          <button type="button" onClick={() => refresh().catch(() => undefined)}>
            刷新
          </button>
        </div>
      </header>
      <main className="main">
        {tab === "overview" && (
          <div className="overview">
            <h1>统一工作台</h1>
            <p>蒸馏 Studio（人物 Skill）与银行培训对练，在同一壳内切换。Web 与桌面 App 共用此界面。</p>
            {msg && <p className="ok-msg">{msg}</p>}
            <div className="card">
              <h2>服务</h2>
              <p>
                蒸馏 {status?.distill.ok ? "在线" : "离线"} · 培训 {status?.trainer.ok ? "在线" : "离线"}
              </p>
              <p style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setMsg("");
                    fetch("/api/start-services", { method: "POST" })
                      .then(async (r) => {
                        const body = (await r.json()) as { distill?: boolean; trainer?: boolean };
                        setMsg(
                          `已尝试拉起：蒸馏=${body.distill ? "OK" : "失败"} · 培训=${body.trainer ? "OK" : "失败"}`,
                        );
                        await refresh();
                      })
                      .catch((e: Error) => setMsg(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  {busy ? "处理中…" : "一键拉起蒸馏+培训"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setMsg("");
                    fetch("/api/demo/run", { method: "POST" })
                      .then(async (r) => {
                        const body = (await r.json()) as {
                          ok?: boolean;
                          reason?: string;
                          subject?: { name?: string };
                          skill?: { slug?: string; version?: number; id?: string };
                          trainingUrl?: string;
                        };
                        if (!r.ok || body.ok === false) {
                          throw new Error(body.reason ?? `HTTP_${r.status}`);
                        }
                        const name = body.subject?.name ?? "演示对象";
                        const slug = body.skill?.slug ?? "";
                        setMsg(`已蒸馏并导入 ${name}${slug ? ` · ${slug}` : ""}，正在自动开练…`);
                        if (body.trainingUrl) setTrainerFrameUrl(body.trainingUrl);
                        await refresh();
                        setTab("trainer");
                      })
                      .catch((e: Error) => setMsg(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  {busy ? "全链路执行中…" : "一键演示并开练"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setMsg("");
                    fetch("/api/demo/seed", { method: "POST" })
                      .then(async (r) => {
                        const body = (await r.json()) as {
                          ok?: boolean;
                          reason?: string;
                          subject?: { name?: string };
                          package?: { version?: number };
                        };
                        if (!r.ok || body.ok === false) {
                          throw new Error(body.reason ?? `HTTP_${r.status}`);
                        }
                        setMsg(
                          `仅发布：${body.subject?.name ?? "演示"}${
                            body.package?.version ? ` v${body.package.version}` : ""
                          }。请到培训页手动导入。`,
                        );
                        setTrainerFrameUrl(`${trainerHome.replace(/\/$/, "")}/import`);
                        await refresh();
                        setTab("trainer");
                      })
                      .catch((e: Error) => setMsg(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  只蒸馏不导入
                </button>
              </p>
            </div>
            <div className="card">
              <h2>蒸馏 Distill Studio</h2>
              <p>Phase 0–7 · 飞书素材 · 双导出 · 演进纠正</p>
              <p>
                <a href={distillUrl} target="_blank" rel="noreferrer">
                  {distillUrl}
                </a>{" "}
                ·{" "}
                <button type="button" onClick={() => setTab("distill")}>
                  在壳内打开
                </button>
              </p>
            </div>
            <div className="card">
              <h2>培训 BankExpertTrainer</h2>
              <p>导入 Skill · 情景对练 · 评分导出 · 回传纠正</p>
              <p>
                <a href={trainerHome} target="_blank" rel="noreferrer">
                  {trainerHome}
                </a>{" "}
                ·{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTrainerFrameUrl("");
                    setTab("trainer");
                  }}
                >
                  在壳内打开
                </button>
              </p>
            </div>
            <div className="card">
              <h2>推荐路径</h2>
              <p>点「一键演示并开练」：蒸馏王敏 → 自动导入 → 对练页 autostart。</p>
            </div>
          </div>
        )}
        {tab === "distill" && <iframe title="distill" src={distillUrl} />}
        {tab === "trainer" && <iframe title="trainer" src={trainerUrl} />}
      </main>
    </div>
  );
}
