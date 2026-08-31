# Start Skill Workbench (+ Distill 8877 + Trainer 8866)
$ErrorActionPreference = "Stop"
$wb = Split-Path $PSScriptRoot -Parent
$root = Split-Path $wb -Parent

function Ensure-Install([string]$dir) {
  if (-not (Test-Path (Join-Path $dir "node_modules"))) {
    Write-Host "pnpm install in $dir ..."
    Push-Location $dir
    try { corepack pnpm install } finally { Pop-Location }
  }
}

function Ensure-Web([string]$dir) {
  $index = Join-Path $dir "dist\web\index.html"
  if (-not (Test-Path $index)) {
    Write-Host "build:web $dir"
    Push-Location $dir
    try { & .\node_modules\.bin\vite.cmd build --config web/vite.config.ts } finally { Pop-Location }
  }
}

Ensure-Install (Join-Path $root "distill-studio")
Ensure-Install (Join-Path $root "bank-expert-trainer")
Ensure-Install $wb
Ensure-Web (Join-Path $root "distill-studio")
Ensure-Web (Join-Path $root "bank-expert-trainer")
Ensure-Web $wb

Write-Host "Starting Skill Workbench gateway (auto-starts distill + trainer)..."
Push-Location $wb
try {
  $env:WORKBENCH_PORT = "8855"
  $env:WORKBENCH_AUTO_START = "1"
  & .\node_modules\.bin\tsx.cmd src\gateway.ts
} finally {
  Pop-Location
}
