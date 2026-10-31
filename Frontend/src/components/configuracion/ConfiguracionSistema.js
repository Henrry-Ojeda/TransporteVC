// ==========================================================================
// MÓDULO CRUD: CONFIGURACIÓN DE EMPRESA & MEMBRETE OFICIAL
// ==========================================================================
var empresaConfigData = window.empresaConfigData || null;

async function cargarEmpresaConfig(forceReload = false) {
    try {
        if (!forceReload && empresaConfigData) {
            popularFormularioEmpresa(empresaConfigData);
            return empresaConfigData;
        }

        const res = await fetch(`${API_BASE}/catalogos/empresa`, {
            headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
        });

        if (res.ok) {
            const data = await res.json();
            empresaConfigData = data;
            window.empresaConfigData = data;
            popularFormularioEmpresa(data);
            return data;
        } else {
            console.warn('No se pudo cargar la configuración de empresa.');
        }
    } catch (err) {
        console.error('Error al cargar datos de empresa:', err);
    }
}
window.cargarEmpresaConfig = cargarEmpresaConfig;

function popularFormularioEmpresa(data) {
    if (!data) return;
    const inputId = document.getElementById('empresaConfigId');
    const inputNombre = document.getElementById('empresaNombre');
    const inputRif = document.getElementById('empresaRif');
    const inputTelefono = document.getElementById('empresaTelefono');
    const inputEmail = document.getElementById('empresaEmail');
    const inputDireccion = document.getElementById('empresaDireccion');
    const inputLogoUrl = document.getElementById('empresaLogoUrl');

    if (inputId) inputId.value = data.id || 1;
    if (inputNombre) inputNombre.value = data.nombre || 'TRANSPORTE VERGEL & CARRILLO';
    if (inputRif) inputRif.value = data.rif || 'J-50000000-0';
    if (inputTelefono) inputTelefono.value = data.telefono || '+58 414-0000000';
    if (inputEmail) inputEmail.value = data.email || 'contacto@transporte-vergel-carrillo.com';
    if (inputDireccion) inputDireccion.value = data.direccion || 'Carretera Nacional, Sector El Cruce, Estado Zulia, Venezuela';
    if (inputLogoUrl) inputLogoUrl.value = data.logoUrl || '';

    actualizarPreviewMembreteLive();
}
window.popularFormularioEmpresa = popularFormularioEmpresa;

function actualizarPreviewMembreteLive() {
    const nombre = document.getElementById('empresaNombre')?.value || 'TRANSPORTE VERGEL & CARRILLO';
    const rif = document.getElementById('empresaRif')?.value || 'J-50000000-0';
    const telefono = document.getElementById('empresaTelefono')?.value || '';
    const email = document.getElementById('empresaEmail')?.value || '';
    const direccion = document.getElementById('empresaDireccion')?.value || 'Carretera Nacional, Sector El Cruce, Estado Zulia, Venezuela';
    const logoUrl = document.getElementById('empresaLogoUrl')?.value || '';

    // Actualizar preview en la vista
    const liveNombre = document.getElementById('liveMembreteNombre');
    const liveRif = document.getElementById('liveMembreteRif');
    const liveDireccion = document.getElementById('liveMembreteDireccion');
    const liveLogoBox = document.getElementById('liveMembreteLogoBox');
    const thumbnailBox = document.getElementById('previewLogoThumbnail');

    if (liveNombre) liveNombre.innerText = nombre.toUpperCase();
    if (liveRif) liveRif.innerText = rif.toUpperCase();
    if (liveDireccion) liveDireccion.innerText = direccion;

    if (logoUrl && logoUrl.trim().length > 10) {
        if (liveLogoBox) liveLogoBox.innerHTML = `<img src="${logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
        if (thumbnailBox) thumbnailBox.innerHTML = `<img src="${logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
        if (liveLogoBox) liveLogoBox.innerHTML = `<i class="fa-solid fa-truck-droplet" style="color: #38bdf8;"></i>`;
        if (thumbnailBox) thumbnailBox.innerHTML = `<i class="fa-solid fa-truck-droplet"></i>`;
    }
}
window.actualizarPreviewMembreteLive = actualizarPreviewMembreteLive;

function onSeleccionarArchivoLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        Swal.fire('Imagen muy pesada', 'Por favor selecciona una imagen menor a 2MB.', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result;
        const inputLogoUrl = document.getElementById('empresaLogoUrl');
        if (inputLogoUrl) inputLogoUrl.value = base64Data;
        actualizarPreviewMembreteLive();
    };
    reader.readAsDataURL(file);
}
window.onSeleccionarArchivoLogo = onSeleccionarArchivoLogo;

async function guardarEmpresaConfigForm(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();

    const id = Number(document.getElementById('empresaConfigId')?.value || 1);
    const nombre = (document.getElementById('empresaNombre')?.value || '').trim();
    const rif = (document.getElementById('empresaRif')?.value || '').trim();
    const telefono = (document.getElementById('empresaTelefono')?.value || '').trim();
    const email = (document.getElementById('empresaEmail')?.value || '').trim();
    const direccion = (document.getElementById('empresaDireccion')?.value || '').trim();
    const logoUrl = (document.getElementById('empresaLogoUrl')?.value || '').trim();

    if (!nombre) {
        Swal.fire('Campo Requerido', 'El nombre o razón social de la empresa es obligatorio.', 'warning');
        return;
    }
    if (!rif) {
        Swal.fire('Campo Requerido', 'El RIF o identificación fiscal de la empresa es obligatorio.', 'warning');
        return;
    }

    const payload = {
        id: id,
        nombre: nombre,
        rif: rif,
        telefono: telefono,
        email: email,
        direccion: direccion,
        logoUrl: logoUrl
    };

    try {
        Swal.fire({
            title: 'Guardando Configuración...',
            text: 'Actualizando datos oficiales de la empresa en la base de datos...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            background: '#1e293b',
            color: '#fff'
        });

        const res = await fetch(`${API_BASE}/catalogos/empresa`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            empresaConfigData = payload;
            window.empresaConfigData = payload;
            Swal.fire({
                icon: 'success',
                title: '¡Configuración Guardada!',
                html: `Los datos de <strong>${nombre}</strong> se han actualizado correctamente en el sistema.`,
                confirmButtonColor: '#10b981',
                background: '#1e293b',
                color: '#fff'
            });
            actualizarPreviewMembreteLive();
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Error al Guardar',
                text: errData.mensaje || 'No se pudo guardar la configuración de empresa.',
                background: '#1e293b',
                color: '#fff'
            });
        }
    } catch (err) {
        console.error('Error al guardar empresa:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: 'Ocurrió un fallo de conexión al intentar guardar.',
            background: '#1e293b',
            color: '#fff'
        });
    }
}
window.guardarEmpresaConfigForm = guardarEmpresaConfigForm;

// ============================================================================
// MÓDULO DE PARAMETRIZACIÓN Y CONFIGURACIÓN GLOBAL DEL SISTEMA (V2)
// Tablas: TB_PARAMETROS_SISTEMA, TB_TIPOS_LECHE, TB_MODULOS, TB_REPORTES_CONFIG, TB_DASHBOARD_WIDGETS
// ============================================================================

window.parametrosSistemaDataCache = [];
window.tiposLecheDataCache = [];
window.modulosMenuDataCache = [];
window.reportesConfigDataCache = [];
window.widgetsDashboardDataCache = [];

// ==========================================================================
// MÓDULO DE CONFIGURACIÓN Y PARAMETRIZACIÓN DEL SISTEMA
// ==========================================================================

