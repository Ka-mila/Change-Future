@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 > nul
title Change Future

rem ============================================================
rem  Ir a la carpeta del script.
rem  pushd (en vez de cd /d) tambien funciona en carpetas de red.
rem ============================================================
pushd "%~dp0" 2>nul
if errorlevel 1 (
    echo  [X] No pude entrar a la carpeta del proyecto.
    pause
    exit /b 1
)
set "RAIZ=%CD%"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"

set "PUERTO_WEB=5173"
rem Python en UTF-8: evita errores con tildes y n en Windows
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

echo.
echo  ===  Change Future: encendiendo todo  ===
echo.

rem --- Si lo abrieron directo desde el .zip sin descomprimir ---
if /i not "%RAIZ:\AppData\Local\Temp\=%"=="%RAIZ%" (
    echo  [X] Parece que abriste esto desde dentro del archivo .zip.
    echo      Primero haz clic derecho en el .zip, "Extraer todo",
    echo      y luego abre iniciar.bat desde la carpeta extraida.
    pause
    exit /b 1
)

rem --- Revisar que la carpeta del proyecto este completa ---
if not exist "%RAIZ%\backend\requirements-local.txt" (
    echo  [X] No encuentro backend\requirements-local.txt
    echo      Este archivo debe estar en la carpeta principal del proyecto,
    echo      junto a las carpetas "backend" y "frontend".
    pause
    exit /b 1
)
if not exist "%RAIZ%\frontend\package.json" (
    echo  [X] No encuentro frontend\package.json
    echo      Este archivo debe estar en la carpeta principal del proyecto.
    pause
    exit /b 1
)

rem ============================================================
rem  Python: se prueba que de verdad funcione (el "python" falso
rem  de la Microsoft Store pasa el "where" pero no funciona).
rem ============================================================
set "PYTHON="
call :probar_python py -3
if not defined PYTHON call :probar_python python
if not defined PYTHON call :probar_python python3
if not defined PYTHON (
    echo  [X] No encuentro Python 3.9 o mas nuevo.
    echo      Instalalo desde https://www.python.org/downloads
    echo      y marca la casilla "Add Python to PATH".
    echo      Despues cierra esta ventana y vuelve a abrir iniciar.bat
    pause
    exit /b 1
)

rem ============================================================
rem  Node.js 18 o mas nuevo
rem ============================================================
where node >nul 2>nul
if errorlevel 1 goto :sin_node
where npm >nul 2>nul
if errorlevel 1 goto :sin_node
set "NODE_MAYOR=0"
for /f "tokens=1 delims=v." %%v in ('node -v 2^>nul') do set "NODE_MAYOR=%%v"
if %NODE_MAYOR% LSS 18 (
    echo  [X] Tu Node.js es muy antiguo. Se necesita la version 18 o mas nueva.
    echo      Instala la version LTS desde https://nodejs.org
    pause
    exit /b 1
)

rem --- Si ya esta encendido, solo abrir el navegador ---
call :puerto_en_uso %PUERTO_WEB%
if not errorlevel 1 (
    echo  Parece que Change Future ya esta encendido.
    echo  Abro el navegador. Si no funciona, cierra las ventanas negras y vuelve a intentar.
    start "" http://localhost:%PUERTO_WEB%
    timeout /t 5 > nul
    exit /b 0
)

rem ============================================================
rem  Backend: entorno de Python
rem ============================================================
set "VENV=%RAIZ%\backend\.venv"
set "PY=%VENV%\Scripts\python.exe"

rem Si la carpeta .venv vino copiada de otro PC, no sirve: se borra y se rehace
if exist "%VENV%\" (
    "%PY%" -c "import sys" >nul 2>nul
    if errorlevel 1 (
        echo  El backend estaba instalado para otro PC. Lo reinstalo para este...
        rmdir /s /q "%VENV%"
    )
)

if not exist "%PY%" (
    echo  Instalando el backend. Solo pasa la primera vez, espera unos minutos...
    %PYTHON% -m venv "%VENV%"
    if errorlevel 1 (
        echo  [X] No se pudo crear el entorno de Python. Copia el error de arriba.
        pause
        exit /b 1
    )
)

