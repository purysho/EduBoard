@echo off
rem Double-click once to make edu-board.com show EduBoard's homepage with downloads. The
rem Portal stays at portal.edu-board.com. It first updates the Portal (the homepage is part
rem of it), then runs portal/scripts/set-up-homepage.sh on the server. Safe to run again.
setlocal
title Set up the edu-board.com homepage

where ssh >nul 2>nul
if errorlevel 1 goto :no_ssh

echo.
echo   Before this works, edu-board.com has to point at your Portal server.
echo   At the company you bought edu-board.com from, open its DNS settings and:
echo     - find the record for "portal" and note its address (four numbers, like 1.2.3.4)
echo     - set the A record for "@" to that same address (remove any "parking" or
echo       "forwarding" record for @)
echo     - set the A record for "www" to that same address too
echo   It can take from a few minutes to an hour before the change is seen everywhere.
echo.
set /p "READY=  Done that? Press Enter to continue, or close this window to stop. "
echo.
echo   Connecting to root@portal.edu-board.com ...
echo   When asked for a password, type the server's root password (from VPS.do).
echo   Nothing appears while you type it; that's normal. Then press Enter.
echo.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 root@portal.edu-board.com "S=/opt/eduboard/portal/scripts/update-server.sh; if curl -fsSL https://raw.githubusercontent.com/purysho/EduBoard/main/portal/scripts/update-server.sh -o /tmp/eb-update.sh; then :; elif [ -f $S ]; then cp $S /tmp/eb-update.sh; else exit 1; fi && EDUBOARD_BRANCH=main bash /tmp/eb-update.sh && bash /opt/eduboard/portal/scripts/set-up-homepage.sh"
if errorlevel 1 goto :failed
echo.
echo   All done. Open https://edu-board.com to see it.
pause
exit /b 0

:failed
echo.
echo   It didn't finish. The lines above say why (look for PROBLEM). If it says
echo   edu-board.com doesn't point at this server yet, wait a while and run this again.
echo   Otherwise copy the lines above and send them for help.
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
