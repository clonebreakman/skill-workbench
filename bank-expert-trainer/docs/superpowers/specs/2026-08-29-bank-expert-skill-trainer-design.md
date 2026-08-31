# 银行优秀员工 Skill 蒸馏与培训平台 — 设计规格

**状态：** 方案与分节设计已获用户批准；第一期实现已开工并可演示。  
**日期：** 2026-08-29  
**产品定位：** 将银行优秀员工的做事方式与表达判断蒸馏为可运行 Skill，并用于培训（对标 Distilly + Posh）。  
**实现策略：** 方案 2 — 先蒸馏引擎 + Skill 仓库，培训壳二期挂接。

## 1. 目标

建成一体化平台的**第一期蒸馏底座**，使运营/培训人员能够：

1. 为优秀员工建立档案并上传脱敏/合成素材；
2. 跑通 Distilly 风格流水线，产出 **Work Skill + Persona**；
3. 对证据做 L1–L4 分级，人工审核后发布；
4. 在 Skill 仓库查看、对比版本、导出标准 `SKILL.md`；
5. 为二期 Posh 风格培训预留只读 API 与占位页。

产品形态：**Web 为主**，后续可打包 Electron 桌面壳（第一期不交付桌面安装包）。

## 2. 非目标（第一期）

- 语音对练、情景评分、学员进度看板（二期培训壳）；
- 飞书/企微自动采集、SSO、生产权限体系；
- 连接真实银行核心、真实客户数据、真实通话录音中的个人信息；
- 把模型当作最终业务责任主体或合规审批主体；
- 复用或改造既有 CodexBankTeller 柜面业务 PoC 作为本产品主体。

## 3. 已确认决策

| 项 | 选择 |
| --- | --- |
| 产品方向 | Distilly 式蒸馏 + Posh 式培训（完整平台愿景） |
| 第一期复杂度边界 | 核心闭环 A：蒸馏全链路；培训仅占位 |
| 实现顺序 | 方案 2：先引擎与仓库，再挂培训壳 |
| 交付形态 | Web 为主 + 可打包桌面壳（壳二期） |
| 参考项目 | Distilly/colleague-skill；Posh AI Training Simulator（培训侧二期） |

## 4. 架构

```text
素材入库（转写 / 话术 / 案例 / 制度）
        │
        ▼
蒸馏引擎
  切片 → 抽取 Work Skill / Persona
  → 证据分级 L1–L4 → 人工审核
        │
        ▼
Skill 仓库（版本 / 导出 SKILL.md）
        │
        ▼（二期）
培训壳：情景库 → 文字对练 → 多维评分 → 学员进度
        │
        ▼
Web App（本机/内网）＋ 可选 Electron
```

### 4.1 硬边界

- 默认仅允许 `synthetic` / `redacted` 素材进入可发布路径；
- 服务绑定 `127.0.0.1`（演示环境）；
- 发布前必须审核通过，且 L1+L2 证据占比不低于阈值（默认 60%）；
- 导出物为 Skill 指令与脱敏引用，不附带未脱敏原文全文。

## 5. 模块与信息架构

| 模块 | 职责 |
| --- | --- |
| 首页驾驶舱 | 员工数、待处理素材、已发布 Skill、进入蒸馏/仓库 |
| 素材库 | 上传与分类；关联员工；脱敏标记 |
| 蒸馏工作台 | 选员工与素材包；跑流水线；查看草稿与证据 |
| Skill 仓库 | 列表/详情：Work Skill、Persona、证据、导出 |
| 版本与对比 | 多版本 diff；回滚 |
| 培训占位 | 二期入口灰显；说明即将支持对练与评分 |

**主路径：** 新建员工档案 → 上传素材 → 启动蒸馏 → 审核 → 发布 → 导出。

## 6. 蒸馏流水线

