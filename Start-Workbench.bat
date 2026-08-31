@echo off
set ROOT=%~dp0
cd /d "%ROOT%workbench"
if not exist "node_modules\tsx" (
  echo Installing workbench deps...
  call corepack pnpm install
)
if not exist "dist\web\index.html" (
  echo Building workbench web...
  call .\node_modules\.bin\vite.cmd build --config web\vite.config.ts
)
set WORKBENCH_PORT=8855
set WORKBENCH_AUTO_START=1
start "" http://127.0.0.1:8855/
echo Starting Skill Workbench...
call .\node_modules\.bin\tsx.cmd src\gateway.ts
pause
