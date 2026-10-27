// ==========================================================================
// RUTAS DE LECHE - FRONTEND APPLICATION CORE (MODERN SPA)
// ==========================================================================

var API_BASE = window.API_BASE || (function() {
    var port = window.location.port;
    if (port === '5188' || port === '5190') {
        return '/api';
    }
    var host = window.location.hostname || 'localhost';
    if (!host || host === '') host = 'localhost';
    return 'http://' + host + ':5188/api';
})();
window.API_BASE = API_BASE;

var state = window.state || {
    user: null,
    token: sessionStorage.getItem('token') || localStorage.getItem('token') || null,
    tasaBcv: 0,
    cicloActivo: null,
    fincas: [],
    companias: [],
    choferes: [],
    rutas: [],
    entregas: [],
    datatableEntregas: { search: '', currentPage: 1, pageSize: 10, sortColumn: 'proceso', sortDirection: 'asc' },
    rutasSearch: '',
    rutasFechaFiltro: new Date().toISOString().split('T')[0],
    rutasPage: 1,
    rutasPageSize: 10,
    rutasSortCol: 'id',
    rutasSortAsc: false,
    semanas: [],
    semanasFilter: 'ACTIVA', // 'ACTIVA' | 'PROGRAMADO' | 'CERRADO' | 'TODAS'
    semanasSearch: '',
    semanasPage: 1,
    semanasPageSize: 10,
    balanceReceptoria: null,
    filtroProcesoBalance: 0
};
window.state = state;

// Instancias de Comboboxes Buscables
var comboboxFincaInstance = window.comboboxFincaInstance || null;
var comboboxConductorInstance = window.comboboxConductorInstance || null;
var comboboxEditConductorInstance = window.comboboxEditConductorInstance || null;
var comboboxEditFincaInstance = window.comboboxEditFincaInstance || null;
var comboboxFiltroChoferInstance = window.comboboxFiltroChoferInstance || null;
var comboboxFiltroFincaInstance = window.comboboxFiltroFincaInstance || null;
var comboboxEntregaCompaniaInstance = window.comboboxEntregaCompaniaInstance || null;
var comboboxEntregaConductorInstance = window.comboboxEntregaConductorInstance || null;
var comboboxFiltroEntregaChoferInstance = window.comboboxFiltroEntregaChoferInstance || null;
var comboboxFiltroEntregaCompaniaInstance = window.comboboxFiltroEntregaCompaniaInstance || null;
var comboboxAdelantoEntidadInstance = window.comboboxAdelantoEntidadInstance || null;
var comboboxEditEntregaConductorInstance = window.comboboxEditEntregaConductorInstance || null;
var comboboxFiltroMermasChoferInstance = window.comboboxFiltroMermasChoferInstance || null;
var comboboxFiltroTicketChoferInstance = window.comboboxFiltroTicketChoferInstance || null;
var comboboxEditControlFincaInstance = window.comboboxEditControlFincaInstance || null;
var comboboxEditControlEntregaCompaniaInstance = window.comboboxEditControlEntregaCompaniaInstance || null;
var comboboxEditEntregaCompaniaInstance = window.comboboxEditEntregaCompaniaInstance || null;
var comboboxModalStandaloneChoferInstance = window.comboboxModalStandaloneChoferInstance || null;

// Instancias globales para gráficos de Chart.js
var chartChoferesInstance = window.chartChoferesInstance || null;
var chartTopFincasInstance = window.chartTopFincasInstance || null;
var chartBalanceInstance = window.chartBalanceInstance || null;
var chartTendenciaInstance = window.chartTendenciaInstance || null;

// --------------------------------------------------------------------------
// UTILIDADES GENERALES, HELPERS DE TABLAS & CLIENTE HTTP UNIFICADO
// --------------------------------------------------------------------------
var capitalizarTexto = window.capitalizarTexto;

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
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = { ...options.headers };

    if (state.token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${state.token}`;
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
window.apiFetch = apiFetch;

/**
 * Renderiza un estado visual de carga (Spinner animado) dentro del tbody de cualquier tabla.
 * 
 * Qué hace esta función:
 * 1. Localiza el elemento `<tbody>` por su ID o referencia DOM.
 * 2. Inserta una fila que abarca todo el ancho (`colspan`) con animación giratoria de FontAwesome.
 * 
 * @param {string|HTMLElement} target - ID del tbody o el elemento HTML correspondiente.
 * @param {number} [colSpan=6] - Cantidad de columnas que debe abarcar la fila de carga.
 * @param {string} [mensaje='Cargando datos...'] - Texto descriptivo mostrado al usuario.
 */
function renderTableLoading(target, colSpan = 6, mensaje = 'Cargando datos...') {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="${colSpan}" style="text-align: center; padding: 26px; color: #64748b; font-size: 13px;">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px; color: #6366f1;"></i> ${mensaje}
            </td>
        </tr>
    `;
}
window.renderTableLoading = renderTableLoading;

/**
 * Renderiza un estado vacío estilizado cuando una consulta no devuelve registros.
 * 
 * Qué hace esta función:
 * 1. Inserta una fila amigable que notifica que no hay datos disponibles o coincidentes con el filtro.
 * 2. Presenta un icono tenue y tipografía clara.
 * 
 * @param {string|HTMLElement} target - ID del tbody o el elemento HTML correspondiente.
 * @param {number} [colSpan=6] - Cantidad de columnas que abarca la fila.
 * @param {string} [mensaje='No se encontraron registros registrados.'] - Mensaje informativo.
 * @param {string} [iconClass='fa-inbox'] - Clase del icono FontAwesome a mostrar.
 */
function renderTableEmpty(target, colSpan = 6, mensaje = 'No se encontraron registros.', iconClass = 'fa-inbox') {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="${colSpan}" style="text-align: center; padding: 32px 20px; color: #64748b; font-size: 13.5px;">
                <i class="fa-solid ${iconClass}" style="font-size: 24px; display: block; margin-bottom: 8px; color: #94a3b8;"></i>
                ${mensaje}
            </td>
        </tr>
    `;
}
window.renderTableEmpty = renderTableEmpty;

/**
 * Renderiza un estado de error estilizado dentro de una tabla cuando falla una petición o la API retorna error.
 * 
 * Qué hace esta función:
 * 1. Muestra un mensaje de advertencia visual en color carmesí/rojo con opción de reintentar si se especifica.
 * 
 * @param {string|HTMLElement} target - ID del tbody o el elemento HTML correspondiente.
 * @param {number} [colSpan=6] - Cantidad de columnas que abarca la fila.
 * @param {string} [mensaje='Ocurrió un error al cargar la información.'] - Mensaje de error a visualizar.
 */
function renderTableError(target, colSpan = 6, mensaje = 'Ocurrió un error al cargar la información.') {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    el.innerHTML = `
        <tr>
            <td colspan="${colSpan}" style="text-align: center; padding: 24px; color: #e11d48; font-size: 13px; font-weight: 600;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> ${mensaje}
            </td>
        </tr>
    `;
}
window.renderTableError = renderTableError;


// NOTIFICACIONES & ALERTAS
function toggleDropdownNotificaciones(e) {
    if (e) e.stopPropagation();
    const drop = document.getElementById('dropdownNotificaciones');
    if (!drop) return;
    if (drop.style.display === 'none' || !drop.style.display) {
        drop.style.display = 'block';
        cargarNotificacionesAlertas();
    } else {
        drop.style.display = 'none';
    }
}
window.toggleDropdownNotificaciones = toggleDropdownNotificaciones;

document.addEventListener('click', (e) => {
    const drop = document.getElementById('dropdownNotificaciones');
    const btn = document.getElementById('btnNotificacionesHeader');
    if (drop && drop.style.display === 'block' && !drop.contains(e.target) && !btn?.contains(e.target)) {
        drop.style.display = 'none';
    }
});

async function cargarNotificacionesAlertas() {
    const contenedor = document.getElementById('listaNotificacionesContenido');
    const badge = document.getElementById('badgeNotificaciones');
    const lblHeader = document.getElementById('lblTotalAlertasHeader');
    if (!contenedor) return;

    let alertas = [];

    try {
        const resAdelantos = await fetch(`${API_BASE}/Adelantos?estado=ACTIVO`, {
            headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
        });
        if (resAdelantos.ok) {
            const listaAde = await resAdelantos.json();
            const conSaldo = listaAde.filter(a => Number(a.montoPendienteUSD || 0) > 0);
            if (conSaldo.length > 0) {
                const totalUsd = conSaldo.reduce((acc, c) => acc + Number(c.montoPendienteUSD || 0), 0);
                alertas.push({
                    tipo: 'adelanto',
                    icono: 'fa-hand-holding-dollar',
                    color: '#f59e0b',
                    titulo: `${conSaldo.length} Préstamo(s) Activo(s)`,
                    descripcion: `Hay ${conSaldo.length} préstamos con saldo pendiente ($${totalUsd.toFixed(2)} USD).`,
                    tab: 'adelantos-fincas'
                });
            }
        }
    } catch (e) { console.warn('Error alerta adelantos:', e); }

    try {
        if (state.cicloActivo && state.cicloActivo.id) {
            const resLiq = await fetch(`${API_BASE}/Liquidaciones/pre-liquidacion?cicloId=${state.cicloActivo.id}`, {
                headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
            });
            if (resLiq.ok) {
                const liq = await resLiq.json();
                const pendientes = (liq.fincas || []).filter(f => !f.pagado);
                if (pendientes.length > 0) {
                    alertas.push({
                        tipo: 'pago',
                        icono: 'fa-file-invoice-dollar',
                        color: '#38bdf8',
                        titulo: `${pendientes.length} Liquidaciones Pendientes`,
                        descripcion: `Semana ${state.cicloActivo.codigo || ''}: faltan ${pendientes.length} fincas por procesar pago.`,
                        tab: 'liquidacion'
                    });
                }
            }
        }
    } catch (e) { console.warn('Error alerta liquidacion:', e); }

    if (badge) {
        if (alertas.length > 0) {
            badge.textContent = alertas.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
    if (lblHeader) lblHeader.textContent = `${alertas.length} Alertas`;

    if (alertas.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 20px 10px; color: #94a3b8; font-size: 12.5px;">
                <i class="fa-solid fa-circle-check" style="font-size: 26px; color: #10b981; margin-bottom: 6px; display: block;"></i>
                ¡Todo al día! No hay cobros ni pagos pendientes.
            </div>`;
    } else {
        contenedor.innerHTML = alertas.map(a => `
            <div onclick="irAPestana('${a.tab}'); document.getElementById('dropdownNotificaciones').style.display='none';" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3.5px solid ${a.color}; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(51, 65, 85, 0.9)'" onmouseout="this.style.background='rgba(30, 41, 59, 0.7)'">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <strong style="font-size: 12.5px; color: #fff; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid ${a.icono}" style="color: ${a.color};"></i> ${a.titulo}
                    </strong>
                    <span style="font-size: 10px; color: #38bdf8; font-weight: 700;">Ver <i class="fa-solid fa-arrow-right"></i></span>
                </div>
                <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.3;">${a.descripcion}</p>
            </div>
        `).join('');
    }
}
window.cargarNotificacionesAlertas = cargarNotificacionesAlertas;

function showToast(titleOrMessage, type = 'success', subtitle = null, duration = 2500) {
    let title = titleOrMessage;
    let text = subtitle;
    let iconType = type;
    let timerDuration = duration;

    if (typeof titleOrMessage === 'object' && titleOrMessage !== null) {
        title = titleOrMessage.title || titleOrMessage.message || '';
        text = titleOrMessage.text || titleOrMessage.subtitle || '';
        iconType = titleOrMessage.icon || type || 'success';
        timerDuration = titleOrMessage.timer || duration || 2500;
    }

    // Asegurar contenedor portal exclusivo para toasts en el DOM
    let container = document.getElementById('custom-toast-portal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'custom-toast-portal-container';
        container.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 9999999; display: flex; flex-direction: column; gap: 10px; max-width: 420px; width: calc(100vw - 32px); pointer-events: none;';
        document.body.appendChild(container);
    }

    let iconColor = '#10b981';
    let iconFa = 'fa-circle-check';
    let borderColor = 'rgba(16, 185, 129, 0.45)';
    let badgeBg = 'rgba(16, 185, 129, 0.18)';
    let barColor = '#10b981';

    if (iconType === 'error') {
        iconColor = '#ef4444';
        iconFa = 'fa-circle-xmark';
        borderColor = 'rgba(239, 68, 68, 0.45)';
        badgeBg = 'rgba(239, 68, 68, 0.18)';
        barColor = '#ef4444';
    } else if (iconType === 'warning') {
        iconColor = '#f59e0b';
        iconFa = 'fa-triangle-exclamation';
        borderColor = 'rgba(245, 158, 11, 0.45)';
        badgeBg = 'rgba(245, 158, 11, 0.18)';
        barColor = '#f59e0b';
    } else if (iconType === 'info') {
        iconColor = '#38bdf8';
        iconFa = 'fa-circle-info';
        borderColor = 'rgba(56, 189, 248, 0.45)';
        badgeBg = 'rgba(56, 189, 248, 0.18)';
        barColor = '#38bdf8';
    }

    const toast = document.createElement('div');
    toast.className = 'custom-portal-toast-card';
    toast.style.cssText = `
        position: relative;
        background: #0f172a;
        color: #ffffff;
        border-radius: 14px;
        border: 1.5px solid ${borderColor};
        box-shadow: 0 20px 30px -10px rgba(0,0,0,0.65), 0 10px 15px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        padding: 12px 14px;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
        overflow: hidden;
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, max-height 0.25s ease, margin 0.25s ease, padding 0.25s ease;
        max-height: 220px;
    `;

    toast.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px; text-align: left; width: 100%; font-family: inherit; position: relative;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: ${badgeBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${iconColor}; font-size: 17px; margin-top: 2px; box-shadow: 0 2px 8px ${badgeBg};">
                <i class="fa-solid ${iconFa}"></i>
            </div>
            <div style="flex: 1; min-width: 0; padding-right: 22px;">
                <div style="font-size: 13.5px; font-weight: 800; color: #ffffff; line-height: 1.35; letter-spacing: -0.01em;">
                    ${title}
                </div>
                ${text ? `<div style="font-size: 12px; color: #cbd5e1; font-weight: 500; margin-top: 3px; line-height: 1.35; word-break: break-word;">${text}</div>` : ''}
            </div>
            <button type="button" class="btn-cerrar-portal-toast" title="Cerrar" style="position: absolute; top: -2px; right: -2px; background: rgba(255,255,255,0.08); border: none; color: #94a3b8; font-size: 13px; cursor: pointer; width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="portal-toast-progress" style="position: absolute; bottom: 0; left: 0; height: 3px; width: 100%; background: ${barColor}; border-radius: 0 0 14px 14px; transition: width ${timerDuration}ms linear;"></div>
    `;

    container.appendChild(toast);

    // Animar entrada y cuenta regresiva de la barra
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
        const pBar = toast.querySelector('.portal-toast-progress');
        if (pBar) {
            requestAnimationFrame(() => {
                pBar.style.width = '0%';
            });
        }
    });

    let isDismissed = false;
    const dismiss = () => {
        if (isDismissed) return;
        isDismissed = true;
        clearTimeout(timerId);
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        toast.style.maxHeight = '0px';
        toast.style.paddingTop = '0px';
        toast.style.paddingBottom = '0px';
        toast.style.marginTop = '-10px';
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    };

    const timerId = setTimeout(dismiss, timerDuration);

    toast.addEventListener('click', dismiss);
    const btnCerrar = toast.querySelector('.btn-cerrar-portal-toast');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
    }

    return { close: dismiss };
}
window.showToast = showToast;

function abrirModalCustom(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('open');
        modal.style.display = 'flex';
    }
}

function cerrarModalCustom(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
    if (modalId === 'modalRutasMasivo') {
        if (typeof detenerCamaraLiveMasiva === 'function') detenerCamaraLiveMasiva();
    }
}

// Cerrar cualquier modal al hacer clic en el fondo oscuro
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('custom-modal-backdrop')) {
        e.target.classList.remove('open');
        e.target.style.display = 'none';
    }
});
function showLoginModal(mensaje = null) {
    const modal = document.getElementById('loginModal') || document.getElementById('modalLogin');
    const appContainer = document.getElementById('app');

    // 1. Ocultar la aplicación completa para que nadie vea datos si no está autenticado
    if (appContainer) {
        appContainer.style.display = 'none';
    }

    // 2. Mostrar la pantalla de login fullscreen
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('open');

        const alertaBox = document.getElementById('loginAlertaExpiracion');
        const alertaTxt = document.getElementById('loginAlertaExpiracionTexto');
        if (alertaBox && alertaTxt) {
            if (mensaje) {
                alertaTxt.innerText = mensaje;
                alertaBox.style.display = 'block';
            } else {
                alertaBox.style.display = 'none';
            }
        }

        const passInput = document.getElementById('loginPassword');
        if (passInput) passInput.value = '';
    }
}
window.showLoginModal = showLoginModal;

function hideLoginModal() {
    const modal = document.getElementById('loginModal') || document.getElementById('modalLogin');
    const appContainer = document.getElementById('app');

    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
    }

    // Mostrar la aplicación principal una vez autenticado
    if (appContainer) {
        appContainer.style.display = 'block';
    }
}
window.hideLoginModal = hideLoginModal;

// --------------------------------------------------------------------------
// DETECCIÓN Y DIFERENCIACIÓN VISUAL DE AMBIENTE (DEV VS PROD)
// --------------------------------------------------------------------------
// DETECCIÓN DE AMBIENTE (DESHABILITADO: TÍTULO Y HEADER LIMPIOS)
async function detectarAmbienteYActualizarUI() {
    document.title = 'Rutas de Leche - Sistema de Transporte';
    document.body.classList.remove('env-dev-active');
    const badgeHeader = document.getElementById('envBadgeHeader');
    if (badgeHeader) badgeHeader.style.display = 'none';
    const badgeLogin = document.getElementById('envBadgeLogin');
    if (badgeLogin) badgeLogin.style.display = 'none';
}
window.detectarAmbienteYActualizarUI = detectarAmbienteYActualizarUI;

// Ejecutar inmediatamente al cargar el script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectarAmbienteYActualizarUI);
} else {
    detectarAmbienteYActualizarUI();
}

// INTERCEPTOR GLOBAL DE PETICIONES HTTP (AUTO-LOGOUT SI 401 / TOKEN EXPIRADO)
(function setupGlobalFetchInterceptor() {
    const _originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await _originalFetch.apply(this, args);
        if (response.status === 401) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (!url.includes('/auth/login')) {
                console.warn('Acceso no autorizado (401). El token ha expirado.');
                if (typeof window.cerrarSesion === 'function') {
                    window.cerrarSesion('Tu sesión ha expirado en el servidor. Inicia sesión nuevamente.');
                }
            }
        }
        return response;
    };
})();

// --------------------------------------------------------------------------
// COMPONENTE COMBOBOX / SELECTOR BUSCABLE REUTILIZABLE
// --------------------------------------------------------------------------
function setupCombobox({
    containerId,
    inputSearchId,
    inputHiddenId,
    dropdownId,
    placeholder = 'SELECCIONE...',
    getItemsFn,
    onSelect
}) {
    const container = document.getElementById(containerId);
    const inputSearch = document.getElementById(inputSearchId);
    const inputHidden = document.getElementById(inputHiddenId);
    const dropdown = document.getElementById(dropdownId);

    if (!container || !inputSearch || !inputHidden || !dropdown) {
        return {
            selectItem: (val, label) => {
                if (inputHidden) inputHidden.value = val || '';
                if (inputSearch) inputSearch.value = label || '';
            },
            setValue: (val, label) => {
                if (inputHidden) inputHidden.value = val || '';
                if (inputSearch) inputSearch.value = label || '';
            },
            reset: () => {
                if (inputHidden) inputHidden.value = '';
                if (inputSearch) inputSearch.value = '';
            },
            clear: () => {
                if (inputHidden) inputHidden.value = '';
                if (inputSearch) inputSearch.value = '';
            }
        };
    }

    let itemsCache = [];
    let highlightedIndex = -1;
    let userNavigatedDropdown = false;

    function highlightOption(index) {
        const itemElements = Array.from(dropdown.querySelectorAll('.combobox-item[data-value]'));
        if (itemElements.length === 0) return;

        if (index < 0) index = 0;
        if (index >= itemElements.length) index = itemElements.length - 1;

        highlightedIndex = index;
        itemElements.forEach((el, i) => {
            if (i === highlightedIndex) {
                el.classList.add('highlighted');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('highlighted');
            }
        });
    }

    function selectOptionElement(el) {
        if (!el) return;
        const val = el.getAttribute('data-value');
        const matched = itemsCache.find(it => String(it.value) === String(val));
        const rawLabel = matched ? matched.label : (el.querySelector('strong')?.innerText || '');
        const isPlaceholder = (val === '' && rawLabel === placeholder);
        const label = isPlaceholder ? rawLabel : capitalizarTexto(rawLabel);
        
        inputHidden.value = val;
        inputSearch.value = isPlaceholder ? '' : label;
        dropdown.style.display = 'none';

        const trParent = container.closest('tr');
        if (trParent) trParent.style.zIndex = '1';

        if (typeof onSelect === 'function') {
            onSelect(matched || { value: val, label });
        }
    }

    function renderDropdown(filterText = '', isFocus = false) {
        try {
            const rawItems = typeof getItemsFn === 'function' ? getItemsFn() : [];
            itemsCache = Array.isArray(rawItems) ? rawItems : [];
        } catch (err) {
            console.warn('Error obteniendo items para combobox:', err);
            itemsCache = [];
        }

        const q = (filterText || '').toLowerCase().trim();
        const filtered = q
            ? itemsCache.filter(it => 
                (it.label && String(it.label).toLowerCase().includes(q)) ||
                (it.sub && String(it.sub).toLowerCase().includes(q))
              )
            : itemsCache;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="combobox-item text-muted" style="padding: 14px 16px; color: #64748b; font-size: 13.5px; font-weight: 600; text-align: center; cursor: default;">No se encontraron resultados</div>';
            dropdown.style.display = 'block';
            highlightedIndex = -1;
            return;
        }

        dropdown.innerHTML = filtered.map(it => {
            const isSelected = String(inputHidden.value) === String(it.value);
            const isPlaceholder = (it.value === '' && it.label === placeholder);
            const displayLabel = isPlaceholder ? it.label : capitalizarTexto(it.label);
            const displaySub = it.sub ? (it.sub.startsWith('C.I:') ? `C.I: ${it.sub.replace(/^C\.I:\s*/i, '').trim()}` : capitalizarTexto(it.sub)) : '';
            return `
                <div class="combobox-item ${isSelected ? 'selected' : ''}" data-value="${it.value}">
                    <strong>${displayLabel}</strong>
                    ${displaySub ? `<small>${displaySub}</small>` : ''}
                </div>
            `;
        }).join('');

        const trParent = container.closest('tr');
        if (trParent) trParent.style.zIndex = '9999';

        dropdown.style.display = 'block';

        const selectedIdx = filtered.findIndex(it => String(it.value) === String(inputHidden.value));
        if (selectedIdx >= 0) {
            highlightedIndex = selectedIdx;
        } else {
            highlightedIndex = 0;
        }
        highlightOption(highlightedIndex);

        dropdown.querySelectorAll('.combobox-item[data-value]').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectOptionElement(el);
            });
        });
    }

    inputSearch.addEventListener('focus', () => {
        if (inputSearch.disabled || inputSearch.readOnly) return;
        userNavigatedDropdown = false;
        renderDropdown('', true);
        try { inputSearch.select(); } catch (e) {}
    });

    inputSearch.addEventListener('click', (e) => {
        if (inputSearch.disabled || inputSearch.readOnly) return;
        if (dropdown.style.display !== 'block') {
            userNavigatedDropdown = false;
            renderDropdown('');
        }
        try { inputSearch.select(); } catch (e) {}
    });

    container.addEventListener('click', (e) => {
        if (dropdown.contains(e.target)) return;
        if (chevron && chevron.contains(e.target)) return;
        if (inputSearch.disabled || inputSearch.readOnly) return;
        if (dropdown.style.display !== 'block') {
            userNavigatedDropdown = false;
            renderDropdown('');
            inputSearch.focus();
            try { inputSearch.select(); } catch (e) {}
        }
    });

    inputSearch.addEventListener('input', (e) => {
        if (inputSearch.disabled || inputSearch.readOnly) return;
        userNavigatedDropdown = true;
        renderDropdown(e.target.value);
    });

    inputSearch.addEventListener('keydown', (e) => {
        if (inputSearch.disabled || inputSearch.readOnly) return;
        const itemElements = Array.from(dropdown.querySelectorAll('.combobox-item[data-value]'));

        if (dropdown.style.display === 'none' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            userNavigatedDropdown = true;
            renderDropdown('');
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            userNavigatedDropdown = true;
            highlightOption(highlightedIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            userNavigatedDropdown = true;
            highlightOption(highlightedIndex - 1);
        } else if (e.key === 'Enter') {
            if (dropdown.style.display === 'block') {
                e.preventDefault();
                if (highlightedIndex >= 0 && itemElements[highlightedIndex]) {
                    selectOptionElement(itemElements[highlightedIndex]);
                } else if (itemElements.length > 0) {
                    selectOptionElement(itemElements[0]);
                }
            }
        } else if (e.key === 'Tab') {
            if (dropdown.style.display === 'block') {
                if (!e.shiftKey && userNavigatedDropdown && highlightedIndex >= 0 && itemElements[highlightedIndex]) {
                    selectOptionElement(itemElements[highlightedIndex]);
                }
                dropdown.style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    const chevron = container.querySelector('.combobox-chevron');
    if (chevron) {
        chevron.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inputSearch.disabled || inputSearch.readOnly) return;
            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            } else {
                inputSearch.focus();
                renderDropdown('');
                try { inputSearch.select(); } catch (e) {}
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
            const trParent = container.closest('tr');
            if (trParent) trParent.style.zIndex = '1';
        }
    });

    return {
        selectItem: (val, label) => {
            const isPlaceholder = (val === '' && label === placeholder);
            inputHidden.value = val || '';
            inputSearch.value = (isPlaceholder || !label) ? '' : capitalizarTexto(label);
        },
        setValue: (val, label) => {
            const isPlaceholder = (val === '' && label === placeholder);
            inputHidden.value = val || '';
            inputSearch.value = (isPlaceholder || !label) ? '' : capitalizarTexto(label);
        },
        reset: () => {
            inputHidden.value = '';
            inputSearch.value = '';
            dropdown.style.display = 'none';
        },
        clear: () => {
            inputHidden.value = '';
            inputSearch.value = '';
            dropdown.style.display = 'none';
        }
    };
}
window.setupCombobox = setupCombobox;

function initRutasFormComboboxes() {
    if (!comboboxConductorInstance && document.getElementById('comboboxConductor')) {
        comboboxConductorInstance = setupCombobox({
            containerId: 'comboboxConductor',
            inputSearchId: 'searchConductorInput',
            inputHiddenId: 'selectRutaConductor',
            dropdownId: 'dropdownConductorList',
            placeholder: 'SELECCIONE CONDUCTOR',
            getItemsFn: () => (state.choferes || []).map(c => ({
                value: c.id || c.Id,
                label: capitalizarTexto(c.nombreCompleto || c.NombreCompleto || c.username || c.Username),
                sub: (c.cedula || c.Cedula) ? `C.I: ${c.cedula || c.Cedula}` : ''
            }))
        });
    }

    if (!comboboxFincaInstance && document.getElementById('comboboxFinca')) {
        comboboxFincaInstance = setupCombobox({
            containerId: 'comboboxFinca',
            inputSearchId: 'searchFincaInput',
            inputHiddenId: 'selectFinca',
            dropdownId: 'dropdownFincaList',
            placeholder: 'SELECCIONE FINCA',
            getItemsFn: () => (state.fincas || [])
                .filter(f => f.activo !== false && f.Activo !== false)
                .map(f => {
                    const isAdmin = state.user?.rol === 'ADMIN';
                    const id = f.id || f.Id;
                    const nombre = capitalizarTexto(f.nombre || f.Nombre);
                    const prop = capitalizarTexto(f.propietario || f.Propietario);
                    return {
                        value: id,
                        label: (isAdmin && prop) ? `${nombre} (${prop})` : nombre,
                        sub: ''
                    };
                }),
            onSelect: (item) => {
                const selectTipo = document.getElementById('selectRutaTipoLeche');
                const groupTipo = document.getElementById('groupRutaTipoLeche') || (selectTipo ? selectTipo.closest('.form-group') : null);
                if (selectTipo && item) {
                    const matched = (state.fincas || []).find(f => (f.id || f.Id) == item.value);
                    const esDual = !!(matched?.tieneDosTiposLeche || matched?.TieneDosTiposLeche);

                    if (esDual) {
                        if (groupTipo) groupTipo.style.display = 'block';
                    } else {
                        if (groupTipo) groupTipo.style.display = 'none';
                        selectTipo.value = 'VACA';
                    }
                }
            }
        });
    }
}
window.initRutasFormComboboxes = initRutasFormComboboxes;

function initEntregasFormComboboxes() {
    if (!comboboxEntregaCompaniaInstance && document.getElementById('comboboxEntregaCompania')) {
        comboboxEntregaCompaniaInstance = setupCombobox({
            containerId: 'comboboxEntregaCompania',
            inputSearchId: 'searchEntregaCompaniaInput',
            inputHiddenId: 'selectEntregaCompania',
            dropdownId: 'dropdownEntregaCompaniaList',
            placeholder: 'SELECCIONE COMPAÑÍA / PLANTA',
            getItemsFn: () => (state.companias || [])
                .filter(cp => cp.activo !== false && cp.Activo !== false)
                .map(cp => ({
                    value: cp.id || cp.Id,
                    label: capitalizarTexto(cp.nombre || cp.Nombre),
                    sub: cp.encargado ? `Encargado: ${capitalizarTexto(cp.encargado)}` : ''
                }))
        });
    }

    if (!comboboxEntregaConductorInstance && document.getElementById('comboboxEntregaConductor')) {
        comboboxEntregaConductorInstance = setupCombobox({
            containerId: 'comboboxEntregaConductor',
            inputSearchId: 'searchEntregaConductorInput',
            inputHiddenId: 'selectEntregaConductor',
            dropdownId: 'dropdownEntregaConductorList',
            placeholder: 'SELECCIONE CONDUCTOR',
            getItemsFn: () => (state.choferes || [])
                .filter(c => c.activo !== false && c.Activo !== false)
                .map(c => ({
                    value: c.id || c.Id,
                    label: capitalizarTexto(c.nombreCompleto || c.NombreCompleto || c.username || c.Username),
                    sub: (c.cedula || c.Cedula) ? `C.I: ${c.cedula || c.Cedula}` : ''
                }))
        });
    }
}
window.initEntregasFormComboboxes = initEntregasFormComboboxes;

function isTokenExpirado(token) {
    if (!token || typeof token !== 'string') return true;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const payload = JSON.parse(jsonPayload);
        if (!payload.exp) return false;
        return (payload.exp * 1000) <= Date.now();
    } catch (e) {
        return true;
    }
}
window.isTokenExpirado = isTokenExpirado;

function cerrarSesion(mensaje = null) {
    if (sesionInactividadConfig && sesionInactividadConfig.timerInterval) {
        clearInterval(sesionInactividadConfig.timerInterval);
        sesionInactividadConfig.timerInterval = null;
    }
    if (sesionInactividadConfig) {
        sesionInactividadConfig.advertenciaActiva = false;
    }

    state.token = null;
    state.user = null;
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('activeTab');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeTab');
    try {
        history.replaceState(null, '', window.location.pathname);
    } catch(e) {}

    // Limpiar datos sensibles en memoria
    state.fincas = [];
    state.companias = [];
    state.choferes = [];
    state.rutas = [];
    state.entregas = [];

    // Cerrar cualquier modal que esté abierto en el fondo
    document.querySelectorAll('.custom-modal-backdrop, .modal-custom-overlay').forEach(m => {
        m.classList.remove('open');
        m.style.display = 'none';
    });

    if (Swal.isVisible()) {
        Swal.close();
    }

    // Ocultar toda la app y mostrar pantalla de Login
    showLoginModal(mensaje || 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
}
window.cerrarSesion = cerrarSesion;

function getAuthHeaders(extraHeaders = {}) {
    const token = (state && state.token) || sessionStorage.getItem('token') || localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...extraHeaders
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}
window.getAuthHeaders = getAuthHeaders;

function tienePermiso(codigo) {
    if (!state || !state.user) return false;
    const rol = (state.user.rol || '').toUpperCase();
    if (rol.includes('ADMIN') || rol === 'ADMINISTRADOR GENERAL') return true;
    const permisos = state.user.permisos || [];
    return permisos.includes(codigo);
}
window.tienePermiso = tienePermiso;

function aplicarPermisosEnInterfaz() {
    if (!state || !state.user) return;
    const rol = (state.user.rol || '').toUpperCase();
    const esAdmin = rol.includes('ADMIN') || rol === 'ADMINISTRADOR GENERAL';

    // 1. Visibilidad de Grupos de Menú
    const puedeOperaciones = esAdmin || tienePermiso('DASHBOARD_VER') || tienePermiso('RUTAS_VER') || tienePermiso('ENTREGAS_VER') || tienePermiso('BALANCE_LECHE_VER') || tienePermiso('CONTROL_RUTAS_VER') || tienePermiso('MERMAS_VER') || tienePermiso('TRAZABILIDAD_BUFALA_VER') || tienePermiso('RUTAS_PLANIFICACION_VER');
    const puedeCatalogos = esAdmin || tienePermiso('FINCAS_VER') || tienePermiso('PROPIETARIOS_VER') || tienePermiso('CONDUCTORES_VER') || tienePermiso('CAMIONES_VER') || tienePermiso('COMPANIAS_VER') || tienePermiso('BANCOS_VER') || tienePermiso('EMPRESA_VER');
    const puedeFlota = esAdmin || tienePermiso('COMBUSTIBLE_VER') || tienePermiso('HISTORIAL_CAMIONES_VER') || tienePermiso('REPUESTOS_VER');
    const puedeFinanzas = esAdmin || tienePermiso('CICLOS_VER') || tienePermiso('LIQUIDACIONES_VER') || tienePermiso('PAGOS_PERSONAL_VER') || tienePermiso('HISTORIAL_PAGOS_VER') || tienePermiso('ADMINISTRACION_VER');
    const puedeAdelantos = esAdmin || tienePermiso('ADELANTOS_FINCAS_VER') || tienePermiso('ADELANTOS_PERSONAL_VER') || tienePermiso('ABONOS_COMPANIAS_VER') || tienePermiso('ADELANTOS_RECEPTORIA_VER') || tienePermiso('ABONOS_VER') || tienePermiso('HISTORIAL_ADELANTOS_VER') || tienePermiso('ADELANTOS_VER');
    const puedeReportes = esAdmin || tienePermiso('REPORTES_VER') || tienePermiso('HISTORIAL_BCV_VER');
    const puedeSistema = esAdmin || tienePermiso('USUARIOS_VER') || tienePermiso('PERMISOS_VER') || tienePermiso('CONFIGURACION_VER') || tienePermiso('SESION_VER');

    const grpOperaciones = document.getElementById('grp-operaciones');
    if (grpOperaciones) grpOperaciones.style.setProperty('display', puedeOperaciones ? '' : 'none', 'important');

    const grpCatalogos = document.getElementById('grp-catalogos');
    if (grpCatalogos) grpCatalogos.style.setProperty('display', puedeCatalogos ? '' : 'none', 'important');

    const grpFlota = document.getElementById('grp-flota');
    if (grpFlota) grpFlota.style.setProperty('display', puedeFlota ? '' : 'none', 'important');

    const grpFinanzas = document.getElementById('grp-finanzas');
    if (grpFinanzas) grpFinanzas.style.setProperty('display', puedeFinanzas ? '' : 'none', 'important');

    const grpAdelantos = document.getElementById('grp-adelantos');
    if (grpAdelantos) grpAdelantos.style.setProperty('display', puedeAdelantos ? '' : 'none', 'important');

    const grpReportes = document.getElementById('grp-reportes');
    if (grpReportes) grpReportes.style.setProperty('display', puedeReportes ? '' : 'none', 'important');

    const grpSistema = document.getElementById('grp-sistema');
    if (grpSistema) grpSistema.style.setProperty('display', puedeSistema ? '' : 'none', 'important');

    // 2. BCV Widget y botones
    const bcvWidget = document.getElementById('bcvWidget');
    if (bcvWidget) bcvWidget.style.setProperty('display', (esAdmin || tienePermiso('HISTORIAL_BCV_VER')) ? '' : 'none', 'important');
    const btnSyncBcv = document.getElementById('btnSyncBcvApi');
    if (btnSyncBcv) btnSyncBcv.style.setProperty('display', (esAdmin || tienePermiso('HISTORIAL_BCV_CREAR')) ? '' : 'none', 'important');
    const btnEditarBcv = document.getElementById('btnEditarBcv');
    if (btnEditarBcv) btnEditarBcv.style.setProperty('display', (esAdmin || tienePermiso('HISTORIAL_BCV_EDITAR')) ? '' : 'none', 'important');

    // 3. Links individuales para cada sub-menú (Mapeo exhaustivo a permisología)
    const mapTabs = {
        // Operaciones
        'dashboard': esAdmin || tienePermiso('DASHBOARD_VER'),
        'rutas': esAdmin || tienePermiso('RUTAS_VER'),
        'receptoria': esAdmin || tienePermiso('ENTREGAS_VER'),
        'balance-receptoria': esAdmin || tienePermiso('BALANCE_LECHE_VER'),
        'control-rutas': esAdmin || tienePermiso('CONTROL_RUTAS_VER') || tienePermiso('RUTAS_VER'),
        'mermas': esAdmin || tienePermiso('MERMAS_VER') || tienePermiso('REPORTES_VER'),
        'trazabilidad-bufala': esAdmin || tienePermiso('TRAZABILIDAD_BUFALA_VER') || tienePermiso('RUTAS_VER'),
        'rutas-planificacion': esAdmin || tienePermiso('RUTAS_PLANIFICACION_VER') || tienePermiso('RUTAS_VER'),

        // Catálogos & Flota
        'fincas': esAdmin || tienePermiso('FINCAS_VER'),
        'propietarios': esAdmin || tienePermiso('PROPIETARIOS_VER') || tienePermiso('FINCAS_VER'),
        'conductores': esAdmin || tienePermiso('CONDUCTORES_VER'),
        'camiones': esAdmin || tienePermiso('CAMIONES_VER') || tienePermiso('CONDUCTORES_VER'),
        'companias': esAdmin || tienePermiso('COMPANIAS_VER'),
        'bancos': esAdmin || tienePermiso('BANCOS_VER'),
        'empresa': esAdmin || tienePermiso('EMPRESA_VER'),

        // Flota & Mantenimiento
        'combustible': esAdmin || tienePermiso('COMBUSTIBLE_VER') || tienePermiso('CAMIONES_VER'),
        'historial-camiones': esAdmin || tienePermiso('HISTORIAL_CAMIONES_VER') || tienePermiso('CAMIONES_VER'),
        'repuestos': esAdmin || tienePermiso('REPUESTOS_VER') || tienePermiso('CAMIONES_VER'),

        // Liquidación
        'semanas': esAdmin || tienePermiso('CICLOS_VER'),
        'liquidacion': esAdmin || tienePermiso('LIQUIDACIONES_VER'),
        'pagos-usuarios': esAdmin || tienePermiso('PAGOS_PERSONAL_VER') || tienePermiso('LIQUIDACIONES_VER'),
        'historial-pagos': esAdmin || tienePermiso('HISTORIAL_PAGOS_VER') || tienePermiso('LIQUIDACIONES_VER'),
        'administracion': esAdmin || tienePermiso('ADMINISTRACION_VER') || tienePermiso('LIQUIDACIONES_VER'),

        // Adelantos
        'adelantos-fincas': esAdmin || tienePermiso('ADELANTOS_FINCAS_VER') || tienePermiso('ADELANTOS_VER'),
        'adelantos-usuarios': esAdmin || tienePermiso('ADELANTOS_PERSONAL_VER') || tienePermiso('ADELANTOS_VER'),
        'abonos-companias': esAdmin || tienePermiso('ABONOS_COMPANIAS_VER') || tienePermiso('ADELANTOS_VER'),
        'adelantos-receptoria': esAdmin || tienePermiso('ADELANTOS_RECEPTORIA_VER') || tienePermiso('ADELANTOS_VER'),
        'abonos': esAdmin || tienePermiso('ABONOS_VER') || tienePermiso('ADELANTOS_VER'),
        'historial-adelantos': esAdmin || tienePermiso('HISTORIAL_ADELANTOS_VER') || tienePermiso('ADELANTOS_VER'),

        // Reportes
        'reportes': esAdmin || tienePermiso('REPORTES_VER'),
        'historial-bcv': esAdmin || tienePermiso('HISTORIAL_BCV_VER'),

        // Sistema
        'usuarios': esAdmin || tienePermiso('USUARIOS_VER') || tienePermiso('USUARIOS_SEGURIDAD_VER'),
        'permisos': esAdmin || tienePermiso('PERMISOS_VER'),
        'configuracion-sistema': esAdmin || tienePermiso('CONFIGURACION_VER'),
        'configuracion-sesion': esAdmin || tienePermiso('SESION_VER')
    };

    Object.keys(mapTabs).forEach(tab => {
        const permitido = mapTabs[tab];
        const el = document.querySelector(`.sidebar a[data-tab="${tab}"]`);
        if (el) el.style.setProperty('display', permitido ? '' : 'none', 'important');
        const mob = document.querySelector(`.mobile-nav a[data-tab="${tab}"], .mobile-nav-item[data-tab="${tab}"]`);
        if (mob) mob.style.setProperty('display', permitido ? '' : 'none', 'important');
    });

    // 4. Modo Chofer / Operador
    const esChofer = rol === 'CHOFER' && !esAdmin;
    const formGroupConductor = document.getElementById('formGroupRutaConductor');
    if (formGroupConductor) formGroupConductor.style.display = esChofer ? 'none' : 'block';

    const btnCargaMasivaHeader = document.getElementById('btnCargaMasivaHeaderRutas');
    if (btnCargaMasivaHeader) btnCargaMasivaHeader.style.setProperty('display', esChofer ? 'none' : '', 'important');

    const btnCargaMasivaForm = document.getElementById('btnCargaMasivaFormChofer');
    if (btnCargaMasivaForm) btnCargaMasivaForm.style.setProperty('display', esChofer ? 'inline-flex' : 'none', 'important');

    if (esChofer) {
        const selectCondHidden = document.getElementById('selectRutaConductor');
        if (selectCondHidden) selectCondHidden.value = state.user.id;
        const lblModoVista = document.getElementById('lblTextoModoVista');
        if (lblModoVista) lblModoVista.style.display = 'none';
        if (typeof conmutarVistaRutas === 'function') conmutarVistaRutas('fincas');
        if (typeof configurarReportesParaRol === 'function') configurarReportesParaRol('CHOFER');
    } else {
        const lblModoVista = document.getElementById('lblTextoModoVista');
        if (lblModoVista) lblModoVista.style.display = '';
        if (typeof configurarReportesParaRol === 'function') configurarReportesParaRol('ADMIN');
    }
}
window.aplicarPermisosEnInterfaz = aplicarPermisosEnInterfaz;

async function verificarSesionPersistente() {
    const tokenGuardado = sessionStorage.getItem('token') || localStorage.getItem('token');

    if (!tokenGuardado || isTokenExpirado(tokenGuardado)) {
        cerrarSesion(tokenGuardado ? 'Tu sesión anterior ha expirado. Inicia sesión.' : null);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${tokenGuardado}` }
        });

        if (res.ok) {
            const userData = await res.json();
            state.token = tokenGuardado;
            state.user = userData;
            sessionStorage.setItem('token', tokenGuardado);
            sessionStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('token', tokenGuardado);
            localStorage.setItem('user', JSON.stringify(userData));
            hideLoginModal();
            onUserAuthenticated(userData, false);
            iniciarMonitorInactividad();
        } else {
            cerrarSesion('Tu sesión ha expirado en el servidor. Inicia sesión de nuevo.');
        }
    } catch (err) {
        console.warn('Error al verificar sesion persistente:', err);
        cerrarSesion();
    }
}

