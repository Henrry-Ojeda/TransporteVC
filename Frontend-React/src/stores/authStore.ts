import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, PermisoAccion } from '@/types';
import { AUTH_TOKEN_KEY, setSessionExpiredHandler } from '@/api/client';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  sessionExpiredMessage: string | null;

  // Acciones
  login: (token: string, user: AuthUser) => void;
  logout: (message?: string) => void;
  clearExpiredMessage: () => void;

  // Verificaciones RBAC y Feature Flags SaaS
  isAdmin: () => boolean;
  hasPermission: (codigo: string) => boolean;
  hasActionPermission: (modulo: string, accion: PermisoAccion) => boolean;
  canAccessTab: (tabId: string) => boolean;
  hasTenantModule: (moduloCodigo: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      sessionExpiredMessage: null,

      login: (token: string, user: AuthUser) => {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        set({
          token,
          user,
          isAuthenticated: true,
          sessionExpiredMessage: null,
        });
      },

      logout: (message?: string) => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          sessionExpiredMessage: message || null,
        });
      },

      clearExpiredMessage: () => set({ sessionExpiredMessage: null }),

      isAdmin: () => {
        const user = get().user;
        if (!user) return false;
        const rol = (user.rol || '').toUpperCase();
        return rol.includes('ADMIN') || rol === 'ADMINISTRADOR GENERAL';
      },

      hasPermission: (codigo: string) => {
        const { user, isAdmin } = get();
        if (!user) return false;
        if (isAdmin()) return true;
        const permisos = user.permisos || [];
        return permisos.includes(codigo.toUpperCase());
      },

      hasActionPermission: (modulo: string, accion: PermisoAccion) => {
        const codigo = `${modulo.toUpperCase()}_${accion.toUpperCase()}`;
        return get().hasPermission(codigo);
      },

      hasTenantModule: (moduloCodigo: string) => {
        const user = get().user;
        if (!user || !user.modulosHabilitados) return true;
        return user.modulosHabilitados.includes(moduloCodigo.toUpperCase());
      },

      canAccessTab: (tabId: string) => {
        const { hasPermission, isAdmin, hasTenantModule } = get();

        // 1. Validar si la empresa cliente tiene contratado el módulo (Feature Flags SaaS)
        const tabToSaaSModule: Record<string, string> = {
          'bufala': 'MOD_LECHE_BUFALA',
          'combustible': 'MOD_COMBUSTIBLE',
          'mantenimiento': 'MOD_MANTENIMIENTO',
          'historial-camiones': 'MOD_MANTENIMIENTO',
          'repuestos': 'MOD_REPUESTOS',
        };

        const saasReq = tabToSaaSModule[tabId.toLowerCase()];
        if (saasReq && !hasTenantModule(saasReq)) {
          return false; // Módulo no contratado por esta empresa en el SaaS Manager
        }

        if (isAdmin()) return true;

        const tabPermissionMap: Record<string, string[]> = {
          'dashboard': ['DASHBOARD_VER'],
          'rutas': ['RUTAS_VER'],
          'viajes': ['CONTROL_RUTAS_VER', 'RUTAS_VER'],
          'entregas': ['ENTREGAS_VER'],
          'receptoria': ['ENTREGAS_VER'],
          'balance': ['BALANCE_LECHE_VER'],
          'bufala': ['TRAZABILIDAD_BUFALA_VER'],
          'planificacion-rutas': ['RUTAS_PLANIFICACION_VER', 'RUTAS_VER'],

          // Catálogos
          'fincas': ['FINCAS_VER'],
          'propietarios': ['PROPIETARIOS_VER'],
          'conductores': ['CONDUCTORES_VER'],
          'camiones': ['CAMIONES_VER', 'CONDUCTORES_VER'],
          'companias': ['COMPANIAS_VER'],
          'bancos': ['BANCOS_VER'],
          'empresa': ['EMPRESA_VER'],

          // Flota & Mantenimiento
          'combustible': ['COMBUSTIBLE_VER', 'CAMIONES_VER'],
          'mantenimiento': ['HISTORIAL_CAMIONES_VER', 'CAMIONES_VER'],
          'repuestos': ['REPUESTOS_VER', 'CAMIONES_VER'],

          // Finanzas & Liquidación
          'semanas': ['CICLOS_VER'],
          'liquidaciones': ['LIQUIDACIONES_VER'],
          'pagos-personal': ['PAGOS_PERSONAL_VER', 'LIQUIDACIONES_VER'],

          // Adelantos
          'adelantos': ['ADELANTOS_VER', 'ADELANTOS_FINCAS_VER'],
          'adelantos-fincas': ['ADELANTOS_FINCAS_VER', 'ADELANTOS_VER'],
          'adelantos-personal': ['ADELANTOS_PERSONAL_VER', 'ADELANTOS_VER'],
          'abonos-companias': ['ABONOS_COMPANIAS_VER', 'ADELANTOS_VER'],

          // Gestión de Data
          'data': ['EMPRESA_VER', 'FINCAS_VER', 'PROPIETARIOS_VER'],

          // Reportes
          'reportes': ['REPORTES_VER'],
          'historial-bcv': ['HISTORIAL_BCV_VER'],

          // Seguridad y Sistema
          'usuarios': ['USUARIOS_VER', 'USUARIOS_SEGURIDAD_VER'],
          'permisos': ['PERMISOS_VER'],
          'configuracion': ['CONFIGURACION_VER'],
        };

        const requiredPerms = tabPermissionMap[tabId.toLowerCase()];
        if (!requiredPerms || requiredPerms.length === 0) return true;
        return requiredPerms.some((perm) => hasPermission(perm));
      },
    }),
    {
      name: 'transporte_auth_store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Conectar el interceptor 401 de Axios con el store de Zustand
setSessionExpiredHandler((msg: string) => {
  useAuthStore.getState().logout(msg);
});

