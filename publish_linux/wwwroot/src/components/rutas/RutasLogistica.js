// ==========================================================================
// RUTAS LOGÍSTICAS Y PLANIFICACIÓN DE ZONAS (FRONTEND MODULE)
// ==========================================================================

var cacheRutasLogistica = {
    rutas: [],
    todasLasFincas: [],
    rutaActivaParaFincas: null,
    fincasSeleccionadasModal: new Set()
};
window.cacheRutasLogistica = cacheRutasLogistica;

/**
 * Carga el listado de rutas logísticas y sincroniza KPIs y selectores
 */
async function cargarRutasPlanificacion() {
    const tbody = document.getElementById('tbodyRutasPlanificacion');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 30px; color: #64748b;">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Cargando rutas logísticas...
                </td>
            </tr>`;
    }

    try {
        const [resRutas, resFincas] = await Promise.all([
            apiFetch('/rutas-logistica'),
            apiFetch('/catalogos/fincas')
        ]);

        if (resRutas.ok && Array.isArray(resRutas.data)) {
            cacheRutasLogistica.rutas = resRutas.data;
        } else {
            cacheRutasLogistica.rutas = [];
        }

        if (resFincas.ok && Array.isArray(resFincas.data)) {
            cacheRutasLogistica.todasLasFincas = resFincas.data;
        }

        actualizarKpisRutasPlan();
        renderTablaRutasPlan(cacheRutasLogistica.rutas);
        poblarSelectoresRutasLogistica();

    } catch (err) {
        console.error('Error cargando rutas logísticas:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 25px; color: #e11d48; font-weight: 700;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar las rutas logísticas.
                    </td>
                </tr>`;
        }
    }
}
window.cargarRutasPlanificacion = cargarRutasPlanificacion;

/**
 * Actualiza tarjetas de resumen superior (KPIs)
 */
function actualizarKpisRutasPlan() {
    const totalRutas = cacheRutasLogistica.rutas.filter(r => r.activo || r.Activo).length;
    const totalFincasAsignadas = cacheRutasLogistica.rutas.reduce((acc, r) => acc + (Number(r.totalFincasAsignadas || r.TotalFincasAsignadas) || 0), 0);
    const totalFincasGlobal = cacheRutasLogistica.todasLasFincas.length;
    const fincasSinRuta = Math.max(0, totalFincasGlobal - totalFincasAsignadas);

    const elKpiRutas = document.getElementById('kpiTotalRutasActivas');
    const elKpiAsig = document.getElementById('kpiTotalFincasEnRutas');
    const elKpiSin = document.getElementById('kpiTotalFincasSinRuta');
    const elLblTotal = document.getElementById('lblTotalRutasRegistradas');

    if (elKpiRutas) elKpiRutas.textContent = totalRutas;
    if (elKpiAsig) elKpiAsig.textContent = totalFincasAsignadas;
    if (elKpiSin) elKpiSin.textContent = fincasSinRuta;
    if (elLblTotal) elLblTotal.textContent = cacheRutasLogistica.rutas.length;
}

/**
 * Renderiza las filas en la tabla principal de rutas
 */
