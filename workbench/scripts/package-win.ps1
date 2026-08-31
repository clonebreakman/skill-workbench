# Portable assemble for Skill Workbench shell (gateway + UI). Child apps stay on disk.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "Building workbench web..."
& .\node_modules\.bin\vite.cmd build --config web/vite.config.ts
if ($LASTEXITCODE -ne 0) { throw "vite failed" }

$electronDist = Join-Path $root "node_modules\electron\dist"
if (-not (Test-Path (Join-Path $electronDist "electron.exe"))) {
  corepack pnpm rebuild electron
}
if (-not (Test-Path (Join-Path $electronDist "electron.exe"))) {
  throw "electron dist missing"
}

$out = Join-Path $root "release\win-unpacked"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null
Copy-Item (Join-Path $electronDist "*") $out -Recurse -Force
$defaultAsar = Join-Path $out "resources\default_app.asar"
if (Test-Path $defaultAsar) { Remove-Item $defaultAsar -Force }

$appDir = Join-Path $out "resources\app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
Copy-Item (Join-Path $root "electron\main.cjs") (Join-Path $appDir "main.cjs")
@{ name = "skill-workbench"; version = "0.1.0"; main = "main.cjs" } | ConvertTo-Json |
  Set-Content -Encoding utf8 (Join-Path $appDir "package.json")

# Bundle minimal runtime: gateway sources + built web + tsx dependency via node_modules symlink is heavy.
# For portable shell, ship dist/web and instruct to run with workspace sibling apps.
$res = Join-Path $out "resources"
Copy-Item (Join-Path $root "dist\web") (Join-Path $res "web") -Recurse -Force
Copy-Item (Join-Path $root "src") (Join-Path $appDir "src") -Recurse -Force
Copy-Item (Join-Path $root "package.json") (Join-Path $appDir "package.json") -Force

# Patch packaged main to start tsx gateway from resources/app when possible is complex.
# Ship zip of win-unpacked + README note: prefer `pnpm electron` from workbench for now.
Rename-Item (Join-Path $out "electron.exe") "Skill Workbench.exe" -Force
$zip = Join-Path $root "release\Skill-Workbench-portable.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zip -Force
Write-Host "Portable shell zip: $zip"
Write-Host "Note: full integrated App runtime uses pnpm electron (starts gateway + both services)."
