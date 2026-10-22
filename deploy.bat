@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
echo ========================================
echo   DEPLOY len Firebase Hosting
echo   https://gen-lang-client-0931039939.web.app
echo ========================================
echo.

:: Kiem tra Firebase CLI
call firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Chua co Firebase CLI. Dang cai dat...
    call npm install -g firebase-tools
    if errorlevel 1 goto failed
)

echo [1/3] Dang nhap Firebase...
call firebase login
if errorlevel 1 goto failed

echo.
echo [2/3] Chon project...
call firebase use gen-lang-client-0931039939
if errorlevel 1 goto failed

echo.
echo [3/3] Dang deploy...
call firebase deploy --project gen-lang-client-0931039939 --only hosting,firestore:rules
if errorlevel 1 goto failed

echo.
echo ========================================
echo   XONG! Mo trinh duyet kiem tra:
echo   https://gen-lang-client-0931039939.web.app
echo ========================================
pause
popd
exit /b 0

:failed
echo Deploy that bai. Kiem tra thong bao loi o tren.
popd
exit /b 1
