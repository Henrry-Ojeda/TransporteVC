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

export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
};

// Interceptor de Solicitudes: Adjuntar Token JWT y Header Multi-Inquilino
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem('token')) : null;
    const url = config.url || '';
    const isPublic = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/vincular-dispositivo') || url.includes('/public');
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';

    // Si el token ya expiró en el cliente, cerrar sesión proactivamente para evitar 401/403
    if (token && isTokenExpired(token) && !isPublic) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('token');
        localStorage.removeItem('transporte_last_activity');
      }
      if (onSessionExpiredHandler) {
        onSessionExpiredHandler('Tu sesión ha expirado por límite de tiempo. Inicia sesión nuevamente.');
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
      const controller = new AbortController();
      config.signal = controller.signal;
      controller.abort('Sesión expirada');
      return config;
    }

    // Si no hay token de sesión (o estamos en la pantalla de Login) y no es endpoint público,
    // abortar la petición silenciosamente antes de viajar por red para evitar 401 en consola
    if ((!token || isLoginPage) && !isPublic) {
      const controller = new AbortController();
      config.signal = controller.signal;
      controller.abort('Sesión no iniciada');
      return config;
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof window !== 'undefined' && config.headers) {
      const storedTenant = localStorage.getItem('movil_tenant_domain');
      config.headers['X-Tenant-Domain'] = storedTenant || window.location.hostname;
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

// Interceptor de Respuestas: Manejo global de 401/403 y normalización de errores
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // Si la solicitud fue cancelada deliberadamente (ej. no autenticado o en login), suprimirla en silencio
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.message === 'Sesión no iniciada' || error.message === 'Sesión expirada') {
      return new Promise(() => {});
    }

    const status = error.response?.status;
    const url = error.config?.url || '';

    // Manejo sincronizado de expiración de sesión (401 o 403 cuando el token ya no es aceptado)
    if (status === 401 || (status === 403 && !url.includes('/auth/login'))) {
      const serverData = error.response?.data;
      const isTokenIssue = status === 401 || (typeof serverData === 'string' && (serverData.includes('Token') || serverData.includes('Unauthorized') || serverData.includes('expir')));
      
      if (isTokenIssue && !url.includes('/auth/login')) {
        // 1. Limpiar credenciales y sesión inmediatamente
        if (typeof window !== 'undefined') {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem('token');
          localStorage.removeItem('transporte_last_activity');
        }

        // 2. Notificar al store de autenticación
        if (onSessionExpiredHandler) {
          onSessionExpiredHandler('Tu sesión en el servidor ha finalizado. Por favor inicia sesión nuevamente.');
        }

        // 3. Redirigir de inmediato a la pantalla de Login sin mostrar popups con código HTML
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }

        // 4. Retornar promesa en suspensión silenciosa para no saturar la vista con errores ni banners
        return new Promise(() => {});
      }
    }

    // Normalizar mensaje de error legible y prevenir volcado de código HTML (ej. 502 Bad Gateway)
    const serverData = error.response?.data;
    let errorMessage = 'Ocurrió un error inesperado al comunicarse con el servidor.';

    if (status === 502 || status === 503 || status === 504) {
      errorMessage = 'El servidor backend se está reiniciando o no está disponible temporalmente (502 Gateway). Por favor espere unos segundos e intente de nuevo.';
    } else if (serverData) {
      if (typeof serverData === 'string') {
        if (serverData.includes('<html') || serverData.includes('<!DOCTYPE')) {
          errorMessage = 'El servidor devolvió una respuesta no válida o se encuentra reiniciándose. Por favor intente nuevamente en unos instantes.';
        } else {
          errorMessage = serverData;
        }
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

