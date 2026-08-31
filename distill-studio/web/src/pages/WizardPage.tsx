import { useEffect, useState } from "react";
import { api, type DistillRun, type Material, type PackageRecord, type Subject } from "../api";

export function WizardPage() {
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [run, setRun] = useState<DistillRun | null>(null);
  const [pkg, setPkg] = useState<PackageRecord | null>(null);
  const [error, setError] = useState("");
  const [intake, setIntake] = useState({ purpose: "柜员培训", scope: "查询与核身", taboo: "不报完整卡号" });

  useEffect(() => {
    api
      .subjects()
      .then(async (s) => {
        setSubjects(s.subjects);
        const id = s.subjects[0]?.id ?? "";
        setSubjectId(id);
        if (id) setMaterials((await api.materials(id)).materials);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const steps = ["分类", "伦理", "Intake", "素材", "抽取", "证据", "发布"];

  return (
    <>
      <h1>蒸馏向导</h1>
      <div className="steps">
        {steps.map((label, i) => (
          <span key={label} className={i <= step ? "on" : ""}>
            {i}. {label}
          </span>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <label>对象</label>
        <select
          value={subjectId}
          onChange={async (e) => {
            setSubjectId(e.target.value);
            setMaterials((await api.materials(e.target.value)).materials);
          }}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.type}
            </option>
          ))}
        </select>

        {step <= 1 && (
          <>
            <p className="muted">Phase 1：勾选伦理后继续</p>
            <button
              type="button"
              onClick={() => {
                api
                  .ethics(subjectId, { consent: true, purposeOk: true, noRawPiiClaim: true })
                  .then(() => setStep(2))
                  .catch((e: Error) => setError(e.message));
              }}
            >
              确认伦理并通过
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <label>用途</label>
            <input value={intake.purpose} onChange={(e) => setIntake({ ...intake, purpose: e.target.value })} />
            <label>材料范围</label>
            <input value={intake.scope} onChange={(e) => setIntake({ ...intake, scope: e.target.value })} />
            <label>禁忌</label>
            <input value={intake.taboo} onChange={(e) => setIntake({ ...intake, taboo: e.target.value })} />
            <p style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => {
                  api
                    .intake(subjectId, intake)
                    .then(() => setStep(3))
                    .catch((e: Error) => setError(e.message));
                }}
              >
                保存 Intake
              </button>
            </p>
          </>
        )}

        {step >= 3 && step < 6 && (
          <>
            <p className="muted">已选素材 {materials.length} 条。将跑 Phase 4–5。</p>
            <button
              type="button"
              onClick={() => {
                api
                  .run({ subjectId, materialIds: materials.map((m) => m.id) })
                  .then((r) => {
                    setRun(r.run);
                    setStep(5);
                  })
                  .catch((e: Error) => setError(e.message));
              }}
            >
              运行抽取与证据
            </button>
          </>
        )}

        {run && (
          <div style={{ marginTop: "1rem" }}>
            <h3>草稿 Run · {run.status}</h3>
            {run.dimensions && typeof run.dimensions === "object" && "personality" in (run.dimensions as object) && (
              <p className="muted">
                已抽取 Work Skill + Distilly 六层 Persona
                {(run.dimensions as { personality?: { layers?: { hardRules?: string[] } } }).personality?.layers
                  ?.hardRules?.length
                  ? ` · 硬规则 ${
                      (run.dimensions as { personality: { layers: { hardRules: string[] } } }).personality.layers
                        .hardRules.length
                    } 条`
                  : ""}
              </p>
            )}
            <pre>{JSON.stringify({ dimensions: run.dimensions, evidence: run.evidence }, null, 2)}</pre>
            <button
              type="button"
              onClick={() => {
                api
                  .publish(run.id)
                  .then((r) => {
                    setPkg(r.package);
                    setStep(6);
                  })
                  .catch((e: Error) => setError(e.message));
              }}
            >
              发布双导出
            </button>
          </div>
        )}

        {pkg && (
          <div style={{ marginTop: "1rem" }}>
            <h3>已发布 v{pkg.version}</h3>
            <p>OpenPersona：{pkg.openPersonaPath}</p>
            <p>培训 Skill：{pkg.trainingSkillPath}</p>
          </div>
        )}
      </div>
    </>
  );
}
