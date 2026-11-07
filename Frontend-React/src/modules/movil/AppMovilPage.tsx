import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { AUTH_TOKEN_KEY } from '@/api/client';
import { authApi } from '@/api/auth.api';
import { catalogosApi } from '@/api/catalogos.api';
import { operacionesApi } from '@/api/operaciones.api';
import { sistemaApi } from '@/api/sistema.api';
import { notificacionesApi, type NotificacionMovil } from '@/api/notificaciones.api';
import type { FincaDto, DespachoCompaniaDto, ControlRutaDto } from '@/types';

interface DispositivoMovilData {
  token: string;
  empresaCodigo: string;
  empresaNombre: string;
  id: number;
  username: string;
  nombreCompleto: string;
  rol: string;
  camionId?: number;
  placaCamion?: string;
  capacidadTanqueLitros: number;
  permisos: string[];
  modulosHabilitados: string[];
}

interface CargaOffline {
  localId: string;
  fecha: string;
  hora: string;
  fincaId: number;
  fincaNombre: string;
  litros: number;
  tipoLeche: string;
  esAcida: boolean;
  esDiferido: boolean;
  temperatura?: number;
  observacion?: string;
  synced: boolean;
  syncedAt?: string;
  serverTicketId?: number;
}

type TabMovil = 'principal' | 'recoleccion' | 'entregas' | 'reportes' | 'perfil';

const REPORTES_CHOFER = [
  { value: 'DIARIOS', label: '1. DIARIOS (Recolección Diaria)', icon: 'fa-calendar-days' },
  { value: 'RECEPTORIAS', label: '2. RECEPTORÍAS (Entregas y Mermas)', icon: 'fa-warehouse' },
  { value: 'FINCAS', label: '3. FINCAS (Detalle por Productor)', icon: 'fa-cow' },
  { value: 'CHOFERES', label: '4. CHOFERES (Resumen Operativo)', icon: 'fa-user-tie' },
  { value: 'RELACION_CHOFER', label: '7. RELACIÓN CHOFER (Liquidación de Viajes)', icon: 'fa-truck-arrow-right' },
];

export const APP_VERSION = 'v2.5.0';

