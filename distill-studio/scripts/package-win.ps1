# Assemble Windows portable app then NSIS from prepackaged dir (avoids pnpm collector bug).
param(
  [ValidateSet("distill", "trainer")]
  [string]$App = "distill"
)

$ErrorActionPreference = "Stop"

if ($App -eq "distill") {
  $root = "C:\Users\11355\DistillStudio"
  $product = "Distill Studio"
  $exeName = "Distill Studio.exe"
} else {
  $root = "C:\Users\11355\BankExpertTrainer"
  $product = "Bank Expert Trainer"
  $exeName = "Bank Expert Trainer.exe"
}

Set-Location $root

Write-Host "Building web + server..."
& .\node_modules\.bin\vite.cmd build --config web/vite.config.ts
if ($LASTEXITCODE -ne 0) { throw "vite build failed" }
node scripts/build-server.mjs
if ($LASTEXITCODE -ne 0) { throw "server bundle failed" }

$electronDist = Join-Path $root "node_modules\electron\dist"
if (-not (Test-Path (Join-Path $electronDist "electron.exe"))) {
  throw "electron dist missing — run pnpm install / rebuild electron"
}

$out = Join-Path $root "release\win-unpacked"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null
Copy-Item -Path (Join-Path $electronDist "*") -Destination $out -Recurse -Force

# Prefer our app over Electron's default_app.asar
$defaultAsar = Join-Path $out "resources\default_app.asar"
if (Test-Path $defaultAsar) { Remove-Item $defaultAsar -Force }

$appDir = Join-Path $out "resources\app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
Copy-Item (Join-Path $root "electron\main.cjs") (Join-Path $appDir "main.cjs")
@{
  name = if ($App -eq "distill") { "distill-studio" } else { "bank-expert-trainer" }
  version = "0.1.0"
  main = "main.cjs"
} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $appDir "package.json")

# Patch main.cjs references: packaged ROOT is resources/app parent = resources
# Our main.cjs uses __dirname/.. as ROOT in unpackaged; in packaged app __dirname is resources/app
# so ROOT = resources/app/.. = resources. server.cjs and web sit on resources/.
# electron main already uses process.resourcesPath when app.isPackaged — OK.

Copy-Item (Join-Path $root "dist\server.cjs") (Join-Path $out "resources\server.cjs") -Force
$webDest = Join-Path $out "resources\web"
if (Test-Path $webDest) { Remove-Item $webDest -Recurse -Force }
Copy-Item (Join-Path $root "dist\web") $webDest -Recurse -Force

Rename-Item (Join-Path $out "electron.exe") $exeName -Force

Write-Host "Portable ready: $out"
Write-Host "Building NSIS from prepackaged..."
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
# Prefer China mirror when GitHub times out (common on CN networks).
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
  $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
}
& .\node_modules\.bin\electron-builder.cmd --prepackaged $out --win nsis --publish never
if ($LASTEXITCODE -ne 0) {
  Write-Warning "NSIS failed — portable folder still usable: $out"
  $zip = Join-Path $root "release\$product-portable.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zip -Force
  Write-Host "Wrote portable zip: $zip"
  exit 0
}

Get-ChildItem (Join-Path $root "release") -Filter "*.exe" | ForEach-Object { Write-Host "Installer: $($_.FullName)" }
