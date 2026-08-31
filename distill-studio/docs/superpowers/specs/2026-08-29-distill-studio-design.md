# Distill Studio — 设计规格

**状态：** 分节设计已获用户批准；书面规格待用户审查。  
**日期：** 2026-08-29  
**产品定位：** 独立的人物/角色 Skill 蒸馏工作台（对齐 anyone-skill 七阶段），双导出 OpenPersona 包与培训兼容 Skill；BankExpertTrainer 仅消费导出物做对练。  
**实现策略：** 方案 1 — 新建独立单体 `DistillStudio`（Web + Electron）；培训端瘦身去蒸馏。

## 1. 目标

建成独立产品 **Distill Studio**，使运营/培训/知识管理员能够：

1. 按 anyone-skill 对齐的 **Phase 0–7** 完成通用人物蒸馏；
2. 在无 API Key 时用 Mock 跑通全链路，有 Key 时可切换 OpenAI 兼容抽取；
3. 发布前通过伦理门禁与 L1–L4 证据门槛；
4. **双导出**：OpenPersona 包 + 银行培训兼容 Skill 目录/ZIP；
5. 支持追加素材、自然语言纠正、版本回滚（Phase 7）；
6. 以 Web（默认 `127.0.0.1:8877`）为主界面，并提供 Electron 桌面壳。

BankExpertTrainer 改造为：**导入 Distill Studio 的 training-skill 导出 → 情景对练/评分**，不再内置蒸馏主路径。

## 2. 非目标（第一期）

- 飞书 / 企微 / 钉钉 / Slack **真实自动采集**（仅保留上传、粘贴、合成样本）；
- 云端多租户、SSO、生产级权限体系；
- 连接真实银行核心或含真实客户 PII 的素材默认入库；
- 把模型当作合规终审或业务责任主体；
- Distilly 三家族（relationship / celebrity）完整并列工作台（subject 类型可扩展，UI 不堆三套主路径）；
- 改造 CodexBankTeller 柜面 PoC 作为本产品主体。

## 3. 已确认决策

| 项 | 选择 |
| --- | --- |
| 产品边界 | 独立 Distill Studio；BankExpertTrainer 只消费导出 Skill |
| 复杂度主线 | anyone-skill **七阶段**通用蒸馏 |
| 导出形态 | **双导出**：OpenPersona 包 + 培训兼容 Skill 目录 |
| 第一期深度 | Phase 0–7 全可跑通；采集=上传/粘贴；抽取=Mock+可选 LLM；伦理/证据=规则门禁 |
| 交付形态 | **Web + Electron** |
| 实现方案 | 新建单体仓库/目录（方案 1），栈与培训端一致（Node/TS + React） |
| 参考项目 | anyone-skill、Distilly/colleague-skill、boss-skills、immortal-skill、Agent Skills 规范、persona-evaluator（质检思路） |

## 4. 总体架构

```text
[Distill Studio]  C:\Users\11355\DistillStudio
  Web UI (Vite/React)  ←→  API (Node/TS, 127.0.0.1:8877)
                              │
                    Phase 0–7 蒸馏引擎
                              │
                    data/ + exports/
                      ├─ openpersona/{slug}-v{n}/
                      └─ training-skill/{slug}-v{n}/
  Electron：启动同一本地服务并打开窗口

[BankExpertTrainer]
  导入 training-skill 目录或 ZIP → Skill 仓库 → 培训对练
  不共享数据库；唯一契约是文件系统导出格式
```

### 4.1 硬边界

- 默认仅 `synthetic` / `redacted` 素材可进入可发布路径；
- 服务绑定 `127.0.0.1`；
- 发布前必须通过伦理勾选，且证据 L1+L2 占比不低于阈值（默认 **60%**）；
- 无 LLM Key 或 LLM 失败时降级 Mock，UI 标明「已降级」；
- Electron 缓存与产物目录优先用户目录或 D:，避免 C 盘满盘导致无法启动。

## 5. 七阶段模块与信息架构

| Phase | 引擎职责 | UI |
| --- | --- | --- |
| 0 分类 | 六类 subject：self / known / public / fictional / historical / archetype；银行优秀员工映射为 `known` + 岗位标签 | 新建对象向导 |
| 1 伦理 | 同意、敏感级、版权/用途声明；失败阻断发布 | 伦理检查清单 |
| 2 Intake | 三问：用途、材料范围、禁忌边界 | Intake 表单 |
| 3 采集 | 上传 MD/TXT/合成转写；粘贴；归档 `knowledge/` | 素材库 |
| 4 四维抽取 | Procedure · Interaction · Memory · Personality | 四栏预览 |
| 5 证据 | L1–L4 分级、冲突标记、发布门槛 | 证据板 |
| 6 生成 | 双导出写盘、版本递增 | 预览与发布 |
| 7 演进 | 追加 merge、自然语言纠正、版本列表与回滚 | 演进/版本页 |

**侧栏：** 驾驶舱 · 对象 · 素材 · 蒸馏向导（0→6）· 仓库 · 演进 · 导出中心 · 设置（可选 LLM）。

**主路径：** 新建对象 → 伦理 → Intake → 上传素材 → 跑 4–6 → 审核发布 → 导出 → 培训端导入。

## 6. 数据模型

持久化：`data/db.json` + 文件目录（素材原文、导出包、版本归档）。

