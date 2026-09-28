@echo off
rem For a school's IT: installs a school pack for everyone who uses EduBoard on this
rem computer (docs/SCHOOL_DEPLOYMENT.md). Put the pack exported from EduBoard
rem (a .eduboard-school.json file) in the same folder as this file, then right-click this
rem file and choose "Run as administrator".
setlocal
title Install the school pack for everyone on this computer

net session >nul 2>nul
if errorlevel 1 goto :not_admin

set "PACK="
for %%F in ("%~dp0*.eduboard-school.json" "%~dp0school-pack.json") do if exist "%%~F" if not defined PACK set "PACK=%%~F"
if not defined PACK goto :no_pack

set "DEST=%ProgramData%\EduBoard"
echo.
echo   School pack: %PACK%
echo   Installing it for everyone on this computer, in %DEST%
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%PACK%" "%DEST%\school-pack.json" >nul
if errorlevel 1 goto :failed
echo.
echo   Done. The next time a teacher opens EduBoard on this computer, it shows the
echo   school's name, logo and colour, and uses the school's settings.
echo   To remove it, delete %DEST%\school-pack.json
echo.
pause
exit /b 0

:not_admin
echo.
echo   This needs administrator rights. Close this window, right-click
echo   Install-School-Pack.cmd and choose "Run as administrator".
echo.
pause
exit /b 1

:no_pack
echo.
echo   No school pack found next to this file. In EduBoard, open Settings, then
echo   Data and security, then School pack, and choose Export. Save the file in the
echo   same folder as Install-School-Pack.cmd and run this again.
echo.
pause
exit /b 1

:failed
echo.
echo   The file couldn't be copied. Check you ran this as administrator.
echo.
pause
exit /b 1
