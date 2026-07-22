# Basketball news LOCAL backup sender (daily 09:20, local PC).
# If today's cloud run hasn't delivered yet, send locally (email+kakao) — no gh dependency.
# Dedup: git pull first to sync cloud state (last-sent.txt / seen.json). ASCII messages only.
$ErrorActionPreference = "Continue"
$dir = $PSScriptRoot
$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = "node" }
$log = Join-Path $dir "data\backup-send.log"
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) }

Set-Location $dir
# 1) sync cloud state (best effort) so we don't double-send what cloud already sent
& git stash -q 2>$null
& git pull --rebase -q origin main 2>$null
& git stash pop -q 2>$null

# 2) today's KST date
$todayKst = (Get-Date).ToUniversalTime().AddHours(9).ToString("yyyy-MM-dd")
$lastSent = ""
$lsFile = Join-Path $dir "data\last-sent.txt"
if (Test-Path $lsFile) { $lastSent = (Get-Content $lsFile -Raw).Trim() }

if ($lastSent -eq $todayKst) {
  Log "already sent today ($todayKst) - skip"
  exit 0
}

# 3) send locally (email+kakao+archive+page). daily-cloud reads .env
Log "not sent today - running local pipeline"
& $node --env-file-if-exists=.env scripts\daily-cloud.mjs 2>&1 | ForEach-Object { Add-Content -Path $log -Value $_ }
$rc = $LASTEXITCODE
Log ("pipeline exit=" + $rc)

# 4) push updated state (best effort; git uses Windows Credential Manager, not gh keyring)
if ($rc -eq 0) {
  & git add -A 2>$null
  & git -c user.name="vgun1205" -c user.email="vgun1205@gmail.com" commit -q -m "chore: local backup send $todayKst" 2>$null
  & git push -q 2>$null
  if ($LASTEXITCODE -eq 0) { Log "state pushed" } else { Log "push failed (state stays local)" }
}
