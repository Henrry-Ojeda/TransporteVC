@echo off
title Auto-Inicio Transporte V2
cd /d "%~dp0"

:: 1. Espera de cortesia para que SQL Server este listo
ping 127.0.0.1 -n 5 >nul

:: 2. Iniciar Produccion en segundo plano (Puerto 5190)
if exist "%~dp0Despliegue\Produccion\Transporte_App_PROD\Iniciar_Segundo_Plano.bat" (
    call "%~dp0Despliegue\Produccion\Transporte_App_PROD\Iniciar_Segundo_Plano.bat"
)

:: 3. Iniciar Desarrollo en segundo plano (Puerto 5188)
cd /d "%~dp0"
if exist "%~dp0Iniciar_Desarrollo_SegundoPlano.bat" (
    call "%~dp0Iniciar_Desarrollo_SegundoPlano.bat"
)

echo [%date% %time%] Servidores de Produccion y Desarrollo iniciados. >> "%~dp0AutoInicio.log"
