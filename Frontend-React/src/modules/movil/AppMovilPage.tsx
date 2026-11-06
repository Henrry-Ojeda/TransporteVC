import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth.api';
import { catalogosApi } from '@/api/catalogos.api';
import { operacionesApi } from '@/api/operaciones.api';
import type { FincaDto } from '@/types';

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

export const AppMovilPage: React.FC = () => {
  // Estado de Red (Online / Offline)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  // Estado para la pantalla de Vinculación
  const [codigoInput, setCodigoInput] = useState('');
  const [vinculando, setVinculando] = useState(false);

  // Estado para el modal de Registro de Carga
  const [modalRegistro, setModalRegistro] = useState(false);
  const [formCarga, setFormCarga] = useState({
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

  // Detectar cambios de conectividad
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🟢 Conexión a Internet restablecida');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('🟠 Modo Sin Conexión (Offline) activado. Puedes seguir registrando cargas normalmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Guardar cargas en LocalStorage cada vez que cambian
  useEffect(() => {
    localStorage.setItem('movil_cargas_local', JSON.stringify(cargas));
  }, [cargas]);

  // Si estamos en línea y hay conexión, refrescar lista de fincas para caché
  useEffect(() => {
    if (dispositivo && isOnline) {
      cargarFincasServidor();
    }
  }, [dispositivo, isOnline]);

  const cargarFincasServidor = async () => {
    try {
      const list = await catalogosApi.getFincas();
      if (Array.isArray(list) && list.length > 0) {
        setFincas(list);
        localStorage.setItem('movil_fincas_cache', JSON.stringify(list));
      }
    } catch (err) {
      console.warn('No se pudo refrescar lista de fincas del servidor, usando caché local.');
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

      // Guardar token en localStorage para que apiClient lo use
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

      const dispData: DispositivoMovilData = {
        token: res.token,
        empresaCodigo: res.empresaCodigo,
        empresaNombre: res.empresaNombre,
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

      toast.success(`¡Dispositivo Vinculado con Éxito! Bienvenido ${res.nombreCompleto}`);

      // Descargar catálogo de fincas para modo offline
      try {
        const fincasData = await catalogosApi.getFincas();
        if (Array.isArray(fincasData)) {
          setFincas(fincasData);
          localStorage.setItem('movil_fincas_cache', JSON.stringify(fincasData));
        }
      } catch {
        // En caso de que falle la descarga inicial
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Código inválido o expirado. Consulta con tu administrador.');
    } finally {
      setVinculando(false);
    }
  };

  // Acción: Desvincular dispositivo
  const handleDesvincular = () => {
    if (window.confirm('¿Seguro que deseas desvincular este dispositivo? Deberás solicitar un nuevo código a tu administrador para volver a ingresar.')) {
      localStorage.removeItem('movil_device_info');
      localStorage.removeItem('token');
      setDispositivo(null);
      toast.info('Dispositivo desvinculado correctamente');
    }
  };

  // Calcular litros recolectados hoy
  const hoyStr = new Date().toISOString().split('T')[0];
  const cargasHoy = useMemo(() => {
    return cargas.filter((c) => c.fecha === hoyStr);
  }, [cargas, hoyStr]);

  const totalLitrosHoy = useMemo(() => {
    return cargasHoy.reduce((acc, curr) => acc + (Number(curr.litros) || 0), 0);
  }, [cargasHoy]);

  const capacidad = dispositivo?.capacidadTanqueLitros || 6000;
  const porcentajeLlenado = Math.min(Math.round((totalLitrosHoy / capacidad) * 100), 100);

  const pendientesSync = useMemo(() => {
    return cargas.filter((c) => !c.synced);
  }, [cargas]);

  // Fincas filtradas en el modal
  const fincasFiltradas = useMemo(() => {
    if (!busquedaFinca.trim()) return fincas;
    const term = busquedaFinca.toLowerCase();
    return fincas.filter(
      (f) =>
        f.nombre.toLowerCase().includes(term) ||
        (f.codigo && f.codigo.toLowerCase().includes(term))
    );
  }, [fincas, busquedaFinca]);

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

    const nuevaCarga: CargaOffline = {
      localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fecha: hoyStr,
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

    // Intentar sincronizar inmediatamente si hay internet
    if (isOnline) {
      setTimeout(() => sincronizarCargas(nuevasCargas), 500);
    }
  };

  // Sincronizar cargas pendientes con el servidor
  const sincronizarCargas = async (cargasParaSync = cargas) => {
    if (!isOnline) {
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
      // 1. Obtener viajes de hoy para ver si hay un viaje activo para este chofer/camión
      const viajes = await operacionesApi.getControles(hoyStr);
      const viajeExistente = viajes.find(
        (v: any) =>
          (v.camionId === dispositivo?.camionId || v.choferId === dispositivo?.id) &&
          v.estado !== 'Cerrado' && v.estado !== 'Cancelado'
      );

      let idViaje: number;
      if (viajeExistente && viajeExistente.id) {
        idViaje = viajeExistente.id;
      } else {
        const viajeIniciado = await operacionesApi.iniciarViaje({
          fecha: hoyStr,
          camionId: dispositivo?.camionId,
          choferId: dispositivo?.id,
          conductorId: dispositivo?.id,
          observacion: 'Viaje iniciado automáticamente desde App Móvil',
        });
        idViaje = viajeIniciado.id;
      }

      // 2. Enviar cada carga pendiente
      const actualizadas = [...cargasParaSync];
      for (const carga of pendientes) {
        try {
          await operacionesApi.agregarFincaViaje(idViaje, {
            fincaId: carga.fincaId,
            litros: carga.litros,
            esAcida: carga.esAcida,
            esDiferido: carga.esDiferido,
            fecha: carga.fecha,
            tipoLeche: carga.tipoLeche,
            observacion: carga.observacion ? `${carga.observacion} (App Móvil)` : 'Registrado desde App Móvil',
            temperatura: carga.temperatura,
          });

          // Marcar como sincronizada
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
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al conectar con la central para sincronizar.');
    } finally {
      setSincronizando(false);
    }
  };

  // =========================================================================
  // VISTA 1: DISPOSITIVO NO VINCULADO (PANTALLA DE ACTIVACIÓN NEUTRA)
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
          {/* Icono Principal */}
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

          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Rutas & Transporte Móvil
          </h1>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '0 0 26px 0', lineHeight: '1.4' }}>
            Ingresa el código numérico de 6 dígitos suministrado por tu administrador para vincular este teléfono.
          </p>

          <form onSubmit={handleVincular}>
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

          {/* Botón de Descarga / Instalación en Teléfono */}
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
                  transition: 'all 0.2s',
                }}
              >
                <i className="fa-solid fa-download"></i>
                <span>Descargar / Instalar en mi Teléfono</span>
              </button>
            </div>
          )}

          {/* Guía Modal para iOS */}
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
                  <p style={{ margin: '0 0 10px 0' }}>
                    Para tener la aplicación con su icono en tu pantalla de inicio:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '8px' }}>
                      Toca el botón <strong>Compartir</strong> <i className="fa-solid fa-arrow-up-from-bracket text-sky-400"></i> en la barra inferior de Safari.
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      Baja y selecciona <strong>«Agregar a la pantalla de inicio»</strong> <i className="fa-solid fa-square-plus text-emerald-400"></i>.
                    </li>
                    <li>
                      Pulsa <strong>«Agregar»</strong> en la esquina superior derecha.
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

          {/* Información del Modo Offline */}
          <div
            style={{
              marginTop: '28px',
              padding: '14px',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '12px',
              color: '#64748b',
              textAlign: 'left',
              lineHeight: '1.4',
            }}
          >
            <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-cloud-slash text-sky-400"></i> Diseñado para trabajar sin señal
            </div>
            Al vincular tu teléfono, la app memoriza tu cisterna y las fincas para que puedas registrar leche en el campo 100% offline.
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: TERMINAL MÓVIL VINCULADO (CONDUCTOR / RECOLECCIÓN OFFLINE)
  // =========================================================================
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        paddingBottom: '90px',
      }}
    >
      {/* Barra Superior Móvil */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '16px 18px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 15px rgba(15, 23, 42, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.25)',
                  color: isOnline ? '#34d399' : '#fbbf24',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: isOnline ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                <i className={`fa-solid ${isOnline ? 'fa-signal' : 'fa-plane'}`}></i>
                {isOnline ? 'En Línea' : 'Offline'}
              </span>
              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                {dispositivo.empresaNombre}
              </span>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '4px 0 0 0', color: '#ffffff' }}>
              {dispositivo.nombreCompleto}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {dispositivo.placaCamion && (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  fontSize: '12px',
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
              onClick={handleDesvincular}
              title="Desvincular Dispositivo"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
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

      {/* Barra de Instalación si aún no está instalada como PWA */}
      {!esInstalada && (
        <div
          style={{
            background: 'linear-gradient(90deg, #065f46, #047857)',
            padding: '9px 16px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            }}
          >
            📥 Instalar
          </button>
        </div>
      )}

      {/* Contenedor Principal */}
      <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Widget del Tanque del Camión */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
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

          {/* Barra de Progreso Visual */}
          <div
            style={{
              width: '100%',
              height: '14px',
              background: '#e2e8f0',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '12px',
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

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
            <span>
              Recolectado Hoy: <strong style={{ color: '#0f172a' }}>{totalLitrosHoy.toLocaleString()} L</strong>
            </span>
            <span>
              Capacidad Máxima: <strong>{capacidad.toLocaleString()} L</strong>
            </span>
          </div>
        </div>

        {/* Banner de Sincronización Pendiente */}
        {pendientesSync.length > 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400e' }}>
                <i className="fa-solid fa-clock-rotate-left mr-1.5"></i>
                {pendientesSync.length} carga(s) por enviar
              </div>
              <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px' }}>
                {isOnline ? 'Conexión disponible para enviar' : 'Se sincronizarán al recuperar señal'}
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
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: isOnline ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
              }}
            >
              {sincronizando ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Enviando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-rotate"></i> Sincronizar
                </>
              )}
            </button>
          </div>
        )}

        {/* BOTÓN GIGANTE: REGISTRAR CARGA EN FINCA */}
        <button
          type="button"
          onClick={() => setModalRegistro(true)}
          style={{
            width: '100%',
            height: '62px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '17px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.35)',
            cursor: 'pointer',
            marginBottom: '22px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            <i className="fa-solid fa-plus"></i>
          </div>
          <span>Registrar Carga en Finca</span>
        </button>

        {/* Historial de Cargas Registradas Hoy */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Cargas de Hoy ({cargasHoy.length})
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Total: <strong>{totalLitrosHoy.toLocaleString()} L</strong>
          </span>
        </div>

        {cargasHoy.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              padding: '36px 20px',
              textAlign: 'center',
              border: '1.5px dashed #cbd5e1',
              color: '#94a3b8',
            }}
          >
            <i className="fa-solid fa-clipboard-list text-3xl mb-2 text-slate-300"></i>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>
              No hay cargas registradas hoy
            </div>
            <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
              Pulsa el botón verde para agregar la primera recolección de la ruta.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cargasHoy.map((c) => (
              <div
                key={c.localId}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                      {c.fincaNombre}
                    </span>
                    {c.tipoLeche === 'BUFALA' && (
                      <span
                        style={{
                          background: '#fed7aa',
                          color: '#9a3412',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        BÚFALA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    <i className="fa-regular fa-clock mr-1 text-slate-400"></i>
                    {c.hora}
                    {c.temperatura ? ` • ${c.temperatura}°C` : ''}
                    {c.esAcida && ' • ⚠️ Ácida'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#2563eb' }}>
                    {c.litros.toLocaleString()} L
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    {c.synced ? (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#059669',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <i className="fa-solid fa-circle-check"></i> Enviado
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#d97706',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <i className="fa-solid fa-mobile"></i> En Teléfono
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
            {/* Header del Modal */}
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
                    Registro rápido para modo offline
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
              {/* Seleccionar Finca con Buscador Integrado */}
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
                  {fincasFiltradas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre} {f.codigo ? `(${f.codigo})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Litros Recolectados (Entrada Táctil Gigante) */}
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

              {/* Tipo de Leche (Segmented Switch) */}
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

              {/* Parámetros de Calidad y Observaciones */}
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
                    style={{
                      width: '100%',
                      height: '40px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
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

              {/* Botones de Acción */}
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
    </div>
  );
};

export default AppMovilPage;