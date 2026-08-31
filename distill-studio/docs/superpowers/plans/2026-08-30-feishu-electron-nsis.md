# 飞书云文档拉取 + 双端 Electron NSIS 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** Distill 支持飞书应用凭证拉取云文档为素材；Distill 与 BankExpertTrainer 各自产出 Windows NSIS 安装包（无自动更新）。

**架构：** 飞书逻辑收口在 `src/adapters/feishu.ts`，经 settings / materials API 接入；Electron 主进程复用端口探测，安装包用 `ELECTRON_RUN_AS_NODE=1` 跑 esbuild 打出的 `dist/server.cjs`，数据目录指向 userData。

**技术栈：** Node/TS、Vitest、esbuild、electron、electron-builder（nsis）、飞书 open API（tenant_access_token + docx raw_content）。

**规格：** `docs/superpowers/specs/2026-08-30-feishu-electron-nsis-design.md`

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `DistillStudio/src/adapters/feishu.ts` | URL 解析、token 缓存、ping、拉文档正文 |
| `DistillStudio/src/types.ts` | `FeishuSettings` / `AppSettings.feishu` |
| `DistillStudio/src/store.ts` | settings 合并 `feishu` |
| `DistillStudio/src/server.ts` | feishu-ping、feishu-doc 路由 |
| `DistillStudio/src/main.ts` | 支持 `DATA_DIR` / `STATIC_DIR` |
| `DistillStudio/tests/feishu.test.ts` | 解析与 adapter 单测 |
| `DistillStudio/web/src/pages/SettingsPage.tsx` | 飞书凭证 UI |
| `DistillStudio/web/src/pages/MaterialsPage.tsx` | 云文档导入 UI |
| `DistillStudio/electron/main.cjs` | 安装包/开发双模式启动 |
| `DistillStudio/scripts/build-server.mjs` | esbuild 打 server.cjs |
| `DistillStudio/package.json` | build:server、dist:win、build 配置 |
| `BankExpertTrainer/electron/main.cjs` | Trainer 壳 |
| `BankExpertTrainer/src/main.ts` | DATA_DIR / STATIC_DIR |
| `BankExpertTrainer/scripts/build-server.mjs` | 同 Distill |
| `BankExpertTrainer/package.json` | electron + builder |

---

### 任务 1：飞书适配器（TDD）

