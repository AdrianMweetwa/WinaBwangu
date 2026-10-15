$ErrorActionPreference = 'Stop'
$taskName = 'WinaBwanguBackup'
$projectRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot 'backup.ps1'
$nodeExecutable = (Get-Command node.exe).Source
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not ($existing.Actions.Arguments -like "*$scriptPath*")) {
    throw 'A different WinaBwanguBackup task already exists; it was not changed.'
}
$arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -NodeExecutable "{1}"' -f $scriptPath, $nodeExecutable
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '18:00'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Output 'Daily backup scheduled for 18:00 local time while this Windows user is signed in.'
Start-ScheduledTask -TaskName $taskName
