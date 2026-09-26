@echo off
rem Double-click to update everything: the Portal server, then EduBoard on this computer.
rem See docs/TESTING_WITHOUT_A_TERMINAL.md. Nothing to type except passwords/tokens.
setlocal
title Update EduBoard (Portal server and desktop app)

echo.
echo   === Step 1 of 2: the Portal server (portal.edu-board.com) ===
echo.
where ssh >nul 2>nul
if errorlevel 1 (
  echo   Windows' SSH tool isn't turned on, so the server step is skipped.
  echo   Settings, Apps, Optional features, Add a feature: "OpenSSH Client".
  goto :desktop
)
echo   When asked, type the server's root password. Nothing shows while you type.
echo.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 root@portal.edu-board.com "S=/opt/eduboard/portal/scripts/update-server.sh; if [ -f $S ]; then cp $S /tmp/eb-update.sh; else curl -fsSL https://raw.githubusercontent.com/purysho/EduBoard/claude/trusting-goodall-hxsi5s/portal/scripts/update-server.sh -o /tmp/eb-update.sh; fi && bash /tmp/eb-update.sh"
if errorlevel 1 (
  echo.
  echo   The server update didn't finish; see the messages above. Carrying on with the app.
)

:desktop
echo.
echo   === Step 2 of 2: EduBoard on this computer ===
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\windows\update-desktop.ps1"
echo.
echo   Finished. You can close this window.
pause