/**
 * Gestiona el cambio de pestañas secundarias dentro del módulo de Configuración.
 * 
 * Qué hace esta función:
 * 1. Oculta todos los paneles secundarios (`.subtab-panel-config` y `subtab-config-*`).
 * 2. Remueve la clase activa de todos los botones de sub-pestaña.
 * 3. Muestra el panel seleccionado (`subtab-config-${subTabKey}`).
 * 4. Ajusta la visibilidad de los botones de acción rápida en la barra superior.
 * 
 * @param {string} subTabKey - Clave de la subpestaña ('parametros', 'tipos-leche', 'modulos', 'reportes-widgets').
 */
function cambiarSubTabConfiguracion(subTabKey) {
    const tabs = ['parametros', 'tipos-leche', 'modulos', 'reportes-widgets', 'reportes'];
    tabs.forEach(t => {
        const btnPascal = document.getElementById(`btnSubTab${t === 'tipos-leche' ? 'TiposLeche' : t === 'reportes-widgets' ? 'ReportesWidgets' : t.charAt(0).toUpperCase() + t.slice(1)}`);
        const btnKebab = document.getElementById(`btnSubTabConfig-${t}`);
        const pane = document.getElementById(`subtab-config-${t}`);
        if (btnPascal) { btnPascal.classList.remove('active'); }
        if (btnKebab) {
            btnKebab.classList.remove('active');
            btnKebab.style.borderColor = '#cbd5e1';
            btnKebab.style.color = '#64748b';
            btnKebab.style.background = '#ffffff';
        }
        if (pane) pane.style.display = 'none';
    });

    const activeBtnPascal = document.getElementById(`btnSubTab${subTabKey === 'tipos-leche' ? 'TiposLeche' : subTabKey === 'reportes-widgets' ? 'ReportesWidgets' : subTabKey.charAt(0).toUpperCase() + subTabKey.slice(1)}`);
    const activeBtnKebab = document.getElementById(`btnSubTabConfig-${subTabKey}`);
    const activePane = document.getElementById(`subtab-config-${subTabKey}`);

    if (activeBtnPascal) activeBtnPascal.classList.add('active');
    if (activeBtnKebab) {
        activeBtnKebab.classList.add('active');
        activeBtnKebab.style.borderColor = '#6366f1';
        activeBtnKebab.style.color = '#4338ca';
        activeBtnKebab.style.background = '#e0e7ff';
    }
    if (activePane) activePane.style.display = 'block';

    const btnParam = document.getElementById('btnNuevoParametroGlobal');
    const btnTipo = document.getElementById('btnNuevoTipoLecheGlobal');
    if (btnParam) btnParam.style.display = (subTabKey === 'parametros') ? 'inline-flex' : 'none';
    if (btnTipo) btnTipo.style.display = (subTabKey === 'tipos-leche') ? 'inline-flex' : 'none';
}
window.cambiarSubTabConfiguracion = cambiarSubTabConfiguracion;

/**
 * Inicializa y recarga todos los catálogos y parámetros del módulo de Configuración.
 * 
 * Qué hace esta función:
 * 1. Activa por defecto la pestaña de Parámetros Globales.
 * 2. Ejecuta en paralelo las peticiones para cargar parámetros, tipos de leche, menús y widgets.
 * 
 * @param {boolean} [forceRefresh=false] - Si es true, ignora el caché en memoria y solicita datos frescos al backend.
 */
async function cargarModuloConfiguracionSistema(forceRefresh = false) {
    cambiarSubTabConfiguracion('parametros');
    await Promise.all([
        cargarParametrosSistema(forceRefresh),
        cargarTiposLeche(forceRefresh),
        cargarModulosMenuAdmin(forceRefresh),
        cargarReportesYWidgetsConfig(forceRefresh)
    ]);
}
window.cargarModuloConfiguracionSistema = cargarModuloConfiguracionSistema;

// --------------------------------------------------------------------------
// 1. PARÁMETROS GLOBALES DEL SISTEMA (TB_PARAMETROS_SISTEMA)
// --------------------------------------------------------------------------

