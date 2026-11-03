import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/api/client';

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
  numeroSemana?: number;
  semana?: number;
  año?: number;
  fechaInicio?: string;
  fechaFin?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuthStore();

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

  const tasa = bcvData?.tasaDolarBs ?? 0;
  const numSemana = cicloData?.numeroSemana || cicloData?.semana || 0;
  const fechaIniStr = cicloData?.fechaInicio ? new Date(cicloData.fechaInicio).toLocaleDateString('es-VE') : '';
  const fechaFinStr = cicloData?.fechaFin ? new Date(cicloData.fechaFin).toLocaleDateString('es-VE') : '';
  const textoCiclo = numSemana > 0 
    ? `Semana #${numSemana} ${fechaIniStr ? `(${fechaIniStr} - ${fechaFinStr})` : ''}`
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
          onClick={() => refetchBcv()}
        >
          <div className="bcv-icon">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div className="bcv-info">
            <span className="bcv-label">TASA BCV HOY</span>
            <span className="bcv-value" id="bcvHoyTexto">
              {loadingBcv ? (
                'Cargando...'
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
            title="Actualizar tasa"
            style={{ color: '#34d399', marginLeft: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              refetchBcv();
            }}
          >
            <i className={`fa-solid fa-arrows-rotate ${loadingBcv ? 'fa-spin' : ''}`}></i>
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