function initAuth() {
    const loginForm = document.getElementById('formLogin') || document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = (document.getElementById('loginUsername')?.value || '').trim();
            const password = document.getElementById('loginPassword')?.value || '';
            const btnSubmit = document.getElementById('btnLoginSubmit') || e.target.querySelector('button[type="submit"]');
            const originalText = btnSubmit ? btnSubmit.innerHTML : 'Ingresar';

            if (btnSubmit) {
                btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
                btnSubmit.disabled = true;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (res.ok) {
                    state.token = data.token;
                    state.user = data;
                    const userMin = {
                        id: data.id,
                        username: data.username,
                        nombreCompleto: data.nombreCompleto,
                        rol: data.rol,
                        permisos: data.permisos
                    };
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('user', JSON.stringify(userMin));
                    sessionStorage.setItem('activeTab', 'dashboard');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(userMin));
                    localStorage.setItem('activeTab', 'dashboard');
                    try {
                        history.replaceState(null, '', '#dashboard');
                    } catch(e) {}

                    hideLoginModal();
                    onUserAuthenticated(data, true);
                    iniciarMonitorInactividad();
                    showToast(`¡Bienvenido, ${data.nombreCompleto || data.username}!`);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de Acceso',
                        text: data.message || 'Usuario o contraseña incorrectos',
                        background: '#1e293b',
                        color: '#fff'
                    });
                }
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de Conexión',
                    text: 'No se pudo conectar con el servidor backend.',
                    background: '#1e293b',
                    color: '#fff'
                });
            } finally {
                if (btnSubmit) {
                    btnSubmit.innerHTML = originalText;
                    btnSubmit.disabled = false;
                }
            }
        });
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            Swal.fire({
                title: '¿Cerrar Sesión?',
                text: '¿Estás seguro de que deseas salir del sistema?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, Salir',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#e11d48',
                cancelButtonColor: '#64748b',
                background: '#1e293b',
                color: '#fff'
            }).then((res) => {
                if (res.isConfirmed) {
                    cerrarSesion('Has cerrado sesión correctamente.');
                }
            });
        });
    }
}