export const AppMovilPage: React.FC = () => {
  // Navegación de Pestañas Móviles
  const [tabActiva, setTabActiva] = useState<TabMovil>('principal');

  // Estado de Red (Online / Offline)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Tenant / Base de Datos Guardada en este Dispositivo
  const [tenantDomain, setTenantDomain] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('movil_tenant_domain');
      if (saved) return saved;
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      if (host.includes('campoverde')) return 'lacteos-campoverde.vercel.app';
      if (host.includes('vergel')) return 'transporte-vergel-carrillo.vercel.app';
      return host || 'transporte-vergel-carrillo.vercel.app';
    } catch {
      return 'transporte-vergel-carrillo.vercel.app';
    }
  });

  const [empresaGuardada, setEmpresaGuardada] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('movil_tenant_empresa');
      if (saved) return saved;
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      if (host.includes('campoverde')) return 'Lácteos Campo Verde';
      if (host.includes('vergel')) return 'Transporte Vergel & Carrillo';
      return '';
    } catch {
      return '';
    }
  });

  // Modo de Login (cuando !dispositivo): 'credenciales' (Usuario y Contraseña) o 'codigo' (6 dígitos)
  const [modoLogin, setModoLogin] = useState<'credenciales' | 'codigo'>('credenciales');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [iniciandoLogin, setIniciandoLogin] = useState(false);

  // Notificaciones Push y Alertas
  const [notificaciones, setNotificaciones] = useState<NotificacionMovil[]>([]);
  const [modalNotificaciones, setModalNotificaciones] = useState(false);
  const ultimasIdsNotificadas = useRef<Set<number>>(new Set());

  // Estado del Dispositivo Vinculado
  const [dispositivo, setDispositivo] = useState<DispositivoMovilData | null>(() => {
    try {
      const saved = localStorage.getItem('movil_device_info');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Fincas en Caché Local
  const [fincas, setFincas] = useState<FincaDto[]>(() => {
    try {
      const saved = localStorage.getItem('movil_fincas_cache');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Cargas Locales del Día (Outbox)
  const [cargas, setCargas] = useState<CargaOffline[]>(() => {
    try {
      const saved = localStorage.getItem('movil_cargas_local');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Despachos / Entregas Asignadas
  const [entregas, setEntregas] = useState<DespachoCompaniaDto[]>([]);
  const [cargandoEntregas, setCargandoEntregas] = useState(false);

  // Viaje / Ticket Activo Asignado al Chofer (creado por Supervisor/Admin o por el chofer)
  const [viajeActivo, setViajeActivo] = useState<ControlRutaDto | null>(() => {
    try {
      const saved = localStorage.getItem('movil_viaje_activo');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [paradasViajeActivo, setParadasViajeActivo] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('movil_paradas_activo');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cargandoViaje, setCargandoViaje] = useState(false);

  // Persistir viaje activo y paradas en LocalStorage
  useEffect(() => {
    if (viajeActivo) {
      localStorage.setItem('movil_viaje_activo', JSON.stringify(viajeActivo));
    } else {
      localStorage.removeItem('movil_viaje_activo');
    }
  }, [viajeActivo]);

  useEffect(() => {
    if (paradasViajeActivo && paradasViajeActivo.length > 0) {
      localStorage.setItem('movil_paradas_activo', JSON.stringify(paradasViajeActivo));
    } else {
      localStorage.removeItem('movil_paradas_activo');
    }
  }, [paradasViajeActivo]);

  // Fecha de hoy por defecto
  const hoyStr = new Date().toISOString().split('T')[0];

  // Estado para la pantalla de Vinculación
  const [codigoInput, setCodigoInput] = useState('');
  const [vinculando, setVinculando] = useState(false);

  // Estado para el modal de Registro de Carga
  const [modalRegistro, setModalRegistro] = useState(false);
  const [formCarga, setFormCarga] = useState({
    fecha: hoyStr,
    fincaId: 0,
    litros: '',
    tipoLeche: 'VACA',
    esAcida: false,
    esDiferido: false,
    temperatura: '',
    observacion: '',
  });
  const [busquedaFinca, setBusquedaFinca] = useState('');

  // Estado de Sincronización
  const [sincronizando, setSincronizando] = useState(false);

  // Estado de Instalación PWA (Descarga en el Teléfono)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [esInstalada, setEsInstalada] = useState<boolean>(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  });
  const [mostrarGuiaIos, setMostrarGuiaIos] = useState(false);

  // Estado de Reportes Móvil
  const [tipoReporte, setTipoReporte] = useState<string>('DIARIOS');
  const [repFechaInicio, setRepFechaInicio] = useState<string>(hoyStr);
  const [repFechaFin, setRepFechaFin] = useState<string>(hoyStr);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [datosReporte, setDatosReporte] = useState<any>(null);

  // Estado de Perfil
  const [perfilForm, setPerfilForm] = useState({
    nombreCompleto: dispositivo?.nombreCompleto || '',
    telefono: '',
    telefonoPagoMovil: '',
    cedula: '',
    passwordActual: '',
    nuevoPassword: '',
    confirmarPassword: '',
  });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  // Detectar cambios de conectividad
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🟢 Conexión a Internet restablecida');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('🟠 Modo Sin Conexión (Offline). Puedes seguir registrando cargas normalmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persistir configuración de tenant de empresa en LocalStorage
  useEffect(() => {
    if (tenantDomain) {
      localStorage.setItem('movil_tenant_domain', tenantDomain);
    }
    if (empresaGuardada) {
      localStorage.setItem('movil_tenant_empresa', empresaGuardada);
    }
  }, [tenantDomain, empresaGuardada]);

  // Consultar notificaciones en tiempo real cada 12s cuando está autenticado y online
  useEffect(() => {
    if (!dispositivo || !isOnline) return;

    // Solicitar permiso de notificaciones push nativas si el navegador lo permite
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch {}
    }

    const pollingNotificaciones = async () => {
      try {
        const data = await notificacionesApi.getMisNotificaciones(30);
        if (Array.isArray(data)) {
          // Detectar nuevas notificaciones no leídas para emitir vibración / aviso toast
          const nuevas = data.filter(
            (n) => !n.leido && !ultimasIdsNotificadas.current.has(n.id)
          );

          if (nuevas.length > 0) {
            nuevas.forEach((n) => ultimasIdsNotificadas.current.add(n.id));

            // Vibración háptica en móvil
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([200, 100, 200]);
              } catch {}
            }

            // Alerta Sonner en pantalla
            const nReciente = nuevas[0];
            toast.info(`🔔 ${nReciente.titulo}`, {
              description: nReciente.mensaje,
              duration: 7000,
              action: {
                label: 'Ver Alerta',
                onClick: () => setModalNotificaciones(true),
              },
            });

            // Notificación nativa PWA si está permitido
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(nReciente.titulo, {
                  body: nReciente.mensaje,
                  icon: '/favicon.ico',
                });
              } catch {}
            }
          }

          setNotificaciones(data);
        }
      } catch (err) {
        console.warn('Error al consultar notificaciones móvil:', err);
      }
    };

    pollingNotificaciones();
    const interval = setInterval(pollingNotificaciones, 12000);
    return () => clearInterval(interval);
  }, [dispositivo, isOnline]);

  // Guardar cargas en LocalStorage cada vez que cambian
  useEffect(() => {
    localStorage.setItem('movil_cargas_local', JSON.stringify(cargas));
  }, [cargas]);

  // Auto-sincronización automática cuando se recupera o detecta conexión a internet
  useEffect(() => {
    if (isOnline && dispositivo) {
      const pendientes = cargas.filter((c) => !c.synced);
      if (pendientes.length > 0 && !sincronizando) {
        toast.info(`📶 Señal disponible: enviando automáticamente ${pendientes.length} carga(s) a la central...`);
        sincronizarCargas(cargas);
      }
    }
  }, [isOnline]);

  // Si estamos en línea y hay conexión, refrescar lista de fincas, perfil, entregas y viaje activo
  useEffect(() => {
    if (dispositivo && isOnline) {
      cargarFincasServidor();
      cargarEntregasChofer();
      cargarPerfilServidor();
      cargarViajeActivo();
    }
  }, [dispositivo, isOnline]);

  const cargarFincasServidor = async () => {
    try {
      const list = await catalogosApi.getFincas();
      if (Array.isArray(list) && list.length > 0) {
        setFincas(list);
        localStorage.setItem('movil_fincas_cache', JSON.stringify(list));
      }
    } catch {
      console.warn('Usando catálogo local de fincas offline.');
    }
  };

  const cargarViajeActivo = async () => {
    if (!dispositivo?.id) return;
    setCargandoViaje(true);
    try {
      // 1. Obtener viaje activo asignado al chofer (creado por él o asignado por supervisor/admin)
      const v = await operacionesApi.getViajeActivo(dispositivo.id);
      if (v && v.id) {
        setViajeActivo(v);
        // Si el ticket trae cisterna o placa específica, actualizar localmente
        if (v.camionId || v.camionPlaca) {
          setDispositivo((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              camionId: v.camionId || prev.camionId,
              placaCamion: v.camionPlaca || prev.placaCamion,
              capacidadTanqueLitros: v.capacidadCamionLitros || prev.capacidadTanqueLitros || 6000,
            };
            localStorage.setItem('movil_device_info', JSON.stringify(updated));
            return updated;
          });
        }
        // 2. Cargar paradas ya registradas en este ticket en el servidor
        const paradas = await operacionesApi.getFincasViaje(v.id);
        setParadasViajeActivo(Array.isArray(paradas) ? paradas : []);
      } else {
        setViajeActivo(null);
        setParadasViajeActivo([]);
      }
    } catch (err) {
      console.warn('No se pudo sincronizar el viaje activo con el servidor:', err);
    } finally {
      setCargandoViaje(false);
    }
  };

  const cargarEntregasChofer = async () => {
    if (!dispositivo?.id) return;
    setCargandoEntregas(true);
    try {
      const allDespachos = await operacionesApi.getDespachosCompanias();
      const misDespachos = (allDespachos || []).filter(
        (d: any) =>
          d.choferId === dispositivo.id ||
          d.conductorId === dispositivo.id ||
          d.usuarioId === dispositivo.id ||
          (dispositivo.camionId && d.camionId === dispositivo.camionId) ||
          (d.choferNombre && d.choferNombre.toLowerCase().includes((dispositivo.nombreCompleto || '').toLowerCase()))
      );
      setEntregas(misDespachos);
    } catch (err) {
      console.warn('No se pudieron obtener entregas del servidor:', err);
    } finally {
      setCargandoEntregas(false);
    }
  };

  const cargarPerfilServidor = async () => {
    try {
      const p = await authApi.getPerfil();
      if (p) {
        setPerfilForm((prev) => ({
          ...prev,
          nombreCompleto: p.nombreCompleto || prev.nombreCompleto,
          telefono: p.telefono || '',
          telefonoPagoMovil: p.telefonoPagoMovil || '',
          cedula: p.cedula || '',
        }));
      }
    } catch {}
  };

  // Capturar evento PWA install
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleInstalled = () => {
      setEsInstalada(true);
      setDeferredPrompt(null);
      toast.success('¡App instalada exitosamente en tu teléfono!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstalarApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setEsInstalada(true);
      }
      setDeferredPrompt(null);
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIos) {
        setMostrarGuiaIos(true);
      } else {
        toast.info('Para instalar en Android: pulsa los 3 puntos ⋮ en tu navegador y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".');
      }
    }
  };

  // Acción: Vincular dispositivo con código de 6 dígitos
  const handleVincular = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codigoInput.replace(/\D/g, '').trim();
    if (clean.length < 6) {
      toast.error('El código debe contener al menos 6 dígitos numéricos');
      return;
    }

    setVinculando(true);
    try {
      const res = await authApi.vincularDispositivo({
        codigo: clean,
        deviceInfo: `${navigator.userAgent} (${navigator.platform})`,
      });

      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      localStorage.setItem('token', res.token);
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          token: res.token,
          user: {
            id: res.id,
            username: res.username,
            nombreCompleto: res.nombreCompleto,
            rol: res.rol,
            permisos: res.permisos,
          }
        },
        version: 0
      }));

      // Determinar dominio y empresa automáticamente a partir del código de vinculación
      let nuevoDominio = 'transporte-vergel-carrillo.vercel.app';
      const codUpper = (res.empresaCodigo || '').toUpperCase();
      if (codUpper.includes('CAMPO')) {
        nuevoDominio = 'lacteos-campoverde.vercel.app';
      } else if (codUpper.includes('VERGEL')) {
        nuevoDominio = 'transporte-vergel-carrillo.vercel.app';
      } else if (tenantDomain) {
        nuevoDominio = tenantDomain;
      }

      const nuevoNombreEmpresa = res.empresaNombre || (codUpper.includes('CAMPO') ? 'Lácteos Campo Verde' : 'Transporte Vergel & Carrillo');

      setTenantDomain(nuevoDominio);
      setEmpresaGuardada(nuevoNombreEmpresa);
      localStorage.setItem('movil_tenant_domain', nuevoDominio);
      localStorage.setItem('movil_tenant_empresa', nuevoNombreEmpresa);

      const dispData: DispositivoMovilData = {
        token: res.token,
        empresaCodigo: res.empresaCodigo,
        empresaNombre: nuevoNombreEmpresa,
        id: res.id,
        username: res.username,
        nombreCompleto: res.nombreCompleto,
        rol: res.rol,
        camionId: res.camionId,
        placaCamion: res.placaCamion,
        capacidadTanqueLitros: res.capacidadTanqueLitros || 6000,
        permisos: res.permisos || [],
        modulosHabilitados: res.modulosHabilitados || [],
      };

      setDispositivo(dispData);
      localStorage.setItem('movil_device_info', JSON.stringify(dispData));
      toast.success(`¡Dispositivo Vinculado a ${nuevoNombreEmpresa}! Bienvenido ${res.nombreCompleto}`);

      try {
        const fincasData = await catalogosApi.getFincas();
        if (Array.isArray(fincasData)) {
          setFincas(fincasData);
          localStorage.setItem('movil_fincas_cache', JSON.stringify(fincasData));
        }
      } catch {}
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Código inválido o expirado. Consulta con tu administrador.');
    } finally {
      setVinculando(false);
    }
  };

  // Acción: Iniciar sesión directa con Usuario y Contraseña (persistiendo base de datos del tenant)
  const handleLoginUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      toast.error('Ingresa tu nombre de usuario y contraseña');
      return;
    }

    setIniciandoLogin(true);
    try {
      const res = await authApi.login({
        username: loginUsername.trim(),
        password: loginPassword,
      });

      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      localStorage.setItem('token', res.token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: res.token,
            user: {
              id: res.id,
              username: res.username,
              nombreCompleto: res.nombreCompleto,
              rol: res.rol,
              permisos: res.permisos,
            },
          },
          version: 0,
        })
      );

      const empNombre = res.empresaNombre || empresaGuardada;
      setEmpresaGuardada(empNombre);
      localStorage.setItem('movil_tenant_empresa', empNombre);

      // Buscar si el chofer tiene camión y capacidad asignada en el catálogo
      let camionId: number | undefined;
      let placaCamion: string | undefined;
      let capacidadTanqueLitros = 6000;

      try {
        const choferes = await catalogosApi.getChoferes();
        const ch = (choferes || []).find(
          (c) =>
            (c.username && res.username && c.username.toLowerCase() === res.username.toLowerCase()) ||
            (c.nombreCompleto &&
              res.nombreCompleto &&
              c.nombreCompleto.toLowerCase().trim() === res.nombreCompleto.toLowerCase().trim())
        );
        if (ch) {
          camionId = ch.camionId;
          placaCamion = ch.camionPlaca || ch.vehiculoPlaca;
          if (ch.capacidadLitros) capacidadTanqueLitros = ch.capacidadLitros;
        }
      } catch {}

      const dispData: DispositivoMovilData = {
        token: res.token,
        empresaCodigo: res.empresaCodigo || 'EMPRESA',
        empresaNombre: empNombre,
        id: res.id,
        username: res.username,
        nombreCompleto: res.nombreCompleto,
        rol: res.rol,
        camionId,
        placaCamion,
        capacidadTanqueLitros,
        permisos: res.permisos || [],
        modulosHabilitados: res.modulosHabilitados || [],
      };

      setDispositivo(dispData);
      localStorage.setItem('movil_device_info', JSON.stringify(dispData));
      toast.success(`¡Bienvenido ${res.nombreCompleto}!`);

      // Descargar catálogo de fincas offline para este chofer
      try {
        const fincasData = await catalogosApi.getFincas();
        if (Array.isArray(fincasData) && fincasData.length > 0) {
          setFincas(fincasData);
          localStorage.setItem('movil_fincas_cache', JSON.stringify(fincasData));
        }
      } catch {}
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Usuario o contraseña incorrectos. Verifica tus credenciales.'
      );
    } finally {
      setIniciandoLogin(false);
    }
  };

  // Acción: Cerrar Sesión del chofer (preserva la empresa y base de datos guardada en este teléfono)
  const handleCerrarSesion = () => {
    if (
      window.confirm(
        `¿Deseas cerrar la sesión de ${dispositivo?.nombreCompleto}? La base de datos de "${dispositivo?.empresaNombre || empresaGuardada}" permanecerá activa en este teléfono para que otro chofer pueda ingresar.`
      )
    ) {
      localStorage.removeItem('movil_device_info');
      localStorage.removeItem('movil_viaje_activo');
      localStorage.removeItem('movil_paradas_activo');
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem('token');
      localStorage.removeItem('auth-storage');
      setDispositivo(null);
      setViajeActivo(null);
      setParadasViajeActivo([]);
      setLoginUsername('');
      setLoginPassword('');
      toast.info('Sesión cerrada. La base de datos sigue guardada.');
    }
  };

  // Acción: Desvincular por completo y cambiar de base de datos / empresa
  const handleDesvincular = () => {
    if (
      window.confirm(
        '¿Seguro que deseas desvincular este dispositivo? Deberás ingresar el código de 6 dígitos de la empresa correspondiente para volver a conectarlo.'
      )
    ) {
      localStorage.removeItem('movil_device_info');
      localStorage.removeItem('movil_viaje_activo');
      localStorage.removeItem('movil_paradas_activo');
      localStorage.removeItem('movil_tenant_domain');
      localStorage.removeItem('movil_tenant_empresa');
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem('token');
      localStorage.removeItem('auth-storage');
      setTenantDomain('');
      setEmpresaGuardada('');
      setDispositivo(null);
      setViajeActivo(null);
      setParadasViajeActivo([]);
      setModoLogin('codigo');
      setCodigoInput('');
      toast.info('Dispositivo desvinculado. Ingresa el código de 6 dígitos de la nueva empresa.');
    }
  };

  // Acciones de Notificaciones
  const handleMarcarLeida = async (id: number) => {
    try {
      await notificacionesApi.marcarLeida(id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leido: true } : n))
      );
    } catch {}
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      await notificacionesApi.marcarTodasLeidas();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch {}
  };

  // Forzar actualización y limpiar cachés del navegador / PWA
  const handleForzarRecarga = async () => {
    toast.info('Actualizando aplicación a la última versión...');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch {}
    window.location.reload();
  };

  // Guardar cambios en el Perfil
  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (perfilForm.nuevoPassword && perfilForm.nuevoPassword !== perfilForm.confirmarPassword) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }

    setGuardandoPerfil(true);
    try {
      await authApi.updatePerfil({
        nombreCompleto: perfilForm.nombreCompleto,
        telefono: perfilForm.telefono,
        telefonoPagoMovil: perfilForm.telefonoPagoMovil,
        cedula: perfilForm.cedula,
        passwordActual: perfilForm.passwordActual || undefined,
        nuevoPassword: perfilForm.nuevoPassword || undefined,
      });
      toast.success('¡Perfil actualizado exitosamente!');
      setPerfilForm((prev) => ({
        ...prev,
        passwordActual: '',
        nuevoPassword: '',
        confirmarPassword: '',
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar perfil');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  // Consultar Reporte
  const handleConsultarReporte = async () => {
    if (!isOnline) {
      toast.warning('Se requiere conexión a internet para consultar reportes.');
      return;
    }
    setCargandoReporte(true);
    setDatosReporte(null);
    try {
      let res: any = null;
      const choferNumId = dispositivo?.id;

      if (tipoReporte === 'DIARIOS') {
        res = await sistemaApi.getReporteDiarios(repFechaInicio, repFechaFin, choferNumId);
      } else if (tipoReporte === 'RECEPTORIAS') {
        res = await sistemaApi.getReporteReceptorias(repFechaInicio, repFechaFin);
      } else if (tipoReporte === 'FINCAS') {
        res = await sistemaApi.getReporteFincas(repFechaInicio, repFechaFin);
      } else if (tipoReporte === 'CHOFERES') {
        res = await sistemaApi.getReporteChoferes(repFechaInicio, repFechaFin, choferNumId);
      } else if (tipoReporte === 'RELACION_CHOFER') {
        const raw = await sistemaApi.getReporteRelacionChoferes(repFechaInicio, repFechaFin);
        res = (raw || []).filter((r: any) => Number(r.usuarioId || r.UsuarioId) === choferNumId);
      }
      setDatosReporte(res);
      toast.success('Reporte generado exitosamente');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al generar reporte');
    } finally {
      setCargandoReporte(false);
    }
  };

  // Cálculos de Cargas y Paradas del Viaje Activo
  const todasLasParadas = useMemo(() => {
    const lista: any[] = [];

    // 1. Paradas confirmadas en el servidor para el viaje activo
    (paradasViajeActivo || []).forEach((p, idx) => {
      lista.push({
        localId: `server_${p.id || idx}`,
        id: p.id,
        fincaNombre: p.fincaNombre || p.FincaNombre || p.finca || `Finca #${p.fincaId || p.FincaId}`,
        litros: Number(p.litros ?? p.Litros ?? 0),
        tipoLeche: (p.tipoLeche || p.TipoLeche || 'VACA').toUpperCase(),
        esAcida: Boolean(p.esAcida || p.EsAcida),
        esDiferido: Boolean(p.esDiferido || p.EsDiferido),
        hora: p.horaRecoleccion || p.hora || (p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmada'),
        synced: true,
        origen: 'Servidor',
      });
    });

    // 2. Cargas locales en el teléfono aún pendientes de sincronizar
    cargas.filter((c) => !c.synced).forEach((c) => {
      lista.push({
        localId: c.localId,
        fincaNombre: c.fincaNombre,
        litros: Number(c.litros) || 0,
        tipoLeche: c.tipoLeche,
        esAcida: c.esAcida,
        esDiferido: c.esDiferido,
        temperatura: c.temperatura,
        hora: c.hora,
        synced: false,
        origen: 'Teléfono',
      });
    });

    return lista;
  }, [paradasViajeActivo, cargas]);

  const totalLitrosCargados = useMemo(() => {
    const sumParadasServer = (paradasViajeActivo || []).reduce((acc, p) => acc + Number(p.litros ?? p.Litros ?? 0), 0);
    const sumPendientes = cargas.filter((c) => !c.synced).reduce((acc, c) => acc + (Number(c.litros) || 0), 0);
    const serverTotal = (viajeActivo?.totalLitrosFinca && viajeActivo.totalLitrosFinca > sumParadasServer) ? viajeActivo.totalLitrosFinca : sumParadasServer;
    return serverTotal + sumPendientes;
  }, [viajeActivo, paradasViajeActivo, cargas]);

  const capacidad = viajeActivo?.capacidadCamionLitros || dispositivo?.capacidadTanqueLitros || 6000;
  const porcentajeLlenado = Math.min(Math.round((totalLitrosCargados / capacidad) * 100), 100);

  // Mantener alias para compatibilidad
  const cargasHoy = todasLasParadas;
  const totalLitrosHoy = totalLitrosCargados;

  const pendientesSync = useMemo(() => {
    return cargas.filter((c) => !c.synced);
  }, [cargas]);

  const noLeidasCount = useMemo(() => {
    return notificaciones.filter((n) => !n.leido).length;
  }, [notificaciones]);

  const rutasActivasIds = useMemo(() => {
    if (!viajeActivo) return [];
    const obs = viajeActivo.observacion || '';
    const match = obs.match(/\[RUTAS:([^\]]+)\]/);
    if (match) {
      return match[1].split(',').map((id: string) => Number(id.trim())).filter((x: number) => x > 0);
    }
    return viajeActivo.rutaLogisticaId ? [Number(viajeActivo.rutaLogisticaId)] : [];
  }, [viajeActivo]);

  const fincasFiltradas = useMemo(() => {
    let result = fincas;
    if (busquedaFinca.trim()) {
      const term = busquedaFinca.toLowerCase();
      result = fincas.filter(
        (f) =>
          f.nombre.toLowerCase().includes(term) ||
          (f.codigo && f.codigo.toLowerCase().includes(term))
      );
    }

    if (rutasActivasIds.length > 0) {
      return [...result].sort((a, b) => {
        const aEnRuta = a.rutaId && rutasActivasIds.includes(a.rutaId) ? 1 : 0;
        const bEnRuta = b.rutaId && rutasActivasIds.includes(b.rutaId) ? 1 : 0;
        if (aEnRuta !== bEnRuta) return bEnRuta - aEnRuta;
        return a.nombre.localeCompare(b.nombre);
      });
    }

    return result;
  }, [fincas, busquedaFinca, rutasActivasIds]);

  // Guardar nueva carga en local
  const handleGuardarCarga = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCarga.fincaId) {
      toast.error('Selecciona una finca de la lista');
      return;
    }
    const litrosNum = Number(formCarga.litros);
    if (!litrosNum || litrosNum <= 0) {
      toast.error('Ingresa una cantidad válida de litros');
      return;
    }

    const fincaSel = fincas.find((f) => f.id === Number(formCarga.fincaId));
    const now = new Date();
    const horaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const fechaAUsar = viajeActivo?.fecha ? viajeActivo.fecha.split('T')[0] : (formCarga.fecha || hoyStr);

    const nuevaCarga: CargaOffline = {
      localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fecha: fechaAUsar,
      hora: horaStr,
      fincaId: Number(formCarga.fincaId),
      fincaNombre: fincaSel ? fincaSel.nombre : `Finca #${formCarga.fincaId}`,
      litros: litrosNum,
      tipoLeche: formCarga.tipoLeche,
      esAcida: formCarga.esAcida,
      esDiferido: formCarga.esDiferido,
      temperatura: formCarga.temperatura ? Number(formCarga.temperatura) : undefined,
      observacion: formCarga.observacion,
      synced: false,
    };

    const nuevasCargas = [nuevaCarga, ...cargas];
    setCargas(nuevasCargas);
    setModalRegistro(false);
    setFormCarga({
      fecha: viajeActivo?.fecha ? viajeActivo.fecha.split('T')[0] : hoyStr,
      fincaId: 0,
      litros: '',
      tipoLeche: 'VACA',
      esAcida: false,
      esDiferido: false,
      temperatura: '',
      observacion: '',
    });
    setBusquedaFinca('');

    toast.success(`Carga de ${litrosNum.toLocaleString()} L guardada en el teléfono`);

    if (isOnline) {
      setTimeout(() => sincronizarCargas(nuevasCargas), 500);
    }
  };

  // Sincronizar cargas con servidor
  const sincronizarCargas = async (cargasParaSync = cargas) => {
    if (!isOnline && !navigator.onLine) {
      toast.warning('No hay conexión a internet disponible para sincronizar.');
      return;
    }
    const pendientes = cargasParaSync.filter((c) => !c.synced);
    if (pendientes.length === 0) {
      toast.info('Todas las cargas ya están sincronizadas con la central.');
      return;
    }

    setSincronizando(true);
    let sincronizadasCount = 0;

    try {
      // 1. Priorizar el viaje activo ya cargado o asignado al chofer
      let idViaje: number | undefined = viajeActivo?.id;

      if (!idViaje) {
        // Consultar al servidor si existe un viaje activo abierto asignado a este chofer
        const vActivo = await operacionesApi.getViajeActivo(dispositivo?.id);
        if (vActivo && vActivo.id) {
          idViaje = vActivo.id;
          setViajeActivo(vActivo);
        }
      }

      // Si aún no se encontró, buscar en controles abiertos por chofer o unidad
      if (!idViaje) {
        const fechaCarga = pendientes[0]?.fecha || hoyStr;
        let viajes = await operacionesApi.getControles(fechaCarga);
        let viajeExistente = viajes.find(
          (v: any) =>
            (v.usuarioId === dispositivo?.id || v.conductorId === dispositivo?.id || v.choferId === dispositivo?.id || (dispositivo?.camionId && v.camionId === dispositivo.camionId)) &&
            v.estado !== 'Cerrado' && v.estado !== 'FINALIZADO' && v.estado !== 'Cancelado'
        );

        if (!viajeExistente) {
          const todosLosViajes = await operacionesApi.getControles();
          viajeExistente = todosLosViajes.find(
            (v: any) =>
              (v.usuarioId === dispositivo?.id || v.conductorId === dispositivo?.id || v.choferId === dispositivo?.id || (dispositivo?.camionId && v.camionId === dispositivo.camionId)) &&
              v.estado !== 'Cerrado' && v.estado !== 'FINALIZADO' && v.estado !== 'Cancelado'
          );
        }

        if (viajeExistente && viajeExistente.id) {
          idViaje = viajeExistente.id;
        }
      }

      // Solo si absolutamente ningún viaje abierto existe para el chofer, iniciar uno
      if (!idViaje) {
        const fechaCarga = pendientes[0]?.fecha || hoyStr;
        const viajeIniciado = await operacionesApi.iniciarViaje({
          fecha: fechaCarga,
          camionId: dispositivo?.camionId,
          choferId: dispositivo?.id,
          conductorId: dispositivo?.id,
          observacion: 'Viaje iniciado automáticamente desde App Móvil [ORIGEN_MOVIL]',
        });
        idViaje = viajeIniciado.id;
      }

      const actualizadas = [...cargasParaSync];
      for (const carga of pendientes) {
        try {
          // Sello obligatorio [ORIGEN_MOVIL] para trazabilidad en vivo
          const obsConOrigen = `${carga.observacion ? carga.observacion + ' ' : ''}[ORIGEN_MOVIL]`.trim();

          await operacionesApi.agregarFincaViaje(idViaje, {
            fincaId: carga.fincaId,
            litros: carga.litros,
            esAcida: carga.esAcida,
            esDiferido: carga.esDiferido,
            fecha: carga.fecha || hoyStr,
            tipoLeche: carga.tipoLeche,
            observacion: obsConOrigen,
            temperatura: carga.temperatura,
          });

          const idx = actualizadas.findIndex((c) => c.localId === carga.localId);
          if (idx !== -1) {
            actualizadas[idx] = {
              ...actualizadas[idx],
              synced: true,
              syncedAt: new Date().toLocaleTimeString(),
              serverTicketId: idViaje,
            };
            sincronizadasCount++;
          }
        } catch (itemErr: any) {
          console.error('Error al sincronizar item:', carga, itemErr);
        }
      }

      setCargas(actualizadas);
      if (sincronizadasCount > 0) {
        toast.success(`¡Sincronización completada! ${sincronizadasCount} carga(s) enviadas a la central.`);
        try {
          localStorage.setItem('transporte_evento_finca_movil', JSON.stringify({
            timestamp: Date.now(),
            viajeId: idViaje,
            totalCargas: sincronizadasCount,
          }));
        } catch { /* tolerante */ }
      }

      // Actualizar paradas consolidadas y viaje activo desde la central
      await cargarViajeActivo();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al conectar con la central para sincronizar.');
    } finally {
      setSincronizando(false);
    }
  };

  // =========================================================================
  // VISTA 1: DISPOSITIVO NO VINCULADO (ACTIVACIÓN NEUTRA)
  // =========================================================================
  if (!dispositivo) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #090d16 0%, #0f172a 50%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(16px)',
            borderRadius: '24px',
            padding: '32px 24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              fontSize: '32px',
              color: '#ffffff',
              boxShadow: '0 10px 25px rgba(2, 132, 199, 0.4)',
            }}
          >
            <i className="fa-solid fa-truck-droplet"></i>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            Rutas & Transporte Móvil
          </h1>
          <div style={{ marginBottom: '14px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '3px 12px',
                borderRadius: '16px',
                fontSize: '11.5px',
                fontWeight: 800,
                letterSpacing: '0.5px',
              }}
            >
              <i className="fa-solid fa-code-branch"></i> Versión {APP_VERSION}
            </span>
          </div>
          {/* Tarjeta de Base de Datos / Empresa Conectada (Fija, sin selector manual) */}
          {empresaGuardada ? (
            <div
              style={{
                marginBottom: '18px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '16px',
                padding: '12px 16px',
                textAlign: 'left',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(14, 165, 233, 0.2)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '17px',
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-building"></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                  Base de Datos Conectada
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {empresaGuardada}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.4' }}>
              Ingresa el código numérico de 6 dígitos para verificar de qué base de datos proviene y conectar este teléfono.
            </p>
          )}

          {/* Si tiene empresa guardada, muestra las opciones de acceso (Usuario/Clave o Código) */}
          {empresaGuardada && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                marginBottom: '20px',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '4px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => setModoLogin('credenciales')}
                style={{
                  padding: '9px 6px',
                  borderRadius: '10px',
                  border: 'none',
                  background: modoLogin === 'credenciales' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                  color: modoLogin === 'credenciales' ? '#ffffff' : '#94a3b8',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <i className="fa-solid fa-user-lock"></i>
                <span>Usuario y Clave</span>
              </button>

              <button
                type="button"
                onClick={() => setModoLogin('codigo')}
                style={{
                  padding: '9px 6px',
                  borderRadius: '10px',
                  border: 'none',
                  background: modoLogin === 'codigo' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                  color: modoLogin === 'codigo' ? '#ffffff' : '#94a3b8',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <i className="fa-solid fa-key"></i>
                <span>Código 6 Dígitos</span>
              </button>
            </div>
          )}

          {/* MODO 1: LOGIN CON USUARIO Y CONTRASEÑA */}
          {empresaGuardada && modoLogin === 'credenciales' ? (
            <form onSubmit={handleLoginUsuario} style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: '1.4', textAlign: 'center' }}>
                Ingresa con tu usuario y contraseña de {empresaGuardada}.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: '#38bdf8',
                    marginBottom: '6px',
                  }}
                >
                  Usuario
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="ej: chofer1"
                  autoCapitalize="none"
                  autoCorrect="off"
                  style={{
                    width: '100%',
                    height: '48px',
                    background: '#0f172a',
                    border: '1.5px solid #334155',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '15px',
                    padding: '0 14px',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: '#38bdf8',
                    marginBottom: '6px',
                  }}
                >
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      height: '48px',
                      background: '#0f172a',
                      border: '1.5px solid #334155',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '15px',
                      padding: '0 44px 0 14px',
                      outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '15px',
                      padding: '4px',
                    }}
                  >
                    <i className={`fa-solid ${mostrarPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={iniciandoLogin || !loginUsername.trim() || !loginPassword.trim()}
                style={{
                  width: '100%',
                  height: '50px',
                  borderRadius: '14px',
                  background:
                    loginUsername.trim() && loginPassword.trim()
                      ? 'linear-gradient(135deg, #0284c7, #2563eb)'
                      : 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: loginUsername.trim() && loginPassword.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: loginUsername.trim() && loginPassword.trim() ? '0 8px 20px rgba(37, 99, 235, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease',
                }}
              >
                {iniciandoLogin ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Iniciando Sesión...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket"></i>
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* MODO 2: VINCULACIÓN CON CÓDIGO DE 6 DÍGITOS */
            <form onSubmit={handleVincular}>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.4' }}>
                Ingresa el código numérico suministrado por tu administrador para vincular este teléfono.
              </p>

              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: '#38bdf8',
                    marginBottom: '10px',
                  }}
                >
                  Código de Vinculación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value)}
                  placeholder="000 000"
                  style={{
                    width: '100%',
                    height: '62px',
                    background: '#0f172a',
                    border: '2px solid #334155',
                    borderRadius: '16px',
                    color: '#38bdf8',
                    fontSize: '32px',
                    fontWeight: 900,
                    letterSpacing: '8px',
                    textAlign: 'center',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={vinculando || codigoInput.trim().length < 6}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '14px',
                  background:
                    codigoInput.trim().length >= 6
                      ? 'linear-gradient(135deg, #0284c7, #2563eb)'
                      : 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: codigoInput.trim().length >= 6 ? 'pointer' : 'not-allowed',
                  boxShadow: codigoInput.trim().length >= 6 ? '0 8px 20px rgba(37, 99, 235, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease',
                }}
              >
                {vinculando ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-mobile-screen-button"></i>
                    <span>Vincular y Entrar</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Botón inferior para desvincular la empresa y conectar a otra */}
          {empresaGuardada && (
            <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                type="button"
                onClick={handleDesvincular}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-link-slash"></i>
                <span>Desvincular Teléfono / Conectar a Otra Empresa</span>
              </button>
            </div>
          )}

          {!esInstalada && (
            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleInstalarApp}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <i className="fa-solid fa-download"></i>
                <span>Descargar / Instalar en mi Teléfono</span>
              </button>
            </div>
          )}

          <div style={{ marginTop: '22px', fontSize: '11px', color: '#64748b' }}>
            Terminal Móvil Chofer • {APP_VERSION} •{' '}
            <button
              type="button"
              onClick={handleForzarRecarga}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '11px',
                fontWeight: 700,
                padding: 0,
              }}
            >
              🔄 Recargar última versión
            </button>
          </div>

          {mostrarGuiaIos && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: '16px',
              }}
            >
              <div
                style={{
                  background: '#1e293b',
                  borderRadius: '20px',
                  padding: '24px',
                  width: '100%',
                  maxWidth: '380px',
                  textAlign: 'left',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    📲 Instalar en iPhone / iPad
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMostrarGuiaIos(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
                  >
                    &times;
                  </button>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '8px' }}>
                      Toca el botón <strong>Compartir</strong> <i className="fa-solid fa-arrow-up-from-bracket text-sky-400"></i> en la barra de Safari.
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      Baja y pulsa <strong>«Agregar a la pantalla de inicio»</strong> <i className="fa-solid fa-square-plus text-emerald-400"></i>.
                    </li>
                    <li>
                      Pulsa <strong>«Agregar»</strong> arriba a la derecha.
                    </li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarGuiaIos(false)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    marginTop: '16px',
                    cursor: 'pointer',
                  }}
                >
                  Entendido
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: TERMINAL MÓVIL VINCULADO CON 5 PESTAÑAS (ROL CHOFER)
  // =========================================================================
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        paddingBottom: '90px',
      }}
    >
      {/* Header Fijo Superior */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '14px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 15px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.25)',
                  color: isOnline ? '#34d399' : '#fbbf24',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  border: isOnline ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                <i className={`fa-solid ${isOnline ? 'fa-signal' : 'fa-plane'}`}></i>
                {isOnline ? 'En Línea' : 'Offline'}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {dispositivo.empresaNombre}
              </span>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 800,
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                }}
              >
                {APP_VERSION}
              </span>
            </div>
            <h2 style={{ fontSize: '15.5px', fontWeight: 800, margin: '3px 0 0 0', color: '#ffffff' }}>
              {dispositivo.nombreCompleto}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Botón de Notificaciones con Badge */}
            <button
              type="button"
              onClick={() => setModalNotificaciones(true)}
              title="Notificaciones de Rutas y Salidas"
              style={{
                position: 'relative',
                background: noLeidasCount > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                border: noLeidasCount > 0 ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: noLeidasCount > 0 ? '#fca5a5' : '#e2e8f0',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className={`fa-solid fa-bell ${noLeidasCount > 0 ? 'fa-shake' : ''}`}></i>
              {noLeidasCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '9.5px',
                    fontWeight: 900,
                    minWidth: '17px',
                    height: '17px',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: '1.5px solid #0f172a',
                    boxShadow: '0 2px 5px rgba(239,68,68,0.5)',
                  }}
                >
                  {noLeidasCount > 9 ? '9+' : noLeidasCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleForzarRecarga}
              title="Recargar última versión"
              style={{
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-arrows-rotate"></i>
            </button>
            {dispositivo.placaCamion && (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  padding: '5px 9px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <i className="fa-solid fa-truck mr-1 text-sky-400"></i>
                {dispositivo.placaCamion}
              </span>
            )}
            <button
              type="button"
              onClick={handleCerrarSesion}
              title="Cerrar Sesión (Mantener Empresa)"
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Barra de Instalación si no es PWA */}
      {!esInstalada && (
        <div
          style={{
            background: 'linear-gradient(90deg, #065f46, #047857)',
            padding: '8px 16px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            fontWeight: 700,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-mobile-screen text-emerald-300"></i>
            <span>Instala la app en tu pantalla para abrirla directo</span>
          </div>
          <button
            type="button"
            onClick={handleInstalarApp}
            style={{
              background: '#ffffff',
              color: '#065f46',
              border: 'none',
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Instalar
          </button>
        </div>
      )}

      {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* ===================================================================
            PESTAÑA 1: PRINCIPAL / INICIO (SOLO SUS VIAJES Y TANQUE)
           =================================================================== */}
        {tabActiva === 'principal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* TARJETA DE TICKET / VIAJE ACTIVO ASIGNADO */}
            {viajeActivo ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                  borderRadius: '18px',
                  padding: '16px 18px',
                  border: '1.5px solid #86efac',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#166534' }}>
                      <i className="fa-solid fa-ticket mr-1 text-emerald-600"></i> Ticket #{viajeActivo.codigoTicket || viajeActivo.id}
                    </span>
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      ● {viajeActivo.estado || 'EN RUTA'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={cargarViajeActivo}
                    disabled={cargandoViaje}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                    title="Actualizar datos del ticket"
                  >
                    <i className={`fa-solid fa-rotate ${cargandoViaje ? 'fa-spin' : ''}`}></i>
                  </button>
                </div>

                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <i className="fa-solid fa-truck text-slate-500"></i>
                    <strong>{viajeActivo.camionPlaca || dispositivo?.placaCamion || 'Cisterna en Turno'}</strong>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span>Capacidad: {(viajeActivo.capacidadCamionLitros || capacidad).toLocaleString()} L</span>
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    <i className="fa-solid fa-route text-slate-400 mr-1"></i>
                    <span>{viajeActivo.rutaLogisticaNombre ? `Ruta: ${viajeActivo.rutaLogisticaNombre}` : 'Modo Libre (Paradas Flexibles)'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cargado en Cisterna</span>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#15803d' }}>
                      {totalLitrosCargados.toLocaleString()} L
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Paradas</span>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                      {todasLasParadas.length}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '18px',
                  padding: '16px',
                  border: '1.5px dashed #cbd5e1',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                  <i className="fa-solid fa-route mr-2 text-slate-400"></i>
                  No tienes un ticket de ruta abierto actualmente
                </div>
                <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '4px 0 10px 0' }}>
                  Al registrar tu primera carga en finca o cuando tu supervisor te asigne una ruta, aparecerá aquí.
                </p>
                <button
                  type="button"
                  onClick={cargarViajeActivo}
                  className="btn btn-sm btn-outline"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  <i className="fa-solid fa-rotate mr-1"></i> Verificar Asignación
                </button>
              </div>
            )}

            {/* Widget Tanque */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '18px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                  <i className="fa-solid fa-gas-pump mr-2 text-blue-600"></i>
                  Capacidad de Cisterna
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#2563eb' }}>
                  {porcentajeLlenado}% Lleno
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  height: '14px',
                  background: '#e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    width: `${porcentajeLlenado}%`,
                    height: '100%',
                    background:
                      porcentajeLlenado > 90
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : 'linear-gradient(90deg, #0284c7, #2563eb)',
                    borderRadius: '10px',
                    transition: 'width 0.5s ease',
                  }}
                ></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                <span>Recolectado a Bordo: <strong style={{ color: '#0f172a' }}>{totalLitrosCargados.toLocaleString()} L</strong></span>
                <span>Capacidad: <strong>{capacidad.toLocaleString()} L</strong></span>
              </div>
            </div>

            {/* Resumen de Mis Viajes de Hoy */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                  Paradas Registradas
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                  {todasLasParadas.length}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  {totalLitrosCargados.toLocaleString()} L recolectados
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#9333ea', textTransform: 'uppercase' }}>
                  Mis Entregas Asignadas
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                  {entregas.length}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Hacia Receptoría / Planta
                </div>
              </div>
            </div>

            {/* Botón Acción Rápida: Ir a Recolección */}
            <button
              type="button"
              onClick={() => setTabActiva('recoleccion')}
              style={{
                width: '100%',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                fontSize: '15px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-faucet-drip text-lg"></i>
              <span>Ir a Recolección de Leche</span>
            </button>
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 2: RECOLECCIÓN (SOLO SUS VIAJES Y CARGAS EN FINCAS)
           =================================================================== */}
        {tabActiva === 'recoleccion' && (
          <div>
            {/* Banner de Viaje / Ticket Activo */}
            {viajeActivo && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 900, color: '#166534' }}>
                      <i className="fa-solid fa-ticket mr-1"></i> Ticket #{viajeActivo.codigoTicket || viajeActivo.id}
                    </span>
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      ACTIVO
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#166534', marginTop: '2px' }}>
                    <span>🚛 {viajeActivo.camionPlaca || dispositivo?.placaCamion || 'Cisterna'}</span>
                    <span style={{ margin: '0 4px', color: '#86efac' }}>•</span>
                    <span>{viajeActivo.rutaLogisticaNombre ? `Ruta: ${viajeActivo.rutaLogisticaNombre}` : 'Modo Libre'}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#15803d' }}>
                    {totalLitrosCargados.toLocaleString()} L
                  </div>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>
                    {todasLasParadas.length} parada(s)
                  </div>
                </div>
              </div>
            )}

            {/* Banner Sync si hay cargas pendientes */}
            {pendientesSync.length > 0 && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#92400e' }}>
                    <i className="fa-solid fa-clock-rotate-left mr-1"></i>
                    {pendientesSync.length} carga(s) en teléfono
                  </div>
                  <div style={{ fontSize: '11px', color: '#b45309' }}>
                    {isOnline ? 'Listo para enviar a la central' : 'Se enviarán al tener señal'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => sincronizarCargas()}
                  disabled={sincronizando || !isOnline}
                  style={{
                    background: isOnline ? '#d97706' : '#cbd5e1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: isOnline ? 'pointer' : 'not-allowed',
                  }}
                >
                  {sincronizando ? 'Enviando...' : 'Sincronizar'}
                </button>
              </div>
            )}

            {/* BOTÓN REGISTRAR CARGA EN FINCA */}
            <button
              type="button"
              onClick={() => {
                if (viajeActivo?.fecha) {
                  setFormCarga((prev) => ({ ...prev, fecha: viajeActivo.fecha.split('T')[0] }));
                }
                setModalRegistro(true);
              }}
              style={{
                width: '100%',
                height: '60px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                fontSize: '16px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 8px 22px rgba(16, 185, 129, 0.35)',
                cursor: 'pointer',
                marginBottom: '18px',
              }}
            >
              <i className="fa-solid fa-plus text-xl"></i>
              <span>Registrar Carga en Finca</span>
            </button>

            {/* Historial de Cargas de Hoy */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                Paradas de este Viaje ({todasLasParadas.length})
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Total: <strong>{totalLitrosCargados.toLocaleString()} L</strong>
              </span>
            </div>

            {todasLasParadas.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '32px 16px',
                  textAlign: 'center',
                  border: '1.5px dashed #cbd5e1',
                  color: '#94a3b8',
                }}
              >
                <i className="fa-solid fa-clipboard-list text-3xl mb-2 text-slate-300"></i>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#64748b' }}>
                  No hay cargas registradas en este ticket
                </div>
                <p style={{ fontSize: '11.5px', margin: '4px 0 0 0' }}>
                  Pulsa el botón verde para registrar una recolección en finca.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todasLasParadas.map((c) => (
                  <div
                    key={c.localId}
                    style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                          {c.fincaNombre}
                        </span>
                        {c.tipoLeche === 'BUFALA' && (
                          <span style={{ background: '#fed7aa', color: '#9a3412', fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px' }}>
                            BÚFALA
                          </span>
                        )}
                        {c.esDiferido && (
                          <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px' }}>
                            DIFERIDO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        <i className="fa-regular fa-clock mr-1 text-slate-400"></i>
                        {c.hora}
                        {c.temperatura ? ` • ${c.temperatura}°C` : ''}
                        {c.esAcida && ' • ⚠️ Ácida'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#2563eb' }}>
                        {c.litros.toLocaleString()} L
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        {c.synced ? (
                          <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 700 }}>
                            <i className="fa-solid fa-circle-check mr-1"></i>Enviado
                          </span>
                        ) : (
                          <span style={{ fontSize: '10.5px', color: '#d97706', fontWeight: 700 }}>
                            <i className="fa-solid fa-mobile mr-1"></i>En Teléfono
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 3: ENTREGAS (RECEPTORÍAS / SALIDAS ASIGNADAS AL CHOFER)
           =================================================================== */}
        {tabActiva === 'entregas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                  Mis Entregas y Despachos
                </h3>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Viajes asignados a receptoría o planta
                </p>
              </div>
              <button
                type="button"
                onClick={cargarEntregasChofer}
                disabled={cargandoEntregas || !isOnline}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <i className={`fa-solid fa-rotate mr-1 ${cargandoEntregas ? 'fa-spin' : ''}`}></i>
                Actualizar
              </button>
            </div>

            {cargandoEntregas ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-purple-600"></i>
                <div style={{ fontSize: '12.5px', fontWeight: 700 }}>Cargando tus despachos...</div>
              </div>
            ) : entregas.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '36px 16px',
                  textAlign: 'center',
                  border: '1.5px dashed #cbd5e1',
                  color: '#94a3b8',
                }}
              >
                <i className="fa-solid fa-warehouse text-3xl mb-2 text-purple-300"></i>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#64748b' }}>
                  No tienes entregas a receptoría asignadas
                </div>
                <p style={{ fontSize: '11.5px', margin: '4px 0 0 0' }}>
                  Cuando el administrador asigne un despacho a tu camión, aparecerá aquí.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {entregas.map((d: any) => {
                  const desp = Number(d.litrosDespachados || 0);
                  const rec = Number(d.litrosRecibidosCompania || d.litrosConfirmados || 0);
                  const merma = rec > 0 ? rec - desp : 0;
                  const est = (d.estado || 'En Ruta').toUpperCase();

                  return (
                    <div
                      key={d.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#7e22ce' }}>
                          Ticket #{d.id} • Receptoría
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: est === 'FINALIZADO' || est === 'ENTREGADO' ? '#dcfce7' : '#fef3c7',
                            color: est === 'FINALIZADO' || est === 'ENTREGADO' ? '#15803d' : '#b45309',
                          }}
                        >
                          {d.estado || 'EN RUTA'}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                        <i className="fa-solid fa-building-wheat mr-1.5 text-purple-600"></i>
                        Destino: {d.nombreCompania || d.companiaNombre || 'Receptoría Principal'}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>Despachados:</span>
                          <strong style={{ fontSize: '14px', color: '#0369a1' }}>{desp.toLocaleString()} L</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>En Planta:</span>
                          <strong style={{ fontSize: '14px', color: '#15803d' }}>
                            {rec > 0 ? `${rec.toLocaleString()} L` : 'Pendiente'}
                          </strong>
                        </div>
                      </div>

                      {merma !== 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11.5px', color: merma < 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>
                          Merma: {merma > 0 ? `+${merma.toLocaleString()} L` : `${merma.toLocaleString()} L`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 4: REPORTES (SOLO NÚMEROS 1, 2, 3, 4 Y 7)
           =================================================================== */}
        {tabActiva === 'reportes' && (
          <div>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
                <i className="fa-solid fa-file-invoice text-blue-600 mr-2"></i>
                Consulta de Reportes Chofer
              </h3>

              {/* Rango de Fechas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Desde:
                  </label>
                  <input
                    type="date"
                    value={repFechaInicio}
                    onChange={(e) => setRepFechaInicio(e.target.value)}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Hasta:
                  </label>
                  <input
                    type="date"
                    value={repFechaFin}
                    onChange={(e) => setRepFechaFin(e.target.value)}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* Selector de Reportes Autorizados (1, 2, 3, 4 y 7) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Seleccione Reporte:
                </label>
                <select
                  value={tipoReporte}
                  onChange={(e) => setTipoReporte(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '8px',
                    border: '1.5px solid #2563eb',
                    background: '#eff6ff',
                    padding: '0 10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#1d4ed8',
                  }}
                >
                  {REPORTES_CHOFER.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleConsultarReporte}
                disabled={cargandoReporte || !isOnline}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1e40af, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: isOnline ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {cargandoReporte ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Generando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-magnifying-glass"></i> Consultar Reporte
                  </>
                )}
              </button>
            </div>

            {/* Vista de Datos del Reporte */}
            {datosReporte && (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  Resultados del Reporte ({Array.isArray(datosReporte) ? datosReporte.length : 1} registros)
                </div>

                {Array.isArray(datosReporte) && datosReporte.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>
                    No se encontraron registros para este rango de fechas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Array.isArray(datosReporte) ? (
                      datosReporte.slice(0, 30).map((row: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: '#f8fafc',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1e293b' }}>
                            <span>{row.nombre || row.fincaNombre || row.choferNombre || row.companiaNombre || `Registro #${idx + 1}`}</span>
                            <span style={{ color: '#2563eb' }}>
                              {(row.totalLitros || row.litros || row.litrosDespachados || 0).toLocaleString()} L
                            </span>
                          </div>
                          {row.fecha && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Fecha: {String(row.fecha).split('T')[0]}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: '#334155' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>Resumen General:</div>
                        <div>Total Litros Recolectados: <strong>{(datosReporte.totalLitros || 0).toLocaleString()} L</strong></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            PESTAÑA 5: MI PERFIL (DATOS Y CAMBIO DE CLAVE)
           =================================================================== */}
        {tabActiva === 'perfil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Tarjeta de Identidad */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: '18px',
                padding: '20px',
                color: '#ffffff',
                boxShadow: '0 6px 20px rgba(15, 23, 42, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: 900,
                  }}
                >
                  {dispositivo.nombreCompleto.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    {dispositivo.nombreCompleto}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
                    @{dispositivo.username} • <span style={{ textTransform: 'uppercase' }}>{dispositivo.rol}</span>
                  </div>
                  {dispositivo.placaCamion && (
                    <div style={{ fontSize: '12px', color: '#34d399', marginTop: '2px', fontWeight: 700 }}>
                      <i className="fa-solid fa-truck mr-1"></i> Cisterna: {dispositivo.placaCamion} ({capacidad.toLocaleString()} L)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Formulario de Actualización */}
            <form
              onSubmit={handleGuardarPerfil}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '18px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
                <i className="fa-solid fa-user-pen mr-2 text-blue-600"></i>
                Datos Personales & Contacto
              </h4>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={perfilForm.nombreCompleto}
                  onChange={(e) => setPerfilForm({ ...perfilForm, nombreCompleto: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Teléfono Móvil
                  </label>
                  <input
                    type="text"
                    value={perfilForm.telefono}
                    onChange={(e) => setPerfilForm({ ...perfilForm, telefono: e.target.value })}
                    placeholder="0412-1234567"
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Cédula / Documento
                  </label>
                  <input
                    type="text"
                    value={perfilForm.cedula}
                    onChange={(e) => setPerfilForm({ ...perfilForm, cedula: e.target.value })}
                    placeholder="V-12345678"
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '14px' }}>
                <h5 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                  <i className="fa-solid fa-lock mr-1.5 text-amber-500"></i>
                  Cambiar Contraseña (Opcional)
                </h5>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
                    Contraseña Actual
                  </label>
                  <input
                    type="password"
                    value={perfilForm.passwordActual}
                    onChange={(e) => setPerfilForm({ ...perfilForm, passwordActual: e.target.value })}
                    placeholder="••••••••"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
                      Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={perfilForm.nuevoPassword}
                      onChange={(e) => setPerfilForm({ ...perfilForm, nuevoPassword: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
                      Confirmar
                    </label>
                    <input
                      type="password"
                      value={perfilForm.confirmarPassword}
                      onChange={(e) => setPerfilForm({ ...perfilForm, confirmarPassword: e.target.value })}
                      placeholder="Repetir clave"
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={guardandoPerfil || !isOnline}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: isOnline ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {guardandoPerfil ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>

            {/* Información de Versión del Sistema Móvil */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Versión del Sistema
                </div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#0284c7' }}>
                  {APP_VERSION} (Producción)
                </div>
              </div>
              <button
                type="button"
                onClick={handleForzarRecarga}
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0284c7',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-arrows-rotate"></i>
                Actualizar
              </button>
            </div>

            {/* Acciones de Sesión y Dispositivo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={handleCerrarSesion}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                Cerrar Sesión (Mantener Empresa)
              </button>

              <button
                type="button"
                onClick={handleDesvincular}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-trash-can"></i>
                Desvincular y Olvidar Empresa
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR MÓVIL (BOTTOM NAVIGATION BAR) */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '66px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
          zIndex: 1000,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <button
          type="button"
          onClick={() => setTabActiva('principal')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: tabActiva === 'principal' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          <i className="fa-solid fa-house" style={{ fontSize: '18px' }}></i>
          <span style={{ fontSize: '10px', fontWeight: tabActiva === 'principal' ? 800 : 600 }}>
            Inicio
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('recoleccion')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: tabActiva === 'recoleccion' ? '#10b981' : '#64748b',
            cursor: 'pointer',
            padding: '6px 0',
            position: 'relative',
          }}
        >
          <i className="fa-solid fa-faucet-drip" style={{ fontSize: '18px' }}></i>
          <span style={{ fontSize: '10px', fontWeight: tabActiva === 'recoleccion' ? 800 : 600 }}>
            Recolección
          </span>
          {pendientesSync.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '16px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f59e0b',
              }}
            ></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('entregas')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: tabActiva === 'entregas' ? '#9333ea' : '#64748b',
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          <i className="fa-solid fa-warehouse" style={{ fontSize: '18px' }}></i>
          <span style={{ fontSize: '10px', fontWeight: tabActiva === 'entregas' ? 800 : 600 }}>
            Entregas
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('reportes')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: tabActiva === 'reportes' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          <i className="fa-solid fa-chart-pie" style={{ fontSize: '18px' }}></i>
          <span style={{ fontSize: '10px', fontWeight: tabActiva === 'reportes' ? 800 : 600 }}>
            Reportes
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('perfil')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: tabActiva === 'perfil' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          <i className="fa-solid fa-user-gear" style={{ fontSize: '18px' }}></i>
          <span style={{ fontSize: '10px', fontWeight: tabActiva === 'perfil' ? 800 : 600 }}>
            Perfil
          </span>
        </button>
      </nav>

      {/* MODAL REGISTRAR CARGA EN FINCA */}
      {modalRegistro && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
              padding: '24px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                  }}
                >
                  <i className="fa-solid fa-faucet-drip"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Nueva Carga en Finca
                  </h3>
                  <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    Registro rápido offline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalRegistro(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  fontSize: '20px',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGuardarCarga}>
              {/* Finca con buscador integrado */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                  Finca Productora <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="🔍 Buscar finca por nombre..."
                  value={busquedaFinca}
                  onChange={(e) => setBusquedaFinca(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    padding: '0 12px',
                    fontSize: '13px',
                    marginBottom: '8px',
                    outline: 'none',
                  }}
                />
                <select
                  value={formCarga.fincaId}
                  onChange={(e) => setFormCarga({ ...formCarga, fincaId: Number(e.target.value) })}
                  required
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '10px',
                    border: '1.5px solid #0284c7',
                    background: '#f0f9ff',
                    padding: '0 12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0369a1',
                    outline: 'none',
                  }}
                >
                  <option value={0}>-- Selecciona la Finca ({fincasFiltradas.length}) --</option>
                  {fincasFiltradas.map((f) => {
                    const enRuta = f.rutaId && rutasActivasIds.includes(f.rutaId);
                    return (
                      <option key={f.id} value={f.id}>
                        {enRuta ? '⭐ [En Ruta] ' : ''}{f.nombre} {f.codigo ? `(${f.codigo})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Fecha de Recolección: si hay un ticket activo asignado, se toma automáticamente su fecha y no se muestra el selector manual */}
              {viajeActivo ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-ticket text-emerald-600"></i>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                      Ticket #{viajeActivo.codigoTicket || viajeActivo.id}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    📅 {new Date(viajeActivo.fecha).toLocaleDateString('es-VE')}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                    📅 Fecha de Recolección
                  </label>
                  <input
                    type="date"
                    value={formCarga.fecha || hoyStr}
                    onChange={(e) => setFormCarga({ ...formCarga, fecha: e.target.value })}
                    style={{
                      width: '100%',
                      height: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#f8fafc',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Litros Entrada Táctil */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                  Litros Recolectados <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={formCarga.litros}
                    onChange={(e) => setFormCarga({ ...formCarga, litros: e.target.value })}
                    placeholder="0"
                    required
                    style={{
                      width: '100%',
                      height: '56px',
                      borderRadius: '12px',
                      border: '2px solid #3b82f6',
                      padding: '0 60px 0 16px',
                      fontSize: '24px',
                      fontWeight: 900,
                      color: '#1e3a8a',
                      background: '#f8fafc',
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#64748b',
                    }}
                  >
                    Litros
                  </span>
                </div>
              </div>

              {/* Tipo de Leche */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                  Tipo de Leche
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormCarga({ ...formCarga, tipoLeche: 'VACA' })}
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      border: formCarga.tipoLeche === 'VACA' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: formCarga.tipoLeche === 'VACA' ? '#eff6ff' : '#ffffff',
                      color: formCarga.tipoLeche === 'VACA' ? '#1d4ed8' : '#64748b',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    🥛 Vaca (Estándar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCarga({ ...formCarga, tipoLeche: 'BUFALA' })}
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      border: formCarga.tipoLeche === 'BUFALA' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                      background: formCarga.tipoLeche === 'BUFALA' ? '#fff7ed' : '#ffffff',
                      color: formCarga.tipoLeche === 'BUFALA' ? '#c2410c' : '#64748b',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    🐃 Búfala
                  </button>
                </div>
              </div>

              {/* Calidad y Temperatura */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                    Temperatura (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ej. 4.5"
                    value={formCarga.temperatura}
                    onChange={(e) => setFormCarga({ ...formCarga, temperatura: e.target.value })}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                    Calidad / Estado
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '40px',
                      padding: '0 8px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formCarga.esAcida}
                      onChange={(e) => setFormCarga({ ...formCarga, esAcida: e.target.checked })}
                    />
                    <span style={{ color: formCarga.esAcida ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                      ⚠️ Leche Ácida
                    </span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalRegistro(false)}
                  style={{
                    flex: 1,
                    height: '48px',
                    borderRadius: '12px',
                    background: '#f1f5f9',
                    border: 'none',
                    color: '#64748b',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '15px',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                    cursor: 'pointer',
                  }}
                >
                  Guardar Carga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NOTIFICACIONES Y ASIGNACIONES (PUSH) */}
      {modalNotificaciones && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
              padding: '22px 20px',
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '17px',
                  }}
                >
                  <i className="fa-solid fa-bell"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Centro de Notificaciones
                  </h3>
                  <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    {noLeidasCount > 0 ? `${noLeidasCount} mensaje(s) sin leer` : 'Al día, no hay alertas nuevas'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {noLeidasCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarTodasLeidas}
                    title="Marcar todas como leídas"
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Marcar leídas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalNotificaciones(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '34px',
                    height: '34px',
                    fontSize: '20px',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Listado de Notificaciones */}
            {notificaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <i className="fa-solid fa-bell-slash" style={{ fontSize: '36px', marginBottom: '12px', color: '#cbd5e1' }}></i>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>No tienes notificaciones recibidas</p>
                <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Las rutas planificadas y salidas asignadas aparecerán aquí.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notificaciones.map((notif) => {
                  const esRuta = notif.tipo === 'RUTA_ASIGNADA';
                  const esSalida = notif.tipo === 'SALIDA_COMPANIA';

                  const badgeBg = esRuta ? '#dcfce7' : esSalida ? '#f3e8ff' : '#e0f2fe';
                  const badgeColor = esRuta ? '#15803d' : esSalida ? '#7e22ce' : '#0369a1';
                  const badgeIcon = esRuta ? 'fa-route' : esSalida ? 'fa-industry' : 'fa-bell';
                  const badgeLabel = esRuta ? 'RUTA ASIGNADA' : esSalida ? 'SALIDA A COMPAÑÍA' : 'AVISO';

                  return (
                    <div
                      key={notif.id}
                      style={{
                        background: notif.leido ? '#ffffff' : '#f8fafc',
                        border: notif.leido ? '1px solid #e2e8f0' : '1.5px solid #38bdf8',
                        borderRadius: '14px',
                        padding: '14px',
                        boxShadow: notif.leido ? 'none' : '0 4px 12px rgba(56, 189, 248, 0.15)',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                        <span
                          style={{
                            background: badgeBg,
                            color: badgeColor,
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            letterSpacing: '0.4px',
                          }}
                        >
                          <i className={`fa-solid ${badgeIcon}`}></i>
                          {badgeLabel}
                        </span>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                          {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                        {notif.titulo}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                        {notif.mensaje}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                        {esRuta && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!notif.leido) handleMarcarLeida(notif.id);
                              setModalNotificaciones(false);
                              setTabActiva('recoleccion');
                            }}
                            style={{
                              background: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '5px 12px',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>Ir a Recolección</span>
                            <i className="fa-solid fa-arrow-right"></i>
                          </button>
                        )}
                        {esSalida && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!notif.leido) handleMarcarLeida(notif.id);
                              setModalNotificaciones(false);
                              setTabActiva('entregas');
                            }}
                            style={{
                              background: '#9333ea',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '5px 12px',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>Ver en Entregas</span>
                            <i className="fa-solid fa-arrow-right"></i>
                          </button>
                        )}
                        {!esRuta && !esSalida && <div />}

                        {!notif.leido && (
                          <button
                            type="button"
                            onClick={() => handleMarcarLeida(notif.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#0284c7',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppMovilPage;