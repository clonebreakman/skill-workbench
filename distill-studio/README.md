# Distill Studio

人物 / 角色 Skill 蒸馏工作台（对齐 anyone-skill Phase 0–7），双导出 OpenPersona 与培训兼容 Skill。

| 端 | 地址 |
| --- | --- |
| Distill Studio | http://127.0.0.1:8877/ |
| BankExpertTrainer（导入对练） | http://127.0.0.1:8866/ |

培训端扫描目录：`data/exports/training-skill/{slug}-v{n}`  
规格：`docs/superpowers/specs/2026-08-29-distill-studio-design.md`

## 一键双端演示

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\11355\DistillStudio\scripts\start-demo.ps1
```

会启动 8877 + 8866 并打开浏览器。然后：首页一键王敏 → 培训端「导入并开练」。

## 飞书云文档（在线）

1. 飞书开放平台创建企业自建应用，开通 **云文档** 读权限，并把目标文档分享给该应用。
2. Distill「设置」填写 App ID / App Secret →「测试飞书连通」。
3. 「素材库」→「飞书云文档」粘贴文档 URL 或 token →「在线导入」。

仍支持离线飞书 JSON / 粘贴导入。

## Windows 安装包（NSIS，未签名）

```bash
cd C:\Users\11355\DistillStudio
pnpm install
pnpm dist:win
```

产出：

- `release\Distill Studio Setup 0.1.0.exe`（安装包）
- `release\win-unpacked\`（免安装目录，可直接跑 `Distill Studio.exe`）

若本机访问 GitHub 超时，脚本会自动用 npmmirror 拉 electron-builder 二进制；仍失败时至少会生成 portable zip。

首次运行可能被 SmartScreen 拦截（未代码签名属预期）。安装版数据目录：`%USERPROFILE%\.distill-studio-electron\data`。

开发桌面壳：`pnpm electron`

## 快速演示

```bash
cd C:\Users\11355\DistillStudio
corepack pnpm install
corepack pnpm app
```

1. 首页「一键生成王敏演示 Skill」
2. 导出中心复制路径，或打开培训端「导入 Skill」自动发现 → 一键导入 → 立即对练
3. 演进页可纠正升版，或回滚激活历史版本（指针，不删包）

## 桌面壳

先 `pnpm build:web`，再：

```bash
corepack pnpm electron
```

- 若 8877 已有健康服务则复用，不重复拉起
- 端口被占会尝试 8878…；失败弹窗说明
- Electron `userData` 默认在 `%USERPROFILE%\.distill-studio-electron`（可用 `DISTILL_ELECTRON_USER_DATA` 改）
