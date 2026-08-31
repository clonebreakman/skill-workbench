@echo off
cd /d "%~dp0workbench"
if not exist "dist\web\index.html" call .\node_modules\.bin\vite.cmd build --config web\vite.config.ts
call .\node_modules\.bin\electron.cmd .
