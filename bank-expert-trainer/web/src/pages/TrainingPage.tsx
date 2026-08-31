import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

type Skill = {
  id: string;
  slug: string;
  version: number;
  workSkill?: {
    workflows?: string[];
    forbidden?: string[];
    decisionRules?: string[];
  };
  persona?: {
    expression?: string[];
    antiPatterns?: string[];
  };
};
type Scenario = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  customerGoal: string;
  successSignals?: string[];
  failSignals?: string[];
  pressureHints?: string[];
};
type Turn = { role: "customer" | "trainee"; text: string };
type Session = {
  id: string;
  skillId?: string;
  scenarioId?: string;
  status: string;
  turns: Turn[];
  score?: {
    empathy: number;
    compliance: number;
    accuracy: number;
    overall: number;
    notes: string[];
    matchedSuccess?: string[];
    matchedFail?: string[];
    tips?: string[];
  };
};

const SAMPLE_BY_SCENARIO: Record<string, string[]> = {
  "scn-balance-inquiry": [
    "理解您着急。请先出示证件，我帮您核身后再做只读余额查询，不会口头报完整卡号。",
    "抱歉让您久等。核身通过后我可以屏幕展示余额，不能通融口报卡号。",
  ],
  "scn-family-proxy": [
    "理解您着急。必须本人或合法授权，我不能通融代查他人账户，也不能让您报密码。",
    "为保护客户资金安全，请家人本人前来或办理合法授权后再查询。",
  ],
  "scn-complaint-wait": [
    "非常抱歉让您久等了，我先帮您核实诉求，能办的马上办，超权限的我转主管。",
    "理解您着急。我先核对业务类型，能当场处理的立刻处理，需要升级的马上联系主管。",
  ],
};

type HistorySession = {
  id: string;
  skillId: string;
  scenarioId: string;
  status: string;
  score?: Session["score"];
  createdAt?: string;
  completedAt?: string;
};

