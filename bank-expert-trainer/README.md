# BankExpertTrainer

银行优秀员工 Skill **培训对练**端：只消费 Distill Studio 导出的 `training-skill`，不再内置蒸馏。

| 端 | 地址 |
| --- | --- |
| 本应用（导入 / 对练） | http://127.0.0.1:8866/ |
| Distill Studio（蒸馏） | http://127.0.0.1:8877/ |

## 一键双端

也可从 Distill Studio 启动：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\11355\DistillStudio\scripts\start-demo.ps1
```

## 启动

```bash
cd C:\Users\11355\BankExpertTrainer
# 若已有 node_modules
npx tsx src/main.ts
# 或先构建 Web
npx vite build --config web/vite.config.ts
$env:APP_PORT="8866"; npx tsx src/main.ts
```

## Windows 安装包（NSIS，未签名）

```bash
cd C:\Users\11355\BankExpertTrainer
pnpm install
# 若 electron 缺 dist：pnpm rebuild electron
pnpm dist:win
```

产出：

- `release\Bank Expert Trainer Setup 0.1.0.exe`
- `release\win-unpacked\`（免安装）

安装版数据：`%USERPROFILE%\.bank-expert-trainer-electron\data`。开发壳：`pnpm electron`。

## 演示路径

1. Distill Studio 首页「一键生成王敏演示 Skill」
2. 确认驾驶舱「培训端交接」显示在线
3. 本站「导入 Skill」→ 推荐包 →「导入并开练」
4. 对练页查看辅导提示（禁区 / 成功信号），结束后多维评分；可「回传纠正到 Distill」升版
5. 驾驶舱「蒸馏端交接」可看 Distill 在线状态与推荐包

## 发现规则

默认扫描：

- `%USERPROFILE%\DistillStudio\data\exports\training-skill`
- 或环境变量 `DISTILL_EXPORTS_DIR`

读取同目录 `active-pointer.json`，将激活包标为「推荐」。也识别同目录 `.zip`，或在导入页上传 Distill「下载 ZIP」。

## ZIP 导入

```text
POST /api/skills/import-zip
{ "zipPath": "C:\\...\\slug-v1.zip" }
# 或
{ "zipBase64": "<base64>", "fileName": "slug-v1.zip" }
```
