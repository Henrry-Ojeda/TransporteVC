import { useAuthStore } from '@/stores/authStore';
import type { PermisoAccion } from '@/types';

export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    sessionExpiredMessage,
    login,
    logout,
    clearExpiredMessage,
    isAdmin,
    hasPermission,
    hasActionPermission,
    canAccessTab,
  } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated,
    sessionExpiredMessage,
    login,
    logout,
    clearExpiredMessage,
    isAdmin: isAdmin(),
    hasPermission: (codigo: string) => hasPermission(codigo),
    hasAction: (modulo: string, accion: PermisoAccion) => hasActionPermission(modulo, accion),
    canAccessTab: (tabId: string) => canAccessTab(tabId),
  };
};

export default useAuth;

