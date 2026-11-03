import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// Clave usada para persistir el token de sesión
export const AUTH_TOKEN_KEY = 'transporte_jwt_token';

export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Solicitudes: Adjuntar Token JWT y Header Multi-Inquilino
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof window !== 'undefined' && config.headers) {
      config.headers['X-Tenant-Domain'] = window.location.hostname;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Callbacks para eventos de sesión expirada
type SessionExpiredHandler = (message: string) => void;
let onSessionExpiredHandler: SessionExpiredHandler | null = null;

export const setSessionExpiredHandler = (handler: SessionExpiredHandler) => {
  onSessionExpiredHandler = handler;
};

// Interceptor de Respuestas: Manejo global de 401 y normalización de errores
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; title?: string; errors?: Record<string, string[]> }>) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Si el 401 no proviene de intentar loguearse
      if (!url.includes('/auth/login')) {
        console.warn('⚠️ Sesión expirada o token inválido (401).');
        if (onSessionExpiredHandler) {
          onSessionExpiredHandler('Tu sesión ha expirado en el servidor. Por favor inicia sesión nuevamente.');
        }
      }
    }

    // Normalizar mensaje de error legible
    const serverData = error.response?.data;
    let errorMessage = 'Ocurrió un error inesperado al comunicarse con el servidor.';

    if (serverData) {
      if (typeof serverData === 'string') {
        errorMessage = serverData;
      } else if (serverData.message) {
        errorMessage = serverData.message;
      } else if (serverData.title) {
        errorMessage = serverData.title;
        if (serverData.errors) {
          const detailList = Object.values(serverData.errors).flat().join(', ');
          if (detailList) errorMessage += `: ${detailList}`;
        }
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Adjuntar mensaje amigable al error
    error.message = errorMessage;
    return Promise.reject(error);
  }
);

export default apiClient;

