# Move D:\SkillWorkbench -> E:\SkillWorkbench after E: is writable.
# Run in elevated PowerShell if needed:
#   icacls E:\ /grant "%USERNAME%:(OI)(CI)(M)"
$ErrorActionPreference = "Stop"
$src = "D:\SkillWorkbench"
$dst = "E:\SkillWorkbench"

try {
  New-Item -ItemType Directory -Path "E:\_wb_perm_test" -Force | Out-Null
  Remove-Item "E:\_wb_perm_test" -Force
} catch {
  Write-Error "E:\ still not writable. Grant modify permission first, then re-run."
  exit 1
}

if (Test-Path $dst) {
  Write-Error "Target already exists: $dst"
  exit 1
}

Write-Host "Moving $src -> $dst ..."
Move-Item -Path $src -Destination $dst
Write-Host "Done. Update shortcuts to $dst\Start-Workbench.bat"
