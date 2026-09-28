@echo off
rem Double-click once to lock down the Portal server: a firewall, blocking of repeated
rem failed sign-ins, automatic security updates, the Portal running as its own user, and
rem (if you choose) signing in with this computer's key instead of a password. It first
rem updates the Portal, then runs portal/scripts/harden-server.sh on the server. Safe to
rem run again.
setlocal
title Lock down the EduBoard Portal server

where ssh >nul 2>nul
if errorlevel 1 goto :no_ssh
where ssh-keygen >nul 2>nul
if errorlevel 1 goto :no_ssh

set "HOST=portal.edu-board.com"
set "KEYFILE=%USERPROFILE%\.ssh\id_ed25519"
echo.
echo   This locks down your Portal server:
echo     - a firewall: only the website and SSH can be reached from outside
echo     - addresses that keep failing to sign in are blocked for an hour
echo     - security updates install by themselves (the server restarts at 4am
echo       China time when an update needs it)
echo     - the Portal runs as its own user, not as the server's administrator
echo     - this computer gets a key, so it can sign in without the password
echo   Students' accounts and work are backed up first and kept.
echo.
set /p "HOST=  Server address (press Enter for %HOST%): "

if exist "%KEYFILE%.pub" goto :have_key
echo.
echo   Making a key for this computer ...
if not exist "%USERPROFILE%\.ssh" mkdir "%USERPROFILE%\.ssh"
ssh-keygen -q -t ed25519 -N "" -C "eduboard-%COMPUTERNAME%" -f "%KEYFILE%"
if errorlevel 1 goto :failed
:have_key
set /p KEY=<"%KEYFILE%.pub"

echo.
echo   Connecting to root@%HOST% ...
echo   If asked for a password, type the server's root password (from VPS.do).
echo   Nothing appears while you type it; that's normal. Then press Enter.
echo.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 root@%HOST% "S=/opt/eduboard/portal/scripts/update-server.sh; if [ -f $S ]; then cp $S /tmp/eb-update.sh; else curl -fsSL https://raw.githubusercontent.com/purysho/EduBoard/main/portal/scripts/update-server.sh -o /tmp/eb-update.sh; fi && EDUBOARD_BRANCH=main bash /tmp/eb-update.sh && EB_SSH_KEY='%KEY%' bash /opt/eduboard/portal/scripts/harden-server.sh"
if errorlevel 1 goto :failed

echo.
echo   Checking this computer can now sign in with its key ...
ssh -o BatchMode=yes -o PasswordAuthentication=no -o PreferredAuthentications=publickey -o ConnectTimeout=15 root@%HOST% "true"
if errorlevel 1 goto :key_failed
echo   It can: this computer won't be asked for the password again.

echo.
echo   Last step: turn off password sign-in to the server? (recommended)
echo   Then nobody can get in by guessing the password; only computers with a key can.
echo   To use a different computer later, sign in to the web console on VPS.do and type
echo     bash /opt/eduboard/portal/scripts/harden-server.sh allow-passwords
echo   then run this file on the other computer.
echo.
choice /c YN /m "  Turn off password sign-in"
if errorlevel 2 goto :done_passwords_on
ssh -o BatchMode=yes -o ConnectTimeout=15 root@%HOST% "bash /opt/eduboard/portal/scripts/harden-server.sh lock-ssh"
if errorlevel 1 goto :failed
echo.
echo   All done. Keep this computer's key safe: it's in %USERPROFILE%\.ssh
pause
exit /b 0

:done_passwords_on
echo.
echo   All done. Password sign-in is still on; run this file again to turn it off.
pause
exit /b 0

:key_failed
echo.
echo   The server is locked down, but this computer couldn't sign in with its key, so
echo   password sign-in was left on. Copy the lines above and send them for help.
pause
exit /b 1

:failed
echo.
echo   It didn't finish. The lines above say why (look for PROBLEM or ERROR). Nothing
echo   that stops you signing in with the password was changed.
echo   Copy the lines above and send them for help.
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