**文件：**
- 创建：`C:\Users\11355\DistillStudio\src\adapters\feishu.ts`
- 创建：`C:\Users\11355\DistillStudio\tests\feishu.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { parseFeishuDocToken, FeishuClient } from "../src/adapters/feishu.js";

afterEach(() => vi.unstubAllGlobals());

describe("parseFeishuDocToken", () => {
  it("extracts token from docx url", () => {
    expect(
      parseFeishuDocToken("https://xxx.feishu.cn/docx/AbCdEf1234567890"),
    ).toBe("AbCdEf1234567890");
  });
  it("returns raw token if no url", () => {
    expect(parseFeishuDocToken("AbCdEf1234567890")).toBe("AbCdEf1234567890");
  });
  it("throws FEISHU_BAD_URL on garbage", () => {
    expect(() => parseFeishuDocToken("https://example.com/x")).toThrow("FEISHU_BAD_URL");
  });
});

describe("FeishuClient", () => {
  it("caches tenant token until near expiry", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, tenant_access_token: "t-1", expire: 7200 }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = new FeishuClient({ appId: "id", appSecret: "sec" });
    await c.getTenantToken();
    await c.getTenantToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **步骤 2：运行确认失败** — `npx vitest run tests/feishu.test.ts`

- [ ] **步骤 3：实现 `feishu.ts`**

- `parseFeishuDocToken(input: string): string`
- `FeishuClient`：`getTenantToken()`、`ping()`、`fetchDocPlainText(docToken: string): Promise<string>`
- Token URL：`POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`
- 正文 URL：`GET https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}/raw_content`
- 错误映射：`code !== 0` → `FEISHU_AUTH_FAILED` / `FEISHU_DOC_NOT_FOUND` / `FEISHU_FORBIDDEN`；空正文 → `FEISHU_EMPTY_CONTENT`

- [ ] **步骤 4：测试通过**

- [ ] **步骤 5：Commit** — `feat: add Feishu tenant token client and doc token parser`

---

### 任务 2：Settings + materials API

**文件：**
- 修改：`src/types.ts`、`src/store.ts`（`updateSettings` 合并 `feishu`）、`src/server.ts`、`web/src/api.ts`、`web/src/pages/SettingsPage.tsx`、`web/src/pages/MaterialsPage.tsx`
- 测试：`tests/feishu.test.ts` 或 `tests/api.test.ts` 增补 mock 路由

- [ ] **步骤 1：扩展类型与 store**

```ts
export interface FeishuSettings { appId: string; appSecret: string }
export interface AppSettings {
  adapter: AdapterKind;
  llm?: LlmSettings;
  feishu?: FeishuSettings;
}
```

`updateSettings`：`feishu: patch.feishu !== undefined ? patch.feishu : db.settings.feishu`

- [ ] **步骤 2：API**

- `PUT /api/settings` 接受 `feishu`
- `POST /api/settings/feishu-ping` → `new FeishuClient(...).ping()`
- `POST /api/materials/feishu-doc`：未配置 → 400 `FEISHU_NOT_CONFIGURED`；否则拉正文 `addMaterial({ kind:"script", sensitivity: body.sensitivity ?? "synthetic", title, content })`

- [ ] **步骤 3：UI** — Settings 飞书区；Materials「飞书云文档」表单

- [ ] **步骤 4：API 测（mock fetch）通过后 Commit** — `feat: Feishu settings ping and doc material import`

---

### 任务 3：Distill server 可打包入口

**文件：**
- 修改：`src/main.ts`（读 `process.env.DATA_DIR`、`STATIC_DIR`）
- 创建：`scripts/build-server.mjs`（esbuild bundle `src/main.ts` → `dist/server.cjs`，platform node，format cjs）
- 修改：`package.json` 增加 `esbuild`、`build:server`

- [ ] **步骤 1：main.ts**

```ts
const dataDir = process.env.DATA_DIR ?? join(root, "data");
const staticDir = process.env.STATIC_DIR ?? join(root, "dist", "web");
```

- [ ] **步骤 2：build-server.mjs + `node scripts/build-server.mjs` 产出 `dist/server.cjs`**

- [ ] **步骤 3：`node dist/server.cjs` 能听 health（临时验证后停）**

- [ ] **步骤 4：Commit** — `build: add esbuild server bundle entry`

---

### 任务 4：Distill electron-builder NSIS

**文件：**
- 修改：`electron/main.cjs`（检测 `app.isPackaged`；打包态用 `ELECTRON_RUN_AS_NODE` + `resources/server.cjs`；`DATA_DIR=userData/data`；`STATIC_DIR=resources/web`）
- 修改：`package.json`：`main`、`build` 字段、`dist:win`、devDependency `electron-builder`

示例 builder 片段：

```json
{
  "build": {
    "appId": "com.distillstudio.app",
    "productName": "Distill Studio",
    "directories": { "output": "release" },
    "files": ["electron/**/*", "package.json"],
    "extraResources": [
      { "from": "dist/server.cjs", "to": "server.cjs" },
      { "from": "dist/web", "to": "web" }
    ],
    "win": { "target": ["nsis"] },
    "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
  }
}
```

- [ ] **步骤 1：改 main.cjs 双模式**
- [ ] **步骤 2：`pnpm build:web && pnpm build:server && pnpm exec electron-builder --win nsis`**
- [ ] **步骤 3：确认 `release/*.exe` 存在；README 注明 unsigned / SmartScreen**
- [ ] **步骤 4：Commit** — `feat: Distill Windows NSIS installer via electron-builder`

---

### 任务 5：Trainer Electron + NSIS

**文件：**
- 创建：`BankExpertTrainer/electron/main.cjs`（端口 8866，镜像 Distill）
- 修改：`src/main.ts`（DATA_DIR / STATIC_DIR；Trainer 用 `APP_PORT`）
- 创建：`scripts/build-server.mjs`
- 修改：`package.json`（electron、electron-builder、esbuild、scripts）

- [ ] **步骤 1–4：** 同任务 3–4，appId `com.bankexperttrainer.app`，productName `Bank Expert Trainer`
- [ ] **Commit** — `feat: Trainer Electron shell and Windows NSIS installer`

---

### 任务 6：文档收尾

- 更新两端 `README.md`：飞书配置步骤、`pnpm dist:win`、安装包路径 `release/`
- Distill `start-demo.ps1` 可附一句安装包说明（可选）
- Commit — `docs: Feishu import and NSIS packaging usage`

---

## 规格覆盖自检

| 规格项 | 任务 |
| --- | --- |
| Feishu settings + ping + feishu-doc | 1–2 |
| Materials UI | 2 |
| 不做消息/OAuth/updater | 遵守非目标 |
| Distill NSIS + server.cjs | 3–4 |
| Trainer Electron + NSIS | 5 |
| DATA_DIR userData | 4–5 |
| README | 6 |

## 占位符扫描

无 TODO/待定。
