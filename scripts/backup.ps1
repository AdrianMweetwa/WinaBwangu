param([string]$NodeExecutable = 'node')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupFolder = Join-Path $projectRoot 'backups'
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
Set-Location -LiteralPath $projectRoot
& $NodeExecutable (Join-Path $PSScriptRoot 'backup.cjs') >> (Join-Path $backupFolder 'daily.log') 2>&1
exit $LASTEXITCODE