1. **入库**：文本/Markdown 直接入；转写文本入；拒绝空文件。  
2. **切片**：按段落/对话轮次切块，绑定 `employeeId`。  
3. **抽取**：生成 Work Skill 与 Persona 草稿（结构见 §7）。  
4. **证据分级**：L1 原文引用 / L2 强推断 / L3 弱推断 / L4 启发补充。  
5. **人工审核**：编辑草稿、剔除弱证据、备注。  
6. **发布**：写入仓库，生成 `SKILL.md` + 元数据。  
7. **版本**：每次发布递增 `version`；支持回滚。

模型层可插拔：默认 **Mock 适配器**（基于规则/模板，保证无 Key 可演示）；可选 OpenAI 兼容 API。

## 7. Skill 产物结构

每个已发布 Skill 目录至少包含：

```text
skills/<employee-slug>/
  SKILL.md          # Agent Skills 规范 frontmatter + 正文
  work-skill.json   # 结构化 Work Skill
  persona.json      # 结构化 Persona
  evidence.jsonl    # 证据与级别
  meta.json         # employeeId, version, publishedAt, synthetic
```

### 7.1 Work Skill 字段

- `scope`：职责范围  
- `workflows`：标准流程步骤  
- `decisionRules`：判断规则  
- `forbidden`：禁区 / 必须转人工  
- `knowledgeRefs`：制度/案例引用 ID  

### 7.2 Persona 字段

- `identity`：角色身份叙述  
- `expression`：表达风格与示例句  
- `heuristics`：决策启发式  
- `interpersonal`：人际姿态  
- `antiPatterns`：绝对不做的事  
- `limits`：诚实边界（Skill 做不到什么）  

### 7.3 `SKILL.md` 约定

- YAML frontmatter：`name`、`description`（含何时启用）；  
- 正文：Work Skill 摘要 + Persona 操作指令 + 指向 evidence 的引用方式；  
- 符合 [Agent Skills](https://agentskills.io/specification) 渐进披露习惯（主文件精炼，细节在旁路 JSON）。

## 8. API（第一期）

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/health` | `{ ok, syntheticOnly }` |
| `GET/POST` | `/api/employees` | 员工档案 |
| `GET/POST` | `/api/materials` | 素材列表/上传元数据 |
| `POST` | `/api/distill/jobs` | 创建蒸馏任务 |
| `GET` | `/api/distill/jobs/:id` | 任务状态与草稿 |
| `POST` | `/api/distill/jobs/:id/review` | 提交审核结果 |
| `POST` | `/api/skills/:employeeId/publish` | 发布新版本 |
| `GET` | `/api/skills` | 仓库列表 |
| `GET` | `/api/skills/:id` | 详情（培训二期只读） |
| `GET` | `/api/skills/:id/export` | 导出打包（zip 或目录路径） |
| `POST` | `/api/skills/:id/rollback` | 回滚版本 |

## 9. 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React + Vite |
| 后端 | Node.js + TypeScript |
| 存储 | SQLite + 本地文件 |
| 模型 | Mock（默认）/ OpenAI 兼容（可选） |
| 测试 | Vitest |
| 桌面壳 | Electron（二期） |

## 10. 测试与成功标准

### 10.1 测试

- 流水线：空素材拒绝；Mock 蒸馏产出双层结构；证据级别写入；  
- 发布门槛：L1+L2 占比不足不可发布；  
- 导出：`SKILL.md` 含 name/description；  
- API 冒烟：health、employees、distill、publish、export。

### 10.2 第一期成功标准

- `pnpm app` 可启动本机 Web；  
- 用**合成柜员**素材跑通上传 → 蒸馏 → 审核 → 发布 → 导出；  
- 仓库可见 Work Skill、Persona、证据；  
- 培训页存在且明确为占位；  
- 无真实客户数据依赖。

## 11. 二期预告（不在本规格实现范围）

- 情景库与文字对练（Posh 风格）；  
- 共情 / 合规 / 准确等多维评分；  
- 学员进度与布置任务；  
- Electron 桌面壳；  
- 飞书/企微采集与 SSO。

## 12. 仓库落点

新建独立项目（勿并入 CodexBankTeller 柜面 PoC）：

建议目录名：`BankExpertTrainer`  
规格路径：`docs/superpowers/specs/2026-08-29-bank-expert-skill-trainer-design.md`
