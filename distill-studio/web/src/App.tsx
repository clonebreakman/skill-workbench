import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { SubjectsPage } from "./pages/SubjectsPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { WizardPage } from "./pages/WizardPage";
import { WarehousePage } from "./pages/WarehousePage";
import { EvolvePage } from "./pages/EvolvePage";
import { ExportPage } from "./pages/ExportPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <div className="shell">
      <header>
        <div>
          Distill Studio
          <span className="badge">ANYONE · PHASE 0–7</span>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            驾驶舱
          </NavLink>
          <NavLink to="/subjects" className={({ isActive }) => (isActive ? "active" : "")}>
            对象
          </NavLink>
          <NavLink to="/materials" className={({ isActive }) => (isActive ? "active" : "")}>
            素材
          </NavLink>
          <NavLink to="/wizard" className={({ isActive }) => (isActive ? "active" : "")}>
            蒸馏向导
          </NavLink>
          <NavLink to="/warehouse" className={({ isActive }) => (isActive ? "active" : "")}>
            仓库
          </NavLink>
          <NavLink to="/evolve" className={({ isActive }) => (isActive ? "active" : "")}>
            演进
          </NavLink>
          <NavLink to="/export" className={({ isActive }) => (isActive ? "active" : "")}>
            导出
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            设置
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/evolve" element={<EvolvePage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
