@echo off
REM Basketball news daily sender. Calls node.exe directly (npm.cmd is unreliable under Task Scheduler).
REM Network readiness is handled inside node (waitForNetwork). This bat just runs node and
REM propagates node's exit code so the scheduler's "restart on failure" can retry.
cd /d "%~dp0"
if not exist "%~dp0data" mkdir "%~dp0data"

set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"

echo [%date% %time%] news send start >> "%~dp0data\send.log"
"%NODE%" --env-file-if-exists=.env scripts\send-once.mjs >> "%~dp0data\send.log" 2>&1
set "RC=%errorlevel%"
echo [%date% %time%] news send end (exit %RC%) >> "%~dp0data\send.log"
REM Propagate node's exit code to Task Scheduler (non-zero => restart-on-failure retries).
exit /b %RC%
