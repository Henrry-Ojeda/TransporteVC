// =====================================================================
// MÓDULO DE GESTIÓN Y CONTROL DE COMBUSTIBLE
// =====================================================================

let _inventarioCombustibleCache = [];
let _historialCombustibleCache = [];

async function cargarModuloCombustible() {
    await Promise.all([
        cargarInventarioCombustible(),
        cargarCamionesParaCombustible(),
        cargarHistorialCombustible()
    ]);
}
window.cargarModuloCombustible = cargarModuloCombustible;

async function cargarInventarioCombustible() {
    const contenedor = document.getElementById('contenedorTanquesCombustible');
    if (!contenedor) return;

    try {
        const res = await fetch(`${API_BASE}/combustible/inventario`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            contenedor.innerHTML = `<div class="card" style="padding: 20px; color: #ef4444;">Error al cargar tanques de combustible</div>`;
            return;
        }

        const data = await res.json();
        _inventarioCombustibleCache = data || [];

        renderTanquesCombustible(_inventarioCombustibleCache);
    } catch (e) {
        console.error('Error cargando inventario combustible:', e);
        if (contenedor) contenedor.innerHTML = `<div class="card" style="padding: 20px; color: #ef4444;">Error de conexión con el servidor</div>`;
    }
}
window.cargarInventarioCombustible = cargarInventarioCombustible;