// --------------------------------------------------------------------------
// MODULO DE CONTROL DE INACTIVIDAD Y CONFIGURACION DE SESION
// --------------------------------------------------------------------------
var sesionInactividadConfig = window.sesionInactividadConfig || {
    minutosTimeout: parseInt(localStorage.getItem('app_session_timeout') ?? '10'),
    avisoPrevio: localStorage.getItem('app_session_warning') !== 'false',
    ultimaActividad: Date.now(),
    timerInterval: null,
    advertenciaActiva: false
};
window.sesionInactividadConfig = sesionInactividadConfig;

function registrarActividadUsuario() {
    sesionInactividadConfig.ultimaActividad = Date.now();
    if (sesionInactividadConfig.advertenciaActiva && Swal.isVisible()) {
        sesionInactividadConfig.advertenciaActiva = false;
        Swal.close();
    }
}

function iniciarMonitorInactividad() {
    const eventos = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    eventos.forEach(evt => {
        window.removeEventListener(evt, registrarActividadUsuario);
        window.addEventListener(evt, registrarActividadUsuario, { passive: true });
    });

    if (sesionInactividadConfig.timerInterval) {
        clearInterval(sesionInactividadConfig.timerInterval);
    }

    sesionInactividadConfig.ultimaActividad = Date.now();

    sesionInactividadConfig.timerInterval = setInterval(() => {
        if (!state.token || !state.user) return;

        // 1. Verificar si el token JWT expiró
        if (isTokenExpirado(state.token)) {
            cerrarSesion('Tu credencial de sesión ha expirado. Inicia sesión nuevamente.');
            return;
        }

        // 2. Control de tiempo de inactividad
        const minutos = sesionInactividadConfig.minutosTimeout;
        if (minutos <= 0) return; // Desactivado

        const tiempoMaximoMs = minutos * 60 * 1000;
        const tiempoInactivo = Date.now() - sesionInactividadConfig.ultimaActividad;
        const tiempoRestante = tiempoMaximoMs - tiempoInactivo;

        // Aviso previo 30 segundos antes
        if (sesionInactividadConfig.avisoPrevio && tiempoRestante <= 30000 && tiempoRestante > 0) {
            if (!sesionInactividadConfig.advertenciaActiva) {
                sesionInactividadConfig.advertenciaActiva = true;
                mostrarAlertaInactividad(Math.ceil(tiempoRestante / 1000));
            }
        }

        // Tiempo cumplido: cierre de sesión
        if (tiempoRestante <= 0) {
            cerrarSesion(`Tu sesión se ha cerrado automáticamente por inactividad (${minutos} minutos sin uso).`);
        }
    }, 1000);
}

