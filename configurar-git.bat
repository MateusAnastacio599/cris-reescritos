@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo CRIS - Configuracao inicial do Git
echo ========================================

git --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERRO: Git nao foi encontrado neste computador.
  echo Instale o Git e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist ".git" (
  echo.
  echo Inicializando repositorio...
  git init
)

git branch -M main

echo.
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  set /p REPO_URL=Cole a URL HTTPS do repositorio GitHub: 
  if "%REPO_URL%"=="" (
    echo Nenhuma URL informada. Operacao cancelada.
    pause
    exit /b 1
  )
  git remote add origin "%REPO_URL%"
) else (
  echo Remote origin ja configurado:
  git remote get-url origin
)

echo.
echo Preparando arquivos...
git add .
git status

echo.
git commit -m "Versao inicial do CRIS"
if errorlevel 1 echo Nenhum novo commit foi criado.

echo.
echo Enviando para o GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo O push falhou. Confira a URL do repositorio e o login do GitHub.
  pause
  exit /b 1
)

echo.
echo Concluido. O GitHub Actions fara a publicacao no GitHub Pages.
pause