export function TrainingPage() {
  const [searchParams] = useSearchParams();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skillId, setSkillId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [error, setError] = useState("");
  const [autoStarted, setAutoStarted] = useState(false);
  const [fbScene, setFbScene] = useState("");
  const [fbWrong, setFbWrong] = useState("");
  const [fbRight, setFbRight] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbBusy, setFbBusy] = useState(false);

  async function refreshMeta() {
    const [skillRes, sceneRes, progRes] = await Promise.all([
      api.skills(),
      api.trainingScenarios(),
      api.trainingProgress(),
    ]);
    const list = skillRes.skills as Skill[];
    setSkills(list);
    setScenarios(sceneRes.scenarios as Scenario[]);
    setProgress(progRes.progress);
    const sessions = (progRes.sessions as HistorySession[])
      .slice()
      .sort((a, b) => String(b.completedAt ?? b.createdAt ?? "").localeCompare(String(a.completedAt ?? a.createdAt ?? "")))
      .slice(0, 12);
    setHistory(sessions);
    const fromQuery = searchParams.get("skillId") ?? "";
    const preferred =
      (fromQuery && list.some((s) => s.id === fromQuery) ? fromQuery : "") ||
      skillId ||
      (list[0] ? String(list[0].id) : "");
    if (preferred) setSkillId(preferred);
    const nextScenario =
      scenarioId || (sceneRes.scenarios[0] ? String(sceneRes.scenarios[0].id) : "");
    if (nextScenario) setScenarioId(nextScenario);

    const wantAuto = searchParams.get("autostart") === "1";
    if (wantAuto && !autoStarted && preferred && nextScenario) {
      setAutoStarted(true);
      setError("");
      api
        .startTraining({ skillId: preferred, scenarioId: nextScenario, traineeId: "TRAINEE-DEMO" })
        .then((res) => setSession(res.session as Session))
        .catch((err: Error) => setError(err.message));
    }
  }

  useEffect(() => {
    refreshMeta().catch((err: Error) => setError(err.message));
  }, [searchParams]);

  const selectedSkill = skills.find((s) => s.id === skillId);
  const selectedScenario = scenarios.find((s) => s.id === scenarioId);

  return (
    <>
      <h1>培训对练</h1>
      <p className="muted">对标 Posh：用已发布员工 Skill 做柜面情景文字对练，结束后多维评分。</p>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>学员进度</h2>
        <p>
          总场次 {String(progress?.total ?? 0)} · 已完成 {String(progress?.completed ?? 0)} ·
          平均分 {String(progress?.averageOverall ?? "—")}
        </p>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>历史场次</h2>
          <ul>
            {history.map((h) => {
              const skill = skills.find((s) => s.id === h.skillId);
              const scene = scenarios.find((s) => s.id === h.scenarioId);
              return (
                <li key={h.id} style={{ marginBottom: "0.5rem" }}>
                  <strong>{scene?.title ?? h.scenarioId}</strong> · {skill?.slug ?? h.skillId} ·{" "}
                  {h.status}
                  {h.score ? ` · 综合 ${h.score.overall}` : ""}{" "}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setError("");
                      api
                        .getTrainingSession(h.id)
                        .then((r) => setSession(r.session as Session))
                        .catch((err: Error) => setError(err.message));
                    }}
                  >
                    查看
                  </button>{" "}
                  <a href={api.trainingTranscriptDownloadUrl(h.id)} download>
                    导出
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>开始对练</h2>
        <label>选择专家 Skill</label>
        <select value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">请选择已发布 Skill</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.slug} v{skill.version}
            </option>
          ))}
        </select>
        <label>选择情景</label>
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {scenarios.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title}（{scene.difficulty}）
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setError("");
            api
              .startTraining({ skillId, scenarioId, traineeId: "TRAINEE-DEMO" })
              .then((res) => setSession(res.session as Session))
              .catch((err: Error) => setError(err.message));
          }}
        >
          开始对练
        </button>
        {skills.length === 0 && (
          <p className="muted">请先在「导入 Skill」从 Distill Studio 导入至少一个包。</p>
        )}
        {searchParams.get("skillId") && skillId === searchParams.get("skillId") && !session && (
          <p className="ok" style={{ marginTop: "0.5rem" }}>
            {searchParams.get("autostart") === "1"
              ? "已自动开始对练。"
              : "已按导入结果选中 Skill，点「开始对练」即可。"}
          </p>
        )}
      </div>

      {(selectedSkill || selectedScenario) && (
        <div className="card">
          <h2>辅导提示（来自 Skill / 情景）</h2>
          {selectedScenario && (
            <p className="muted">客户目标：{selectedScenario.customerGoal}</p>
          )}
          {selectedSkill?.workSkill?.forbidden && selectedSkill.workSkill.forbidden.length > 0 && (
            <p>
              <strong>禁区：</strong>
              {selectedSkill.workSkill.forbidden.slice(0, 5).join("；")}
            </p>
          )}
          {selectedSkill?.workSkill?.workflows && selectedSkill.workSkill.workflows.length > 0 && (
            <p>
              <strong>流程要点：</strong>
              {selectedSkill.workSkill.workflows.slice(0, 4).join("；")}
            </p>
          )}
          {selectedScenario?.successSignals && selectedScenario.successSignals.length > 0 && (
            <p>
              <strong>成功信号：</strong>
              {selectedScenario.successSignals.join("；")}
            </p>
          )}
          {selectedScenario?.failSignals && selectedScenario.failSignals.length > 0 && (
            <p>
              <strong>失败信号：</strong>
              {selectedScenario.failSignals.join("；")}
            </p>
          )}
        </div>
      )}

      {session && (
        <div className="card">
          <h2>对话</h2>
          <div style={{ display: "grid", gap: ".75rem", marginBottom: "1rem" }}>
            {session.turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                style={{
                  padding: ".75rem",
                  borderRadius: "8px",
                  background: turn.role === "customer" ? "#fff4e5" : "#e8f1ff",
                }}
              >
                <strong>{turn.role === "customer" ? "客户" : "学员（柜员）"}</strong>
                <div>{turn.text}</div>
              </div>
            ))}
          </div>
          {session.status === "active" ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                {(SAMPLE_BY_SCENARIO[scenarioId] ?? SAMPLE_BY_SCENARIO["scn-balance-inquiry"]!).map(
                  (sample, i) => (
                    <button
                      key={`${scenarioId}-${i}`}
                      type="button"
                      className="secondary"
                      style={{ fontSize: "0.85em" }}
                      title={sample}
                      onClick={() => setText(sample)}
                    >
                      示范回复 {i + 1}
                    </button>
                  ),
                )}
              </div>
              <p className="muted" style={{ marginBottom: "0.5rem" }}>
                点「填入示范回复」可换一条合规范例，再按需改写发送。
              </p>
              <textarea
                rows={4}
                value={text}
                placeholder="用优秀柜员的方式回复客户…"
                onChange={(e) => setText(e.target.value)}
              />
              <p>
                <button
                  type="button"
                  onClick={() => {
                    api
                      .trainingTurn(session.id, text)
                      .then((res) => {
                        setSession(res.session as Session);
                        setText("");
                      })
                      .catch((err: Error) => setError(err.message));
                  }}
                >
                  发送回复
                </button>{" "}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    api
                      .completeTraining(session.id)
                      .then(async (res) => {
                        setSession(res.session as Session);
                        await refreshMeta();
                      })
                      .catch((err: Error) => setError(err.message));
                  }}
                >
                  结束并评分
                </button>
              </p>
            </>
          ) : (
            session.score && (
              <div>
                <h3>评分结果</h3>
                <p>
                  共情 {session.score.empathy} · 合规 {session.score.compliance} · 准确{" "}
                  {session.score.accuracy} · <strong>综合 {session.score.overall}</strong>
                </p>
                {session.score.matchedSuccess && session.score.matchedSuccess.length > 0 && (
                  <p className="ok">命中：{session.score.matchedSuccess.join("；")}</p>
                )}
                {session.score.matchedFail && session.score.matchedFail.length > 0 && (
                  <p className="error">触发失败：{session.score.matchedFail.join("；")}</p>
                )}
                <ul>
                  {session.score.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                {session.score.tips && session.score.tips.length > 0 && (
                  <>
                    <h3>改进建议</h3>
                    <ul>
                      {session.score.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p style={{ marginTop: "1rem" }}>
                  <a href={api.trainingTranscriptDownloadUrl(session.id)} download>
                    下载对练记录（Markdown）
                  </a>
                </p>
                <div style={{ marginTop: "1.25rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
                  <h3>回传纠正到 Distill</h3>
                  <p className="muted">写入蒸馏端纠正并默认升版重导出；培训端下次可发现新推荐包。</p>
                  {fbMsg && <p className="ok">{fbMsg}</p>}
                  <label>场景</label>
                  <input
                    value={fbScene}
                    placeholder={selectedScenario?.title ?? "情景名"}
                    onChange={(e) => setFbScene(e.target.value)}
                  />
                  <label>错误行为</label>
                  <input
                    value={fbWrong}
                    placeholder={session.score?.matchedFail?.[0] ?? "例如：通融代查"}
                    onChange={(e) => setFbWrong(e.target.value)}
                  />
                  <label>正确行为</label>
                  <input
                    value={fbRight}
                    placeholder={session.score?.tips?.[0] ?? "例如：必须本人或合法授权"}
                    onChange={(e) => setFbRight(e.target.value)}
                  />
                  <p style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      disabled={fbBusy}
                      onClick={() => {
                        const sid = session.skillId || skillId;
                        if (!sid) {
                          setError("缺少 skillId，无法回传");
                          return;
                        }
                        setFbBusy(true);
                        setError("");
                        setFbMsg("");
                        api
                          .feedbackCorrection({
                            skillId: sid,
                            scene: fbScene || selectedScenario?.title || session.scenarioId || "对练纠正",
                            wrong:
                              fbWrong ||
                              session.score?.matchedFail?.[0] ||
                              "不符合 Skill 的行为",
                            right:
                              fbRight ||
                              session.score?.tips?.[0] ||
                              "按 Skill 禁区与流程执行",
                            republish: true,
                          })
                          .then((r) => {
                            const ver =
                              r.package && typeof r.package === "object" && "version" in r.package
                                ? String((r.package as { version: number }).version)
                                : "";
                            setFbMsg(
                              ver
                                ? `已回传并升版 v${ver}（包 ${r.packageId}）`
                                : `已回传纠正（包 ${r.packageId}）`,
                            );
                          })
                          .catch((err: Error) => setError(err.message))
                          .finally(() => setFbBusy(false));
                      }}
                    >
                      {fbBusy ? "回传中…" : "回传并升版"}
                    </button>
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="card">
        <h2>情景库</h2>
        <div className="grid">
          {scenarios.map((scene) => (
            <div key={scene.id} className="card" style={{ margin: 0 }}>
              <h3>{scene.title}</h3>
              <p className="muted">
                {scene.category} · {scene.difficulty}
              </p>
              <p>{scene.customerGoal}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
