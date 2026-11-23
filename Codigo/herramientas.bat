@echo off
chcp 65001 > nul
title Change Future - herramientas
cd /d "%~dp0"
set "PY=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%PY%" (
    echo  Primero ejecuta iniciar.bat al menos una vez.
    pause
    exit /b
)

:menu
echo.
echo  ===  Change Future: herramientas  ===
echo.
echo   1. Convertir una cuenta en administrador
echo   2. Crear pedidos de ejemplo para el dashboard
echo   3. Borrar los pedidos de ejemplo
echo   4. Salir
echo.
set "opcion="
set /p opcion="  Elige una opcion (1-4): "

if "%opcion%"=="1" goto admin
if "%opcion%"=="2" goto demo
if "%opcion%"=="3" goto borrar
if "%opcion%"=="4" exit /b
goto menu

:admin
set "correo="
set /p correo="  Correo de la cuenta: "
pushd backend\servicio-usuarios
"%PY%" crear_admin.py "%correo%"
popd
goto menu

:demo
pushd backend\servicio-pedidos
"%PY%" datos_demo.py
popd
goto menu

:borrar
pushd backend\servicio-pedidos
"%PY%" datos_demo.py --borrar
popd
goto menu
