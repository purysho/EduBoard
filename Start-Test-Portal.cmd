@echo off
rem Double-click to run the EduBoard Portal on this computer for testing.
rem No PowerShell or typed commands needed. See docs/TESTING_WITHOUT_A_TERMINAL.md.
setlocal
title EduBoard Portal (local test)
cd /d "%~dp0portal"

where node >nul 2>nul
if errorlevel 1 goto :no_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto :old_node

if exist node_modules\better-sqlite3 goto :run
echo.
echo   First run: downloading the Portal's parts. This takes a minute or two...
echo.
call npm ci --no-audit --no-fund
if errorlevel 1 goto :install_failed

:run
node scripts\local-test.js
echo.
echo   The Portal has stopped. You can close this window.
pause
exit /b 0

:no_node
echo.
echo   Node.js is not installed yet. The Portal needs it to run.
echo.
echo   1. Your browser will now open the Node.js download page.
echo   2. Download the Windows Installer (.msi) for the LTS version and run it,
echo      clicking Next through every step.
echo   3. Double-click Start-Test-Portal.cmd again.
echo.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:old_node
echo.
echo   This computer has an older Node.js. The Portal needs version 22 or newer.
echo   Your browser will open the download page: install the LTS version, then
echo   double-click Start-Test-Portal.cmd again.
echo.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:install_failed
echo.
echo   Downloading the Portal's parts failed. Check the internet connection and
echo   double-click Start-Test-Portal.cmd again.
pause
exit /b 1
