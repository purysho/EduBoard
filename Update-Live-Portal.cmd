@echo off
rem Double-click to update the live Portal server to the latest version. It connects
rem with Windows' built-in SSH (no PowerShell), asks for the server's root password,
rem and runs portal/scripts/update-server.sh there, which backs up the data first.
setlocal
title Update the live EduBoard Portal

where ssh >nul 2>nul
if errorlevel 1 goto :no_ssh

set "HOST=portal.edu-board.com"
echo.
echo   This updates the EduBoard Portal on your server. Students' accounts and work
echo   are backed up first and kept.
echo.
set /p "HOST=  Server address (press Enter for %HOST%): "
echo.
echo   Connecting to root@%HOST% ...
echo   When asked for a password, type the server's root password (from VPS.do).
echo   Nothing appears while you type it; that's normal. Then press Enter.
echo.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 root@%HOST% "curl -fsSL https://raw.githubusercontent.com/purysho/EduBoard/claude/trusting-goodall-hxsi5s/portal/scripts/update-server.sh | bash"
if errorlevel 1 goto :failed
echo.
echo   All done. Publish from EduBoard again to send your classes and attachments.
pause
exit /b 0

:failed
echo.
echo   The update didn't finish. Copy the lines above and send them for help.
echo   If it says "Connection timed out" or "refused", the server doesn't accept SSH
echo   connections: use the VNC console in the VPS.do panel instead.
pause
exit /b 1

:no_ssh
echo.
echo   This computer doesn't have Windows' SSH tool turned on.
echo   Open Settings, then Apps, then Optional features, then Add a feature, and add
echo   "OpenSSH Client". Then double-click this file again.
echo.
pause
exit /b 1
