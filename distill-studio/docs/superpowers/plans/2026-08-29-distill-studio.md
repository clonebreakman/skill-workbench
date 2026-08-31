# Distill Studio 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建成独立 Distill Studio（anyone-skill Phase 0–7、双导出、Web+Electron），并让 BankExpertTrainer 改为仅导入 training-skill 包后对练。

**架构：** 新建 `C:\Users\11355\DistillStudio` 单体：Node/TS 引擎 + HTTP API（8877）+ React Web + Electron 壳；`data/` 持久化，`exports/openpersona` 与 `exports/training-skill` 双写。BankExpertTrainer 停用内置蒸馏入口，新增导入页消费导出契约。

**技术栈：** Node.js、TypeScript、React、Vite、Vitest、tsx、Electron（后期打包）、pnpm/corepack。

**规格：** `docs/superpowers/specs/2026-08-29-distill-studio-design.md`

---

## 文件结构（将创建）

```text
DistillStudio/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    types.ts                 # 领域类型
    store.ts                 # db.json + 文件路径
    main.ts                  # 启动 8877
    server.ts                # HTTP API + 静态托管
    phases/
      classify.ts            # Phase 0
      ethics.ts              # Phase 1
      intake.ts              # Phase 2
      materials.ts           # Phase 3 helpers
      extract.ts             # Phase 4 mock/llm
      evidence.ts            # Phase 5
      export-packages.ts     # Phase 6 双导出
      evolve.ts              # Phase 7
    pipeline.ts              # 编排 runPhases / publish
    adapters/
      mock.ts
      llm.ts
  web/
    index.html
    vite.config.ts
    src/main.tsx
    src/App.tsx
    src/api.ts
    src/styles.css
    src/pages/
      HomePage.tsx
      SubjectsPage.tsx
      MaterialsPage.tsx
      WizardPage.tsx
      WarehousePage.tsx
      EvolvePage.tsx
      ExportPage.tsx
      SettingsPage.tsx
  electron/
    main.cjs
  data/                      # gitignore
  exports/                   # gitignore
  tests/
    classify.test.ts
    ethics.test.ts
    extract-evidence.test.ts
    export.test.ts
    evolve.test.ts
    api.test.ts
  samples/
    teller-wang-synthetic.md
  README.md
```

BankExpertTrainer 修改：

```text
web/src/pages/ImportSkillPage.tsx   # 新建
web/src/pages/DistillPage.tsx       # 改为跳转/停用说明
web/src/App.tsx                     # 路由
web/src/api.ts                      # importSkill
src/server.ts                       # POST /api/skills/import
src/import-skill.ts                 # 新建
tests/import-skill.test.ts          # 新建
```

---

### 任务 1：脚手架与类型

**文件：**
- 创建：`package.json`、`tsconfig.json`、`vitest.config.ts`、`src/types.ts`、`.gitignore`、`README.md`

- [ ] **步骤 1：初始化 package.json**

```json
{
  "name": "distill-studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "app": "pnpm build:web && tsx src/main.ts",
    "dev": "tsx src/main.ts",
    "build:web": "vite build --config web/vite.config.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "electron": "pnpm build:web && electron electron/main.cjs"
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-router-dom": "^7.8.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "@types/react": "^19.1.12",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react": "^5.0.2",
    "electron": "^37.2.0",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3",
    "vite": "^7.1.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **步骤 2：写入 `src/types.ts`（完整领域类型）**

必须包含：`SubjectType`（六类）、`Sensitivity`、`EvidenceLevel`、`Subject`、`Material`、`DimensionBundle`（procedure/interaction/memory/personality）、`EvidenceItem`、`DistillRun`、`PackageRecord`、`Correction`、`Database`、`WorkSkill`、`Persona`、`EthicsState`、`IntakeAnswers`。

关键枚举：

```ts
export type SubjectType =
  | "self"
  | "known"
  | "public"
  | "fictional"
  | "historical"
  | "archetype";

export type EvidenceLevel = "L1" | "L2" | "L3" | "L4";
export type Sensitivity = "synthetic" | "redacted" | "raw";
export type AdapterKind = "mock" | "llm";
```

- [ ] **步骤 3：`.gitignore` 加入 `node_modules/`、`data/`、`exports/`、`dist/`、`.env`**

- [ ] **步骤 4：安装依赖**

运行：`cd C:\Users\11355\DistillStudio && corepack pnpm install`  
预期：lockfile 生成，无 error

- [ ] **步骤 5：Commit（若用户要求 git）**

```bash
git init
git add package.json tsconfig.json src/types.ts .gitignore README.md
git commit -m "chore: scaffold Distill Studio types and package"
```

---

### 任务 2：Store

**文件：**
- 创建：`src/store.ts`
- 测试：`tests/store.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppStore } from "../src/store.js";