| 实体 | 关键字段 |
| --- | --- |
| Subject | `id, slug, type, profile, ethics, intake, status, createdAt` |
| Material | `id, subjectId, kind, title, sensitivity, fileName, path, hash` |
| DistillRun | `id, subjectId, phase, dimensions, evidence[], adapter, status, updatedAt` |
| Package | `id, subjectId, version, openPersonaPath, trainingSkillPath, publishedAt, synthetic` |
| Correction | `id, packageId, scene, wrong, right, at` |

### 6.1 四维 → 培训字段映射

| 四维 | 培训兼容映射 |
| --- | --- |
| Procedure | `work-skill.json`：scope、workflows、decisionRules、forbidden、knowledgeRefs |
| Interaction + Personality | `persona.json`：identity、expression、heuristics、interpersonal、antiPatterns、limits |
| Memory | 写入 OpenPersona / references；培训包以 `knowledgeRefs` 与证据引用呈现，不塞入未脱敏全文 |
| Evidence | `evidence.jsonl`：claim、level(L1–L4)、sourceRef、notes |

## 7. 双导出契约

### 7.1 OpenPersona 包

路径：`exports/openpersona/{slug}-v{n}/`

```text
SKILL.md
persona.json
state.json
soul/injection.md
soul/constitution.md
agent-card.json
meta.json
```

### 7.2 培训兼容包（BankExpertTrainer 唯一导入源）

路径：`exports/training-skill/{slug}-v{n}/`

```text
SKILL.md              # Agent Skills 规范 frontmatter + 正文
work-skill.json
persona.json
evidence.jsonl
meta.json             # source=distill-studio, subjectType, version, synthetic
```

可选：同结构 ZIP，便于拷贝。

### 7.3 培训端导入规则

1. 校验存在 `SKILL.md` 与 `meta.json`；
2. `meta.source` 应为 `distill-studio`（兼容手工标注的同结构包）；
3. 复制入培训端 Skill 仓库并登记版本；
4. **不**回写 Distill Studio；两端数据库隔离。

## 8. 抽取适配器

| 适配器 | 行为 |
| --- | --- |
| `mock`（默认） | 基于切片关键词/模板填充四维与证据，保证无 Key 可演示 |
| `llm`（可选） | OpenAI 兼容 Chat Completions；超时或错误 → 回退 mock 并记录 |

设置页可保存 baseURL / model / API Key（仅本机，不提交 git）。

## 9. 错误处理与门禁

| 条件 | 行为 |
| --- | --- |
| 伦理未通过 | 禁止 publish |
| 素材非 synthetic/redacted | 禁止进入可发布路径 |
| 无素材 / 空文件 | 禁止 Phase 4 |
| L1+L2 &lt; 60% | 可看草稿，不可 publish |
| LLM 失败 | 降级 Mock + UI 提示 |
| 端口占用 | 明确错误；Electron 提示更换端口或结束旧进程 |

## 10. 测试计划（第一期）

- **单元：** 分类、伦理门禁、Mock 四维、证据分级与门槛、双导出文件形状、纠正补丁、版本回滚  
- **API：** Subject → Material → Run(0–6) → publish → 两套导出路径存在且可读  
- **冒烟：** `GET /health`；Web 向导走通；导出包可被 BankExpertTrainer 导入并完成一局对练  
- **Electron：** 能启动窗口并加载本地 UI（缓存目录可配置）

## 11. BankExpertTrainer 改造范围

- 停用蒸馏主路径：蒸馏工作台、内置 `src/distill` 发布链路不再作为产品入口；
- 新增「导入 Skill」页：选择目录或 ZIP（training-skill 契约）；
- 首页：引导至 Distill Studio（链接 `http://127.0.0.1:8877`）+ 本仓导入 + 培训对练；
- 保留既有对练/评分能力；Skill 来源改为导入而非本仓蒸馏。

## 12. 技术栈与目录草图

- 运行时：Node.js + TypeScript  
- API：原生 `node:http` 或轻量路由（与现有培训端风格一致）  
- UI：React + Vite  
- 测试：Vitest  
- 桌面：Electron（后置打包脚本；开发期可用 `app` 先起 Web）

```text
DistillStudio/
  src/           # API + 引擎 Phase 0–7
  web/           # React UI
  electron/      # 桌面壳
  data/          # 本地库与素材（gitignore）
  exports/       # 双导出（gitignore）
  tests/
  docs/superpowers/specs/
  docs/superpowers/plans/
```

## 13. 成功标准

1. 无 API Key 下可完成：新建 known 型银行柜员 → 上传合成素材 → 跑通 0–6 → 发布双导出；  
2. Phase 7 至少支持一次纠正并生成新版本、可回滚；  
3. BankExpertTrainer 导入 training-skill 后可对练并出分；  
4. Electron 能打开同一应用；  
5. 自动化测试覆盖引擎门禁与导出契约。

## 14. 参考链接

- https://github.com/acnlabs/anyone-skill  
- https://github.com/titanwings/distilly  
- https://github.com/titanwings/colleague-skill  
- https://arxiv.org/html/2605.31264v1  
- https://github.com/vogtsw/boss-skills  
- https://github.com/agenmod/immortal-skill  
- https://agentskills.io/specification  
- https://github.com/acnlabs/persona-evaluator  
