# Start Distill Studio (8877) + BankExpertTrainer (8866) for local demo.
# Usage:
#   powershell -ExecutionPolicy Bypass -File C:\Users\11355\DistillStudio\scripts\start-demo.ps1
#   powershell -ExecutionPolicy Bypass -File ...\start-demo.ps1 -Seed -ForceRebuild

param(
  [switch]$Seed,
  [switch]$ForceRebuild
)

$ErrorActionPreference = "Stop"
$distill = "C:\Users\11355\DistillStudio"
$trainer = "C:\Users\11355\BankExpertTrainer"

function Test-WebStale([string]$root) {
  $index = Join-Path $root "dist\web\index.html"
  if (-not (Test-Path $index)) { return $true }
  $indexTime = (Get-Item $index).LastWriteTimeUtc
  $sources = @(
    (Join-Path $root "web\src"),
    (Join-Path $root "web\index.html"),
    (Join-Path $root "web\vite.config.ts")
  ) | Where-Object { Test-Path $_ }
  foreach ($src in $sources) {
    $newest = Get-ChildItem -Path $src -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTimeUtc -Descending |
      Select-Object -First 1
    if ($newest -and $newest.LastWriteTimeUtc -gt $indexTime) { return $true }
  }
  return $false
}

function Ensure-WebBuild([string]$root) {
  if (-not $ForceRebuild -and -not (Test-WebStale $root)) {
    Write-Host "Web build up to date: $root"
    return
  }
  Write-Host "Building web for $root ..."
  Push-Location $root
  try {
    if (Test-Path ".\node_modules\.bin\vite.cmd") {
      & .\node_modules\.bin\vite.cmd build --config web/vite.config.ts
    } else {
      npx vite build --config web/vite.config.ts
    }
    if ($LASTEXITCODE -ne 0) { throw "vite build failed for $root" }
  } finally {
    Pop-Location
  }
}

function Stop-Port([int]$port) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host "Preparing builds..."
Ensure-WebBuild $distill
Ensure-WebBuild $trainer

Write-Host "Freeing ports 8877 / 8866 if occupied..."
Stop-Port 8877
Stop-Port 8866
Start-Sleep -Seconds 1

Write-Host "Starting Distill Studio on 8877..."
$distillTsx = Join-Path $distill "node_modules\.bin\tsx.cmd"
$distillRun = if (Test-Path $distillTsx) { "`"$distillTsx`" src/main.ts" } else { "npx --yes tsx src/main.ts" }
$distillCmd = "cd /d `"$distill`" && set PORT=8877&& $distillRun"
Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $distillCmd) -WindowStyle Minimized

Write-Host "Starting BankExpertTrainer on 8866..."
$trainerTsx = Join-Path $trainer "node_modules\.bin\tsx.cmd"
$trainerRun = if (Test-Path $trainerTsx) { "`"$trainerTsx`" src/main.ts" } else { "npx --yes tsx src/main.ts" }
$trainerCmd = "cd /d `"$trainer`" && set APP_PORT=8866&& $trainerRun"
Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $trainerCmd) -WindowStyle Minimized

Write-Host "Waiting for health..."
$okD = $false
$okT = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $h1 = Invoke-RestMethod "http://127.0.0.1:8877/health" -TimeoutSec 1
    if ($h1.ok) { $okD = $true }
  } catch {}
  try {
    $h2 = Invoke-RestMethod "http://127.0.0.1:8866/health" -TimeoutSec 1
    if ($h2.ok) { $okT = $true }
  } catch {}
  if ($okD -and $okT) { break }
  Start-Sleep -Seconds 1
}

if (-not $okD) { Write-Warning "Distill Studio health not ready yet — open http://127.0.0.1:8877/ later" }
if (-not $okT) { Write-Warning "Trainer health not ready yet — open http://127.0.0.1:8866/ later" }

if ($Seed -and $okD) {
  Write-Host "Seeding Distill demo (王敏)..."
  try {
    $seed = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8877/api/demo/seed" -ContentType "application/json" -Body "{}"
    Write-Host "Seed ok: subject=$($seed.subject.id) package=$($seed.package.id) run=$($seed.runId)"
  } catch {
    Write-Warning "Demo seed failed: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "Distill Studio: http://127.0.0.1:8877/"
Write-Host "Trainer:        http://127.0.0.1:8866/import"
Write-Host "Demo: 8877 一键王敏 → 导出 → 8866 推荐导入并开练 → 结束后可下载对练 Markdown"
if ($Seed) {
  Write-Host "Seeded: open Distill Warehouse / Trainer Import discover"
}
Start-Process "http://127.0.0.1:8877/"
Start-Process "http://127.0.0.1:8866/import"