describe("AppStore", () => {
  it("creates subject and persists materials", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ds-"));
    const store = new AppStore(dir);
    await store.init();
    const s = await store.createSubject({
      slug: "wang-min",
      name: "王敏",
      type: "known",
      profile: { title: "柜员", org: "演示支行" },
    });
    expect(s.id).toMatch(/^SUB-/);
    const m = await store.addMaterial({
      subjectId: s.id,
      kind: "script",
      title: "话术",
      sensitivity: "synthetic",
      fileName: "a.md",
      content: "理解您着急，先核身。",
    });
    expect((await store.listMaterials(s.id)).map((x) => x.id)).toContain(m.id);
  });
});
```

- [ ] **步骤 2：运行确认失败**

运行：`pnpm test -- tests/store.test.ts`  
预期：FAIL（AppStore 未定义）

- [ ] **步骤 3：实现 `AppStore`**

职责：`rootDir`、`dataDir`、`knowledgeDir`、`exportsDir`；`load/save` `db.json`；`createSubject`、`getSubject`、`listSubjects`、`updateSubject`；`addMaterial`（写 `knowledge/{subjectId}/`）；`listMaterials`、`readMaterialContent`；`upsertRun`、`getRun`；`addPackage`、`listPackages`、`getPackage`；`addCorrection`、`listCorrections`。空库默认：

```ts
{ subjects: [], materials: [], runs: [], packages: [], corrections: [], settings: { adapter: "mock" } }
```

- [ ] **步骤 4：运行测试通过**

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/store.ts tests/store.test.ts
git commit -m "feat: add AppStore persistence for subjects and materials"
```

---

### 任务 3：Phase 0–1 分类与伦理

**文件：**
- 创建：`src/phases/classify.ts`、`src/phases/ethics.ts`
- 测试：`tests/classify.test.ts`、`tests/ethics.test.ts`

- [ ] **步骤 1：失败测试 — 分类**

```ts
import { classifySubject } from "../src/phases/classify.js";
import { expect, it } from "vitest";

it("maps bank teller hint to known", () => {
  const r = classifySubject({ hint: "银行柜员优秀员工", explicitType: undefined });
  expect(r.type).toBe("known");
  expect(r.tags).toContain("bank-teller");
});

it("respects explicit type", () => {
  expect(classifySubject({ explicitType: "archetype" }).type).toBe("archetype");
});
```

- [ ] **步骤 2：实现 `classifySubject`**

规则：有 `explicitType` 用显式；否则 hint 含「柜员|银行|同事」→ `known` + `bank-teller`；含「自己|我」→ `self`；含「名人|公众」→ `public`；默认 `known`。

- [ ] **步骤 3：失败测试 — 伦理**

```ts
import { evaluateEthics } from "../src/phases/ethics.js";
import { expect, it } from "vitest";

it("blocks when consent missing", () => {
  const r = evaluateEthics({ consent: false, purposeOk: true, noRawPiiClaim: true });
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("CONSENT_REQUIRED");
});

it("passes with all checks", () => {
  expect(evaluateEthics({ consent: true, purposeOk: true, noRawPiiClaim: true }).ok).toBe(true);
});
```

- [ ] **步骤 4：实现并跑通测试**

`evaluateEthics` 返回 `{ ok: boolean; reason?: string }`。

- [ ] **步骤 5：Commit**

```bash
git commit -m "feat: add phase 0 classify and phase 1 ethics gates"
```

---

### 任务 4：Phase 2–3 Intake 与素材校验

**文件：**
- 创建：`src/phases/intake.ts`、`src/phases/materials.ts`
- 测试：`tests/intake-materials.test.ts`

- [ ] **步骤 1：测试**

```ts
it("requires three intake answers", () => {
  expect(validateIntake({ purpose: "", scope: "x", taboo: "y" }).ok).toBe(false);
  expect(validateIntake({ purpose: "培训", scope: "话术", taboo: "不报完整卡号" }).ok).toBe(true);
});

it("rejects raw sensitivity for publish path", () => {
  expect(assertPublishableSensitivity("raw").ok).toBe(false);
  expect(assertPublishableSensitivity("synthetic").ok).toBe(true);
});
```