/**
 * Consulta la lista de parámetros configurables desde el backend.
 * 
 * Qué hace esta función:
 * 1. Muestra un spinner de carga en `#tbodyParametrosSistema`.
 * 2. Realiza la petición GET autenticada a `/api/configuracion/parametros`.
 * 3. Almacena el resultado en `window.parametrosSistemaDataCache`.
 * 4. Invoca a `renderTablaParametrosSistema` para plasmar los datos en el DOM.
 * 
 * @param {boolean} [forceRefresh=false] - Forzar petición HTTP omitiendo caché local.
 */
async function cargarParametrosSistema(forceRefresh = false) {
    const tbody = document.getElementById('tbodyParametrosSistema');
    if (!tbody) return;

    if (!forceRefresh && window.parametrosSistemaDataCache && window.parametrosSistemaDataCache.length > 0) {
        renderTablaParametrosSistema(window.parametrosSistemaDataCache);
        return;
    }

    renderTableLoading('tbodyParametrosSistema', 6, 'Cargando parámetros globales...');

    const res = await apiFetch('/configuracion/parametros');
    if (res.ok && Array.isArray(res.data)) {
        window.parametrosSistemaDataCache = res.data;

        // Sincronizar tolerancia de merma operativa para el semáforo
        const paramTol = res.data.find(p => p.clave === 'TOLERANCIA_MERMA_PORCENTAJE' || p.clave === 'MERMA_PORCENTAJE_ALERTA');
        if (paramTol && paramTol.valor) {
            const valNum = parseFloat(paramTol.valor) || 3.0;
            state.toleranciaMermaPorc = valNum;
            window.toleranciaMermaConfig = valNum;
            localStorage.setItem('app_tolerancia_merma', valNum);
            const inputTol = document.getElementById('inputToleranciaMermaRapida');
            if (inputTol) inputTol.value = valNum.toFixed(2);
        }

        renderTablaParametrosSistema(window.parametrosSistemaDataCache);
    } else {
        renderTableError('tbodyParametrosSistema', 6, res.error || 'Error al cargar los parámetros del sistema.');
    }
}
window.cargarParametrosSistema = cargarParametrosSistema;

async function guardarToleranciaMermaConfig() {
    const inputTol = document.getElementById('inputToleranciaMermaRapida');
    if (!inputTol) return;
    const val = parseFloat(inputTol.value);
    if (isNaN(val) || val <= 0) {
        Swal.fire('Atención', 'Ingresa un porcentaje de tolerancia válido mayor a 0 (ej: 0.50, 1.50, 3.00).', 'warning');
        return;
    }

    Swal.fire({
        title: 'Guardando Tolerancia...',
        text: 'Actualizando semáforo operativo de merma en el sistema...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const res = await apiFetch('/configuracion/parametros', {
        method: 'POST',
        body: {
            clave: 'TOLERANCIA_MERMA_PORCENTAJE',
            valor: val.toFixed(2),
            descripcion: 'Porcentaje de tolerancia para el semáforo de mermas (ej: 3.00%)',
            categoria: 'RUTAS'
        }
    });

    if (res.ok) {
        state.toleranciaMermaPorc = val;
        window.toleranciaMermaConfig = val;
        localStorage.setItem('app_tolerancia_merma', val);
        Swal.fire({
            icon: 'success',
            title: '¡Tolerancia Actualizada!',
            html: `La tolerancia de merma se estableció en <strong>${val.toFixed(2)}%</strong>.<br>El semáforo de rutas, tickets y mermas aplicará este umbral.`,
            confirmButtonColor: '#0284c7'
        });
        await cargarParametrosSistema(true);
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
    } else {
        Swal.fire('Error', res.error || 'No se pudo guardar la tolerancia de merma.', 'error');
    }
}
window.guardarToleranciaMermaConfig = guardarToleranciaMermaConfig;

