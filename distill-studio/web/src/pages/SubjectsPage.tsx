import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PackageRecord, type Subject } from "../api";

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [name, setName] = useState("王敏");
  const [slug, setSlug] = useState("wang-min");
  const [hint, setHint] = useState("银行柜员优秀员工");
  const [error, setError] = useState("");

  async function refresh() {
    const [res, pkgs] = await Promise.all([api.subjects(), api.packages()]);
    setSubjects(res.subjects);
    setPackages(pkgs.packages);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  function activeFor(subjectId: string) {
    return packages.find((p) => p.subjectId === subjectId && p.active);
  }

  return (
    <>
      <h1>蒸馏对象</h1>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <h2>新建</h2>
        <label>姓名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>slug</label>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        <label>分类提示（hint）</label>
        <input value={hint} onChange={(e) => setHint(e.target.value)} />
        <p style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              api
                .createSubject({ name, slug, hint, profile: { title: "柜员", org: "演示支行" } })
                .then(() => refresh())
                .catch((e: Error) => setError(e.message));
            }}
          >
            创建
          </button>
        </p>
      </div>
      <div className="card">
        <h2>列表</h2>
        <ul>
          {subjects.map((s) => {
            const active = activeFor(s.id);
            return (
              <li key={s.id} style={{ marginBottom: "0.75rem" }}>
                <strong>
                  {s.name} · {s.slug}
                </strong>{" "}
                · {s.type} · {s.status}
                <div className="muted" style={{ fontSize: "0.85em" }}>
                  {s.id}
                  {active
                    ? ` · 激活包 v${active.version}（${active.id}）`
                    : " · 无激活包"}
                </div>
                {active && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <Link to="/export">去导出</Link>
                    {" · "}
                    <Link to="/evolve">演进</Link>
                    {" · "}
                    <a href={`/api/packages/${encodeURIComponent(active.id)}/download`} download>
                      下载激活 ZIP
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
