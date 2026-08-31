# Skill Workbench — 统一壳（已批准方案 A）

**实际路径：** `D:\SkillWorkbench`（`E:\` 对当前用户只读 RX，无法创建目录；授权写权限后可整体迁到 E:）

**结构：**
- `distill-studio/` — 蒸馏 8877
- `bank-expert-trainer/` — 培训 8866
- `workbench/` — 集成 Web(8855) + Electron App

**行为：** 顶栏切换；iframe 嵌入两端；App 启动拉起两端服务。