/**
 * Genera el HTML de las filas de parámetros del sistema con diseño moderno.
 * 
 * Qué hace esta función:
 * 1. Verifica si la lista contiene elementos; si está vacía, muestra un mensaje amigable.
 * 2. Asigna insignias de color distintivas para cada categoría (Finanzas, Liquidaciones, Rutas, General).
 * 3. Renderiza botones para editar y eliminar cada parámetro.
 * 
 * @param {Array<Object>} lista - Colección de objetos de parámetro obtenidos del backend.
 */
function renderTablaParametrosSistema(lista) {
    const tbody = document.getElementById('tbodyParametrosSistema');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        renderTableEmpty('tbodyParametrosSistema', 6, 'No se encontraron parámetros registrados.');
        return;
    }

    const catColors = {
        'FINANZAS': { bg: '#ecfdf5', text: '#059669', icon: 'fa-dollar-sign' },
        'LIQUIDACIONES': { bg: '#eff6ff', text: '#2563eb', icon: 'fa-file-invoice-dollar' },
        'RUTAS': { bg: '#fef3c7', text: '#d97706', icon: 'fa-truck' },
        'GENERAL': { bg: '#f3e8ff', text: '#7c3aed', icon: 'fa-gear' }
    };

    tbody.innerHTML = lista.map(p => {
        const cat = catColors[p.categoria] || { bg: '#f1f5f9', text: '#475569', icon: 'fa-tag' };
        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-family: monospace; font-size: 12.5px; font-weight: 800; color: #1e1b4b; background: #e0e7ff; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.5px;">
                            ${escapeHtml(p.clave)}
                        </span>
                    </div>
                </td>
                <td style="padding: 12px 16px;">
                    <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 6px; display: inline-block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(p.valor || '')}
                    </span>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <span style="background: ${cat.bg}; color: ${cat.text}; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid ${cat.icon}"></i> ${escapeHtml(p.categoria)}
                    </span>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                        ${escapeHtml(p.tipoDato || 'STRING')}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-size: 12.5px; color: #475569;">
                    ${escapeHtml(p.descripcion || '-')}
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <div style="display: inline-flex; gap: 6px;">
                        <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; color: #7c3aed; border-color: #ddd6fe;" onclick="abrirModalParametroSistema('${escapeHtml(p.clave)}')" title="Editar Parámetro">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; color: #dc2626; border-color: #fecaca;" onclick="eliminarParametroSistema('${escapeHtml(p.clave)}')" title="Eliminar Parámetro">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtra reactivamente la tabla de parámetros en base a la categoría seleccionada y la caja de búsqueda.
 */
function filtrarTablaParametrosSistema() {
    const cat = document.getElementById('filtroCategoriaParametros')?.value || '';
    const q = (document.getElementById('buscadorParametrosSistema')?.value || '').toLowerCase().trim();

    let filtrados = window.parametrosSistemaDataCache || [];
    if (cat) {
        filtrados = filtrados.filter(p => p.categoria === cat);
    }
    if (q) {
        filtrados = filtrados.filter(p => 
            (p.clave && p.clave.toLowerCase().includes(q)) ||
            (p.valor && p.valor.toLowerCase().includes(q)) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(q))
        );
    }
    renderTablaParametrosSistema(filtrados);
}
window.filtrarTablaParametrosSistema = filtrarTablaParametrosSistema;

/**
 * Abre el modal de creación o edición de un Parámetro del Sistema.
 * 
 * @param {string|null} [clave=null] - Clave del parámetro a editar, o null para crear uno nuevo.
 */
