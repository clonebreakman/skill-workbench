# 银行优秀员工 Skill 蒸馏平台（第一期）实现计划

> **面向 AI 代理的工作者：** 逐任务实现；步骤用复选框跟踪。规格见 `docs/superpowers/specs/2026-08-29-bank-expert-skill-trainer-design.md`。

**目标：** 交付可一键启动的本机 Web App：合成员工素材 → Mock 蒸馏（Work Skill + Persona + 证据）→ 审核发布 → 导出 `SKILL.md`；培训页占位。

**架构：** 单仓 TypeScript：Node `http` API + 文件系统/JSON 仓库 + React/Vite 前端；蒸馏流水线可插拔（默认 Mock）。

**技术栈：** Node 22、pnpm、TypeScript、Vite、React、Vitest。

---

## 文件清单

### 创建

- `package.json` / `tsconfig.json` / `vitest.config.ts` / `.gitignore` / `README.md`
- `src/types.ts` — 领域类型
- `src/store.ts` — 员工/素材/任务/Skill 持久化（`data/db.json` + `data/materials/` + `data/skills/`）
- `src/distill/slice.ts` — 文本切片
- `src/distill/evidence.ts` — 证据分级与占比校验
- `src/distill/mock-extractor.ts` — Mock 抽取 Work Skill / Persona
- `src/distill/pipeline.ts` — 编排入库→切片→抽取→证据
- `src/distill/publish.ts` — 审核门槛与发布版本
- `src/distill/export-skill.ts` — 生成 `SKILL.md` 与目录
- `src/server.ts` — HTTP API + 静态托管
- `src/main.ts` — 进程入口
- `web/` — React 页面：首页、素材、蒸馏、仓库、培训占位
- `data/samples/` — 合成柜员素材
- `tests/*.test.ts` — 流水线与 API 测试

### 任务

1. 骨架与合成样本  
2. 蒸馏流水线 + 单测  
3. HTTP API + 集成测  
4. React UI + `pnpm app`  
5. README 与冒烟验证  

---

### 任务 1：项目骨架

- [ ] 初始化 package.json（scripts: `app`, `dev`, `test`, `build`）
- [ ] 写入合成柜员样本 `data/samples/teller-wang-*.md`
- [ ] `.gitignore`

### 任务 2：蒸馏引擎

- [ ] 测试：空素材拒绝；Mock 产出双层结构；L1+L2 阈值
- [ ] 实现 slice / mock-extractor / evidence / pipeline / publish / export

### 任务 3：API

- [ ] 测试：health、创建员工、上传素材元数据、蒸馏、审核、发布、导出
- [ ] 实现 `server.ts` + `main.ts`

### 任务 4：Web UI

- [ ] Vite React：驾驶舱、素材库、蒸馏台、Skill 仓库、培训占位
- [ ] 构建产物由 Node 托管

### 任务 5：验收

- [ ] `pnpm test` 全绿
- [ ] `pnpm app` 可打开并走通主路径
