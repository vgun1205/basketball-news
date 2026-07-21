# Basketball news backup trigger (daily 09:20, local PC):
# If today's cloud run hasn't happened, force-run the GitHub workflow.
# 2nd safety net for GitHub free-tier cron delays/drops. ASCII only (PS 5.1 encoding).
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "vgun1205/basketball-news"
$log = Join-Path $PSScriptRoot "data\backup-trigger.log"
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) }

try {
  $threshold = (Get-Date -Hour 8 -Minute 50 -Second 0).ToUniversalTime()
  $json = & $gh run list -R $repo --workflow daily-basketball-news --limit 5 --json createdAt,status 2>$null | ConvertFrom-Json
  $todayRun = $json | Where-Object { [DateTime]::Parse($_.createdAt).ToUniversalTime() -ge $threshold }
  if ($todayRun) { Log "cloud run exists today - no backup needed"; exit 0 }

  Log "no cloud run today - dispatching workflow"
  & $gh workflow run daily-basketball-news -R $repo 2>$null
  if ($LASTEXITCODE -eq 0) { Log "dispatch OK" } else { Log ("dispatch FAILED exit=" + $LASTEXITCODE) }
} catch {
  Log ("error: " + $_.Exception.Message)
}