function abrirModalParametroSistema(clave = null) {
    const titulo = document.getElementById('modalParametroTitulo');
    const inputClave = document.getElementById('paramClave');
    const selectCat = document.getElementById('paramCategoria');
    const selectTipo = document.getElementById('paramTipoDato');
    const textValor = document.getElementById('paramValor');
    const inputDesc = document.getElementById('paramDescripcion');

    if (clave) {
        const item = (window.parametrosSistemaDataCache || []).find(p => p.clave === clave);
        if (titulo) titulo.textContent = `Editar Parámetro: ${clave}`;
        if (inputClave) { inputClave.value = item?.clave || clave; inputClave.readOnly = true; inputClave.style.background = '#f1f5f9'; }
        if (selectCat) selectCat.value = item?.categoria || 'GENERAL';
        if (selectTipo) selectTipo.value = item?.tipoDato || 'STRING';
        if (textValor) textValor.value = item?.valor || '';
        if (inputDesc) inputDesc.value = item?.descripcion || '';
    } else {
        if (titulo) titulo.textContent = 'Nuevo Parámetro del Sistema';
        if (inputClave) { inputClave.value = ''; inputClave.readOnly = false; inputClave.style.background = '#ffffff'; }
        if (selectCat) selectCat.value = 'FINANZAS';
        if (selectTipo) selectTipo.value = 'STRING';
        if (textValor) textValor.value = '';
        if (inputDesc) inputDesc.value = '';
    }

    abrirModalCustom('modalParametroSistema');
}
window.abrirModalParametroSistema = abrirModalParametroSistema;

/**
 * Procesa el envío del formulario para crear o actualizar un Parámetro del Sistema.
 * 
 * @param {Event} event - Evento del formulario submit.
 */
async function guardarParametroSistemaForm(event) {
    event.preventDefault();
    const clave = document.getElementById('paramClave')?.value?.trim().toUpperCase();
    const categoria = document.getElementById('paramCategoria')?.value;
    const tipoDato = document.getElementById('paramTipoDato')?.value;
    const valor = document.getElementById('paramValor')?.value?.trim();
    const descripcion = document.getElementById('paramDescripcion')?.value?.trim();

    if (!clave || valor === undefined) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Debe especificar la clave y el valor del parámetro.' });
        return;
    }

    const payload = { clave, categoria, tipoDato, valor, descripcion };
    const res = await apiFetch(`/configuracion/parametros/${encodeURIComponent(clave)}`, {
        method: 'PUT',
        body: payload
    });

    if (res.ok) {
        cerrarModalCustom('modalParametroSistema');
        Swal.fire({
            icon: 'success',
            title: '¡Parámetro Guardado!',
            text: `El parámetro ${clave} se configuró exitosamente.`,
            timer: 1800,
            showConfirmButton: false
        });
        await cargarParametrosSistema(true);
    } else {
        Swal.fire({ icon: 'error', title: 'Error al Guardar', text: res.error || 'No se pudo guardar el parámetro.' });
    }
}
window.guardarParametroSistemaForm = guardarParametroSistemaForm;

/**
 * Elimina un parámetro de configuración del sistema tras confirmación del usuario.
 * 
 * @param {string} clave - Clave identificadora única del parámetro.
 */
async function eliminarParametroSistema(clave) {
    const confirm = await Swal.fire({
        title: `¿Eliminar parámetro ${clave}?`,
        text: 'Esta acción removerá esta variable de configuración del sistema.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    const res = await apiFetch(`/configuracion/parametros/${encodeURIComponent(clave)}`, {
        method: 'DELETE'
    });

    if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Eliminado', text: `El parámetro ${clave} fue eliminado.`, timer: 1500, showConfirmButton: false });
        await cargarParametrosSistema(true);
    } else {
        Swal.fire({ icon: 'error', title: 'Error al eliminar', text: res.error || 'No se pudo eliminar el parámetro.' });
    }
}
window.eliminarParametroSistema = eliminarParametroSistema;

// --------------------------------------------------------------------------
// 2. TIPOS DE LECHE & FACTORES DE PRECIO (Modularizado en src/modules/tiposLeche/tiposLeche.js)
// --------------------------------------------------------------------------


// --------------------------------------------------------------------------
// 3. MÓDULOS DE NAVEGACIÓN (TB_MODULOS)
// --------------------------------------------------------------------------

/**
 * Consulta la lista de módulos de menú y permisos requeridos desde el backend.
 * 
 * @param {boolean} [forceRefresh=false] - Forzar consulta fresca.
 */