- [ ] **步骤 2：实现 `validateIntake`、`assertPublishableSensitivity`**

- [ ] **步骤 3：测试 PASS 后 Commit**

```bash
git commit -m "feat: add intake validation and material sensitivity gate"
```

---

### 任务 5：Phase 4–5 Mock 抽取与证据

**文件：**
- 创建：`src/adapters/mock.ts`、`src/phases/extract.ts`、`src/phases/evidence.ts`
- 测试：`tests/extract-evidence.test.ts`
- 样本：`samples/teller-wang-synthetic.md`

- [ ] **步骤 1：样本内容**

写入至少含：共情、核身、只读查询、转主管、不报完整卡号 等句。

- [ ] **步骤 2：失败测试**

```ts
it("mock extract fills four dimensions and evidence", async () => {
  const dims = mockExtract({
    subjectName: "王敏",
    texts: ["理解您着急，先核对身份。只读查询余额。不得口头报完整卡号。转账需转主管。"],
  });
  expect(dims.procedure.workflows.length).toBeGreaterThan(0);
  expect(dims.interaction.expression.length).toBeGreaterThan(0);
  const ev = gradeEvidence(dims, texts);
  expect(ev.some((e) => e.level === "L1")).toBe(true);
  expect(strongEvidenceRatio(ev)).toBeGreaterThanOrEqual(0.6);
});

it("canPublish respects 60% gate", () => {
  expect(canPublish([{ level: "L4" }, { level: "L4" }]).ok).toBe(false);
  expect(canPublish([{ level: "L1" }, { level: "L2" }]).ok).toBe(true);
});
```

（`texts` 传入 `gradeEvidence` 时用同一批字符串；类型以 `src/types.ts` 为准。）

- [ ] **步骤 3：实现 Mock**

关键词规则：

- `身份|证件|核身` → procedure.workflows + L1 证据  
- `理解|着急|抱歉` → interaction.expression  
- `完整卡号|通融` → procedure.forbidden / personality.antiPatterns  
- `主管|升级` → procedure.decisionRules  
- 无匹配句 → L3/L4 弱启发（控制比例使合成样本 ≥60% 强证据）

- [ ] **步骤 4：`extract.ts` 封装**

```ts
export async function runExtract(opts: {
  adapter: AdapterKind;
  subjectName: string;
  texts: string[];
  llm?: { baseUrl: string; apiKey: string; model: string };
}): Promise<{ dimensions: DimensionBundle; adapterUsed: AdapterKind }>
```

`llm` 失败 catch 后回退 `mock`，`adapterUsed: "mock"`。

- [ ] **步骤 5：最小 `src/adapters/llm.ts`**

`fetch(baseUrl/chat/completions)`；解析失败抛错。第一期可不测真实网络，单测 mock 回退路径即可：

```ts
it("falls back to mock when llm throws", async () => {
  const r = await runExtract({
    adapter: "llm",
    subjectName: "x",
    texts: ["核身"],
    llm: { baseUrl: "http://127.0.0.1:9", apiKey: "x", model: "x" },
  });
  expect(r.adapterUsed).toBe("mock");
});
```

- [ ] **步骤 6：测试 PASS + Commit**

```bash
git commit -m "feat: mock four-dimension extract and L1-L4 evidence gate"
```

---

### 任务 6：Phase 6 双导出

**文件：**
- 创建：`src/phases/export-packages.ts`
- 测试：`tests/export.test.ts`

- [ ] **步骤 1：失败测试**

```ts
it("writes openpersona and training-skill trees", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ds-exp-"));
  const store = new AppStore(dir);
  await store.init();
  // create subject + run dimensions + evidence (inline fixtures)
  const paths = await exportPackages(store, {
    subjectId: subject.id,
    version: 1,
    dimensions,
    evidence,
  });
  const { readFile } = await import("node:fs/promises");
  const skillMd = await readFile(join(paths.trainingSkillPath, "SKILL.md"), "utf8");
  expect(skillMd).toContain("name:");
  const meta = JSON.parse(await readFile(join(paths.trainingSkillPath, "meta.json"), "utf8"));
  expect(meta.source).toBe("distill-studio");
  await readFile(join(paths.openPersonaPath, "persona.json"), "utf8");
  await readFile(join(paths.openPersonaPath, "soul/constitution.md"), "utf8");
});
```

- [ ] **步骤 2：实现导出**

