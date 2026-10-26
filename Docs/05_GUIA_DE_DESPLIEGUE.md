# 🚀 05. Guía de Despliegue y Arquitectura Multi-Ambiente (Transporte V2)

El sistema **Transporte V2** cuenta con una separación estricta, aislada y profesional entre los entornos de **DESARROLLO (DEV)** y **PRODUCCIÓN (PROD)**.

---

## 🏗️ 1. Matriz de Ambientes

| Parámetro | 🟢 DESARROLLO (DEV) | 🔴 PRODUCCIÓN (PROD) |
| :--- | :--- | :--- |
| **Base de Datos** | `BD_TRANSPORTE_DEV` | `BD_TRANSPORTE_PROD` |
| **Puerto Servidor** | **5188** | **5190** |
| **URL Base** | `http://localhost:5188/` | `http://localhost:5190/` |
| **Documentación Swagger** | `http://localhost:5188/swagger` | Deshabilitado / Restringido |
| **Archivo de Configuración** | `appsettings.Development.json` | `appsettings.Production.json` |
| **Carpeta Desplegada** | `Despliegue/Desarrollo/Transporte_App_DEV/` | `Despliegue/Produccion/Transporte_App_PROD/` |
| **Script de Inicio Local** | [`Iniciar_Desarrollo.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Iniciar_Desarrollo.bat) | [`Iniciar_Produccion.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Iniciar_Produccion.bat) |

---

## ⚡ 2. Despliegue Automatizado (1-Click)

### Desplegar Ambos Ambientes
Ejecute con doble clic [`desplegar.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/desplegar.bat) desde el Explorador de Windows o mediante PowerShell:
```powershell
.\desplegar.ps1 -TargetEnv All
```

### Desplegar Solo un Ambiente Específico
```powershell
# Solo Producción
.\desplegar.ps1 -TargetEnv Production

# Solo Desarrollo
.\desplegar.ps1 -TargetEnv Development
```

---

## 🏃 3. Ejecución de los Paquetes Desplegados

### En Producción (`Despliegue/Produccion/Transporte_App_PROD/`):
- **`Iniciar_PRODUCCION.bat`**: Inicia el servidor en el puerto **5190** conectado a **`BD_TRANSPORTE_PROD`** y abre el navegador.
- **`Iniciar_Segundo_Plano.bat`**: Inicia el servicio minimizado en segundo plano en el puerto 5190.
- **`Detener_PRODUCCION.bat`**: Detiene los procesos que estén escuchando en el puerto 5190.
- **`Configurar_Firewall.bat`**: *(Ejecutar como Administrador)* Abre el puerto 5190 en el Firewall de Windows para admitir conexiones de dispositivos móviles en la red local.

### En Desarrollo (`Despliegue/Desarrollo/Transporte_App_DEV/`):
- **`Iniciar_DESARROLLO.bat`**: Inicia el servidor en el puerto **5188** conectado a **`BD_TRANSPORTE_DEV`** y abre el navegador.
- **`Detener_DESARROLLO.bat`**: Detiene el servicio del puerto 5188.

---

## 🌐 4. Acceso Móvil y PWA (Red WiFi / LAN)

1. En el equipo servidor, ejecute `Configurar_Firewall.bat` como Administrador.
2. Obtenga la IP local de la máquina (ejemplo: `192.168.1.100`).
3. Conecte los dispositivos móviles a la misma red WiFi e ingrese a:
   - **Producción**: `http://192.168.1.100:5190/`
   - **Desarrollo**: `http://192.168.1.100:5188/`
4. En Chrome/Safari en el teléfono, toque **"Instalar aplicación"** o **"Añadir a la pantalla de inicio"** para usar la versión PWA offline.

---

## 🔍 5. Endpoint de Diagnóstico y Verificación

Ambos servidores cuentan con un endpoint de verificación en tiempo real:
```http
GET /api/system/environment
```

Respuesta de ejemplo (DEV):
```json
{
  "environment": "Development",
  "database": "BD_TRANSPORTE_DEV",
  "port": 5188,
  "serverTime": "2026-09-25 18:25:00",
  "status": "ONLINE"
}
```

Respuesta de ejemplo (PROD):
```json
{
  "environment": "Production",
  "database": "BD_TRANSPORTE_PROD",
  "port": 5190,
  "serverTime": "2026-09-25 18:25:00",
  "status": "ONLINE"
}
```
