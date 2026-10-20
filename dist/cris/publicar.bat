@echo off
setlocal
cd /d "%~dp0"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Este projeto ainda nao esta conectado a um repositorio GitHub.
  echo Execute configurar-git.bat primeiro.
  pause
  exit /b 1
)

echo ========================================
echo CRIS - Publicar atualizacao
echo ========================================
echo.
git status

echo.
set /p MSG=Mensagem do commit: 
if "%MSG%"=="" set "MSG=Atualiza CRIS"

git add .
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo Nenhuma alteracao nova para publicar.
  pause
  exit /b 0
)

echo.
echo Enviando atualizacao...
git push
if errorlevel 1 (
  echo.
  echo O push falhou. Confira sua conexao e o login do GitHub.
  pause
  exit /b 1
)

echo.
echo Atualizacao enviada. O GitHub Actions publicara a nova versao automaticamente.
pause