映射：

- Procedure → `work-skill.json`  
- Interaction+Personality → `persona.json`  
- 写 `SKILL.md`（YAML frontmatter：`name`、`description`）  
- OpenPersona：`persona.json`、`state.json`、`soul/injection.md`、`soul/constitution.md`、`agent-card.json`、`SKILL.md`、`meta.json`  
- `store.addPackage(...)`

- [ ] **步骤 3：PASS + Commit**

```bash
git commit -m "feat: dual-export OpenPersona and training-skill packages"
```

---

### 任务 7：Phase 7 演进与流水线编排

**文件：**
- 创建：`src/phases/evolve.ts`、`src/pipeline.ts`
- 测试：`tests/evolve.test.ts`、`tests/pipeline.test.ts`

- [ ] **步骤 1：纠正测试**

```ts
it("applies correction and bumps version on re-export", async () => {
  // publish v1, applyCorrection({ scene, wrong, right }), republish → v2
  expect(v2.version).toBe(2);
  const list = await store.listCorrections(pkg.id);
  expect(list.length).toBe(1);
});

it("rollback restores previous training-skill path pointer", async () => {
  const rolled = await rollbackPackage(store, subjectId, 1);
  expect(rolled.version).toBe(1);
});
```

- [ ] **步骤 2：实现 `applyCorrection`、`rollbackPackage`、`runFullPipeline`**

`runFullPipeline(store, { subjectId, materialIds })` 顺序：

1. 读 subject；`evaluateEthics` 失败抛 `ETHICS_BLOCKED`  
2. `validateIntake`  
3. 读素材；全部 `assertPublishableSensitivity`  
4. `runExtract` + `gradeEvidence`  
5. 存 `DistillRun` status=`draft`  
不自动 publish；`publishRun` 再查 `canPublish`。

- [ ] **步骤 3：PASS + Commit**

```bash
git commit -m "feat: evolve corrections rollback and full pipeline orchestration"
```

---

### 任务 8：HTTP API

**文件：**
- 创建：`src/server.ts`、`src/main.ts`
- 测试：`tests/api.test.ts`

- [ ] **步骤 1：API 契约测试（用临时端口）**

覆盖：

- `GET /health` → `{ ok: true }`  
- `POST /api/subjects` → 创建 known  
- `POST /api/subjects/:id/ethics`  
- `POST /api/subjects/:id/intake`  
- `POST /api/materials`  
- `POST /api/runs` → 跑 pipeline 至 draft  
- `POST /api/runs/:id/publish` → 双导出  
- `GET /api/packages`  
- `POST /api/packages/:id/corrections`  
- `GET /api/settings` / `PUT /api/settings`

- [ ] **步骤 2：实现 `startServer`（对齐 BankExpertTrainer 风格：node:http + JSON）**

默认 port `8877`；`staticDir` 指向 `dist/web`。

- [ ] **步骤 3：`main.ts`**

```ts
const root = join(fileURLToPath(new URL("..", import.meta.url)));
const store = new AppStore(join(root, "data"));
await store.init();
const { url } = await startServer({ store, port: Number(process.env.PORT ?? 8877), staticDir: join(root, "dist", "web") });
console.log(`Distill Studio 已启动\n打开 ${url}/`);
```

- [ ] **步骤 4：PASS + Commit**

```bash
git commit -m "feat: expose Distill Studio HTTP API on 8877"
```

---

### 任务 9：Web UI

**文件：**
- 创建：`web/*` 全部页面与路由

- [ ] **步骤 1：Vite React 脚手架**

`web/vite.config.ts` outDir → `../dist/web`；`base: "/"`。

- [ ] **步骤 2：页面最小可用**

| 页 | 行为 |
| --- | --- |
| Home | 对象数、草稿、已发布、入口按钮 |
| Subjects | 列表 + 新建（类型/姓名/slug） |
| Materials | 选对象、上传文本、sensitivity |
| Wizard | 步骤条 0–6：伦理勾选 → intake → 触发 run → 四维/证据预览 → publish |
| Warehouse | 包列表、打开路径提示 |
| Evolve | 纠正表单、版本回滚 |
| Export | 展示 openpersona / training-skill 路径 |
| Settings | adapter mock/llm、baseUrl、model、apiKey（存 settings） |

- [ ] **步骤 3：手动冒烟**

运行：`pnpm app`  
打开：`http://127.0.0.1:8877/`  
预期：向导可发布，Export 页显示两路径