function renderTanquesCombustible(tanques) {
    const contenedor = document.getElementById('contenedorTanquesCombustible');
    if (!contenedor) return;

    if (!tanques || tanques.length === 0) {
        contenedor.innerHTML = `<div class="card" style="padding: 20px; text-align: center; color: #94a3b8;">No hay tanques registrados</div>`;
        return;
    }

    let html = '';
    tanques.forEach(t => {
        const stock = Number(t.stockActualLitros || 0);
        const cap = Number(t.capacidadTanqueAlmacen || 1);
        const pct = Math.min(100, Math.max(0, Math.round((stock / cap) * 100)));

        let colorBarra = '#0284c7';
        let bgBadge = '#e0f2fe';
        let colorBadge = '#0369a1';
        let estadoTxt = 'Nivel Óptimo';

        if (pct <= 15) {
            colorBarra = '#ef4444';
            bgBadge = '#fee2e2';
            colorBadge = '#b91c1c';
            estadoTxt = 'CRÍTICO';
        } else if (pct <= 30) {
            colorBarra = '#f59e0b';
            bgBadge = '#fef3c7';
            colorBadge = '#b45309';
            estadoTxt = 'BAJO';
        }

        const icono = t.tipoCombustible === 'GASOLINA' ? 'fa-gas-pump' : 'fa-oil-well';

        html += `
            <div class="card" style="padding: 22px; border-radius: 14px; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.04); border-top: 4px solid ${colorBarra};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 10px; background: ${bgBadge}; color: ${colorBadge}; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            <i class="fa-solid ${icono}"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a;">Tanque ${t.tipoCombustible}</h3>
                            <span style="font-size: 12px; color: #64748b; font-weight: 600;">Capacidad: ${cap.toLocaleString()} L</span>
                        </div>
                    </div>
                    <span class="badge" style="background: ${bgBadge}; color: ${colorBadge}; font-weight: 800; font-size: 11px; padding: 5px 10px; border-radius: 6px;">
                        ${estadoTxt}
                    </span>
                </div>

                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                        <span style="font-size: 28px; font-weight: 900; color: #0f172a; font-family: monospace;">
                            ${stock.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <small style="font-size: 15px; font-weight: 700; color: #64748b;">L</small>
                        </span>
                        <span style="font-size: 15px; font-weight: 800; color: ${colorBarra};">
                            ${pct}%
                        </span>
                    </div>

                    <!-- BARRA DE PROGRESO -->
                    <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: ${colorBarra}; border-radius: 999px; transition: width 0.6s ease;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #94a3b8; font-weight: 600; padding-top: 6px; border-top: 1px dashed #f1f5f9;">
                    <span>Disponible: ${(cap - stock).toLocaleString()} L</span>
                    <span>Actualizado: ${t.updatedAt ? new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}</span>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

async function cargarCamionesParaCombustible() {
    const selFiltro = document.getElementById('filtroCamionCombustible');
    const selModal = document.getElementById('modalDespachoCamionId');
    if (!selFiltro || !selModal) return;

    try {
        if (!state.camiones || state.camiones.length === 0) {
            const res = await fetch(`${API_BASE}/camiones`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) state.camiones = await res.json();
        }

        const camiones = state.camiones || [];

        // Llenar filtro
        let htmlFiltro = '<option value="">-- Todos los Camiones --</option>';
        let htmlModal = '<option value="">-- Seleccionar Camión --</option>';

        camiones.forEach(c => {
            const label = `${c.placa} ${c.marcaModelo ? `(${c.marcaModelo})` : ''} - Chofer: ${c.choferNombre || 'Sin asignar'}`;
            htmlFiltro += `<option value="${c.id}">${label}</option>`;
            htmlModal += `<option value="${c.id}" data-tanque="${c.capacidadTanqueLitros || 0}" data-combustible="${c.tipoCombustible || 'GASOIL'}" data-odometro="${c.odometroActualKm || 0}">${c.placa} (${c.capacidadTanqueLitros || 0}L) - ${c.choferNombre || 'Sin asignar'}</option>`;
        });

        selFiltro.innerHTML = htmlFiltro;
        selModal.innerHTML = htmlModal;
    } catch (e) {
        console.warn('Error cargando camiones para combustible:', e);
    }
}

async function cargarHistorialCombustible() {
    const tbody = document.getElementById('tbodyHistorialCombustible');
    if (!tbody) return;

    const tipoComb = document.getElementById('filtroTipoCombustible')?.value || '';
    const camionId = document.getElementById('filtroCamionCombustible')?.value || '';
    const tipoMov = document.getElementById('filtroTipoMovCombustible')?.value || '';

    let url = `${API_BASE}/combustible/historial?top=150`;
    if (tipoComb) url += `&tipoCombustible=${encodeURIComponent(tipoComb)}`;
    if (camionId) url += `&camionId=${encodeURIComponent(camionId)}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #ef4444;">Error al cargar historial</td></tr>`;
            return;
        }

        let data = await res.json();
        if (tipoMov) {
            data = data.filter(d => d.tipoMovimiento === tipoMov);
        }

        _historialCombustibleCache = data || [];
        renderTablaHistorialCombustible(_historialCombustibleCache);
    } catch (e) {
        console.error('Error cargando historial de combustible:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #ef4444;">Error de conexión con el servidor</td></tr>`;
    }
}
window.cargarHistorialCombustible = cargarHistorialCombustible;

function renderTablaHistorialCombustible(items) {
    const tbody = document.getElementById('tbodyHistorialCombustible');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 30px; color: #94a3b8;">No se registraron movimientos con los filtros seleccionados</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(m => {
        let badgeTipo = '';
        if (m.tipoMovimiento === 'DESPACHO_CAMION') {
            badgeTipo = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid #bae6fd;"><i class="fa-solid fa-truck-droplet"></i> DESPACHO</span>`;
        } else if (m.tipoMovimiento === 'COMPRA_INGRESO') {
            badgeTipo = `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid #bbf7d0;"><i class="fa-solid fa-cart-plus"></i> COMPRA</span>`;
        } else {
            badgeTipo = `<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid #fde68a;"><i class="fa-solid fa-sliders"></i> AJUSTE</span>`;
        }

        const fechaStr = m.fecha ? m.fecha.split('T')[0] : (m.createdAt ? m.createdAt.split('T')[0] : '-');
        const litrosFormateados = Number(m.litros || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        const stockNuevoFormateado = Number(m.stockNuevoLitros || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        const destinoCamion = m.camionPlaca
            ? `<div style="display: flex; align-items: center; gap: 6px;">
                <span class="badge badge-primary" style="font-family: monospace; font-size: 12px; font-weight: 800;">${m.camionPlaca}</span>
                <span style="font-size: 12.5px; font-weight: 600; color: #334155;">${m.choferNombre || ''}</span>
               </div>`
            : `<span style="color: #94a3b8; font-size: 12px;">Tanque Base Operativa</span>`;

        const odometroStr = m.odometroKm && m.odometroKm > 0
            ? `<strong style="color: #0284c7; font-size: 12.5px;">${Number(m.odometroKm).toLocaleString()} Km</strong>`
            : `<span style="color: #cbd5e1;">-</span>`;

        const detalles = m.proveedor
            ? `<span style="font-weight: 600; color: #0f172a;">${m.proveedor}</span>${m.costoPorLitroUSD > 0 ? ` <small style="color: #059669; font-weight: 700;">($${m.costoPorLitroUSD}/L)</small>` : ''}`
            : (m.observaciones || '-');

        return `
            <tr>
                <td style="font-size: 12.5px; font-weight: 700; color: #334155;">${fechaStr}</td>
                <td style="text-align: center;">${badgeTipo}</td>
                <td style="text-align: center;">
                    <span class="badge" style="background: #f1f5f9; color: #334155; font-weight: 700; font-size: 11.5px;">${m.tipoCombustible}</span>
                </td>
                <td style="text-align: right;">
                    <strong style="color: ${m.tipoMovimiento === 'COMPRA_INGRESO' ? '#059669' : '#0284c7'}; font-size: 14px; font-weight: 800;">
                        ${m.tipoMovimiento === 'COMPRA_INGRESO' ? '+' : '-'}${litrosFormateados} L
                    </strong>
                </td>
                <td style="text-align: right; font-weight: 700; color: #475569;">${stockNuevoFormateado} L</td>
                <td>${destinoCamion}</td>
                <td style="text-align: right;">${odometroStr}</td>
                <td style="font-size: 12.5px; color: #475569;">${detalles}</td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------
// MODAL: REGISTRAR COMPRA
// -------------------------------------------------------------
function abrirModalCompraCombustible() {
    document.getElementById('modalCompraFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalCompraLitros').value = '';
    document.getElementById('modalCompraCostoUSD').value = '';
    document.getElementById('modalCompraProveedor').value = '';
    document.getElementById('modalCompraObservaciones').value = '';
    abrirModalCustom('modalCompraCombustible');
}
window.abrirModalCompraCombustible = abrirModalCompraCombustible;

async function guardarCompraCombustibleSubmit(e) {
    e.preventDefault();
    const tipoCombustible = document.getElementById('modalCompraTipoCombustible').value;
    const fecha = document.getElementById('modalCompraFecha').value;
    const litros = parseFloat(document.getElementById('modalCompraLitros').value) || 0;
    const costoPorLitroUSD = parseFloat(document.getElementById('modalCompraCostoUSD').value) || 0;
    const proveedor = document.getElementById('modalCompraProveedor').value.trim() || null;
    const observaciones = document.getElementById('modalCompraObservaciones').value.trim() || null;

    if (litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Litros requeridos', text: 'Debe ingresar una cantidad de litros mayor a 0', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/combustible/compra`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                tipoCombustible,
                litros,
                costoPorLitroUSD,
                proveedor,
                observaciones,
                fecha
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error registrando compra' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalCompraCombustible');
        Swal.fire({
            icon: 'success',
            title: 'Recarga Registrada',
            text: `Se ingresaron ${litros.toLocaleString()} L de ${tipoCombustible} al tanque.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        cargarModuloCombustible();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarCompraCombustibleSubmit = guardarCompraCombustibleSubmit;

// -------------------------------------------------------------
// MODAL: DESPACHAR A CAMIÓN
// -------------------------------------------------------------
function abrirModalDespachoCombustible() {
    document.getElementById('modalDespachoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalDespachoLitros').value = '';
    document.getElementById('modalDespachoOdometro').value = '';
    document.getElementById('modalDespachoObservaciones').value = '';
    document.getElementById('modalDespachoInfoCamion').textContent = '';
    document.getElementById('modalDespachoCamionId').value = '';
    abrirModalCustom('modalDespachoCombustible');
}
window.abrirModalDespachoCombustible = abrirModalDespachoCombustible;

function alSeleccionarCamionDespacho() {
    const sel = document.getElementById('modalDespachoCamionId');
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
        document.getElementById('modalDespachoInfoCamion').textContent = '';
        return;
    }

    const tanque = opt.getAttribute('data-tanque') || 0;
    const combustible = opt.getAttribute('data-combustible') || 'GASOIL';
    const odometro = opt.getAttribute('data-odometro') || 0;

    document.getElementById('modalDespachoTipoCombustible').value = combustible;
    document.getElementById('modalDespachoOdometro').value = odometro > 0 ? odometro : '';
    document.getElementById('modalDespachoInfoCamion').textContent = `Tanque del camión: ${tanque} L | Tipo asignado: ${combustible} | Odómetro registrado: ${Number(odometro).toLocaleString()} Km`;
}
window.alSeleccionarCamionDespacho = alSeleccionarCamionDespacho;

async function guardarDespachoCombustibleSubmit(e) {
    e.preventDefault();
    const camionId = parseInt(document.getElementById('modalDespachoCamionId').value);
    const tipoCombustible = document.getElementById('modalDespachoTipoCombustible').value;
    const fecha = document.getElementById('modalDespachoFecha').value;
    const litros = parseFloat(document.getElementById('modalDespachoLitros').value) || 0;
    const odometroKm = parseFloat(document.getElementById('modalDespachoOdometro').value) || null;
    const observaciones = document.getElementById('modalDespachoObservaciones').value.trim() || null;

    if (!camionId) {
        Swal.fire({ icon: 'warning', title: 'Camión Requerido', text: 'Debe seleccionar un camión', background: '#1e293b', color: '#f8fafc' });
        return;
    }
    if (litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Litros Requeridos', text: 'Debe ingresar una cantidad mayor a 0', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/combustible/despacho`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                camionId,
                tipoCombustible,
                litros,
                odometroKm,
                observaciones,
                fecha
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al despachar combustible' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalDespachoCombustible');
        Swal.fire({
            icon: 'success',
            title: 'Despacho Exitoso',
            text: `Se suministraron ${litros.toLocaleString()} L de ${tipoCombustible} al camión.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        cargarModuloCombustible();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error en Despacho', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarDespachoCombustibleSubmit = guardarDespachoCombustibleSubmit;

// -------------------------------------------------------------
// MODAL: AJUSTE DE STOCK
// -------------------------------------------------------------
function abrirModalAjusteCombustible() {
    document.getElementById('modalAjusteNuevoStock').value = '';
    document.getElementById('modalAjusteMotivo').value = '';
    abrirModalCustom('modalAjusteCombustible');
}
window.abrirModalAjusteCombustible = abrirModalAjusteCombustible;

async function guardarAjusteCombustibleSubmit(e) {
    e.preventDefault();
    const tipoCombustible = document.getElementById('modalAjusteTipoCombustible').value;
    const nuevoStock = parseFloat(document.getElementById('modalAjusteNuevoStock').value);
    const motivo = document.getElementById('modalAjusteMotivo').value.trim();

    if (isNaN(nuevoStock) || nuevoStock < 0) {
        Swal.fire({ icon: 'warning', title: 'Stock Inválido', text: 'Debe ingresar un valor numérico válido mayor o igual a 0', background: '#1e293b', color: '#f8fafc' });
        return;
    }
    if (!motivo) {
        Swal.fire({ icon: 'warning', title: 'Motivo Requerido', text: 'Debe indicar el motivo del ajuste', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/combustible/ajuste`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                tipoCombustible,
                nuevoStock,
                motivo
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error aplicando ajuste' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalAjusteCombustible');
        Swal.fire({
            icon: 'success',
            title: 'Ajuste Aplicado',
            text: `El stock de ${tipoCombustible} se actualizó a ${nuevoStock.toLocaleString()} L.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        cargarModuloCombustible();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarAjusteCombustibleSubmit = guardarAjusteCombustibleSubmit;
