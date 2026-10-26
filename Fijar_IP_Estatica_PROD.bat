@echo off
:: ==============================================================================
:: Script para Asignar IP Fija a la Computadora Servidor (PRODUCCION / DEV)
:: ==============================================================================
title Fijar IP Estatica del Servidor - Transporte V2

:: Solicitar permisos de Administrador automáticamente si no los tiene
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ==================================================================
echo   CONFIGURACION DE IP FIJA (ESTATICA) PARA EL SERVIDOR PROD/DEV
echo ==================================================================
echo.
echo Adaptador de Red  : Wi-Fi
echo Direccion IPv4    : 192.168.1.115
echo Mascara de Subred : 255.255.255.0
echo Puerta de Enlace  : 192.168.1.1
echo Servidor DNS 1    : 192.168.1.1
echo Servidor DNS 2    : 8.8.8.8
echo.
echo ==================================================================
echo 1. Aplicando Direccion IP Estatica y Puerta de Enlace...
netsh interface ipv4 set address name="Wi-Fi" static 192.168.1.115 255.255.255.0 192.168.1.1 1

echo 2. Configurando Servidores DNS...
netsh interface ipv4 set dns name="Wi-Fi" static 192.168.1.1 primary
netsh interface ipv4 add dns name="Wi-Fi" 8.8.8.8 index=2

echo 3. Habilitando Reglas de Firewall para puertos 5190 (PROD) y 5188 (DEV)...
netsh advfirewall firewall delete rule name="Transporte V2 PRODUCCION (Puerto 5190)" >nul 2>&1
netsh advfirewall firewall add rule name="Transporte V2 PRODUCCION (Puerto 5190)" dir=in action=allow protocol=TCP localport=5190 >nul 2>&1
netsh advfirewall firewall delete rule name="Transporte V2 DESARROLLO (Puerto 5188)" >nul 2>&1
netsh advfirewall firewall add rule name="Transporte V2 DESARROLLO (Puerto 5188)" dir=in action=allow protocol=TCP localport=5188 >nul 2>&1

echo.
echo ==================================================================
echo   CONFIGURACION COMPLETADA EXITOSAMENTE
echo ==================================================================
echo.
echo Ahora la direccion IP de este equipo es SIEMPRE FIJA:
echo.
echo   >>> URL PRODUCCION : http://192.168.1.115:5190/
echo   >>> URL DESARROLLO : http://192.168.1.115:5188/
echo.
echo Puedes ingresar desde cualquier celular, tablet o PC conectada
echo a la red Wi-Fi usando la URL de PRODUCCION.
echo ==================================================================
echo.
pause
