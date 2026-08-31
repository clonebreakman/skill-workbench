# Create desktop shortcuts for Skill Workbench
$ErrorActionPreference = "Stop"
$root = "D:\SkillWorkbench"
$desktop = [Environment]::GetFolderPath("Desktop")
$w = New-Object -ComObject WScript.Shell

$s1 = $w.CreateShortcut((Join-Path $desktop "Skill Workbench (Web).lnk"))
$s1.TargetPath = Join-Path $root "Start-Workbench.bat"
$s1.WorkingDirectory = $root
$s1.Description = "Skill Workbench Web shell"
$s1.Save()

$s2 = $w.CreateShortcut((Join-Path $desktop "Skill Workbench (App).lnk"))
$s2.TargetPath = Join-Path $root "Start-Desktop-App.bat"
$s2.WorkingDirectory = $root
$s2.Description = "Skill Workbench Electron App"
$s2.Save()

Write-Host "Created:"
Write-Host " - $(Join-Path $desktop 'Skill Workbench (Web).lnk')"
Write-Host " - $(Join-Path $desktop 'Skill Workbench (App).lnk')"