- [ ] **步骤 4：Commit**

```bash
git commit -m "feat: add Distill Studio web wizard and warehouse UI"
```

---

### 任务 10：Electron 壳

**文件：**
- 创建：`electron/main.cjs`、`scripts/launch-desktop.bat`（可选）

- [ ] **步骤 1：`main.cjs`**

- 设置 `ELECTRON_USER_DATA` 到 `%USERPROFILE%\.distill-studio-electron` 或 `D:\DistillStudio\electron-user-data`  
- `spawn`/`fork`：`tsx src/main.ts` 或 `node` 跑已编译入口；等 `/health`  
- `BrowserWindow` 加载 `http://127.0.0.1:8877/`  
- 退出时杀子进程

- [ ] **步骤 2：`pnpm electron` 能出窗口**（若环境缺显示则至少进程起服务）

- [ ] **步骤 3：Commit**

```bash
git commit -m "feat: add Electron shell for Distill Studio"
```

---

### 任务 11：BankExpertTrainer 导入改造

**文件：**
- 创建：`C:\Users\11355\BankExpertTrainer\src\import-skill.ts`、`web/src/pages/ImportSkillPage.tsx`、`tests/import-skill.test.ts`
- 修改：`src/server.ts`、`web/src/App.tsx`、`web/src/api.ts`、`web/src/pages/DistillPage.tsx`、`web/src/pages/HomePage.tsx`、`README.md`

- [ ] **步骤 1：测试导入**

```ts
it("imports training-skill directory into store", async () => {
  // 构造临时 training-skill 目录（meta.source=distill-studio）
  const skill = await importTrainingSkill(store, tmpSkillDir);
  expect(skill.slug).toBe("wang-min");
  expect((await store.listSkills()).length).toBe(1);
});
```

- [ ] **步骤 2：实现 `importTrainingSkill`**

读 `meta.json` + `SKILL.md` + json；写入培训端 `skills/` 与 db；生成新 `PublishedSkill` id。

- [ ] **步骤 3：`POST /api/skills/import` body: `{ dirPath: string }`（本机路径，演示环境可接受）**

- [ ] **步骤 4：UI「导入 Skill」；蒸馏页改为说明「请使用 Distill Studio :8877」**

- [ ] **步骤 5：端到端冒烟**

1. Distill Studio 发布  
2. Trainer 导入 `exports/training-skill/...`  
3. `/training` 开一局对练出分  

- [ ] **步骤 6：Commit（BankExpertTrainer 仓库）**

```bash
git commit -m "feat: import Distill Studio training-skill packages; retire built-in distill entry"
```

---

### 任务 12：收尾验证

- [ ] **步骤 1：`DistillStudio` 下 `pnpm test` 全绿**  
- [ ] **步骤 2：`pnpm typecheck` 通过**  
- [ ] **步骤 3：`BankExpertTrainer` 下 `pnpm test` 全绿（更新/删除失效的内置蒸馏 E2E 或改为 skip/改写为 import 流）**  
- [ ] **步骤 4：更新两边 README 演示路径**  
- [ ] **步骤 5：对照规格 §13 成功标准逐条勾选**

---

## 规格覆盖自检

| 规格章节 | 对应任务 |
| --- | --- |
| §1–2 目标/非目标 | 任务 9/11 范围控制；不做飞书真采集 |
| §3 决策 | 贯穿全部 |
| §4 架构 | 任务 1、8、10、11 |
| §5 七阶段 UI/引擎 | 任务 3–7、9 |
| §6–7 数据与双导出 | 任务 2、6 |
| §8 适配器 | 任务 5 |
| §9 门禁 | 任务 3–5、7 |
| §10 测试 | 各任务测试 + 任务 12 |
| §11 培训端 | 任务 11 |
| §12 栈与目录 | 任务 1 |
| §13 成功标准 | 任务 12 |

**占位符扫描：** 无 TODO/待定。  
**类型一致性：** `SubjectType`、`EvidenceLevel`、`AdapterKind`、`DimensionBundle`、`PackageRecord` 以任务 1 `types.ts` 为准，后续任务不得另起别名。

---

## 执行交接

计划已保存到 `C:\Users\11355\DistillStudio\docs\superpowers\plans\2026-08-29-distill-studio.md`。

**两种执行方式：**

1. **子代理驱动（推荐）** — 每任务新子代理 + 任务间审查  
2. **内联执行** — 本会话按 executing-plans 批量推进并设检查点  

选哪种方式？
