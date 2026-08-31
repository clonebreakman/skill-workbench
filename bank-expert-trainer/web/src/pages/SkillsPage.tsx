import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type SkillRow = {
  id: string;
  slug: string;
  version: number;
  workSkill?: {
    scope?: string;
    workflows?: string[];
    forbidden?: string[];
    decisionRules?: string[];
  };
  persona?: {
    identity?: string;
    antiPatterns?: string[];
  };
};

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .skills()
      .then((data) => setSkills(data.skills as SkillRow[]))
      .catch((err: Error) => setError(err.message));
  }, []);

  const selected = skills.find((s) => s.id === selectedId);

  return (
    <>
      <h1>Skill 仓库</h1>
      <p className="muted">已导入 Skill 可查看摘要 / SKILL.md，并跳转对练。</p>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <ul>
          {skills.map((skill) => (
            <li key={skill.id} style={{ marginBottom: ".75rem" }}>
              <strong>
                {skill.slug} · v{skill.version}
              </strong>{" "}
              · {skill.id}{" "}
              <button type="button" className="secondary" onClick={() => setSelectedId(skill.id)}>
                摘要
              </button>{" "}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  api
                    .exportSkill(skill.id)
                    .then((data) => {
                      setSelectedId(skill.id);
                      setMarkdown(data.skillMarkdown);
                    })
                    .catch((err: Error) => setError(err.message));
                }}
              >
                SKILL.md
              </button>{" "}
              <Link to={`/training?skillId=${encodeURIComponent(skill.id)}`}>去对练</Link>
            </li>
          ))}
        </ul>
        {skills.length === 0 && (
          <p className="muted">
            暂无 Skill。<Link to="/import">去导入</Link>
          </p>
        )}
      </div>
      {selected && (
        <div className="card">
          <h2>
            摘要 · {selected.slug} v{selected.version}
          </h2>
          {selected.persona?.identity && <p className="muted">{selected.persona.identity}</p>}
          {selected.workSkill?.scope && (
            <p>
              <strong>范围：</strong>
              {selected.workSkill.scope}
            </p>
          )}
          {selected.workSkill?.workflows && selected.workSkill.workflows.length > 0 && (
            <p>
              <strong>流程：</strong>
              {selected.workSkill.workflows.slice(0, 5).join("；")}
            </p>
          )}
          {selected.workSkill?.forbidden && selected.workSkill.forbidden.length > 0 && (
            <p>
              <strong>禁区：</strong>
              {selected.workSkill.forbidden.slice(0, 5).join("；")}
            </p>
          )}
          {selected.workSkill?.decisionRules && selected.workSkill.decisionRules.length > 0 && (
            <p>
              <strong>决策：</strong>
              {selected.workSkill.decisionRules.slice(0, 4).join("；")}
            </p>
          )}
          {selected.persona?.antiPatterns && selected.persona.antiPatterns.length > 0 && (
            <p>
              <strong>反模式：</strong>
              {selected.persona.antiPatterns.slice(0, 4).join("；")}
            </p>
          )}
        </div>
      )}
      {markdown && (
        <div className="card">
          <h2>SKILL.md</h2>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: "28rem", overflow: "auto" }}>{markdown}</pre>
        </div>
      )}
    </>
  );
}