function renderTablaRutasPlan(rutas) {
    const tbody = document.getElementById('tbodyRutasPlanificacion');
    if (!tbody) return;

    if (!rutas || rutas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 36px 20px; color: #64748b;">
                    <i class="fa-solid fa-map-location-dot" style="font-size: 26px; display: block; margin-bottom: 8px; color: #94a3b8;"></i>
                    No se encontraron rutas logísticas registradas.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = rutas.map(r => {
        const id = r.id || r.Id;
        const cod = r.codigo || r.Codigo || '-';
        const nom = r.nombre || r.Nombre || 'Sin Nombre';
        const desc = r.descripcion || r.Descripcion || '<span style="color: #94a3b8; font-style: italic;">Sin descripción</span>';
        const col = r.color || r.Color || '#2563eb';
        const act = (r.activo !== undefined ? r.activo : r.Activo) !== false;
        const totalFincas = Number(r.totalFincasAsignadas || r.TotalFincasAsignadas) || 0;

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 14px 18px;">
                    <div style="width: 24px; height: 24px; border-radius: 6px; background: ${col}; box-shadow: 0 2px 5px rgba(0,0,0,0.15); border: 2px solid #ffffff;"></div>
                </td>
                <td style="padding: 14px 18px;">
                    <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${nom}</div>
                </td>
                <td style="padding: 14px 18px;">
                    <span style="font-family: monospace; font-size: 11.5px; font-weight: 700; background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 5px; border: 1px solid #e2e8f0;">
                        ${cod}
                    </span>
                </td>
                <td style="padding: 14px 18px; font-size: 12.5px; color: #475569; max-width: 280px;">
                    ${desc}
                </td>
                <td style="padding: 14px 18px; text-align: center;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; background: ${totalFincas > 0 ? '#ecfdf5' : '#fef2f2'}; color: ${totalFincas > 0 ? '#047857' : '#b91c1c'}; border: 1px solid ${totalFincas > 0 ? '#a7f3d0' : '#fecaca'};">
                        <i class="fa-solid fa-cow"></i> ${totalFincas} ${totalFincas === 1 ? 'finca' : 'fincas'}
                    </span>
                </td>
                <td style="padding: 14px 18px; text-align: center;">
                    <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: ${act ? '#eff6ff' : '#f1f5f9'}; color: ${act ? '#1d4ed8' : '#64748b'}; border: 1px solid ${act ? '#bfdbfe' : '#cbd5e1'};">
                        ${act ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                </td>
                <td style="padding: 14px 18px; text-align: right;">
                    <div style="display: inline-flex; gap: 6px; align-items: center;">
                        <button type="button" class="btn btn-sm" onclick="abrirModalAsignarFincas(${id}, '${nom.replace(/'/g, "\\'")}', '${col}')" title="Asignar fincas a esta ruta"
                            style="padding: 5px 12px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-list-check"></i> Fincas
                        </button>
                        <button type="button" class="btn btn-sm" onclick="abrirModalEditarRutaLogistica(${id})" title="Editar ruta"
                            style="padding: 5px 10px; font-size: 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #334155; cursor: pointer;">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn btn-sm" onclick="eliminarRutaLogistica(${id}, '${nom.replace(/'/g, "\\'")}')" title="Eliminar ruta"
                            style="padding: 5px 10px; font-size: 12px; border-radius: 6px; border: 1px solid #fecaca; background: #fff5f5; color: #e11d48; cursor: pointer;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarTablaRutasPlan(query) {
    query = (query || '').toLowerCase().trim();
    if (!query) {
        renderTablaRutasPlan(cacheRutasLogistica.rutas);
        return;
    }
    const filtradas = cacheRutasLogistica.rutas.filter(r => {
        const nom = (r.nombre || r.Nombre || '').toLowerCase();
        const cod = (r.codigo || r.Codigo || '').toLowerCase();
        const desc = (r.descripcion || r.Descripcion || '').toLowerCase();
        return nom.includes(query) || cod.includes(query) || desc.includes(query);
    });
    renderTablaRutasPlan(filtradas);
}
window.filtrarTablaRutasPlan = filtrarTablaRutasPlan;

/**
 * Pone al día los <select> de tickets con las rutas registradas
 */
async function poblarSelectoresRutasLogistica() {
    const selViaje = document.getElementById('selectIniciarViajeRutaLogistica');
    const selMasivo = document.getElementById('selectMasivoRutaLogistica');

    // Si aún no se han cargado las rutas en memoria, consultarlas a la API
    if (!cacheRutasLogistica.rutas || cacheRutasLogistica.rutas.length === 0) {
        try {
            const resRutas = await apiFetch('/rutas-logistica');
            if (resRutas.ok && Array.isArray(resRutas.data)) {
                cacheRutasLogistica.rutas = resRutas.data;
            }
        } catch (e) {
            console.warn('No se pudieron obtener las rutas logísticas para los selectores:', e);
        }
    }

    const opcionesHtml = `
        <option value="">-- SELECCIONE RUTA / ZONA --</option>
        ${(cacheRutasLogistica.rutas || []).filter(r => (r.activo !== undefined ? r.activo : r.Activo) !== false).map(r => {
            const id = r.id || r.Id;
            const nom = r.nombre || r.Nombre;
            const cant = Number(r.totalFincasAsignadas || r.TotalFincasAsignadas) || 0;
            return `<option value="${id}">${nom} (${cant} fincas)</option>`;
        }).join('')}
    `;

    if (selViaje) selViaje.innerHTML = opcionesHtml;
    if (selMasivo) {
        selMasivo.innerHTML = `
            <option value="">-- TODAS LAS FINCAS --</option>
            ${(cacheRutasLogistica.rutas || []).filter(r => (r.activo !== undefined ? r.activo : r.Activo) !== false).map(r => {
                const id = r.id || r.Id;
                const nom = r.nombre || r.Nombre;
                const cant = Number(r.totalFincasAsignadas || r.TotalFincasAsignadas) || 0;
                return `<option value="${id}">${nom} (${cant} fincas)</option>`;
            }).join('')}
        `;
    }
}
window.poblarSelectoresRutasLogistica = poblarSelectoresRutasLogistica;

/**
 * Modal Crear / Editar
 */
function abrirModalNuevaRutaLogistica() {
    document.getElementById('inputRutaId').value = '';
    document.getElementById('modalRutaFormTitulo').textContent = 'Nueva Ruta / Zona';
    document.getElementById('inputRutaNombre').value = '';
    document.getElementById('inputRutaCodigo').value = '';
    document.getElementById('inputRutaColor').value = '#2563eb';
    document.getElementById('lblRutaColorHex').textContent = '#2563eb';
    document.getElementById('inputRutaDescripcion').value = '';
    document.getElementById('checkRutaActiva').checked = true;

    const modal = document.getElementById('modalRutaLogisticaForm');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalNuevaRutaLogistica = abrirModalNuevaRutaLogistica;

function abrirModalEditarRutaLogistica(id) {
    const ruta = cacheRutasLogistica.rutas.find(r => Number(r.id || r.Id) === Number(id));
    if (!ruta) return;

    document.getElementById('inputRutaId').value = id;
    document.getElementById('modalRutaFormTitulo').textContent = `Editar Ruta: ${ruta.nombre || ruta.Nombre}`;
    document.getElementById('inputRutaNombre').value = ruta.nombre || ruta.Nombre || '';
    document.getElementById('inputRutaCodigo').value = ruta.codigo || ruta.Codigo || '';
    document.getElementById('inputRutaColor').value = ruta.color || ruta.Color || '#2563eb';
    document.getElementById('lblRutaColorHex').textContent = ruta.color || ruta.Color || '#2563eb';
    document.getElementById('inputRutaDescripcion').value = ruta.descripcion || ruta.Descripcion || '';
    document.getElementById('checkRutaActiva').checked = (ruta.activo !== undefined ? ruta.activo : ruta.Activo) !== false;

    const modal = document.getElementById('modalRutaLogisticaForm');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalEditarRutaLogistica = abrirModalEditarRutaLogistica;

// Sincronizar texto de color hex
document.addEventListener('DOMContentLoaded', () => {
    const cInput = document.getElementById('inputRutaColor');
    if (cInput) {
        cInput.addEventListener('input', (e) => {
            const lbl = document.getElementById('lblRutaColorHex');
            if (lbl) lbl.textContent = e.target.value;
        });
    }
});

async function guardarRutaLogistica(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('inputRutaId').value;
    const nombre = document.getElementById('inputRutaNombre').value.trim();
    let codigo = document.getElementById('inputRutaCodigo').value.trim();
    const color = document.getElementById('inputRutaColor').value;
    const descripcion = document.getElementById('inputRutaDescripcion').value.trim();
    const activo = document.getElementById('checkRutaActiva').checked;

    if (!nombre) {
        Swal.fire('Atención', 'El nombre de la ruta es obligatorio.', 'warning');
        return;
    }

    if (!codigo) {
        codigo = nombre.toUpperCase().replace(/\s+/g, '_');
    }

    const payload = { codigo, nombre, color, descripcion, activo };

    Swal.fire({
        title: 'Guardando...',
        text: 'Por favor espere...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const url = id ? `/rutas-logistica/${id}` : '/rutas-logistica';
    const method = id ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
        method,
        body: payload
    });

    if (res.ok) {
        cerrarModalCustom('modalRutaLogisticaForm');
        Swal.fire('¡Éxito!', id ? 'Ruta actualizada correctamente.' : 'Ruta creada exitosamente.', 'success');
        await cargarRutasPlanificacion();
    } else {
        Swal.fire('Error', res.error || 'No se pudo guardar la ruta logística.', 'error');
    }
}
window.guardarRutaLogistica = guardarRutaLogistica;

async function eliminarRutaLogistica(id, nombre) {
    const confirm = await Swal.fire({
        title: `¿Eliminar Ruta "${nombre}"?`,
        text: 'Las fincas que estaban asignadas quedarán desvinculadas.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e11d48'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'Eliminando...', didOpen: () => Swal.showLoading() });
    const res = await apiFetch(`/rutas-logistica/${id}`, { method: 'DELETE' });

    if (res.ok) {
        Swal.fire('Eliminada', 'La ruta logística fue eliminada exitosamente.', 'success');
        await cargarRutasPlanificacion();
    } else {
        Swal.fire('Error', res.error || 'No se pudo eliminar la ruta.', 'error');
    }
}
window.eliminarRutaLogistica = eliminarRutaLogistica;

/**
 * =====================================================================
 * ASIGNACIÓN DE FINCAS A RUTA
 * =====================================================================
 */
async function abrirModalAsignarFincas(rutaId, rutaNombre, rutaColor) {
    cacheRutasLogistica.rutaActivaParaFincas = rutaId;
    cacheRutasLogistica.fincasSeleccionadasModal.clear();

    const titulo = document.getElementById('modalAsignarRutaTitulo');
    const badgeCol = document.getElementById('modalAsignarColorBadge');
    if (titulo) titulo.textContent = `Asignar Fincas a Ruta: ${rutaNombre}`;
    if (badgeCol) badgeCol.style.background = rutaColor || '#2563eb';

    const wrapper = document.getElementById('listaFincasAsignarWrapper');
    if (wrapper) {
        wrapper.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #64748b;">
                <i class="fa-solid fa-spinner fa-spin"></i> Consultando fincas asociadas...
            </div>`;
    }

    const modal = document.getElementById('modalAsignarFincasRuta');
    if (modal) modal.style.display = 'flex';

    try {
        const res = await apiFetch(`/rutas-logistica/${rutaId}/fincas`);
        if (res.ok && Array.isArray(res.data)) {
            cacheRutasLogistica.fincasDeEstaRuta = res.data;
            res.data.forEach(f => {
                const fId = Number(f.id || f.Id);
                const asignada = Number(f.asignada || f.Asignada || 0) === 1;
                if (asignada) cacheRutasLogistica.fincasSeleccionadasModal.add(fId);
            });
            renderListaFincasAsignar(cacheRutasLogistica.fincasDeEstaRuta);
        } else {
            if (wrapper) wrapper.innerHTML = '<div style="color: #e11d48; text-align: center; padding: 20px;">Error al obtener fincas.</div>';
        }
    } catch (e) {
        console.error(e);
        if (wrapper) wrapper.innerHTML = '<div style="color: #e11d48; text-align: center; padding: 20px;">Error de conexión.</div>';
    }
}
window.abrirModalAsignarFincas = abrirModalAsignarFincas;

function renderListaFincasAsignar(fincas) {
    const wrapper = document.getElementById('listaFincasAsignarWrapper');
    if (!wrapper) return;

    actualizarContadorFincasSeleccionadas();

    if (!fincas || fincas.length === 0) {
        wrapper.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 30px;">No se encontraron fincas activas.</div>';
        return;
    }

    wrapper.innerHTML = fincas.map(f => {
        const id = Number(f.id || f.Id);
        const cod = f.codigo || f.Codigo || '-';
        const nom = f.nombre || f.Nombre || 'Finca';
        const prop = f.propietario || f.Propietario || '';
        const isChecked = cacheRutasLogistica.fincasSeleccionadasModal.has(id);

        return `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 9px; background: ${isChecked ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${isChecked ? '#86efac' : '#e2e8f0'}; cursor: pointer; transition: all 0.15s ease;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleFincaSeleccionadaModal(${id}, this.checked)"
                        style="width: 18px; height: 18px; accent-color: #059669; cursor: pointer;">
                    <div>
                        <div style="font-weight: 700; font-size: 13.5px; color: ${isChecked ? '#065f46' : '#0f172a'};">${nom}</div>
                        <div style="font-size: 11.5px; color: #64748b;">
                            <span style="font-family: monospace; font-weight: 600;">[${cod}]</span> ${prop ? '• ' + prop : ''}
                        </div>
                    </div>
                </div>
                <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; ${isChecked ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #64748b;'}">
                    ${isChecked ? 'EN ESTA RUTA' : 'NO ASIGNADA'}
                </span>
            </label>
        `;
    }).join('');
}

function toggleFincaSeleccionadaModal(id, checked) {
    id = Number(id);
    if (checked) {
        cacheRutasLogistica.fincasSeleccionadasModal.add(id);
    } else {
        cacheRutasLogistica.fincasSeleccionadasModal.delete(id);
    }
    renderListaFincasAsignar(cacheRutasLogistica.fincasDeEstaRuta);
}
window.toggleFincaSeleccionadaModal = toggleFincaSeleccionadaModal;

function marcarTodasFincasRuta(marcar) {
    if (!cacheRutasLogistica.fincasDeEstaRuta) return;
    if (marcar) {
        cacheRutasLogistica.fincasDeEstaRuta.forEach(f => cacheRutasLogistica.fincasSeleccionadasModal.add(Number(f.id || f.Id)));
    } else {
        cacheRutasLogistica.fincasSeleccionadasModal.clear();
    }
    renderListaFincasAsignar(cacheRutasLogistica.fincasDeEstaRuta);
}
window.marcarTodasFincasRuta = marcarTodasFincasRuta;

function filtrarListaFincasAsignar(query) {
    query = (query || '').toLowerCase().trim();
    if (!cacheRutasLogistica.fincasDeEstaRuta) return;
    if (!query) {
        renderListaFincasAsignar(cacheRutasLogistica.fincasDeEstaRuta);
        return;
    }
    const filtradas = cacheRutasLogistica.fincasDeEstaRuta.filter(f => {
        const nom = (f.nombre || f.Nombre || '').toLowerCase();
        const cod = (f.codigo || f.Codigo || '').toLowerCase();
        const prop = (f.propietario || f.Propietario || '').toLowerCase();
        return nom.includes(query) || cod.includes(query) || prop.includes(query);
    });
    renderListaFincasAsignar(filtradas);
}
window.filtrarListaFincasAsignar = filtrarListaFincasAsignar;

function actualizarContadorFincasSeleccionadas() {
    const el = document.getElementById('badgeContadorFincasSeleccionadas');
    if (el) {
        el.textContent = `${cacheRutasLogistica.fincasSeleccionadasModal.size} Seleccionadas`;
    }
}

async function guardarAsignacionFincasRuta() {
    const rutaId = cacheRutasLogistica.rutaActivaParaFincas;
    if (!rutaId) return;

    const fincaIds = Array.from(cacheRutasLogistica.fincasSeleccionadasModal);

    Swal.fire({
        title: 'Asignando Fincas...',
        text: 'Guardando vinculación de ruta...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const res = await apiFetch(`/rutas-logistica/${rutaId}/fincas`, {
        method: 'POST',
        body: { fincaIds }
    });

    if (res.ok) {
        cerrarModalCustom('modalAsignarFincasRuta');
        Swal.fire('¡Asignadas!', `${fincaIds.length} fincas asociadas exitosamente a la ruta.`, 'success');
        await cargarRutasPlanificacion();
    } else {
        Swal.fire('Error', res.error || 'No se pudieron asignar las fincas.', 'error');
    }
}
window.guardarAsignacionFincasRuta = guardarAsignacionFincasRuta;

/**
 * =====================================================================
 * INTEGRACIÓN CON APERTURA DE VIAJES Y TICKETS
 * =====================================================================
 */
async function onSeleccionarRutaLogisticaEnViaje(rutaId) {
    const info = document.getElementById('infoFincasRutaViaje');
    const lbl = document.getElementById('lblFincasRutaViaje');

    if (!rutaId) {
        if (info) info.style.display = 'none';
        return;
    }

    try {
        const res = await apiFetch(`/rutas-logistica/${rutaId}/fincas`);
        if (res.ok && Array.isArray(res.data)) {
            const asignadas = res.data.filter(f => Number(f.asignada || f.Asignada || 0) === 1);
            if (info && lbl) {
                lbl.textContent = `${asignadas.length} fincas asignadas a esta ruta para recolección.`;
                info.style.display = 'block';
            }
        }
    } catch(e) {
        console.error(e);
    }
}
window.onSeleccionarRutaLogisticaEnViaje = onSeleccionarRutaLogisticaEnViaje;

/**
 * Al cambiar de ruta en la Carga Masiva, filtrar la tabla/combobox de fincas
 */
async function onCambiarRutaMasivo(rutaId) {
    if (!rutaId) {
        // Restaurar todas las fincas
        if (typeof renderFilasFincasMasivo === 'function' && Array.isArray(state.fincas)) {
            renderFilasFincasMasivo(state.fincas);
        }
        return;
    }

    try {
        const res = await apiFetch(`/rutas-logistica/${rutaId}/fincas`);
        if (res.ok && Array.isArray(res.data)) {
            const fincasDeRuta = res.data.filter(f => Number(f.asignada || f.Asignada || 0) === 1);
            const fincaIds = new Set(fincasDeRuta.map(f => Number(f.id || f.Id)));

            if (typeof renderFilasFincasMasivo === 'function' && Array.isArray(state.fincas)) {
                const filtradas = state.fincas.filter(f => fincaIds.has(Number(f.id || f.Id)));
                renderFilasFincasMasivo(filtradas);
            }
        }
    } catch(e) {
        console.error(e);
    }
}
window.onCambiarRutaMasivo = onCambiarRutaMasivo;

// Cargar automáticamente las rutas cuando se entra a la pestaña rutas-planificacion
document.addEventListener('DOMContentLoaded', () => {
    // Si la pestaña activa al cargar es rutas-planificacion
    if (window.location.hash === '#rutas-planificacion') {
        cargarRutasPlanificacion();
    }
});
