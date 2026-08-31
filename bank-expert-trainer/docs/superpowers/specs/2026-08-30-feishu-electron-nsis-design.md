# 飞书应用凭证拉取 + 双端 Electron NSIS 安装包 — 设计规格

**状态：** 分节设计已获用户批准（飞书方案 A · 安装包方案 A）；书面规格待用户审查。  
**日期：** 2026-08-30  
**范围：** Distill Studio 飞书云文档在线导入；Distill / BankExpertTrainer 各自 Windows NSIS 安装包（无自动更新）。

## 1. 目标

1. **飞书在线导入（Distill）**：用企业自建应用 `App ID` / `App Secret` 换取 `tenant_access_token`，按云文档 token（或可解析的文档 URL）拉取正文，写入现有素材库。
2. **Distill Electron 正式包**：`electron-builder` 产出 Windows NSIS 安装包（`.exe`），安装后可离线启动（内嵌 Web 静态资源 + Node 服务入口），不依赖开发机 `tsx` / `pnpm`。
3. **Trainer Electron 正式包**：镜像 Distill 桌面壳行为（默认端口 8866），同样产出 NSIS 安装包。

## 2. 非目标（本轮）

- 飞书消息 / 群聊实时采集、用户 OAuth、多维表格批量同步
- `electron-updater` / GitHub Releases / 自建更新源
- 代码签名证书（无证书时交付 **unsigned** 安装包，首次运行可能触发 SmartScreen）
- Linux / macOS 安装包
- 修改「仅 synthetic/redacted 可发布」门禁；飞书拉取默认 `sensitivity: synthetic`，用户可在素材侧改为 `redacted`
- 把两端合并为单一 Electron 双窗应用

## 3. 已确认决策

| 项 | 选择 |
| --- | --- |
| 飞书鉴权 | 应用凭证 → `tenant_access_token`（方案 A） |
| 飞书拉取对象 | **云文档正文**（docx `raw_content` 或等价只读正文 API） |
| Electron 交付 | 本机 NSIS 安装包 only，**无**自动更新（方案 A） |
| Trainer 桌面 | 独立 Electron 壳 + 独立安装包，行为对齐 Distill |
| 打包运行时 | 安装包内启动 **已编译/打包的 server 入口**，禁止依赖源码 `tsx` |

## 4. 飞书在线导入

### 4.1 配置

扩展 `AppSettings`：

```ts
feishu?: { appId: string; appSecret: string }
```

- 经现有 `PUT /api/settings` 读写；密钥存本机 `data/db.json`，**不**写入仓库样例。
- Settings 页：App ID / App Secret 输入 +「测试连通」。

### 4.2 API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| `POST` | `/api/settings/feishu-ping` | 用 settings 或 body 覆盖凭证请求 tenant token；返回 `{ ok, expiresIn? }` 或错误码 |
| `POST` | `/api/materials/feishu-doc` | body: `{ subjectId, docToken?, url?, title?, sensitivity? }` → 拉取正文 → `addMaterial` |

**URL 解析：** 若给 `url`，从飞书云文档链接中提取 `docToken`（常见 `/docx/{token}`、`/docs/{token}`）；解析失败返回 `FEISHU_BAD_URL`。

**错误码（示例）：** `FEISHU_NOT_CONFIGURED` · `FEISHU_AUTH_FAILED` · `FEISHU_DOC_NOT_FOUND` · `FEISHU_FORBIDDEN` · `FEISHU_BAD_URL` · `FEISHU_EMPTY_CONTENT`。

### 4.3 模块边界

- `src/adapters/feishu.ts`：token 缓存（内存，过期前复用）、ping、fetchDocPlainText。
- store 负责落盘；飞书适配器只负责鉴权与拉纯文本。
- 离线 JSON/粘贴路径保持不变。

### 4.4 UI

Materials 页增加「飞书云文档」卡片：subject 选择、URL 或 token、标题可选、导入按钮。成功后刷新素材列表并可预览。

### 4.5 测试

- 单测：URL→token 解析；token 缓存（mock `fetch`）。
- API 测：未配置 → `FEISHU_NOT_CONFIGURED`；mock 飞书 HTTP 成功路径写入 material。
- 不对真实飞书租户做 CI 联调。

## 5. Electron NSIS（两端共用模式）

### 5.1 目录与脚本

**Distill Studio**

- 增强 `electron/main.cjs`（端口默认 8877，userData `~/.distill-studio-electron`）。
- `package.json`：`build:server`（打成可被 `node` 运行的 `dist/server.cjs`）、`dist:win` = build:web + build:server + electron-builder。
- 产出：`release/Distill Studio Setup <version>.exe`。

**BankExpertTrainer**

- 新增 `electron/main.cjs`（端口默认 8866，userData `~/.bank-expert-trainer-electron`）。
- 同样 `dist:win` → `release/Bank Expert Trainer Setup <version>.exe`。

### 5.2 主进程行为（两端一致）

1. 检查 `dist/web/index.html` 存在，否则弹错退出。
2. 探测首选端口：若 `/health` 已 OK → 复用；否则选空闲端口并 spawn 内嵌 Node 服务。
3. 服务入口：开发可用 tsx；安装包用 `process.resourcesPath` 下的 `server.cjs`，`DATA_DIR` 指向 userData/data。
4. 关窗 / before-quit 仅杀死本进程拉起的子进程。

### 5.3 electron-builder 要点

- 两端不同 `appId`。
- 纳入 `dist/web`、`dist/server.cjs`。
- 目标 `nsis`；无 `publish` / updater。
- 未签名：README 注明 SmartScreen 属预期。

### 5.4 数据目录

安装版默认 `DATA_DIR` = `userData/data`，与开发态 `./data` 隔离。

## 6. 验收标准

- Settings 保存飞书凭证后，ping 在 mock 下成功、缺凭证时失败信息可读。
- 给定 mock 文档正文，`/api/materials/feishu-doc` 生成可预览素材。
- Distill / Trainer 各自 `pnpm dist:win` 在 Windows 产出可安装 `.exe`。
- 安装后双击启动：窗口打开、health 200、静态 UI 可点（无需本机全局 Node/tsx）。
- 离线飞书 JSON 导入与 Web 开发启动路径不被破坏。

## 7. 实现顺序

1. 飞书适配器 + API + UI + 测试  
2. Distill：server 打包入口 + electron-builder + 主进程切换  
3. Trainer：复制壳 + 对齐打包  
4. README 补充安装包说明  

## 8. 规格自检

- 无「待定」占位；飞书对象已收窄为云文档。  
- 旧规格「不做飞书真采集」由本文件增量修订：允许应用凭证云文档拉取；仍不做消息/群聊。  
- 自动更新明确不做。
