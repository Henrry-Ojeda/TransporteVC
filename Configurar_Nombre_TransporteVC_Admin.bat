@echo off
title Configurar Acceso transportevc y Permisos
:: Verificar permisos de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ====================================================================
    echo   SOLICITANDO PERMISOS DE ADMINISTRADOR...
    echo   Por favor haz clic en "SI" en la ventana emergente de Windows.
    echo ====================================================================
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ====================================================================
echo   CONFIGURANDO DOMINIO LOCAL 'transportevc' EN WINDOWS HOSTS
echo ====================================================================
echo.

set HOSTS_FILE=%windir%\System32\drivers\etc\hosts

:: Quitar atributos de solo lectura si los tiene
attrib -r "%HOSTS_FILE%" >nul 2>&1

findstr /i "transportevc" "%HOSTS_FILE%" >nul
if %errorLevel% neq 0 (
    echo. >> "%HOSTS_FILE%"
    echo 127.0.0.1 transportevc >> "%HOSTS_FILE%"
    echo 127.0.0.1 transportevc.local >> "%HOSTS_FILE%"
    echo ::1 transportevc >> "%HOSTS_FILE%"
    echo [OK] Dominio 'transportevc' agregado exitosamente a hosts.
) else (
    echo [OK] 'transportevc' ya se encuentra registrado en el archivo hosts.
)

echo.
echo ====================================================================
echo   CONFIGURACION DE REGLAS DE FIREWALL PARA PUERTOS 5188, 5190 Y 1590
echo ====================================================================
netsh advfirewall firewall show rule name="Transporte_Puertos" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="Transporte_Puertos" dir=in action=allow protocol=TCP localport=5188,5190,1590 >nul
    echo [OK] Puertos 5188, 5190 y 1590 habilitados en Firewall de Windows.
) else (
    echo [OK] Regla de firewall ya configurada.
)

echo.
echo [OK] Limpiando cache DNS de Windows...
ipconfig /flushdns >nul

echo.
echo ====================================================================
echo   TODO LISTO! Abriendo http://transportevc:1590/ en el navegador...
echo ====================================================================
start http://transportevc:1590/
timeout /t 3 >nul
exit