function mostrarAlertaInactividad(segundosRestantes) {
    let timerInterval;
    Swal.fire({
        title: '¿Sigues ahí?',
        html: `Tu sesión se cerrará en <strong id="swalSegundosInactividad" style="color: #f87171; font-size: 18px;">${segundosRestantes}</strong> segundos por inactividad.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-rotate-right"></i> Continuar Sesión',
        cancelButtonText: 'Cerrar Sesión Ahora',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff',
        timer: segundosRestantes * 1000,
        timerProgressBar: true,
        didOpen: () => {
            const b = document.getElementById('swalSegundosInactividad');
            timerInterval = setInterval(() => {
                const ms = Swal.getTimerLeft();
                if (b && ms) {
                    b.textContent = Math.ceil(ms / 1000);
                }
            }, 500);
        },
        willClose: () => {
            clearInterval(timerInterval);
        }
    }).then((result) => {
        if (result.isConfirmed) {
            registrarActividadUsuario();
            sesionInactividadConfig.advertenciaActiva = false;
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            cerrarSesion('Sesión cerrada manualmente.');
        }
    });
}

function abrirModalConfiguracionSesion(e) {
    if (e && e.preventDefault) e.preventDefault();

    const select = document.getElementById('selectTiempoInactividad');
    const chk = document.getElementById('chkAvisoPrevioSesion');
    const lblEstado = document.getElementById('lblEstadoInactividadActual');

    const min = sesionInactividadConfig.minutosTimeout;
    if (select) select.value = min.toString();
    if (chk) chk.checked = sesionInactividadConfig.avisoPrevio;
    if (lblEstado) {
        lblEstado.innerText = min > 0 ? `Activo (${min} min)` : 'Desactivado (Permanente)';
        lblEstado.style.color = min > 0 ? '#34d399' : '#fbbf24';
    }

    abrirModalCustom('modalConfiguracionSesionCustom');
}
window.abrirModalConfiguracionSesion = abrirModalConfiguracionSesion;

function guardarConfiguracionSesion(e) {
    e.preventDefault();
    const select = document.getElementById('selectTiempoInactividad');
    const chk = document.getElementById('chkAvisoPrevioSesion');

    const nuevosMinutos = parseInt(select?.value ?? '10');
    const nuevoAviso = chk ? chk.checked : true;

    sesionInactividadConfig.minutosTimeout = nuevosMinutos;
    sesionInactividadConfig.avisoPrevio = nuevoAviso;
    sesionInactividadConfig.ultimaActividad = Date.now();

    localStorage.setItem('app_session_timeout', nuevosMinutos.toString());
    localStorage.setItem('app_session_warning', nuevoAviso.toString());

    cerrarModalCustom('modalConfiguracionSesionCustom');

    const msg = nuevosMinutos > 0 ? `Tiempo de sesión configurado a ${nuevosMinutos} minutos.` : 'Cierre automático de sesión desactivado.';
    showToast(msg);
}
window.guardarConfiguracionSesion = guardarConfiguracionSesion;

function onUserAuthenticated(user, isFreshLogin = false) {
    if (localStorage.getItem('pagosRealizados_cache')) {
        localStorage.removeItem('pagosRealizados_cache');
    }
    iniciarMonitorInactividad();
    if (!user) return;

    const elName = document.getElementById('userNameLabel') || document.getElementById('userDisplayName');
    if (elName) elName.innerText = user.nombreCompleto || user.username || 'Usuario';

    const elRole = document.getElementById('userRoleBadge') || document.getElementById('userDisplayRole');
    if (elRole) elRole.innerText = user.rol || 'USUARIO';

    const elAvatar = document.getElementById('userAvatar');
    if (elAvatar && user.nombreCompleto) {
        elAvatar.innerText = user.nombreCompleto.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    const badgeRolCap = document.getElementById('badgeRolCaptura');
    if (badgeRolCap) {
        badgeRolCap.innerText = user.rol === 'ADMIN' ? 'ROL: ADMINISTRADOR (TODOS)' : `CHOFER: ${user.nombreCompleto || user.username}`;
    }

    // Aplicar visibilidad y permisos dinámicos según RBAC
    aplicarPermisosEnInterfaz();

    cargarTasaBcv();
    cargarCicloActivo();
    cargarCatalogos();
    initBcvSyncButton();

    initNavigation();

    // Si la URL contiene un hash específico (ej. al abrir en nueva pestaña con clic derecho), respetarlo
    let targetTab = 'dashboard';
    const urlHash = (window.location.hash || '').replace(/^#/, '').trim();
    if (urlHash && document.getElementById('tab-' + urlHash)) {
        targetTab = urlHash;
    } else if (!isFreshLogin) {
        targetTab = (sessionStorage.getItem('activeTab') || localStorage.getItem('activeTab')) || 'dashboard';
    }

    irAPestana(targetTab, false);
}

function toggleMobileSidebar(forceState) {
    const sidebar = document.getElementById('mainSidebar') || document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('open');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

    if (shouldOpen) {
        // Cerrar modales que bloqueen la pantalla al abrir el menú lateral
        document.querySelectorAll('.modal-custom-overlay.open, .modal-custom-overlay[style*="display: flex"]').forEach(m => {
            m.style.display = 'none';
            m.classList.remove('open');
        });
        if (typeof Swal !== 'undefined' && Swal.isVisible()) {
            Swal.close();
        }

        sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
    } else {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    }
}
window.toggleMobileSidebar = toggleMobileSidebar;

// Permite alternar apertura y cierre (colapsar) por clic/touch
function toggleAccordionClick(groupId) {
    const targetGroup = typeof groupId === 'string' ? document.getElementById(groupId) : groupId;
    if (!targetGroup) return;

    const isCurrentlyOpen = (targetGroup.classList.contains('open') || targetGroup.classList.contains('has-active')) && !targetGroup.classList.contains('collapsed');

    if (isCurrentlyOpen) {
        targetGroup.classList.add('collapsed');
        targetGroup.classList.remove('open');
        targetGroup.classList.remove('has-active');
    } else {
        targetGroup.classList.remove('collapsed');
        targetGroup.classList.add('open');
    }
}
window.toggleAccordionClick = toggleAccordionClick;

function irAPestana(tabId, updateUrlOrEvent = true) {
    if (!tabId) return;
    if (updateUrlOrEvent && typeof updateUrlOrEvent.preventDefault === 'function') {
        updateUrlOrEvent.preventDefault();
    }

    let cleanTabId = tabId.replace(/^#/, '').replace(/^tab-/, '');

    // Seguridad de roles: El rol CHOFER solo puede acceder a 'dashboard', 'rutas' o 'reportes'
    if (state.user && state.user.rol === 'CHOFER') {
        if (cleanTabId !== 'dashboard' && cleanTabId !== 'rutas' && cleanTabId !== 'reportes') {
            cleanTabId = 'rutas';
        }
    }
    const targetSection = document.getElementById('tab-' + cleanTabId);
    if (!targetSection) {
        console.warn('Sección de pestaña no encontrada: tab-' + cleanTabId);
        return;
    }

    // Cerrar sidebar móvil al cambiar de pestaña
    toggleMobileSidebar(false);

    // Limpiar estado has-active de todos los grupos de acordeón
    document.querySelectorAll('.nav-accordion-group').forEach(grp => {
        grp.classList.remove('has-active');
    });

    // Quitar clase activa de todos los links de navegación (Sidebar y Mobile Bottom Nav)
    const navLinks = document.querySelectorAll('.nav-item[data-tab], .nav-link[data-tab], .mobile-nav-item[data-tab]');
    navLinks.forEach(l => {
        if (l.getAttribute('data-tab') === cleanTabId) {
            l.classList.add('active');
            // Marcar el grupo padre como has-active y des-colapsarlo
            const parentGroup = l.closest('.nav-accordion-group');
            if (parentGroup) {
                parentGroup.classList.remove('collapsed');
                parentGroup.classList.add('has-active');
            }
        } else {
            l.classList.remove('active');
        }
    });

    // Cambiar la sección activa
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });
    targetSection.classList.add('active');

    // Guardar pestaña en sessionStorage, localStorage y URL hash para persistencia tras F5 y nuevas pestañas
    sessionStorage.setItem('activeTab', cleanTabId);
    localStorage.setItem('activeTab', cleanTabId);
    if (window.location.hash !== '#' + cleanTabId) {
        try {
            history.replaceState(null, '', window.location.pathname + '#' + cleanTabId);
        } catch(e) {
            try { window.location.hash = '#' + cleanTabId; } catch(err) {}
        }
    }

    // Resetear posición de scroll para que la pestaña inicie arriba al lado del menú
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const contentAreaElem = document.querySelector('.content-area');
    if (contentAreaElem) contentAreaElem.scrollTop = 0;

    // Cargar datos según la pestaña activa
    if (cleanTabId === 'dashboard') {
        cargarTasaBcv();
        cargarCicloActivo();
        setTimeout(() => { cargarDashboard(); }, 60);
    } else if (cleanTabId === 'rutas') {
        const modoGuardado = sessionStorage.getItem('rutasModoVista');
        const modoInicial = (state.user && state.user.rol === 'CHOFER') ? 'fincas' : (modoGuardado || state.vistaRutasModo || 'viajes');
        if (typeof conmutarVistaRutas === 'function') {
            conmutarVistaRutas(modoInicial);
        } else {
            cargarRutasHoy();
        }
        if (typeof cargarViajesRutasDelDia === 'function') cargarViajesRutasDelDia();
        if (typeof cargarViajeActivoChofer === 'function') cargarViajeActivoChofer();
    } else if (cleanTabId === 'receptoria' || cleanTabId === 'entregas') {
        cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
    } else if (cleanTabId === 'control-rutas') {
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
    } else if (cleanTabId === 'mermas') {
        cargarMermas();
    } else if (cleanTabId === 'semanas') {
        cargarSemanas();
    } else if (cleanTabId === 'liquidaciones' || cleanTabId === 'liquidacion') {
        cargarPreLiquidacion();
    } else if (cleanTabId === 'historial-pagos') {
        cargarHistorialPagosLiquidacion();
    } else if (cleanTabId === 'fincas') {
        cargarFincasCat();
    } else if (cleanTabId === 'companias') {
        cargarCompaniasCat();
    } else if (cleanTabId === 'bancos') {
        cargarBancosCat();
    } else if (cleanTabId === 'propietarios') {
        cargarPropietarios();
    } else if (cleanTabId === 'conductores') {
        cargarConductoresCat();
    } else if (cleanTabId === 'camiones') {
        cargarCamionesCat();
    } else if (cleanTabId === 'usuarios') {
        cargarUsuariosCat();
        cargarRolesUsuarios();
    } else if (cleanTabId === 'historial-bcv') {
        cargarHistorialBcv();
    } else if (cleanTabId === 'adelantos-fincas') {
        cargarAdelantosFincas();
    } else if (cleanTabId === 'abonos-companias') {
        cargarAbonosCompanias();
    } else if (cleanTabId === 'adelantos-receptoria') {
        cargarAdelantosReceptoria();
    } else if (cleanTabId === 'historial-adelantos') {
        cargarHistorialAdelantos();
    } else if (cleanTabId === 'reportes') {
        inicializarModuloReportes();
    } else if (cleanTabId === 'balance-receptoria') {
        cargarBalanceReceptoria();
    } else if (cleanTabId === 'pagos-usuarios') {
        cargarModuloPagosUsuarios();
    } else if (cleanTabId === 'adelantos-usuarios' || cleanTabId === 'prestamos-personal' || cleanTabId === 'adelantos-personal') {
        cargarAdelantosUsuarios();
    } else if (cleanTabId === 'permisos' || cleanTabId === 'modulos-permisos') {
        cargarModuloPermisos();
    } else if (cleanTabId === 'trazabilidad-bufala') {
        cargarTrazabilidadBufala();
    } else if (cleanTabId === 'empresa' || cleanTabId === 'datos-empresa') {
        cargarEmpresaConfig();
    } else if (cleanTabId === 'administracion' || cleanTabId === 'administracion-general') {
        cargarAdministracionGeneral();
    } else if (cleanTabId === 'configuracion-sistema' || cleanTabId === 'parametros-sistema' || cleanTabId === 'parametrizacion') {
        cargarModuloConfiguracionSistema();
    }
}
window.irAPestana = irAPestana;

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-item[data-tab], .nav-link[data-tab]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            if (tabId && tabId !== 'configuracion-sesion') {
                irAPestana(tabId);
            }
        });
    });

    window.addEventListener('hashchange', () => {
        const hashTab = window.location.hash.replace('#', '');
        if (hashTab) {
            irAPestana(hashTab, false);
        }
    });

    initBcvSyncButton();
}

function cargarConductoresCat() {
    const tbody = document.getElementById('tbodyConductoresList');
    if (!tbody) return;

    if (!state.choferes || state.choferes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay conductores registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = state.choferes.map(c => {
        const id = c.id || c.Id;
        const nombre = c.nombreCompleto || c.NombreCompleto || c.username || c.Username;
        const username = c.username || c.Username;
        const cedula = c.cedula || c.Cedula || 'N/A';
        const placa = c.vehiculoPlaca || c.VehiculoPlaca || '-';

        return `
            <tr>
                <td><span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; border: 1px solid #cbd5e1;">#${id}</span></td>
                <td><strong style="color: #0f172a; font-size: 14px; font-weight: 700;">${nombre}</strong></td>
                <td><span style="color: #2563eb; font-weight: 700; font-size: 13px;">@${username}</span></td>
                <td><span style="color: #334155; font-size: 13px; font-weight: 600;">${cedula}</span></td>
                <td><span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700;">${placa}</span></td>
                <td><span class="badge badge-success" style="font-size: 11.5px;"><i class="fa-solid fa-circle-check"></i> Activo</span></td>
            </tr>
        `;
    }).join('');
}
// --------------------------------------------------------------------------
// MODULO TASA BCV & HISTORIAL
// --------------------------------------------------------------------------
async function cargarTasaBcv() {
    try {
        const res = await fetch(`${API_BASE}/bcv/hoy`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) return;

        const resJson = await res.json();
        const bcv = resJson.data || resJson;

        if (bcv && bcv.tasaDolarBs) {
            state.tasaBcv = bcv.tasaDolarBs;
            const tasaFormatted = Number(bcv.tasaDolarBs).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

            const elHeader = document.getElementById('bcvHoyTexto') || document.getElementById('headerTasaBcv');
            if (elHeader) elHeader.innerText = `Bs. ${tasaFormatted}`;

            const elKpi = document.getElementById('kpiTasaBcv') || document.getElementById('cardTasaBcv');
            if (elKpi) elKpi.innerHTML = `${tasaFormatted} <small>Bs/$</small>`;
            
            const elFuente = document.getElementById('kpiTasaFuente') || document.getElementById('cardTasaBcvFecha');
            if (elFuente) {
                const fechaStr = bcv.fecha ? bcv.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
                const esHoy = resJson.tieneTasaHoy !== false;
                elFuente.innerText = `${bcv.fuente || 'Fuente Oficial BCV'} (${fechaStr})${esHoy ? '' : ' - Última Registrada'}`;
            }
        }
    } catch (err) {
        console.warn('Error al cargar tasa BCV:', err);
    }
}
window.cargarTasaBcv = cargarTasaBcv;

// --------------------------------------------------------------------------
// MÓDULO TASA BCV & HISTORIAL (REACTIVO & SINCRONIZACIÓN EN VIVO)
// --------------------------------------------------------------------------
// MÓDULO TASA BCV & HISTORIAL (REACTIVO, SINCRONIZACIÓN, CREACIÓN, EDICIÓN Y ELIMINACIÓN)
// --------------------------------------------------------------------------
var historialBcvData = window.historialBcvData || [];
var historialBcvFiltro = window.historialBcvFiltro || '';
var historialBcvPage = window.historialBcvPage || 1;
var historialBcvPageSize = window.historialBcvPageSize || 12;

async function sincronizarTasaBcvDesdeApi(btnElement) {
    if (!state.token) {
        showToast('Debes iniciar sesión para sincronizar la tasa BCV', 'warning');
        return;
    }

    const btn = btnElement || document.getElementById('btnSyncBcvApi');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    try {
        let tasaOficial = 0;
        let fechaActualizacion = new Date().toISOString();
        let fuenteNombre = 'DolarAPI (BCV)';

        try {
            const resp = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.promedio > 0) {
                    tasaOficial = Number(data.promedio);
                    if (data.fechaActualizacion) fechaActualizacion = data.fechaActualizacion;
                }
            }
        } catch (e1) {
            console.warn('Fallo primario DolarAPI, probando alternativa...', e1);
        }

        if (tasaOficial <= 0) {
            try {
                const resp2 = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv', { cache: 'no-store' });
                if (resp2.ok) {
                    const data2 = await resp2.json();
                    if (data2 && data2.monitors && data2.monitors.usd && data2.monitors.usd.price > 0) {
                        tasaOficial = Number(data2.monitors.usd.price);
                        fuenteNombre = 'PyDolarVE (BCV)';
                    }
                }
            } catch (e2) {
                console.warn('Fallo respaldo PyDolarVE:', e2);
            }
        }

        if (tasaOficial <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Servicio en Línea no Disponible',
                text: 'No se pudo consultar automáticamente la API externa en este momento. Puedes registrar la tasa manualmente.',
                background: '#1e293b',
                color: '#fff'
            });
            return;
        }

        const regRes = await fetch(`${API_BASE}/bcv`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha: new Date().toISOString().split('T')[0],
                tasaDolarBs: tasaOficial,
                fuente: fuenteNombre,
                observacion: `Tasa oficial en vivo sincronizada el ${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE')}`
            })
        });

        if (regRes.ok) {
            state.tasaBcv = tasaOficial;
            await cargarTasaBcv();
            await cargarHistorialBcv();
            if (typeof cargarDashboard === 'function') cargarDashboard();

            const tasaFmt = Number(tasaOficial).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
            Swal.fire({
                icon: 'success',
                title: 'Tasa BCV Sincronizada',
                html: `Se registró la tasa oficial en vivo:<br><strong style="font-size: 22px; color: #34d399;">Bs. ${tasaFmt}</strong><br><small style="color: #94a3b8;">${fuenteNombre}</small>`,
                background: '#1e293b',
                color: '#fff',
                timer: 3000,
                showConfirmButton: false
            });
        } else {
            const errData = await regRes.json().catch(() => ({}));
            throw new Error(errData.message || 'Error guardando en el servidor');
        }
    } catch (err) {
        console.error('Error sincronizando BCV:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Sincronización',
            text: err.message || 'Ocurrió un error al sincronizar la tasa BCV.',
            background: '#1e293b',
            color: '#fff'
        });
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}
window.sincronizarTasaBcvDesdeApi = sincronizarTasaBcvDesdeApi;

