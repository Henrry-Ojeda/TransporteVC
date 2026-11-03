// =====================================================================
// MÓDULO DE HISTORIAL Y MANTENIMIENTO DE CAMIONES (ALERTAS PREVENTIVAS)
// =====================================================================

let _mantenimientosCache = [];
let _alertasMantenimientoCache = [];

async function cargarModuloMantenimiento() {
    await Promise.all([
        cargarAlertasMantenimiento(),
        cargarCamionesParaMantenimiento(),
        cargarMantenimientosLista()
    ]);
}
window.cargarModuloMantenimiento = cargarModuloMantenimiento;

async function cargarAlertasMantenimiento() {
    const contenedor = document.getElementById('contenedorAlertasMantenimiento');
    if (!contenedor) return;

    try {
        const res = await fetch(`${API_BASE}/mantenimiento-camiones/alertas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            contenedor.innerHTML = `<div class="card" style="padding: 20px; color: #ef4444;">Error al consultar alertas preventivas</div>`;
            return;
        }

        const data = await res.json();
        _alertasMantenimientoCache = data || [];
        renderTarjetasAlertas(_alertasMantenimientoCache);
    } catch (e) {
        console.error('Error cargando alertas de mantenimiento:', e);
        if (contenedor) contenedor.innerHTML = `<div class="card" style="padding: 20px; color: #ef4444;">Error de conexión con el servidor</div>`;
    }
}
window.cargarAlertasMantenimiento = cargarAlertasMantenimiento;

function renderTarjetasAlertas(alertas) {
    const contenedor = document.getElementById('contenedorAlertasMantenimiento');
    if (!contenedor) return;

    if (!alertas || alertas.length === 0) {
        contenedor.innerHTML = `<div class="card" style="padding: 20px; text-align: center; color: #94a3b8;">No hay alertas preventivas registradas</div>`;
        return;
    }

    let html = '';
    alertas.forEach(a => {
        const camionId = a.camionId ?? a.CamionId;
        const placa = a.placa || a.Placa || '';
        const marcaModelo = a.marcaModelo || a.MarcaModelo || '';
        const choferNombre = a.choferNombre || a.ChoferNombre || '';
        const kmActual = Number(a.odometroActualKm ?? a.OdometroActualKm ?? 0);
        const proxKm = (a.proximoKmSugerido ?? a.ProximoKmSugerido) ? Number(a.proximoKmSugerido ?? a.ProximoKmSugerido) : null;
        const kmRestantesRaw = a.kmRestantes ?? a.KmRestantes;
        const kmRestantes = (kmRestantesRaw !== null && kmRestantesRaw !== undefined) ? Number(kmRestantesRaw) : null;
        const diasRestantesRaw = a.diasRestantes ?? a.DiasRestantes;
        const diasRestantes = (diasRestantesRaw !== null && diasRestantesRaw !== undefined) ? Number(diasRestantesRaw) : null;

        let estadoAlerta = 'AL_DIA';
        let bgBadge = '#dcfce7';
        let colorBadge = '#15803d';
        let borderColor = '#86efac';
        let textoBadge = 'AL DÍA';

        if (kmRestantes !== null && kmRestantes <= 0) {
            estadoAlerta = 'VENCIDO';
            bgBadge = '#fee2e2';
            colorBadge = '#b91c1c';
            borderColor = '#fca5a5';
            textoBadge = 'VENCIDO / ATENCIÓN';
        } else if ((kmRestantes !== null && kmRestantes <= 1500) || (diasRestantes !== null && diasRestantes <= 15)) {
            estadoAlerta = 'PROXIMO';
            bgBadge = '#fef3c7';
            colorBadge = '#b45309';
            borderColor = '#fde68a';
            textoBadge = 'PRÓXIMO SERVICIO';
        }

        html += `
            <div class="card" style="padding: 18px; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.04); border-left: 5px solid ${colorBadge};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="badge badge-primary" style="font-family: monospace; font-size: 13px; font-weight: 800;">${placa}</span>
                            <strong style="color: #0f172a; font-size: 13.5px;">${marcaModelo || 'Cisterna'}</strong>
                        </div>
                        <small style="color: #64748b; font-size: 11.5px; display: block; margin-top: 2px;">Chofer: ${choferNombre || 'Sin asignar'}</small>
                    </div>
                    <span class="badge" style="background: ${bgBadge}; color: ${colorBadge}; border: 1px solid ${borderColor}; font-weight: 800; font-size: 11px;">
                        ${textoBadge}
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 8px;">
                    <div>
                        <span style="font-size: 11px; color: #64748b; font-weight: 600; display: block;">Odómetro Actual</span>
                        <strong style="font-size: 14px; color: #0284c7;">${kmActual.toLocaleString()} Km</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #64748b; font-weight: 600; display: block;">Próx. Servicio</span>
                        <strong style="font-size: 14px; color: ${colorBadge};">${proxKm ? proxKm.toLocaleString() + ' Km' : 'No definido'}</strong>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                    <span style="color: #475569;">
                        ${kmRestantes !== null 
                            ? (kmRestantes <= 0 ? `<strong style="color:#dc2626;">Excedido por ${Math.abs(kmRestantes).toLocaleString()} Km</strong>` : `Restan: <strong>${kmRestantes.toLocaleString()} Km</strong>`) 
                            : 'Sin registro previo'}
                    </span>
                    <button type="button" class="btn btn-outline" onclick="abrirModalCrearMantenimientoConCamion(${camionId}, ${kmActual})" style="padding: 3px 8px; font-size: 11px; border-color: #93c5fd; color: #2563eb;">
                        <i class="fa-solid fa-plus"></i> Servicio
                    </button>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

async function cargarCamionesParaMantenimiento() {
    const selFiltro = document.getElementById('filtroCamionMantenimiento');
    const selModal = document.getElementById('modalMantenimientoCamionId');
    if (!selFiltro || !selModal) return;

    try {
        if (!state.camiones || state.camiones.length === 0) {
            const res = await fetch(`${API_BASE}/camiones`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) state.camiones = await res.json();
        }

        const camiones = state.camiones || [];

        let htmlFiltro = '<option value="">-- Todos los Camiones --</option>';
        let htmlModal = '<option value="">-- Seleccionar Camión --</option>';

        camiones.forEach(c => {
            htmlFiltro += `<option value="${c.id}">${c.placa} (${c.marcaModelo || 'Cisterna'})</option>`;
            htmlModal += `<option value="${c.id}" data-km="${c.odometroActualKm || 0}">${c.placa} - ${c.marcaModelo || ''} (Km: ${c.odometroActualKm || 0})</option>`;
        });

        selFiltro.innerHTML = htmlFiltro;
        selModal.innerHTML = htmlModal;
    } catch (e) {
        console.warn('Error cargando camiones para mantenimiento:', e);
    }
}

async function cargarMantenimientosLista() {
    const tbody = document.getElementById('tbodyHistorialMantenimiento');
    if (!tbody) return;

    const camionId = document.getElementById('filtroCamionMantenimiento')?.value || '';
    const tipoEvento = document.getElementById('filtroTipoEventoMantenimiento')?.value || '';
    const estado = document.getElementById('filtroEstadoMantenimiento')?.value || '';

    let url = `${API_BASE}/mantenimiento-camiones?`;
    if (camionId) url += `&camionId=${encodeURIComponent(camionId)}`;
    if (tipoEvento) url += `&tipoEvento=${encodeURIComponent(tipoEvento)}`;
    if (estado) url += `&estado=${encodeURIComponent(estado)}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #ef4444;">Error al consultar bitácora</td></tr>`;
            return;
        }

        const data = await res.json();
        _mantenimientosCache = data || [];
        renderTablaMantenimiento(_mantenimientosCache);
    } catch (e) {
        console.error('Error cargando historial de mantenimiento:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #ef4444;">Error de conexión con el servidor</td></tr>`;
    }
}
window.cargarMantenimientosLista = cargarMantenimientosLista;

function renderTablaMantenimiento(items) {
    const tbody = document.getElementById('tbodyHistorialMantenimiento');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 30px; color: #94a3b8;">No se encontraron mantenimientos con los filtros seleccionados</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(m => {
        let badgeTipo = '';
        if (m.tipoEvento === 'CAMBIO_ACEITE') {
            badgeTipo = `<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 800; font-size: 11px; border: 1px solid #fde68a;"><i class="fa-solid fa-oil-can"></i> ACEITE</span>`;
        } else if (m.tipoEvento === 'CAUCHOS') {
            badgeTipo = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 11px; border: 1px solid #bae6fd;"><i class="fa-solid fa-circle-notch"></i> CAUCHOS</span>`;
        } else if (m.tipoEvento === 'PREVENTIVO') {
            badgeTipo = `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 800; font-size: 11px; border: 1px solid #bbf7d0;"><i class="fa-solid fa-shield-halved"></i> PREVENTIVO</span>`;
        } else if (m.tipoEvento === 'CORRECTIVO') {
            badgeTipo = `<span class="badge" style="background: #ffedd5; color: #c2410c; font-weight: 800; font-size: 11px; border: 1px solid #fed7aa;"><i class="fa-solid fa-screwdriver-wrench"></i> CORRECTIVO</span>`;
        } else {
            badgeTipo = `<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 800; font-size: 11px; border: 1px solid #fca5a5;"><i class="fa-solid fa-car-burst"></i> INCIDENTE</span>`;
        }

        let badgeEstado = '';
        if (m.estado === 'RESUELTO') {
            badgeEstado = `<span class="badge badge-success" style="font-size: 11px;"><i class="fa-solid fa-circle-check"></i> Resuelto</span>`;
        } else if (m.estado === 'EN_TALLER') {
            badgeEstado = `<span class="badge badge-warning" style="font-size: 11px;"><i class="fa-solid fa-clock"></i> En Taller</span>`;
        } else {
            badgeEstado = `<span class="badge badge-danger" style="font-size: 11px;"><i class="fa-solid fa-triangle-exclamation"></i> Pendiente</span>`;
        }

        const fechaStr = m.fechaEvento ? m.fechaEvento.split('T')[0] : '-';
        const odometroStr = m.odometroKm ? `${Number(m.odometroKm).toLocaleString()} Km` : '-';
        const proxKmStr = m.proximoKmSugerido ? `<br><small style="color:#059669; font-weight:700;">Próx: ${Number(m.proximoKmSugerido).toLocaleString()} Km</small>` : '';

        return `
            <tr>
                <td style="font-size: 12.5px; font-weight: 700; color: #334155;">${fechaStr}</td>
                <td style="text-align: center;">
                    <span class="badge badge-primary" style="font-family: monospace; font-size: 12.5px; font-weight: 800;">${m.camionPlaca}</span>
                </td>
                <td style="text-align: center;">${badgeTipo}</td>
                <td>
                    <strong style="color: #0f172a; font-size: 13.5px; display: block;">${m.titulo}</strong>
                    <small style="color: #64748b; font-size: 12px;">${m.descripcion || ''}</small>
                </td>
                <td style="text-align: right; font-weight: 700; color: #0284c7;">
                    ${odometroStr}
                    ${proxKmStr}
                </td>
                <td>
                    <span style="font-size: 12.5px; color: #334155; font-weight: 600;">${m.tallerOMecanico || '-'}</span>
                </td>
                <td style="text-align: right; font-weight: 800; color: #0f172a;">
                    $${Number(m.costoTotalUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 6px;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarMantenimiento(${m.id})" title="Editar" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="eliminarMantenimiento(${m.id}, '${m.titulo}')" title="Eliminar" style="padding: 4px 8px; font-size: 12px; border-color: #fecaca; color: #dc2626; background: #fef2f2;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------
// GESTIÓN DEL MODAL DE MANTENIMIENTO
// -------------------------------------------------------------
function abrirModalCrearMantenimiento() {
    document.getElementById('modalMantenimientoTitle').textContent = 'Registrar Mantenimiento';
    document.getElementById('modalMantenimientoId').value = '';
    document.getElementById('modalMantenimientoCamionId').value = '';
    document.getElementById('modalMantenimientoTipoEvento').value = 'CAMBIO_ACEITE';
    document.getElementById('modalMantenimientoTitulo').value = '';
    document.getElementById('modalMantenimientoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalMantenimientoOdometro').value = '';
    document.getElementById('modalMantenimientoProximoKm').value = '';
    document.getElementById('modalMantenimientoProximaFecha').value = '';
    document.getElementById('modalMantenimientoTaller').value = '';
    document.getElementById('modalMantenimientoCosto').value = '';
    document.getElementById('modalMantenimientoEstado').value = 'RESUELTO';
    document.getElementById('modalMantenimientoDescripcion').value = '';
    abrirModalCustom('modalMantenimientoCamion');
}
window.abrirModalCrearMantenimiento = abrirModalCrearMantenimiento;

function abrirModalCrearMantenimientoConCamion(camionId, kmActual) {
    abrirModalCrearMantenimiento();
    document.getElementById('modalMantenimientoCamionId').value = camionId;
    document.getElementById('modalMantenimientoOdometro').value = kmActual > 0 ? kmActual : '';
    sugerirProximoKm();
}
window.abrirModalCrearMantenimientoConCamion = abrirModalCrearMantenimientoConCamion;

function alCambiarCamionMantenimiento() {
    const sel = document.getElementById('modalMantenimientoCamionId');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.getAttribute('data-km')) {
        const km = parseFloat(opt.getAttribute('data-km')) || 0;
        document.getElementById('modalMantenimientoOdometro').value = km > 0 ? km : '';
        sugerirProximoKm();
    }
}
window.alCambiarCamionMantenimiento = alCambiarCamionMantenimiento;

function sugerirProximoKm() {
    const kmActual = parseFloat(document.getElementById('modalMantenimientoOdometro').value) || 0;
    const tipoEvento = document.getElementById('modalMantenimientoTipoEvento').value;
    const proximoKmInput = document.getElementById('modalMantenimientoProximoKm');

    if (kmActual <= 0) return;

    if (tipoEvento === 'CAMBIO_ACEITE') {
        proximoKmInput.value = kmActual + 10000;
    } else if (tipoEvento === 'CAUCHOS') {
        proximoKmInput.value = kmActual + 40000;
    } else if (tipoEvento === 'PREVENTIVO') {
        proximoKmInput.value = kmActual + 15000;
    }
}
window.sugerirProximoKm = sugerirProximoKm;

async function abrirModalEditarMantenimiento(id) {
    let m = _mantenimientosCache.find(x => x.id === id);
    if (!m) {
        try {
            const res = await fetch(`${API_BASE}/mantenimiento-camiones/${id}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) m = await res.json();
        } catch (e) {
            console.warn(e);
        }
    }

    if (!m) {
        Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se pudo localizar el evento seleccionado', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    document.getElementById('modalMantenimientoTitle').textContent = `Editar Mantenimiento #${m.id}`;
    document.getElementById('modalMantenimientoId').value = m.id;
    document.getElementById('modalMantenimientoCamionId').value = m.camionId;
    document.getElementById('modalMantenimientoTipoEvento').value = m.tipoEvento;
    document.getElementById('modalMantenimientoTitulo').value = m.titulo;
    document.getElementById('modalMantenimientoFecha').value = m.fechaEvento ? m.fechaEvento.split('T')[0] : '';
    document.getElementById('modalMantenimientoOdometro').value = m.odometroKm || '';
    document.getElementById('modalMantenimientoProximoKm').value = m.proximoKmSugerido || '';
    document.getElementById('modalMantenimientoProximaFecha').value = m.proximaFechaSugerida ? m.proximaFechaSugerida.split('T')[0] : '';
    document.getElementById('modalMantenimientoTaller').value = m.tallerOMecanico || '';
    document.getElementById('modalMantenimientoCosto').value = m.costoTotalUSD || '';
    document.getElementById('modalMantenimientoEstado').value = m.estado || 'RESUELTO';
    document.getElementById('modalMantenimientoDescripcion').value = m.descripcion || '';

    abrirModalCustom('modalMantenimientoCamion');
}
window.abrirModalEditarMantenimiento = abrirModalEditarMantenimiento;