async function cargarModulosMenuAdmin(forceRefresh = false) {
    const tbody = document.getElementById('tbodyModulosMenu');
    if (!tbody) return;

    if (!forceRefresh && window.modulosMenuDataCache && window.modulosMenuDataCache.length > 0) {
        renderTablaModulosMenuAdmin(window.modulosMenuDataCache);
        return;
    }

    renderTableLoading('tbodyModulosMenu', 6, 'Cargando módulos de navegación...');

    const res = await apiFetch('/configuracion/modulos-admin');
    if (res.ok && Array.isArray(res.data)) {
        window.modulosMenuDataCache = res.data;
        renderTablaModulosMenuAdmin(window.modulosMenuDataCache);
    } else {
        renderTableError('tbodyModulosMenu', 6, res.error || 'Error al cargar los módulos.');
    }
}
window.cargarModulosMenuAdmin = cargarModulosMenuAdmin;

/**
 * Renderiza la lista de módulos de menú con sus iconos y permisos requeridos.
 * 
 * @param {Array<Object>} lista - Colección de módulos de menú.
 */
function renderTablaModulosMenuAdmin(lista) {
    const tbody = document.getElementById('tbodyModulosMenu');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        renderTableEmpty('tbodyModulosMenu', 6, 'No hay módulos registrados.');
        return;
    }

    tbody.innerHTML = lista.map(m => `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding: 12px 16px; text-align: center; font-weight: 800; color: #64748b;">#${m.orden}</td>
            <td style="padding: 12px 16px; font-family: monospace; font-weight: 800; color: #1e1b4b;">${escapeHtml(m.codigo)}</td>
            <td style="padding: 12px 16px; font-weight: 700; color: #0f172a;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid ${m.icono || 'fa-folder'}" style="color: #6366f1;"></i>
                    ${escapeHtml(m.nombre)}
                </div>
            </td>
            <td style="padding: 12px 16px; font-family: monospace; font-size: 12px; color: #475569;">${escapeHtml(m.ruta || '-')}</td>
            <td style="padding: 12px 16px; text-align: center;">
                <span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
                    ${escapeHtml(m.permisoRequerido || 'PUBLICO')}
                </span>
            </td>
            <td style="padding: 12px 16px; text-align: center;">
                <button type="button" class="btn" style="padding: 4px 12px; font-size: 11.5px; font-weight: 700; border-radius: 999px; ${m.activo ? 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;'}" onclick="toggleModuloMenuEstado(${m.id}, ${m.activo})">
                    <i class="fa-solid ${m.activo ? 'fa-check' : 'fa-eye-slash'}"></i> ${m.activo ? 'Visible' : 'Oculto'}
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Alterna la visibilidad (Activo/Oculto) de un módulo del menú de navegación.
 * 
 * @param {number} id - ID del módulo.
 * @param {boolean} estadoActual - Estado booleano actual.
 */
async function toggleModuloMenuEstado(id, estadoActual) {
    const res = await apiFetch(`/configuracion/modulos/${id}/toggle`, {
        method: 'PUT',
        body: !estadoActual
    });
    if (res.ok) {
        await cargarModulosMenuAdmin(true);
    }
}
window.toggleModuloMenuEstado = toggleModuloMenuEstado;

// --------------------------------------------------------------------------
// 4. REPORTES Y WIDGETS DE DASHBOARD (TB_REPORTES_CONFIG, TB_DASHBOARD_WIDGETS)
// --------------------------------------------------------------------------

/**
 * Consulta en paralelo y renderiza la configuración de reportes activos y widgets del dashboard.
 * 
 * @param {boolean} [forceRefresh=false] - Forzar consulta a la API.
 */
async function cargarReportesYWidgetsConfig(forceRefresh = false) {
    const [resRep, resWid] = await Promise.all([
        apiFetch('/configuracion/reportes-config?soloActivos=false'),
        apiFetch('/configuracion/widgets-dashboard?soloActivos=false')
    ]);

    if (resRep.ok && Array.isArray(resRep.data)) {
        window.reportesConfigDataCache = resRep.data;
        renderListaReportesConfig(window.reportesConfigDataCache);
    }
    if (resWid.ok && Array.isArray(resWid.data)) {
        window.widgetsDashboardDataCache = resWid.data;
        renderListaWidgetsDashboard(window.widgetsDashboardDataCache);
    }
}
window.cargarReportesYWidgetsConfig = cargarReportesYWidgetsConfig;

/**
 * Renderiza la lista visual de reportes configurables.
 * 
 * @param {Array<Object>} lista - Colección de reportes.
 */
function renderListaReportesConfig(lista) {
    const contenedor = document.getElementById('contenedorListaReportesConfig');
    if (!contenedor) return;

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = `<div style="text-align: center; color: #64748b; padding: 20px;">No hay reportes configurados.</div>`;
        return;
    }

    contenedor.innerHTML = lista.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                    <i class="fa-solid ${r.icono || 'fa-file-lines'}"></i>
                </div>
                <div>
                    <h4 style="margin: 0; font-size: 13.5px; font-weight: 700; color: #0f172a;">${escapeHtml(r.nombre)}</h4>
                    <span style="font-size: 11.5px; color: #64748b;">${escapeHtml(r.descripcion || r.codigo)}</span>
                </div>
            </div>
            <button type="button" class="btn" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 999px; ${r.activo ? 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;'}" onclick="toggleReporteConfigEstado(${r.id}, ${r.activo})">
                ${r.activo ? 'Activo' : 'Desactivado'}
            </button>
        </div>
    `).join('');
}

