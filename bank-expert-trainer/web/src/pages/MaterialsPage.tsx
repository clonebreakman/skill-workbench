import { useEffect, useState } from "react";
import { api } from "../api";

const SAMPLE = `柜员：理解您着急。我们先核对您本人身份和账户归属。

柜员：身份与账户一致后，我为您做只读余额查询，完整卡号不会口头报出。

柜员：若需要转账或改密，需转主管授权流程。`;

export function MaterialsPage() {
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [materials, setMaterials] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("王敏");
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("优秀柜员咨询话术（合成）");
  const [content, setContent] = useState(SAMPLE);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [emps, mats] = await Promise.all([api.employees(), api.materials()]);
    setEmployees(emps.employees);
    setMaterials(mats.materials);
    if (!employeeId && emps.employees[0]) {
      setEmployeeId(String(emps.employees[0].id));
    }
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <h1>素材库</h1>
      <p className="muted">仅接受 synthetic / redacted 素材。禁止 raw。</p>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="card">
        <h2>创建合成员工</h2>
        <label>姓名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          onClick={() => {
            setError("");
            api
              .createEmployee({ name, title: "柜员", branch: "演示支行", slug: "wang-min" })
              .then(async () => {
                setMessage("员工已创建");
                await refresh();
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          创建员工
        </button>
      </div>

      <div className="card">
        <h2>上传素材</h2>
        <label>员工</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">请选择</option>
          {employees.map((emp) => (
            <option key={String(emp.id)} value={String(emp.id)}>
              {String(emp.name)} ({String(emp.id)})
            </option>
          ))}
        </select>
        <label>标题</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>正文</label>
        <textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} />
        <button
          type="button"
          onClick={() => {
            setError("");
            api
              .addMaterial({
                employeeId,
                kind: "script",
                title,
                sensitivity: "synthetic",
                content,
              })
              .then(async () => {
                setMessage("素材已入库");
                await refresh();
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          保存素材
        </button>
      </div>

      <div className="card">
        <h2>已有素材</h2>
        <ul>
          {materials.map((mat) => (
            <li key={String(mat.id)}>
              {String(mat.title)} · {String(mat.id)} · {String(mat.sensitivity)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
