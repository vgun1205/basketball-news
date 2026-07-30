# One-time 23:00 pilot: send current digest to SELF ONLY (vgun1205) + kakao, to review the
# new chapter order/format after 11 PM. Does not change state. ASCII messages only.
$env:NEWS_MAIL_TO = "vgun1205@gmail.com"   # 파일럿은 본인에게만(밤 시간 동료 메일 방지)
$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = "node" }
Set-Location $PSScriptRoot
"[{0}] pilot 23:00 start" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") | Add-Content data\pilot.log
& $node --env-file-if-exists=.env scripts\pilot.mjs *>> data\pilot.log
"[{0}] pilot 23:00 end (exit {1})" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $LASTEXITCODE | Add-Content data\pilot.log
