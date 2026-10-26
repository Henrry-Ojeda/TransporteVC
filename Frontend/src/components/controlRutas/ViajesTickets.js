// =====================================================================
// NUEVO FLUJO LOGÍSTICO DE VIAJES Y TICKETS (AGENTS_2)
// =====================================================================

let stateViajes = {
    viajeActivo: null,
    ticketsList: [],
    procesoActual: null
};

// 1. CARGAR VIAJE ACTIVO DEL CHOFER (EN RUTA)
function actualizarEstadoBotonNuevoViaje(viajeAbierto) {
    const btnRutas = document.getElementById('btnIniciarNuevoViajeRutas');
    const btnControl = document.getElementById('btnIniciarNuevoViajeControl');

    const esChofer = state.user && state.user.rol === 'CHOFER';

    if (viajeAbierto && viajeAbierto.procesoActualId === 1) {
        state.viajeEnRutaActivo = viajeAbierto;
        state.ticketAsignadoActivo = viajeAbierto.id;

        // Mostrar banner de vinculación en el formulario de captura
        const bannerActivo = document.getElementById('bannerTicketActivoForm');
        if (bannerActivo) {
            bannerActivo.style.display = 'flex';
            const lblNum = document.getElementById('lblTicketActivoNumero');
            if (lblNum) lblNum.innerText = viajeAbierto.id;
            const lblChofer = document.getElementById('lblTicketActivoChofer');
            if (lblChofer) lblChofer.innerText = viajeAbierto.nombreConductor || state.user?.nombreCompleto || 'Conductor';
        }

    } else {
        state.viajeEnRutaActivo = null;
        // Solo desvincular automáticamente para rol CHOFER. Para ADMIN o ENCARGADO, el ticket asignado permanece activo para carga continua
        if (esChofer && !state.filtroTicketId) {
            state.ticketAsignadoActivo = null;
            const bannerActivo = document.getElementById('bannerTicketActivoForm');
            if (bannerActivo) bannerActivo.style.display = 'none';
        }
    }

    [btnRutas, btnControl].forEach(btn => {
        if (btn) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
            btn.style.cursor = 'pointer';
            btn.style.opacity = '1';
            if (btn === btnRutas) {
                btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btn.style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)';
                btn.title = 'Iniciar Nuevo Viaje / Ticket';
                btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje / Ticket';
            } else {
                btn.style.background = 'linear-gradient(135deg, #4f46e5, #3b82f6)';
                btn.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.35)';
                btn.title = 'Iniciar Nuevo Viaje';
                btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje';
            }
        }
    });
}
window.actualizarEstadoBotonNuevoViaje = actualizarEstadoBotonNuevoViaje;

function prepararEnviarReceptoria(ticketId) {
    const v = (state.viajesDelDia || []).find(x => x.id == ticketId) 
           || (state.viajesReceptoria || []).find(x => x.id == ticketId)
           || (stateViajes?.listaViajes || []).find(x => x.id == ticketId)
           || stateViajes.viajeActivo;
    const lFincas = Number(v?.totalLitrosFinca || v?.TotalLitrosFinca || 0);
    const lTraspaso = Number(v?.litrosCargadosAdicional || v?.LitrosCargadosAdicional || 0);
    const totalLitros = lFincas + lTraspaso;
    abrirModalEnviarReceptoria(ticketId, totalLitros, v?.totalFincas || 0, lFincas, lTraspaso);
}
window.prepararEnviarReceptoria = prepararEnviarReceptoria;

async function prepararEntregaDirecta(ticketId) {
    let v = (state.viajesDelDia || []).find(x => x.id == ticketId) 
         || (state.viajesReceptoria || []).find(x => x.id == ticketId)
         || (stateViajes?.listaViajes || []).find(x => x.id == ticketId)
         || stateViajes?.viajeActivo;

    if (!v || (!v.totalLitrosFinca && !v.TotalLitrosFinca && !v.litrosCargadosAdicional && !v.LitrosCargadosAdicional)) {
        try {
            const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) {
                const viajeApi = await res.json();
                if (viajeApi) {
                    v = viajeApi;
                }
            }
        } catch (e) {
            console.error('Error al obtener viaje para entrega directa:', e);
        }
    }

    const litrosFinca = Number(v?.totalLitrosFinca || v?.TotalLitrosFinca || 0);
    const litrosTraspaso = Number(v?.litrosCargadosAdicional || v?.LitrosCargadosAdicional || 0);
    const totalLecheCamion = litrosFinca + litrosTraspaso;

    await abrirModalEntregaDirecta(ticketId, totalLecheCamion, litrosFinca, litrosTraspaso);
}
window.prepararEntregaDirecta = prepararEntregaDirecta;

// 1. CARGAR VIAJE ACTIVO DEL CHOFER (EN RUTA)
async function cargarViajeActivoChofer() {
    const container = document.getElementById('containerWidgetViajeActivoRutas');
    if (!state.token) return;

    // Solo los choferes consultan viaje activo personal en este widget
    const esChofer = state.user && state.user.rol === 'CHOFER';
    if (!esChofer) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/viaje-activo`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.status === 204 || res.status === 404) {
            // Sin viaje activo para este chofer
            stateViajes.viajeActivo = null;
            actualizarEstadoBotonNuevoViaje(null);
            if (container) {
                container.innerHTML = `
                    <div class="ticket-banner-hero" style="background: linear-gradient(135deg, #1e293b, #0f172a); border-color: rgba(99, 102, 241, 0.35);">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(99, 102, 241, 0.15); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                <i class="fa-solid fa-truck-ramp-box"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 15.5px; font-weight: 700; color: #f8fafc;">
                                    Iniciar Nuevo Viaje de Recolección
                                </h3>
                                <p style="margin: 3px 0 0 0; font-size: 12.5px; color: #94a3b8;">
                                    Abre un ticket de viaje para vincular y cuantificar las fincas de hoy en la logística.
                                </p>
                            </div>
                        </div>
                        <button type="button" class="btn btn-primary" onclick="abrirModalIniciarViaje()" style="font-weight: 700; background: linear-gradient(135deg, #4f46e5, #3b82f6); border: none; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); height: 40px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-play"></i> Iniciar Viaje Ahora
                        </button>
                    </div>
                `;
            }
            return;
        }

        if (!res.ok) {
            console.warn('No se pudo obtener viaje activo. Status:', res.status);
            return;
        }

        const viaje = await res.json();
        stateViajes.viajeActivo = viaje;

        if (!viaje || !viaje.id) {
            actualizarEstadoBotonNuevoViaje(null);
            return;
        }

        // SÍ HAY VIAJE ACTIVO
        const procesoId = viaje.procesoActualId || 1;
        let badgeProceso = '';
        let botonesAccion = '';

        if (procesoId === 1) { // ABIERTO (EN RUTA)
            actualizarEstadoBotonNuevoViaje(viaje);

            badgeProceso = `
                <span class="ticket-status-badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">
                    <span class="ticket-pulse-dot" style="background: #10b981;"></span> ABIERTO (EN RUTA)
                </span>
            `;
            botonesAccion = `
                <button type="button" class="btn btn-warning" onclick="abrirModalEnviarReceptoria(${viaje.id}, ${viaje.totalLitrosFinca || 0}, ${viaje.totalFincas || 0})" style="font-weight: 700; background: linear-gradient(135deg, #d97706, #b45309); border: none; height: 38px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; color: #fff; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
                    <i class="fa-solid fa-truck-fast"></i> Enviar a Receptoría
                </button>
                <button type="button" class="btn btn-primary" onclick="abrirModalEnviarACompaniaDesdeRuta(${viaje.id}, ${viaje.totalLitrosFinca || 0}, ${viaje.usuarioId || viaje.conductorId || 'null'})" style="font-weight: 700; background: linear-gradient(135deg, #7c3aed, #9333ea); border: none; height: 38px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; color: #fff; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                    <i class="fa-solid fa-building-circle-check"></i> Enviar a Compañía
                </button>
                <button type="button" class="btn" onclick="abrirModalTraspasoLeche(${viaje.id}, ${viaje.totalLitrosFinca || 0}, ${viaje.usuarioId || viaje.conductorId || 'null'})" style="font-weight: 700; background: linear-gradient(135deg, #0d9488, #059669); border: none; height: 38px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; color: #fff; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);">
                    <i class="fa-solid fa-right-left"></i> Traspaso de Leche
                </button>
                <button type="button" class="btn btn-outline" onclick="verTrazabilidadViaje(${viaje.id})" title="Ver Trazabilidad" style="height: 38px; padding: 0 14px; border-color: rgba(255,255,255,0.2); color: #94a3b8;">
                    <i class="fa-solid fa-timeline"></i>
                </button>
            `;
        } else if (procesoId === 2) { // RECIBIDO
            actualizarEstadoBotonNuevoViaje(null);

            badgeProceso = `
                <span class="ticket-status-badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">
                    <i class="fa-solid fa-scale-balanced"></i> EN RECEPTORÍA (POR MEDIR)
                </span>
            `;
            botonesAccion = `
                <button type="button" class="btn btn-cyan" onclick="irAPestana('receptoria')" style="font-weight: 700; height: 38px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Ir a Receptoría
                </button>
                <button type="button" class="btn btn-outline" onclick="verTrazabilidadViaje(${viaje.id})" title="Ver Trazabilidad" style="height: 38px; padding: 0 14px;">
                    <i class="fa-solid fa-timeline"></i>
                </button>
            `;
        } else if (procesoId === 3) { // ENTREGADO
            actualizarEstadoBotonNuevoViaje(null);

            badgeProceso = `
                <span class="ticket-status-badge" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.4);">
                    <i class="fa-solid fa-building"></i> EN PLANTA / QUESERA
                </span>
            `;
            botonesAccion = `
                <button type="button" class="btn btn-outline" onclick="verTrazabilidadViaje(${viaje.id})" title="Ver Trazabilidad" style="height: 38px; padding: 0 14px;">
                    <i class="fa-solid fa-timeline"></i> Ver Trazabilidad
                </button>
            `;
        }

        if (container) {
            container.innerHTML = `
                <div class="ticket-banner-hero">
                    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                ${badgeProceso}
                                <strong style="color: #60a5fa; font-size: 14.5px;">Ticket #${viaje.id}</strong>
                            </div>
                            <div style="font-size: 12.5px; color: #cbd5e1;">
                                <i class="fa-solid fa-user-tie" style="color: #94a3b8; margin-right: 4px;"></i> Chofer: <strong style="color: #fff;">${viaje.nombreConductor || 'Yo'}</strong>
                                <span style="margin: 0 8px; color: #475569;">&bull;</span>
                                <i class="fa-regular fa-calendar" style="color: #94a3b8; margin-right: 4px;"></i> Fecha: <strong>${(viaje.fecha || '').split('T')[0]}</strong>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div class="ticket-stat-box">
                                <div class="ticket-stat-val">${(viaje.totalLitrosFinca || 0).toLocaleString('es-VE')}</div>
                                <div class="ticket-stat-lbl">Litros en Tanque</div>
                            </div>
                            <div class="ticket-stat-box">
                                <div class="ticket-stat-val" style="color: #fde047;">${viaje.totalFincas || 0}</div>
                                <div class="ticket-stat-lbl">Fincas</div>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        ${botonesAccion}
                    </div>
                </div>
            `;
        }

        if (typeof cargarDespachoActivoChofer === 'function') {
            await cargarDespachoActivoChofer();
        }
    } catch (e) {
        console.error('Error al cargar viaje activo:', e);
    }
}
window.cargarViajeActivoChofer = cargarViajeActivoChofer;

// 2. ABRIR Y CONFIRMAR INICIAR VIAJE
let comboboxIniciarViajeConductorInstance = null;
function initIniciarViajeCombobox() {
    if (!comboboxIniciarViajeConductorInstance && document.getElementById('comboboxIniciarViajeConductor')) {
        comboboxIniciarViajeConductorInstance = setupCombobox({
            containerId: 'comboboxIniciarViajeConductor',
            inputSearchId: 'searchIniciarViajeConductorInput',
            inputHiddenId: 'selectIniciarViajeConductor',
            dropdownId: 'dropdownIniciarViajeConductorList',
            placeholder: 'SELECCIONE O BUSQUE CONDUCTOR...',
            getItemsFn: () => (state.choferes || []).map(c => ({
                value: c.id || c.Id,
                label: capitalizarTexto(c.nombreCompleto || c.NombreCompleto || c.username || c.Username),
                sub: (c.cedula || c.Cedula) ? `C.I: ${c.cedula || c.Cedula}` : ''
            })),
            onSelect: async (item) => {
                if (!item || !item.value) return;
                await _verificarViajeActivoConductorModal(item.value, item.label);
            }
        });
    }
}
window.initIniciarViajeCombobox = initIniciarViajeCombobox;

/**
 * Verifica si el conductor seleccionado tiene un viaje activo (En Ruta o Receptoría).
 * Si el usuario es ADMIN: La fecha SIEMPRE permanece 100% editable y libre para crear tickets de cualquier día.
 * Si el usuario es CHOFER: Bloquea la fecha para mantener su viaje en curso.
 */
async function _verificarViajeActivoConductorModal(conductorId, conductorNombre) {
    const inputFecha = document.getElementById('inputIniciarViajeFecha');
    const bannerViaje = document.getElementById('bannerViajeActivoConductorModal');

    if (!inputFecha) return;

    // Limpiar banner previo
    if (bannerViaje) bannerViaje.remove();

    const esAdmin = state.user && state.user.rol === 'ADMIN';

    // Como ADMIN, la fecha NUNCA se bloquea
    if (esAdmin) {
        inputFecha.disabled = false;
        inputFecha.style.opacity = '';
        inputFecha.style.cursor = '';
        inputFecha.title = '';
    }

    try {
        const res = await fetch(`${API_BASE}/control-rutas/viaje-activo?choferId=${conductorId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.status === 204 || res.status === 404) {
            inputFecha.disabled = false;
            inputFecha.style.opacity = '';
            inputFecha.style.cursor = '';
            inputFecha.title = '';
            return;
        }

        if (!res.ok) return;

        const viaje = await res.json();
        if (!viaje || !viaje.id) {
            inputFecha.disabled = false;
            inputFecha.style.opacity = '';
            inputFecha.style.cursor = '';
            inputFecha.title = '';
            return;
        }

        const fechaTicket = (viaje.fecha || '').split('T')[0];

        if (esAdmin) {
            // El ADMIN puede crear tickets de distintas fechas libremente
            inputFecha.disabled = false;
            inputFecha.style.opacity = '';
            inputFecha.style.cursor = '';
            inputFecha.title = 'Como Administrador puedes seleccionar cualquier fecha para este chofer';

            const grupoFecha = inputFecha.closest('div');
            if (grupoFecha && !document.getElementById('bannerViajeActivoConductorModal')) {
                const banner = document.createElement('div');
                banner.id = 'bannerViajeActivoConductorModal';
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; background: rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.35); border-radius:8px; padding:8px 12px; margin-top:6px; font-size:12.5px; color:#60a5fa;">
                        <i class="fa-solid fa-circle-info" style="font-size:14px; flex-shrink:0; color:#3b82f6;"></i>
                        <span>
                            <strong>${conductorNombre}</strong> tiene el <strong>Ticket #${viaje.id}</strong> activo (${viaje.nombreProceso || 'En Ruta'}) del día <strong>${fechaTicket}</strong>. Como Administrador puedes abrir este nuevo ticket en la fecha que desees.
                        </span>
                    </div>
                `;
                grupoFecha.appendChild(banner);
            }
        } else {
            // Para el CHOFER: fijar y bloquear fecha a su ticket activo
            inputFecha.value = fechaTicket;
            inputFecha.disabled = true;
            inputFecha.style.opacity = '0.65';
            inputFecha.style.cursor = 'not-allowed';
            inputFecha.title = `Bloqueado: ${conductorNombre} tiene el Ticket #${viaje.id} activo (${viaje.nombreProceso || 'En Ruta'}) para esta fecha`;

            const grupoFecha = inputFecha.closest('div');
            if (grupoFecha && !document.getElementById('bannerViajeActivoConductorModal')) {
                const banner = document.createElement('div');
                banner.id = 'bannerViajeActivoConductorModal';
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; background: rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); border-radius:8px; padding:8px 12px; margin-top:6px; font-size:12.5px; color:#fbbf24;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:14px; flex-shrink:0;"></i>
                        <span>
                            Tienes el <strong>Ticket #${viaje.id}</strong> activo <span style="color:#94a3b8;">(${viaje.nombreProceso || 'En Ruta'})</span>.
                        </span>
                    </div>
                `;
                grupoFecha.appendChild(banner);
            }
        }

    } catch (err) {
        console.warn('Error al verificar viaje activo del conductor:', err);
    }
}
window._verificarViajeActivoConductorModal = _verificarViajeActivoConductorModal;


function abrirModalIniciarViaje() {
    initIniciarViajeCombobox();

    // Limpiar banner previo y restaurar estado habilitado de fecha
    const bannerPrevio = document.getElementById('bannerViajeActivoConductorModal');
    if (bannerPrevio) bannerPrevio.remove();

    const inputFecha = document.getElementById('inputIniciarViajeFecha');
    if (inputFecha) {
        inputFecha.disabled = false;
        inputFecha.style.opacity = '';
        inputFecha.style.cursor = '';
        inputFecha.title = '';
        const fechaActual = state.rutasFechaFiltro || document.getElementById('filtroFechaGlobalRutas')?.value || new Date().toISOString().split('T')[0];
        inputFecha.value = fechaActual;
    }

    const groupConductor = document.getElementById('groupIniciarViajeConductor');

    if (!state.user || state.user.rol !== 'CHOFER') {
        if (groupConductor) groupConductor.style.display = 'block';
        const hiddenCond = document.getElementById('selectIniciarViajeConductor');
        if (hiddenCond) hiddenCond.value = '';
        if (comboboxIniciarViajeConductorInstance) {
            comboboxIniciarViajeConductorInstance.reset();
        }
    } else {
        if (groupConductor) groupConductor.style.display = 'none';
        const hiddenCond = document.getElementById('selectIniciarViajeConductor');
        if (hiddenCond) hiddenCond.value = state.user?.id || '';

        if (state.user?.id && inputFecha) {
            _verificarViajeActivoConductorModal(state.user.id, state.user.nombreCompleto || state.user.username || 'Tú');
        }
    }

    const obsInput = document.getElementById('inputIniciarViajeObs');
    if (obsInput) obsInput.value = '';

    abrirModalCustom('modalIniciarViaje');
}
window.abrirModalIniciarViaje = abrirModalIniciarViaje;

async function confirmarIniciarViaje(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const fecha = document.getElementById('inputIniciarViajeFecha')?.value;
    let conductorId = parseInt(document.getElementById('selectIniciarViajeConductor')?.value) || null;

    if (state.user && state.user.rol === 'CHOFER') {
        conductorId = state.user.id;
    }

    if (!conductorId || conductorId <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Conductor Requerido',
            text: 'Debe seleccionar un conductor asignado para iniciar el viaje / ticket de ruta.',
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    const observacion = document.getElementById('inputIniciarViajeObs')?.value || '';

    try {
        const res = await fetch(`${API_BASE}/control-rutas/iniciar-viaje`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ fecha, conductorId, observacion })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al iniciar viaje' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const data = await res.json();
        cerrarModalCustom('modalIniciarViaje');

        const condObj = (state.choferes || []).find(c => (c.id || c.Id) == conductorId) || state.user;
        const condNombre = condObj ? (condObj.nombreCompleto || condObj.NombreCompleto || condObj.username || 'Conductor') : 'Conductor';

        // 1. Asignar ticket como activo para el registro reactivo de fincas
        state.ticketAsignadoActivo = data.id;
        state.filtroTicketId = data.id;
        state.rutasFechaFiltro = fecha;

        // 2. Notificación
        Swal.fire({
            icon: 'success',
            title: `¡Ticket #${data.id} Creado!`,
            text: `Viaje abierto para ${condNombre}. Puedes proceder a registrar las fincas a continuación.`,
            background: '#ffffff',
            color: '#0f172a',
            timer: 2500,
            showConfirmButton: false
        });

        // 3. Conmutar a vista de detalle por fincas
        conmutarVistaRutas('fincas');

        // 4. Configurar formulario de captura y filtros de búsqueda de la tabla
        initRutasFormComboboxes();
        sincronizarBloqueoTicketFormulario(data.id, fecha, conductorId, condNombre);

        const inputFechaRutas = document.getElementById('filtroFechaRutas');
        if (inputFechaRutas) inputFechaRutas.value = fecha;
        const inputFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
        if (inputFechaGlobal) inputFechaGlobal.value = fecha;

        initFiltrosComboboxes();
        if (comboboxFiltroChoferInstance && condNombre) {
            comboboxFiltroChoferInstance.selectItem(condNombre, capitalizarTexto(condNombre));
        }
        const hidChofer = document.getElementById('filterChoferVal');
        if (hidChofer) hidChofer.value = condNombre;
        const inChofer = document.getElementById('searchFiltroChoferInput');
        if (inChofer) inChofer.value = capitalizarTexto(condNombre);

        // 5. Mostrar banner de ticket activo en formulario
        const bannerActivo = document.getElementById('bannerTicketActivoForm');
        if (bannerActivo) {
            bannerActivo.style.display = 'flex';
            const lblNum = document.getElementById('lblTicketActivoNumero');
            if (lblNum) lblNum.innerText = data.id;
            const lblChofer = document.getElementById('lblTicketActivoChofer');
            if (lblChofer) lblChofer.innerText = condNombre;
        }

        await cargarViajeActivoChofer();
        await cargarRutasHoy(fecha);
        if (typeof cargarViajesRutasDelDia === 'function') {
            await cargarViajesRutasDelDia(fecha);
        }

        // 6. Enfocar selector de fincas para captura inmediata
        setTimeout(() => {
            const searchFinca = document.getElementById('searchFincaInput');
            if (searchFinca) searchFinca.focus();
        }, 400);

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.confirmarIniciarViaje = confirmarIniciarViaje;

// 3. ENVIAR A RECEPTORÍA
function abrirModalEnviarReceptoria(ticketId, litros, fincas) {
    document.getElementById('hiddenEnviarReceptoriaTicketId').value = ticketId;
    document.getElementById('lblEnviarReceptoriaTicketId').innerText = `#${ticketId}`;
    document.getElementById('lblEnviarReceptoriaLitros').innerText = `${Number(litros).toLocaleString('es-VE')} Lts`;
    document.getElementById('lblEnviarReceptoriaFincas').innerText = fincas;
    document.getElementById('inputEnviarReceptoriaObs').value = '';

    abrirModalCustom('modalEnviarReceptoria');
}
window.abrirModalEnviarReceptoria = abrirModalEnviarReceptoria;

async function confirmarEnviarReceptoria(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ticketId = document.getElementById('hiddenEnviarReceptoriaTicketId')?.value;
    const observacion = document.getElementById('inputEnviarReceptoriaObs')?.value || '';

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/enviar-receptoria`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ observacion })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al enviar a receptoría' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalEnviarReceptoria');

        // Desvincular ticket activo del formulario ya que fue despachado
        actualizarEstadoBotonNuevoViaje(null);
        state.ticketAsignadoActivo = null;
        const banner = document.getElementById('bannerTicketActivoForm');
        if (banner) banner.style.display = 'none';

        Swal.fire({
            icon: 'success',
            title: '¡Despachado a Receptoría!',
            text: `El viaje #${ticketId} ha sido enviado a receptoría para pesaje y control. El botón de Nuevo Viaje ha sido habilitado nuevamente.`,
            background: '#ffffff',
            color: '#0f172a',
            timer: 2400,
            showConfirmButton: false
        });

        await cargarViajeActivoChofer();
        if (typeof cargarViajesRutasDelDia === 'function') {
            await cargarViajesRutasDelDia();
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message,
            background: '#ffffff',
            color: '#0f172a'
        });
    }
}
window.confirmarEnviarReceptoria = confirmarEnviarReceptoria;

// 3.1. TRASPASO DE LECHE A OTRO CHOFER / TICKET
async function abrirModalTraspasoLeche(ticketId, litros, choferId = null) {
    let v = (state.viajesDelDia || []).find(x => x.id == ticketId) 
         || (state.viajesReceptoria || []).find(x => x.id == ticketId)
         || (stateViajes?.listaViajes || []).find(x => x.id == ticketId)
         || stateViajes?.viajeActivo;

    let litrosFinca = Number(litros || v?.totalLitrosFinca || v?.TotalLitrosFinca || v?._litrosRecogidos || 0);
    let choferNom = v?.nombreConductor || v?.NombreConductor || v?._nombreConductor || state.user?.nombreCompleto || 'Conductor';
    let fechaTicket = (v?.fecha || '').split('T')[0] || new Date().toISOString().split('T')[0];

    document.getElementById('hiddenTraspasoTicketOrigenId').value = ticketId;
    document.getElementById('hiddenTraspasoLitrosDisponibles').value = litrosFinca;
    document.getElementById('lblTraspasoOrigenInfo').innerText = `Ticket #${ticketId} · ${choferNom}`;
    document.getElementById('lblTraspasoLitrosOrigen').innerText = `${litrosFinca.toLocaleString('es-VE')} Lts`;
    document.getElementById('inputTraspasoLitros').value = litrosFinca;
    document.getElementById('inputTraspasoFechaDestino').value = fechaTicket;
    document.getElementById('inputTraspasoObservacion').value = '';

    conmutarModoTraspaso('EXISTENTE');

    abrirModalCustom('modalTraspasoLeche');

    // 1. Poblar selector de choferes para creación automática
    const selectChofer = document.getElementById('selectTraspasoChoferDestino');
    if (selectChofer) {
        const uidOrigen = choferId || v?.usuarioId || v?.conductorId;
        const choferesDestino = (state.choferes || []).filter(c => {
            const cId = c.id || c.Id;
            return cId != uidOrigen && (c.activo !== false && c.Activo !== false);
        });

        selectChofer.innerHTML = '<option value="">Seleccione Conductor Destino...</option>' + choferesDestino.map(c => `
            <option value="${c.id || c.Id}">${c.nombreCompleto || c.NombreCompleto || c.nombre || 'Chofer'}</option>
        `).join('');
    }

    // 2. Poblar selector de tickets abiertos
    const selectTicket = document.getElementById('selectTraspasoTicketDestino');
    if (selectTicket) {
        selectTicket.innerHTML = '<option value="">Buscando tickets abiertos disponibles...</option>';
        try {
            const res = await fetch(`${API_BASE}/control-rutas?fechaInicio=${fechaTicket}&fechaFin=${fechaTicket}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            let tickets = res.ok ? await res.json() : [];
            let ticketsDisponibles = (tickets || []).filter(t => {
                const tId = t.id || t.Id;
                return tId != ticketId && (t.procesoActualId === 1 || t.procesoActualId === 2 || (t.estado || '').toUpperCase() === 'ABIERTO');
            });

            if (!ticketsDisponibles.length) {
                const resAlt = await fetch(`${API_BASE}/control-rutas`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
                if (resAlt.ok) {
                    const todosT = await resAlt.json();
                    ticketsDisponibles = (todosT || []).filter(t => {
                        const tId = t.id || t.Id;
                        return tId != ticketId && (t.procesoActualId === 1 || (t.estado || '').toUpperCase() === 'ABIERTO');
                    });
                }
            }

            if (ticketsDisponibles.length > 0) {
                selectTicket.innerHTML = '<option value="">Seleccione Ticket de Destino...</option>' + ticketsDisponibles.map(t => {
                    const tId = t.id || t.Id;
                    const cNom = t.nombreConductor || 'Conductor';
                    const lts = Number(t.totalLitrosFinca || 0);
                    const fStr = (t.fecha || '').split('T')[0];
                    return `<option value="${tId}">Ticket #${tId} - ${cNom} (${lts.toLocaleString('es-VE')} Lts en Fincas · ${fStr})</option>`;
                }).join('');
            } else {
                selectTicket.innerHTML = '<option value="">No hay otros tickets abiertos hoy (Use Crear Ticket Automático)</option>';
                conmutarModoTraspaso('NUEVO');
            }
        } catch (e) {
            selectTicket.innerHTML = '<option value="">Error al cargar tickets (Use Crear Ticket Automático)</option>';
        }
    }

    actualizarPrevisualizacionTraspaso();
}
window.abrirModalTraspasoLeche = abrirModalTraspasoLeche;

function prepararTraspasoLeche(ticketId) {
    let v = (state.viajesDelDia || []).find(x => x.id == ticketId) 
         || (state.viajesReceptoria || []).find(x => x.id == ticketId)
         || (stateViajes?.listaViajes || []).find(x => x.id == ticketId)
         || stateViajes?.viajeActivo;
    const lts = v?.totalLitrosFinca || v?.TotalLitrosFinca || v?._litrosRecogidos || 0;
    const choferId = v?.usuarioId || v?.conductorId || null;
    abrirModalTraspasoLeche(ticketId, lts, choferId);
}
window.prepararTraspasoLeche = prepararTraspasoLeche;

function conmutarModoTraspaso(modo) {
    const hiddenModo = document.getElementById('hiddenTraspasoModo');
    if (hiddenModo) hiddenModo.value = modo;
    const btnEx = document.getElementById('btnModoTraspasoExistente');
    const btnNu = document.getElementById('btnModoTraspasoNuevo');
    const secEx = document.getElementById('seccionTraspasoExistente');
    const secNu = document.getElementById('seccionTraspasoNuevo');

    if (modo === 'EXISTENTE') {
        if (btnEx) {
            btnEx.style.background = '#0d9488';
            btnEx.style.color = '#ffffff';
            btnEx.style.fontWeight = '800';
        }
        if (btnNu) {
            btnNu.style.background = 'transparent';
            btnNu.style.color = '#475569';
            btnNu.style.fontWeight = '700';
        }
        if (secEx) secEx.style.display = 'block';
        if (secNu) secNu.style.display = 'none';
    } else {
        if (btnNu) {
            btnNu.style.background = '#0d9488';
            btnNu.style.color = '#ffffff';
            btnNu.style.fontWeight = '800';
        }
        if (btnEx) {
            btnEx.style.background = 'transparent';
            btnEx.style.color = '#475569';
            btnEx.style.fontWeight = '700';
        }
        if (secEx) secEx.style.display = 'none';
        if (secNu) secNu.style.display = 'block';
    }

    actualizarPrevisualizacionTraspaso();
}
window.conmutarModoTraspaso = conmutarModoTraspaso;

function cargarTodoElVolumenTraspaso() {
    const total = document.getElementById('hiddenTraspasoLitrosDisponibles')?.value || 0;
    const inputLts = document.getElementById('inputTraspasoLitros');
    if (inputLts) {
        inputLts.value = total;
        actualizarPrevisualizacionTraspaso();
    }
}
window.cargarTodoElVolumenTraspaso = cargarTodoElVolumenTraspaso;

function actualizarPrevisualizacionTraspaso() {
    const origenInfo = document.getElementById('lblTraspasoOrigenInfo')?.innerText || 'Chofer Origen';
    const lts = document.getElementById('inputTraspasoLitros')?.value || '0';
    const modo = document.getElementById('hiddenTraspasoModo')?.value || 'EXISTENTE';

    const lblOrigen = document.getElementById('lblPreviewOrigen');
    const lblDestino = document.getElementById('lblPreviewDestino');

    if (lblOrigen) {
        lblOrigen.innerHTML = `<span>${origenInfo}</span><strong style="color: #0d9488; display: block; margin-top: 2px;">-${Number(lts).toLocaleString('es-VE')} Lts</strong>`;
    }

    if (lblDestino) {
        if (modo === 'EXISTENTE') {
            const selTicket = document.getElementById('selectTraspasoTicketDestino');
            const opt = selTicket && selTicket.selectedIndex >= 0 ? selTicket.options[selTicket.selectedIndex] : null;
            const textDest = (opt && opt.value) ? opt.text : 'Seleccionar Ticket Destino';
            lblDestino.innerHTML = `<span>${textDest}</span><strong style="color: #059669; display: block; margin-top: 2px;">+${Number(lts).toLocaleString('es-VE')} Lts</strong>`;
        } else {
            const selChofer = document.getElementById('selectTraspasoChoferDestino');
            const optC = selChofer && selChofer.selectedIndex >= 0 ? selChofer.options[selChofer.selectedIndex] : null;
            const textChofer = (optC && optC.value) ? optC.text : 'Seleccionar Chofer';
            lblDestino.innerHTML = `<span>Nuevo Ticket (${textChofer})</span><strong style="color: #059669; display: block; margin-top: 2px;">+${Number(lts).toLocaleString('es-VE')} Lts</strong>`;
        }
    }
}
window.actualizarPrevisualizacionTraspaso = actualizarPrevisualizacionTraspaso;

async function confirmarTraspasoLeche(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ticketId = document.getElementById('hiddenTraspasoTicketOrigenId')?.value;
    const modo = document.getElementById('hiddenTraspasoModo')?.value || 'EXISTENTE';
    const litrosTraspaso = parseInt(document.getElementById('inputTraspasoLitros')?.value) || 0;
    const observacion = document.getElementById('inputTraspasoObservacion')?.value || '';

    if (!ticketId) {
        Swal.fire({ icon: 'warning', title: 'Atención', text: 'No se identificó el ticket de origen.', background: '#ffffff', color: '#0f172a' });
        return;
    }

    if (litrosTraspaso <= 0) {
        Swal.fire({ icon: 'warning', title: 'Litros inválidos', text: 'Debe ingresar una cantidad mayor a 0 litros para traspasar.', background: '#ffffff', color: '#0f172a' });
        return;
    }

    const payload = {
        litrosTraspaso: litrosTraspaso,
        observacion: observacion
    };

    if (modo === 'EXISTENTE') {
        const ticketDestinoId = parseInt(document.getElementById('selectTraspasoTicketDestino')?.value) || 0;
        if (!ticketDestinoId) {
            Swal.fire({ icon: 'warning', title: 'Ticket Destino Requerido', text: 'Por favor seleccione el ticket de destino existente o cambie al modo Crear Ticket Automático.', background: '#ffffff', color: '#0f172a' });
            return;
        }
        payload.ticketDestinoId = ticketDestinoId;
    } else {
        const choferDestinoId = parseInt(document.getElementById('selectTraspasoChoferDestino')?.value) || 0;
        const fechaDestino = document.getElementById('inputTraspasoFechaDestino')?.value || null;

        if (!choferDestinoId) {
            Swal.fire({ icon: 'warning', title: 'Chofer Destino Requerido', text: 'Por favor seleccione el chofer que recibirá el traspaso.', background: '#ffffff', color: '#0f172a' });
            return;
        }
        payload.choferDestinoId = choferDestinoId;
        payload.fechaDestino = fechaDestino;
    }

    const btnSubmit = document.getElementById('btnSubmitTraspasoLeche');
    const origHtml = btnSubmit ? btnSubmit.innerHTML : '';
    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traspasando...';
        btnSubmit.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/traspasar-leche`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al realizar el traspaso' }));
            throw new Error(err.message || 'Error en el servidor al realizar el traspaso');
        }

        const data = await res.json();

        cerrarModalCustom('modalTraspasoLeche');

        // Desvincular ticket activo del formulario ya que fue traspasado/finalizado
        actualizarEstadoBotonNuevoViaje(null);
        state.ticketAsignadoActivo = null;
        const banner = document.getElementById('bannerTicketActivoForm');
        if (banner) banner.style.display = 'none';

        Swal.fire({
            icon: 'success',
            title: '¡Traspaso Exitoso!',
            text: data.mensaje || `Se traspasaron exitosamente ${litrosTraspaso.toLocaleString('es-VE')} Lts al Ticket #${data.ticketDestinoId}.`,
            background: '#ffffff',
            color: '#0f172a',
            timer: 3500,
            showConfirmButton: true,
            confirmButtonText: 'Entendido'
        });

        await cargarViajeActivoChofer();
        if (typeof cargarViajesRutasDelDia === 'function') await cargarViajesRutasDelDia();
        if (typeof cargarBandejaReceptoria === 'function') await cargarBandejaReceptoria();
        if (typeof cargarControlViajesTickets === 'function') await cargarControlViajesTickets();
        if (typeof cargarDashboard === 'function') await cargarDashboard();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al realizar traspaso',
            text: err.message,
            background: '#ffffff',
            color: '#0f172a'
        });
    } finally {
        if (btnSubmit) {
            btnSubmit.innerHTML = origHtml;
            btnSubmit.disabled = false;
        }
    }
}
window.confirmarTraspasoLeche = confirmarTraspasoLeche;

// 4. ENTREGA DIRECTA A COMPAÑÍAS / RECEPTORÍA (MULTI-DESTINO CON BUSCADOR)
async function abrirModalEntregaDirecta(ticketId, totalLecheCamion, ltsFinca = null, ltsTraspaso = null) {
    let v = (state.viajesDelDia || []).find(x => x.id == ticketId)
         || (state.viajesReceptoria || []).find(x => x.id == ticketId)
         || (stateViajes?.listaViajes || []).find(x => x.id == ticketId)
         || stateViajes?.viajeActivo;

    if (!v) {
        try {
            const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) {
                v = await res.json();
            }
        } catch (e) {}
    }

    const litrosFinca = ltsFinca !== null ? Number(ltsFinca) : Number(v?.totalLitrosFinca || v?.TotalLitrosFinca || 0);
    const litrosTraspaso = ltsTraspaso !== null ? Number(ltsTraspaso) : Number(v?.litrosCargadosAdicional || v?.LitrosCargadosAdicional || 0);
    const totalLitros = (totalLecheCamion !== undefined && totalLecheCamion !== null)
        ? Number(totalLecheCamion) 
        : (litrosFinca + litrosTraspaso);

    document.getElementById('hiddenEntregaDirectaTicketId').value = ticketId;
    document.getElementById('hiddenEntregaDirectaLitrosFinca').value = totalLitros || 0;
    const inputPrevios = document.getElementById('hiddenEntregaDirectaLitrosPrevios');
    if (inputPrevios) inputPrevios.value = 0;

    const lblTotal = document.getElementById('lblEntregaDirectaLitrosFinca');
    if (lblTotal) {
        lblTotal.innerText = `${Number(totalLitros || 0).toLocaleString('es-VE')} Lts`;
    }

    const lblDesglose = document.getElementById('lblEntregaDirectaDesgloseTraspaso');
    if (lblDesglose) {
        if (litrosTraspaso > 0) {
            lblDesglose.innerText = `${litrosFinca.toLocaleString('es-VE')} L fincas + +${litrosTraspaso.toLocaleString('es-VE')} L traspaso`;
            lblDesglose.style.display = 'block';
        } else {
            lblDesglose.style.display = 'none';
        }
    }

    const lblPrev = document.getElementById('lblEntregaDirectaLitrosPrevios');
    if (lblPrev) lblPrev.innerText = '0 Lts';
    const lblFalt = document.getElementById('lblEntregaDirectaLitrosFaltantes');
    if (lblFalt) lblFalt.innerText = `${Number(totalLitros || 0).toLocaleString('es-VE')} Lts`;

    const subtexto = document.getElementById('lblEntregaDirectaSubtexto');
    if (subtexto) {
        const cond = v?.nombreConductor || v?.NombreConductor || state.user?.nombreCompleto || 'Conductor';
        subtexto.innerHTML = `<span>Ticket de Ruta #${ticketId} · Chofer: <strong>${cond}</strong></span>`;
    }

    const boxPrevios = document.getElementById('contenedorDespachosPreviosTicket');
    if (boxPrevios) {
        boxPrevios.style.display = 'none';
        boxPrevios.innerHTML = '';
    }

    const container = document.getElementById('contenedorFilasEntregaDirecta');
    if (container) {
        container.innerHTML = '<div style="padding: 12px; text-align: center; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando destinos y desglose...</div>';
    }

    document.getElementById('inputEntregaDirectaObs').value = '';
    abrirModalCustom('modalEntregaDirecta');

    // 1. Consultar desglose de fincas del ticket para identificar servicios, compañías de destino y tipos de leche
    let totalVaca = 0;
    let totalBufala = 0;
    let totalAcida = 0;
    let totalBufalaAcida = 0;
    const desgloseServicios = {
        1: { ltsTotal: 0, ltsVaca: 0, ltsBufala: 0, ltsAcida: 0, ltsBufalaAcida: 0, nombre: 'Servicio de Ruta' },
        2: { ltsTotal: 0, ltsVaca: 0, ltsBufala: 0, ltsAcida: 0, ltsBufalaAcida: 0, nombre: 'Servicio de Transporte' }
    };
    const destinosAgrupadosFincas = {}; // key: `${targetCompId}_${tipoLeche}`

    // Asegurar que state.companias esté cargado
    if (!state.companias || !state.companias.length) {
        try {
            const respC = await fetch(`${API_BASE}/catalogos/companias`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (respC.ok) {
                state.companias = await respC.json();
            }
        } catch (e) {}
    }

    // Identificar compañías por defecto para Ruta (Receptoría) y Transporte (Colona/Queseras)
    const compRecep = (state.companias || []).find(c => {
        const nom = (c.nombre || c.Nombre || '').toUpperCase();
        return nom.includes('RECEPTORIA') || nom.includes('RECEPTORÍA');
    });

    const compTransp = (state.companias || []).find(c => {
        const nom = (c.nombre || c.Nombre || '').toUpperCase();
        const ts = Number(c.tipoServicioId || c.TipoServicioId || 1);
        return ts === 2 || (c.tipoServicioNombre || '').toUpperCase().includes('TRANSPORTE') || nom.includes('COLONA');
    }) || (state.companias || []).find(c => {
        const nom = (c.nombre || c.Nombre || '').toUpperCase();
        return !nom.includes('RECEPTORIA') && !nom.includes('RECEPTORÍA');
    });

    try {
        let fincasTicket = [];
        const respF = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (respF.ok) {
            fincasTicket = await respF.json();
        }
        // Fallback: si el endpoint no retornó registros, buscar en state.rutas del viaje
        if (!fincasTicket || !fincasTicket.length) {
            fincasTicket = (state.rutas || []).filter(r => Number(r.controlRutaId || r.ControlRutaId) === Number(ticketId));
        }

        // Detectar compañía de transporte asignada en las fincas de este ticket
        let compTicketTranspId = null;
        if (fincasTicket && fincasTicket.length) {
            const fincaConCompTransp = fincasTicket.find(x => Number(x.tipoServicioId || x.TipoServicioId) === 2 && (x.companiaId || x.CompaniaId));
            if (fincaConCompTransp) {
                compTicketTranspId = fincaConCompTransp.companiaId || fincaConCompTransp.CompaniaId;
            }
        }
        if (!compTicketTranspId && compTransp) {
            compTicketTranspId = compTransp.id || compTransp.Id;
        }

        if (fincasTicket && fincasTicket.length) {
            fincasTicket.forEach(f => {
                const rawTipo = (f.tipoLeche || f.TipoLeche || 'VACA').toUpperCase();
                const isBuf = rawTipo.includes('BUFAL');
                const obs = (f.observacion || f.Observacion || '').toUpperCase();
                const esAcida = f.esAcida === true || f.EsAcida === true || f.esAcida === 1 || f.EsAcida === 1 
                             || String(f.esAcida).toLowerCase() === 'true' || String(f.EsAcida).toLowerCase() === 'true'
                             || rawTipo.includes('ACID') || rawTipo.includes('ÁCID') || rawTipo.includes('MALA')
                             || obs.includes('[ACIDA]') || obs.includes('[LECHE ÁCIDA]') || obs.includes('[LECHE ACIDA]')
                             || obs.includes('ÁCIDA') || obs.includes('ACIDA') || obs.includes('MALA');
                const tipo = esAcida ? (isBuf ? 'BUFALA_ACIDA' : 'ACIDA') : (isBuf ? 'BUFALA' : 'VACA');
                const lts = Number(f.litros || f.Litros || 0);
                const tipoServ = Number(f.tipoServicioId || f.TipoServicioId || 1);
                const compFincaId = f.companiaId || f.CompaniaId;

                if (!desgloseServicios[tipoServ]) {
                    desgloseServicios[tipoServ] = { ltsTotal: 0, ltsVaca: 0, ltsBufala: 0, ltsAcida: 0, ltsBufalaAcida: 0, nombre: `Servicio #${tipoServ}` };
                }
                desgloseServicios[tipoServ].ltsTotal += lts;

                if (esAcida) {
                    if (isBuf) {
                        totalBufalaAcida += lts;
                        desgloseServicios[tipoServ].ltsBufalaAcida = (desgloseServicios[tipoServ].ltsBufalaAcida || 0) + lts;
                    } else {
                        totalAcida += lts;
                        desgloseServicios[tipoServ].ltsAcida = (desgloseServicios[tipoServ].ltsAcida || 0) + lts;
                    }
                } else {
                    if (isBuf) {
                        totalBufala += lts;
                        desgloseServicios[tipoServ].ltsBufala += lts;
                    } else {
                        totalVaca += lts;
                        desgloseServicios[tipoServ].ltsVaca += lts;
                    }
                }

                // Determinar a qué compañía enviar esta leche:
                // - Si es ácida: se separa hacia Receptoría (o compañía asignada)
                // - Si es Servicio RUTA (1): va a Receptoría
                // - Si es Servicio TRANSPORTE (2): va a su compañía asignada (ej. COLONA), NUNCA a Receptoría
                let targetCompId = null;
                if (esAcida) {
                    targetCompId = compRecep ? (compRecep.id || compRecep.Id) : (compFincaId || null);
                } else if (tipoServ === 1) {
                    targetCompId = compFincaId || (compRecep ? (compRecep.id || compRecep.Id) : null);
                } else {
                    targetCompId = compFincaId || compTicketTranspId;
                }

                const key = `${targetCompId || (tipoServ === 2 ? 'transp' : 'ruta')}_${tipo}`;
                if (!destinosAgrupadosFincas[key]) {
                    destinosAgrupadosFincas[key] = {
                        companiaId: targetCompId,
                        tipoLeche: tipo,
                        tipoServ: tipoServ,
                        litros: 0
                    };
                }
                destinosAgrupadosFincas[key].litros += lts;
            });
        }
    } catch (errF) {
        console.warn('No se pudo obtener detalle de fincas del ticket:', errF);
    }

    // Si hay leche transferida, sumarla al servicio ruta
    if (litrosTraspaso > 0) {
        if (totalBufala > 0 && totalVaca === 0 && totalAcida === 0) {
            totalBufala += litrosTraspaso;
            desgloseServicios[1].ltsBufala += litrosTraspaso;
            desgloseServicios[1].ltsTotal += litrosTraspaso;
        } else {
            totalVaca += litrosTraspaso;
            desgloseServicios[1].ltsVaca += litrosTraspaso;
            desgloseServicios[1].ltsTotal += litrosTraspaso;
        }
        const keyTraspaso = `${(compRecep ? (compRecep.id || compRecep.Id) : 'null')}_${(totalBufala > 0 && totalVaca === 0 && totalAcida === 0) ? 'BUFALA' : 'VACA'}`;
        if (destinosAgrupadosFincas[keyTraspaso]) {
            destinosAgrupadosFincas[keyTraspaso].litros += litrosTraspaso;
        } else {
            destinosAgrupadosFincas[keyTraspaso] = {
                companiaId: compRecep ? (compRecep.id || compRecep.Id) : null,
                tipoLeche: (totalBufala > 0 && totalVaca === 0 && totalAcida === 0) ? 'BUFALA' : 'VACA',
                tipoServ: 1,
                litros: litrosTraspaso
            };
        }
    } else if (totalVaca === 0 && totalBufala === 0 && totalAcida === 0 && totalBufalaAcida === 0) {
        totalVaca = totalLitros;
        desgloseServicios[1].ltsVaca = totalLitros;
        desgloseServicios[1].ltsTotal = totalLitros;
    }

    // Guardar composición en inputs ocultos para balance y unificación
    const hidAcida = document.getElementById('hiddenEntregaDirectaLitrosAcida');
    if (hidAcida) hidAcida.value = totalAcida;
    const hidBufAcida = document.getElementById('hiddenEntregaDirectaLitrosBufalaAcida');
    if (hidBufAcida) hidBufAcida.value = totalBufalaAcida;
    const hidVaca = document.getElementById('hiddenEntregaDirectaLitrosVaca');
    if (hidVaca) hidVaca.value = totalVaca;
    const hidBufala = document.getElementById('hiddenEntregaDirectaLitrosBufala');
    if (hidBufala) hidBufala.value = totalBufala;

    // Actualizar badges en subtexto según composición de la leche y servicios
    if (subtexto) {
        const cond = v?.nombreConductor || v?.NombreConductor || state.user?.nombreCompleto || 'Conductor';

        let badgesTipoHtml = '';
        if (desgloseServicios[1]?.ltsTotal > 0 && desgloseServicios[2]?.ltsTotal > 0) {
            badgesTipoHtml += `
                <span class="badge" style="background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 6px;"><i class="fa-solid fa-route"></i> Ruta: ${desgloseServicios[1].ltsTotal.toLocaleString('es-VE')} L</span>
                <span class="badge" style="background: #fae8ff; color: #86198f; border: 1px solid #f0abfc; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-truck-moving"></i> Transp: ${desgloseServicios[2].ltsTotal.toLocaleString('es-VE')} L</span>
            `;
        } else if (desgloseServicios[2]?.ltsTotal > 0) {
            badgesTipoHtml += `
                <span class="badge" style="background: #fae8ff; color: #86198f; border: 1px solid #f0abfc; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 6px;"><i class="fa-solid fa-truck-moving"></i> Transp: ${desgloseServicios[2].ltsTotal.toLocaleString('es-VE')} L</span>
            `;
        } else if (desgloseServicios[1]?.ltsTotal > 0) {
            badgesTipoHtml += `
                <span class="badge" style="background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 6px;"><i class="fa-solid fa-route"></i> Ruta: ${desgloseServicios[1].ltsTotal.toLocaleString('es-VE')} L</span>
            `;
        }

        if (totalAcida > 0 || totalBufalaAcida > 0) {
            // Contiene leche ácida separada: mostrar cada tipo con su volumen real
            if (totalVaca > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-cow"></i> 🐄 ${totalVaca.toLocaleString('es-VE')} L Vaca</span>
                `;
            }
            if (totalBufala > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-leaf"></i> 🐃 ${totalBufala.toLocaleString('es-VE')} L Búfala</span>
                `;
            }
            if (totalAcida > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #fef2f2; color: #b91c1c; border: 1.5px solid #fca5a5; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-flask"></i> 🍋 ${totalAcida.toLocaleString('es-VE')} L Ácida</span>
                `;
            }
            if (totalBufalaAcida > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #fff7ed; color: #c2410c; border: 1.5px solid #fdba74; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-flask"></i> 🍋🐃 ${totalBufalaAcida.toLocaleString('es-VE')} L Búfala Ácida</span>
                `;
            }
        } else {
            // Leche 100% dulce / normal
            if (totalVaca > 0 && totalBufala > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-cow"></i> 🐄 ${totalVaca.toLocaleString('es-VE')} L Vaca</span>
                    <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-leaf"></i> 🐃 ${totalBufala.toLocaleString('es-VE')} L Búfala</span>
                `;
            } else if (totalBufala > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-leaf"></i> 🐃 100% Búfala (${totalBufala.toLocaleString('es-VE')} L)</span>
                `;
            } else if (totalVaca > 0) {
                badgesTipoHtml += `
                    <span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 800; margin-left: 4px;"><i class="fa-solid fa-cow"></i> 🐄 100% Vaca (${totalVaca.toLocaleString('es-VE')} L)</span>
                `;
            }
        }

        subtexto.innerHTML = `<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px;">Ticket de Ruta #${ticketId} · Chofer: <strong>${cond}</strong> ${badgesTipoHtml}</span>`;
    }

    // 2. Consultar si este ticket ya tiene despachos registrados
    try {
        const resp = await fetch(`${API_BASE}/control-rutas/${ticketId}/despachos`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (container) container.innerHTML = '';
        let totalPrevios = 0;
        if (resp.ok) {
            const despachos = await resp.json();
            if (despachos && despachos.length > 0) {
                totalPrevios = despachos.reduce((sum, d) => sum + (Number(d.litrosDespachados || d.LitrosDespachados || 0)), 0);
                if (inputPrevios) inputPrevios.value = totalPrevios;
                if (lblPrev) lblPrev.innerText = `${totalPrevios.toLocaleString('es-VE')} Lts`;

                // Mostrar tarjeta resumen de despachos previos con botón de eliminar individual
                if (boxPrevios) {
                    boxPrevios.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 12px; font-weight: 800; color: #86198f; text-transform: uppercase; letter-spacing: 0.04em;">
                                <i class="fa-solid fa-truck-ramp-box"></i> Despachos Registrados en este Ticket (${despachos.length})
                            </span>
                            <span style="font-size: 11px; font-weight: 700; color: #a21caf; background: #fae8ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #f0abfc;">
                                Total Ya Asignado: ${totalPrevios.toLocaleString('es-VE')} Lts
                            </span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${despachos.map(d => {
                                const rawT = (d.tipoLeche || d.TipoLeche || 'VACA').toUpperCase();
                                let badgeT = '<span style="font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; margin-left: 6px;">🐄 VACA</span>';
                                if (rawT.includes('ACID') || rawT.includes('ÁCID')) {
                                    badgeT = rawT.includes('BUFAL')
                                        ? '<span style="font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; margin-left: 6px;">🍋🐃 BÚFALA ÁCIDA</span>'
                                        : '<span style="font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; margin-left: 6px;">🍋 ÁCIDA</span>';
                                } else if (rawT.includes('BUFAL')) {
                                    badgeT = '<span style="font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; margin-left: 6px;">🐃 BÚFALA</span>';
                                }
                                return `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 7px 10px; border-radius: 8px; border: 1px solid #f5d0fe; font-size: 12px;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-weight: 800; color: #7e22ce;"><i class="fa-solid fa-receipt"></i> Salida #${d.id || d.Id}</span>
                                        <span style="color: #475569; font-weight: 600;">➔ ${d.nombreCompania || d.NombreCompania || 'Compañía'}</span>
                                        ${badgeT}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <strong style="color: #059669; font-size: 13px;">${Number(d.litrosDespachados || d.LitrosDespachados || 0).toLocaleString('es-VE')} Lts</strong>
                                        <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #fdf4ff; color: #9333ea; border: 1px solid #f0abfc;">
                                            ${(d.estado || d.Estado || 'EN VIA').toUpperCase()}
                                        </span>
                                        <button type="button" class="btn-icon" onclick="eliminarDespachoDirectoTicket(${d.id || d.Id}, ${ticketId}, ${totalLitros})" title="Eliminar este despacho" style="height: 24px; width: 24px; border-radius: 4px; border: 1px solid #fecaca; color: #ef4444; background: #fef2f2; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                    boxPrevios.style.display = 'block';
                }

                const litrosFaltantes = Math.max(0, (totalLitros || 0) - totalPrevios);
                const tipoSugerido = (totalBufala > 0 && totalVaca === 0 && totalAcida === 0) ? 'BUFALA' : (totalAcida > 0 && totalVaca === 0 ? 'ACIDA' : 'VACA');
                agregarFilaEntregaDirectaCompania(null, litrosFaltantes, tipoSugerido);
            } else {
                // Sin despachos previos:
                // Usar desglose automático agrupado por compañía de destino habitual y tipo de leche (separando ÁCIDA y TRANSPORTE vs RUTA)
                const destinosList = Object.values(destinosAgrupadosFincas).filter(d => d.litros > 0);

                if (destinosList.length > 0) {
                    destinosList.forEach(d => {
                        const finalCompId = d.companiaId || (d.tipoServ === 2 ? compTicketTranspId : (compRecep ? (compRecep.id || compRecep.Id) : null));
                        agregarFilaEntregaDirectaCompania(finalCompId, d.litros, d.tipoLeche);
                    });
                } else {
                    const ltsRuta = Number(desgloseServicios[1]?.ltsTotal || 0);
                    const ltsTransp = Number(desgloseServicios[2]?.ltsTotal || 0);
                    if (totalAcida > 0 || totalBufalaAcida > 0) {
                        const ltsNormal = Math.max(0, totalLitros - (totalAcida + totalBufalaAcida));
                        if (ltsNormal > 0) {
                            const tipoNorm = (totalBufala > 0 && totalVaca === 0) ? 'BUFALA' : 'VACA';
                            const compNorm = (ltsTransp > 0 && ltsRuta === 0) ? compTicketTranspId : (compRecep ? (compRecep.id || compRecep.Id) : null);
                            agregarFilaEntregaDirectaCompania(compNorm, ltsNormal, tipoNorm);
                        }
                        if (totalAcida > 0) {
                            agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalAcida, 'ACIDA');
                        }
                        if (totalBufalaAcida > 0) {
                            agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalBufalaAcida, 'BUFALA_ACIDA');
                        }
                    } else if (ltsRuta > 0 && ltsTransp > 0) {
                        const tipoRuta = (desgloseServicios[1]?.ltsBufala > 0 && desgloseServicios[1]?.ltsVaca === 0) ? 'BUFALA' : 'VACA';
                        const tipoTransp = (desgloseServicios[2]?.ltsBufala > 0 && desgloseServicios[2]?.ltsVaca === 0) ? 'BUFALA' : 'VACA';
                        agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, ltsRuta, tipoRuta);
                        agregarFilaEntregaDirectaCompania(compTicketTranspId, ltsTransp, tipoTransp);
                    } else if (ltsTransp > 0 && ltsRuta === 0) {
                        const tipoTransp = (desgloseServicios[2]?.ltsBufala > 0 && desgloseServicios[2]?.ltsVaca === 0) ? 'BUFALA' : 'VACA';
                        agregarFilaEntregaDirectaCompania(compTicketTranspId, ltsTransp, tipoTransp);
                    } else {
                        agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalLitros, (totalBufala > 0 && totalVaca === 0) ? 'BUFALA' : 'VACA');
                    }
                }
            }
        } else {
            if (totalAcida > 0 || totalBufalaAcida > 0) {
                const ltsNormal = Math.max(0, totalLitros - (totalAcida + totalBufalaAcida));
                if (ltsNormal > 0) {
                    agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, ltsNormal, (totalBufala > 0 && totalVaca === 0) ? 'BUFALA' : 'VACA');
                }
                if (totalAcida > 0) {
                    agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalAcida, 'ACIDA');
                }
                if (totalBufalaAcida > 0) {
                    agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalBufalaAcida, 'BUFALA_ACIDA');
                }
            } else {
                agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalLitros, (totalBufala > 0 && totalVaca === 0) ? 'BUFALA' : 'VACA');
            }
        }
    } catch (e) {
        console.error('Error al cargar despachos:', e);
        if (container) container.innerHTML = '';
        if (totalAcida > 0) {
            const ltsNormal = Math.max(0, totalLitros - totalAcida);
            if (ltsNormal > 0) agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, ltsNormal, 'VACA');
            agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalAcida, 'ACIDA');
        } else {
            agregarFilaEntregaDirectaCompania(compRecep ? (compRecep.id || compRecep.Id) : null, totalLitros, 'VACA');
        }
    }

    calcularDiferenciaEntregaDirectaLive();
}
window.abrirModalEntregaDirecta = abrirModalEntregaDirecta;

// 4.1 BOTÓN UNIFICAR LITROS (100% en un solo destino respetando Leche Ácida)
function unificarLitrosEntregaDirecta() {
    const totalLitros = parseInt(document.getElementById('hiddenEntregaDirectaLitrosFinca')?.value) || 0;
    const ltsPrevios = parseInt(document.getElementById('hiddenEntregaDirectaLitrosPrevios')?.value) || 0;
    const ltsAcida = parseInt(document.getElementById('hiddenEntregaDirectaLitrosAcida')?.value) || 0;
    const ltsBufalaAcida = parseInt(document.getElementById('hiddenEntregaDirectaLitrosBufalaAcida')?.value) || 0;
    const ltsBufala = parseInt(document.getElementById('hiddenEntregaDirectaLitrosBufala')?.value) || 0;

    const container = document.getElementById('contenedorFilasEntregaDirecta');
    if (container) {
        container.innerHTML = '';
    }

    // Identificar compañía receptoria por defecto
    const receptoria = (state.companias || []).find(c => {
        const nom = (c.nombre || c.Nombre || '').toUpperCase();
        return nom.includes('RECEPTORIA') || nom.includes('RECEPTORÍA');
    });
    const recepId = receptoria ? (receptoria.id || receptoria.Id) : null;
    const totalAcidaTotal = ltsAcida + ltsBufalaAcida;

    // Si el viaje contiene leche ácida, SIEMPRE se mantiene separada hacia Receptoría
    if (totalAcidaTotal > 0) {
        const ltsNormalPendiente = Math.max(0, totalLitros - ltsPrevios - totalAcidaTotal);
        if (ltsNormalPendiente > 0) {
            const tipoNormal = ltsBufala > 0 ? 'BUFALA' : 'VACA';
            agregarFilaEntregaDirectaCompania(recepId, ltsNormalPendiente, tipoNormal);
        }
        if (ltsAcida > 0) {
            agregarFilaEntregaDirectaCompania(recepId, ltsAcida, 'ACIDA');
        }
        if (ltsBufalaAcida > 0) {
            agregarFilaEntregaDirectaCompania(recepId, ltsBufalaAcida, 'BUFALA_ACIDA');
        }
    } else {
        const litrosPendientes = Math.max(0, totalLitros - ltsPrevios);
        const tipoNormal = ltsBufala > 0 ? 'BUFALA' : 'VACA';
        agregarFilaEntregaDirectaCompania(recepId, litrosPendientes, tipoNormal);
    }

    calcularDiferenciaEntregaDirectaLive();
}
window.unificarLitrosEntregaDirecta = unificarLitrosEntregaDirecta;

async function eliminarDespachoDirectoTicket(controlCompaniaId, ticketId, litrosFinca) {
    const res = await Swal.fire({
        title: `¿Eliminar Salida #${controlCompaniaId}?`,
        text: 'Se eliminará este despacho y se recalculará el balance del ticket.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!res.isConfirmed) return;

    try {
        const resp = await fetch(`${API_BASE}/control-rutas/despacho/${controlCompaniaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData?.message || 'No se pudo eliminar el despacho.');
        }

        Swal.fire({
            icon: 'success',
            title: 'Despacho eliminado',
            timer: 1500,
            showConfirmButton: false
        });

        // Recargar el modal y la bandeja
        await abrirModalEntregaDirecta(ticketId, litrosFinca);
        if (typeof cargarBandejaReceptoria === 'function') await cargarBandejaReceptoria();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    }
}
window.eliminarDespachoDirectoTicket = eliminarDespachoDirectoTicket;

function agregarFilaEntregaDirectaCompania(companiaIdSeleccionada = null, litrosSugeridos = null, tipoLecheSugerido = 'VACA') {
    const container = document.getElementById('contenedorFilasEntregaDirecta');
    if (!container) return;

    const totalLitrosCamion = parseInt(document.getElementById('hiddenEntregaDirectaLitrosFinca')?.value) || 0;
    const ltsPrevios = parseInt(document.getElementById('hiddenEntregaDirectaLitrosPrevios')?.value) || 0;

    // Autocompletado dinámico de litros:
    // Si no se especificaron litrosSugeridos (ej. el usuario hace clic en '+ Añadir Destino / Compañía'):
    // Calcular automáticamente los litros que aún faltan por asignar en las filas existentes
    let litrosFinales = litrosSugeridos;
    if (litrosFinales === null || litrosFinales === undefined) {
        let sumaFilasActuales = 0;
        const inputsExistentes = container.querySelectorAll('.input-fila-entrega-litros');
        inputsExistentes.forEach(inp => {
            sumaFilasActuales += parseInt(inp.value) || 0;
        });
        const faltante = totalLitrosCamion - (ltsPrevios + sumaFilasActuales);
        litrosFinales = Math.max(0, faltante);
    }

    const rowId = 'filaEntrega_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // Obtener todas las compañías (INCLUYENDO RECEPTORÍA)
    const opcionesCompanias = (state.companias || []).map(c => {
        const nombre = (c.nombre || c.Nombre || '').trim();
        const esRecep = nombre.toUpperCase().includes('RECEPTORIA') || nombre.toUpperCase().includes('RECEPTORÍA');
        return {
            value: c.id || c.Id,
            label: nombre.toUpperCase(),
            sub: esRecep ? '🏛️ Centro de Acopio / Receptoría' : '🏭 Quesera / Planta Comercial',
            esRecep: esRecep
        };
    }).sort((a, b) => {
        if (a.esRecep && !b.esRecep) return -1;
        if (!a.esRecep && b.esRecep) return 1;
        return a.label.localeCompare(b.label);
    });

    const esBufalaSelected = (tipoLecheSugerido || 'VACA').toUpperCase().includes('BUFAL');

    const rowDiv = document.createElement('div');
    rowDiv.id = rowId;
    rowDiv.className = 'fila-entrega-directa-compania';
    rowDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 140px 135px 38px; gap: 10px; align-items: center; background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); position: relative; overflow: visible;';

    rowDiv.innerHTML = `
        <div class="searchable-select" id="comboboxEntregaDirecta_${rowId}" style="position: relative;">
            <input type="hidden" class="input-hidden-entrega-compania" id="hiddenEntregaDirecta_${rowId}" value="${companiaIdSeleccionada || ''}">
            <div class="combobox-input-wrapper">
                <input type="text" class="form-input combobox-search" id="searchEntregaDirecta_${rowId}" placeholder="Buscar Quesera o Receptoría..." autocomplete="off" style="border-radius: 8px; height: 40px; font-size: 13px; font-weight: 600; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a;">
                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
            </div>
            <div class="combobox-dropdown" id="dropdownEntregaDirecta_${rowId}" style="display: none; max-height: 220px; z-index: 99999;"></div>
        </div>
        <div>
            <select class="form-input select-fila-entrega-tipo" id="tipoEntregaDirecta_${rowId}" style="height: 40px; font-size: 13px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a; padding: 0 8px; width: 100%; cursor: pointer;">
                <option value="VACA" ${!esBufalaSelected ? 'selected' : ''}>🐄 VACA</option>
                <option value="BUFALA" ${esBufalaSelected ? 'selected' : ''}>🐃 BÚFALA</option>
            </select>
        </div>
        <div style="position: relative;">
            <input type="number" class="form-input input-fila-entrega-litros" value="${litrosFinales !== null && litrosFinales !== undefined && litrosFinales > 0 ? litrosFinales : (litrosFinales === 0 ? 0 : '')}" placeholder="Litros" min="1" step="1" oninput="calcularDiferenciaEntregaDirectaLive()" style="height: 40px; font-size: 14px; font-weight: 700; color: #059669; text-align: right; padding-right: 36px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff;" required>
            <span style="position: absolute; right: 10px; top: 11px; font-size: 11px; color: #64748b; font-weight: 800; pointer-events: none;">Lts</span>
        </div>
        <button type="button" class="btn-icon" onclick="eliminarFilaEntregaDirectaCompania('${rowId}')" title="Quitar este destino" style="height: 38px; width: 38px; border-radius: 8px; border: 1px solid #fecaca; color: #ef4444; background: #fef2f2; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-trash-can" style="font-size: 13px;"></i>
        </button>
    `;

    container.appendChild(rowDiv);

    // Si no se especificó compañía, preseleccionar Receptoría por defecto
    const compIdEfectiva = companiaIdSeleccionada || (opcionesCompanias.find(o => o.esRecep)?.value || null);

    // Inicializar combobox searchable
    const cb = setupCombobox({
        containerId: `comboboxEntregaDirecta_${rowId}`,
        inputSearchId: `searchEntregaDirecta_${rowId}`,
        inputHiddenId: `hiddenEntregaDirecta_${rowId}`,
        dropdownId: `dropdownEntregaDirecta_${rowId}`,
        placeholder: 'Buscar Quesera o Receptoría...',
        getItemsFn: () => opcionesCompanias,
        onSelect: () => {
            calcularDiferenciaEntregaDirectaLive();
        }
    });

    if (compIdEfectiva && cb) {
        const found = opcionesCompanias.find(o => o.value == compIdEfectiva);
        if (found) cb.setValue(found.value, found.label);
    }

    calcularDiferenciaEntregaDirectaLive();
}
window.agregarFilaEntregaDirectaCompania = agregarFilaEntregaDirectaCompania;

function eliminarFilaEntregaDirectaCompania(rowId) {
    const container = document.getElementById('contenedorFilasEntregaDirecta');
    const filas = container?.querySelectorAll('.fila-entrega-directa-compania') || [];
    if (filas.length <= 1) {
        Swal.fire({ icon: 'info', title: 'Atención', text: 'Debe existir al menos un destino (compañía o receptoría) para la entrega.', background: '#ffffff', color: '#0f172a' });
        return;
    }
    const row = document.getElementById(rowId);
    if (row) row.remove();
    calcularDiferenciaEntregaDirectaLive();
}
window.eliminarFilaEntregaDirectaCompania = eliminarFilaEntregaDirectaCompania;

function calcularDiferenciaEntregaDirectaLive() {
    const ltsFinca = parseInt(document.getElementById('hiddenEntregaDirectaLitrosFinca')?.value) || 0;
    const ltsPrevios = parseInt(document.getElementById('hiddenEntregaDirectaLitrosPrevios')?.value) || 0;
    const inputsLitros = document.querySelectorAll('.input-fila-entrega-litros');
    let ltsNuevos = 0;
    inputsLitros.forEach(inp => {
        ltsNuevos += parseInt(inp.value) || 0;
    });

    const totalAsignado = ltsPrevios + ltsNuevos;
    const dif = ltsFinca - totalAsignado;

    // Actualizar Tarjeta 3 (Falta Asignar)
    const cardFaltante = document.getElementById('cardEntregaDirectaFaltante');
    const lblTituloFaltante = document.getElementById('lblTituloEntregaDirectaFaltante');
    const lblValFaltante = document.getElementById('lblEntregaDirectaLitrosFaltantes');

    if (dif === 0) {
        if (cardFaltante) {
            cardFaltante.style.background = '#ecfdf5';
            cardFaltante.style.borderColor = '#a7f3d0';
        }
        if (lblTituloFaltante) {
            lblTituloFaltante.style.color = '#065f46';
            lblTituloFaltante.innerText = 'Distribución';
        }
        if (lblValFaltante) {
            lblValFaltante.style.color = '#059669';
            lblValFaltante.innerText = `${totalAsignado.toLocaleString('es-VE')} Lts (100%)`;
        }
    } else if (dif > 0) {
        if (cardFaltante) {
            cardFaltante.style.background = '#eff6ff';
            cardFaltante.style.borderColor = '#bfdbfe';
        }
        if (lblTituloFaltante) {
            lblTituloFaltante.style.color = '#1e40af';
            lblTituloFaltante.innerText = 'Falta Asignar';
        }
        if (lblValFaltante) {
            lblValFaltante.style.color = '#2563eb';
            lblValFaltante.innerText = `${dif.toLocaleString('es-VE')} Lts`;
        }
    } else {
        if (cardFaltante) {
            cardFaltante.style.background = '#fef2f2';
            cardFaltante.style.borderColor = '#fecaca';
        }
        if (lblTituloFaltante) {
            lblTituloFaltante.style.color = '#991b1b';
            lblTituloFaltante.innerText = 'Excedente';
        }
        if (lblValFaltante) {
            lblValFaltante.style.color = '#dc2626';
            lblValFaltante.innerText = `+${Math.abs(dif).toLocaleString('es-VE')} Lts`;
        }
    }

    const box = document.getElementById('boxDiferenciaEntregaDirectaLive');
    const lblVal = document.getElementById('lblValorDifDirectaLive');
    const lblMsg = document.getElementById('lblMensajeDifDirectaLive');

    if (!box) return;

    box.style.display = 'block';

    if (dif === 0) {
        box.style.background = '#ecfdf5';
        box.style.border = '1.5px solid #a7f3d0';
        lblVal.style.color = '#065f46';
        lblVal.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669; margin-right: 6px;"></i> ${totalAsignado.toLocaleString('es-VE')} Lts Distribuidos (0 Lts Diferencia)`;
        lblMsg.style.color = '#047857';
        lblMsg.innerText = ltsPrevios > 0 
            ? `✨ ${ltsPrevios.toLocaleString('es-VE')} Lts previos + ${ltsNuevos.toLocaleString('es-VE')} Lts nuevos = 100% balanceado con los ${ltsFinca.toLocaleString('es-VE')} Lts de fincas`
            : '✨ Entrega 100% balanceada con el total recolectado en fincas';
    } else if (dif > 0) {
        box.style.background = '#fffbeb';
        box.style.border = '1.5px solid #fde68a';
        lblVal.style.color = '#92400e';
        lblVal.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #d97706; margin-right: 6px;"></i> ${totalAsignado.toLocaleString('es-VE')} Lts Asignados (Faltan ${dif.toLocaleString('es-VE')} Lts por distribuir)`;
        lblMsg.style.color = '#b45309';
        lblMsg.innerText = ltsPrevios > 0 
            ? `(${ltsPrevios.toLocaleString('es-VE')} Lts previos + ${ltsNuevos.toLocaleString('es-VE')} Lts nuevos) · Aún queda un volumen de ${dif.toLocaleString('es-VE')} Lts por asignar`
            : `Aún queda un volumen de ${dif.toLocaleString('es-VE')} Lts pendiente por asignar a queseras o receptoría`;
    } else {
        box.style.background = '#fef2f2';
        box.style.border = '1.5px solid #fecaca';
        lblVal.style.color = '#991b1b';
        lblVal.innerHTML = `<i class="fa-solid fa-circle-plus" style="color: #dc2626; margin-right: 6px;"></i> ${totalAsignado.toLocaleString('es-VE')} Lts Asignados (+${Math.abs(dif).toLocaleString('es-VE')} Lts Excedente)`;
        lblMsg.style.color = '#b91c1c';
        lblMsg.innerText = `El volumen total asignado (${totalAsignado.toLocaleString('es-VE')} Lts) supera por ${Math.abs(dif).toLocaleString('es-VE')} Lts a los litros recolectados en fincas (${ltsFinca.toLocaleString('es-VE')} Lts)`;
    }
}
window.calcularDiferenciaEntregaDirectaLive = calcularDiferenciaEntregaDirectaLive;

async function confirmarEntregaDirecta(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ticketId = document.getElementById('hiddenEntregaDirectaTicketId')?.value;
    const observacion = document.getElementById('inputEntregaDirectaObs')?.value || '';
    const btnSubmit = document.getElementById('btnRegistrarEntregaDirectaSubmit');
    const originalBtnHtml = btnSubmit ? btnSubmit.innerHTML : '';

    const filas = document.querySelectorAll('.fila-entrega-directa-compania');
    if (!filas || filas.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Destino requerido', text: 'Por favor añade al menos una compañía o receptoría de destino.', background: '#ffffff', color: '#0f172a' });
        return;
    }

    const entregas = [];
    let totalLts = 0;
    for (const f of filas) {
        const compId = parseInt(f.querySelector('.input-hidden-entrega-compania')?.value) || 0;
        const lts = parseInt(f.querySelector('.input-fila-entrega-litros')?.value) || 0;
        const tipoLeche = f.querySelector('.select-fila-entrega-tipo')?.value || 'VACA';

        if (!compId) {
            Swal.fire({ icon: 'warning', title: 'Destino sin seleccionar', text: 'Hay filas donde no has seleccionado la compañía o receptoría de destino.', background: '#ffffff', color: '#0f172a' });
            return;
        }
        if (lts <= 0) {
            Swal.fire({ icon: 'warning', title: 'Litros inválidos', text: 'Cada destino asignado debe tener una cantidad mayor a 0 litros.', background: '#ffffff', color: '#0f172a' });
            return;
        }

        entregas.push({ companiaDestinoId: compId, litrosEntregados: lts, tipoLeche });
        totalLts += lts;
    }

    // VALIDACIÓN ESTRICTA BLOQUEANTE: Los litros asignados deben coincidir exactamente con el total en camión
    const totalCamion = parseInt(document.getElementById('hiddenEntregaDirectaLitrosFinca')?.value) || 0;
    const ltsPrevios = parseInt(document.getElementById('hiddenEntregaDirectaLitrosPrevios')?.value) || 0;
    const totalDistribuido = totalLts + ltsPrevios;
    const diferencia = totalCamion - totalDistribuido;

    if (diferencia !== 0) {
        if (diferencia > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Distribución incompleta de litros',
                html: `No puedes registrar la entrega porque <strong>faltan ${diferencia.toLocaleString('es-VE')} Lts</strong> por asignar.<br><br>` +
                      `<div style="text-align: left; font-size: 13px; background: #fffbeb; padding: 12px 14px; border-radius: 8px; border: 1.5px solid #fde68a;">` +
                      `• <strong>Total en Camión:</strong> ${totalCamion.toLocaleString('es-VE')} Lts<br>` +
                      `• <strong>Total Asignado:</strong> ${totalDistribuido.toLocaleString('es-VE')} Lts<br>` +
                      `• <strong>Litros Pendientes:</strong> <span style="color: #d97706; font-weight: 800;">${diferencia.toLocaleString('es-VE')} Lts</span></div><br>` +
                      `Debes asignar la totalidad de los litros recolectados antes de registrar.`,
                background: '#ffffff',
                color: '#0f172a'
            });
        } else {
            const excedente = Math.abs(diferencia);
            Swal.fire({
                icon: 'warning',
                title: 'Excedente en litros asignados',
                html: `No puedes registrar la entrega porque los litros asignados superan por <strong>${excedente.toLocaleString('es-VE')} Lts</strong> al volumen total recolectado.<br><br>` +
                      `<div style="text-align: left; font-size: 13px; background: #fef2f2; padding: 12px 14px; border-radius: 8px; border: 1.5px solid #fecaca;">` +
                      `• <strong>Total en Camión:</strong> ${totalCamion.toLocaleString('es-VE')} Lts<br>` +
                      `• <strong>Total Asignado:</strong> ${totalDistribuido.toLocaleString('es-VE')} Lts<br>` +
                      `• <strong>Excedente:</strong> <span style="color: #dc2626; font-weight: 800;">+${excedente.toLocaleString('es-VE')} Lts</span></div><br>` +
                      `Por favor ajusta las cantidades para que coincidan exactamente con el volumen en camión.`,
                background: '#ffffff',
                color: '#0f172a'
            });
        }
        return;
    }

    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
        btnSubmit.disabled = true;
    }

    try {
        // Enviar registros de entrega/despacho multi-destino
        const payload = {
            destinos: entregas.map(item => ({
                companiaId: item.companiaDestinoId,
                litrosDespachados: item.litrosEntregados,
                tipoLeche: item.tipoLeche || 'VACA',
                observacion: observacion || `Despacho directo (${item.tipoLeche || 'VACA'})`
            })),
            observacion: observacion || `Entrega directa / distribuida (${entregas.length} destino(s))`
        };

        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/enviar-compania`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al registrar entrega' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalEntregaDirecta');

        // Desvincular ticket activo del formulario ya que fue despachado
        actualizarEstadoBotonNuevoViaje(null);
        state.ticketAsignadoActivo = null;
        const banner = document.getElementById('bannerTicketActivoForm');
        if (banner) banner.style.display = 'none';

        Swal.fire({
            icon: 'success',
            title: '¡Entrega Registrada Exitosamente!',
            text: `Se registraron exitosamente ${totalLts.toLocaleString('es-VE')} Lts distribuidos en ${entregas.length} destino(s).`,
            background: '#ffffff',
            color: '#0f172a',
            timer: 2600,
            showConfirmButton: false
        });

        await cargarViajeActivoChofer();
        if (typeof cargarViajesRutasDelDia === 'function') {
            await cargarViajesRutasDelDia();
        }
        if (typeof cargarBandejaReceptoria === 'function') {
            await cargarBandejaReceptoria();
        }
        if (typeof cargarControlViajesTickets === 'function') {
            await cargarControlViajesTickets();
        }
        if (typeof cargarDashboard === 'function') {
            await cargarDashboard();
        }
        if (typeof cargarReporteMermas === 'function') {
            await cargarReporteMermas();
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Registrar Entrega',
            text: err.message,
            background: '#ffffff',
            color: '#0f172a'
        });
    } finally {
        if (btnSubmit) {
            btnSubmit.innerHTML = originalBtnHtml;
            btnSubmit.disabled = false;
        }
    }
}
window.confirmarEntregaDirecta = confirmarEntregaDirecta;

// 5. RECEPCIÓN DE TICKETS EN RECEPTORÍA
async function cargarViajesPendientesReceptoria() {
    const container = document.getElementById('containerWidgetReceptoriaTickets');
    if (!container) return;

    if (!state.token) return;

    try {
        const hoy = new Date().toISOString().split('T')[0];
        const res = await fetch(`${API_BASE}/control-rutas?fechaInicio=${hoy}&fechaFin=${hoy}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) return;

        // RECEPTORÍA: El estado ABIERTO no puede verse en Receptoría
        const pendientes = (viajes || []).filter(v => (v.estado || '').toUpperCase() !== 'ABIERTO' && v.procesoActualId !== 1 && (v.procesoActualId === 2 || v.tipoDestino === 'RECEPTORIA'));

        if (!pendientes.length) {
            container.innerHTML = `
                <div style="background: rgba(30, 41, 59, 0.6); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 13px;">
                        <i class="fa-solid fa-truck-clock" style="color: #64748b; font-size: 18px;"></i>
                        <span>No hay camiones pendientes de medir en Receptoría hoy.</span>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" onclick="cargarViajesPendientesReceptoria()" style="height: 32px; font-size: 12px;">
                        <i class="fa-solid fa-arrows-rotate"></i> Actualizar
                    </button>
                </div>
            `;
            return;
        }

        let cardsHtml = '';
        pendientes.forEach(v => {
            cardsHtml += `
                <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95)); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                            <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 11px; font-weight: 800;">
                                <i class="fa-solid fa-truck-ramp-box"></i> PENDIENTE POR RECIBIR
                            </span>
                            <strong style="color: #38bdf8; font-size: 14px;">Ticket #${v.id}</strong>
                        </div>
                        <div style="font-size: 13px; color: #f1f5f9;">
                            Chofer: <strong>${v.nombreConductor}</strong> &bull; Fecha: ${(v.fecha || '').split('T')[0]}
                        </div>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                            Litros traídos de campo: <strong style="color: #34d399;">${(v.totalLitrosFinca || 0).toLocaleString('es-VE')} Lts</strong> (${v.totalFincas || 0} fincas)
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn" onclick="abrirModalTraspasoLeche(${v.id})" style="font-weight: 700; background: #f0fdfa; color: #0d9488; border: 1.5px solid #99f6e4; height: 38px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 8px;" title="Traspasar leche a otro chofer">
                            <i class="fa-solid fa-right-left"></i> Traspaso Chofer
                        </button>
                        <button type="button" class="btn btn-primary" onclick="abrirModalRecibirEnReceptoria(${v.id})" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0ea5e9); border: none; height: 38px; padding: 0 18px; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-scale-balanced"></i> Validar Pesaje / Recibir Leche
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="content-card" style="margin-bottom: 20px; border-left: 4px solid #0284c7; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 14.5px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-truck-moving"></i> Camiones en Tránsito hacia Receptoría (${pendientes.length})
                    </h3>
                    <button type="button" class="btn btn-outline btn-sm" onclick="cargarViajesPendientesReceptoria()" style="height: 30px; font-size: 11.5px; padding: 0 10px;">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${cardsHtml}
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Error al cargar viajes pendientes en receptoría:', e);
    }
}
window.cargarViajesPendientesReceptoria = cargarViajesPendientesReceptoria;

// --- FUNCIONES DE TRASPASO DE LECHE A OTRO CHOFER / VIAJE ---
function conmutarModoTraspaso(modo) {
    const hiddenModo = document.getElementById('hiddenTraspasoModo');
    const btnExistente = document.getElementById('btnModoTraspasoExistente');
    const btnNuevo = document.getElementById('btnModoTraspasoNuevo');
    const seccionExistente = document.getElementById('seccionTraspasoExistente');
    const seccionNuevo = document.getElementById('seccionTraspasoNuevo');

    if (hiddenModo) hiddenModo.value = modo;

    if (modo === 'EXISTENTE') {
        if (btnExistente) {
            btnExistente.style.background = '#0d9488';
            btnExistente.style.color = '#ffffff';
            btnExistente.style.fontWeight = '800';
        }
        if (btnNuevo) {
            btnNuevo.style.background = 'transparent';
            btnNuevo.style.color = '#475569';
            btnNuevo.style.fontWeight = '700';
        }
        if (seccionExistente) seccionExistente.style.display = 'block';
        if (seccionNuevo) seccionNuevo.style.display = 'none';
    } else {
        if (btnNuevo) {
            btnNuevo.style.background = '#0d9488';
            btnNuevo.style.color = '#ffffff';
            btnNuevo.style.fontWeight = '800';
        }
        if (btnExistente) {
            btnExistente.style.background = 'transparent';
            btnExistente.style.color = '#475569';
            btnExistente.style.fontWeight = '700';
        }
        if (seccionExistente) seccionExistente.style.display = 'none';
        if (seccionNuevo) seccionNuevo.style.display = 'block';
    }
    actualizarPrevisualizacionTraspaso();
}
window.conmutarModoTraspaso = conmutarModoTraspaso;

function cargarTodoElVolumenTraspaso() {
    const ltsDisp = document.getElementById('hiddenTraspasoLitrosDisponibles')?.value;
    const inputLts = document.getElementById('inputTraspasoLitros');
    if (inputLts && ltsDisp) {
        inputLts.value = ltsDisp;
        actualizarPrevisualizacionTraspaso();
    }
}
window.cargarTodoElVolumenTraspaso = cargarTodoElVolumenTraspaso;

function actualizarPrevisualizacionTraspaso() {
    const modo = document.getElementById('hiddenTraspasoModo')?.value || 'EXISTENTE';
    const lblPreviewDestino = document.getElementById('lblPreviewDestino');
    const inputLitros = document.getElementById('inputTraspasoLitros');
    const lts = inputLitros && inputLitros.value ? Number(inputLitros.value).toLocaleString('es-VE') : '0';

    if (!lblPreviewDestino) return;

    if (modo === 'EXISTENTE') {
        const selectTicket = document.getElementById('selectTraspasoTicketDestino');
        if (selectTicket && selectTicket.selectedIndex > 0) {
            const optText = selectTicket.options[selectTicket.selectedIndex].text;
            lblPreviewDestino.innerText = `${optText} (+${lts} Lts)`;
        } else {
            lblPreviewDestino.innerText = 'Selecciona ticket destino';
        }
    } else {
        const selectChofer = document.getElementById('selectTraspasoChoferDestino');
        if (selectChofer && selectChofer.selectedIndex > 0) {
            const choferNom = selectChofer.options[selectChofer.selectedIndex].text;
            lblPreviewDestino.innerText = `Nuevo Ticket: ${choferNom} (+${lts} Lts)`;
        } else {
            lblPreviewDestino.innerText = 'Selecciona chofer destino';
        }
    }
}
window.actualizarPrevisualizacionTraspaso = actualizarPrevisualizacionTraspaso;

async function abrirModalTraspasoLeche(ticketId) {
    try {
        const [resTicket, resAbiertos] = await Promise.all([
            fetch(`${API_BASE}/control-rutas/${ticketId}`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/control-rutas?estado=ABIERTO`, { headers: { 'Authorization': `Bearer ${state.token}` } })
        ]);

        if (!resTicket.ok) throw new Error('No se pudo obtener información del ticket de origen');
        const viaje = await resTicket.json();
        const abiertos = resAbiertos.ok ? await resAbiertos.json() : [];

        // Llenar campos base
        document.getElementById('hiddenTraspasoTicketOrigenId').value = viaje.id;
        document.getElementById('hiddenTraspasoLitrosDisponibles').value = viaje.totalLitrosFinca || 0;
        document.getElementById('lblTraspasoOrigenInfo').innerText = `#${viaje.id} \u2022 ${viaje.nombreConductor || 'Conductor'}`;
        document.getElementById('lblTraspasoLitrosOrigen').innerText = `${(viaje.totalLitrosFinca || 0).toLocaleString('es-VE')} Lts`;
        document.getElementById('lblPreviewOrigen').innerText = `${viaje.nombreConductor} (#${viaje.id})`;
        document.getElementById('inputTraspasoLitros').value = viaje.totalLitrosFinca || 0;
        document.getElementById('inputTraspasoFechaDestino').value = (viaje.fecha || '').split('T')[0] || new Date().toISOString().split('T')[0];
        document.getElementById('inputTraspasoObservacion').value = '';

        // Llenar Select de Tickets Abiertos (Destino)
        const selectTickets = document.getElementById('selectTraspasoTicketDestino');
        if (selectTickets) {
            const candidatos = abiertos.filter(t => Number(t.id) !== Number(viaje.id) && t.procesoActualId !== 4 && t.estado !== 'FINALIZADO');
            if (candidatos.length === 0) {
                selectTickets.innerHTML = '<option value="">-- No hay otros tickets abiertos activos --</option>';
            } else {
                selectTickets.innerHTML = '<option value="">-- Seleccionar Ticket de Destino --</option>' +
                    candidatos.map(t => {
                        const chofer = t.nombreConductor || 'Chofer';
                        const fecha = (t.fecha || '').split('T')[0];
                        const lts = (t.totalLitrosFinca || 0).toLocaleString('es-VE');
                        return `<option value="${t.id}">Ticket #${t.id} - ${chofer} (${fecha} | ${lts} Lts)</option>`;
                    }).join('');
            }
        }

        // Llenar Select de Choferes de Destino
        const selectChoferes = document.getElementById('selectTraspasoChoferDestino');
        if (selectChoferes) {
            const usuariosChofer = (state.usuarios || state.conductores || []).filter(u => u.activo !== false && (u.rol === 'CHOFER' || u.Rol === 'CHOFER' || u.nombreCompleto || u.NombreCompleto));
            selectChoferes.innerHTML = '<option value="">-- Seleccionar Chofer Destino --</option>' +
                usuariosChofer.map(u => {
                    const uId = u.id || u.Id;
                    const nom = u.nombreCompleto || u.NombreCompleto || u.username;
                    return `<option value="${uId}">${nom}</option>`;
                }).join('');
        }

        conmutarModoTraspaso('EXISTENTE');
        abrirModalCustom('modalTraspasoLeche');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.abrirModalTraspasoLeche = abrirModalTraspasoLeche;

async function confirmarTraspasoLeche(e) {
    e.preventDefault();

    const ticketOrigenId = document.getElementById('hiddenTraspasoTicketOrigenId')?.value;
    const modo = document.getElementById('hiddenTraspasoModo')?.value || 'EXISTENTE';
    const litrosTraspaso = parseInt(document.getElementById('inputTraspasoLitros')?.value, 10);
    const observacion = document.getElementById('inputTraspasoObservacion')?.value.trim();

    if (!ticketOrigenId) {
        Swal.fire({ icon: 'warning', title: 'Ticket inválido', text: 'No se ha seleccionado el ticket de origen.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (isNaN(litrosTraspaso) || litrosTraspaso <= 0) {
        Swal.fire({ icon: 'warning', title: 'Litros requeridos', text: 'Ingrese un volumen válido mayor a 0 litros.', background: '#1e293b', color: '#fff' });
        return;
    }

    const payload = {
        litrosTraspaso,
        observacion
    };

    if (modo === 'EXISTENTE') {
        const ticketDestinoId = parseInt(document.getElementById('selectTraspasoTicketDestino')?.value, 10);
        if (!ticketDestinoId || isNaN(ticketDestinoId)) {
            Swal.fire({ icon: 'warning', title: 'Ticket Destino Requerido', text: 'Seleccione el ticket de destino al que se transferirá la leche.', background: '#1e293b', color: '#fff' });
            return;
        }
        payload.ticketDestinoId = ticketDestinoId;
    } else {
        const choferDestinoId = parseInt(document.getElementById('selectTraspasoChoferDestino')?.value, 10);
        const fechaDestino = document.getElementById('inputTraspasoFechaDestino')?.value;
        if (!choferDestinoId || isNaN(choferDestinoId)) {
            Swal.fire({ icon: 'warning', title: 'Chofer Destino Requerido', text: 'Seleccione el chofer que recibirá el nuevo ticket.', background: '#1e293b', color: '#fff' });
            return;
        }
        payload.choferDestinoId = choferDestinoId;
        payload.fechaDestino = fechaDestino;
    }

    const confirmResult = await Swal.fire({
        title: '¿Confirmar Traspaso de Leche?',
        text: `Se transferirán ${litrosTraspaso.toLocaleString('es-VE')} Lts del Ticket #${ticketOrigenId}. El ticket de origen quedará en estado TRASPASADO y auditado.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Traspasar Leche',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#64748b',
        background: '#ffffff',
        color: '#0f172a'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const btnSubmit = document.getElementById('btnSubmitTraspasoLeche');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando Traspaso...';
        }

        const res = await fetch(`${API_BASE}/control-rutas/${ticketOrigenId}/traspasar-leche`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al procesar traspaso' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const data = await res.json();

        cerrarModalCustom('modalTraspasoLeche');

        await Swal.fire({
            icon: 'success',
            title: '¡Traspaso Exitoso!',
            html: `
                <div style="font-size: 13.5px; color: #334155; text-align: left;">
                    <p style="font-weight: 700; color: #0d9488; margin-bottom: 8px;">${data.mensaje || 'Traspaso completado exitosamente.'}</p>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                        <li>Ticket Origen: <strong>#${data.ticketOrigenId} (${data.choferOrigenNombre})</strong> &rarr; <span class="badge badge-warning" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;">TRASPASADO</span></li>
                        <li>Ticket Destino: <strong>#${data.ticketDestinoId} (${data.choferDestinoNombre})</strong> &rarr; +${data.litrosTraspasados} Lts</li>
                    </ul>
                </div>
            `,
            background: '#ffffff',
            color: '#0f172a',
            confirmButtonColor: '#0d9488'
        });

        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
        if (typeof cargarRutasHoy === 'function') cargarRutasHoy();
        if (typeof cargarEntregasHoy === 'function') cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
        if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
        const fechaConsulta = document.getElementById('filtroFechaRutas')?.value;
        if (typeof cargarViajesRutasDelDia === 'function') cargarViajesRutasDelDia(fechaConsulta);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    } finally {
        const btnSubmit = document.getElementById('btnSubmitTraspasoLeche');
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-right-left"></i> Confirmar Traspaso';
        }
    }
}
window.confirmarTraspasoLeche = confirmarTraspasoLeche;

// 6. MODAL RECIBIR EN RECEPTORÍA (MEDICIÓN EN VIVO)
async function abrirModalRecibirEnReceptoria(ticketId) {
    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error('No se pudo obtener información del ticket');

        const viaje = await res.json();
        const ltsFinca = Number(viaje.totalLitrosFinca || viaje.TotalLitrosFinca || 0);
        const ltsTraspaso = Number(viaje.litrosCargadosAdicional || viaje.LitrosCargadosAdicional || 0);
        const totalCamion = ltsFinca + ltsTraspaso;

        document.getElementById('hiddenRecibirReceptoriaTicketId').value = viaje.id;
        document.getElementById('hiddenRecibirReceptoriaLitrosFinca').value = totalCamion;
        document.getElementById('lblRecibirTicketChofer').innerText = `#${viaje.id} - ${viaje.nombreConductor || viaje.NombreConductor || 'Conductor'}`;
        document.getElementById('lblRecibirLitrosFinca').innerText = `${totalCamion.toLocaleString('es-VE')} Lts`;

        const inputMedidos = document.getElementById('inputRecibirLitrosReales');
        if (inputMedidos) inputMedidos.value = totalCamion;

        document.getElementById('radioDejarReceptoria').checked = true;
        toggleOpcionesRecargaReceptoria();

        const inputExtra = document.getElementById('inputRecargarLitrosExtra');
        if (inputExtra) {
            inputExtra.value = 0;
            inputExtra.oninput = calcularDiferenciaReceptoriaEnVivo;
        }

        // Limpiar e inicializar filas de multi-compañía para despacho
        const contenedor = document.getElementById('contenedorFilasCompaniasDespacho');
        if (contenedor) contenedor.innerHTML = '';
        agregarFilaCompaniaDespacho();

        document.getElementById('inputRecibirReceptoriaObs').value = '';
        calcularDiferenciaReceptoriaEnVivo();

        abrirModalCustom('modalRecibirReceptoria');
    } catch (err) {
        showToast('Error al abrir recepción', 'error', err.message);
    }
}
window.abrirModalRecibirEnReceptoria = abrirModalRecibirEnReceptoria;

// GESTIÓN DINÁMICA DE MULTI-COMPAÑÍAS PARA DESPACHO CON COMBOBOX BUSCADOR
window.agregarFilaCompaniaDespacho = function(companiaId = null, litros = '') {
    const contenedor = document.getElementById('contenedorFilasCompaniasDespacho');
    if (!contenedor) return;

    const rowId = 'filaDespachoRecep_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // Lista de compañías válidas (excluyendo receptoría)
    const opcionesCompanias = (state.companias || [])
        .filter(c => !(c.nombre || c.Nombre || '').toUpperCase().includes('RECEPTORIA'))
        .map(c => ({
            value: c.id || c.Id,
            label: (c.nombre || c.Nombre || '').toUpperCase().trim(),
            sub: '🏭 Quesera / Planta Comercial'
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const rowDiv = document.createElement('div');
    rowDiv.id = rowId;
    rowDiv.className = 'fila-despacho-receptoria-item';
    rowDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 150px 38px; gap: 10px; align-items: center; background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03); position: relative; overflow: visible;';

    rowDiv.innerHTML = `
        <div class="searchable-select" id="comboboxDespachoRecep_${rowId}" style="position: relative;">
            <input type="hidden" class="input-hidden-despacho-compania" id="hiddenDespachoRecep_${rowId}" value="${companiaId || ''}">
            <div class="combobox-input-wrapper">
                <input type="text" class="form-input combobox-search" id="searchDespachoRecep_${rowId}" placeholder="Buscar Quesera o Planta Destino..." autocomplete="off" style="border-radius: 8px; height: 40px; font-size: 13px; font-weight: 600; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a;">
                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
            </div>
            <div class="combobox-dropdown" id="dropdownDespachoRecep_${rowId}" style="display: none; max-height: 220px; z-index: 99999;"></div>
        </div>
        <div style="position: relative;">
            <input type="number" class="form-input input-fila-despacho-litros" value="${litros || ''}" placeholder="Litros" min="1" step="1" oninput="calcularDiferenciaReceptoriaEnVivo()" style="height: 40px; font-size: 14px; font-weight: 800; color: #4338ca; text-align: right; padding-right: 36px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff;">
            <span style="position: absolute; right: 10px; top: 11px; font-size: 11px; color: #64748b; font-weight: 800; pointer-events: none;">Lts</span>
        </div>
        <button type="button" class="btn-icon" onclick="eliminarFilaCompaniaDespacho('${rowId}')" title="Eliminar compañía" style="height: 38px; width: 38px; border-radius: 8px; border: 1px solid #fecaca; color: #ef4444; background: #fef2f2; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">
            <i class="fa-solid fa-trash-can" style="font-size: 13px;"></i>
        </button>
    `;

    contenedor.appendChild(rowDiv);

    // Inicializar combobox searchable
    const cb = setupCombobox({
        containerId: `comboboxDespachoRecep_${rowId}`,
        inputSearchId: `searchDespachoRecep_${rowId}`,
        inputHiddenId: `hiddenDespachoRecep_${rowId}`,
        dropdownId: `dropdownDespachoRecep_${rowId}`,
        placeholder: 'Buscar Quesera o Planta Destino...',
        getItemsFn: () => opcionesCompanias,
        onSelect: () => {
            calcularDiferenciaReceptoriaEnVivo();
        }
    });

    if (companiaId && cb) {
        const found = opcionesCompanias.find(o => o.value == companiaId);
        if (found) cb.setValue(found.value, found.label);
    }

    calcularDiferenciaReceptoriaEnVivo();
};

window.eliminarFilaCompaniaDespacho = function(rowId) {
    const contenedor = document.getElementById('contenedorFilasCompaniasDespacho');
    const filas = contenedor?.querySelectorAll('.fila-despacho-receptoria-item') || [];
    if (filas.length <= 1) {
        showToast('Atención', 'warning', 'Debe existir al menos un destino (compañía o quesera) para el despacho.');
        return;
    }
    const row = document.getElementById(rowId);
    if (row) row.remove();
    calcularDiferenciaReceptoriaEnVivo();
};

function toggleOpcionesRecargaReceptoria() {
    const isRecargar = document.getElementById('radioRecargarYDespachar')?.checked;
    const seccion = document.getElementById('seccionRecargarDespacho');
    const labelDejar = document.getElementById('labelOptDejar');
    const labelRecargar = document.getElementById('labelOptRecargar');

    if (seccion) seccion.style.display = isRecargar ? 'block' : 'none';

    if (labelDejar && labelRecargar) {
        if (isRecargar) {
            labelRecargar.style.borderColor = '#2563eb';
            labelRecargar.style.background = '#eff6ff';
            labelRecargar.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)';
            labelDejar.style.borderColor = '#cbd5e1';
            labelDejar.style.background = '#ffffff';
            labelDejar.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
        } else {
            labelDejar.style.borderColor = '#2563eb';
            labelDejar.style.background = '#eff6ff';
            labelDejar.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)';
            labelRecargar.style.borderColor = '#cbd5e1';
            labelRecargar.style.background = '#ffffff';
            labelRecargar.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
        }
    }

    if (isRecargar) {
        const contenedor = document.getElementById('contenedorFilasCompaniasDespacho');
        const filas = contenedor?.querySelectorAll('.fila-despacho-receptoria-item') || [];
        if (filas.length === 0) {
            agregarFilaCompaniaDespacho();
        }
    }

    calcularDiferenciaReceptoriaEnVivo();
}
window.toggleOpcionesRecargaReceptoria = toggleOpcionesRecargaReceptoria;

function calcularDiferenciaReceptoriaEnVivo() {
    const ltsFinca = parseInt(document.getElementById('hiddenRecibirReceptoriaLitrosFinca')?.value) || 0;
    const ltsMedidos = parseInt(document.getElementById('inputRecibirLitrosReales')?.value) || 0;
    const ltsExtra = parseInt(document.getElementById('inputRecargarLitrosExtra')?.value) || 0;

    const box = document.getElementById('boxDiferenciaReceptoriaLive');
    const lblTitulo = document.getElementById('lblTituloDifLive');
    const lblVal = document.getElementById('lblValorDifLive');
    const lblMsg = document.getElementById('lblMensajeDifLive');
    const lblTotalSaliendo = document.getElementById('lblTotalSaliendoReceptoria');

    if (!box) return;

    box.style.display = 'block';
    const dif = ltsFinca - ltsMedidos;

    if (dif === 0) {
        box.style.background = '#ecfdf5';
        box.style.border = '1.5px solid #a7f3d0';
        if (lblTitulo) lblTitulo.style.color = '#065f46';
        lblVal.style.color = '#065f46';
        lblVal.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #059669; margin-right: 6px;"></i> 0 Lts (Cuadre Exacto)';
        lblMsg.style.color = '#047857';
        lblMsg.innerText = '✨ Medición 100% exacta con la recolección en fincas.';
    } else if (dif > 0) {
        box.style.background = '#fef2f2';
        box.style.border = '1.5px solid #fecaca';
        if (lblTitulo) lblTitulo.style.color = '#991b1b';
        lblVal.style.color = '#dc2626';
        lblVal.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; margin-right: 6px;"></i> -${dif.toLocaleString('es-VE')} Lts Faltante`;
        lblMsg.style.color = '#b91c1c';
        lblMsg.innerText = `Falta en ruta: ${dif.toLocaleString('es-VE')} Lts menos que lo reportado en fincas.`;
    } else {
        box.style.background = '#eff6ff';
        box.style.border = '1.5px solid #bfdbfe';
        if (lblTitulo) lblTitulo.style.color = '#1e40af';
        lblVal.style.color = '#2563eb';
        lblVal.innerHTML = `<i class="fa-solid fa-circle-plus" style="color: #3b82f6; margin-right: 6px;"></i> +${Math.abs(dif).toLocaleString('es-VE')} Lts Sobrante`;
        lblMsg.style.color = '#1d4ed8';
        lblMsg.innerText = `Sobrante en ruta: ${Math.abs(dif).toLocaleString('es-VE')} Lts adicionales medidos en tanque.`;
    }

    if (lblTotalSaliendo) {
        const totalPlanta = ltsMedidos + ltsExtra;
        let sumaAsignada = 0;
        const filas = document.querySelectorAll('.fila-despacho-receptoria-item');
        filas.forEach(f => {
            const inp = f.querySelector('.input-fila-despacho-litros');
            sumaAsignada += parseInt(inp?.value) || 0;
        });

        const difDespacho = totalPlanta - sumaAsignada;
        let estadoBadge = '';
        if (sumaAsignada === totalPlanta && totalPlanta > 0) {
            estadoBadge = `<span style="color: #059669; font-weight: 800; margin-left: 8px;">✓ 100% Distribuido (${sumaAsignada.toLocaleString('es-VE')} Lts en ${filas.length} compañía(s))</span>`;
        } else if (difDespacho > 0) {
            estadoBadge = `<span style="color: #d97706; font-weight: 700; margin-left: 8px;">(Faltan ${difDespacho.toLocaleString('es-VE')} Lts por asignar a queseras)</span>`;
        } else {
            estadoBadge = `<span style="color: #dc2626; font-weight: 700; margin-left: 8px;">(Excedente de +${Math.abs(difDespacho).toLocaleString('es-VE')} Lts asignados)</span>`;
        }

        lblTotalSaliendo.innerHTML = `Total a Despachar: <strong style="font-size: 15px; color: #4338ca;">${totalPlanta.toLocaleString('es-VE')} Lts</strong> <span style="font-size: 11px; color: #64748b;">(${ltsMedidos.toLocaleString('es-VE')} medidos + ${ltsExtra.toLocaleString('es-VE')} recargados)</span> &bull; ${estadoBadge}`;
    }
}
window.calcularDiferenciaReceptoriaEnVivo = calcularDiferenciaReceptoriaEnVivo;

async function confirmarRecibirReceptoria(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ticketId = document.getElementById('hiddenRecibirReceptoriaTicketId')?.value;
    const litrosRecibidos = parseInt(document.getElementById('inputRecibirLitrosReales')?.value);
    const accion = document.querySelector('input[name="optAccionReceptoria"]:checked')?.value || 'DEJAR_EN_RECEPTORIA';
    const observacion = document.getElementById('inputRecibirReceptoriaObs')?.value || '';

    let litrosCargadosAdicional = 0;
    let companiaDestinoId = null;
    let filasValidas = [];

    if (accion === 'RECARGAR_Y_DESPACHAR') {
        litrosCargadosAdicional = parseInt(document.getElementById('inputRecargarLitrosExtra')?.value) || 0;
        const filas = document.querySelectorAll('.fila-despacho-receptoria-item');
        filasValidas = [];
        for (const f of filas) {
            const compId = parseInt(f.querySelector('.input-hidden-despacho-compania')?.value) || 0;
            const lts = parseInt(f.querySelector('.input-fila-despacho-litros')?.value) || 0;

            if (!compId) {
                showToast('Compañía requerida', 'warning', 'Hay filas donde no has seleccionado la quesera o planta de destino.');
                return;
            }
            if (lts <= 0) {
                showToast('Litros inválidos', 'warning', 'Cada destino asignado debe tener una cantidad mayor a 0 litros.');
                return;
            }
            filasValidas.push({ companiaId: compId, litros: lts });
        }

        if (filasValidas.length === 0) {
            showToast('Compañías requeridas', 'warning', 'Por favor selecciona al menos una quesera/compañía destino con litros a entregar.');
            return;
        }

        companiaDestinoId = parseInt(filasValidas[0].companiaId);
    }

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/recibir-receptoria`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                litrosRecibidos,
                accion,
                litrosCargadosAdicional,
                companiaDestinoId,
                observacion
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al procesar recepción' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalRecibirReceptoria');

        // Si se seleccionó recargar y despachar a compañía, generar tickets en TB_CONTROL_COMPANIAS para CADA compañía asignada
        if (accion === 'RECARGAR_Y_DESPACHAR' && filasValidas.length > 0) {
            for (const fila of filasValidas) {
                try {
                    const compId = parseInt(fila.companiaId);
                    const ltsDesp = parseInt(fila.litros);
                    const compObj = (state.companias || []).find(c => Number(c.id || c.Id) === compId);
                    const compNombre = compObj ? (compObj.nombre || compObj.Nombre) : `Compañía #${compId}`;

                    await fetch(`${API_BASE}/control-companias`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                        body: JSON.stringify({
                            companiaId: compId,
                            usuarioId: state.user?.id,
                            litrosDespachados: ltsDesp,
                            observacion: `Despacho a ${compNombre} desde Receptoría (Viaje #${ticketId}). ${observacion}`.trim()
                        })
                    });
                } catch (e) {
                    console.error('Error registrando despacho dinámico en control compañías:', e);
                }
            }
        }

        showToast(
            '¡Recepción Completada!',
            'success',
            accion === 'DEJAR_EN_RECEPTORIA' 
                ? `Leche descargada en Receptoría (${litrosRecibidos.toLocaleString('es-VE')} Lts). Estado: RECEPCIONADO.`
                : `Recepción validada y generado(s) ${filasValidas.length} ticket(s) de salida a compañía(s) en estado EN VÍA.`,
            2500
        );

        await cargarBandejaReceptoria();
        await cargarViajesPendientesReceptoria();
        await cargarEntregasHoy();
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
    } catch (err) {
        showToast('Error', 'error', err.message);
    }
}
window.confirmarRecibirReceptoria = confirmarRecibirReceptoria;

// ==========================================================================
// 7. MÓDULO DATATABLE AVANZADO: BITÁCORA GENERAL DE VIAJES Y TICKETS (V2)
// ==========================================================================
const dtTicketsState = {
    allData: [],
    filteredData: [],
    searchQuery: '',
    pageSize: 25,
    currentPage: 1,
    sortCol: 'id',
    sortAsc: false,
    expandedTicketIds: new Set(),
    fincasCache: new Map()
};

async function cargarControlViajesTickets() {
    const tbody = document.getElementById('tbodyControlViajes');
    if (!tbody) return;

    if (!state.token) return;

    const iconRefresh = document.getElementById('iconRefreshControlViajes');
    if (iconRefresh) iconRefresh.classList.add('fa-spin');

    tbody.innerHTML = '<tr><td colspan="14" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando bitácora de viajes...</td></tr>';

    try {
        const fDesdeInput = document.getElementById('filtroTicketFechaDesde');
        const fHastaInput = document.getElementById('filtroTicketFechaHasta');

        if (fDesdeInput && !fDesdeInput.value) {
            const hace30 = new Date();
            hace30.setDate(hace30.getDate() - 30);
            fDesdeInput.value = hace30.toISOString().split('T')[0];
        }
        if (fHastaInput && !fHastaInput.value) {
            fHastaInput.value = new Date().toISOString().split('T')[0];
        }

        const fechaInicio = fDesdeInput ? fDesdeInput.value : '';
        const fechaFin = fHastaInput ? fHastaInput.value : '';

        // Calcular días del período
        if (fechaInicio && fechaFin) {
            const d1 = new Date(fechaInicio);
            const d2 = new Date(fechaFin);
            const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
            const lblDias = document.getElementById('kpiDiasPeriodo');
            if (lblDias) lblDias.innerText = diffDays;
        }

        // Inicializar selector buscable de choferes para control de tickets
        if (!comboboxFiltroTicketChoferInstance && document.getElementById('comboboxFiltroTicketChofer')) {
            comboboxFiltroTicketChoferInstance = setupCombobox({
                containerId: 'comboboxFiltroTicketChofer',
                inputSearchId: 'searchFiltroTicketChoferInput',
                inputHiddenId: 'filterTicketChoferVal',
                dropdownId: 'dropdownFiltroTicketChoferList',
                placeholder: 'TODOS LOS CONDUCTORES',
                getItemsFn: () => {
                    const list = [{ value: '', label: 'TODOS LOS CONDUCTORES', sub: '' }];
                    const choferesMap = new Map();
                    const choferesList = (state.conductores && state.conductores.length) ? state.conductores : (state.choferes || []);
                    
                    choferesList.forEach(c => {
                        const id = c.id || c.Id;
                        const nombre = c.nombreCompleto || c.NombreCompleto || c.nombre || c.username || `Chofer #${id}`;
                        const cedula = c.cedula || c.Cedula;
                        if (id != null) {
                            choferesMap.set(String(id), {
                                value: id,
                                label: capitalizarTexto(nombre),
                                sub: cedula ? `C.I: ${cedula}` : ''
                            });
                        }
                    });

                    return list.concat(Array.from(choferesMap.values()).sort((a, b) => a.label.localeCompare(b.label)));
                },
                onSelect: () => {
                    cargarControlViajesTickets();
                }
            });
            window.comboboxFiltroTicketChoferInstance = comboboxFiltroTicketChoferInstance;

            const searchInput = document.getElementById('searchFiltroTicketChoferInput');
            if (searchInput && !searchInput._hasFilterListener) {
                searchInput._hasFilterListener = true;
                searchInput.addEventListener('input', () => {
                    if (!searchInput.value.trim()) {
                        const hiddenVal = document.getElementById('filterTicketChoferVal');
                        if (hiddenVal && hiddenVal.value) {
                            hiddenVal.value = '';
                            cargarControlViajesTickets();
                        }
                    }
                });
            }
        }

        const choferFiltro = document.getElementById('filterTicketChoferVal')?.value || '';
        const choferSearchInput = (document.getElementById('searchFiltroTicketChoferInput')?.value || '').trim();
        const procesoFiltro = document.getElementById('filtroTicketProceso')?.value || '';
        const origenFiltro = document.getElementById('filtroTicketOrigen')?.value || '';

        const [resRutas, resComp] = await Promise.all([
            fetch(`${API_BASE}/control-rutas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            }),
            fetch(`${API_BASE}/control-companias?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            })
        ]);

        let listRutas = resRutas.ok ? await resRutas.json() : [];
        let listComp = resComp.ok ? await resComp.json() : [];

        // Normalizar tickets de Rutas
        listRutas = (listRutas || []).map(r => ({
            ...r,
            _rowKey: `RUTA_${r.id}`,
            _origen: 'RUTA',
            _tipoLabel: 'RUTA',
            _tipoColor: '#0284c7',
            _tipoBg: '#e0f2fe'
        }));

        // Normalizar tickets de Receptoría (Salidas a Queseras / Compañías y Sub-despachos de Rutas)
        listComp = (listComp || []).map(c => {
            const esSubTicket = (c.controlRutaId != null && Number(c.controlRutaId) > 0);
            const parentId = esSubTicket ? Number(c.controlRutaId) : null;
            const stUpper = (c.estado || '').toUpperCase();
            const pId = stUpper === 'FINALIZADO' ? 4 : (stUpper === 'CAMINO A COMPAÑIA' || stUpper === 'EN VIA' ? 3 : 1);
            const ltsDesp = Number(c.litrosDespachados || 0);
            const ltsRec = c.litrosRecibidosCompania != null ? Number(c.litrosRecibidosCompania) : ltsDesp;
            const dif = (c.diferenciaLitros != null) ? Number(c.diferenciaLitros) : (ltsDesp - ltsRec);
            const pct = (c.porcentajeMerma != null) ? Number(c.porcentajeMerma) : (ltsDesp > 0 ? (Math.abs(dif) / ltsDesp * 100) : 0);
            const origen = esSubTicket ? 'SUB_DESPACHO' : 'RECEPTORIA';
            return {
                ...c,
                _rowKey: `${origen}_${c.id}`,
                _origen: origen,
                _esSubTicket: esSubTicket,
                _parentTicketId: parentId,
                _tipoLabel: esSubTicket ? `SUB-TICKET #${c.id}` : 'PLANTA',
                _tipoColor: esSubTicket ? '#7e22ce' : '#9333ea',
                _tipoBg: esSubTicket ? '#f3e8ff' : '#faf5ff',
                procesoActualId: pId,
                totalLitrosFinca: ltsDesp,
                totalLitrosReceptoria: ltsRec,
                diferenciaLitros: dif,
                diferenciaReceptoria: dif,
                mermaTotalLitros: dif,
                porcentajeMerma: pct,
                nombreConductor: c.nombreUsuario || c.nombreConductor || 'Chofer',
                nombreCompaniaDestino: c.nombreCompania || 'Planta / Quesera'
            };
        });

        let data = [...listRutas, ...listComp];

        // Filtro por Origen (Rutas vs Receptorías)
        if (origenFiltro) {
            if (origenFiltro === 'RECEPTORIA') {
                data = data.filter(v => v._origen === 'RECEPTORIA');
            } else if (origenFiltro === 'RUTA') {
                data = data.filter(v => v._origen === 'RUTA');
            } else {
                data = data.filter(v => v._origen === origenFiltro);
            }
        }

        // Filtros locales por chofer
        if (choferFiltro) {
            data = data.filter(v => {
                const matchId = (v.usuarioId != null && String(v.usuarioId) === String(choferFiltro));
                const matchNombre = (v.nombreConductor && v.nombreConductor.toLowerCase().includes(String(choferFiltro).toLowerCase())) ||
                                    (v.nombreUsuario && v.nombreUsuario.toLowerCase().includes(String(choferFiltro).toLowerCase()));
                return matchId || matchNombre;
            });
        } else if (choferSearchInput && choferSearchInput.toUpperCase() !== 'TODOS LOS CONDUCTORES') {
            const sLow = choferSearchInput.toLowerCase();
            data = data.filter(v => {
                const matchNombre = (v.nombreConductor && v.nombreConductor.toLowerCase().includes(sLow)) ||
                                    (v.nombreUsuario && v.nombreUsuario.toLowerCase().includes(sLow));
                return matchNombre;
            });
        }

        if (procesoFiltro) {
            data = data.filter(v => Number(v.procesoActualId) === Number(procesoFiltro));
        }

        dtTicketsState.allData = data;
        stateViajes.ticketsList = data;

        // Contadores y acumuladores separados por origen para evitar doble conteo
        let total = data.length;
        let abiertos = 0;
        let receptoria = 0;
        let entregados = 0;
        let finalizados = 0;

        let countRutas = 0;
        let ltsFincasRutas = 0;
        let ltsRecibidosRutas = 0;

        let countComp = 0;
        let ltsDespachadosComp = 0;
        let ltsRecibidosComp = 0;

        const idsRutasEnAllData = new Set(
            data.filter(v => !v._esSubTicket).map(v => Number(v.id))
        );

        data.forEach(v => {
            const p = v.procesoActualId || 1;
            if (p === 1) abiertos++;
            else if (p === 2) receptoria++;
            else if (p === 3) entregados++;
            else if (p === 4) finalizados++;

            // Si es un sub-ticket de una ruta ya contemplada en data, no duplicar litros en los contadores KPI
            if (v._esSubTicket && v._parentTicketId && idsRutasEnAllData.has(Number(v._parentTicketId))) {
                return;
            }

            if (v._origen === 'RECEPTORIA') {
                countComp++;
                const desp = Number(v.litrosDespachados || 0);
                const rec = v.litrosRecibidosCompania != null ? Number(v.litrosRecibidosCompania) : desp;
                ltsDespachadosComp += desp;
                ltsRecibidosComp += rec;
            } else {
                countRutas++;
                const finca = Number(v.totalLitrosFinca || 0);
                const ltsTotRec = (v.totalLitrosReceptoria != null && Number(v.totalLitrosReceptoria) > 0) ? Number(v.totalLitrosReceptoria) : 0;
                const ltsRecRecep = (v.litrosRecibidosReceptoria != null) ? Number(v.litrosRecibidosReceptoria) : 0;
                const ltsEntPlanta = (v.litrosEntregadosCompania != null) ? Number(v.litrosEntregadosCompania) : 0;
                let rec = 0;
                if (ltsTotRec > 0) {
                    rec = ltsTotRec;
                } else if ((ltsRecRecep + ltsEntPlanta) > 0) {
                    rec = ltsRecRecep + ltsEntPlanta;
                } else if (p === 4 || v.estado === 'CUADRADO' || v.estado === 'FINALIZADO') {
                    rec = finca;
                } else {
                    rec = finca;
                }
                ltsFincasRutas += finca;
                ltsRecibidosRutas += rec;
            }
        });

        // Configuración dinámica de KPIs según la vista seleccionada
        const lblLts1 = document.getElementById('lblKpiLitrosFincas');
        const subLts1 = document.getElementById('subKpiLitrosFincas');
        const kpiLts1 = document.getElementById('kpiLitrosFincasTotal');

        const lblLts2 = document.getElementById('lblKpiLitrosEntregados');
        const subLts2 = document.getElementById('subKpiLitrosEntregados');
        const kpiLts2 = document.getElementById('kpiLitrosEntregadosTotal');

        const lblMerma = document.getElementById('lblKpiMermaGlobal');
        const kpiMerma = document.getElementById('kpiMermaGlobalTickets');
        const kpiMermaPct = document.getElementById('kpiMermaPorcentajeGlobal');
        const cardMerma = document.getElementById('cardKpiMermaGlobal');
        const iconWrapMerma = document.getElementById('iconWrapMermaGlobal');
        const subTotViajes = document.getElementById('subKpiTotalTickets');

        let displayLtsOrigen = 0;
        let displayLtsDestino = 0;
        let displayDif = 0;

        if (origenFiltro === 'RECEPTORIA') {
            if (lblLts1) lblLts1.innerText = 'VOLUMEN DESPACHADO';
            if (subLts1) subLts1.innerText = 'Salida de Receptoría';
            if (lblLts2) lblLts2.innerText = 'VOLUMEN QUESERAS';
            if (subLts2) subLts2.innerText = 'Recibido en Compañías';
            if (lblMerma) lblMerma.innerText = 'VARIACIÓN QUESERAS';
            if (subTotViajes) subTotViajes.innerText = `${countComp} Despachos en período`;

            displayLtsOrigen = ltsDespachadosComp;
            displayLtsDestino = ltsRecibidosComp;
            displayDif = ltsRecibidosComp - ltsDespachadosComp; // > 0 es ganancia

        } else if (origenFiltro === 'RUTA') {
            if (lblLts1) lblLts1.innerText = 'VOLUMEN FINCAS';
            if (subLts1) subLts1.innerText = 'Recolectado en ruta';
            if (lblLts2) lblLts2.innerText = 'VOLUMEN RECIBIDO';
            if (subLts2) subLts2.innerText = 'En Receptoría / Plantas';
            if (lblMerma) lblMerma.innerText = 'MERMA RECOLECCIÓN';
            if (subTotViajes) subTotViajes.innerText = `${countRutas} Rutas en período`;

            displayLtsOrigen = ltsFincasRutas;
            displayLtsDestino = ltsRecibidosRutas;
            displayDif = ltsRecibidosRutas - ltsFincasRutas; // < 0 es pérdida

        } else {
            // Todos los Orígenes: Mostrar la producción primaria recolectada en fincas
            if (lblLts1) lblLts1.innerText = 'VOLUMEN FINCAS';
            if (subLts1) subLts1.innerText = `Recolectado en ${countRutas} rutas`;
            if (lblLts2) lblLts2.innerText = 'VOLUMEN RECIBIDO';
            if (subLts2) subLts2.innerText = `En Receptoría y Plantas`;
            if (lblMerma) lblMerma.innerText = 'MERMA EN RUTAS';
            if (subTotViajes) subTotViajes.innerText = `${countRutas} Rutas · ${countComp} Despachos`;

            displayLtsOrigen = ltsFincasRutas;
            displayLtsDestino = ltsRecibidosRutas;
            displayDif = ltsRecibidosRutas - ltsFincasRutas;
        }

        const kpiTot = document.getElementById('kpiTotalTickets');
        if (kpiTot) kpiTot.innerText = total.toLocaleString('es-VE');

        if (kpiLts1) kpiLts1.innerText = `${displayLtsOrigen.toLocaleString('es-VE')} L`;
        if (kpiLts2) kpiLts2.innerText = `${displayLtsDestino.toLocaleString('es-VE')} L`;

        const kpiAbi = document.getElementById('kpiTicketsAbiertos');
        if (kpiAbi) kpiAbi.innerText = abiertos;
        const kpiRec = document.getElementById('kpiTicketsReceptoria');
        if (kpiRec) kpiRec.innerText = receptoria;
        const kpiEnt = document.getElementById('kpiTicketsEntregados');
        if (kpiEnt) kpiEnt.innerText = entregados;

        const kpiEnProceso = document.getElementById('kpiTicketsEnProcesoTotal');
        if (kpiEnProceso) kpiEnProceso.innerText = abiertos + receptoria + entregados;

        const kpiFin = document.getElementById('kpiTicketsFinalizados');
        if (kpiFin) kpiFin.innerText = finalizados.toLocaleString('es-VE');

        const kpiEfect = document.getElementById('kpiEfectividadTickets');
        if (kpiEfect) {
            const pct = total > 0 ? ((finalizados / total) * 100).toFixed(1) : '100';
            kpiEfect.innerText = `${pct}%`;
        }

        if (kpiMerma) {
            const absDif = Math.abs(displayDif);
            const pct = displayLtsOrigen > 0 ? ((absDif / displayLtsOrigen) * 100).toFixed(2) : '0.00';

            if (displayDif > 0) {
                // Ganancia / Excedente
                kpiMerma.innerText = `+${absDif.toLocaleString('es-VE')} Lts`;
                if (kpiMermaPct) kpiMermaPct.innerText = `+${pct}% ganancia / excedente`;
                kpiMerma.style.color = '#059669';
                if (kpiMermaPct) kpiMermaPct.style.color = '#10b981';
                if (cardMerma) cardMerma.style.borderColor = '#a7f3d0';
                if (iconWrapMerma) {
                    iconWrapMerma.style.background = 'rgba(16, 185, 129, 0.15)';
                    iconWrapMerma.style.color = '#059669';
                }
            } else if (displayDif < 0) {
                // Merma / Pérdida
                kpiMerma.innerText = `-${absDif.toLocaleString('es-VE')} Lts`;
                if (kpiMermaPct) kpiMermaPct.innerText = `-${pct}% del volumen total`;
                if (parseFloat(pct) <= 1.0) {
                    kpiMerma.style.color = '#d97706';
                    if (kpiMermaPct) kpiMermaPct.style.color = '#f59e0b';
                    if (cardMerma) cardMerma.style.borderColor = '#fde68a';
                    if (iconWrapMerma) {
                        iconWrapMerma.style.background = 'rgba(245, 158, 11, 0.15)';
                        iconWrapMerma.style.color = '#d97706';
                    }
                } else {
                    kpiMerma.style.color = '#dc2626';
                    if (kpiMermaPct) kpiMermaPct.style.color = '#ef4444';
                    if (cardMerma) cardMerma.style.borderColor = '#fecaca';
                    if (iconWrapMerma) {
                        iconWrapMerma.style.background = 'rgba(239, 68, 68, 0.15)';
                        iconWrapMerma.style.color = '#dc2626';
                    }
                }
            } else {
                kpiMerma.innerText = '0 Lts';
                if (kpiMermaPct) kpiMermaPct.innerText = '0.00% variación';
                kpiMerma.style.color = '#059669';
                if (kpiMermaPct) kpiMermaPct.style.color = '#10b981';
                if (cardMerma) cardMerma.style.borderColor = '#a7f3d0';
                if (iconWrapMerma) {
                    iconWrapMerma.style.background = 'rgba(16, 185, 129, 0.15)';
                    iconWrapMerma.style.color = '#059669';
                }
            }
        }

        // Aplicar filtros locales y renderizar DataTable
        aplicarFiltrosYRenderizarDataTableTickets();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center" style="padding: 24px; color: #f87171;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar bitácora: ${err.message}</td></tr>`;
    } finally {
        if (iconRefresh) {
            setTimeout(() => iconRefresh.classList.remove('fa-spin'), 300);
        }
    }
}
window.cargarControlViajesTickets = cargarControlViajesTickets;

// Rangos de fecha rápidos
function setRangoFechasTickets(tipo) {
    const fDesde = document.getElementById('filtroTicketFechaDesde');
    const fHasta = document.getElementById('filtroTicketFechaHasta');
    if (!fDesde || !fHasta) return;

    const hoy = new Date();
    fHasta.value = hoy.toISOString().split('T')[0];

    if (tipo === 7) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fDesde.value = d.toISOString().split('T')[0];
    } else if (tipo === 30) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fDesde.value = d.toISOString().split('T')[0];
    } else if (tipo === 'mes') {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fDesde.value = d.toISOString().split('T')[0];
    } else if (tipo === '2026') {
        fDesde.value = '2026-01-01';
        fHasta.value = '2026-12-31';
    }

    cargarControlViajesTickets();
}
window.setRangoFechasTickets = setRangoFechasTickets;

// Limpiar filtros
function limpiarFiltrosTickets() {
    if (comboboxFiltroTicketChoferInstance && typeof comboboxFiltroTicketChoferInstance.reset === 'function') {
        comboboxFiltroTicketChoferInstance.reset();
    }
    const hiddenChofer = document.getElementById('filterTicketChoferVal');
    if (hiddenChofer) hiddenChofer.value = '';
    const selProc = document.getElementById('filtroTicketProceso');
    if (selProc) selProc.value = '';
    const selOrigen = document.getElementById('filtroTicketOrigen');
    if (selOrigen) selOrigen.value = '';
    const searchInput = document.getElementById('dtSearchTickets');
    if (searchInput) searchInput.value = '';
    dtTicketsState.searchQuery = '';
    const clearBtn = document.getElementById('btnDtClearSearchTickets');
    if (clearBtn) clearBtn.style.display = 'none';

    setRangoFechasTickets(30);
}
window.limpiarFiltrosTickets = limpiarFiltrosTickets;

// Búsqueda en vivo
function filtrarDataTableTicketsEnVivo() {
    const input = document.getElementById('dtSearchTickets');
    const query = (input?.value || '').trim().toLowerCase();
    dtTicketsState.searchQuery = query;

    const clearBtn = document.getElementById('btnDtClearSearchTickets');
    if (clearBtn) {
        clearBtn.style.display = query ? 'block' : 'none';
    }

    dtTicketsState.currentPage = 1;
    aplicarFiltrosYRenderizarDataTableTickets();
}
window.filtrarDataTableTicketsEnVivo = filtrarDataTableTicketsEnVivo;

function limpiarBusquedaTickets() {
    const input = document.getElementById('dtSearchTickets');
    if (input) input.value = '';
    filtrarDataTableTicketsEnVivo();
}
window.limpiarBusquedaTickets = limpiarBusquedaTickets;

// Cambiar tamaño de página
function cambiarPageSizeTickets(val) {
    dtTicketsState.pageSize = val === 'all' ? 999999 : Number(val);
    dtTicketsState.currentPage = 1;
    renderizarDataTableTickets();
}
window.cambiarPageSizeTickets = cambiarPageSizeTickets;

// Ir a página específica
function irAPaginaTickets(pag) {
    dtTicketsState.currentPage = pag;
    renderizarDataTableTickets();
}
window.irAPaginaTickets = irAPaginaTickets;

// Ordenar columnas
function ordenarDataTableTickets(col) {
    if (dtTicketsState.sortCol === col) {
        dtTicketsState.sortAsc = !dtTicketsState.sortAsc;
    } else {
        dtTicketsState.sortCol = col;
        // Campos que por defecto ordenan descendente
        const descCols = ['id', 'fecha', 'cicloId', 'totalFincas', 'totalLitrosFinca', 'litrosRecibidosReceptoria', 'diferenciaLitros', 'porcentajeMerma', 'mermaTotalLitros'];
        dtTicketsState.sortAsc = !descCols.includes(col);
    }

    // Actualizar iconos de ordenamiento
    const cols = ['id', 'fecha', 'cicloId', 'nombreConductor', 'totalFincas', 'totalLitrosFinca', 'tipoDestino', 'litrosRecibidosReceptoria', 'diferenciaLitros', 'porcentajeMerma', 'mermaTotalLitros', 'procesoActualId'];
    cols.forEach(c => {
        const icon = document.getElementById(`sortIcon_${c}`);
        if (icon) {
            if (c === dtTicketsState.sortCol) {
                icon.className = dtTicketsState.sortAsc ? 'fa-solid fa-sort-up sort-icon' : 'fa-solid fa-sort-down sort-icon';
            } else {
                icon.className = 'fa-solid fa-sort sort-icon';
            }
        }
    });

    aplicarFiltrosYRenderizarDataTableTickets();
}
window.ordenarDataTableTickets = ordenarDataTableTickets;

// Aplicar filtros y ordenar
function aplicarFiltrosYRenderizarDataTableTickets() {
    // 1. Mostrar SOLO tickets principales / padres en la tabla principal
    let list = (dtTicketsState.allData || []).filter(v => !v._esSubTicket);

    // 2. Filtro por texto en vivo (busca en el ticket padre y en sus sub-despachos asociados)
    if (dtTicketsState.searchQuery) {
        const q = dtTicketsState.searchQuery.toLowerCase().trim();
        list = list.filter(v => {
            const ticketId = String(v.id || '');
            const fecha = String(v.fecha || '').split('T')[0];
            const chofer = String(v.nombreConductor || '').toLowerCase();
            const destino = String(v.nombreCompaniaDestino || v.tipoDestino || '').toLowerCase();
            const semana = String(v.cicloId || '');
            const obs = String(v.observacion || '').toLowerCase();
            const lts = String(v.totalLitrosFinca || '');

            // Buscar también en sub-despachos hijos de esta ruta
            const subDespachos = (dtTicketsState.allData || []).filter(s => s._esSubTicket && Number(s._parentTicketId) === Number(v.id));
            const matchSub = subDespachos.some(s => 
                String(s.id).includes(q) || 
                (s.nombreCompaniaDestino && s.nombreCompaniaDestino.toLowerCase().includes(q)) ||
                (s.nombreConductor && s.nombreConductor.toLowerCase().includes(q)) ||
                (s.observacion && s.observacion.toLowerCase().includes(q))
            );

            return ticketId.includes(q) ||
                   fecha.includes(q) ||
                   chofer.includes(q) ||
                   destino.includes(q) ||
                   semana.includes(q) ||
                   obs.includes(q) ||
                   lts.includes(q) ||
                   matchSub;
        });
    }

    // 3. Ordenamiento
    const col = dtTicketsState.sortCol;
    const asc = dtTicketsState.sortAsc;

    list.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'fecha') {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
        } else if (typeof valA === 'string') {
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        } else {
            valA = Number(valA || 0);
            valB = Number(valB || 0);
        }

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
    });

    dtTicketsState.filteredData = list;
    renderizarDataTableTickets();
}

// Renderizado principal de la tabla
function renderizarDataTableTickets() {
    const tbody = document.getElementById('tbodyControlViajes');
    const tfoot = document.getElementById('tfootControlViajes');
    const infoText = document.getElementById('dtInfoTickets');
    const navCont = document.getElementById('dtNavTickets');
    const lblTotalHeader = document.getElementById('lblTotalRegistrosHeader');

    if (!tbody) return;

    const total = dtTicketsState.filteredData.length;
    if (lblTotalHeader) lblTotalHeader.innerText = total.toLocaleString('es-VE');

    if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="text-center" style="padding: 30px; color: #94a3b8;"><i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No se encontraron viajes que coincidan con la búsqueda.</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        if (infoText) infoText.innerText = 'Mostrando 0 registros';
        if (navCont) navCont.innerHTML = '';
        return;
    }

    // Paginación
    const pageSize = dtTicketsState.pageSize;
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (dtTicketsState.currentPage > totalPages) dtTicketsState.currentPage = totalPages;
    const currentPage = dtTicketsState.currentPage;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageItems = dtTicketsState.filteredData.slice(startIdx, endIdx);

    let html = '';
    pageItems.forEach(v => {
        const rowKey = v._rowKey || `${v._origen || 'RUTA'}_${v.id}`;
        const isExpanded = dtTicketsState.expandedTicketIds.has(rowKey);
        const pId = v.procesoActualId || 1;

        // Badge de Estado con estilo enriquecido
        let badgeEstado = '';
        if (pId === 1) {
            badgeEstado = '<span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700; padding: 4px 9px;"><i class="fa-solid fa-route"></i> En Ruta</span>';
        } else if (pId === 2) {
            badgeEstado = '<span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700; padding: 4px 9px;"><i class="fa-solid fa-warehouse"></i> Recibido</span>';
        } else if (pId === 3) {
            badgeEstado = '<span class="badge" style="background: rgba(139, 92, 246, 0.12); color: #7c3aed; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 700; padding: 4px 9px;"><i class="fa-solid fa-building"></i> En Quesera</span>';
        } else {
            badgeEstado = '<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; padding: 4px 9px;"><i class="fa-solid fa-circle-check"></i> Finalizado</span>';
        }

        // Destino con badge y color semántico
        let badgeDestino = '';
        if (v._esSubTicket) {
            badgeDestino = `<span class="badge" style="background: rgba(147, 51, 234, 0.12); color: #7c3aed; border: 1px solid rgba(147, 51, 234, 0.3); font-weight: 700; font-size: 11px;" title="Sub-Despacho de Ruta #${v._parentTicketId} ➔ ${v.nombreCompaniaDestino}"><i class="fa-solid fa-code-branch"></i> ${v.nombreCompaniaDestino || 'Compañía'}</span>`;
        } else if (v._origen === 'RECEPTORIA') {
            badgeDestino = `<span class="badge" style="background: rgba(147, 51, 234, 0.12); color: #7c3aed; border: 1px solid rgba(147, 51, 234, 0.3); font-weight: 700; font-size: 11px;" title="Despacho Planta ➔ ${v.nombreCompaniaDestino}"><i class="fa-solid fa-truck-ramp-box"></i> ${v.nombreCompaniaDestino || 'Compañía'}</span>`;
        } else {
            // Verificar si esta ruta tiene múltiples sub-despachos asociados
            const subDespachosAsociados = (dtTicketsState.allData || []).filter(x => x._esSubTicket && Number(x._parentTicketId) === Number(v.id));
            if (subDespachosAsociados.length > 1) {
                const nombresDest = subDespachosAsociados.map(s => s.nombreCompaniaDestino || 'Destino').join(' + ');
                badgeDestino = `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 11px;" title="Ruta Multi-Destino (${subDespachosAsociados.length}): ${nombresDest}"><i class="fa-solid fa-route"></i> ${nombresDest} (${subDespachosAsociados.length})</span>`;
            } else if (v.tipoDestino === 'RECEPTORIA' || !v.nombreCompaniaDestino) {
                badgeDestino = '<span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; border: 1px solid rgba(2, 132, 199, 0.3); font-weight: 700; font-size: 11px;"><i class="fa-solid fa-warehouse"></i> Receptoría</span>';
            } else {
                badgeDestino = `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 11px;" title="Ruta Directa Finca ➔ ${v.nombreCompaniaDestino}"><i class="fa-solid fa-route"></i> ${v.nombreCompaniaDestino}</span>`;
            }
        }

        // Formatos volumétricos
        const ltsFincaNum = (v.totalLitrosFinca || 0);
        const ltsAdicNum = (v.litrosCargadosAdicional || 0);
        const ltsTotalCamionNum = ltsFincaNum + ltsAdicNum;
        const ltsFinca = ltsTotalCamionNum.toLocaleString('es-VE');
        const ltsRecNum = v.totalLitrosReceptoria != null ? Number(v.totalLitrosReceptoria) : (v.litrosRecibidosReceptoria != null ? Number(v.litrosRecibidosReceptoria) : (v.litrosEntregadosCompania != null ? Number(v.litrosEntregadosCompania) : 0));
        const ltsRec = ltsRecNum > 0 ? ltsRecNum.toLocaleString('es-VE') : '-';

        // Diferencia (Pérdida en destino se muestra negativa)
        const difVal = v.diferenciaLitros != null ? v.diferenciaLitros : (v.diferenciaReceptoria || 0);
        let difHtml = '';
        if (difVal === 0) {
            difHtml = '<span style="color: #059669; font-weight: 700;">0 L</span>';
        } else if (difVal > 0) {
            difHtml = `<span style="color: #dc2626; font-weight: 700;">-${difVal.toLocaleString('es-VE')} L</span>`;
        } else {
            difHtml = `<span style="color: #059669; font-weight: 700;">+${Math.abs(difVal).toLocaleString('es-VE')} L</span>`;
        }

        // % Merma Semáforo dinámico y ponderado
        const ltsBaseCalc = Number(v.totalLitrosFinca || v.litrosDespachados || 0);
        const pctMerma = (v.porcentajeMerma != null && Number(v.porcentajeMerma) > 0)
            ? Number(v.porcentajeMerma)
            : (ltsBaseCalc > 0 && Math.abs(difVal) > 0 ? ((Math.abs(difVal) / ltsBaseCalc) * 100) : 0);

        let badgePctMerma = '';
        if (difVal < 0) {
            // Ganancia / Excedente a favor en quesera o destino
            badgePctMerma = `<span class="badge" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-weight: 700; font-size: 11px;">+${Math.abs(pctMerma).toFixed(2)}%</span>`;
        } else if (difVal === 0) {
            badgePctMerma = `<span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11px;">0.00%</span>`;
        } else if (pctMerma <= 1.0) {
            badgePctMerma = `<span class="badge" style="background: #fffbeb; color: #d97706; border: 1px solid #fde68a; font-weight: 700; font-size: 11px;">-${pctMerma.toFixed(2)}%</span>`;
        } else {
            badgePctMerma = `<span class="badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 700; font-size: 11px;"><i class="fa-solid fa-triangle-exclamation"></i> -${pctMerma.toFixed(2)}%</span>`;
        }

        // Merma Total Litros (Pérdida con signo negativo)
        const mermaVal = v.mermaTotalLitros != null ? v.mermaTotalLitros : (v.diferenciaLitros || 0);
        const colorMerma = mermaVal <= 0 ? '#059669' : '#dc2626';
        const mermaTxt = mermaVal > 0 
            ? `-${mermaVal.toLocaleString('es-VE')} L` 
            : (mermaVal < 0 ? `+${Math.abs(mermaVal).toLocaleString('es-VE')} L` : '0 L');

        const fechaFmt = (v.fecha || '').split('T')[0];

        html += `
            <tr class="dt-row-main ${isExpanded ? 'expanded' : ''} ${v._esSubTicket ? 'dt-row-subticket' : ''}" id="mainRow_${rowKey}" style="${v._esSubTicket ? 'background: #faf5ff;' : ''}">
                <td style="text-align: center;">
                    <button type="button" class="btn-expand-row ${isExpanded ? 'open' : ''}" onclick="toggleExpandTicket('${rowKey}', event)" title="${isExpanded ? 'Ocultar desglose' : 'Ver desglose'}">
                        <i class="fa-solid ${isExpanded ? 'fa-minus' : 'fa-plus'}"></i>
                    </button>
                </td>
                <td>
                    ${v._esSubTicket ? `
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="font-weight: 800; color: #7e22ce; font-size: 12.5px;">SUB-#${v.id}</span>
                            <span class="badge" style="background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; font-size: 9.5px; padding: 1px 5px; font-weight: 700;" title="Sub-despacho del ticket principal #${v._parentTicketId}">
                                <i class="fa-solid fa-code-branch"></i> Sub #${v._parentTicketId}
                            </span>
                        </div>
                    ` : (v._origen === 'RECEPTORIA' ? `
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="font-weight: 800; color: #9333ea; font-size: 13px;">#${v.id}</span>
                            <span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 9.5px; padding: 1px 5px; font-weight: 700;">
                                <i class="fa-solid fa-truck-ramp-box"></i> Planta
                            </span>
                        </div>
                    ` : `
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="font-weight: 800; color: #4338ca; font-size: 13px;">#${v.id}</span>
                            <span class="badge" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-size: 9.5px; padding: 1px 5px; font-weight: 700;">
                                <i class="fa-solid fa-route"></i> Ruta
                            </span>
                        </div>
                    `)}
                </td>
                <td>
                    <span style="color: #334155; font-size: 12px;"><i class="fa-regular fa-calendar" style="color: #94a3b8; margin-right: 4px;"></i>${fechaFmt}</span>
                </td>
                <td style="text-align: center;">
                    <span class="badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 11px; font-weight: 600;">S${v.cicloId || '-'}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <div style="width: 26px; height: 26px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                            ${(v.nombreConductor || 'C').charAt(0).toUpperCase()}
                        </div>
                        <strong style="color: #0f172a; font-size: 12.5px;">${v.nombreConductor || '-'}</strong>
                    </div>
                </td>
                <td style="text-align: center;">
                    ${v._esSubTicket ? `
                        <span style="color: #94a3b8; font-size: 10.5px; font-style: italic;">Sub-despacho</span>
                    ` : (v._origen === 'RECEPTORIA' ? `
                        <span class="badge" style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; font-weight: 700; font-size: 11.5px;" title="Despacho directo desde Planta (0 fincas)">
                            0
                        </span>
                    ` : `
                        <span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11.5px;" title="${v.totalFincas || 0} fincas recolectadas">
                            ${v.totalFincas || 0}
                        </span>
                    `)}
                </td>
                <td style="text-align: right; font-weight: 700; color: #0284c7;">
                    ${ltsFinca} L
                    ${ltsAdicNum > 0 ? `
                        <span class="badge" style="background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; font-size: 9.5px; font-weight: 700; display: block; margin-top: 2px;" title="${v.observacion || `Incluye +${ltsAdicNum.toLocaleString('es-VE')} L de traspaso`}">
                            <i class="fa-solid fa-right-left"></i> +${ltsAdicNum.toLocaleString('es-VE')} L
                        </span>
                    ` : ''}
                </td>
                <td>${badgeDestino}</td>
                <td style="text-align: right; font-weight: 600; color: #334155;">${ltsRec} ${ltsRec !== '-' ? 'L' : ''}</td>
                <td style="text-align: right;">${difHtml}</td>
                <td style="text-align: center;">${badgePctMerma}</td>
                <td style="text-align: right; font-weight: 800; color: ${colorMerma};">
                    ${mermaTxt}
                    ${v._esSubTicket ? `<span style="font-size: 9.5px; color: #94a3b8; font-weight: 600; display: block;">(Desglose #${v._parentTicketId})</span>` : ''}
                </td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center;">
                        <button type="button" class="btn-icon" onclick="abrirModalEditarTicket('${v._origen || 'RUTA'}', ${v.id})" title="Editar Ticket #${v.id} (${v._origen || 'RUTA'})" style="color: #d97706; background: #fffbeb; border: 1px solid #fde68a; width: 30px; height: 30px;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-icon" onclick="verTrazabilidadViaje('${v._origen || 'RUTA'}', ${v.id})" title="Ver Trazabilidad y Auditoría" style="color: #4f46e5; background: #eef2ff; width: 30px; height: 30px;">
                            <i class="fa-solid fa-timeline"></i>
                        </button>
                        <button type="button" class="btn-icon" onclick="imprimirTicketViajeIndividual('${v._origen || 'RUTA'}', ${v.id})" title="Imprimir Comprobante de Viaje" style="color: #0284c7; background: #f0f9ff; width: 30px; height: 30px;">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        ${(state.user && state.user.rol === 'ADMIN' && pId !== 4 && v._origen === 'RUTA') ? `
                            <button type="button" class="btn-icon" onclick="finalizarViajeAdmin(${v.id})" title="Finalizar y Auditar Viaje" style="color: #10b981; background: #ecfdf5; width: 30px; height: 30px;">
                                <i class="fa-solid fa-check-to-slot"></i>
                            </button>
                        ` : ''}
                        ${(pId === 1 || pId === 2) && v._origen === 'RUTA' ? `
                            <button type="button" class="btn-icon" onclick="abrirModalTraspasoLeche(${v.id})" title="Traspasar Leche a Otro Chofer" style="color: #0d9488; background: #f0fdfa; border: 1px solid #99f6e4; width: 30px; height: 30px;">
                                <i class="fa-solid fa-right-left"></i>
                            </button>
                        ` : ''}
                        ${(state.user && (state.user.rol === 'ADMIN' || state.user.rol === 'SUPERADMIN') && v._origen === 'RUTA') ? `
                            <button type="button" class="btn-icon" onclick="revertirProcesoViajeAdmin(${v.id})" title="Revertir / Reabrir Proceso de Viaje (Admin)" style="color: #6366f1; background: #eef2ff; border: 1px solid #c7d2fe; width: 30px; height: 30px;">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        ` : ''}
                        ${(state.user && state.user.rol === 'ADMIN') ? `
                            <button type="button" class="btn-icon" onclick="eliminarTicketAdmin('${v._origen || 'RUTA'}', ${v.id})" title="Eliminar Ticket Definitivamente (ADMIN)" style="color: #ef4444; background: #fef2f2; width: 30px; height: 30px;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;

        // Fila de acordeón expandible
        if (isExpanded) {
            const tituloDesglose = v._esSubTicket
                ? `Detalle de Sub-Despacho #${v.id} (Ruta #${v._parentTicketId})`
                : (v._origen === 'RECEPTORIA' ? `Despacho Directo de Planta #${v.id} &mdash; Salida a ${v.nombreCompaniaDestino || 'Compañía'}` : `Desglose de Fincas y Trazabilidad &mdash; Ticket de Ruta #${v.id}`);

            html += `
                <tr class="dt-child-row" id="childRow_${rowKey}">
                    <td colspan="14" style="padding: 0;">
                        <div class="dt-child-content" id="childContent_${rowKey}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fa-solid ${v._origen === 'RECEPTORIA' ? 'fa-truck-ramp-box' : (v._esSubTicket ? 'fa-code-branch' : 'fa-list-ol')}" style="color: ${v._origen === 'RECEPTORIA' ? '#9333ea' : '#4f46e5'};"></i>
                                    <strong style="color: #0f172a; font-size: 13px;">${tituloDesglose}</strong>
                                    <span style="font-size: 11.5px; color: #64748b;">(Fecha: ${fechaFmt} | Chofer: ${v.nombreConductor})</span>
                                </div>
                                <div>
                                    <button type="button" class="btn btn-sm" onclick="verTrazabilidadViaje('${v._origen || 'RUTA'}', ${v.id})" style="background: #ffffff; border: 1px solid #cbd5e1; color: #4f46e5; padding: 4px 10px; font-size: 11px; font-weight: 600;">
                                        <i class="fa-solid fa-clock-rotate-left"></i> Historial Completo
                                    </button>
                                </div>
                            </div>
                            <div id="fincasContainer_${rowKey}">
                                <div style="text-align: center; padding: 12px; color: #94a3b8;">
                                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando información...
                                </div>
                            </div>
                            ${v.observacion ? `
                                <div style="margin-top: 10px; padding: 8px 12px; background: #ffffff; border-left: 3px solid #6366f1; border-radius: 4px; font-size: 12px; color: #475569;">
                                    <strong>Observaciones:</strong> ${v.observacion}
                                </div>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = html;

    // Disparar carga de fincas para filas expandidas que no estén cargadas aún
    pageItems.forEach(v => {
        const rowKey = v._rowKey || `${v._origen || 'RUTA'}_${v.id}`;
        if (dtTicketsState.expandedTicketIds.has(rowKey)) {
            cargarFincasFilaExpandida(rowKey);
        }
    });

    // RENDERIZAR FOOTER DE TOTALES DE LA VISTA (CON DEDUPLICACIÓN DE SUB-TICKETS)
    if (tfoot) {
        let sumFincas = 0;
        let sumLtsFinca = 0;
        let sumLtsRec = 0;
        let sumDif = 0;
        let sumMerma = 0;
        let countViajesPrincipales = 0;
        let countSubTickets = 0;

        // Set de IDs de rutas principales presentes en el conjunto filtrado
        const idsRutasEnLista = new Set(
            dtTicketsState.filteredData
                .filter(v => !v._esSubTicket)
                .map(v => Number(v.id))
        );

        dtTicketsState.filteredData.forEach(v => {
            // Regla de no-duplicación:
            // Si es un sub-ticket y su ruta principal ya está en la lista actual,
            // no sumamos sus litros ni mermas porque ya están consolidados en el ticket principal de ruta
            if (v._esSubTicket && v._parentTicketId && idsRutasEnLista.has(Number(v._parentTicketId))) {
                countSubTickets++;
                return; // Evita duplicar faltantes y litros!
            }

            countViajesPrincipales++;
            sumFincas += (v.totalFincas || 0);
            sumLtsFinca += (v.totalLitrosFinca || 0);
            const ltsRecViaje = v.totalLitrosReceptoria != null ? Number(v.totalLitrosReceptoria) : (v.litrosRecibidosReceptoria != null ? Number(v.litrosRecibidosReceptoria) : (v.litrosEntregadosCompania != null ? Number(v.litrosEntregadosCompania) : 0));
            sumLtsRec += ltsRecViaje;
            sumDif += (v.diferenciaLitros != null ? v.diferenciaLitros : (v.diferenciaReceptoria || 0));
            sumMerma += Number(v.mermaTotalLitros || 0);
        });

        const pctMermaPond = sumLtsFinca > 0 ? ((Math.abs(sumMerma) / sumLtsFinca) * 100).toFixed(2) : '0.00';
        const colorMermaFooter = sumMerma <= 0 ? '#059669' : '#dc2626';
        const mermaFooterTxt = sumMerma > 0 ? `-${sumMerma.toLocaleString('es-VE')} L` : (sumMerma < 0 ? `+${Math.abs(sumMerma).toLocaleString('es-VE')} L` : '0 L');
        const difFooterTxt = sumDif > 0 ? `-${sumDif.toLocaleString('es-VE')} L` : (sumDif < 0 ? `+${Math.abs(sumDif).toLocaleString('es-VE')} L` : '0 L');
        const pctSigno = sumMerma > 0 ? '-' : (sumMerma < 0 ? '+' : '');

        const txtConteo = countSubTickets > 0
            ? `${countViajesPrincipales.toLocaleString('es-VE')} VIAJES (${countSubTickets} SUB-DESPACHOS)`
            : `${countViajesPrincipales.toLocaleString('es-VE')} VIAJES`;

        tfoot.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: right; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
                    <i class="fa-solid fa-calculator" style="margin-right: 6px; color: #4f46e5;"></i> TOTALES DEL PERÍODO FILTRADO (${txtConteo}):
                </td>
                <td style="text-align: center; color: #0f172a;">${sumFincas.toLocaleString('es-VE')}</td>
                <td style="text-align: right; color: #0284c7;">${sumLtsFinca.toLocaleString('es-VE')} L</td>
                <td style="text-align: center; color: #64748b;">-</td>
                <td style="text-align: right; color: #0f172a;">${sumLtsRec.toLocaleString('es-VE')} L</td>
                <td style="text-align: right; color: ${sumDif > 0 ? '#dc2626' : '#059669'};">${difFooterTxt}</td>
                <td style="text-align: center; color: ${sumMerma > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">${pctSigno}${pctMermaPond}%</td>
                <td style="text-align: right; color: ${colorMermaFooter}; font-weight: 800;">${mermaFooterTxt}</td>
                <td colspan="2" style="text-align: center; color: #059669;">Auditado</td>
            </tr>
        `;
    }

    // RENDERIZAR BARRA DE INFORMACIÓN Y BOTONES DE PAGINACIÓN
    if (infoText) {
        const txtTotalBd = dtTicketsState.allData.length;
        infoText.innerHTML = `Mostrando <strong>${startIdx + 1}</strong> a <strong>${endIdx}</strong> de <strong>${total.toLocaleString('es-VE')}</strong> viajes ${total < txtTotalBd ? `(filtrado de ${txtTotalBd.toLocaleString('es-VE')} en base de datos)` : ''}`;
    }

    if (navCont) {
        if (totalPages <= 1) {
            navCont.innerHTML = '';
            return;
        }

        let navHtml = `
            <button type="button" class="dt-page-btn" onclick="irAPaginaTickets(1)" ${currentPage === 1 ? 'disabled' : ''} title="Primera página">
                <i class="fa-solid fa-angles-left"></i>
            </button>
            <button type="button" class="dt-page-btn" onclick="irAPaginaTickets(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="Página anterior">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
        `;

        // Ventana de páginas visibles
        const maxVisible = 5;
        let startP = Math.max(1, currentPage - 2);
        let endP = Math.min(totalPages, startP + maxVisible - 1);
        if (endP - startP < maxVisible - 1) {
            startP = Math.max(1, endP - maxVisible + 1);
        }

        if (startP > 1) {
            navHtml += `<button type="button" class="dt-page-btn" onclick="irAPaginaTickets(1)">1</button>`;
            if (startP > 2) navHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
        }

        for (let p = startP; p <= endP; p++) {
            navHtml += `
                <button type="button" class="dt-page-btn ${p === currentPage ? 'active' : ''}" onclick="irAPaginaTickets(${p})">
                    ${p}
                </button>
            `;
        }

        if (endP < totalPages) {
            if (endP < totalPages - 1) navHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
            navHtml += `<button type="button" class="dt-page-btn" onclick="irAPaginaTickets(${totalPages})">${totalPages}</button>`;
        }

        navHtml += `
            <button type="button" class="dt-page-btn" onclick="irAPaginaTickets(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} title="Página siguiente">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button type="button" class="dt-page-btn" onclick="irAPaginaTickets(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} title="Última página">
                <i class="fa-solid fa-angles-right"></i>
            </button>
        `;

        navCont.innerHTML = navHtml;
    }
}

// Expandir / Colapsar Fila de Acordeón
function toggleExpandTicket(rowKeyOrId, event) {
    if (event) event.stopPropagation();
    const key = String(rowKeyOrId);

    if (dtTicketsState.expandedTicketIds.has(key)) {
        dtTicketsState.expandedTicketIds.delete(key);
    } else {
        dtTicketsState.expandedTicketIds.add(key);
    }

    renderizarDataTableTickets();
}
window.toggleExpandTicket = toggleExpandTicket;

// Cargar fincas y despachos en fila expandida
async function cargarFincasFilaExpandida(rowKeyOrId) {
    const container = document.getElementById(`fincasContainer_${rowKeyOrId}`);
    if (!container) return;

    const ticketItem = (dtTicketsState.allData || []).find(x => 
        (x._rowKey && x._rowKey === String(rowKeyOrId)) ||
        (String(x.id) === String(rowKeyOrId))
    );

    if (!ticketItem) {
        container.innerHTML = `<div style="color: #94a3b8; font-size: 12px; padding: 8px;">No se encontró información para este registro.</div>`;
        return;
    }

    // 1. Si es un sub-ticket de despacho individual
    if (ticketItem._esSubTicket) {
        const ltsDesp = Number(ticketItem.litrosDespachados || ticketItem.totalLitrosFinca || 0);
        const ltsRec = Number(ticketItem.litrosRecibidosCompania || ticketItem.totalLitrosReceptoria || ltsDesp);
        const dif = Number(ticketItem.diferenciaLitros != null ? ticketItem.diferenciaLitros : (ltsDesp - ltsRec));
        const difColor = dif > 0 ? '#dc2626' : '#059669';
        const difTxt = dif > 0 ? `-${dif.toLocaleString('es-VE')} L` : (dif < 0 ? `+${Math.abs(dif).toLocaleString('es-VE')} L` : '0 L');
        const pct = ticketItem.porcentajeMerma != null ? Number(ticketItem.porcentajeMerma).toFixed(2) : (ltsDesp > 0 ? ((Math.abs(dif)/ltsDesp)*100).toFixed(2) : '0.00');

        container.innerHTML = `
            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 14px 16px; margin-top: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3e8ff; padding-bottom: 10px; margin-bottom: 10px;">
                    <div>
                        <span class="badge" style="background: #7e22ce; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px;">
                            <i class="fa-solid fa-code-branch"></i> Sub-Ticket #${ticketItem.id}
                        </span>
                        <strong style="color: #4c1d95; font-size: 13px; margin-left: 8px;">Despacho de Ruta #${ticketItem._parentTicketId}</strong>
                    </div>
                    <span class="badge" style="background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; font-size: 11px; font-weight: 700;">
                        ${ticketItem.nombreCompaniaDestino || 'Destino'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 12.5px;">
                    <div><span style="color: #64748b;">Litros Despachados:</span> <strong style="color: #0f172a;">${ltsDesp.toLocaleString('es-VE')} L</strong></div>
                    <div><span style="color: #64748b;">Litros Recibidos:</span> <strong style="color: #0284c7;">${ltsRec.toLocaleString('es-VE')} L</strong></div>
                    <div><span style="color: #64748b;">Diferencia / Falla:</span> <strong style="color: ${difColor};">${difTxt}</strong></div>
                    <div><span style="color: #64748b;">% Merma Tramo:</span> <strong style="color: ${difColor};">${pct}%</strong></div>
                    <div><span style="color: #64748b;">Chofer Traslado:</span> <strong style="color: #0f172a;">${ticketItem.nombreConductor || '-'}</strong></div>
                    <div><span style="color: #64748b;">Estado:</span> <strong style="color: #059669;">${ticketItem.estado || 'FINALIZADO'}</strong></div>
                </div>
            </div>
        `;
        return;
    }

    // 2. Si es un Despacho de Planta / Receptoría
    if (ticketItem._origen === 'RECEPTORIA' || ticketItem._origen === 'COMPANIA') {
        const ltsDesp = Number(ticketItem.litrosDespachados || ticketItem.totalLitrosFinca || 0);
        const ltsRec = Number(ticketItem.litrosRecibidosCompania || ticketItem.totalLitrosReceptoria || ltsDesp);
        const dif = Number(ticketItem.diferenciaLitros != null ? ticketItem.diferenciaLitros : (ltsDesp - ltsRec));
        const difColor = dif > 0 ? '#dc2626' : '#059669';
        const difTxt = dif > 0 ? `-${dif.toLocaleString('es-VE')} L` : (dif < 0 ? `+${Math.abs(dif).toLocaleString('es-VE')} L` : '0 L');
        const pct = ticketItem.porcentajeMerma != null ? Number(ticketItem.porcentajeMerma).toFixed(2) : (ltsDesp > 0 ? ((Math.abs(dif)/ltsDesp)*100).toFixed(2) : '0.00');

        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 1.5px solid #d8b4fe; border-radius: 10px; padding: 14px 18px; margin-top: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e9d5ff; padding-bottom: 10px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge" style="background: #9333ea; color: #ffffff; font-size: 11.5px; font-weight: 800; padding: 3px 9px;">
                            <i class="fa-solid fa-truck-ramp-box"></i> Despacho de Planta #${ticketItem.id}
                        </span>
                        <strong style="color: #581c87; font-size: 13.5px;">Salida directa desde Planta / Receptoría</strong>
                    </div>
                    <span class="badge" style="background: #ffffff; color: #7e22ce; border: 1px solid #c084fc; font-size: 11.5px; font-weight: 800; padding: 4px 10px;">
                        <i class="fa-solid fa-building"></i> Destino: ${ticketItem.nombreCompaniaDestino || 'Compañía Quesera'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; font-size: 12.5px;">
                    <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px;">
                        <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block; text-transform: uppercase;">Litros Salida Planta</span>
                        <strong style="color: #0f172a; font-size: 15px;">${ltsDesp.toLocaleString('es-VE')} L</strong>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px;">
                        <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block; text-transform: uppercase;">Litros Llegada Destino</span>
                        <strong style="color: #0284c7; font-size: 15px;">${ltsRec.toLocaleString('es-VE')} L</strong>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px;">
                        <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block; text-transform: uppercase;">Diferencia / Falla</span>
                        <strong style="color: ${difColor}; font-size: 15px;">${difTxt}</strong>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px;">
                        <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block; text-transform: uppercase;">% Merma de Transporte</span>
                        <strong style="color: ${difColor}; font-size: 15px;">${pct}%</strong>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px;">
                        <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block; text-transform: uppercase;">Conductor Asignado</span>
                        <strong style="color: #0f172a; font-size: 13.5px;">${ticketItem.nombreConductor || '-'}</strong>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px;">
                        <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block; text-transform: uppercase;">Estado del Despacho</span>
                        <strong style="color: #059669; font-size: 13.5px;"><i class="fa-solid fa-circle-check"></i> ${ticketItem.estado || 'FINALIZADO'}</strong>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // 3. Si es una Ruta con fincas
    if (dtTicketsState.fincasCache.has(ticketItem.id)) {
        renderFincasEnContenedor(container, dtTicketsState.fincasCache.get(ticketItem.id), ticketItem.id);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketItem.id}/fincas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error('Error al cargar fincas');
        const fincas = await res.json();
        dtTicketsState.fincasCache.set(ticketItem.id, fincas);
        renderFincasEnContenedor(container, fincas, ticketItem.id);
    } catch (err) {
        container.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> No se pudieron cargar las fincas: ${err.message}</div>`;
    }
}

function renderFincasEnContenedor(container, fincas, ticketId) {
    let html = '';
    const ticketItem = (dtTicketsState.allData || []).find(x => x.id === ticketId);

    // Cálculos de resumen de fincas del ticket padre
    const totalFincasCount = fincas ? fincas.length : 0;
    const totalLitrosFincasCalculado = (fincas || []).reduce((sum, f) => sum + (Number(f.litros) || 0), 0);
    const ltsAdicional = Number(ticketItem?.litrosCargadosAdicional || ticketItem?.LitrosCargadosAdicional || 0);
    const totalVolumenCamion = totalLitrosFincasCalculado + ltsAdicional;
    const totalLitrosVaca = (fincas || []).filter(f => !String(f.tipoLeche || f.TipoLeche || f.fincaNombre || '').toUpperCase().includes('BUFAL')).reduce((sum, f) => sum + (Number(f.litros) || 0), 0);
    const totalLitrosBufala = (fincas || []).filter(f => String(f.tipoLeche || f.TipoLeche || f.fincaNombre || '').toUpperCase().includes('BUFAL')).reduce((sum, f) => sum + (Number(f.litros) || 0), 0);
    const totalLitrosAcida = (fincas || []).filter(f => f.esAcida).reduce((sum, f) => sum + (Number(f.litros) || 0), 0);

    // 1. BANNER RESUMEN GENERAL DEL TICKET PADRE
    html += `
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 42px; height: 42px; border-radius: 10px; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                    <i class="fa-solid fa-route"></i>
                </div>
                <div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #0f172a;">
                        Ticket Padre #${ticketId} &bull; Conductor: <span style="color: #4338ca;">${ticketItem ? (ticketItem.nombreConductor || 'Asignado') : 'Conductor'}</span>
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                        Fecha: <strong>${ticketItem ? (ticketItem.fecha || '').split('T')[0] : '-'}</strong> &bull; Semana: <strong>S${ticketItem ? (ticketItem.cicloId || '-') : '-'}</strong> &bull; Recolección en <strong>${totalFincasCount} fincas</strong>
                        ${ltsAdicional > 0 ? ` &bull; <span class="badge" style="background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; font-size: 10.5px; font-weight: 800; padding: 1px 6px;" title="${ticketItem?.observacion || `Recibió traspaso de +${ltsAdicional.toLocaleString('es-VE')} L`}"><i class="fa-solid fa-right-left"></i> Traspaso: +${ltsAdicional.toLocaleString('es-VE')} L</span>` : ''}
                    </div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; text-align: right; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Fincas</div>
                    <div style="font-size: 14.5px; font-weight: 800; color: #0284c7;">${totalLitrosFincasCalculado.toLocaleString('es-VE')} L</div>
                </div>
                ${ltsAdicional > 0 ? `
                    <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 6px 12px; text-align: right; box-shadow: 0 1px 2px rgba(13,148,136,0.06);">
                        <div style="font-size: 10px; font-weight: 800; color: #0d9488; text-transform: uppercase;"><i class="fa-solid fa-right-left"></i> Traspaso Recibido</div>
                        <div style="font-size: 14.5px; font-weight: 900; color: #0f766e;">+${ltsAdicional.toLocaleString('es-VE')} L</div>
                    </div>
                    <div style="background: #f8fafc; border: 1.5px solid #0284c7; border-radius: 8px; padding: 6px 12px; text-align: right; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase;">Total en Camión</div>
                        <div style="font-size: 15.5px; font-weight: 900; color: #0369a1;">${totalVolumenCamion.toLocaleString('es-VE')} L</div>
                    </div>
                ` : ''}
                ${totalLitrosVaca > 0 ? `
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 700; color: #1e40af;">
                        🐄 Vaca: ${totalLitrosVaca.toLocaleString('es-VE')} L
                    </div>
                ` : ''}
                ${totalLitrosBufala > 0 ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 700; color: #065f46;">
                        🐃 Búfala: ${totalLitrosBufala.toLocaleString('es-VE')} L
                    </div>
                ` : ''}
                ${totalLitrosAcida > 0 ? `
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 700; color: #d97706;">
                        ⚠️ Ácida: ${totalLitrosAcida.toLocaleString('es-VE')} L
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // 2. DESGLOSE DE FINCAS
    if (!fincas || !fincas.length) {
        html += '<div style="color: #94a3b8; font-size: 12px; padding: 8px;"><i class="fa-solid fa-info-circle"></i> No hay fincas registradas para este viaje.</div>';
    } else {
        html += `
            <div style="font-weight: 700; font-size: 12px; color: #334155; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span><i class="fa-solid fa-cow" style="color: #0284c7; margin-right: 6px;"></i> Detalle de Fincas Recolectadas (${fincas.length}):</span>
                <span style="font-size: 11px; color: #64748b;">Suma: <strong style="color: #0284c7;">${totalLitrosFincasCalculado.toLocaleString('es-VE')} Lts</strong></span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px;">
        `;
        fincas.forEach((f, idx) => {
            const badgeAcidez = f.esAcida ?
                '<span class="badge badge-warning" style="font-size: 9.5px; padding: 2px 6px;">ÁCIDA</span>' :
                '<span class="badge badge-success" style="font-size: 9.5px; padding: 2px 6px;">DULCE</span>';

            const rawTipo = (f.tipoLeche || f.TipoLeche || ((f.fincaNombre || '').toUpperCase().includes('BUFAL') ? 'BUFALA' : 'VACA')).toUpperCase();
            const esBuf = rawTipo.includes('BUFAL');
            const badgeTipo = esBuf ?
                '<span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 9.5px; padding: 2px 5px; font-weight: 800; margin-left: 4px;">🐃 BÚFALA</span>' :
                '<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 9.5px; padding: 2px 5px; font-weight: 800; margin-left: 4px;">🐄 VACA</span>';

            html += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="min-width: 0; flex: 1; margin-right: 8px;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">#${idx + 1} &bull; ${f.propietario || 'Productor'}</div>
                        <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 3px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <span style="overflow: hidden; text-overflow: ellipsis;">${f.fincaNombre || 'Finca'}</span>
                            ${badgeTipo}
                        </div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0;">
                        <div style="font-size: 14px; font-weight: 800; color: #0284c7;">${(f.litros || 0).toLocaleString('es-VE')} L</div>
                        ${badgeAcidez}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    // 3. DESGLOSE DE SUB-DESPACHOS ASOCIADOS (SUB-TICKETS)
    if (ticketId) {
        const subTickets = (dtTicketsState.allData || []).filter(x => x._esSubTicket && Number(x._parentTicketId) === Number(ticketId));
        if (subTickets && subTickets.length > 0) {
            html += `
                <div style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
                    <div style="font-weight: 700; font-size: 12.5px; color: #7e22ce; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-code-branch" style="margin-right: 6px;"></i> Sub-Despachos / Salidas a Queseras (${subTickets.length} Destino${subTickets.length === 1 ? '' : 's'}):</span>
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Haz clic en el lápiz amarillo para editar el destino</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px;">
            `;
            subTickets.forEach(st => {
                const ltsDesp = Number(st.litrosDespachados || st.totalLitrosFinca || 0);
                const ltsRec = Number(st.litrosRecibidosCompania || st.totalLitrosReceptoria || ltsDesp);
                const dif = Number(st.diferenciaLitros != null ? st.diferenciaLitros : (ltsDesp - ltsRec));
                const difColor = dif > 0 ? '#dc2626' : '#059669';
                const difTxt = dif > 0 ? `-${dif.toLocaleString('es-VE')} L` : (dif < 0 ? `+${Math.abs(dif).toLocaleString('es-VE')} L` : '0 L');
                const pct = st.porcentajeMerma != null ? Number(st.porcentajeMerma).toFixed(2) : (ltsDesp > 0 ? ((Math.abs(dif)/ltsDesp)*100).toFixed(2) : '0.00');

                html += `
                    <div style="background: #faf5ff; border: 1.5px solid #e9d5ff; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(126, 34, 206, 0.05);">
                        <div style="flex: 1; min-width: 0; margin-right: 10px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span class="badge" style="background: #7e22ce; color: #ffffff; font-size: 10.5px; font-weight: 800; padding: 2px 6px;">
                                    Sub #${st.id}
                                </span>
                                <strong style="color: #581c87; font-size: 13px;">${st.nombreCompaniaDestino || 'Destino'}</strong>
                            </div>
                            <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
                                Despacho: <strong style="color: #0f172a;">${ltsDesp.toLocaleString('es-VE')} L</strong> &rarr; Recibido: <strong style="color: #0284c7;">${ltsRec.toLocaleString('es-VE')} L</strong>
                            </div>
                            <div style="font-size: 11px; color: #7c3aed; margin-top: 2px;">
                                Chofer: <strong>${st.nombreConductor}</strong> &bull; Estado: <strong>${st.estado || 'FINALIZADO'}</strong>
                            </div>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                            <div>
                                <div style="font-size: 13.5px; font-weight: 800; color: ${difColor};">${difTxt}</div>
                                <span class="badge" style="background: #ffffff; color: ${difColor}; border: 1px solid ${difColor}44; font-size: 9.5px; padding: 1px 5px; font-weight: 700;">${pct}%</span>
                            </div>
                            <div style="display: flex; gap: 4px; margin-top: 2px;">
                                <button type="button" class="btn-icon" onclick="abrirModalEditarTicket('SUB_DESPACHO', ${st.id})" title="Editar Sub-Despacho #${st.id}" style="color: #d97706; background: #fffbeb; border: 1px solid #fde68a; width: 28px; height: 28px; font-size: 11px; border-radius: 6px;">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button type="button" class="btn-icon" onclick="verTrazabilidadViaje('SUB_DESPACHO', ${st.id})" title="Trazabilidad Sub-Despacho #${st.id}" style="color: #4f46e5; background: #eef2ff; width: 28px; height: 28px; font-size: 11px; border-radius: 6px;">
                                    <i class="fa-solid fa-timeline"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    }

    container.innerHTML = html;
}

// Exportar a Excel (CSV con UTF-8 BOM)
function exportarTicketsExcel() {
    const list = dtTicketsState.filteredData;
    if (!list || !list.length) {
        Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay registros para exportar con los filtros actuales.', background: '#1e293b', color: '#fff' });
        return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM para soporte de acentos en Excel
    csvContent += 'Ticket,Fecha,Semana,Conductor,TotalFincas,LitrosFinca,Destino,LitrosRecibidos,DiferenciaLitros,PorcentajeMerma,MermaTotalLitros,Estado,Observacion\n';

    list.forEach(v => {
        const ticket = v.id;
        const fecha = (v.fecha || '').split('T')[0];
        const semana = v.cicloId || '';
        const chofer = `"${(v.nombreConductor || '').replace(/"/g, '""')}"`;
        const fincas = v.totalFincas || 0;
        const ltsFinca = v.totalLitrosFinca || 0;
        const destino = `"${(v.nombreCompaniaDestino || v.tipoDestino || '').replace(/"/g, '""')}"`;
        const ltsRec = v.litrosRecibidosReceptoria != null ? v.litrosRecibidosReceptoria : (v.totalLitrosReceptoria || 0);
        const dif = v.diferenciaLitros != null ? v.diferenciaLitros : 0;
        const pctMerma = (v.porcentajeMerma || 0).toFixed(2);
        const merma = v.mermaTotalLitros != null ? v.mermaTotalLitros : dif;
        const estado = v.estado || '';
        const obs = `"${(v.observacion || '').replace(/"/g, '""')}"`;

        csvContent += `${ticket},${fecha},${semana},${chofer},${fincas},${ltsFinca},${destino},${ltsRec},${dif},${pctMerma}%,${merma},${estado},${obs}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const hoy = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Bitacora_Control_Viajes_${hoy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
window.exportarTicketsExcel = exportarTicketsExcel;

// Imprimir Bitácora Completa
function imprimirBitacoraTickets() {
    const list = dtTicketsState.filteredData;
    if (!list || !list.length) {
        Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay registros para imprimir.', background: '#1e293b', color: '#fff' });
        return;
    }

    const fDesde = document.getElementById('filtroTicketFechaDesde')?.value || '';
    const fHasta = document.getElementById('filtroTicketFechaHasta')?.value || '';

    let totalLtsFinca = 0;
    let totalLtsRec = 0;
    let totalMerma = 0;
    let rowsHtml = '';

    list.forEach((v, idx) => {
        totalLtsFinca += (v.totalLitrosFinca || 0);
        totalLtsRec += (v.litrosRecibidosReceptoria != null ? Number(v.litrosRecibidosReceptoria) : (v.totalLitrosReceptoria || 0));
        totalMerma += (v.mermaTotalLitros != null ? v.mermaTotalLitros : (v.diferenciaLitros || 0));

        rowsHtml += `
            <tr style="border-bottom: 1px solid #ddd; ${idx % 2 === 0 ? 'background: #fdfdfd;' : 'background: #f8fafc;'}">
                <td style="padding: 6px 8px; font-weight: bold; text-align: center;">#${v.id}</td>
                <td style="padding: 6px 8px;">${(v.fecha || '').split('T')[0]}</td>
                <td style="padding: 6px 8px; text-align: center;">S${v.cicloId || '-'}</td>
                <td style="padding: 6px 8px;">${v.nombreConductor || '-'}</td>
                <td style="padding: 6px 8px; text-align: center;">${v.totalFincas || 0}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: bold;">${(v.totalLitrosFinca || 0).toLocaleString('es-VE')} L</td>
                <td style="padding: 6px 8px;">${v.nombreCompaniaDestino || v.tipoDestino || '-'}</td>
                <td style="padding: 6px 8px; text-align: right;">${(v.litrosRecibidosReceptoria || v.totalLitrosReceptoria || 0).toLocaleString('es-VE')} L</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: ${(v.diferenciaLitros || 0) > 0 ? '#b91c1c' : '#15803d'};">
                    ${(v.diferenciaLitros || 0) > 0 ? '+' : ''}${(v.diferenciaLitros || 0).toLocaleString('es-VE')} L
                </td>
                <td style="padding: 6px 8px; text-align: center;">${(v.porcentajeMerma || 0).toFixed(2)}%</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${v.estado || 'FINALIZADO'}</td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Bitácora de Control Logístico de Viajes y Tickets</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1e293b; font-size: 11px; }
                .header { border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
                .title { font-size: 18px; font-weight: bold; color: #1e1b4b; margin: 0; }
                .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
                th { background: #1e293b; color: #ffffff; padding: 8px 6px; text-align: left; font-size: 10.5px; text-transform: uppercase; }
                td { padding: 6px 6px; }
                .footer-totales { background: #e2e8f0; font-weight: bold; border-top: 2px solid #334155; }
                @media print {
                    @page { size: landscape; margin: 12mm; }
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="title">RUTAS DE LECHE &mdash; BITÁCORA GENERAL DE VIAJES Y TICKETS</h1>
                    <div class="subtitle">Período: ${fDesde || 'Inicio'} al ${fHasta || 'Actualidad'} &bull; Total Registros: ${list.length} viajes</div>
                </div>
                <div style="text-align: right; font-size: 10.5px; color: #64748b;">
                    Fecha de Impresión: ${new Date().toLocaleString('es-VE')}<br>
                    Sistema de Transporte V2
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="text-align: center; width: 55px;">TICKET</th>
                        <th style="width: 75px;">FECHA</th>
                        <th style="text-align: center; width: 50px;">SEM.</th>
                        <th>CONDUCTOR</th>
                        <th style="text-align: center; width: 50px;">FINCAS</th>
                        <th style="text-align: right; width: 85px;">LTS FINCA</th>
                        <th style="width: 110px;">DESTINO</th>
                        <th style="text-align: right; width: 85px;">LTS REC.</th>
                        <th style="text-align: right; width: 75px;">MERMA</th>
                        <th style="text-align: center; width: 65px;">% MERMA</th>
                        <th style="text-align: center; width: 75px;">ESTADO</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr class="footer-totales">
                        <td colspan="5" style="text-align: right; padding: 8px;">TOTALES GENERALES (${list.length} VIAJES):</td>
                        <td style="text-align: right; padding: 8px;">${totalLtsFinca.toLocaleString('es-VE')} L</td>
                        <td></td>
                        <td style="text-align: right; padding: 8px;">${totalLtsRec.toLocaleString('es-VE')} L</td>
                        <td style="text-align: right; padding: 8px; color: ${totalMerma > 0 ? '#b91c1c' : '#15803d'};">
                            ${totalMerma > 0 ? '+' : ''}${totalMerma.toLocaleString('es-VE')} L
                        </td>
                        <td style="text-align: center; padding: 8px;">
                            ${totalLtsFinca > 0 ? ((Math.abs(totalMerma) / totalLtsFinca) * 100).toFixed(2) : '0.00'}%
                        </td>
                        <td style="text-align: center; padding: 8px;">Auditado</td>
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top: 35px; display: flex; justify-content: space-around; text-align: center;">
                <div style="border-top: 1px solid #333; width: 200px; padding-top: 5px;">Firma Auditor / Receptoría</div>
                <div style="border-top: 1px solid #333; width: 200px; padding-top: 5px;">Firma Gerencia de Operaciones</div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
window.imprimirBitacoraTickets = imprimirBitacoraTickets;

// Imprimir Comprobante de Viaje Individual (Soporta Rutas y Salidas de Planta)
async function imprimirTicketViajeIndividual(origenOrId, optTicketId) {
    let origen = 'RUTA';
    let ticketId = origenOrId;
    if (optTicketId !== undefined) {
        origen = origenOrId;
        ticketId = optTicketId;
    }

    try {
        if (origen === 'RECEPTORIA' || origen === 'COMPANIA' || origen === 'SUB_DESPACHO') {
            const resDesp = await fetch(`${API_BASE}/control-companias/${ticketId}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (!resDesp.ok) throw new Error('No se pudo cargar el despacho de planta');
            const desp = await resDesp.json();

            const ltsDesp = Number(desp.litrosDespachados || 0);
            const ltsRec = Number(desp.litrosRecibidosCompania || ltsDesp);
            const dif = Number(desp.diferenciaLitros != null ? desp.diferenciaLitros : (ltsDesp - ltsRec));
            const pct = desp.porcentajeMerma != null ? Number(desp.porcentajeMerma).toFixed(2) : (ltsDesp > 0 ? ((Math.abs(dif)/ltsDesp)*100).toFixed(2) : '0.00');

            const printWin = window.open('', '_blank', 'width=800,height=750');
            printWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Despacho de Planta #${desp.id}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 25px; color: #1e293b; font-size: 12px; }
                        .ticket-box { border: 2px solid #7e22ce; border-radius: 8px; padding: 20px; max-width: 650px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px dashed #d8b4fe; padding-bottom: 14px; margin-bottom: 14px; }
                        .title { font-size: 20px; font-weight: bold; color: #581c87; margin: 0; }
                        .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; font-size: 12px; }
                        .metric-box { display: flex; justify-content: space-between; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 12px 16px; margin-top: 14px; }
                    </style>
                </head>
                <body>
                    <div class="ticket-box">
                        <div class="header">
                            <h2 class="title">COMPROBANTE DE DESPACHO DE PLANTA</h2>
                            <div style="font-size: 14px; font-weight: bold; color: #7e22ce; margin-top: 4px;">DESPACHO A EMPRESA #${desp.id}</div>
                            <div style="color: #64748b; font-size: 11px;">Salida desde Receptoría &bull; Sistema Transporte V2</div>
                        </div>

                        <div class="grid-info">
                            <div><strong>Fecha de Salida:</strong> ${(desp.fechaDespacho || desp.fecha || '').split('T')[0]}</div>
                            <div><strong>Semana:</strong> Semana #${desp.cicloId || '-'}</div>
                            <div><strong>Conductor / Cisterna:</strong> ${desp.nombreConductor || '-'}</div>
                            <div><strong>Empresa Receptora:</strong> ${desp.nombreCompaniaDestino || 'Quesera'}</div>
                            <div><strong>Origen:</strong> Tanque Receptoría Principal (0 fincas)</div>
                            <div><strong>Estado:</strong> ${desp.estado || 'FINALIZADO'}</div>
                        </div>

                        <div class="metric-box">
                            <div>
                                <div style="font-size: 11px; color: #64748b;">LITROS DESPACHADOS</div>
                                <div style="font-size: 16px; font-weight: bold; color: #7e22ce;">${ltsDesp.toLocaleString('es-VE')} L</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #64748b;">LITROS RECIBIDOS</div>
                                <div style="font-size: 16px; font-weight: bold; color: #0284c7;">${ltsRec.toLocaleString('es-VE')} L</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #64748b;">DIFERENCIA / MERMA</div>
                                <div style="font-size: 16px; font-weight: bold; color: ${dif > 0 ? '#dc2626' : '#15803d'};">
                                    ${dif > 0 ? `-${dif.toLocaleString('es-VE')}` : `+${Math.abs(dif).toLocaleString('es-VE')}`} L (${pct}%)
                                </div>
                            </div>
                        </div>

                        ${desp.observacion ? `<div style="margin-top: 14px; font-size: 11.5px; color: #64748b;"><strong>Observaciones:</strong> ${desp.observacion}</div>` : ''}

                        <div style="margin-top: 45px; display: flex; justify-content: space-between; text-align: center; font-size: 11px;">
                            <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Firma Despachador Planta</div>
                            <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Firma Receptor Empresa</div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); };
                    </script>
                </body>
                </html>
            `);
            printWin.document.close();
            return;
        }

        // Caso RUTA
        const [resTicket, resFincas] = await Promise.all([
            fetch(`${API_BASE}/control-rutas/${ticketId}`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, { headers: { 'Authorization': `Bearer ${state.token}` } })
        ]);

        if (!resTicket.ok) throw new Error('No se pudo cargar el ticket');
        const ticket = await resTicket.json();
        const fincas = resFincas.ok ? await resFincas.json() : [];

        let fincasRows = '';
        fincas.forEach((f, i) => {
            fincasRows += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 4px 6px;">#${i + 1}</td>
                    <td style="padding: 4px 6px; font-weight: 600;">${f.fincaNombre}</td>
                    <td style="padding: 4px 6px; color: #64748b;">${f.propietario || '-'}</td>
                    <td style="padding: 4px 6px; text-align: right; font-weight: bold;">${(f.litros || 0).toLocaleString('es-VE')} L</td>
                    <td style="padding: 4px 6px; text-align: center;">${f.esAcida ? 'ÁCIDA' : 'DULCE'}</td>
                </tr>
            `;
        });

        const printWin = window.open('', '_blank', 'width=800,height=750');
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Comprobante de Viaje #${ticket.id}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 25px; color: #1e293b; font-size: 12px; }
                    .ticket-box { border: 2px solid #334155; border-radius: 8px; padding: 20px; max-width: 650px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 14px; margin-bottom: 14px; }
                    .title { font-size: 20px; font-weight: bold; color: #1e1b4b; margin: 0; }
                    .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
                    th { background: #f1f5f9; padding: 6px; text-align: left; border-bottom: 1px solid #cbd5e1; }
                    .metric-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-top: 12px; }
                </style>
            </head>
            <body>
                <div class="ticket-box">
                    <div class="header">
                        <h2 class="title">COMPROBANTE DE RECOLECCIÓN Y DESPACHO</h2>
                        <div style="font-size: 14px; font-weight: bold; color: #4338ca; margin-top: 4px;">TICKET DE VIAJE #${ticket.id}</div>
                        <div style="color: #64748b; font-size: 11px;">Rutas de Leche &bull; Sistema Transporte V2</div>
                    </div>

                    <div class="grid-info">
                        <div><strong>Fecha:</strong> ${(ticket.fecha || '').split('T')[0]}</div>
                        <div><strong>Semana Operativa:</strong> Semana #${ticket.cicloId || '-'}</div>
                        <div><strong>Conductor:</strong> ${ticket.nombreConductor || '-'}</div>
                        <div><strong>Destino:</strong> ${ticket.nombreCompaniaDestino || ticket.tipoDestino || 'Receptoría'}</div>
                        <div><strong>Total Fincas:</strong> ${fincas.length} atendidas</div>
                        <div><strong>Estado:</strong> ${ticket.estado || 'FINALIZADO'}</div>
                    </div>

                    <h4 style="margin: 12px 0 6px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Desglose de Fincas Recolectadas</h4>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 25px;">#</th>
                                <th>Finca</th>
                                <th>Propietario</th>
                                <th style="text-align: right; width: 85px;">Litros</th>
                                <th style="text-align: center; width: 60px;">Calidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fincasRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Sin fincas</td></tr>'}
                        </tbody>
                    </table>

                    <div class="metric-box">
                        <div>
                            <div style="font-size: 11px; color: #64748b;">TOTAL RECOLECTADO</div>
                            <div style="font-size: 16px; font-weight: bold; color: #0284c7;">${(ticket.totalLitrosFinca || 0).toLocaleString('es-VE')} L</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b;">RECIBIDO EN DESTINO</div>
                            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${(ticket.litrosRecibidosReceptoria || ticket.totalLitrosReceptoria || 0).toLocaleString('es-VE')} L</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b;">MERMA VOLUMÉTRICA</div>
                            <div style="font-size: 16px; font-weight: bold; color: ${(ticket.mermaTotalLitros || ticket.diferenciaLitros || 0) <= 0 ? '#15803d' : '#b91c1c'};">
                                ${(ticket.mermaTotalLitros != null ? ticket.mermaTotalLitros : (ticket.diferenciaLitros || 0)).toLocaleString('es-VE')} L (${(ticket.porcentajeMerma || 0).toFixed(2)}%)
                            </div>
                        </div>
                    </div>

                    ${ticket.observacion ? `<div style="margin-top: 10px; font-size: 11px; color: #64748b;"><strong>Nota:</strong> ${ticket.observacion}</div>` : ''}

                    <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 11px;">
                        <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Firma Conductor</div>
                        <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Firma Receptor / Auditor</div>
                    </div>
                </div>
                <script>
                    window.onload = function() { window.print(); };
                </script>
            </body>
            </html>
        `);
        printWin.document.close();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.imprimirTicketViajeIndividual = imprimirTicketViajeIndividual;

function abrirModalCrearViajeDirecto() {
    abrirModalIniciarViaje();
}
window.abrirModalCrearViajeDirecto = abrirModalCrearViajeDirecto;

// 8. VER TRAZABILIDAD Y AUDITORÍA DE VIAJE
window.currentTrazabilidadData = {
    ticket: null,
    fincas: [],
    entregas: [],
    historial: [],
    logs: []
};

function sanitizarTexto(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Á')
        .replace(/Ã‰/g, 'É')
        .replace(/Ã/g, 'Í')
        .replace(/Ã“/g, 'Ó')
        .replace(/Ãš/g, 'Ú')
        .replace(/Ã‘/g, 'Ñ')
        .replace(/Ã/g, 'í');
}
window.sanitizarTexto = sanitizarTexto;

function cambiarTabTrazabilidad(tabName) {
    const tabs = ['fincas', 'despacho', 'entregas', 'timeline', 'logs'];
    tabs.forEach(t => {
        const content = document.getElementById(`tabContentTrazabilidad${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const btn = document.getElementById(`tabBtnTrazabilidad${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (content) {
            content.style.display = (t === tabName) ? 'block' : 'none';
        }
        if (btn) {
            const badge = btn.querySelector('span');
            if (t === tabName) {
                btn.style.background = '#ffffff';
                btn.style.color = '#0284c7';
                btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                btn.style.fontWeight = '800';
                btn.classList.add('active');
                if (badge) {
                    badge.style.background = '#e0f2fe';
                    badge.style.color = '#0284c7';
                }
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#64748b';
                btn.style.boxShadow = 'none';
                btn.style.fontWeight = '700';
                btn.classList.remove('active');
                if (badge) {
                    badge.style.background = '#e2e8f0';
                    badge.style.color = '#475569';
                }
            }
        }
    });
}
window.cambiarTabTrazabilidad = cambiarTabTrazabilidad;

async function verTrazabilidadViaje(tipoOrId, maybeId) {
    let tipo = 'RUTA';
    let ticketId = tipoOrId;
    if (typeof tipoOrId === 'string' && (tipoOrId.toUpperCase() === 'RECEPTORIA' || tipoOrId.toUpperCase() === 'SUB_DESPACHO' || tipoOrId.toUpperCase() === 'COMPANIA' || tipoOrId.toUpperCase() === 'RUTA')) {
        tipo = tipoOrId.toUpperCase();
        ticketId = maybeId;
    } else if (typeof maybeId === 'string' && (maybeId.toUpperCase() === 'RECEPTORIA' || maybeId.toUpperCase() === 'SUB_DESPACHO' || maybeId.toUpperCase() === 'COMPANIA' || maybeId.toUpperCase() === 'RUTA')) {
        tipo = maybeId.toUpperCase();
    }

    const esReceptoria = (tipo === 'RECEPTORIA' || tipo === 'SUB_DESPACHO' || tipo === 'COMPANIA');
    const esAdmin = state.user && (state.user.rol === 'ADMIN' || state.user.rol === 'SUPERADMIN');

    // Elementos visuales del modal
    const iconBadge = document.getElementById('modalTrazabilidadIconBadge');
    const iconEl = document.getElementById('modalTrazabilidadIcon');
    const badgeTipo = document.getElementById('badgeTipoTrazabilidad');
    const tabFincas = document.getElementById('tabBtnTrazabilidadFincas');
    const tabDespacho = document.getElementById('tabBtnTrazabilidadDespacho');
    const tabEntregas = document.getElementById('tabBtnTrazabilidadEntregas');
    const resumenMetricas = document.getElementById('resumenMetricasViajeModal');

    if (esReceptoria) {
        if (iconBadge) {
            iconBadge.style.background = 'rgba(147, 51, 234, 0.18)';
            iconBadge.style.color = '#c084fc';
            iconBadge.style.borderColor = 'rgba(147, 51, 234, 0.4)';
        }
        if (iconEl) iconEl.className = 'fa-solid fa-file-invoice';
        if (badgeTipo) {
            badgeTipo.textContent = 'SALIDA RECEPTORÍA';
            badgeTipo.style.background = 'rgba(168, 85, 247, 0.18)';
            badgeTipo.style.color = '#c084fc';
            badgeTipo.style.border = '1px solid rgba(168, 85, 247, 0.35)';
        }
        if (tabFincas) tabFincas.style.display = 'none';
        if (tabDespacho) tabDespacho.style.display = 'inline-flex';
        cambiarTabTrazabilidad('despacho');
    } else {
        if (iconBadge) {
            iconBadge.style.background = 'rgba(56, 189, 248, 0.18)';
            iconBadge.style.color = '#38bdf8';
            iconBadge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        }
        if (iconEl) iconEl.className = 'fa-solid fa-route';
        if (badgeTipo) {
            badgeTipo.textContent = 'RUTA DE RECOLECCIÓN';
            badgeTipo.style.background = 'rgba(56, 189, 248, 0.18)';
            badgeTipo.style.color = '#38bdf8';
            badgeTipo.style.border = '1px solid rgba(56, 189, 248, 0.35)';
        }
        if (tabFincas) tabFincas.style.display = 'inline-flex';
        if (tabDespacho) tabDespacho.style.display = 'none';
        cambiarTabTrazabilidad('fincas');
    }

    try {
        if (esReceptoria) {
            // Cargar Despacho de Receptoría (TB_CONTROL_COMPANIAS)
            const resDespacho = await fetch(`${API_BASE}/control-companias/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (!resDespacho.ok) throw new Error('No se pudo localizar el despacho de receptoría seleccionado');

            const despacho = await resDespacho.json();
            window.currentTrazabilidadData = { ticket: despacho, fincas: [], entregas: [], historial: [], logs: [], _tipo: 'RECEPTORIA' };

            const fechaStr = (despacho.fecha || '').split('T')[0] || '-';
            const choferNom = despacho.nombreConductor || despacho.nombreUsuario || 'Chofer Asignado';
            const compNom = despacho.nombreCompania || 'Planta / Quesera';
            const despachados = Number(despacho.litrosDespachados || 0);
            const recibidos = despacho.litrosRecibidosCompania != null ? Number(despacho.litrosRecibidosCompania) : null;
            const falla = despacho.diferenciaLitros != null ? Number(despacho.diferenciaLitros) : (recibidos != null ? despachados - recibidos : 0);
            const estado = (despacho.estado || 'EN VIA').toUpperCase();

            document.getElementById('lblTituloTrazabilidad').innerText = `Salida de Receptoría #${despacho.id}`;
            document.getElementById('lblSubtituloTrazabilidad').innerHTML = `<i class="fa-solid fa-building-wheat" style="color: #c084fc;"></i> Destino: <strong style="color: #ffffff;">${compNom}</strong> &nbsp;|&nbsp; <i class="fa-solid fa-user-tie" style="color: #38bdf8;"></i> Conductor: <strong style="color: #ffffff;">${choferNom}</strong> &nbsp;|&nbsp; <i class="fa-solid fa-calendar-day"></i> Fecha: <strong>${fechaStr}</strong>`;

            if (resumenMetricas) {
                resumenMetricas.innerHTML = `
                    <div style="background: #ffffff; border: 1.5px solid #e9d5ff; border-radius: 14px; padding: 14px 12px; text-align: center; box-shadow: 0 4px 12px rgba(147, 51, 234, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #9333ea, #c084fc);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #faf5ff; color: #9333ea; font-size: 10px;"><i class="fa-solid fa-warehouse"></i></span>
                            LTS SALIDA RECEPTORÍA
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">${despachados.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span></div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #bbf7d0; border-radius: 14px; padding: 14px 12px; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #059669, #34d399);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #ecfdf5; color: #059669; font-size: 10px;"><i class="fa-solid fa-building-circle-check"></i></span>
                            LTS RECIBIDOS PLANTA
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">${recibidos != null ? `${recibidos.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span>` : '<span style="color: #d97706; font-size: 15px;">En Tránsito</span>'}</div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid ${falla > 0 ? '#fecaca' : '#a7f3d0'}; border-radius: 14px; padding: 14px 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: ${falla > 0 ? '#ef4444' : '#10b981'};"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: ${falla > 0 ? '#dc2626' : '#059669'}; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: ${falla > 0 ? '#fef2f2' : '#ecfdf5'}; color: ${falla > 0 ? '#dc2626' : '#059669'}; font-size: 10px;"><i class="fa-solid ${falla > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'}"></i></span>
                            DIFERENCIA / MERMA
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: ${falla > 0 ? '#b91c1c' : '#047857'}; letter-spacing: -0.02em;">${falla > 0 ? `-${falla.toLocaleString('es-VE')} L` : (falla < 0 ? `+${Math.abs(falla).toLocaleString('es-VE')} L` : '0 L')}</div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #bae6fd; border-radius: 14px; padding: 14px 12px; text-align: center; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #0284c7, #38bdf8);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #f0f9ff; color: #0284c7; font-size: 10px;"><i class="fa-solid fa-flag-checkered"></i></span>
                            ESTADO ACTUAL
                        </div>
                        <div style="font-size: 17px; font-weight: 900; color: #0284c7; letter-spacing: -0.01em;">${estado}</div>
                    </div>
                `;
            }

            // Tab Contenido Despacho
            const contDespacho = document.getElementById('contenedorDetalleDespachoCard');
            if (contDespacho) {
                contDespacho.innerHTML = `
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.02);">
                        <h4 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 800; color: #7e22ce; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-truck-ramp-box"></i> Datos del Despacho y Envío
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Origen:</span>
                                <strong style="color: #0f172a;"><i class="fa-solid fa-warehouse" style="color: #9333ea;"></i> Receptoría Principal (Silos)</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Quesera / Planta Destino:</span>
                                <strong style="color: #0f172a;"><i class="fa-solid fa-building-wheat" style="color: #0284c7;"></i> ${compNom}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Conductor Asignado:</span>
                                <strong style="color: #0f172a;"><i class="fa-solid fa-user-tie" style="color: #10b981;"></i> ${choferNom}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Fecha de Salida:</span>
                                <strong style="color: #0f172a;">${formatearFechaTicket(despacho.fecha)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                                <span style="color: #64748b; font-weight: 600;">Observaciones:</span>
                                <span style="color: #475569; font-style: italic;">${sanitizarTexto(despacho.observacion || 'Sin observaciones registradas')}</span>
                            </div>
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.02);">
                        <h4 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-scale-balanced"></i> Balance y Recepción en Destino
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Litros Despachados:</span>
                                <strong style="color: #9333ea; font-size: 15px;">${despachados.toLocaleString('es-VE')} Lts</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Litros Recibidos en Planta:</span>
                                <strong style="color: #10b981; font-size: 15px;">${recibidos != null ? `${recibidos.toLocaleString('es-VE')} Lts` : '<span style="color: #d97706; font-size: 13px;">Pendiente de Validación</span>'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 7px;">
                                <span style="color: #64748b; font-weight: 600;">Falla / Merma:</span>
                                <strong style="color: ${falla > 0 ? '#dc2626' : '#16a34a'}; font-size: 15px;">${falla > 0 ? `-${falla.toLocaleString('es-VE')} Lts` : '0 Lts'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                                <span style="color: #64748b; font-weight: 600;">Movimiento en Balance:</span>
                                <span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-weight: 800; border-radius: 6px; font-size: 11px; padding: 3px 8px;">Receptoría -${despachados.toLocaleString('es-VE')} L | Planta +${despachados.toLocaleString('es-VE')} L</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Tab Timeline para Despacho
            const track = document.getElementById('timelineTrazabilidadContent');
            if (track) {
                const salidaDate = despacho.fechaSalida ? new Date(despacho.fechaSalida).toLocaleString('es-VE') : fechaStr;
                const entregaDate = despacho.fechaEntrega ? new Date(despacho.fechaEntrega).toLocaleString('es-VE') : 'Pendiente';
                track.innerHTML = `
                    <div class="timeline-item">
                        <div class="timeline-marker" style="background: #9333ea;"><i class="fa-solid fa-file-export"></i></div>
                        <div class="timeline-content" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                            <div class="timeline-title">
                                <span style="color: #9333ea; font-weight: 800;">1. Despacho Creado en Receptoría</span>
                                <span style="font-size: 11px; color: #64748b; font-weight: 600;">${salidaDate}</span>
                            </div>
                            <div class="timeline-meta" style="margin-top: 6px; color: #475569; font-size: 12.5px;">Salida de <strong>${despachados.toLocaleString('es-VE')} Lts</strong> hacia <strong>${compNom}</strong>. Conductor: <strong>${choferNom}</strong></div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-marker" style="background: ${recibidos != null ? '#10b981' : '#f59e0b'};"><i class="fa-solid fa-truck-fast"></i></div>
                        <div class="timeline-content" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                            <div class="timeline-title">
                                <span style="color: ${recibidos != null ? '#10b981' : '#d97706'}; font-weight: 800;">2. ${recibidos != null ? 'Entrega Validada y Finalizada' : 'En Tránsito hacia Compañía'}</span>
                                <span style="font-size: 11px; color: #64748b; font-weight: 600;">${entregaDate}</span>
                            </div>
                            <div class="timeline-meta" style="margin-top: 6px; color: #475569; font-size: 12.5px;">${recibidos != null ? `Confirmada recepción de <strong>${recibidos.toLocaleString('es-VE')} Lts</strong> en ${compNom}. Merma / Falla: <strong>${falla} Lts</strong>.` : 'El camión se encuentra en ruta hacia la compañía de destino.'}</div>
                        </div>
                    </div>
                `;
            }

            // Tab Entregas / Movimientos para Despacho
            const tbodyEntregas = document.getElementById('tbodyEntregasViajeModal');
            if (tbodyEntregas) {
                tbodyEntregas.innerHTML = `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: #faf5ff; border-left: 3.5px solid #9333ea;">
                        <td style="padding: 12px 14px; vertical-align: middle;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <span class="badge" style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 5px; width: fit-content;"><i class="fa-solid fa-building-wheat"></i> Planta / Quesera</span>
                                <strong style="color: #0f172a; font-size: 13.5px; font-weight: 800;">${compNom}</strong>
                            </div>
                        </td>
                        <td style="padding: 12px 14px; vertical-align: middle; color: #475569; font-weight: 600; font-size: 12.5px;"><i class="fa-solid fa-user-circle" style="color: #94a3b8; margin-right: 4px;"></i>${choferNom}</td>
                        <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                            <span style="font-weight: 900; color: #10b981; font-size: 15px;">+${despachados.toLocaleString('es-VE')}</span>
                            <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                        </td>
                        <td style="padding: 12px 14px; vertical-align: middle; color: #334155; font-size: 12.5px;">Entrada y descarga en planta</td>
                        <td style="padding: 12px 14px; vertical-align: middle; text-align: center;"><span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 800; border-radius: 6px; padding: 3px 8px; font-size: 10.5px;">Ingreso</span></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9; background: #fff7ed; border-left: 3.5px solid #ea580c;">
                        <td style="padding: 12px 14px; vertical-align: middle;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <span class="badge" style="background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 5px; width: fit-content;"><i class="fa-solid fa-warehouse"></i> Silos Receptoría</span>
                                <strong style="color: #0f172a; font-size: 13.5px; font-weight: 800;">Receptoría Principal</strong>
                            </div>
                        </td>
                        <td style="padding: 12px 14px; vertical-align: middle; color: #475569; font-weight: 600; font-size: 12.5px;"><i class="fa-solid fa-user-circle" style="color: #94a3b8; margin-right: 4px;"></i>${choferNom}</td>
                        <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                            <span style="font-weight: 900; color: #dc2626; font-size: 15px;">-${despachados.toLocaleString('es-VE')}</span>
                            <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                        </td>
                        <td style="padding: 12px 14px; vertical-align: middle; color: #334155; font-size: 12.5px;">Salida descontada de tanque de acopio</td>
                        <td style="padding: 12px 14px; vertical-align: middle; text-align: center;"><span class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 800; border-radius: 6px; padding: 3px 8px; font-size: 10.5px;">Salida</span></td>
                    </tr>
                `;
            }

            const btnAdmin = document.getElementById('btnAccionFinalizarAdminModal');
            if (btnAdmin) btnAdmin.innerHTML = '';

        } else {
            // Cargar Ticket de Ruta (TB_CONTROL_RUTAS)
            const [resTicket, resHistorial, resFincas, resEntregas, resLogs] = await Promise.all([
                fetch(`${API_BASE}/control-rutas/${ticketId}`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
                fetch(`${API_BASE}/control-rutas/${ticketId}/historial`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
                fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
                fetch(`${API_BASE}/control-rutas/${ticketId}/entregas`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
                fetch(`${API_BASE}/control-rutas/${ticketId}/logs-modificaciones`, { headers: { 'Authorization': `Bearer ${state.token}` } })
            ]);

            if (!resTicket.ok) throw new Error('No se pudo cargar el ticket de ruta');

            const ticket = await resTicket.json();
            const historial = resHistorial.ok ? await resHistorial.json() : [];
            const fincas = resFincas.ok ? await resFincas.json() : [];
            const entregas = resEntregas.ok ? await resEntregas.json() : [];
            const logs = resLogs.ok ? await resLogs.json() : [];

            window.currentTrazabilidadData = { ticket, fincas, entregas, historial, logs, _tipo: 'RUTA' };

            document.getElementById('lblTituloTrazabilidad').innerText = `Trazabilidad del Viaje #${ticket.id}`;
            document.getElementById('lblSubtituloTrazabilidad').innerHTML = `<i class="fa-solid fa-user-tie" style="color: #38bdf8;"></i> Chofer: <strong style="color: #ffffff;">${ticket.nombreConductor || 'Conductor'}</strong> &nbsp;|&nbsp; <i class="fa-solid fa-calendar-day"></i> Fecha: <strong>${(ticket.fecha || '').split('T')[0]}</strong>`;

            // Badges en pestañas
            const bFincas = document.getElementById('lblBadgeTotalFincasModal');
            if (bFincas) bFincas.innerText = fincas.length;
            const bEntregas = document.getElementById('lblBadgeTotalEntregasModal');
            if (bEntregas) bEntregas.innerText = entregas.length;
            const bLogs = document.getElementById('lblBadgeTotalLogsModal');
            if (bLogs) bLogs.innerText = logs.length;

            // Métricas en cabecera de modal (5 KPI CARDS MODERNAS)
            if (resumenMetricas) {
                const totalFinca = ticket.totalLitrosFinca != null ? Number(ticket.totalLitrosFinca) : 0;
                const totalRecep = ticket.litrosRecibidosReceptoria != null ? Number(ticket.litrosRecibidosReceptoria) : null;
                const recargaExtra = ticket.litrosCargadosAdicional != null ? Number(ticket.litrosCargadosAdicional) : 0;
                const totalSaliendo = (totalRecep != null ? totalRecep : totalFinca) + recargaExtra;

                // Suma real de entregas desglosadas en plantas / receptorías
                const sumaEntregasPlantas = entregas && entregas.length > 0
                    ? entregas.reduce((acc, e) => acc + Number(e.litros || e.Litros || 0), 0)
                    : null;
                const totalPlanta = sumaEntregasPlantas != null ? sumaEntregasPlantas : (ticket.litrosEntregadosCompania != null ? Number(ticket.litrosEntregadosCompania) : null);

                const yaFinalizo = ticket.estado === 'FINALIZADO' || totalPlanta != null || (totalRecep != null && recargaExtra === 0 && (ticket.tipoDestino || '').toUpperCase().includes('RECEPTORIA'));

                let quintoCardHtml = '';
                if (yaFinalizo && totalPlanta != null) {
                    // Merma real = Salida de Acopio / Camión - Entregado en Destino
                    const mermaReal = totalSaliendo - totalPlanta;
                    const mermaEsCero = Math.abs(mermaReal) < 0.01;
                    const mermaEsPerdida = mermaReal > 0;
                    const colorBg = mermaEsCero ? '#ecfdf5' : (mermaEsPerdida ? '#fef2f2' : '#f0f9ff');
                    const colorBorder = mermaEsCero ? '#a7f3d0' : (mermaEsPerdida ? '#fecaca' : '#bae6fd');
                    const colorGrad = mermaEsCero ? '#10b981' : (mermaEsPerdida ? '#ef4444' : '#0284c7');
                    const colorText = mermaEsCero ? '#059669' : (mermaEsPerdida ? '#dc2626' : '#0284c7');
                    const colorVal = mermaEsCero ? '#047857' : (mermaEsPerdida ? '#b91c1c' : '#0369a1');
                    const icono = mermaEsCero ? 'fa-check-circle' : (mermaEsPerdida ? 'fa-triangle-exclamation' : 'fa-circle-plus');
                    const textoMerma = mermaEsCero ? '0 L' : (mermaEsPerdida ? `-${mermaReal.toLocaleString('es-VE')} L` : `+${Math.abs(mermaReal).toLocaleString('es-VE')} L`);

                    quintoCardHtml = `
                        <div style="background: #ffffff; border: 1.5px solid ${colorBorder}; border-radius: 14px; padding: 14px 10px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: ${colorGrad};"></div>
                            <div style="font-size: 10.5px; font-weight: 800; color: ${colorText}; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: ${colorBg}; color: ${colorText}; font-size: 10px;"><i class="fa-solid ${icono}"></i></span>
                                MERMA FINAL
                            </div>
                            <div style="font-size: 20px; font-weight: 900; color: ${colorVal}; letter-spacing: -0.02em;">${textoMerma}</div>
                        </div>
                    `;
                } else {
                    const totalEnCamino = totalSaliendo;
                    quintoCardHtml = `
                        <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 14px; padding: 14px 10px; text-align: center; box-shadow: 0 4px 12px rgba(34,197,94,0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #16a34a, #4ade80);"></div>
                            <div style="font-size: 10.5px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #f0fdf4; color: #16a34a; font-size: 10px;"><i class="fa-solid fa-truck-fast"></i></span>
                                EN CAMINO
                            </div>
                            <div style="font-size: 20px; font-weight: 900; color: #166534; letter-spacing: -0.02em;">${totalEnCamino.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span></div>
                        </div>
                    `;
                }

                resumenMetricas.innerHTML = `
                    <div style="background: #ffffff; border: 1.5px solid #bae6fd; border-radius: 14px; padding: 14px 10px; text-align: center; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #0284c7, #38bdf8);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #f0f9ff; color: #0284c7; font-size: 10px;"><i class="fa-solid fa-cow"></i></span>
                            LTS FINCAS
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">${totalFinca.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span></div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #fde68a; border-radius: 14px; padding: 14px 10px; text-align: center; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #d97706, #fbbf24);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #fffbeb; color: #d97706; font-size: 10px;"><i class="fa-solid fa-warehouse"></i></span>
                            LTS RECEPTORÍA
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">${totalRecep != null ? `${totalRecep.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span>` : '-'}</div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #fef08a; border-radius: 14px; padding: 14px 10px; text-align: center; box-shadow: 0 4px 12px rgba(202, 138, 4, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #ca8a04, #facc15);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #ca8a04; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #fefce8; color: #ca8a04; font-size: 10px;"><i class="fa-solid fa-gas-pump"></i></span>
                            RECARGA EXTRA
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">${recargaExtra ? `+${recargaExtra.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span>` : '0 L'}</div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #e9d5ff; border-radius: 14px; padding: 14px 10px; text-align: center; box-shadow: 0 4px 12px rgba(126, 34, 206, 0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: linear-gradient(90deg, #7e22ce, #c084fc);"></div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 5px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: #faf5ff; color: #7e22ce; font-size: 10px;"><i class="fa-solid fa-industry"></i></span>
                            LTS PLANTA
                        </div>
                        <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">${totalPlanta != null ? `${totalPlanta.toLocaleString('es-VE')} <span style="font-size: 11px; font-weight: 700; color: #64748b;">L</span>` : '-'}</div>
                    </div>
                    ${quintoCardHtml}
                `;
            }

            // 1. Tab Fincas recolectadas
            const contBtnAddFinca = document.getElementById('btnAgregarFincaControlContainer');
            if (contBtnAddFinca) {
                if (esAdmin) {
                    contBtnAddFinca.innerHTML = `
                        <button type="button" class="btn btn-sm" onclick="abrirModalAgregarFincaControl(${ticket.id})" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; border: none; font-weight: 700; border-radius: 8px; padding: 7px 16px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25); cursor: pointer;">
                            <i class="fa-solid fa-plus"></i> Agregar Finca
                        </button>
                    `;
                } else {
                    contBtnAddFinca.innerHTML = '';
                }
            }
            const tbodyFincas = document.getElementById('tbodyFincasViajeModal');
            if (tbodyFincas) {
                if (!fincas.length) {
                    tbodyFincas.innerHTML = '<tr><td colspan="5" class="text-center" style="color: #64748b; padding: 24px; font-size: 13px;">No hay fincas registradas para este viaje.</td></tr>';
                } else {
                    let fHtml = '';
                    fincas.forEach(f => {
                        const fObj = (state.fincas || []).find(item => Number(item.id || item.Id) === Number(f.fincaId || f.FincaId));
                        const esDualF = Boolean(f.tieneDosTiposLeche || f.TieneDosTiposLeche || fObj?.tieneDosTiposLeche || fObj?.TieneDosTiposLeche);
                        let tipoBadge = '';
                        if (esDualF) {
                            const esBuf = (f.tipoLeche === 'BUFALA' || f.TipoLeche === 'BUFALA');
                            tipoBadge = esBuf
                                ? '<span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 10px; padding: 2px 7px; font-weight: 800; border-radius: 5px; margin-left: 6px;">🐃 BÚFALA</span>'
                                : '<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 10px; padding: 2px 7px; font-weight: 800; border-radius: 5px; margin-left: 6px;">🐄 VACA</span>';
                        }
                        fHtml += `
                            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseenter="this.style.background='#f8fafc';" onmouseleave="this.style.background='transparent';">
                                <td style="padding: 12px 14px; vertical-align: middle;">
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <strong style="color: #0f172a; font-size: 13.5px; font-weight: 800;">${sanitizarTexto(f.fincaNombre)}</strong>
                                        ${tipoBadge}
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #64748b; font-size: 12.5px;">${sanitizarTexto(f.propietario || '-')}</td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                                    <span style="font-weight: 900; color: #0284c7; font-size: 14.5px;">${Number(f.litros).toLocaleString('es-VE')}</span>
                                    <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                                    ${f.esAcida 
                                        ? '<span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 10.5px; padding: 3px 8px; font-weight: 800; border-radius: 6px;">ÁCIDA</span>' 
                                        : '<span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 10.5px; padding: 3px 8px; font-weight: 800; border-radius: 6px;">DULCE</span>'}
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                                    ${esAdmin ? `
                                        <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                                            <button type="button" class="btn-icon" style="color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" onclick="abrirModalEditarFincaControl(${f.id || f.Id})" title="Modificar finca (auditado)"><i class="fa-solid fa-pen-to-square"></i></button>
                                            <button type="button" class="btn-icon" style="color: #ef4444; background: #fef2f2; border: 1px solid #fecaca; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" onclick="eliminarFincaControlAuditado(${f.id || f.Id})" title="Eliminar finca de este viaje"><i class="fa-solid fa-trash-can"></i></button>
                                        </div>
                                    ` : '<span style="color: #94a3b8; font-size: 11px;">Solo Admin</span>'}
                                </td>
                            </tr>
                        `;
                    });
                    tbodyFincas.innerHTML = fHtml;
                }
            }

            // 2. Tab Entregas / Receptoría
            const tbodyEntregas = document.getElementById('tbodyEntregasViajeModal');
            if (tbodyEntregas) {
                const totalFincaNum = Number(ticket.totalLitrosFinca || 0);
                const recargaNum = Number(ticket.litrosCargadosAdicional || 0);
                const recepNum = ticket.litrosRecibidosReceptoria != null ? Number(ticket.litrosRecibidosReceptoria) : (recargaNum > 0 ? totalFincaNum : null);
                const plantaNum = ticket.litrosEntregadosCompania != null ? Number(ticket.litrosEntregadosCompania) : null;
                const esPasoReceptoria = (recepNum != null || recargaNum > 0) && (plantaNum != null || (entregas && entregas.length > 0));

                let eHtml = '';

                if (esPasoReceptoria && (!entregas.length || !entregas.some(x => (x.companiaNombre || '').toUpperCase().includes('RECEPTOR')))) {
                    // 1. Entrada a Tanques Receptoría
                    eHtml += `
                        <tr style="background: rgba(240, 249, 255, 0.7); border-left: 3.5px solid #0284c7; border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px 14px; vertical-align: middle;">
                                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                                    <span class="badge" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;">
                                        <i class="fa-solid fa-warehouse"></i> 1. Ingreso a Tanques Receptoría
                                    </span>
                                    <strong style="color: #0369a1; font-size: 13.5px; font-weight: 800;">Receptoría Principal</strong>
                                </div>
                            </td>
                            <td style="padding: 12px 14px; vertical-align: middle; color: #475569; font-size: 12.5px; font-weight: 600;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-truck-ramp-box" style="color: #0284c7; font-size: 13px;"></i>
                                    <span>Recepción de Fincas</span>
                                </div>
                            </td>
                            <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                                <span style="font-weight: 900; color: #0284c7; font-size: 15px;">
                                    +${(recepNum != null ? recepNum : totalFincaNum).toLocaleString('es-VE')}
                                </span>
                                <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                            </td>
                            <td style="padding: 12px 14px; vertical-align: middle; color: #334155; font-size: 12px; line-height: 1.45;">
                                Leche de campo ingresada y recepcionada en tanques de acopio.
                            </td>
                            <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                                <span class="badge" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-weight: 800; font-size: 10.5px; padding: 2px 7px;">Recepcionado</span>
                            </td>
                        </tr>
                    `;

                    // 2. Salida de Tanques (Recarga Adicional)
                    if (recargaNum > 0) {
                        eHtml += `
                            <tr style="background: rgba(255, 247, 237, 0.7); border-left: 3.5px solid #ea580c; border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 12px 14px; vertical-align: middle;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                                        <span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;">
                                            <i class="fa-solid fa-gas-pump"></i> 2. Salida Tanques (Recarga Extra)
                                        </span>
                                        <strong style="color: #c2410c; font-size: 13.5px; font-weight: 800;">Tanques ➔ Camión</strong>
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #475569; font-size: 12.5px; font-weight: 600;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <i class="fa-solid fa-arrow-up-from-bracket" style="color: #ea580c; font-size: 13px;"></i>
                                        <span>Despacho a Camión</span>
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                                    <span style="font-weight: 900; color: #ea580c; font-size: 15px;">
                                        +${recargaNum.toLocaleString('es-VE')}
                                    </span>
                                    <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #334155; font-size: 12px; line-height: 1.45;">
                                    Recarga adicional de leche desde tanques de receptoría para completar despacho a compañía.
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                                    <span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-weight: 800; font-size: 10.5px; padding: 2px 7px;">Despachado</span>
                                </td>
                            </tr>
                        `;
                    }

                    // 3. Entregas en Compañía registradas
                    entregas.forEach(e => {
                        const meta = obtenerTipoRegistroEntrega(e);
                        const numLitros = Number(e.litros || e.Litros || 0);
                        const compNombre = sanitizarTexto(e.companiaNombre || 'Compañía #' + e.companiaId);
                        const encargadoNombre = sanitizarTexto(e.encargado || meta.subLabel || '-');
                        const observacionTexto = sanitizarTexto(e.observacion || '').replace(/ReceptorÃa/g, 'Receptoría');

                        eHtml += `
                            <tr style="background: ${meta.rowBg}; border-left: 3.5px solid ${meta.borderLeft}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;">
                                <td style="padding: 12px 14px; vertical-align: middle;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                                        <span class="badge" style="background: ${meta.badgeBg}; color: ${meta.badgeColor}; border: 1px solid ${meta.badgeBorder}; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;">
                                            <i class="${meta.icono}"></i> 3. Entrega en Planta Validada
                                        </span>
                                        <strong style="color: #0f172a; font-size: 13.5px; font-weight: 800;">${compNombre}</strong>
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #475569; font-size: 12.5px; font-weight: 600;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <i class="fa-solid fa-user-circle" style="color: #94a3b8; font-size: 13px;"></i>
                                        <span>${encargadoNombre}</span>
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                                    <span style="font-weight: 900; color: ${meta.litrosColor}; font-size: 15px;">
                                        +${Math.abs(numLitros).toLocaleString('es-VE')}
                                    </span>
                                    <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #334155; font-size: 12px; line-height: 1.45; word-break: break-word;">
                                    ${observacionTexto}
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                                    ${esAdmin ? `
                                        <button type="button" class="btn-icon" style="color: #d97706; background: #fffbeb; border: 1px solid #fde68a; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" onclick="abrirModalEditarEntregaControl(${e.id || e.Id})" title="Modificar entrega (auditado)">
                                            <i class="fa-solid fa-pen-to-square"></i>
                                        </button>
                                    ` : '<span style="color: #94a3b8; font-size: 11px;">Solo Admin</span>'}
                                </td>
                            </tr>
                        `;
                    });

                    tbodyEntregas.innerHTML = eHtml;
                    const bEntregas = document.getElementById('lblBadgeTotalEntregasModal');
                    if (bEntregas) bEntregas.innerText = ((esPasoReceptoria ? (1 + (recargaNum > 0 ? 1 : 0)) : 0) + entregas.length);
                } else if (!entregas.length) {
                    tbodyEntregas.innerHTML = '<tr><td colspan="5" class="text-center" style="color: #64748b; padding: 24px; font-size: 13px;">No hay entregas registradas para este viaje.</td></tr>';
                } else {
                    entregas.forEach(e => {
                        const meta = obtenerTipoRegistroEntrega(e);
                        const numLitros = Number(e.litros || e.Litros || 0);
                        const compNombre = sanitizarTexto(e.companiaNombre || 'Compañía #' + e.companiaId);
                        const encargadoNombre = sanitizarTexto(e.encargado || meta.subLabel || '-');
                        const observacionTexto = sanitizarTexto(e.observacion || '-').replace(/ReceptorÃa/g, 'Receptoría');

                        eHtml += `
                            <tr style="background: ${meta.rowBg}; border-left: 3.5px solid ${meta.borderLeft}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;">
                                <td style="padding: 12px 14px; vertical-align: middle;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                                        <span class="badge" style="background: ${meta.badgeBg}; color: ${meta.badgeColor}; border: 1px solid ${meta.badgeBorder}; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;">
                                            <i class="${meta.icono}"></i> ${meta.label}
                                        </span>
                                        <strong style="color: #0f172a; font-size: 13.5px; font-weight: 800;">${compNombre}</strong>
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #475569; font-size: 12.5px; font-weight: 600;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <i class="fa-solid fa-user-circle" style="color: #94a3b8; font-size: 13px;"></i>
                                        <span>${encargadoNombre}</span>
                                    </div>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: right; white-space: nowrap;">
                                    <span style="font-weight: 900; color: ${meta.litrosColor}; font-size: 15px;">
                                        ${numLitros < 0 ? '-' : (numLitros > 0 ? '+' : '')}${Math.abs(numLitros).toLocaleString('es-VE')}
                                    </span>
                                    <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 2px;">Lts</span>
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; color: #334155; font-size: 12px; line-height: 1.45; word-break: break-word;">
                                    ${observacionTexto}
                                </td>
                                <td style="padding: 12px 14px; vertical-align: middle; text-align: center;">
                                    ${esAdmin ? `
                                        <button type="button" class="btn-icon" style="color: #d97706; background: #fffbeb; border: 1px solid #fde68a; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" onclick="abrirModalEditarEntregaControl(${e.id || e.Id})" title="Modificar entrega (auditado)">
                                            <i class="fa-solid fa-pen-to-square"></i>
                                        </button>
                                    ` : '<span style="color: #94a3b8; font-size: 11px;">Solo Admin</span>'}
                                </td>
                            </tr>
                        `;
                    });
                    tbodyEntregas.innerHTML = eHtml;
                }
            }

            // 3. Tab Timeline
            const track = document.getElementById('timelineTrazabilidadContent');
            if (track) {
                if (!historial.length) {
                    track.innerHTML = '<p style="color: #64748b; font-size: 13px; text-align: center; padding: 20px;">No hay registros de transiciones para este viaje.</p>';
                } else {
                    let tHtml = '';
                    historial.forEach(h => {
                        const fechaFmt = new Date(h.fechaCambio).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
                        const usuarioNombre = sanitizarTexto(h.nombreUsuario || 'Sistema');
                        const obs = sanitizarTexto(h.observacion || '');

                        tHtml += `
                            <div class="timeline-item">
                                <div class="timeline-marker" style="background: ${h.colorProceso || '#0284c7'};">
                                    <i class="${h.iconoProceso || 'fa-solid fa-circle'}"></i>
                                </div>
                                <div class="timeline-content" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                                    <div class="timeline-title">
                                        <span style="color: ${h.colorProceso || '#0f172a'}; font-weight: 800; font-size: 13.5px;">${sanitizarTexto(h.nombreProceso || h.codigoProceso)}</span>
                                        <span style="font-size: 11px; color: #64748b; font-weight: 600;">${fechaFmt}</span>
                                    </div>
                                    <div class="timeline-meta" style="margin-top: 6px; color: #475569; font-size: 12px;">
                                        <i class="fa-solid fa-user-check" style="color: #0284c7; margin-right: 4px;"></i> Operado por: <strong>${usuarioNombre}</strong>
                                    </div>
                                    ${obs ? `<div class="timeline-note" style="margin-top: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3.5px solid #0284c7; border-radius: 6px; padding: 6px 10px; font-size: 12px; color: #334155;">${obs}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });
                    track.innerHTML = tHtml;
                }
            }

            // 4. Tab Logs
            const tbodyLogs = document.getElementById('tbodyLogsModificacionesControl');
            if (tbodyLogs) {
                if (!logs.length) {
                    tbodyLogs.innerHTML = '<tr><td colspan="6" class="text-center" style="color: #64748b; padding: 24px; font-size: 13px;">Sin modificaciones registradas en este viaje.</td></tr>';
                } else {
                    let lHtml = '';
                    logs.forEach(l => {
                        const fechaRaw = l.fecha || l.fechaModificacion || l.Fecha;
                        const fechaFmt = fechaRaw ? new Date(fechaRaw).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                        const tipoAcc = sanitizarTexto(l.tipoAccion || l.accion || l.TipoAccion || '');
                        const tipoEnt = sanitizarTexto(l.tipoEntidad || l.entidad || l.TipoEntidad || '');
                        const valAnt = sanitizarTexto(l.valoresAnteriores || l.valorAnterior || l.ValoresAnteriores || '-');
                        const valNue = sanitizarTexto(l.valoresNuevos || l.valorNuevo || l.ValoresNuevos || '-');
                        const motivo = sanitizarTexto(l.motivo || l.Motivo || '-');
                        const usuario = sanitizarTexto(l.nombreUsuario || l.NombreUsuario || ('Usuario #' + (l.usuarioId || l.UsuarioId)));

                        lHtml += `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="white-space: nowrap; color: #64748b; font-size: 11.5px; padding: 10px 14px; vertical-align: middle;">${fechaFmt}</td>
                                <td style="padding: 10px 14px; vertical-align: middle;"><strong style="color: #0284c7; font-size: 12.5px;">${usuario}</strong></td>
                                <td style="padding: 10px 14px; vertical-align: middle;"><span class="badge ${tipoAcc.includes('ELIMINAR') ? 'badge-danger' : 'badge-primary'}" style="font-size: 10.5px; padding: 2px 7px; border-radius: 5px; font-weight: 800;">${tipoEnt}: ${tipoAcc}</span></td>
                                <td style="font-size: 11px; color: #64748b; font-family: monospace; max-width: 140px; word-break: break-word; padding: 10px 14px; vertical-align: middle;">${valAnt}</td>
                                <td style="font-size: 11px; color: #0284c7; font-family: monospace; max-width: 140px; word-break: break-word; padding: 10px 14px; vertical-align: middle;">${valNue}</td>
                                <td style="color: #d97706; font-size: 12px; font-weight: 600; padding: 10px 14px; vertical-align: middle;">${motivo}</td>
                            </tr>
                        `;
                    });
                    tbodyLogs.innerHTML = lHtml;
                }
            }

            // Botones de acción para Admin en el footer del modal
            const btnAdmin = document.getElementById('btnAccionFinalizarAdminModal');
            if (btnAdmin) {
                if (esAdmin) {
                    let btnsHtml = '<div style="display: flex; gap: 10px; align-items: center;">';
                    if (ticket.procesoActualId > 1 || ticket.estado === 'FINALIZADO' || ticket.procesoActualId === 4) {
                        btnsHtml += `
                            <button type="button" class="btn" onclick="revertirProcesoViajeAdmin(${ticket.id})" style="background: #fffbeb; border: 1.5px solid #f59e0b; color: #b45309; font-weight: 700; padding: 0 18px; height: 38px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.2s;" title="Revertir etapa para corregir fincas o entregas">
                                <i class="fa-solid fa-rotate-left"></i> Revertir Proceso
                            </button>
                        `;
                    }
                    if (ticket.procesoActualId !== 4 && ticket.estado !== 'FINALIZADO') {
                        btnsHtml += `
                            <button type="button" class="btn btn-success" onclick="finalizarViajeAdmin(${ticket.id})" style="background: linear-gradient(135deg, #059669, #10b981); border: none; font-weight: 700; color: #fff; padding: 0 18px; height: 38px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">
                                <i class="fa-solid fa-check-to-slot"></i> Finalizar y Auditar Viaje
                            </button>
                        `;
                    }
                    btnsHtml += '</div>';
                } else {
                    btnAdmin.innerHTML = '';
                }
            }
        }

        abrirModalCustom('modalTrazabilidadViaje');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.verTrazabilidadViaje = verTrazabilidadViaje;

// FUNCIONES DE EDICIÓN Y AUDITORÍA EN CONTROL
function abrirModalEditarFincaControl(rutaId) {
    if (!window.currentTrazabilidadData || !window.currentTrazabilidadData.ticket) return;
    const fincas = window.currentTrazabilidadData.fincas || [];
    const f = fincas.find(x => (x.id || x.Id) == rutaId);
    if (!f) {
        Swal.fire({ icon: 'error', title: 'No encontrada', text: 'No se encontró la recolección.', background: '#1e293b', color: '#fff' });
        return;
    }

    document.getElementById('editControlAuditadoTicketId').value = window.currentTrazabilidadData.ticket.id;
    document.getElementById('editControlAuditadoRutaId').value = rutaId;

    // Llenar selector buscable de fincas
    if (!comboboxEditControlFincaInstance && document.getElementById('comboboxEditControlFinca')) {
        comboboxEditControlFincaInstance = setupCombobox({
            containerId: 'comboboxEditControlFinca',
            inputSearchId: 'searchEditControlFincaInput',
            inputHiddenId: 'selectEditControlFincaId',
            dropdownId: 'dropdownEditControlFincaList',
            placeholder: 'SELECCIONE FINCA...',
            getItemsFn: () => (state.fincas || [])
                .filter(item => item.activo !== false && item.Activo !== false)
                .map(item => {
                    const isAdmin = state.user?.rol === 'ADMIN';
                    const id = item.id || item.Id;
                    const nombre = capitalizarTexto(item.nombre || item.Nombre);
                    const prop = capitalizarTexto(item.propietario || item.Propietario);
                    return {
                        value: id,
                        label: (isAdmin && prop) ? `${nombre} (${prop})` : nombre,
                        sub: prop ? `Propietario: ${prop}` : ''
                    };
                }),
            onSelect: (item) => {
                const groupTipoControl = document.getElementById('groupEditControlTipoLeche');
                const selectTipoControl = document.getElementById('selectEditControlTipoLeche');
                if (item) {
                    const matched = (state.fincas || []).find(x => (x.id || x.Id) == item.value);
                    const esDual = !!(matched?.tieneDosTiposLeche || matched?.TieneDosTiposLeche);
                    if (groupTipoControl) groupTipoControl.style.display = esDual ? 'block' : 'none';
                    if (selectTipoControl && !esDual) selectTipoControl.value = 'VACA';
                }
            }
        });
        window.comboboxEditControlFincaInstance = comboboxEditControlFincaInstance;
    }

    const targetFincaId = f.fincaId || f.FincaId;
    const matchedFinca = (state.fincas || []).find(item => Number(item.id || item.Id) === Number(targetFincaId));
    const esDualFinca = !!(matchedFinca?.tieneDosTiposLeche || matchedFinca?.TieneDosTiposLeche);
    const groupTipoControl = document.getElementById('groupEditControlTipoLeche');
    if (groupTipoControl) {
        groupTipoControl.style.display = esDualFinca ? 'block' : 'none';
    }

    if (comboboxEditControlFincaInstance) {
        if (matchedFinca) {
            const nombre = capitalizarTexto(matchedFinca.nombre || matchedFinca.Nombre);
            const prop = capitalizarTexto(matchedFinca.propietario || matchedFinca.Propietario);
            const label = (state.user?.rol === 'ADMIN' && prop) ? `${nombre} (${prop})` : nombre;
            comboboxEditControlFincaInstance.selectItem(matchedFinca.id || matchedFinca.Id, label);
        } else {
            comboboxEditControlFincaInstance.selectItem(targetFincaId || '', f.fincaNombre || 'Finca');
        }
    }

    document.getElementById('inputEditControlFincaLitros').value = f.litros || 0;
    document.getElementById('checkEditControlFincaEsAcida').checked = Boolean(f.esAcida);
    if (document.getElementById('selectEditControlTipoLeche')) {
        document.getElementById('selectEditControlTipoLeche').value = esDualFinca ? (f.tipoLeche || f.TipoLeche || 'VACA').toUpperCase() : 'VACA';
    }
    document.getElementById('inputEditControlFincaObservacion').value = f.observacion || '';
    document.getElementById('textareaEditControlFincaMotivo').value = '';

    abrirModalCustom('modalEditarFincaControlAuditado');
}
window.abrirModalEditarFincaControl = abrirModalEditarFincaControl;

async function guardarEdicionFincaControlAuditado() {
    const ticketId = document.getElementById('editControlAuditadoTicketId').value;
    const rutaId = document.getElementById('editControlAuditadoRutaId').value;
    const fincaId = parseInt(document.getElementById('selectEditControlFincaId').value, 10);
    const litros = parseFloat(document.getElementById('inputEditControlFincaLitros').value);
    const esAcida = document.getElementById('checkEditControlFincaEsAcida').checked;
    const tipoLeche = document.getElementById('selectEditControlTipoLeche')?.value || 'VACA';
    const observacion = document.getElementById('inputEditControlFincaObservacion').value.trim();
    const motivo = document.getElementById('textareaEditControlFincaMotivo').value.trim();

    if (!fincaId || isNaN(fincaId)) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Seleccione una finca válida.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (isNaN(litros) || litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Ingrese un volumen de litros válido mayor a 0.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (!motivo) {
        Swal.fire({ icon: 'warning', title: 'Motivo Obligatorio', text: 'Debe ingresar el motivo o justificación de este cambio para el registro de auditoría.', background: '#1e293b', color: '#fff' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas/${rutaId}/editar-auditado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fincaId,
                litros,
                esAcida,
                tipoLeche,
                observacion,
                motivo
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al actualizar finca' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalEditarFincaControlAuditado');

        Swal.fire({
            icon: 'success',
            title: 'Finca Modificada',
            text: 'La recolección ha sido actualizada y el cambio quedó registrado en la bitácora de auditoría.',
            background: '#1e293b',
            color: '#fff',
            timer: 2000,
            showConfirmButton: false
        });

        await verTrazabilidadViaje(ticketId);
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
        if (typeof cargarRutasHoy === 'function') cargarRutasHoy();
        if (typeof cargarEntregasHoy === 'function') cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
        if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
        const fechaConsulta = document.getElementById('filtroFechaRutas')?.value;
        if (typeof cargarViajesRutasDelDia === 'function') cargarViajesRutasDelDia(fechaConsulta);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.guardarEdicionFincaControlAuditado = guardarEdicionFincaControlAuditado;

async function eliminarFincaControlAuditado(rutaId) {
    if (!window.currentTrazabilidadData || !window.currentTrazabilidadData.ticket) return;
    const ticketId = window.currentTrazabilidadData.ticket.id;
    const f = (window.currentTrazabilidadData.fincas || []).find(x => (x.id || x.Id) == rutaId);

    const { value: motivo, isConfirmed } = await Swal.fire({
        title: '¿Eliminar Finca del Viaje?',
        text: `Se desvinculará la recolección de ${f ? f.fincaNombre : 'la finca'} del ticket #${ticketId}. Indique la justificación obligatoria:`,
        input: 'textarea',
        inputPlaceholder: 'Motivo o justificación de eliminación...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Eliminar de Viaje',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#f8fafc',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return '¡El motivo de la eliminación es obligatorio!';
            }
        }
    });

    if (!isConfirmed || !motivo) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas/${rutaId}/eliminar-auditado?motivo=${encodeURIComponent(motivo.trim())}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al eliminar finca del viaje' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        Swal.fire({
            icon: 'success',
            title: 'Finca Eliminada del Viaje',
            text: 'La recolección ha sido desvinculada y registrada en la bitácora.',
            background: '#1e293b',
            color: '#fff',
            timer: 2000,
            showConfirmButton: false
        });

        await verTrazabilidadViaje(ticketId);
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
        if (typeof cargarRutasHoy === 'function') cargarRutasHoy();
        if (typeof cargarEntregasHoy === 'function') cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
        if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
        const fechaConsulta = document.getElementById('filtroFechaRutas')?.value;
        if (typeof cargarViajesRutasDelDia === 'function') cargarViajesRutasDelDia(fechaConsulta);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.eliminarFincaControlAuditado = eliminarFincaControlAuditado;

function abrirModalEditarEntregaControl(entregaId) {
    if (!window.currentTrazabilidadData || !window.currentTrazabilidadData.ticket) return;
    const entregas = window.currentTrazabilidadData.entregas || [];
    const e = entregas.find(x => (x.id || x.Id) == entregaId);
    if (!e) {
        Swal.fire({ icon: 'error', title: 'No encontrada', text: 'No se encontró la entrega seleccionada.', background: '#1e293b', color: '#fff' });
        return;
    }

    document.getElementById('editControlAuditadoEntregaTicketId').value = window.currentTrazabilidadData.ticket.id;
    document.getElementById('editControlAuditadoEntregaId').value = entregaId;

    // Llenar selector buscable de compañías
    if (!comboboxEditControlEntregaCompaniaInstance && document.getElementById('comboboxEditControlEntregaCompania')) {
        comboboxEditControlEntregaCompaniaInstance = setupCombobox({
            containerId: 'comboboxEditControlEntregaCompania',
            inputSearchId: 'searchEditControlEntregaCompaniaInput',
            inputHiddenId: 'selectEditControlEntregaCompaniaId',
            dropdownId: 'dropdownEditControlEntregaCompaniaList',
            placeholder: 'SELECCIONE COMPAÑÍA...',
            getItemsFn: () => (state.companias || [])
                .filter(item => item.activo !== false && item.Activo !== false)
                .map(item => ({
                    value: item.id || item.Id,
                    label: capitalizarTexto(item.nombre || item.Nombre),
                    sub: item.encargado ? `Encargado: ${capitalizarTexto(item.encargado)}` : ''
                }))
        });
        window.comboboxEditControlEntregaCompaniaInstance = comboboxEditControlEntregaCompaniaInstance;
    }

    if (comboboxEditControlEntregaCompaniaInstance) {
        const targetCompId = e.companiaId || e.CompaniaId;
        const matchedComp = (state.companias || []).find(item => Number(item.id || item.Id) === Number(targetCompId));
        if (matchedComp) {
            comboboxEditControlEntregaCompaniaInstance.selectItem(matchedComp.id || matchedComp.Id, capitalizarTexto(matchedComp.nombre || matchedComp.Nombre));
        } else {
            comboboxEditControlEntregaCompaniaInstance.selectItem(targetCompId || '', e.companiaNombre || 'Compañía');
        }
    }

    document.getElementById('inputEditControlEntregaLitros').value = e.litros || 0;
    document.getElementById('inputEditControlEntregaObservacion').value = e.observacion || '';
    document.getElementById('textareaEditControlEntregaMotivo').value = '';

    abrirModalCustom('modalEditarEntregaControlAuditado');
}
window.abrirModalEditarEntregaControl = abrirModalEditarEntregaControl;

async function guardarEdicionEntregaControlAuditado() {
    const ticketId = document.getElementById('editControlAuditadoEntregaTicketId').value;
    const entregaId = document.getElementById('editControlAuditadoEntregaId').value;
    const companiaId = parseInt(document.getElementById('selectEditControlEntregaCompaniaId').value, 10);
    const litros = parseFloat(document.getElementById('inputEditControlEntregaLitros').value);
    const observacion = document.getElementById('inputEditControlEntregaObservacion').value.trim();
    const motivo = document.getElementById('textareaEditControlEntregaMotivo').value.trim();

    if (!companiaId || isNaN(companiaId)) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Seleccione una compañía válida.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (isNaN(litros) || litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Ingrese un volumen de litros válido mayor a 0.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (!motivo) {
        Swal.fire({ icon: 'warning', title: 'Motivo Obligatorio', text: 'Debe ingresar el motivo o justificación de este cambio para el registro de auditoría.', background: '#1e293b', color: '#fff' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/entregas/${entregaId}/editar-auditado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                companiaId,
                litros,
                observacion,
                motivo
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al actualizar entrega' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalEditarEntregaControlAuditado');

        Swal.fire({
            icon: 'success',
            title: 'Entrega Modificada',
            text: 'La entrega ha sido actualizada y el cambio quedó registrado en la bitácora de auditoría.',
            background: '#1e293b',
            color: '#fff',
            timer: 2000,
            showConfirmButton: false
        });

        await verTrazabilidadViaje(ticketId);
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
        if (typeof cargarEntregasHoy === 'function') cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.guardarEdicionEntregaControlAuditado = guardarEdicionEntregaControlAuditado;

// 9. FINALIZAR VIAJE POR ADMIN
async function finalizarViajeAdmin(ticketId) {
    const { value: observacion, isConfirmed } = await Swal.fire({
        title: '¿Finalizar y Auditar Viaje?',
        text: `Se cerrará el ticket #${ticketId} y se registrará el cuadre volumétrico definitivo.`,
        input: 'text',
        inputPlaceholder: 'Nota contable de cierre (opcional)...',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Finalizar Viaje',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#475569',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/finalizar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ observacion })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al finalizar viaje' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalTrazabilidadViaje');

        Swal.fire({
            icon: 'success',
            title: '¡Viaje Finalizado!',
            text: `El ticket #${ticketId} ha sido auditado y cerrado contablemente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        await cargarControlViajesTickets();
        if (typeof cargarViajeActivoChofer === 'function') cargarViajeActivoChofer();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.finalizarViajeAdmin = finalizarViajeAdmin;

let comboboxAddControlFincaInstance = null;

function abrirModalAgregarFincaControl(ticketId) {
    const tId = ticketId || (window.currentTrazabilidadData && window.currentTrazabilidadData.ticket ? window.currentTrazabilidadData.ticket.id : null);
    if (!tId) return;

    document.getElementById('addControlAuditadoTicketId').value = tId;

    if (!comboboxAddControlFincaInstance && document.getElementById('comboboxAddControlFinca')) {
        comboboxAddControlFincaInstance = setupCombobox({
            containerId: 'comboboxAddControlFinca',
            inputSearchId: 'searchAddControlFincaInput',
            inputHiddenId: 'selectAddControlFincaId',
            dropdownId: 'dropdownAddControlFincaList',
            placeholder: 'BUSCAR Y SELECCIONAR FINCA...',
            getItemsFn: () => (state.fincas || [])
                .filter(item => item.activo !== false && item.Activo !== false)
                .map(item => {
                    const isAdmin = state.user?.rol === 'ADMIN';
                    const id = item.id || item.Id;
                    const nombre = capitalizarTexto(item.nombre || item.Nombre);
                    const prop = capitalizarTexto(item.propietario || item.Propietario);
                    return {
                        value: id,
                        label: (isAdmin && prop) ? `${nombre} (${prop})` : nombre,
                        sub: prop ? `Propietario: ${prop}` : ''
                    };
                }),
            onSelect: (item) => {
                const groupTipo = document.getElementById('groupAddControlTipoLeche');
                const selectTipo = document.getElementById('selectAddControlTipoLeche');
                if (item) {
                    const matched = (state.fincas || []).find(x => (x.id || x.Id) == item.value);
                    const esDual = !!(matched?.tieneDosTiposLeche || matched?.TieneDosTiposLeche);
                    if (groupTipo) groupTipo.style.display = esDual ? 'block' : 'none';
                    if (selectTipo && !esDual) selectTipo.value = 'VACA';
                }
            }
        });
        window.comboboxAddControlFincaInstance = comboboxAddControlFincaInstance;
    }

    if (comboboxAddControlFincaInstance) {
        comboboxAddControlFincaInstance.clear();
    }
    const groupTipo = document.getElementById('groupAddControlTipoLeche');
    if (groupTipo) groupTipo.style.display = 'none';

    document.getElementById('inputAddControlFincaLitros').value = '';
    document.getElementById('checkAddControlFincaEsAcida').checked = false;
    if (document.getElementById('selectAddControlTipoLeche')) {
        document.getElementById('selectAddControlTipoLeche').value = 'VACA';
    }
    document.getElementById('inputAddControlFincaObservacion').value = '';

    abrirModalCustom('modalAgregarFincaControlAuditado');
}
window.abrirModalAgregarFincaControl = abrirModalAgregarFincaControl;

async function guardarAgregarFincaControlAuditado() {
    const ticketId = document.getElementById('addControlAuditadoTicketId').value;
    const fincaId = parseInt(document.getElementById('selectAddControlFincaId').value, 10);
    const litros = parseFloat(document.getElementById('inputAddControlFincaLitros').value);
    const esAcida = document.getElementById('checkAddControlFincaEsAcida').checked;
    const tipoLeche = document.getElementById('selectAddControlTipoLeche')?.value || 'VACA';
    const observacion = document.getElementById('inputAddControlFincaObservacion').value.trim();

    if (!fincaId || isNaN(fincaId)) {
        Swal.fire({ icon: 'warning', title: 'Finca Requerida', text: 'Seleccione una finca de la lista.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (isNaN(litros) || litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Litros Requeridos', text: 'Ingrese una cantidad de litros válida mayor a 0.', background: '#1e293b', color: '#fff' });
        return;
    }

    const { value: motivo, isConfirmed } = await Swal.fire({
        title: 'Motivo de Inclusión de Finca',
        text: 'Indique la justificación para registrar esta nueva finca en el ticket:',
        input: 'textarea',
        inputValue: 'no se agrego una finca y falto litros',
        inputPlaceholder: 'Ej: no se agrego una finca y falto litros...',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Registrar y Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#f8fafc',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return '¡El motivo de la inclusión es obligatorio para auditoría!';
            }
        }
    });

    if (!isConfirmed || !motivo) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fincaId,
                litros,
                esAcida,
                tipoLeche,
                observacion: observacion ? `${observacion} (Motivo: ${motivo})` : `Motivo inclusión: ${motivo}`
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al agregar finca' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalAgregarFincaControlAuditado');

        Swal.fire({
            icon: 'success',
            title: '¡Finca Agregada!',
            text: 'La recolección se ha sumado al ticket y su balance volumétrico se ha actualizado.',
            background: '#1e293b',
            color: '#fff',
            timer: 2200,
            showConfirmButton: false
        });

        if (dtTicketsState.fincasCache) {
            dtTicketsState.fincasCache.delete(Number(ticketId));
        }

        await verTrazabilidadViaje(ticketId);
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
        if (typeof cargarRutasHoy === 'function') cargarRutasHoy();
        if (typeof cargarEntregasHoy === 'function') cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
        if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
        const fechaConsulta = document.getElementById('filtroFechaRutas')?.value;
        if (typeof cargarViajesRutasDelDia === 'function') cargarViajesRutasDelDia(fechaConsulta);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.guardarAgregarFincaControlAuditado = guardarAgregarFincaControlAuditado;

async function revertirProcesoViajeAdmin(ticketId) {
    const { value: formValues, isConfirmed } = await Swal.fire({
        title: `Revertir Proceso &mdash; Ticket #${ticketId}`,
        html: `
            <div style="text-align: left; font-size: 13px; color: #334155;">
                <p style="margin-bottom: 12px; color: #64748b;">
                    Al revertir el proceso se reabrirá el viaje y se permitirá agregar fincas faltantes, ajustar litros o modificar entregas.
                </p>
                <div style="margin-bottom: 14px;">
                    <label style="font-weight: 700; color: #0f172a; display: block; margin-bottom: 5px;">Etapa Destino:</label>
                    <select id="swalSelectProcesoDestino" class="swal2-input" style="width: 100%; margin: 0; font-size: 13.5px; height: 42px; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 0 10px;">
                        <option value="1">1. En Ruta / Recolección (Permite agregar fincas y corregir litros)</option>
                        <option value="2">2. Llegada a Receptoría (Descarga y pesaje en silos)</option>
                        <option value="3">3. Despacho / Entrega a Compañía</option>
                    </select>
                </div>
                <div>
                    <label style="font-weight: 700; color: #b91c1c; display: block; margin-bottom: 5px;">Motivo o Justificación * (Obligatorio para auditoría):</label>
                    <textarea id="swalTextareaMotivoReversion" class="swal2-textarea" placeholder="Ej: no se agrego una finca y falto litros..." style="width: 100%; margin: 0; height: 80px; font-size: 13px; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 8px 10px;">no se agrego una finca y falto litros</textarea>
                </div>
            </div>
        `,
        focusConfirm: false,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-rotate-left"></i> Revertir Proceso',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        background: '#ffffff',
        color: '#0f172a',
        preConfirm: () => {
            const procesoDestinoId = parseInt(document.getElementById('swalSelectProcesoDestino').value, 10);
            const motivo = document.getElementById('swalTextareaMotivoReversion').value.trim();
            if (!motivo) {
                Swal.showValidationMessage('¡El motivo de la reversión es obligatorio para el registro de auditoría!');
                return false;
            }
            return { procesoDestinoId, motivo };
        }
    });

    if (!isConfirmed || !formValues) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/revertir-proceso`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(formValues)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al revertir proceso' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const data = await res.json();

        Swal.fire({
            icon: 'success',
            title: '¡Proceso Revertido!',
            text: `El ticket #${ticketId} ha sido revertido exitosamente. Ahora puedes agregar fincas faltantes o corregir información.`,
            background: '#ffffff',
            color: '#0f172a',
            timer: 2500,
            showConfirmButton: true
        });

        if (dtTicketsState.fincasCache) {
            dtTicketsState.fincasCache.delete(Number(ticketId));
        }

        if (document.getElementById('modalTrazabilidadViaje')?.style.display !== 'none') {
            await verTrazabilidadViaje(ticketId);
        }
        if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
        if (typeof cargarRutasHoy === 'function') cargarRutasHoy();
        if (typeof cargarEntregasHoy === 'function') cargarEntregasHoy();
        if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
        if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
        if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
        const fechaConsulta = document.getElementById('filtroFechaRutas')?.value;
        if (typeof cargarViajesRutasDelDia === 'function') cargarViajesRutasDelDia(fechaConsulta);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.revertirProcesoViajeAdmin = revertirProcesoViajeAdmin;
window.verTrazabilidadViaje = verTrazabilidadViaje;
window.abrirModalTrazabilidadControl = verTrazabilidadViaje;
window.abrirModalTrazabilidadViaje = verTrazabilidadViaje;

// --- FUNCIONES AVANZADAS DE CONTROL DE VIAJES Y TICKETS EN RUTAS Y RECEPTORÍA ---

function conmutarVistaRutas(modo) {
    state.vistaRutasModo = modo;
    const seccionViajes = document.getElementById('seccionViajesRutasDelDia');
    const seccionFincas = document.getElementById('seccionFincasDetalleRutas');
    const btnViajes = document.getElementById('btnVistaViajesRutas');
    const btnFincas = document.getElementById('btnVistaFincasRutas');
    const badgeViajes = document.getElementById('badgeContadorViajesRutas');
    const badgeFincas = document.getElementById('badgeContadorFincasRutas');

    if (modo === 'viajes') {
        if (seccionViajes) seccionViajes.style.display = 'block';
        if (seccionFincas) seccionFincas.style.display = 'none';
        if (btnViajes) {
            btnViajes.style.background = '#ffffff';
            btnViajes.style.color = '#1e293b';
            btnViajes.style.fontWeight = '700';
            btnViajes.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
            const icon = btnViajes.querySelector('i');
            if (icon) icon.style.color = '#2563eb';
        }
        if (badgeViajes) {
            badgeViajes.style.background = '#eff6ff';
            badgeViajes.style.color = '#1d4ed8';
            badgeViajes.style.fontWeight = '800';
        }
        if (btnFincas) {
            btnFincas.style.background = 'transparent';
            btnFincas.style.color = '#64748b';
            btnFincas.style.fontWeight = '600';
            btnFincas.style.boxShadow = 'none';
            const icon = btnFincas.querySelector('i');
            if (icon) icon.style.color = '#64748b';
        }
        if (badgeFincas) {
            badgeFincas.style.background = '#e2e8f0';
            badgeFincas.style.color = '#475569';
            badgeFincas.style.fontWeight = '700';
        }
        const fechaFiltro = document.getElementById('filtroFechaGlobalRutas')?.value || document.getElementById('filtroFechaRutas')?.value || state.rutasFechaFiltro || new Date().toISOString().split('T')[0];
        cargarRutasHoy(fechaFiltro);
    } else {
        if (seccionViajes) seccionViajes.style.display = 'none';
        if (seccionFincas) seccionFincas.style.display = 'block';
        if (btnFincas) {
            btnFincas.style.background = '#ffffff';
            btnFincas.style.color = '#1e293b';
            btnFincas.style.fontWeight = '700';
            btnFincas.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
            const icon = btnFincas.querySelector('i');
            if (icon) icon.style.color = '#2563eb';
        }
        if (badgeFincas) {
            badgeFincas.style.background = '#eff6ff';
            badgeFincas.style.color = '#1d4ed8';
            badgeFincas.style.fontWeight = '800';
        }
        if (btnViajes) {
            btnViajes.style.background = 'transparent';
            btnViajes.style.color = '#64748b';
            btnViajes.style.fontWeight = '600';
            btnViajes.style.boxShadow = 'none';
            const icon = btnViajes.querySelector('i');
            if (icon) icon.style.color = '#64748b';
        }
        if (badgeViajes) {
            badgeViajes.style.background = '#e2e8f0';
            badgeViajes.style.color = '#475569';
            badgeViajes.style.fontWeight = '700';
        }
        const fechaFiltro = document.getElementById('filtroFechaGlobalRutas')?.value || document.getElementById('filtroFechaRutas')?.value || state.rutasFechaFiltro || new Date().toISOString().split('T')[0];
        actualizarVisibilidadFormularioRutas();
        cargarRutasHoy(fechaFiltro);
    }
}
window.conmutarVistaRutas = conmutarVistaRutas;

async function cargarViajesRutasDelDia(fecha) {
    const fechaConsulta = fecha || document.getElementById('filtroFechaGlobalRutas')?.value || document.getElementById('filtroFechaRutas')?.value || new Date().toISOString().split('T')[0];
    const container = document.getElementById('contenedorTarjetasViajesRutas');
    const badgeContador = document.getElementById('badgeContadorViajesRutas');
    if (!container) return;

    const inputFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
    if (inputFechaGlobal && inputFechaGlobal.value !== fechaConsulta) {
        inputFechaGlobal.value = fechaConsulta;
    }

    container.innerHTML = '<div style="grid-column: 1/-1; padding: 24px; text-align: center; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando viajes y tickets del día...</div>';

    try {
        // Cargar en paralelo tickets de RUTA (Entradas) y tickets de RECEPTORÍA (Salidas a Compañías)
        let [resRutas, resComp] = await Promise.all([
            fetch(`${API_BASE}/control-rutas?fecha=${fechaConsulta}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            }),
            fetch(`${API_BASE}/control-companias?fecha=${fechaConsulta}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            })
        ]);

        let rutas = resRutas.ok ? await resRutas.json() : [];
        let companias = resComp.ok ? await resComp.json() : [];

        // REGLA MANDATORIA DE NEGOCIO: En la vista de RUTA NO se visualizan los tickets FINALIZADOS (ProcesoActualId = 4).
        // Toda la bitácora e historial de tickets finalizados pertenece a Control Logístico de Viajes y Tickets.
        rutas = (rutas || []).filter(r => {
            const pId = Number(r.procesoActualId || 1);
            const st = (r.estado || '').toUpperCase();
            return pId !== 4 && st !== 'FINALIZADO';
        });

        companias = (companias || []).filter(c => {
            const pId = Number(c.procesoActualId || 1);
            const st = (c.estado || '').toUpperCase();
            return pId !== 4 && st !== 'FINALIZADO';
        });

        // 1. Normalizar tickets de RUTA
        rutas = (rutas || []).map(r => {
            const ltsFinca = Number(r.totalLitrosFinca || 0);
            const ltsAdicional = Number(r.litrosCargadosAdicional || 0);
            const ltsTotalCamion = ltsFinca + ltsAdicional;
            const esProcesoAbierto = (Number(r.procesoActualId || 1) === 1) || ((r.estado || '').toUpperCase() === 'ABIERTO') || ((r.estado || '').toUpperCase() === 'EN_RUTA');
            const ltsEntregados = (!esProcesoAbierto && r.litrosRecibidosReceptoria != null && Number(r.litrosRecibidosReceptoria) > 0)
                ? Number(r.litrosRecibidosReceptoria)
                : (!esProcesoAbierto && r.litrosEntregadosCompania != null && Number(r.litrosEntregadosCompania) > 0)
                    ? Number(r.litrosEntregadosCompania)
                    : (!esProcesoAbierto && r.totalLitrosReceptoria != null && Number(r.totalLitrosReceptoria) > 0)
                        ? Number(r.totalLitrosReceptoria)
                        : 0;
            const tieneEntrega = !esProcesoAbierto && (ltsEntregados > 0);
            const dif = tieneEntrega ? (ltsTotalCamion - ltsEntregados) : 0;
            const merma = (tieneEntrega && ltsTotalCamion > 0) ? ((Math.abs(dif) * 100.0) / ltsTotalCamion).toFixed(2) : '0.00';

            return {
                ...r,
                _tipoTicket: 'RUTA',
                _origenLabel: 'ORIGEN: RUTA (FINCAS)',
                _origenBadge: 'RUTA',
                _origenColor: '#0284c7',
                _origenBg: '#e0f2fe',
                _origenBorder: '#bae6fd',
                _origenIcon: 'fa-route',
                _litrosRecogidos: ltsTotalCamion,
                _litrosFincas: ltsFinca,
                _litrosAdicional: ltsAdicional,
                _litrosEntregados: ltsEntregados,
                _tieneEntrega: tieneEntrega,
                _diferencia: dif,
                _porcentajeMerma: merma,
                _nombreConductor: r.nombreConductor || 'Conductor No Asignado',
                _estado: (r.estado || (r.procesoActualId === 1 ? 'ABIERTO' : 'RECEPCIONADO')).toUpperCase()
            };
        });

        // 2. Normalizar tickets de RECEPTORÍA (Despachos de salida a compañías)
        companias = (companias || []).map(c => {
            const despachados = Number(c.litrosDespachados || 0);
            const recibidos = c.litrosRecibidosCompania != null ? Number(c.litrosRecibidosCompania) : 0;
            const tieneEntrega = c.litrosRecibidosCompania != null;
            const dif = tieneEntrega ? (despachados - recibidos) : 0;
            const merma = c.porcentajeMerma != null ? Number(c.porcentajeMerma).toFixed(2) : (tieneEntrega && despachados > 0 ? ((Math.abs(dif) * 100.0) / despachados).toFixed(2) : '0.00');

            return {
                ...c,
                _tipoTicket: 'RECEPTORIA',
                _origenLabel: 'ORIGEN: RECEPTORÍA (SALIDA)',
                _origenBadge: 'RECEPTORÍA',
                _origenColor: '#9333ea',
                _origenBg: '#f3e8ff',
                _origenBorder: '#e9d5ff',
                _origenIcon: 'fa-building-wheat',
                _litrosRecogidos: despachados,
                _litrosEntregados: recibidos,
                _tieneEntrega: tieneEntrega,
                _diferencia: dif,
                _porcentajeMerma: merma,
                _nombreConductor: c.nombreConductor || c.conductorNombre || c.nombreUsuario || 'Chofer Asignado',
                _estado: (c.estado || 'EN VIA').toUpperCase()
            };
        });

        // 3. Si el usuario es CHOFER, aislar estrictamente sus viajes
        if (state.user && state.user.rol === 'CHOFER') {
            const uid = state.user.id;
            rutas = rutas.filter(r => (r.usuarioId || r.conductorId) == uid);
            companias = companias.filter(c => (c.usuarioId || c.conductorId) == uid);

            const viajeAbierto = rutas.find(r => r.procesoActualId === 1 || r._estado === 'ABIERTO');
            actualizarEstadoBotonNuevoViaje(viajeAbierto || null);
        }

        const todos = [...rutas, ...companias];
        state.cacheTicketsViajes = { todos, rutas, companias };
        state.viajesDelDia = rutas;

        // 4. Actualizar contadores de los filtros de origen
        const cntTodos = document.getElementById('cntFiltroOrigen_todos');
        const cntRuta = document.getElementById('cntFiltroOrigen_ruta');
        const cntRecep = document.getElementById('cntFiltroOrigen_receptoria');
        if (cntTodos) cntTodos.textContent = todos.length;
        if (cntRuta) cntRuta.textContent = rutas.length;
        if (cntRecep) cntRecep.textContent = companias.length;
        if (badgeContador) badgeContador.textContent = todos.length;

        // 5. Renderizar tarjetas con el filtro activo
        renderizarTarjetasViajesTickets();

        // 6. Actualizar visibilidad de formularios según existencia de tickets abiertos
        actualizarVisibilidadFormularioRutas();
    } catch (err) {
        console.error('Error al cargar viajes del día:', err);
        container.innerHTML = '<div style="grid-column: 1/-1; padding: 24px; text-align: center; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar viajes. Reintente.</div>';
    }
}
window.cargarViajesRutasDelDia = cargarViajesRutasDelDia;

function actualizarVisibilidadFormularioRutas() {
    const cardForm = document.getElementById('cardFormularioCapturaRutas');
    const bannerTicketActivo = document.getElementById('bannerTicketActivoForm');
    if (!cardForm) return;

    const rutas = state.viajesDelDia || state.cacheTicketsViajes?.rutas || [];
    const esChofer = state.user && state.user.rol === 'CHOFER';

    let ticketAbierto = null;
    if (esChofer) {
        // Chofer: Buscar si tiene un ticket propio en estado ABIERTO
        ticketAbierto = rutas.find(r => {
            const uId = r.usuarioId || r.conductorId;
            const est = (r.estado || '').toUpperCase();
            return uId == state.user?.id && (est === 'ABIERTO' || r.procesoActualId === 1);
        });
    } else {
        // Admin: Prioridad 1: Ticket asignado activo actualmente
        if (state.ticketAsignadoActivo) {
            ticketAbierto = rutas.find(r => (r.id || r.Id) == state.ticketAsignadoActivo && ((r.estado || '').toUpperCase() === 'ABIERTO' || r.procesoActualId === 1));
        }
        if (!ticketAbierto && state.filtroTicketId) {
            ticketAbierto = rutas.find(r => (r.id || r.Id) == state.filtroTicketId && ((r.estado || '').toUpperCase() === 'ABIERTO' || r.procesoActualId === 1));
        }
        if (!ticketAbierto && !state.ticketAsignadoActivo && rutas.length > 0) {
            ticketAbierto = rutas.find(r => ((r.estado || '').toUpperCase() === 'ABIERTO' || r.procesoActualId === 1));
        }
    }

    const tIdActivo = ticketAbierto ? (ticketAbierto.id || ticketAbierto.Id) : null;

    if (ticketAbierto && tIdActivo) {
        // SÍ HAY TICKET ABIERTO: Mostrar formulario de recolección y bloquear Fecha y Conductor
        cardForm.style.display = 'block';
        const fechaTicket = ticketAbierto.fecha ? ticketAbierto.fecha.split('T')[0] : (state.rutasFechaFiltro || '');
        const condId = ticketAbierto.usuarioId || ticketAbierto.conductorId;
        const condNom = ticketAbierto.nombreConductor || ticketAbierto._nombreConductor || '';
        sincronizarBloqueoTicketFormulario(tIdActivo, fechaTicket, condId, condNom);
    } else {
        // NO HAY TICKET ABIERTO: Ocultar formulario de registro para TODOS los roles
        cardForm.style.display = 'none';
        sincronizarBloqueoTicketFormulario(null);
    }
}
window.actualizarVisibilidadFormularioRutas = actualizarVisibilidadFormularioRutas;

function actualizarVisibilidadFormularioReceptoria() {
    const cardEntrega = document.getElementById('cardRegistroEntregaReceptoria');
    const btnNuevoRecep = document.getElementById('btnNuevoDespachoReceptoria');
    const selectTicket = document.getElementById('selectEntregaTicketActivo');
    const formGroupTicket = document.getElementById('formGroupEntregaTicketActivo');

    const esChofer = state.user && state.user.rol === 'CHOFER';

    // Regla de Negocio: Un chofer NO puede crear tickets de Receptoría / Salida
    if (btnNuevoRecep) {
        btnNuevoRecep.style.display = esChofer ? 'none' : 'inline-flex';
    }

    if (!cardEntrega) return;

    const filtroFecha = document.getElementById('filtroFechaBandejaReceptoria')?.value || '';

    // Obtener todas las entradas activas (no finalizadas)
    let entradasActivas = (state.todosLosViajesReceptoria || []).filter(v => {
        const pId = Number(v.procesoActualId || 1);
        const st = (v.estado || '').toUpperCase();
        return pId !== 4 && st !== 'FINALIZADO';
    });
    if (filtroFecha) {
        entradasActivas = entradasActivas.filter(v => (v.fecha || '').split('T')[0] === filtroFecha);
    }
    if (esChofer) {
        entradasActivas = entradasActivas.filter(v => (v.usuarioId || v.conductorId) == state.user?.id);
    }

    // Obtener todas las salidas activas (no finalizadas)
    let salidasActivas = (state.todosLosDespachosCompanias || []).filter(d => {
        const pId = Number(d.procesoActualId || 1);
        const st = (d.estado || '').toUpperCase();
        return pId !== 4 && st !== 'FINALIZADO';
    });
    if (filtroFecha) {
        salidasActivas = salidasActivas.filter(d => (d.fecha || '').split('T')[0] === filtroFecha);
    }
    if (esChofer) {
        salidasActivas = salidasActivas.filter(d => (d.usuarioId || d.conductorId) == state.user?.id);
    }

    const ticketsActivos = [];
    entradasActivas.forEach(e => {
        const ltsF = Math.round(Number(e.totalLitrosFinca || e.TotalLitrosFinca || 0));
        ticketsActivos.push({
            tipo: 'RUTA',
            id: e.id || e.Id,
            label: `🚚 Ticket Entrada #${e.id || e.Id} - ${e.nombreConductor || 'Conductor'} (${ltsF.toLocaleString('es-VE')} Lts en Fincas)`,
            conductorId: e.usuarioId || e.conductorId,
            conductorNombre: e.nombreConductor,
            fecha: (e.fecha || '').split('T')[0]
        });
    });

    salidasActivas.forEach(s => {
        const ltsD = Math.round(Number(s.litrosDespachados || 0));
        const choferNom = s.nombreConductor || s.conductorNombre || s.nombreUsuario || (state.choferes || []).find(u => (u.id || u.Id) == (s.usuarioId || s.conductorId))?.nombreCompleto || 'Chofer';
        ticketsActivos.push({
            tipo: 'DESPACHO',
            id: s.id || s.Id,
            label: `🏢 Salida #${s.id || s.Id} - ${choferNom} ➔ ${s.nombreCompania || 'Planta'} (${ltsD.toLocaleString('es-VE')} Lts)`,
            conductorId: s.usuarioId || s.conductorId,
            conductorNombre: choferNom,
            companiaId: s.companiaId,
            fecha: (s.fecha || '').split('T')[0]
        });
    });

    const btnToggleForm = document.getElementById('btnToggleFormularioReceptoria');
    const btnSegmentoForm = document.getElementById('btnSegmentoForm');

    if (ticketsActivos.length === 0) {
        // NO HAY TICKETS ABIERTOS / ACTIVOS: Ocultar formulario de captura y botón
        cardEntrega.style.display = 'none';
        state.ticketEntregaSeleccionado = null;
        if (formGroupTicket) formGroupTicket.style.display = 'none';
        if (btnToggleForm) btnToggleForm.style.display = 'none';
        if (btnSegmentoForm) btnSegmentoForm.style.display = 'none';
    } else {
        // SÍ HAY TICKETS ABIERTOS: Mostrar botón y formulario de entrega
        cardEntrega.style.display = 'block';
        if (btnToggleForm) btnToggleForm.style.display = 'inline-flex';
        if (btnSegmentoForm) btnSegmentoForm.style.display = 'inline-flex';

        if (formGroupTicket && selectTicket) {
            formGroupTicket.style.display = 'block';
            let optionsHtml = '';

            if (ticketsActivos.length > 1) {
                optionsHtml += `<option value="">-- Seleccionar Ticket Activo (${ticketsActivos.length} disponibles) --</option>`;
            }

            ticketsActivos.forEach(t => {
                optionsHtml += `<option value="${t.tipo}_${t.id}">${t.label}</option>`;
            });

            selectTicket.innerHTML = optionsHtml;

            // Si hay exactamente 1 ticket o ya había uno seleccionado, seleccionarlo automáticamente
            if (ticketsActivos.length === 1) {
                const primerT = ticketsActivos[0];
                selectTicket.value = `${primerT.tipo}_${primerT.id}`;
                onSeleccionarTicketEntregaReceptoria(`${primerT.tipo}_${primerT.id}`);
            } else if (state.ticketEntregaSeleccionado) {
                const prevVal = `${state.ticketEntregaSeleccionado.tipo}_${state.ticketEntregaSeleccionado.id}`;
                if (ticketsActivos.some(t => `${t.tipo}_${t.id}` === prevVal)) {
                    selectTicket.value = prevVal;
                }
            }
        }
    }
}
window.actualizarVisibilidadFormularioReceptoria = actualizarVisibilidadFormularioReceptoria;

function onSeleccionarTicketEntregaReceptoria(val) {
    if (!val) {
        state.ticketEntregaSeleccionado = null;
        return;
    }

    const [tipo, idStr] = val.split('_');
    const id = parseInt(idStr);

    if (tipo === 'RUTA') {
        const viaje = (state.todosLosViajesReceptoria || []).find(v => (v.id || v.Id) == id);
        if (viaje) {
            state.ticketEntregaSeleccionado = { tipo: 'RUTA', id: id, data: viaje };
            const cId = viaje.usuarioId || viaje.conductorId;
            if (cId && window.comboboxEntregaConductorInstance) {
                window.comboboxEntregaConductorInstance.selectItem(cId, viaje.nombreConductor || 'Conductor');
            } else if (cId) {
                const selC = document.getElementById('selectEntregaConductor');
                const inpC = document.getElementById('searchEntregaConductorInput');
                if (selC) selC.value = cId;
                if (inpC) inpC.value = viaje.nombreConductor || 'Conductor';
            }
            if (viaje.fecha) {
                const inpF = document.getElementById('inputFechaEntrega');
                if (inpF) inpF.value = viaje.fecha.split('T')[0];
            }
        }
    } else if (tipo === 'DESPACHO') {
        const despacho = (state.todosLosDespachosCompanias || []).find(d => (d.id || d.Id) == id);
        if (despacho) {
            state.ticketEntregaSeleccionado = { tipo: 'DESPACHO', id: id, data: despacho };
            const cId = despacho.usuarioId || despacho.conductorId;
            const choferNom = despacho.nombreConductor || despacho.conductorNombre || despacho.nombreUsuario || (state.choferes || []).find(u => (u.id || u.Id) == cId)?.nombreCompleto || 'Chofer';
            if (cId && window.comboboxEntregaConductorInstance) {
                window.comboboxEntregaConductorInstance.selectItem(cId, choferNom);
            } else if (cId) {
                const selC = document.getElementById('selectEntregaConductor');
                const inpC = document.getElementById('searchEntregaConductorInput');
                if (selC) selC.value = cId;
                if (inpC) inpC.value = choferNom;
            }
            if (despacho.companiaId && window.comboboxEntregaCompaniaInstance) {
                window.comboboxEntregaCompaniaInstance.selectItem(despacho.companiaId, despacho.nombreCompania || 'Planta');
            }
            if (despacho.fecha) {
                const inpF = document.getElementById('inputFechaEntrega');
                if (inpF) inpF.value = despacho.fecha.split('T')[0];
            }
        }
    }
}
window.onSeleccionarTicketEntregaReceptoria = onSeleccionarTicketEntregaReceptoria;

function filtrarOrigenTickets(origen) {
    state.filtroOrigenTicketActivo = origen;

    // Actualizar estilos de los botones de filtro
    const btnTodos = document.getElementById('btnFiltroOrigen_todos');
    const btnRuta = document.getElementById('btnFiltroOrigen_ruta');
    const btnRecep = document.getElementById('btnFiltroOrigen_receptoria');

    [btnTodos, btnRuta, btnRecep].forEach(btn => {
        if (btn) {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.boxShadow = 'none';
            btn.style.fontWeight = '600';
        }
    });

    if (origen === 'RUTA' && btnRuta) {
        btnRuta.style.background = '#ffffff';
        btnRuta.style.color = '#0369a1';
        btnRuta.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
        btnRuta.style.fontWeight = '700';
    } else if (origen === 'RECEPTORIA' && btnRecep) {
        btnRecep.style.background = '#ffffff';
        btnRecep.style.color = '#7e22ce';
        btnRecep.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
        btnRecep.style.fontWeight = '700';
    } else if (btnTodos) {
        btnTodos.style.background = '#ffffff';
        btnTodos.style.color = '#0f172a';
        btnTodos.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
        btnTodos.style.fontWeight = '700';
    }

    renderizarTarjetasViajesTickets();
}
window.filtrarOrigenTickets = filtrarOrigenTickets;

function renderizarTarjetasViajesTickets() {
    const container = document.getElementById('contenedorTarjetasViajesRutas');
    if (!container) return;

    const cache = state.cacheTicketsViajes || { todos: [], rutas: [], companias: [] };
    const filtro = state.filtroOrigenTicketActivo || 'todos';

    let lista = cache.todos;
    if (filtro === 'RUTA') lista = cache.rutas;
    else if (filtro === 'RECEPTORIA') lista = cache.companias;

    const esAdmin = state.user && (state.user.rol === 'ADMIN' || state.user.rol === 'SUPERADMIN');
    const esChofer = state.user && state.user.rol === 'CHOFER';

    if (!lista || lista.length === 0) {
        if (filtro === 'RECEPTORIA') {
            if (esChofer) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 36px 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <i class="fa-solid fa-building-wheat" style="font-size: 38px; color: #a855f7; margin-bottom: 12px; display: block;"></i>
                        <h4 style="color: #1e293b; font-size: 16px; margin: 0 0 6px 0; font-weight: 700;">No hay despachos de Receptoría asignados</h4>
                        <p style="color: #64748b; font-size: 13px; margin: 0 auto; max-width: 480px; line-height: 1.5;">
                            Un chofer no puede crear tickets de Receptoría. Los tickets de salida hacia queseras son emitidos por la administración. Cuando se te asigne un despacho, podrás visualizarlo y validar su entrega aquí.
                        </p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 36px 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <i class="fa-solid fa-building-wheat" style="font-size: 38px; color: #9333ea; margin-bottom: 12px; display: block;"></i>
                        <h4 style="color: #1e293b; font-size: 16px; margin: 0 0 6px 0; font-weight: 700;">No hay tickets de salida a compañías registrados</h4>
                        <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">Puedes emitir un nuevo ticket de salida o despacho hacia una quesera o compañía destino.</p>
                        <button type="button" class="btn btn-primary" onclick="abrirModalNuevoDespachoReceptoria()" style="font-weight: 700; background: linear-gradient(135deg, #9333ea, #7e22ce); border: none; padding: 8px 18px; border-radius: 8px; color: #fff; box-shadow: 0 4px 12px rgba(147,51,234,0.3);">
                            <i class="fa-solid fa-plus-circle"></i> Nuevo Ticket Salida / ENVÍO
                        </button>
                    </div>
                `;
            }
        } else {
            container.innerHTML = `
                <div style="grid-column: 1/-1; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 36px 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <i class="fa-solid fa-truck-moving" style="font-size: 38px; color: #0284c7; margin-bottom: 12px; display: block;"></i>
                    <h4 style="color: #1e293b; font-size: 16px; margin: 0 0 6px 0; font-weight: 700;">No hay viajes de recolección en ruta registrados</h4>
                    <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">Puedes iniciar un viaje de recolección de leche en fincas.</p>
                    <button type="button" class="btn btn-primary" onclick="abrirModalIniciarViaje()" style="font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 8px 18px; border-radius: 8px; color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                        <i class="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje / Ticket
                    </button>
                </div>
            `;
        }
        return;
    }

    container.innerHTML = lista.map(item => {
        const esRuta = item._tipoTicket === 'RUTA';
        const estadoNombre = esRuta
            ? (item.nombreProceso || (item.procesoActualId === 1 ? '1: EN RUTA (ABIERTO)' : item.procesoActualId === 2 ? '2: EN RECEPTORÍA' : item.procesoActualId === 3 ? '3: EN DESTINO (ENTREGADO)' : '4: FINALIZADO'))
            : (item._estado === 'DESPACHO' ? 'DESPACHO' : 'EN VÍA');

        const estadoColor = esRuta
            ? (item.colorProceso || (item.procesoActualId === 1 ? '#2563eb' : item.procesoActualId === 2 ? '#0284c7' : item.procesoActualId === 3 ? '#9333ea' : '#16a34a'))
            : (item._estado === 'DESPACHO' ? '#16a34a' : '#9333ea');

        const estadoBg = esRuta
            ? (item.procesoActualId === 1 ? '#eff6ff' : item.procesoActualId === 2 ? '#f0f9ff' : item.procesoActualId === 3 ? '#faf5ff' : '#f0fdf4')
            : (item._estado === 'DESPACHO' ? '#f0fdf4' : '#faf5ff');

        const estadoStr = ((item._estado || item.estado || '') + '').trim().toUpperCase();
        const procId = item.procesoActualId != null ? Number(item.procesoActualId) : 1;
        const esAbierto = esRuta && (estadoStr === 'ABIERTO' || estadoStr === 'PENDIENTE' || procId === 1) && procId !== 2 && procId !== 3 && procId !== 4;

        return `
            <div class="card-ticket-viaje" id="cardTicketViaje_${item._tipoTicket}_${item.id}" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid ${item._origenColor}; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); overflow: hidden; transition: all 0.25s ease;">
                <!-- CABECERA DE LA TARJETA (REQUERIMIENTO 4: DIFERENCIAR RUTA Y RECEPTORÍA) -->
                <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 15px; font-weight: 800; color: #1e293b;">
                            <i class="fa-solid fa-ticket" style="color: ${item._origenColor};"></i> Ticket #${item.id}
                        </span>
                        <!-- BADGE DISTINTIVO DE ORIGEN (REQUERIMIENTO 4) -->
                        <span class="badge" style="background: ${item._origenBg}; color: ${item._origenColor}; border: 1px solid ${item._origenBorder}; font-weight: 800; font-size: 10.5px; padding: 3px 8px; border-radius: 6px;">
                            <i class="fa-solid ${item._origenIcon}"></i> ${item._origenBadge}
                        </span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="badge" style="background: ${estadoBg}; color: ${estadoColor}; border: 1.5px solid ${estadoColor}40; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 6px;">
                            ${estadoNombre}
                        </span>

                        <!-- BOTÓN EDITAR PARA ADMIN (REQUERIMIENTO 5) -->
                        ${esAdmin ? `
                            <button type="button" class="btn btn-sm" onclick="abrirModalEditarTicket('${item._tipoTicket}', ${item.id})" title="Editar Ticket (Admin)" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11.5px;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                        ` : ''}

                        <!-- BOTÓN ELIMINAR: SOLO SI ESTÁ EN ESTADO ABIERTO. SI TIENE OTRO ESTADO NO SE VISUALIZA -->
                        ${esAbierto ? (
                            esAdmin ? `
                                <button type="button" class="btn btn-sm" onclick="eliminarTicketAdmin('${item._tipoTicket}', ${item.id})" title="Eliminar Ticket Abierto" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11.5px; font-weight: 700;">
                                    <i class="fa-solid fa-trash"></i> Eliminar
                                </button>
                            ` : esChofer ? `
                                <button type="button" class="btn btn-sm" onclick="eliminarTicketRutaChofer(${item.id})" title="Eliminar Ticket Abierto" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11.5px; font-weight: 700;">
                                    <i class="fa-solid fa-trash"></i> Eliminar
                                </button>
                            ` : ''
                        ) : ''}
                    </div>
                </div>

                <!-- CUERPO DE LA TARJETA -->
                <div style="padding: 16px;">
                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                            ${esRuta ? 'Conductor Responsable:' : 'Conductor Asignado:'}
                        </span>
                        <span style="font-size: 14.5px; font-weight: 800; color: #0f172a;">
                            <i class="fa-solid fa-user-tie" style="color: ${item._origenColor}; margin-right: 6px;"></i>${item._nombreConductor}
                        </span>
                        ${!esRuta ? `
                            <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                                <i class="fa-solid fa-building-wheat" style="color: #9333ea; margin-right: 4px;"></i>Destino: <strong>${item.nombreCompania || 'Quesera / Planta'}</strong>
                            </div>
                        ` : ''}
                    </div>

                    <!-- MÉTRICAS DE LITROS Y ENTREGADOS (REQUERIMIENTO 3) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div style="background: #f8fafc; padding: 9px 11px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="font-size: 11px; color: #64748b; font-weight: 600; display: block;">
                                ${esRuta ? (item._litrosAdicional > 0 ? 'Total Leche en Camión:' : 'Leche en Camión:') : 'Litros Despachados:'}
                            </span>
                            <strong style="font-size: 16.5px; color: #0284c7; font-weight: 800;">
                                ${item._litrosRecogidos.toLocaleString('es-VE')} Lts
                            </strong>
                            ${esRuta ? (
                                item._litrosAdicional > 0
                                    ? `<div style="font-size: 10.5px; color: #0f766e; font-weight: 700; margin-top: 2px; line-height: 1.2;">
                                         ${item._litrosFincas > 0 ? `${item._litrosFincas.toLocaleString('es-VE')} L fincas + ` : ''}+${item._litrosAdicional.toLocaleString('es-VE')} L traspaso
                                       </div>`
                                    : `<small style="font-size: 11px; color: #64748b; display: block;">(${item.totalFincas || 0} fincas)</small>`
                            ) : ''}
                        </div>
                        <div style="background: ${item._tieneEntrega ? '#f0fdf4' : '#fffbeb'}; padding: 9px 11px; border-radius: 8px; border: 1px solid ${item._tieneEntrega ? '#bbf7d0' : '#fef3c7'};">
                            <span style="font-size: 11px; color: ${item._tieneEntrega ? '#15803d' : '#b45309'}; font-weight: 600; display: block;">
                                ${esRuta ? 'Litros Recibidos:' : 'Litros en Quesera:'}
                            </span>
                            <strong style="font-size: 16.5px; color: ${item._tieneEntrega ? '#16a34a' : '#d97706'}; font-weight: 800;">
                                ${item._tieneEntrega ? `${item._litrosEntregados.toLocaleString('es-VE')} Lts` : 'En Tránsito'}
                            </strong>
                            <small style="font-size: 11px; color: ${item._tieneEntrega ? '#15803d' : '#b45309'}; display: block;">
                                ${item._tieneEntrega ? (esRuta ? 'En Receptoría' : 'Entregado') : 'Pendiente de pesaje'}
                            </small>
                        </div>
                    </div>

                    <!-- BANNER VISUAL DE TRASPASO DE LECHE / OBSERVACIÓN -->
                    ${(item._litrosAdicional > 0 || (item.observacion && item.observacion.toUpperCase().includes('TRASPASO'))) ? `
                        <div style="background: linear-gradient(135deg, #f0fdfa, #ccfbf1); border: 1.5px solid #5eead4; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px; box-shadow: 0 1px 3px rgba(13,148,136,0.08);">
                            <i class="fa-solid fa-right-left" style="color: #0d9488; font-size: 14px; margin-top: 2px; flex-shrink: 0;"></i>
                            <div style="font-size: 11.5px; color: #115e59; font-weight: 700; line-height: 1.35;">
                                <span>${item.observacion || `Recibió TRASPASO de +${item._litrosAdicional.toLocaleString('es-VE')} Lts`}</span>
                            </div>
                        </div>
                    ` : ''}

                    <!-- CAJA DE FALLA / DIFERENCIA (REQUERIMIENTO 3: LITROS ENTREGADOS Y LA DIFERENCIA) -->
                    ${item._tieneEntrega ? `
                        <div style="background: ${item._diferencia > 0 ? '#fef2f2' : (item._diferencia === 0 ? '#f0fdf4' : '#eff6ff')}; border: 1px solid ${item._diferencia > 0 ? '#fecaca' : (item._diferencia === 0 ? '#bbf7d0' : '#bfdbfe')}; border-radius: 8px; padding: 7px 11px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: ${item._diferencia > 0 ? '#991b1b' : (item._diferencia === 0 ? '#166534' : '#1e40af')}; text-transform: uppercase;">
                                    ${item._diferencia > 0 ? '⚠️ Falla / Faltante:' : (item._diferencia === 0 ? '✅ Entrega Exacta:' : 'ℹ️ Sobrante:')}
                                </span>
                                <div style="font-size: 11px; color: #64748b;">
                                    ${item._diferencia > 0 ? 'Diferencia en pesaje' : (item._diferencia === 0 ? 'Sin merma de leche' : 'Leche adicional')}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <strong style="font-size: 15px; font-weight: 800; color: ${item._diferencia > 0 ? '#dc2626' : (item._diferencia === 0 ? '#16a34a' : '#2563eb')};">
                                    ${item._diferencia > 0 ? `-${Math.abs(item._diferencia).toLocaleString('es-VE')}` : (item._diferencia < 0 ? `+${Math.abs(item._diferencia).toLocaleString('es-VE')}` : '0')} Lts
                                </strong>
                                <span style="font-size: 10.5px; font-weight: 700; color: ${item._diferencia > 0 ? '#dc2626' : (item._diferencia === 0 ? '#16a34a' : '#2563eb')}; display: block;">
                                    (${item._porcentajeMerma}% merma)
                                </span>
                            </div>
                        </div>
                    ` : ''}

                    <!-- DETALLE DE FINCAS SI ES TICKET DE RUTA -->
                    ${esRuta ? `
                        <div style="margin-bottom: 12px;">
                            <button type="button" class="btn btn-sm btn-outline" onclick="toggleDetalleFincasTicket(${item.id})" style="width: 100%; border-color: #cbd5e1; background: #ffffff; color: #334155; font-weight: 600; display: flex; justify-content: space-between; align-items: center; padding: 7px 12px; border-radius: 6px; font-size: 12px;">
                                <span><i class="fa-solid fa-list-ul" style="color: #2563eb; margin-right: 6px;"></i> Ver Fincas de este Viaje (${item.totalFincas || 0})</span>
                                <i class="fa-solid fa-chevron-down" id="chevronTicketFincas_${item.id}" style="color: #94a3b8;"></i>
                            </button>
                            <div id="listaFincasTicket_${item.id}" style="display: none; margin-top: 8px; max-height: 180px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px;">
                                <div style="font-size: 12px; color: #64748b; text-align: center; padding: 8px;">Cargando fincas...</div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- ACCIONES OPERATIVAS -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${esRuta ? (
                            item.procesoActualId === 1 ? `
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                                    <button type="button" class="btn btn-sm" onclick="prepararEnviarReceptoria(${item.id})" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-weight: 700; border: none; border-radius: 6px; padding: 8px 4px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 11.5px; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
                                        <i class="fa-solid fa-truck-ramp-box"></i> Receptoría
                                    </button>
                                    <button type="button" class="btn btn-sm" onclick="prepararEntregaDirecta(${item.id})" style="background: linear-gradient(135deg, #9333ea, #7e22ce); color: #fff; font-weight: 700; border: none; border-radius: 6px; padding: 8px 4px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 11.5px; box-shadow: 0 2px 8px rgba(147,51,234,0.25);">
                                        <i class="fa-solid fa-building"></i> Compañías
                                    </button>
                                    <button type="button" class="btn btn-sm" onclick="prepararTraspasoLeche(${item.id})" style="background: linear-gradient(135deg, #0d9488, #059669); color: #fff; font-weight: 700; border: none; border-radius: 6px; padding: 8px 4px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 11.5px; box-shadow: 0 2px 8px rgba(13,148,136,0.25);" title="Traspaso de leche a otro chofer">
                                        <i class="fa-solid fa-right-left"></i> Traspaso
                                    </button>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline" onclick="conmutarAFincasFiltradas(${item.id})" style="width: 100%; border-color: #cbd5e1; background: #ffffff; color: #1e293b; font-weight: 700; padding: 8px 12px; font-size: 12.5px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease;">
                                    <i class="fa-solid fa-pen-to-square" style="color: #2563eb;"></i> Ver y Editar Fincas de este Viaje (${item.totalFincas || 0})
                                </button>
                            ` : item.procesoActualId === 2 ? `
                                <button type="button" class="btn btn-sm btn-primary" onclick="irAReceptoriaParaTicket(${item.id})" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; font-weight: 700; border: none; padding: 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(2,132,199,0.25);">
                                    <i class="fa-solid fa-scale-balanced"></i> En Receptoría: Recibir y Medir Leche
                                </button>
                            ` : item.procesoActualId === 3 ? `
                                <button type="button" class="btn btn-sm btn-primary" onclick="irAReceptoriaParaTicket(${item.id})" style="background: linear-gradient(135deg, #9333ea, #7e22ce); color: #fff; font-weight: 700; border: none; padding: 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(147,51,234,0.25);">
                                    <i class="fa-solid fa-building"></i> En Tránsito: Confirmar Entrega en Compañías
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm btn-outline" onclick="verTrazabilidadViaje(${item.id})" style="width: 100%; border-color: #cbd5e1; color: #475569; font-weight: 600; padding: 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                                    <i class="fa-solid fa-check-double" style="color: #10b981;"></i> Ver Liquidación y Trazabilidad
                                </button>
                            `
                        ) : (
                            item._estado !== 'DESPACHO' ? `
                                <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalValidarEntregaDespacho(${item.id})" style="width: 100%; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(16,185,129,0.25); color: #fff;">
                                    <i class="fa-solid fa-clipboard-check"></i> Validar Entrega en Compañías
                                </button>
                            ` : `
                                <div style="font-size: 12px; color: #166534; font-weight: 700; text-align: center; padding: 6px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                                    <i class="fa-solid fa-check-double"></i> Entrega en Compañías Validada
                                </div>
                            `
                        )}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
window.renderizarTarjetasViajesTickets = renderizarTarjetasViajesTickets;

// =========================================================================
// REQUERIMIENTO 1 Y 2: FUNCIONES PARA ELIMINAR TICKETS (ADMIN Y CHOFER)
// =========================================================================

async function eliminarTicketRutaChofer(ticketId) {
    const result = await Swal.fire({
        icon: 'warning',
        title: `¿Eliminar Ticket #${ticketId}?`,
        html: `<p style="color: #64748b; font-size: 13.5px; line-height: 1.5;">El ticket está en estado <strong>ABIERTO</strong>. Al eliminarlo, se limpiará el viaje y podrás iniciar uno nuevo cuando gustes.</p>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-trash"></i> Sí, Eliminar Viaje',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#ffffff',
        color: '#0f172a'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al eliminar el ticket');

        showToast(`Ticket #${ticketId} eliminado correctamente.`, 'success');
        await cargarViajesRutasDelDia();
        await cargarRutasHoy();
        if (typeof cargarViajeActivoChofer === 'function') await cargarViajeActivoChofer();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: err.message,
            confirmButtonColor: '#ef4444'
        });
    }
}
window.eliminarTicketRutaChofer = eliminarTicketRutaChofer;

async function eliminarTicketAdmin(tipo, ticketId) {
    const esRuta = tipo === 'RUTA';
    const endpoint = esRuta ? `${API_BASE}/control-rutas/${ticketId}` : `${API_BASE}/control-companias/${ticketId}`;
    const desc = esRuta ? `Ticket de Ruta #${ticketId}` : `Ticket de Salida a Quesera #${ticketId}`;

    const result = await Swal.fire({
        icon: 'warning',
        title: `¿Eliminar ${desc}?`,
        html: `<p style="color: #64748b; font-size: 13.5px; line-height: 1.5;">Esta acción como <strong>ADMINISTRADOR</strong> eliminará permanentemente el ticket y sus registros vinculados.</p>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-trash"></i> Sí, Eliminar Definitivamente',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#ffffff',
        color: '#0f172a'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al eliminar el ticket');

        showToast(`${desc} eliminado correctamente.`, 'success');
        await refrescarVistasGlobales();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al eliminar ticket',
            text: err.message,
            confirmButtonColor: '#ef4444'
        });
    }
}
window.eliminarTicketAdmin = eliminarTicketAdmin;

// =========================================================================
// REQUERIMIENTO 5: EDICIÓN DE TICKETS POR ROL ADMIN (RUTAS Y RECEPTORÍA)
// =========================================================================

async function abrirModalEditarTicket(tipo, ticketId) {
    if (!state.user || (state.user.rol !== 'ADMIN' && state.user.rol !== 'SUPERADMIN')) {
        showToast('Solo los administradores pueden editar registros.', 'error');
        return;
    }

    if (tipo === 'RUTA') {
        let ticket = null;
        try {
            const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) ticket = await res.json();
        } catch (e) {}
        if (!ticket) {
            ticket = (state.cacheTicketsViajes?.rutas || []).find(r => r.id === ticketId);
        }
        if (!ticket) {
            showToast('No se encontró el ticket de ruta a editar.', 'error');
            return;
        }

        const fechaVal = (ticket.fecha || '').split('T')[0] || new Date().toISOString().split('T')[0];
        const choferActualId = ticket.usuarioId || ticket.conductorId || 0;
        const totalFincasVal = Number(ticket.totalLitrosFinca || 0);
        const litrosRecibidosVal = ticket.litrosRecibidosReceptoria != null ? ticket.litrosRecibidosReceptoria : (ticket.totalLitrosReceptoria != null ? ticket.totalLitrosReceptoria : '');
        const estadoActual = (ticket.estado || (ticket.procesoActualId === 1 ? 'ABIERTO' : 'RECEPCIONADO')).toUpperCase();
        const obsVal = ticket.observacion || '';

        const { value: formValues } = await Swal.fire({
            title: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 20px; font-weight: 800; color: #0c4a6e;"><i class="fa-solid fa-pen-to-square" style="color: #0284c7;"></i> Editar Ticket de Ruta #${ticketId}</div>`,
            customClass: {
                popup: 'swal2-modal-overflow-visible'
            },
            width: 620,
            html: `
                <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                    <!-- Cabecera Informativa -->
                    <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 1.5px solid #bae6fd; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);">
                            <i class="fa-solid fa-route"></i>
                        </div>
                        <div style="font-size: 12.5px; color: #0369a1; line-height: 1.4; font-weight: 500;">
                            Edición de parámetros del <strong>Ticket de Ruta #${ticketId}</strong>.<br>
                            Litros Recolectados en Fincas: <strong style="font-size: 14px; color: #0284c7;">${totalFincasVal.toLocaleString('es-VE')} Lts</strong>.
                        </div>
                    </div>

                    <!-- Fila 1: Fecha y Estado -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-calendar-day" style="color: #0284c7; margin-right: 4px;"></i> FECHA *
                            </label>
                            <input id="swalEditRutaFecha" type="date" class="form-input" value="${fechaVal}" style="width: 100%; height: 40px; font-size: 13px; font-weight: 600; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-signal" style="color: #0284c7; margin-right: 4px;"></i> ESTADO *
                            </label>
                            <select id="swalEditRutaEstado" class="form-input" style="width: 100%; height: 40px; font-size: 13px; font-weight: 700; border-radius: 8px; color: #0f172a;">
                                <option value="ABIERTO" ${estadoActual === 'ABIERTO' || estadoActual === 'EN RUTA' ? 'selected' : ''}>1: EN RUTA (ABIERTO)</option>
                                <option value="RECEPCIONADO" ${estadoActual === 'RECEPCIONADO' || estadoActual === 'RECIBIDO' ? 'selected' : ''}>2: RECEPCIONADO</option>
                                <option value="FINALIZADO" ${estadoActual === 'FINALIZADO' ? 'selected' : ''}>3: FINALIZADO</option>
                            </select>
                        </div>
                    </div>

                    <!-- Fila 2: Conductor Responsable (Searchable Combobox) -->
                    <div style="margin-bottom: 14px; position: relative; overflow: visible;">
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                            <i class="fa-solid fa-user-gear" style="color: #0284c7; margin-right: 4px;"></i> CONDUCTOR RESPONSABLE *
                        </label>
                        <div class="searchable-select" id="swalComboboxEditRutaChofer" style="position: relative;">
                            <input type="hidden" id="swalEditRutaChoferVal" value="${choferActualId}">
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="searchEditRutaChoferInput" placeholder="Buscar conductor asignado..." autocomplete="off" style="border-radius: 8px; height: 40px; font-size: 13.5px; font-weight: 600;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="dropdownEditRutaChoferList" style="display: none; max-height: 180px; z-index: 99999;"></div>
                        </div>
                    </div>

                    <!-- Fila 3: Litros Finca y Litros Receptoría -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-cow" style="color: #0284c7; margin-right: 4px;"></i> LITROS EN FINCAS
                            </label>
                            <input id="swalEditRutaLitrosFinca" type="text" class="form-input" value="${totalFincasVal.toLocaleString('es-VE')} Lts" style="width: 100%; height: 40px; font-size: 14px; font-weight: 800; background: #f8fafc; color: #64748b; border-radius: 8px;" disabled title="Calculado desde las recolecciones de fincas">
                        </div>
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-warehouse" style="color: #0284c7; margin-right: 4px;"></i> RECIBIDO EN RECEPTORÍA
                            </label>
                            <input id="swalEditRutaLitrosRecep" type="number" class="form-input" value="${litrosRecibidosVal}" placeholder="Sin pesaje aún" style="width: 100%; height: 40px; font-size: 14px; font-weight: 800; color: #0f172a; border-radius: 8px;">
                        </div>
                    </div>

                    <!-- Box de Variación / Merma en tiempo real -->
                    <div id="swalEditRutaMermaBox" style="margin-bottom: 14px; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #f8fafc; display: flex; align-items: center; justify-content: space-between;">
                        <div style="font-size: 12px; font-weight: 600; color: #64748b;" id="swalEditRutaMermaMsg">
                            Diferencia Ruta vs Receptoría
                        </div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #0f172a;" id="swalEditRutaMermaValor">
                            0 Lts (0.00%)
                        </div>
                    </div>

                    <!-- Fila 4: Observación -->
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                            <i class="fa-solid fa-comment-dots" style="color: #0284c7; margin-right: 4px;"></i> OBSERVACIÓN
                        </label>
                        <input id="swalEditRutaObs" type="text" class="form-input" value="${obsVal}" placeholder="Nota u observación del ticket..." style="width: 100%; height: 40px; font-size: 13px; border-radius: 8px;">
                    </div>
                </div>
            `,
            didOpen: () => {
                const choferesOpciones = (state.choferes || []).map(c => ({
                    value: c.id || c.Id,
                    label: (c.nombreCompleto || c.NombreCompleto || c.username || `Chofer #${c.id}`).toUpperCase()
                }));

                const cbChofer = setupCombobox({
                    containerId: 'swalComboboxEditRutaChofer',
                    inputSearchId: 'searchEditRutaChoferInput',
                    inputHiddenId: 'swalEditRutaChoferVal',
                    dropdownId: 'dropdownEditRutaChoferList',
                    placeholder: 'Buscar conductor responsable...',
                    getItemsFn: () => choferesOpciones
                });

                if (choferActualId) {
                    const chObj = choferesOpciones.find(c => c.value == choferActualId);
                    if (chObj) {
                        cbChofer.selectItem(chObj.value, chObj.label);
                    }
                }

                // Cálculo de merma en vivo
                const inpRecep = document.getElementById('swalEditRutaLitrosRecep');
                const boxMerma = document.getElementById('swalEditRutaMermaBox');
                const lblMsg = document.getElementById('swalEditRutaMermaMsg');
                const lblVal = document.getElementById('swalEditRutaMermaValor');

                const recalcMerma = () => {
                    const ltsRec = parseFloat(inpRecep?.value);
                    if (isNaN(ltsRec) || ltsRec <= 0 || totalFincasVal <= 0) {
                        boxMerma.style.background = '#f8fafc';
                        boxMerma.style.borderColor = '#cbd5e1';
                        lblMsg.style.color = '#64748b';
                        lblMsg.innerText = 'Sin datos de pesaje en receptoría';
                        lblVal.style.color = '#64748b';
                        lblVal.innerText = '--';
                        return;
                    }

                    const dif = totalFincasVal - ltsRec;
                    const pct = ((Math.abs(dif) / totalFincasVal) * 100).toFixed(2);

                    if (dif === 0) {
                        boxMerma.style.background = '#f0fdf4';
                        boxMerma.style.borderColor = '#bbf7d0';
                        lblMsg.style.color = '#15803d';
                        lblMsg.innerText = 'Pesaje 100% exacto';
                        lblVal.style.color = '#16a34a';
                        lblVal.innerText = `0 Lts (0.00%)`;
                    } else if (dif > 0) {
                        boxMerma.style.background = '#fff7ed';
                        boxMerma.style.borderColor = '#fed7aa';
                        lblMsg.style.color = '#9a3412';
                        lblMsg.innerText = `Faltante en receptoría: -${dif.toLocaleString('es-VE')} Lts`;
                        lblVal.style.color = '#ea580c';
                        lblVal.innerText = `-${dif.toLocaleString('es-VE')} Lts (${pct}%)`;
                    } else {
                        boxMerma.style.background = '#eff6ff';
                        boxMerma.style.borderColor = '#bfdbfe';
                        lblMsg.style.color = '#1e40af';
                        lblMsg.innerText = `Excedente en receptoría: +${Math.abs(dif).toLocaleString('es-VE')} Lts`;
                        lblVal.style.color = '#2563eb';
                        lblVal.innerText = `+${Math.abs(dif).toLocaleString('es-VE')} Lts (${pct}%)`;
                    }
                };

                if (inpRecep) {
                    inpRecep.addEventListener('input', recalcMerma);
                    recalcMerma();
                }
            },
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#0284c7',
            cancelButtonColor: '#64748b',
            preConfirm: () => {
                const fecha = document.getElementById('swalEditRutaFecha')?.value;
                const conductorId = parseInt(document.getElementById('swalEditRutaChoferVal')?.value);
                const estado = document.getElementById('swalEditRutaEstado')?.value;
                const ltsRecepStr = document.getElementById('swalEditRutaLitrosRecep')?.value;
                const obs = document.getElementById('swalEditRutaObs')?.value || '';

                if (!fecha) {
                    Swal.showValidationMessage('La fecha es obligatoria.');
                    return false;
                }
                if (!conductorId) {
                    Swal.showValidationMessage('Selecciona un conductor responsable.');
                    return false;
                }

                const payload = {
                    fecha: fecha,
                    usuarioId: conductorId,
                    estado: estado,
                    procesoActualId: estado === 'ABIERTO' ? 1 : (estado === 'FINALIZADO' ? 3 : 2),
                    observacion: obs
                };

                if (ltsRecepStr !== '') {
                    payload.litrosRecibidosReceptoria = parseInt(ltsRecepStr);
                    payload.totalLitrosReceptoria = parseInt(ltsRecepStr);
                }

                return payload;
            }
        });

        if (!formValues) return;

        try {
            const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                body: JSON.stringify(formValues)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al actualizar ticket de ruta');

            delete state.cacheTicketsViajes;
            showToast(`Ticket #${ticketId} actualizado exitosamente.`, 'success');
            const inpFiltroFechaEntregas = document.getElementById('filtroFechaEntregas');
            if (inpFiltroFechaEntregas && formValues.fecha) {
                inpFiltroFechaEntregas.value = formValues.fecha;
            }
            const inpFiltroFechaRutas = document.getElementById('filtroFechaRutas');
            if (inpFiltroFechaRutas && formValues.fecha) {
                inpFiltroFechaRutas.value = formValues.fecha;
            }
            const inpFiltroFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
            if (inpFiltroFechaGlobal && formValues.fecha) {
                inpFiltroFechaGlobal.value = formValues.fecha;
            }
            if (typeof onCambiarFechaGlobalRutas === 'function' && formValues.fecha) {
                onCambiarFechaGlobalRutas(formValues.fecha);
            } else if (typeof cargarRutasHoy === 'function') {
                await cargarRutasHoy(formValues.fecha);
            }
            if (typeof cargarEntregasHoy === 'function') await cargarEntregasHoy();
            if (typeof cargarViajesRutasDelDia === 'function') await cargarViajesRutasDelDia(formValues.fecha);
            if (typeof cargarControlViajesTickets === 'function') await cargarControlViajesTickets();
            if (typeof cargarBandejaReceptoria === 'function') await cargarBandejaReceptoria();
            await refrescarVistasGlobales();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#ef4444' });
        }
    } else if (tipo === 'RECEPTORIA' || tipo === 'SUB_DESPACHO' || tipo === 'COMPANIA' || tipo === 'ENTREGA') {
        let despacho = null;
        try {
            const res = await fetch(`${API_BASE}/control-companias/${ticketId}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) despacho = await res.json();
        } catch (e) {}
        if (!despacho) {
            despacho = (state.cacheTicketsViajes?.companias || []).find(c => c.id === ticketId);
        }
        if (!despacho) {
            showToast('No se encontró el ticket de salida a editar.', 'error');
            return;
        }

        const fechaVal = (despacho.fecha || '').split('T')[0] || new Date().toISOString().split('T')[0];
        const choferActualId = despacho.usuarioId || 0;
        const compActualId = despacho.companiaId || 0;
        const despachadosVal = despacho.litrosDespachados || 0;
        const recibidosVal = despacho.litrosRecibidosCompania != null ? despacho.litrosRecibidosCompania : '';
        const estadoActual = (despacho.estado || 'EN VIA').toUpperCase();
        
        const tipoLecheDetectado = (despacho.tipoLeche || despacho.TipoLeche || ((despacho.observacion || '').toUpperCase().includes('BUFAL') ? 'BUFALA' : 'VACA')).toUpperCase();
        const tipoLecheActual = tipoLecheDetectado.includes('BUFAL') ? 'BUFALA' : 'VACA';
        
        // Limpiar tags [ESTANDAR], [VACA], [BUFALA] para que la observación sea limpia
        const obsVal = (despacho.observacion || '').replace(/\[(ESTANDAR|VACA|BUFALA|BUFALO)\]/gi, '').trim();

        const { value: formValues } = await Swal.fire({
            title: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 20px; font-weight: 800; color: #3b0764;"><i class="fa-solid fa-pen-to-square" style="color: #9333ea;"></i> Editar Ticket de Salida #${ticketId}</div>`,
            customClass: {
                popup: 'swal2-modal-overflow-visible'
            },
            width: 650,
            html: `
                <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                    <!-- Cabecera Informativa con Badge de Tipo de Leche -->
                    <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1.5px solid #ddd6fe; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 42px; height: 42px; border-radius: 10px; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);">
                                <i class="fa-solid fa-truck-ramp-box"></i>
                            </div>
                            <div style="font-size: 12.5px; color: #581c87; line-height: 1.4; font-weight: 500;">
                                Edición de despacho a planta/quesera <strong>Ticket #${ticketId}</strong>.<br>
                                Litros Despachados: <strong style="font-size: 14px; color: #7c3aed;">${Number(despachadosVal).toLocaleString('es-VE')} Lts</strong>.
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10.5px; font-weight: 700; color: #7c3aed; text-transform: uppercase; margin-bottom: 3px;">TIPO DE LECHE</div>
                            <span id="badgeHeaderTipoLeche" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 13.5px; background: ${tipoLecheActual === 'BUFALA' ? '#fae8ff' : '#ecfdf5'}; color: ${tipoLecheActual === 'BUFALA' ? '#a21caf' : '#15803d'}; border: 2px solid ${tipoLecheActual === 'BUFALA' ? '#f0abfc' : '#86efac'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${tipoLecheActual === 'BUFALA' ? '🐃 BÚFALA' : '🐄 VACA'}
                            </span>
                        </div>
                    </div>

                    <!-- Fila 1: Fecha y Estado -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-calendar-day" style="color: #7c3aed; margin-right: 4px;"></i> FECHA *
                            </label>
                            <input id="swalEditCompFecha" type="date" class="form-input" value="${fechaVal}" style="width: 100%; height: 40px; font-size: 13px; font-weight: 600; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-signal" style="color: #7c3aed; margin-right: 4px;"></i> ESTADO *
                            </label>
                            <select id="swalEditCompEstado" class="form-input" style="width: 100%; height: 40px; font-size: 12.5px; font-weight: 700; border-radius: 8px; color: #0f172a;">
                                <option value="EN VIA" ${estadoActual === 'EN VIA' || estadoActual === 'EN VÍA' ? 'selected' : ''}>🚚 EN VÍA</option>
                                <option value="FINALIZADO" ${estadoActual === 'FINALIZADO' ? 'selected' : ''}>✅ FINALIZADO (ENTREGADO)</option>
                                <option value="CANCELADO" ${estadoActual === 'CANCELADO' ? 'selected' : ''}>❌ CANCELADO</option>
                            </select>
                        </div>
                    </div>

                    <!-- Fila Tipo de Leche (ULTRA DESTACADA) -->
                    <div style="margin-bottom: 14px; padding: 12px 14px; background: #faf5ff; border: 2px solid #c084fc; border-radius: 10px; box-shadow: 0 2px 6px rgba(147, 51, 234, 0.08);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="font-size: 12px; font-weight: 800; color: #6b21a8; margin: 0; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-cow" style="color: #9333ea; font-size: 15px;"></i> TIPO DE LECHE *
                            </label>
                            <span style="font-size: 11px; color: #9333ea; font-weight: 700;">Selecciona si es Vaca o Búfala</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <label id="lblRadioTipoVaca" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; background: ${tipoLecheActual === 'VACA' ? '#dcfce7' : '#ffffff'}; border: 2px solid ${tipoLecheActual === 'VACA' ? '#16a34a' : '#cbd5e1'}; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 13.5px; color: ${tipoLecheActual === 'VACA' ? '#15803d' : '#475569'}; transition: all 0.2s;">
                                <input type="radio" name="swalEditCompTipoLecheRadio" value="VACA" ${tipoLecheActual === 'VACA' ? 'checked' : ''} onchange="window.actualizarSeleccionTipoLeche('VACA')" style="accent-color: #16a34a; width: 18px; height: 18px;">
                                <span>🐄 LECHE DE VACA</span>
                            </label>
                            <label id="lblRadioTipoBufala" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; background: ${tipoLecheActual === 'BUFALA' ? '#fae8ff' : '#ffffff'}; border: 2px solid ${tipoLecheActual === 'BUFALA' ? '#a21caf' : '#cbd5e1'}; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 13.5px; color: ${tipoLecheActual === 'BUFALA' ? '#86198f' : '#475569'}; transition: all 0.2s;">
                                <input type="radio" name="swalEditCompTipoLecheRadio" value="BUFALA" ${tipoLecheActual === 'BUFALA' ? 'checked' : ''} onchange="window.actualizarSeleccionTipoLeche('BUFALA')" style="accent-color: #a21caf; width: 18px; height: 18px;">
                                <span>🐃 LECHE DE BÚFALA</span>
                            </label>
                        </div>
                        <input type="hidden" id="swalEditCompTipoLeche" value="${tipoLecheActual}">
                    </div>

                    <!-- Fila 2: Conductor Asignado (Searchable Combobox) -->
                    <div style="margin-bottom: 14px; position: relative; overflow: visible;">
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                            <i class="fa-solid fa-id-card" style="color: #7c3aed; margin-right: 4px;"></i> CONDUCTOR ASIGNADO *
                        </label>
                        <div class="searchable-select" id="swalComboboxEditCompChofer" style="position: relative;">
                            <input type="hidden" id="swalEditCompChoferVal" value="${choferActualId}">
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="searchEditCompChoferInput" placeholder="Buscar conductor asignado..." autocomplete="off" style="border-radius: 8px; height: 40px; font-size: 13.5px; font-weight: 600;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="dropdownEditCompChoferList" style="display: none; max-height: 180px; z-index: 99999;"></div>
                        </div>
                    </div>

                    <!-- Fila 3: Quesera / Compañía Destino (Searchable Combobox) -->
                    <div style="margin-bottom: 14px; position: relative; overflow: visible;">
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                            <i class="fa-solid fa-building" style="color: #7c3aed; margin-right: 4px;"></i> QUESERA / COMPAÑÍA DESTINO *
                        </label>
                        <div class="searchable-select" id="swalComboboxEditCompCompania" style="position: relative;">
                            <input type="hidden" id="swalEditCompCompaniaVal" value="${compActualId}">
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="searchEditCompCompaniaInput" placeholder="Buscar quesera / compañía destino..." autocomplete="off" style="border-radius: 8px; height: 40px; font-size: 13.5px; font-weight: 600;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="dropdownEditCompCompaniaList" style="display: none; max-height: 180px; z-index: 99999;"></div>
                        </div>
                    </div>

                    <!-- Fila 4: Litros Despachados y Litros Recibidos en Quesera -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-truck-arrow-right" style="color: #7c3aed; margin-right: 4px;"></i> LITROS DESPACHADOS *
                            </label>
                            <input id="swalEditCompLitrosDesp" type="number" class="form-input" value="${despachadosVal}" placeholder="Ej: 2160" style="width: 100%; height: 40px; font-size: 14px; font-weight: 800; color: #0f172a; border-radius: 8px; text-align: right; padding-right: 12px;">
                        </div>
                        <div>
                            <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-clipboard-check" style="color: #7c3aed; margin-right: 4px;"></i> RECIBIDO EN QUESERA
                            </label>
                            <input id="swalEditCompLitrosRecib" type="number" class="form-input" value="${recibidosVal}" placeholder="En tránsito..." style="width: 100%; height: 40px; font-size: 14px; font-weight: 800; color: #0f172a; border-radius: 8px; text-align: right; padding-right: 12px;">
                        </div>
                    </div>

                    <!-- Box de Variación / Merma en tiempo real -->
                    <div id="swalEditCompMermaBox" style="margin-bottom: 14px; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #f8fafc; display: flex; align-items: center; justify-content: space-between;">
                        <div style="font-size: 12px; font-weight: 600; color: #64748b;" id="swalEditCompMermaMsg">
                            Diferencia Salida vs Recepción Quesera
                        </div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #0f172a;" id="swalEditCompMermaValor">
                            --
                        </div>
                    </div>

                    <!-- Fila 5: Observación -->
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 5px;">
                            <i class="fa-solid fa-comment-dots" style="color: #7c3aed; margin-right: 4px;"></i> OBSERVACIÓN / TICKET DE PESAJE
                        </label>
                        <input id="swalEditCompObs" type="text" class="form-input" value="${obsVal}" placeholder="Nota u observación del despacho..." style="width: 100%; height: 40px; font-size: 13px; border-radius: 8px;">
                    </div>
                </div>
            `,
            didOpen: () => {
                window.actualizarSeleccionTipoLeche = (val) => {
                    const hidden = document.getElementById('swalEditCompTipoLeche');
                    if (hidden) hidden.value = val;
                    const badge = document.getElementById('badgeHeaderTipoLeche');
                    const lblVaca = document.getElementById('lblRadioTipoVaca');
                    const lblBuf = document.getElementById('lblRadioTipoBufala');
                    if (val === 'BUFALA') {
                        if (lblBuf) {
                            lblBuf.style.background = '#fae8ff';
                            lblBuf.style.borderColor = '#a21caf';
                            lblBuf.style.color = '#86198f';
                        }
                        if (lblVaca) {
                            lblVaca.style.background = '#ffffff';
                            lblVaca.style.borderColor = '#cbd5e1';
                            lblVaca.style.color = '#475569';
                        }
                        if (badge) {
                            badge.style.background = '#fae8ff';
                            badge.style.borderColor = '#f0abfc';
                            badge.style.color = '#a21caf';
                            badge.innerHTML = '🐃 BÚFALA';
                        }
                    } else {
                        if (lblVaca) {
                            lblVaca.style.background = '#dcfce7';
                            lblVaca.style.borderColor = '#16a34a';
                            lblVaca.style.color = '#15803d';
                        }
                        if (lblBuf) {
                            lblBuf.style.background = '#ffffff';
                            lblBuf.style.borderColor = '#cbd5e1';
                            lblBuf.style.color = '#475569';
                        }
                        if (badge) {
                            badge.style.background = '#ecfdf5';
                            badge.style.borderColor = '#86efac';
                            badge.style.color = '#15803d';
                            badge.innerHTML = '🐄 VACA';
                        }
                    }
                };

                const choferesOpciones = (state.choferes || []).map(c => ({
                    value: c.id || c.Id,
                    label: (c.nombreCompleto || c.NombreCompleto || c.username || `Chofer #${c.id}`).toUpperCase()
                }));

                const companiasOpciones = (state.companias || []).filter(c => {
                    const n = (c.nombre || c.Nombre || '').toUpperCase();
                    return !n.includes('RECEPTORIA') && !n.includes('RECEPTORÍA');
                }).map(c => ({
                    value: c.id || c.Id,
                    label: (c.nombre || c.Nombre || `Compañía #${c.id}`).toUpperCase()
                }));

                const cbChofer = setupCombobox({
                    containerId: 'swalComboboxEditCompChofer',
                    inputSearchId: 'searchEditCompChoferInput',
                    inputHiddenId: 'swalEditCompChoferVal',
                    dropdownId: 'dropdownEditCompChoferList',
                    placeholder: 'Buscar conductor asignado...',
                    getItemsFn: () => choferesOpciones
                });

                const cbCompania = setupCombobox({
                    containerId: 'swalComboboxEditCompCompania',
                    inputSearchId: 'searchEditCompCompaniaInput',
                    inputHiddenId: 'swalEditCompCompaniaVal',
                    dropdownId: 'dropdownEditCompCompaniaList',
                    placeholder: 'Buscar quesera / compañía destino...',
                    getItemsFn: () => companiasOpciones
                });

                if (choferActualId) {
                    const chObj = choferesOpciones.find(c => c.value == choferActualId);
                    if (chObj) cbChofer.selectItem(chObj.value, chObj.label);
                }

                if (compActualId) {
                    const compObj = companiasOpciones.find(c => c.value == compActualId);
                    if (compObj) cbCompania.selectItem(compObj.value, compObj.label);
                    else if (despacho.nombreCompania || despacho.companiaNombre) {
                        cbCompania.selectItem(compActualId, (despacho.nombreCompania || despacho.companiaNombre).toUpperCase());
                    }
                }

                // Cálculo en tiempo real de Diferencia
                const inpDesp = document.getElementById('swalEditCompLitrosDesp');
                const inpRecib = document.getElementById('swalEditCompLitrosRecib');
                const boxMerma = document.getElementById('swalEditCompMermaBox');
                const lblMsg = document.getElementById('swalEditCompMermaMsg');
                const lblVal = document.getElementById('swalEditCompMermaValor');

                const recalcDiferencia = () => {
                    const ltsDesp = parseFloat(inpDesp?.value) || 0;
                    const ltsRecib = parseFloat(inpRecib?.value);

                    if (isNaN(ltsRecib) || ltsRecib <= 0) {
                        boxMerma.style.background = '#f8fafc';
                        boxMerma.style.borderColor = '#cbd5e1';
                        lblMsg.style.color = '#64748b';
                        lblMsg.innerText = 'En tránsito (pendiente de recepción en quesera)';
                        lblVal.style.color = '#64748b';
                        lblVal.innerText = '--';
                        return;
                    }

                    const dif = ltsDesp - ltsRecib;
                    const pct = ltsDesp > 0 ? ((Math.abs(dif) / ltsDesp) * 100).toFixed(2) : '0.00';

                    if (dif === 0) {
                        boxMerma.style.background = '#f0fdf4';
                        boxMerma.style.borderColor = '#bbf7d0';
                        lblMsg.style.color = '#15803d';
                        lblMsg.innerText = 'Entrega 100% exacta sin variación';
                        lblVal.style.color = '#16a34a';
                        lblVal.innerText = '0 Lts (0.00%)';
                    } else if (dif > 0) {
                        boxMerma.style.background = '#fff7ed';
                        boxMerma.style.borderColor = '#fed7aa';
                        lblMsg.style.color = '#9a3412';
                        lblMsg.innerText = `Faltante en quesera: -${dif.toLocaleString('es-VE')} Lts`;
                        lblVal.style.color = '#ea580c';
                        lblVal.innerText = `-${dif.toLocaleString('es-VE')} Lts (${pct}%)`;
                    } else {
                        boxMerma.style.background = '#eff6ff';
                        boxMerma.style.borderColor = '#bfdbfe';
                        lblMsg.style.color = '#1e40af';
                        lblMsg.innerText = `Excedente en quesera: +${Math.abs(dif).toLocaleString('es-VE')} Lts`;
                        lblVal.style.color = '#2563eb';
                        lblVal.innerText = `+${Math.abs(dif).toLocaleString('es-VE')} Lts (${pct}%)`;
                    }
                };

                if (inpDesp) inpDesp.addEventListener('input', recalcDiferencia);
                if (inpRecib) inpRecib.addEventListener('input', recalcDiferencia);
                recalcDiferencia();
            },
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#7c3aed',
            cancelButtonColor: '#64748b',
            preConfirm: () => {
                const fecha = document.getElementById('swalEditCompFecha')?.value;
                const conductorId = parseInt(document.getElementById('swalEditCompChoferVal')?.value);
                const compId = parseInt(document.getElementById('swalEditCompCompaniaVal')?.value);
                const ltsDesp = parseInt(document.getElementById('swalEditCompLitrosDesp')?.value);
                const ltsRecibStr = document.getElementById('swalEditCompLitrosRecib')?.value;
                const estado = document.getElementById('swalEditCompEstado')?.value;
                const tipoLeche = document.querySelector('input[name="swalEditCompTipoLecheRadio"]:checked')?.value || document.getElementById('swalEditCompTipoLeche')?.value || 'VACA';
                const obs = document.getElementById('swalEditCompObs')?.value || '';

                if (!fecha) {
                    Swal.showValidationMessage('La fecha es obligatoria.');
                    return false;
                }
                if (!conductorId) {
                    Swal.showValidationMessage('Selecciona un conductor asignado.');
                    return false;
                }
                if (!compId) {
                    Swal.showValidationMessage('Selecciona la compañía / quesera destino.');
                    return false;
                }
                if (isNaN(ltsDesp) || ltsDesp <= 0) {
                    Swal.showValidationMessage('Los litros despachados deben ser mayores a 0.');
                    return false;
                }

                const payload = {
                    fecha: fecha,
                    usuarioId: conductorId,
                    companiaId: compId,
                    litrosDespachados: ltsDesp,
                    estado: estado,
                    tipoLeche: tipoLeche,
                    observacion: obs
                };

                if (ltsRecibStr !== '') {
                    payload.litrosRecibidosCompania = parseInt(ltsRecibStr);
                }

                return payload;
            }
        });

        if (!formValues) return;

        try {
            const res = await fetch(`${API_BASE}/control-companias/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                body: JSON.stringify(formValues)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al actualizar despacho');

            delete state.cacheTicketsViajes;
            showToast(`Ticket de Salida #${ticketId} actualizado exitosamente.`, 'success');
            const inpFiltroFechaEntregas = document.getElementById('filtroFechaEntregas');
            if (inpFiltroFechaEntregas && formValues.fecha) {
                inpFiltroFechaEntregas.value = formValues.fecha;
            }
            if (typeof cargarEntregasHoy === 'function') await cargarEntregasHoy();
            if (typeof cargarViajesRutasDelDia === 'function') await cargarViajesRutasDelDia(formValues.fecha);
            if (typeof cargarControlViajesTickets === 'function') await cargarControlViajesTickets();
            if (typeof cargarBandejaReceptoria === 'function') await cargarBandejaReceptoria();
            await refrescarVistasGlobales();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#ef4444' });
        }
    }
}
window.abrirModalEditarTicket = abrirModalEditarTicket;
window.cargarViajesRutasDelDia = cargarViajesRutasDelDia;

function toggleDetalleFincasTicket(ticketId) {
    const listDiv = document.getElementById(`listaFincasTicket_${ticketId}`);
    const chevron = document.getElementById(`chevronTicketFincas_${ticketId}`);
    if (!listDiv) return;

    if (listDiv.style.display === 'none') {
        listDiv.style.display = 'block';
        if (chevron) chevron.className = 'fa-solid fa-chevron-up';
        cargarFincasDeTicket(ticketId);
    } else {
        listDiv.style.display = 'none';
        if (chevron) chevron.className = 'fa-solid fa-chevron-down';
    }
}
window.toggleDetalleFincasTicket = toggleDetalleFincasTicket;

async function cargarFincasDeTicket(ticketId) {
    const listDiv = document.getElementById(`listaFincasTicket_${ticketId}`);
    if (!listDiv) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error('Error al consultar fincas');
        const fincas = await res.json();

        if (!fincas || fincas.length === 0) {
            listDiv.innerHTML = '<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 8px;">No hay fincas vinculadas a este viaje todavía.</div>';
            return;
        }

        listDiv.innerHTML = fincas.map(f => {
            const acidaTag = f.esAcida ? '<span class="badge badge-warning" style="font-size: 10px; padding: 1px 4px; margin-left: 4px;">Ácida</span>' : '';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12.5px;">
                    <div>
                        <strong style="color: #0f172a;">${f.fincaNombre}</strong>${acidaTag}
                        <div style="font-size: 11px; color: #64748b;">${f.propietario || ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: ${f.litros < 0 ? '#ef4444' : '#059669'};">${f.litros.toLocaleString('es-VE')} Lts</strong>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        listDiv.innerHTML = '<div style="font-size: 12px; color: #ef4444; text-align: center; padding: 8px;">Error al cargar fincas.</div>';
    }
}
window.cargarFincasDeTicket = cargarFincasDeTicket;

function abrirAgregarFincaViaje(ticketId) {
    state.ticketAsignadoActivo = ticketId;
    conmutarVistaRutas('fincas');
    const inputObs = document.getElementById('inputObservacion');
    if (inputObs) inputObs.placeholder = `Observación (Finca asociada a Ticket #${ticketId})`;
    const selectFincaInput = document.getElementById('searchFincaInput');
    if (selectFincaInput) selectFincaInput.focus();
    showToast(`Modo agregar finca a Ticket #${ticketId}`, 'info');
}
window.abrirAgregarFincaViaje = abrirAgregarFincaViaje;

function asignarTicketAModalMasivo(ticketId, conductorId) {
    state.ticketAsignadoActivo = ticketId;
    abrirModalRutasMasivo();
    if (conductorId && window.comboboxMasivoConductorInstance) {
        const cond = (state.choferes || []).find(c => (c.id || c.Id) == conductorId);
        if (cond) {
            window.comboboxMasivoConductorInstance.selectItem(conductorId, cond.nombreCompleto || cond.username);
        }
    }
}
window.asignarTicketAModalMasivo = asignarTicketAModalMasivo;

async function conmutarAFincasFiltradas(ticketId) {
    await filtrarRutasPorTicket(ticketId);
}
window.conmutarAFincasFiltradas = conmutarAFincasFiltradas;

async function filtrarRutasPorTicket(ticketId) {
    if (!ticketId) return;
    state.filtroTicketId = ticketId;
    state.rutasSearch = '';
    const searchInput = document.getElementById('inputBuscarRutasTabla');
    if (searchInput) searchInput.value = '';
    state.rutasPage = 1;
    conmutarVistaRutas('fincas');

    // Consultar SIEMPRE del servidor las fincas frescas y completas de este ticket
    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        let fincasTicket = [];
        if (res.ok) {
            fincasTicket = await res.json();
            if (state.user && state.user.rol === 'CHOFER') {
                const uid = state.user.id;
                fincasTicket = (fincasTicket || []).filter(r => (r.conductorId || r.usuarioId) == uid);
            }
        }

        // Buscar información del viaje para sincronizar fecha y chofer
        let viaje = (state.viajesDelDia || state.todosLosViajesReceptoria || state.cacheTicketsViajes?.todos || []).find(v => (v.id || v.Id) == ticketId);
        if (!viaje) {
            try {
                const resV = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
                if (resV.ok) viaje = await resV.json();
            } catch (e) {}
        }

        const fechaTicket = viaje?.fecha ? viaje.fecha.split('T')[0] : (fincasTicket[0]?.fecha ? fincasTicket[0].fecha.split('T')[0] : '');
        const condNombre = viaje?.nombreConductor || fincasTicket[0]?.conductorNombre || '';

        // Sincronizar fecha del ticket en los filtros
        if (fechaTicket) {
            state.rutasFechaFiltro = fechaTicket;
            const inputFecha = document.getElementById('filtroFechaRutas');
            if (inputFecha) inputFecha.value = fechaTicket;
            const inputFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
            if (inputFechaGlobal) inputFechaGlobal.value = fechaTicket;
            const inputFechaReg = document.getElementById('inputFechaRuta');
            if (inputFechaReg) inputFechaReg.value = fechaTicket;
        }

        // Sincronizar chofer del ticket en el combobox de filtro de la tabla
        initFiltrosComboboxes();
        if (condNombre) {
            if (comboboxFiltroChoferInstance) {
                comboboxFiltroChoferInstance.selectItem(condNombre, capitalizarTexto(condNombre));
            }
            const hid = document.getElementById('filterChoferVal');
            if (hid) hid.value = condNombre;
            const inp = document.getElementById('searchFiltroChoferInput');
            if (inp) inp.value = capitalizarTexto(condNombre);
        }

        // Bloquear y fijar Fecha y Conductor en el formulario de registro de rutas
        const condId = viaje?.conductorId || viaje?.usuarioId || (fincasTicket[0]?.conductorId || fincasTicket[0]?.usuarioId) || null;
        initRutasFormComboboxes();
        sincronizarBloqueoTicketFormulario(ticketId, fechaTicket, condId, condNombre);

        if (fincasTicket && fincasTicket.length > 0) {
            // Garantizar que cada finca tenga su controlRutaId para que el filtro de la tabla la muestre siempre
            fincasTicket.forEach(f => {
                if (!f.controlRutaId && !f.ControlRutaId) {
                    f.controlRutaId = ticketId;
                }
            });

            // Fusionar con state.rutas asegurando que todas las fincas de este ticket estén presentes
            const ticketIds = new Set(fincasTicket.map(f => f.id));
            const otras = (state.rutas || []).filter(r => !ticketIds.has(r.id));
            state.rutas = [...fincasTicket, ...otras];
        }
    } catch (err) {
        console.warn('Error al sincronizar fincas del ticket desde el servidor:', err);
    }

    renderTablaRutas();

    // Scroll suave hacia la tabla
    const cardTabla = document.getElementById('bannerFiltroTicketRutas');
    if (cardTabla) {
        cardTabla.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
window.filtrarRutasPorTicket = filtrarRutasPorTicket;

async function quitarFiltroTicketRutas() {
    state.filtroTicketId = null;
    const banner = document.getElementById('bannerFiltroTicketRutas');
    if (banner) banner.style.display = 'none';
    sincronizarBloqueoTicketFormulario(null);
    if (comboboxFiltroChoferInstance) {
        comboboxFiltroChoferInstance.selectItem('', '');
    }
    const inChofer = document.getElementById('searchFiltroChoferInput');
    if (inChofer) inChofer.value = '';
    const hidChofer = document.getElementById('filterChoferVal');
    if (hidChofer) hidChofer.value = '';
    state.rutasPage = 1;
    const fecha = document.getElementById('filtroFechaGlobalRutas')?.value || document.getElementById('filtroFechaRutas')?.value || state.rutasFechaFiltro || new Date().toISOString().split('T')[0];
    await cargarRutasHoy(fecha);
}
window.quitarFiltroTicketRutas = quitarFiltroTicketRutas;

function sincronizarBloqueoTicketFormulario(ticketId, fecha, conductorId, conductorNombre) {
    const inputFechaRuta = document.getElementById('inputRutaFecha') || document.getElementById('inputFechaRuta');
    const searchCond = document.getElementById('searchConductorInput');
    const selectCond = document.getElementById('selectRutaConductor');
    const chevronCond = document.querySelector('#comboboxConductor .combobox-chevron');
    const bannerActivo = document.getElementById('bannerTicketActivoForm');

    if (ticketId) {
        state.ticketAsignadoActivo = ticketId;

        // 1. Fecha del Ticket (Fija y Bloqueada)
        if (inputFechaRuta && fecha) {
            inputFechaRuta.value = fecha;
            inputFechaRuta.disabled = true;
            inputFechaRuta.style.background = '#f1f5f9';
            inputFechaRuta.style.cursor = 'not-allowed';
            inputFechaRuta.style.opacity = '0.85';
            inputFechaRuta.title = `Fecha fija según Ticket Activo #${ticketId}. Para cambiarla modifica el ticket.`;
        }

        // 2. Conductor del Ticket (Fijo y Bloqueado)
        let cId = conductorId;
        let cNom = conductorNombre;
        if (!cId && cNom) {
            const match = (state.choferes || []).find(c => (c.nombreCompleto || c.NombreCompleto || c.username || '').toLowerCase() === cNom.toLowerCase());
            if (match) cId = match.id || match.Id;
        } else if (cId && !cNom) {
            const match = (state.choferes || []).find(c => (c.id || c.Id) == cId);
            if (match) cNom = match.nombreCompleto || match.username;
        }

        if (comboboxConductorInstance && cId && cNom) {
            comboboxConductorInstance.selectItem(cId, capitalizarTexto(cNom));
        } else if (comboboxConductorInstance && cId) {
            comboboxConductorInstance.selectItem(cId, `Conductor #${cId}`);
        } else if (cNom && searchCond) {
            searchCond.value = capitalizarTexto(cNom);
            if (selectCond && cId) selectCond.value = cId;
        }

        if (searchCond) {
            searchCond.disabled = true;
            searchCond.style.background = '#f1f5f9';
            searchCond.style.cursor = 'not-allowed';
            searchCond.style.opacity = '0.85';
            searchCond.title = `Conductor fijo según Ticket Activo #${ticketId}. Para cambiarlo modifica el ticket.`;
        }
        if (chevronCond) {
            chevronCond.style.pointerEvents = 'none';
            chevronCond.style.opacity = '0.4';
        }

        // 3. Banner del Formulario
        if (bannerActivo) {
            bannerActivo.style.display = 'flex';
            const lblNum = document.getElementById('lblTicketActivoNumero');
            if (lblNum) lblNum.innerText = ticketId;
            const lblChofer = document.getElementById('lblTicketActivoChofer');
            if (lblChofer) lblChofer.innerText = cNom ? capitalizarTexto(cNom) : 'Conductor';
        }
    } else {
        // Desbloquear cuando NO hay ticket activo
        state.ticketAsignadoActivo = null;
        if (inputFechaRuta) {
            inputFechaRuta.disabled = false;
            inputFechaRuta.style.background = '';
            inputFechaRuta.style.cursor = '';
            inputFechaRuta.style.opacity = '1';
            inputFechaRuta.title = '';
        }
        if (searchCond) {
            const isAdmin = state.user && state.user.rol === 'ADMIN';
            searchCond.disabled = !isAdmin;
            searchCond.style.background = isAdmin ? '' : '#f1f5f9';
            searchCond.style.cursor = isAdmin ? '' : 'not-allowed';
            searchCond.style.opacity = isAdmin ? '1' : '0.85';
            searchCond.title = '';
        }
        if (chevronCond) {
            chevronCond.style.pointerEvents = '';
            chevronCond.style.opacity = '';
        }
        if (bannerActivo) {
            bannerActivo.style.display = 'none';
        }
    }
}
window.sincronizarBloqueoTicketFormulario = sincronizarBloqueoTicketFormulario;

function desvincularTicketActivoForm() {
    sincronizarBloqueoTicketFormulario(null);
    showToast('Ticket desvinculado del formulario. Las próximas recolecciones se asociarán al viaje del día.');
}
window.desvincularTicketActivoForm = desvincularTicketActivoForm;

function vincularTicketAlFormulario(ticketId) {
    if (!ticketId) return;
    state.ticketAsignadoActivo = ticketId;
    state.filtroTicketId = ticketId;

    // Buscar información del ticket en las rutas cargadas o en viajes
    const ticketRuta = (state.rutas || []).find(r => (r.controlRutaId || r.ControlRutaId) == ticketId) ||
                       (state.viajesDelDia || []).find(v => (v.id || v.Id) == ticketId);
    const fecha = ticketRuta?.fecha ? ticketRuta.fecha.split('T')[0] : (state.rutasFechaFiltro || '');
    const condNombre = ticketRuta?.conductorNombre || ticketRuta?.nombreConductor || state.user?.nombreCompleto || 'Conductor';
    const condId = ticketRuta?.conductorId || ticketRuta?.usuarioId || null;

    if (fecha) {
        state.rutasFechaFiltro = fecha;
        const inputFecha = document.getElementById('filtroFechaRutas');
        if (inputFecha) inputFecha.value = fecha;
        const inputFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
        if (inputFechaGlobal) inputFechaGlobal.value = fecha;
    }

    initRutasFormComboboxes();
    sincronizarBloqueoTicketFormulario(ticketId, fecha, condId, condNombre);

    initFiltrosComboboxes();
    if (condNombre) {
        if (comboboxFiltroChoferInstance) {
            comboboxFiltroChoferInstance.selectItem(condNombre, capitalizarTexto(condNombre));
        }
        const hidChofer = document.getElementById('filterChoferVal');
        if (hidChofer) hidChofer.value = condNombre;
        const inChofer = document.getElementById('searchFiltroChoferInput');
        if (inChofer) inChofer.value = capitalizarTexto(condNombre);
    }

    // Scroll hacia el formulario de captura
    const formCard = document.getElementById('formRegistroRuta')?.closest('.content-card') || document.getElementById('formRegistroRuta');
    if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
        const searchFinca = document.getElementById('searchFincaInput');
        if (searchFinca) searchFinca.focus();
    }, 400);

    showToast(`Ticket #${ticketId} vinculado y fijado al formulario. Ahora puedes agregar fincas a este viaje.`);
}
window.vincularTicketAlFormulario = vincularTicketAlFormulario;

function formatearFechaTicket(fechaStr) {
    if (!fechaStr) return 'Sin fecha';
    try {
        const clean = fechaStr.split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return clean;
    } catch(e) {
        return fechaStr;
    }
}
window.formatearFechaTicket = formatearFechaTicket;
