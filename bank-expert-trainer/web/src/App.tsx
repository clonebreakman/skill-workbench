import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { DistillPage } from "./pages/DistillPage";
import { ImportSkillPage } from "./pages/ImportSkillPage";
import { SkillsPage } from "./pages/SkillsPage";
import { TrainingPage } from "./pages/TrainingPage";

export function App() {
  return (
    <div className="shell">
      <header>
        <div>
          银行优秀员工 Skill 培训平台
          <span className="badge">SYNTHETIC ONLY</span>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            驾驶舱
          </NavLink>
          <NavLink to="/import" className={({ isActive }) => (isActive ? "active" : "")}>
            导入 Skill
          </NavLink>
          <NavLink to="/skills" className={({ isActive }) => (isActive ? "active" : "")}>
            Skill 仓库
          </NavLink>
          <NavLink to="/training" className={({ isActive }) => (isActive ? "active" : "")}>
            培训对练
          </NavLink>
          <NavLink to="/distill" className={({ isActive }) => (isActive ? "active" : "")}>
            蒸馏说明
          </NavLink>
          <NavLink to="/materials" className={({ isActive }) => (isActive ? "active" : "")}>
            素材（遗留）
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/import" element={<ImportSkillPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/distill" element={<DistillPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/training" element={<TrainingPage />} />
        </Routes>
      </main>
    </div>
  );
}