/**
 * Renderiza la lista visual de widgets configurables del dashboard principal.
 * 
 * @param {Array<Object>} lista - Colección de widgets.
 */
function renderListaWidgetsDashboard(lista) {
    const contenedor = document.getElementById('contenedorListaWidgetsDashboard');
    if (!contenedor) return;

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = `<div style="text-align: center; color: #64748b; padding: 20px;">No hay widgets configurados.</div>`;
        return;
    }

    contenedor.innerHTML = lista.map(w => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                    <i class="fa-solid ${w.icono || 'fa-chart-pie'}"></i>
                </div>
                <div>
                    <h4 style="margin: 0; font-size: 13.5px; font-weight: 700; color: #0f172a;">${escapeHtml(w.titulo)}</h4>
                    <span style="font-size: 11.5px; color: #64748b;">${escapeHtml(w.descripcion || w.codigo)}</span>
                </div>
            </div>
            <button type="button" class="btn" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 999px; ${w.activo ? 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;'}" onclick="toggleWidgetDashboardEstado(${w.id}, ${w.activo})">
                ${w.activo ? 'Activo' : 'Desactivado'}
            </button>
        </div>
    `).join('');
}

/**
 * Alterna el estado activo/desactivado de un reporte del sistema.
 * 
 * @param {number} id - ID del reporte.
 * @param {boolean} estadoActual - Estado booleano actual.
 */
async function toggleReporteConfigEstado(id, estadoActual) {
    const res = await apiFetch(`/configuracion/reportes/${id}/toggle`, {
        method: 'PUT',
        body: !estadoActual
    });
    if (res.ok) {
        await cargarReportesYWidgetsConfig(true);
    }
}
window.toggleReporteConfigEstado = toggleReporteConfigEstado;

/**
 * Alterna el estado activo/desactivado de un widget de dashboard.
 * 
 * @param {number} id - ID del widget.
 * @param {boolean} estadoActual - Estado booleano actual.
 */
async function toggleWidgetDashboardEstado(id, estadoActual) {
    const res = await apiFetch(`/configuracion/widgets/${id}/toggle`, {
        method: 'PUT',
        body: !estadoActual
    });
    if (res.ok) {
        await cargarReportesYWidgetsConfig(true);
    }
}
window.toggleWidgetDashboardEstado = toggleWidgetDashboardEstado;