function abrirModalCrearTasaBcv() {
    if (!state.token) {
        showToast('Debes iniciar sesión para registrar tasas BCV', 'warning');
        return;
    }

    const modalId = document.getElementById('modalBcvId');
    const inputFecha = document.getElementById('modalBcvFecha');
    const inputTasa = document.getElementById('modalBcvTasa');
    const inputFuente = document.getElementById('modalBcvFuente');
    const inputObs = document.getElementById('modalBcvObservacion');
    const title = document.getElementById('modalBcvTitle');
    const subtitle = document.getElementById('modalBcvSubtitle');

    if (modalId) modalId.value = '';
    if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];
    if (inputTasa) inputTasa.value = state.tasaBcv > 0 ? state.tasaBcv : '';
    if (inputFuente) inputFuente.value = 'BANCO CENTRAL DE VENEZUELA (BCV)';
    if (inputObs) inputObs.value = 'Registro manual oficial';
    if (title) title.innerText = 'Registrar Tasa Oficial BCV';
    if (subtitle) subtitle.innerText = 'Tasa de cambio USD / VES oficial del Banco Central';

    abrirModalCustom('modalBcvCustom');
}
window.abrirModalCrearTasaBcv = abrirModalCrearTasaBcv;
window.abrirModalActualizarBcv = abrirModalCrearTasaBcv;
window.abrirModalRegistrarBcv = abrirModalCrearTasaBcv;