echo  Revisando dependencias del backend...
"%PY%" -m pip install -q --disable-pip-version-check -r "%RAIZ%\backend\requirements-local.txt"
if errorlevel 1 (
    echo  [X] No se pudieron instalar las dependencias del backend.
    echo      Revisa tu conexion a internet y copia el error de arriba.
    pause
    exit /b 1
)

rem ============================================================
rem  Frontend: dependencias de Node
rem ============================================================
rem Si node_modules vino de un Mac/Linux, no tiene los archivos .cmd de Windows
if exist "%RAIZ%\frontend\node_modules\" (
    if not exist "%RAIZ%\frontend\node_modules\.bin\*.cmd" (
        echo  El frontend estaba instalado para otro sistema. Lo reinstalo...
        rmdir /s /q "%RAIZ%\frontend\node_modules"
    )
)

echo  Revisando dependencias del frontend...
pushd "%RAIZ%\frontend"
call npm install --no-audit --no-fund
set "NPM_ERROR=%errorlevel%"
popd
if not "%NPM_ERROR%"=="0" (
    echo  [X] No se pudo instalar el frontend.
    echo      Revisa tu conexion a internet y copia el error de arriba.
    pause
    exit /b 1
)

rem ============================================================
rem  Encender cada parte en su propia ventana
rem ============================================================
call :encender "Servicio usuarios"        servicio-usuarios
call :encender "Servicio catalogo"        servicio-catalogo
call :encender "Servicio pedidos"         servicio-pedidos
call :encender "Servicio personalizacion" servicio-personalizacion
call :encender "Servicio procesamiento"   servicio-procesamiento
call :encender "Gateway"                  gateway
start "Frontend" /D "%RAIZ%\frontend" cmd /k "npm run dev"

echo.
echo  Listo. Se abrieron 7 ventanas negras: NO las cierres mientras usas la pagina.
echo  Esperando a que la pagina este lista (puede tardar hasta 1 minuto)...
call :esperar_puerto %PUERTO_WEB% 90
if errorlevel 1 (
    echo  [!] La pagina esta tardando. Abro el navegador igual;
    echo      si sale error, espera unos segundos y recarga con F5.
)
start "" http://localhost:%PUERTO_WEB%

echo.
echo  Para apagar todo: cierra las 7 ventanas negras.
echo  Puedes cerrar esta ventana.
pause
popd
exit /b 0


rem ============================================================
rem  Subrutinas
rem ============================================================

:sin_node
echo  [X] No encuentro Node.js.
echo      Instalalo desde https://nodejs.org  ^(boton LTS^)
echo      Despues cierra esta ventana y vuelve a abrir iniciar.bat
pause
exit /b 1

:probar_python
rem Prueba un comando de Python; si funciona y es 3.9+, lo guarda en PYTHON
%* -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if not errorlevel 1 set "PYTHON=%*"
exit /b 0

:encender
rem %1 = titulo de la ventana, %2 = carpeta dentro de backend
if not exist "%RAIZ%\backend\%~2\app.py" (
    echo  [!] No encuentro backend\%~2\app.py, me salto ese servicio.
    exit /b 0
)
start "%~1" /D "%RAIZ%\backend\%~2" cmd /k ""%PY%" app.py"
exit /b 0

:puerto_en_uso
rem Devuelve 0 si algo ya esta escuchando en el puerto %1
powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort %1 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
exit /b %errorlevel%

:esperar_puerto
rem Espera hasta %2 segundos a que el puerto %1 este escuchando
powershell -NoProfile -Command "$fin = (Get-Date).AddSeconds(%2); while ((Get-Date) -lt $fin) { if (Get-NetTCPConnection -State Listen -LocalPort %1 -ErrorAction SilentlyContinue) { exit 0 }; Start-Sleep -Seconds 1 }; exit 1" >nul 2>nul
if errorlevel 1 (
    rem Si PowerShell no esta disponible, al menos esperar un rato
    timeout /t 10 /nobreak > nul
    exit /b 1
)
exit /b 0
