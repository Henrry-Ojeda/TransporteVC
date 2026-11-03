import React, { useState } from 'react';
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
    staleTime: 1000 * 60 * 30,
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
          <i className="fa-solid fa-cow brand-icon"></i>
          <div>
            <span className="brand-title">RUTAS DE LECHE</span>
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
        <div className="user-profile" id="userProfileWidget">
          <div className="user-avatar" id="userAvatar">
            {userInitials || 'AD'}
          </div>
          <div className="user-details">
            <span className="user-name" id="userNameLabel">
              {user?.nombreCompleto || user?.username || 'Administrador'}
            </span>
            <span className="user-role" id="userRoleBadge">
              {user?.rol || 'ADMIN'}
            </span>
          </div>
          <button
            className="btn-logout"
            id="btnLogout"
            title="Cerrar Sesión"
            onClick={() => logout()}
            style={{ cursor: 'pointer' }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
