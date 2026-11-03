import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, LogIn, AlertTriangle, Loader2 } from 'lucide-react';
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

  // Si ya está autenticado, redirigir al inicio
  React.useEffect(() => {
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo decorativo con gradientes sutiles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-8 sm:p-10 relative z-10">
        {/* Cabecera / Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-blue-500/30">
            🥛
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Iniciar Sesión</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Sistema de Transporte y Liquidación de Leche
          </p>

          {/* Alerta de sesión expirada */}
          {sessionExpiredMessage && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2 text-left animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>{sessionExpiredMessage}</span>
            </div>
          )}

          {/* Alerta de error de autenticación */}
          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 text-left animate-in fade-in">
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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                autoComplete="username"
                required
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-60"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={loading}
                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Botón de Acceso */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Entrar al Sistema</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

