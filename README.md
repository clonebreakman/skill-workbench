# Skill Workbench
#
# 实际路径：D:\SkillWorkbench
# 说明：E:\ 对当前 Windows 用户仅只读（Users RX），无法在 E:\ 创建目录。
# 若你用管理员给 E:\ 开写权限后，可以把整个 D:\SkillWorkbench 挪到 E:\SkillWorkbench。

| 组件 | 路径 | 端口 |
| --- | --- | --- |
| **统一壳 Web / App** | `workbench\` | **8855** |
| Distill Studio | `distill-studio\` | 8877 |
| BankExpertTrainer | `bank-expert-trainer\` | 8866 |

子项目的 `node_modules` / `dist` 目前是指向原 `C:\Users\11355\...` 的目录联接（节省空间）；源码在 `D:\SkillWorkbench\` 下。

## 首次（若联接不可用则需单独 install）

```powershell
cd D:\SkillWorkbench\workbench; corepack pnpm install; pnpm build:web
```

## 一键演示（统一壳内）

打开 http://127.0.0.1:8855/ → 总览 → **一键演示王敏 → 去培训**  
会调用蒸馏端 seed，然后切到培训页；在培训 iframe 里导入推荐包即可开练。

导出目录已与 `C:\Users\11355\DistillStudio\data\exports` 联接，避免 D: 副本空导出。

双击：

- `D:\SkillWorkbench\Start-Workbench.bat` — Web 壳（自动拉起两端并打开浏览器）
- `D:\SkillWorkbench\Start-Desktop-App.bat` — Electron 桌面 App
或命令行：

```powershell
powershell -ExecutionPolicy Bypass -File D:\SkillWorkbench\workbench\scripts\start.ps1
cd D:\SkillWorkbench\workbench; pnpm electron
```

浏览器：http://127.0.0.1:8855/  
顶栏：**总览 / 蒸馏 / 培训**；总览可点「一键拉起蒸馏+培训」。

## 桌面快捷方式

```powershell
powershell -ExecutionPolicy Bypass -File D:\SkillWorkbench\scripts\Create-Desktop-Shortcuts.ps1
```

会在桌面生成：
- `Skill Workbench (Web).lnk`
- `Skill Workbench (App).lnk`

## 迁到 E 盘（需先有写权限）

```powershell
# 管理员可选：icacls E:\ /grant "%USERNAME%:(OI)(CI)(M)"
powershell -ExecutionPolicy Bypass -File D:\SkillWorkbench\scripts\Move-To-E.ps1
```

## 便携壳（仅 Electron 外壳）

`D:\SkillWorkbench\workbench\release\Skill-Workbench-portable.zip`  
完整联调请优先用 `Start-Desktop-App.bat` / `pnpm electron`（会拉起 gateway + 两端）。

- 两端业务进程仍独立（稳定、沿用现有能力）
- Workbench 提供统一导航 + 在线状态 + iframe 嵌入
- 蒸馏：飞书、Phase0–7、导出、演进  
- 培训：导入、对练、评分、回传纠正  
