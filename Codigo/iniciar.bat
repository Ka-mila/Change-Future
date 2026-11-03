@echo off
chcp 65001 > nul
title Change Future
cd /d "%~dp0"

echo.
echo  ===  Change Future: encendiendo todo  ===
echo.

rem --- Revisar que Python y Node.js esten instalados ---
set "PYTHON="
where py >nul 2>nul && set "PYTHON=py"
if not defined PYTHON where python >nul 2>nul && set "PYTHON=python"
if not defined PYTHON (
    echo  [X] No encuentro Python.
    echo      Instalalo desde https://www.python.org/downloads
    echo      y marca la casilla "Add Python to PATH".
    pause
    exit /b
)
where npm >nul 2>nul
if errorlevel 1 (
    echo  [X] No encuentro Node.js.
    echo      Instalalo desde https://nodejs.org  ^(boton LTS^)
    pause
    exit /b
)

rem --- Primera vez: instalar dependencias ---
if not exist "backend\.venv\Scripts\python.exe" (
    echo  Instalando el backend. Solo pasa la primera vez, espera unos minutos...
    %PYTHON% -m venv backend\.venv
    "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements-local.txt
    if errorlevel 1 (
        echo  [X] No se pudo instalar el backend. Copia el error de arriba.
        rmdir /s /q backend\.venv
        pause
        exit /b
    )
)
if not exist "frontend\node_modules" (
    echo  Instalando el frontend. Solo pasa la primera vez, espera unos minutos...
    pushd frontend
    call npm install
    popd
    if not exist "frontend\node_modules" (
        echo  [X] No se pudo instalar el frontend. Copia el error de arriba.
        pause
        exit /b
    )
)

rem --- Encender cada parte en su propia ventana ---
set "PY=%~dp0backend\.venv\Scripts\python.exe"
start "Servicio usuarios"        /D "%~dp0backend\servicio-usuarios"        cmd /k ""%PY%" app.py"
start "Servicio catalogo"        /D "%~dp0backend\servicio-catalogo"        cmd /k ""%PY%" app.py"
start "Servicio pedidos"         /D "%~dp0backend\servicio-pedidos"         cmd /k ""%PY%" app.py"
start "Servicio personalizacion" /D "%~dp0backend\servicio-personalizacion" cmd /k ""%PY%" app.py"
start "Gateway"                  /D "%~dp0backend\gateway"                  cmd /k ""%PY%" app.py"
start "Frontend"                 /D "%~dp0frontend"                         cmd /k "npm run dev"

echo  Listo. Se abrieron 6 ventanas negras: NO las cierres mientras usas la pagina.
echo  En unos segundos se abre el navegador...
timeout /t 10 /nobreak > nul
start "" http://localhost:5173

echo.
echo  Para apagar todo: cierra las 6 ventanas negras.
echo  Puedes cerrar esta ventana.
pause
