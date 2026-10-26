@echo off
:: ==============================================================================
:: Script para Restaurar la IP a Automática (DHCP)
:: ==============================================================================
title Restaurar IP Automatica - Transporte V2

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ==================================================================
echo   RESTAURAR IP A AUTOMATICA (DHCP)
echo ==================================================================
echo.
echo 1. Restaurando IP automatica en Wi-Fi...
netsh interface ipv4 set address name="Wi-Fi" dhcp

echo 2. Restaurando DNS automatico en Wi-Fi...
netsh interface ipv4 set dns name="Wi-Fi" dhcp

echo.
echo Configuracion DHCP restaurada exitosamente.
echo ==================================================================
echo.
pause