function abrirModalEditarTasaBcv(id) {
    if (!state.token) {
        showToast('Debes iniciar sesión para editar tasas BCV', 'warning');
        return;
    }

    const item = historialBcvData.find(h => (h.id || h.Id) == id);
    if (!item) {
        showToast('No se encontró el registro de la tasa seleccionada.', 'error');
        return;
    }

    const modalId = document.getElementById('modalBcvId');
    const inputFecha = document.getElementById('modalBcvFecha');
    const inputTasa = document.getElementById('modalBcvTasa');
    const inputFuente = document.getElementById('modalBcvFuente');
    const inputObs = document.getElementById('modalBcvObservacion');
    const title = document.getElementById('modalBcvTitle');
    const subtitle = document.getElementById('modalBcvSubtitle');

    const f = item.fecha || item.Fecha || '';
    const fechaStr = f ? f.split('T')[0] : '';
    const valorTasa = item.tasaDolarBs ?? item.TasaDolarBs ?? 0;

    if (modalId) modalId.value = id;
    if (inputFecha) inputFecha.value = fechaStr;
    if (inputTasa) inputTasa.value = valorTasa;
    if (inputFuente) inputFuente.value = item.fuente || item.Fuente || 'BANCO CENTRAL DE VENEZUELA (BCV)';
    if (inputObs) inputObs.value = item.observacion || item.Observacion || '';
    if (title) title.innerText = `Modificar Tasa BCV (#${id})`;
    if (subtitle) subtitle.innerText = `Actualizando valor de la fecha ${fechaStr}`;

    abrirModalCustom('modalBcvCustom');
}
window.abrirModalEditarTasaBcv = abrirModalEditarTasaBcv;

