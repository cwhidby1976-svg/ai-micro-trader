@echo off
title AI MICRO TRADER - FINAL WINDOWS UPDATES
color 0A

cd /d "%~dp0"

echo ============================================
echo     AI MICRO TRADER - FINAL UPDATES
echo ============================================
echo.
echo Starting Windows licensing finalization...
echo.

if not exist "FINISH-WINDOWS-LICENSING.ps1" (
    echo ERROR: Finalization script not found.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FINISH-WINDOWS-LICENSING.ps1"

echo.
if errorlevel 1 (
    echo FINALIZATION FAILED - REVIEW ERRORS ABOVE.
) else (
    echo FINALIZATION SCRIPT COMPLETED.
    echo Review test results before distribution.
)

echo.
pause