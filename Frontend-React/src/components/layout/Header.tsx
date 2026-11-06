import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/api/client';
import { bcvApi } from '@/api/bcv.api';
import Swal from 'sweetalert2';

interface HeaderProps {
  onToggleSidebar: () => void;
}

interface BcvResponse {
  tieneTasaHoy: boolean;
  tasaDolarBs: number;
  fecha?: string;
  fuente?: string;
}

interface CicloActivoResponse {
  id?: number;
  codigo?: string;
  numeroSemana?: number;
  semana?: number;
  año?: number;
  fechaInicio?: string;
  fechaFin?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [sincronizandoBcv, setSincronizandoBcv] = useState(false);

  // Query Tasa BCV
  const { data: bcvData, isLoading: loadingBcv, refetch: refetchBcv } = useQuery<BcvResponse>({
    queryKey: ['bcv-hoy'],
    queryFn: async () => {
      const res = await apiClient.get<BcvResponse>('/bcv/hoy');
      return res.data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 15,
  });

  // Query Ciclo Activo
  const { data: cicloData, isLoading: loadingCiclo } = useQuery<CicloActivoResponse>({
    queryKey: ['ciclo-activo'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CicloActivoResponse>('/ciclos/activo');
        return res.data;
      } catch {
        const fallback = await apiClient.get<CicloActivoResponse>('/catalogos/ciclo-activo');
        return fallback.data;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  });

  // Query Empresa Config (100% dinámico desde BD)
  const { data: empresaConfig } = useQuery({
    queryKey: ['empresa-config'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/catalogos/empresa');
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!user,
  });

  const handleSyncBcv = async () => {
    if (sincronizandoBcv) return;
    setSincronizandoBcv(true);
    try {
      const res = await bcvApi.sincronizarTasaBcvLive();
      await queryClient.invalidateQueries({ queryKey: ['bcv-hoy'] });
      await queryClient.invalidateQueries({ queryKey: ['historial-bcv'] });
      await refetchBcv();
      Swal.fire({
        icon: 'success',
        title: '¡Tasa BCV Sincronizada!',
        html: `<strong>Tasa oficial:</strong> Bs. ${res.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}<br/><small style="color: #64748b;">Fuente: ${res.fuente} (${res.fecha})</small>`,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Entendido',
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de sincronización',
        text: err?.message || 'No se pudo conectar a los servicios de tasa BCV en vivo.',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setSincronizandoBcv(false);
    }
  };

  const tasa = bcvData?.tasaDolarBs ?? 0;

  // Cálculo ISO 8601 robusto de semana
  let computedWeek = 0;
  let computedYear = 0;
  const fechaRef = cicloData?.fechaInicio;
  if (fechaRef) {
    const d = new Date(fechaRef);
    if (!isNaN(d.getTime())) {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      computedWeek = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      computedYear = new Date(firstThursday).getFullYear();
    }
  }

  const match = cicloData?.codigo?.match(/Semana\s*#?\s*(\d+)/i) || cicloData?.codigo?.match(/(\d+)/);
  const numSemana = cicloData?.numeroSemana || cicloData?.semana || (match ? parseInt(match[1]) : 0) || computedWeek || cicloData?.id || 0;
  const fechaIniStr = cicloData?.fechaInicio ? new Date(cicloData.fechaInicio).toLocaleDateString('es-VE') : '';
  const fechaFinStr = cicloData?.fechaFin ? new Date(cicloData.fechaFin).toLocaleDateString('es-VE') : '';
  
  const rawCode = (cicloData?.codigo || '').trim();
  const esCodigoInvalido = !rawCode || rawCode.includes('# ()') || rawCode.endsWith('()') || !/\d+/.test(rawCode);
  const nombreSemana = esCodigoInvalido ? `Semana #${numSemana}` : rawCode.split('(')[0].trim();

  const textoCiclo = (cicloData?.id || numSemana > 0)
    ? `${nombreSemana}${fechaIniStr ? ` (${fechaIniStr} al ${fechaFinStr})` : ''}`
    : 'No hay semana activa';

  const userInitials = (user?.nombreCompleto || user?.username || 'AD')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <header className="top-nav">
      <div className="nav-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          className="mobile-menu-toggle"
          id="btnToggleMobileSidebar"
          onClick={onToggleSidebar}
          aria-label="Abrir Menú"
          title="Menú"
          style={{ cursor: 'pointer' }}
        >
          <i className="fa-solid fa-bars"></i>
        </button>
        <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {empresaConfig?.logoUrl ? (
            <img
              src={empresaConfig.logoUrl}
              alt="Logo"
              style={{ maxHeight: '28px', maxWidth: '40px', objectFit: 'contain', borderRadius: '4px' }}
            />
          ) : (
            <i className="fa-solid fa-cow brand-icon"></i>
          )}
          <div>
            <span className="brand-title">
              {empresaConfig?.nombre || empresaConfig?.nombreEmpresa || 'RUTAS DE LECHE'}
            </span>
          </div>
        </div>
      </div>

      <div className="nav-center">
        {/* WIDGET TASA BCV HOY */}
        <div
          className="bcv-widget"
          id="bcvWidget"
          title="Consultar y registrar tasa oficial en vivo"
          style={{ cursor: 'pointer' }}
          onClick={handleSyncBcv}
        >
          <div className="bcv-icon">
            <i className={`fa-solid ${sincronizandoBcv ? 'fa-spinner fa-spin' : 'fa-dollar-sign'}`}></i>
          </div>
          <div className="bcv-info">
            <span className="bcv-label">TASA BCV HOY</span>
            <span className="bcv-value" id="bcvHoyTexto">
              {loadingBcv || sincronizandoBcv ? (
                'Sincronizando...'
              ) : tasa > 0 ? (
                `Bs. ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
              ) : (
                'Por definir'
              )}
            </span>
          </div>
          <button
            className="btn-icon"
            id="btnSyncBcvApi"
            title="Sincronizar tasa en vivo desde BCV"
            disabled={sincronizandoBcv}
            style={{ color: '#34d399', marginLeft: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              handleSyncBcv();
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${loadingBcv || sincronizandoBcv ? 'fa-spin' : ''}`}></i>
          </button>
        </div>

        {/* WIDGET SEMANA OPERATIVA */}
        <div className="ciclo-widget" id="cicloWidget">
          <i className="fa-regular fa-calendar-check ciclo-icon"></i>
          <div>
            <span className="ciclo-label">SEMANA OPERATIVA ACTIVA</span>
            <span className="ciclo-value" id="cicloActivoTexto">
              {loadingCiclo ? 'Cargando...' : textoCiclo}
            </span>
          </div>
        </div>
      </div>

      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* WIDGET PERFIL USUARIO PROFESIONAL (ESTILO EXECUTIVE SAAS) */}
        <div
          id="userProfileWidget"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '999px',
            padding: '4px 6px 4px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Zona clickeable hacia el Perfil */}
          <div
            onClick={() => navigate('/perfil')}
            title="Ir a Mi Perfil de Usuario"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '999px',
              userSelect: 'none',
            }}
          >
            {/* Avatar con anillo y badge en línea */}
            <div style={{ position: 'relative' }}>
              <div
                id="userAvatar"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  border: '2px solid #ffffff',
                }}
              >
                {user?.fotoUrl ? (
                  <img
                    src={user.fotoUrl}
                    alt={user.nombreCompleto}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  userInitials || 'AD'
                )}
              </div>
              {/* Punto de estado En Línea */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #ffffff',
                }}
                title="Sesión Activa"
              />
            </div>

            {/* Detalles de Usuario Tipografía Ejecutiva */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
              <span
                id="userNameLabel"
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#0f172a',
                  maxWidth: '160px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.25,
                }}
                title={user?.nombreCompleto || user?.username || 'Usuario'}
              >
                {user?.nombreCompleto || user?.username || 'Administrador'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <span
                  id="userRoleBadge"
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 800,
                    color: '#0284c7',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    lineHeight: 1.2,
                  }}
                >
                  <i className="fa-solid fa-shield-halved" style={{ fontSize: '8.5px', marginRight: '3px' }}></i>
                  {user?.rol || 'ADMIN'}
                </span>
              </div>
            </div>

            <i className="fa-solid fa-angle-right" style={{ fontSize: '11px', color: '#94a3b8', margin: '0 2px' }}></i>
          </div>

          {/* Separador vertical sutil */}
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />

          {/* Botón Salir / Logout Ejecutivo */}
          <button
            type="button"
            id="btnLogout"
            title="Cerrar Sesión Segura"
            onClick={(e) => {
              e.stopPropagation();
              logout();
            }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#ef4444',
              border: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '12.5px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.borderColor = '#fee2e2';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
