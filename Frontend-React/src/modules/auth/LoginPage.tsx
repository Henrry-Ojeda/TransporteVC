import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, LogIn, AlertTriangle, Loader2, Building2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/auth.api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, sessionExpiredMessage, clearExpiredMessage, isAuthenticated } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detección visual de empresa según subdominio/dominio
  const hostname = window.location.hostname.toLowerCase();
  const empresaNombre = hostname.includes('campoverde') 
    ? 'Quesera Campo Verde' 
    : 'Transporte & Lácteos Base';

  // Si ya está autenticado, redirigir al inicio
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor ingresa usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);
    clearExpiredMessage();

    try {
      const response = await authApi.login({
        username: username.trim(),
        password: password.trim(),
      });

      login(response.token, {
        id: response.id,
        username: response.username,
        nombreCompleto: response.nombreCompleto,
        rol: response.rol,
        permisos: Array.isArray(response.permisos) ? response.permisos : [],
      });

      // Redirigir a la ruta original o al dashboard
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);
      setError(err.message || 'Usuario o contraseña incorrectos. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Fondo decorativo fijado sin afectar métricas de scroll */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-8 sm:p-10 relative z-10 my-auto">
        {/* Cabecera / Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-blue-500/30">
            🥛
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Iniciar Sesión</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <Building2 className="w-3.5 h-3.5" />
            <span>{empresaNombre}</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 font-medium">
            Sistema de Transporte y Liquidación de Leche
          </p>

          {/* Alerta de sesión expirada */}
          {sessionExpiredMessage && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>{sessionExpiredMessage}</span>
            </div>
          )}

          {/* Alerta de error de autenticación */}
          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo Usuario */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Usuario
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                autoComplete="username"
                required
                disabled={loading}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-60 font-medium"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={loading}
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-60 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-4 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Botón de Acceso */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Entrar al Sistema</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="relative z-10 mt-6 text-center">
        <p className="text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} Sistema de Transporte &bull; Plataforma Multiempresa SaaS
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
