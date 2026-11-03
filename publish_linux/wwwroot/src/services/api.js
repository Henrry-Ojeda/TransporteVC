// ==========================================================================
// CLIENTE HTTP UNIFICADO Y GESTOR DE SERVICIOS API (Strangler Fig Refactor)
// ==========================================================================

var API_BASE = (typeof window !== 'undefined' && window.API_BASE) || '/api';
if (typeof window !== 'undefined') window.API_BASE = API_BASE;

/**
 * Realiza una petición HTTP autenticada a la API REST del backend de manera centralizada.
 * 
 * Qué hace esta función:
 * 1. Concatena automáticamente la ruta base de la API (`API_BASE`).
 * 2. Inyecta el encabezado `Authorization: Bearer <token>` si el usuario tiene sesión activa.
 * 3. Asigna por defecto `Content-Type: application/json` cuando se envía cuerpo (body) salvo que sea FormData.
 * 4. Captura errores de red y parsea las respuestas JSON de forma segura sin romper la aplicación.
 * 
 * @param {string} endpoint - Ruta relativa del endpoint backend (ej: '/configuracion/parametros' o '/rutas').
 * @param {Object} [options={}] - Opciones estándar de la API Fetch de JavaScript (method, body, headers, etc.).
 * @returns {Promise<{ok: boolean, status: number, data: any, error: string|null}>} Resultado estandarizado de la petición.
 */
async function apiFetch(endpoint, options = {}) {
    const base = (typeof window !== 'undefined' && window.API_BASE) || API_BASE;
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = { ...options.headers };

    const token = (typeof window !== 'undefined' && window.state && window.state.token) 
        || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token')) 
        || (typeof localStorage !== 'undefined' && localStorage.getItem('token')) 
        || null;

    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, { ...options, headers });
        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json().catch(() => null);
        } else {
            data = await response.text().catch(() => null);
        }

        return {
            ok: response.ok,
            status: response.status,
            data: data,
            error: response.ok ? null : (data?.mensaje || data?.title || `Error HTTP ${response.status}`)
        };
    } catch (networkError) {
        console.error(`[apiFetch Error] Fallo de conexión en ${url}:`, networkError);
        return {
            ok: false,
            status: 0,
            data: null,
            error: 'Fallo de conexión o servidor no disponible.'
        };
    }
}

// Helpers de conveniencia RESTful
async function apiGet(endpoint, headers = {}) {
    return apiFetch(endpoint, { method: 'GET', headers });
}

async function apiPost(endpoint, body, headers = {}) {
    return apiFetch(endpoint, { method: 'POST', body, headers });
}

async function apiPut(endpoint, body, headers = {}) {
    return apiFetch(endpoint, { method: 'PUT', body, headers });
}

async function apiPatch(endpoint, body = null, headers = {}) {
    const opts = { method: 'PATCH', headers };
    if (body) opts.body = body;
    return apiFetch(endpoint, opts);
}

async function apiDelete(endpoint, headers = {}) {
    return apiFetch(endpoint, { method: 'DELETE', headers });
}

// Exportación global en Browser
if (typeof window !== 'undefined') {
    window.apiFetch = apiFetch;
    window.apiGet = apiGet;
    window.apiPost = apiPost;
    window.apiPut = apiPut;
    window.apiPatch = apiPatch;
    window.apiDelete = apiDelete;
}

// Exportación para NodeJS / Tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        apiFetch,
        apiGet,
        apiPost,
        apiPut,
        apiPatch,
        apiDelete
    };
}