async function guardarBcvSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const id = document.getElementById('modalBcvId')?.value;
    const fecha = document.getElementById('modalBcvFecha')?.value;
    const tasaVal = parseFloat(document.getElementById('modalBcvTasa')?.value);
    const fuente = (document.getElementById('modalBcvFuente')?.value || 'BANCO CENTRAL DE VENEZUELA (BCV)').trim();
    const observacion = (document.getElementById('modalBcvObservacion')?.value || '').trim();

    if (!fecha) {
        Swal.fire({ icon: 'warning', title: 'Fecha requerida', text: 'Por favor selecciona la fecha de vigencia.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (isNaN(tasaVal) || tasaVal <= 0) {
        Swal.fire({ icon: 'warning', title: 'Tasa inválida', text: 'Ingresa un valor numérico de tasa mayor a 0.', background: '#1e293b', color: '#fff' });
        return;
    }

    const isEdit = Boolean(id);

    // Validar si ya existe una tasa para la fecha indicada cuando se crea un registro nuevo
    if (!isEdit && historialBcvData && historialBcvData.length > 0) {
        const registroExistente = historialBcvData.find(h => {
            const hFecha = (h.fecha || h.Fecha || '').split('T')[0];
            return hFecha === fecha;
        });

        if (registroExistente) {
            const prevTasa = Number(registroExistente.tasaDolarBs || registroExistente.TasaDolarBs || 0);
            const confirmOver = await Swal.fire({
                title: '¡Tasa Existente para esta Fecha!',
                html: `Ya existe una Tasa BCV registrada para la fecha <strong>${fecha}</strong> (Tasa actual: <strong style="color:#fde047;">Bs. ${prevTasa.toFixed(4)}</strong>).<br><br>¿Deseas actualizar el registro existente con el nuevo valor <strong style="color:#34d399;">Bs. ${tasaVal.toFixed(4)}</strong>?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, Actualizar Tasa',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                background: '#1e293b',
                color: '#fff'
            });

            if (!confirmOver.isConfirmed) {
                return;
            }
        }
    }

    const btn = document.getElementById('btnGuardarBcvSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Guardar';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    try {
        const url = isEdit ? `${API_BASE}/bcv/${id}` : `${API_BASE}/bcv`;
        const method = isEdit ? 'PUT' : 'POST';

        const payload = {
            fecha,
            tasaDolarBs: tasaVal,
            fuente,
            observacion
        };

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalBcvCustom');
            showToast(isEdit ? 'Tasa BCV actualizada exitosamente.' : 'Tasa BCV registrada exitosamente.');
            await cargarTasaBcv();
            await cargarHistorialBcv();
            if (typeof cargarDashboard === 'function') {
                cargarDashboard();
            }
            if (typeof cargarAdelantosFincas === 'function') {
                cargarAdelantosFincas();
            }
            if (typeof cargarPreLiquidacion === 'function') {
                cargarPreLiquidacion(true);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Error al Guardar',
                text: errData.message || 'No se pudo guardar la tasa BCV.',
                background: '#1e293b',
                color: '#fff'
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: err.message,
            background: '#1e293b',
            color: '#fff'
        });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}
window.guardarBcvSubmit = guardarBcvSubmit;

async function eliminarTasaBcv(id) {
    if (!state.token) {
        showToast('Debes iniciar sesión para eliminar tasas BCV', 'warning');
        return;
    }

    const confirm = await Swal.fire({
        title: '¿Eliminar Tasa BCV?',
        text: 'Esta acción borrará el registro de la tasa seleccionada y no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE}/bcv/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (res.ok) {
                showToast('Tasa BCV eliminada exitosamente.');
                await cargarTasaBcv();
                await cargarHistorialBcv();
                if (typeof cargarDashboard === 'function') {
                    cargarDashboard();
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errData.message || 'No se pudo eliminar la tasa BCV.',
                    background: '#1e293b',
                    color: '#fff'
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message,
                background: '#1e293b',
                color: '#fff'
            });
        }
    }
}
window.eliminarTasaBcv = eliminarTasaBcv;

async function cargarHistorialBcv() {
    const badge = document.getElementById('badgeTotalHistorialBcv') || document.getElementById('badgeTotalBcv');
    if (badge) badge.innerText = 'Cargando...';

    try {
        const headers = state.token ? { 'Authorization': `Bearer ${state.token}` } : {};
        const res = await fetch(`${API_BASE}/bcv/historial?dias=1000`, { headers });
        if (res.ok) {
            const historial = await res.json();
            historialBcvData = historial || [];
        } else {
            console.warn('Respuesta no OK al cargar historial BCV:', res.status);
        }
    } catch (err) {
        console.warn('Error al cargar historial BCV:', err);
    } finally {
        actualizarKpisBcvTab();
        renderHistorialBcvTable();
    }
}
window.cargarHistorialBcv = cargarHistorialBcv;

function actualizarKpisBcvTab() {
    const kpiTasa = document.getElementById('bcvKpiTasaActual');
    const kpiFecha = document.getElementById('bcvKpiFechaActual');
    const kpiFuente = document.getElementById('bcvKpiFuenteActual');
    const kpiTotal = document.getElementById('bcvKpiTotalRegistros');

    if (kpiTotal) {
        kpiTotal.innerText = historialBcvData.length.toLocaleString('es-VE');
    }

    if (historialBcvData.length > 0) {
        const ultima = historialBcvData[0];
        const valor = ultima.tasaDolarBs ?? ultima.TasaDolarBs ?? state.tasaBcv ?? 0;
        const tasaFmt = Number(valor).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        const fStr = (ultima.fecha || ultima.Fecha || '').split('T')[0];

        if (kpiTasa) kpiTasa.innerText = `Bs. ${tasaFmt}`;
        if (kpiFecha) kpiFecha.innerHTML = `<i class="fa-regular fa-calendar-check" style="color: #38bdf8; margin-right: 4px;"></i> Vigencia: <strong>${fStr}</strong>`;
        if (kpiFuente) kpiFuente.innerText = ultima.fuente || ultima.Fuente || 'BANCO CENTRAL DE VENEZUELA';
    } else if (state.tasaBcv > 0) {
        const tasaFmt = Number(state.tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        if (kpiTasa) kpiTasa.innerText = `Bs. ${tasaFmt}`;
        if (kpiFecha) kpiFecha.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 4px;"></i> Tasa en memoria`;
    }
}

function filtrarHistorialBcv(texto) {
    historialBcvFiltro = (texto || '').toLowerCase().trim();
    historialBcvPage = 1;
    renderHistorialBcvTable();
}
window.filtrarHistorialBcv = filtrarHistorialBcv;

function cambiarPageSizeBcv(val) {
    const size = parseInt(val, 10);
    historialBcvPageSize = isNaN(size) ? 10 : size;
    historialBcvPage = 1;
    renderHistorialBcvTable();
}
window.cambiarPageSizeBcv = cambiarPageSizeBcv;

function limpiarFiltroBcv() {
    const input = document.getElementById('buscarBcvInput');
    if (input) input.value = '';
    historialBcvFiltro = '';
    historialBcvPage = 1;
    renderHistorialBcvTable();
}
window.limpiarFiltroBcv = limpiarFiltroBcv;

function renderHistorialBcvTable() {
    const tbody = document.getElementById('tbodyHistorialBcv');
    if (!tbody) return;

    let items = historialBcvData;
    if (historialBcvFiltro) {
        items = items.filter(h => {
            const f = (h.fecha || h.Fecha || '').toLowerCase();
            const src = (h.fuente || h.Fuente || '').toLowerCase();
            const obs = (h.observacion || h.Observacion || '').toLowerCase();
            const rate = String(h.tasaDolarBs || h.TasaDolarBs || '');
            const idStr = String(h.id || h.Id || '');
            return f.includes(historialBcvFiltro) || src.includes(historialBcvFiltro) || obs.includes(historialBcvFiltro) || rate.includes(historialBcvFiltro) || idStr.includes(historialBcvFiltro);
        });
    }

    const badge = document.getElementById('badgeTotalHistorialBcv') || document.getElementById('badgeTotalBcv');
    if (badge) badge.innerText = `${items.length} ${items.length === 1 ? 'Registro' : 'Registros'}`;

    if (!items || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 36px 20px; color: #64748b;">
                    <div style="font-size: 32px; color: #94a3b8; margin-bottom: 8px;"><i class="fa-solid fa-folder-open"></i></div>
                    <div style="font-weight: 700; font-size: 15px; color: #334155;">No se encontraron registros de tasas BCV</div>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Prueba ajustando el término de búsqueda o registra una nueva tasa.</div>
                </td>
            </tr>`;
        const info = document.getElementById('infoPaginacionBcv');
        if (info) info.innerText = '0 registros encontrados';
        const pag = document.getElementById('paginacionBcv');
        if (pag) pag.innerHTML = '';
        return;
    }

    const effectivePageSize = (historialBcvPageSize && historialBcvPageSize > 0) ? historialBcvPageSize : (items.length || 1);
    const totalPages = Math.ceil(items.length / effectivePageSize) || 1;
    if (historialBcvPage > totalPages) historialBcvPage = totalPages;
    const startIdx = (historialBcvPage - 1) * effectivePageSize;
    const pagedItems = items.slice(startIdx, startIdx + effectivePageSize);

    tbody.innerHTML = pagedItems.map((h, idx) => {
        const id = h.id || h.Id;
        const fRaw = h.fecha || h.Fecha || '';
        const fechaStr = fRaw ? fRaw.split('T')[0] : '-';
        const rateVal = h.tasaDolarBs ?? h.TasaDolarBs ?? 0;
        const tasaStr = Number(rateVal).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        const fuente = h.fuente || h.Fuente || 'BANCO CENTRAL DE VENEZUELA (BCV)';
        const obs = h.observacion || h.Observacion || '-';

        // Badge color based on source
        const esOficial = fuente.toUpperCase().includes('BCV') || fuente.toUpperCase().includes('BANCO CENTRAL');
        const badgeStyle = esOficial 
            ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 700;' 
            : 'background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-weight: 700;';

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
            <tr style="background: ${rowBg}; transition: background 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${rowBg}'">
                <td style="text-align: center;">
                    <span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 800; font-size: 12px; border: 1px solid #cbd5e1;">#${id}</span>
                </td>
                <td>
                    <div style="color: #0f172a; font-weight: 700; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-regular fa-calendar" style="color: #2563eb; font-size: 13px;"></i>
                        <span>${fechaStr}</span>
                    </div>
                </td>
                <td style="text-align: right;">
                    <span style="color: #047857; font-size: 15px; font-weight: 800; font-family: monospace; letter-spacing: -0.3px;">Bs. ${tasaStr}</span>
                </td>
                <td>
                    <span class="badge" style="${badgeStyle} padding: 4px 10px; font-size: 11.5px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-building-columns" style="font-size: 10px;"></i>
                        ${fuente}
                    </span>
                </td>
                <td style="color: #334155; font-size: 12.5px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${obs}">
                    ${obs}
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button type="button" class="btn btn-outline" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" onclick="abrirModalEditarTasaBcv(${id})" title="Editar Tasa #${id}">
                            <i class="fa-solid fa-pen-to-square"></i> Editar
                        </button>
                        <button type="button" class="btn btn-outline" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-color: #fecdd3; color: #e11d48; background: #fff1f2; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" onclick="eliminarTasaBcv(${id})" title="Eliminar Tasa #${id}">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    const info = document.getElementById('infoPaginacionBcv');
    if (info) {
        info.innerText = `Mostrando ${startIdx + 1} a ${Math.min(startIdx + historialBcvPageSize, items.length)} de ${items.length} registros`;
    }

    renderPaginacionControls('paginacionBcv', historialBcvPage, totalPages, 'cambiarPaginaHistorialBcv');
}
window.renderHistorialBcvTable = renderHistorialBcvTable;

function cambiarPaginaHistorialBcv(pag) {
    historialBcvPage = pag;
    renderHistorialBcvTable();
}
window.cambiarPaginaHistorialBcv = cambiarPaginaHistorialBcv;

function initBcvSyncButton() {
    const btnHeaderSync = document.getElementById('btnSyncBcvApi') || document.getElementById('btnSyncBcvHeader');
    if (btnHeaderSync) {
        btnHeaderSync.onclick = () => sincronizarTasaBcvDesdeApi(btnHeaderSync);
    }
    const btnCardSync = document.getElementById('btnSyncBcvKpi') || document.getElementById('btnSyncBcvCard');
    if (btnCardSync) {
        btnCardSync.onclick = () => sincronizarTasaBcvDesdeApi(btnCardSync);
    }
    const btnEditar = document.getElementById('btnEditarBcv');
    if (btnEditar) {
        btnEditar.onclick = abrirModalCrearTasaBcv;
    }
}
window.initBcvSyncButton = initBcvSyncButton;
