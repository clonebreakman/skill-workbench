import { Link } from "react-router-dom";

export function DistillPage() {
  return (
    <>
      <h1>蒸馏工作台（已迁出）</h1>
      <div className="card">
        <p>
          内置蒸馏主路径已停用。请使用独立产品 <strong>Distill Studio</strong>（默认{" "}
          <a href="http://127.0.0.1:8877/" target="_blank" rel="noreferrer">
            http://127.0.0.1:8877/
          </a>
          ）完成 Phase 0–7 蒸馏与双导出。
        </p>
        <p className="muted">本平台仅消费 Distill Studio 导出的 training-skill 包，用于培训对练。</p>
        <p>
          <Link className="btn" to="/import">
            去导入 Skill
          </Link>
        </p>
      </div>
    </>
  );
}