async function guardarMantenimientoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalMantenimientoId').value;
    const camionId = parseInt(document.getElementById('modalMantenimientoCamionId').value);
    const tipoEvento = document.getElementById('modalMantenimientoTipoEvento').value;
    const titulo = document.getElementById('modalMantenimientoTitulo').value.trim();
    const fechaEvento = document.getElementById('modalMantenimientoFecha').value;
    const odometroKm = parseFloat(document.getElementById('modalMantenimientoOdometro').value) || null;
    const proximoKmSugerido = parseFloat(document.getElementById('modalMantenimientoProximoKm').value) || null;
    const proximaFechaVal = document.getElementById('modalMantenimientoProximaFecha').value;
    const proximaFechaSugerida = proximaFechaVal ? proximaFechaVal : null;
    const tallerOMecanico = document.getElementById('modalMantenimientoTaller').value.trim() || null;
    const costoTotalUSD = parseFloat(document.getElementById('modalMantenimientoCosto').value) || 0;
    const estado = document.getElementById('modalMantenimientoEstado').value;
    const descripcion = document.getElementById('modalMantenimientoDescripcion').value.trim();

    if (!camionId || !titulo || !fechaEvento) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Camión, título y fecha son obligatorios', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const payload = {
        camionId,
        tipoEvento,
        titulo,
        descripcion,
        fechaEvento,
        odometroKm,
        proximoKmSugerido,
        proximaFechaSugerida,
        tallerOMecanico,
        estado,
        costoTotalUSD
    };

    const isEdit = id && id !== '';
    const url = isEdit ? `${API_BASE}/mantenimiento-camiones/${id}` : `${API_BASE}/mantenimiento-camiones`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error procesando mantenimiento' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalMantenimientoCamion');
        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Mantenimiento Actualizado' : 'Mantenimiento Registrado',
            text: `El registro "${titulo}" fue guardado exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        cargarModuloMantenimiento();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarMantenimientoSubmit = guardarMantenimientoSubmit;

async function eliminarMantenimiento(id, titulo) {
    const result = await Swal.fire({
        title: '¿Eliminar registro?',
        text: `¿Desea eliminar la bitácora "${titulo}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/mantenimiento-camiones/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al eliminar' }));
            throw new Error(err.message);
        }

        Swal.fire({
            icon: 'success',
            title: 'Eliminado',
            text: 'Registro eliminado exitosamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        cargarModuloMantenimiento();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.eliminarMantenimiento = eliminarMantenimiento;
