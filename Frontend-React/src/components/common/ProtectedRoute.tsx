import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, hasPermission } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl mb-4 font-bold">
          403
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso No Autorizado</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Tu rol no tiene los permisos requeridos (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-rose-600">{requiredPermission}</code>) para acceder a este módulo.
        </p>
      </div>
    );
  }

  return children ? <>{children}</> : null;
};

export default ProtectedRoute;

