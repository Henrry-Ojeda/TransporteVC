// =====================================================================
// MÓDULO DE INVENTARIO DE REPUESTOS Y KÁRDEX DE ALMACÉN
// =====================================================================

let _repuestosCache = [];
let _movimientosRepuestosCache = [];

async function cargarModuloRepuestos() {
    await Promise.all([
        cargarRepuestosLista(),
        cargarCamionesParaRepuestos(),
        cargarMovimientosRepuestosLista()
    ]);
}
window.cargarModuloRepuestos = cargarModuloRepuestos;

function cambiarSubtabRepuestos(subtab) {
    const btnCat = document.getElementById('btnSubtabCatalogoRepuestos');
    const btnMov = document.getElementById('btnSubtabMovimientosRepuestos');
    const tabCat = document.getElementById('subtabCatalogoRepuestos');
    const tabMov = document.getElementById('subtabMovimientosRepuestos');

    if (subtab === 'catalogo') {
        btnCat.className = 'btn btn-primary';
        btnMov.className = 'btn btn-outline';
        tabCat.style.display = 'block';
        tabMov.style.display = 'none';
    } else {
        btnCat.className = 'btn btn-outline';
        btnMov.className = 'btn btn-primary';
        tabCat.style.display = 'none';
        tabMov.style.display = 'block';
        cargarMovimientosRepuestosLista();
    }
}
window.cambiarSubtabRepuestos = cambiarSubtabRepuestos;

async function cargarRepuestosLista() {
    const tbody = document.getElementById('tbodyCatalogoRepuestos');
    if (!tbody) return;

    const categoria = document.getElementById('filtroCategoriaRepuesto')?.value || '';
    let url = `${API_BASE}/repuestos?soloActivos=true`;
    if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #ef4444;">Error al consultar catálogo</td></tr>`;
            return;
        }

        const data = await res.json();
        _repuestosCache = data || [];

        // Actualizar KPIs
        actualizarKpisRepuestos(_repuestosCache);

        // Llenar selectores dependientes
        poblarSelectoresRepuestos(_repuestosCache);

        renderTablaRepuestos(_repuestosCache);
    } catch (e) {
        console.error('Error cargando repuestos:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #ef4444;">Error de conexión con el servidor</td></tr>`;
    }
}
window.cargarRepuestosLista = cargarRepuestosLista;

function actualizarKpisRepuestos(items) {
    const lblTotal = document.getElementById('kpiTotalRepuestos');
    const lblBajo = document.getElementById('kpiStockBajoRepuestos');
    const lblVal = document.getElementById('kpiValorizadoAlmacen');

    if (!lblTotal) return;

    const total = items.length;
    let bajoStock = 0;
    let valorTotal = 0;

    items.forEach(r => {
        const stock = Number(r.stockActual || 0);
        const min = Number(r.stockMinimo || 0);
        const costo = Number(r.costoUnitarioUSD || 0);

        if (stock <= min) bajoStock++;
        valorTotal += (stock * costo);
    });

    lblTotal.textContent = total.toLocaleString();
    lblBajo.textContent = bajoStock.toLocaleString();
    lblVal.textContent = `$${valorTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function poblarSelectoresRepuestos(items) {
    const selModal = document.getElementById('modalMovimientoRepuestoId');
    const selFiltro = document.getElementById('filtroMovRepuestoId');

    if (selModal) {
        let htmlModal = '<option value="">-- Seleccionar Repuesto --</option>';
        items.forEach(r => {
            htmlModal += `<option value="${r.id}" data-stock="${r.stockActual || 0}" data-costo="${r.costoUnitarioUSD || 0}">[${r.codigo}] ${r.nombre} (Stock: ${r.stockActual || 0})</option>`;
        });
        selModal.innerHTML = htmlModal;
    }

    if (selFiltro) {
        let htmlFiltro = '<option value="">-- Todos los Repuestos --</option>';
        items.forEach(r => {
            htmlFiltro += `<option value="${r.id}">[${r.codigo}] ${r.nombre}</option>`;
        });
        selFiltro.innerHTML = htmlFiltro;
    }
}

function filtrarTablaRepuestos() {
    const busq = (document.getElementById('buscarRepuestoInput')?.value || '').trim().toLowerCase();
    if (!busq) {
        renderTablaRepuestos(_repuestosCache);
        return;
    }

    const filtrados = _repuestosCache.filter(r => 
        (r.codigo && r.codigo.toLowerCase().includes(busq)) ||
        (r.nombre && r.nombre.toLowerCase().includes(busq)) ||
        (r.categoria && r.categoria.toLowerCase().includes(busq)) ||
        (r.ubicacionAlmacen && r.ubicacionAlmacen.toLowerCase().includes(busq))
    );

    renderTablaRepuestos(filtrados);
}
window.filtrarTablaRepuestos = filtrarTablaRepuestos;

function renderTablaRepuestos(items) {
    const tbody = document.getElementById('tbodyCatalogoRepuestos');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 30px; color: #94a3b8;">No hay repuestos registrados</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(r => {
        const stock = Number(r.stockActual || 0);
        const min = Number(r.stockMinimo || 1);

        let stockBadge = '';
        if (stock <= 0) {
            stockBadge = `<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 800; font-size: 12px; padding: 4px 8px; border: 1px solid #fca5a5;"><i class="fa-solid fa-triangle-exclamation"></i> 0 AGOTADO</span>`;
        } else if (stock <= min) {
            stockBadge = `<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 800; font-size: 12px; padding: 4px 8px; border: 1px solid #fde68a;">${stock} BAJO STOCK</span>`;
        } else {
            stockBadge = `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 800; font-size: 12px; padding: 4px 8px; border: 1px solid #86efac;">${stock} DISPONIBLE</span>`;
        }

        return `
            <tr>
                <td>
                    <span class="badge" style="background: #f1f5f9; color: #0f172a; font-family: monospace; font-size: 12.5px; font-weight: 800; border: 1px solid #cbd5e1;">${r.codigo}</span>
                </td>
                <td>
                    <strong style="color: #0f172a; font-size: 13.5px; display: block;">${r.nombre}</strong>
                </td>
                <td style="text-align: center;">
                    <span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11.5px;">${r.categoria}</span>
                </td>
                <td style="text-align: right;">${stockBadge}</td>
                <td style="text-align: right; font-weight: 700; color: #64748b;">${min} u</td>
                <td style="text-align: right; font-weight: 800; color: #0f172a;">
                    $${Number(r.costoUnitarioUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td><span style="font-size: 12.5px; color: #475569;">${r.ubicacionAlmacen || '-'}</span></td>
                <td style="text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 6px;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarRepuesto(${r.id})" title="Editar" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="eliminarRepuesto(${r.id}, '${r.nombre}')" title="Desactivar" style="padding: 4px 8px; font-size: 12px; border-color: #fecaca; color: #dc2626; background: #fef2f2;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function cargarCamionesParaRepuestos() {
    const selModal = document.getElementById('modalMovimientoCamionId');
    const selFiltro = document.getElementById('filtroMovCamionId');
    if (!selModal || !selFiltro) return;

    try {
        if (!state.camiones || state.camiones.length === 0) {
            const res = await fetch(`${API_BASE}/camiones`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) state.camiones = await res.json();
        }

        const camiones = state.camiones || [];

        let htmlModal = '<option value="">-- Seleccionar Camión --</option>';
        let htmlFiltro = '<option value="">-- Todos los Camiones --</option>';

        camiones.forEach(c => {
            const label = `${c.placa} ${c.marcaModelo ? `(${c.marcaModelo})` : ''}`;
            htmlModal += `<option value="${c.id}">${label}</option>`;
            htmlFiltro += `<option value="${c.id}">${label}</option>`;
        });

        selModal.innerHTML = htmlModal;
        selFiltro.innerHTML = htmlFiltro;
    } catch (e) {
        console.warn('Error cargando camiones para repuestos:', e);
    }
}

async function cargarMovimientosRepuestosLista() {
    const tbody = document.getElementById('tbodyMovimientosRepuestos');
    if (!tbody) return;

    const repuestoId = document.getElementById('filtroMovRepuestoId')?.value || '';
    const camionId = document.getElementById('filtroMovCamionId')?.value || '';

    let url = `${API_BASE}/repuestos/movimientos?top=100`;
    if (repuestoId) url += `&repuestoId=${encodeURIComponent(repuestoId)}`;
    if (camionId) url += `&camionId=${encodeURIComponent(camionId)}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: #ef4444;">Error al cargar movimientos</td></tr>`;
            return;
        }

        const data = await res.json();
        _movimientosRepuestosCache = data || [];
        renderTablaMovimientosRepuestos(_movimientosRepuestosCache);
    } catch (e) {
        console.error('Error cargando movimientos de repuestos:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: #ef4444;">Error de conexión</td></tr>`;
    }
}
window.cargarMovimientosRepuestosLista = cargarMovimientosRepuestosLista;

function renderTablaMovimientosRepuestos(items) {
    const tbody = document.getElementById('tbodyMovimientosRepuestos');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 30px; color: #94a3b8;">No hay movimientos registrados</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(m => {
        let badgeTipo = '';
        if (m.tipoMovimiento === 'ENTRADA_COMPRA') {
            badgeTipo = `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid #bbf7d0;"><i class="fa-solid fa-arrow-down"></i> ENTRADA COMPRA</span>`;
        } else if (m.tipoMovimiento === 'SALIDA_MANTENIMIENTO') {
            badgeTipo = `<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid #fca5a5;"><i class="fa-solid fa-arrow-up"></i> SALIDA FLOTA</span>`;
        } else {
            badgeTipo = `<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 800; font-size: 11px; padding: 4px 8px; border: 1px solid #fde68a;"><i class="fa-solid fa-sliders"></i> AJUSTE</span>`;
        }

        const fechaStr = m.fecha ? m.fecha.split('T')[0] : '-';
        const esSalida = m.tipoMovimiento.startsWith('SALIDA');

        const camionBadge = m.camionPlaca
            ? `<span class="badge badge-primary" style="font-family: monospace; font-size: 12px; font-weight: 800;">${m.camionPlaca}</span>`
            : `<span style="color: #94a3b8; font-size: 12px;">Almacén Central</span>`;

        return `
            <tr>
                <td style="font-size: 12.5px; font-weight: 700; color: #334155;">${fechaStr}</td>
                <td style="text-align: center;">${badgeTipo}</td>
                <td>
                    <span class="badge" style="background: #f1f5f9; color: #0f172a; font-family: monospace; font-size: 11.5px; font-weight: 700;">${m.repuestoCodigo || ''}</span>
                    <strong style="color: #0f172a; font-size: 13px; margin-left: 6px;">${m.repuestoNombre || ''}</strong>
                </td>
                <td style="text-align: right;">
                    <strong style="color: ${esSalida ? '#dc2626' : '#059669'}; font-size: 14px; font-weight: 800;">
                        ${esSalida ? '-' : '+'}${m.cantidad} u
                    </strong>
                </td>
                <td style="text-align: right; font-weight: 700; color: #475569;">
                    $${Number(m.costoUnitarioUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>${camionBadge}</td>
                <td style="font-size: 12.5px; color: #475569;">${m.observaciones || '-'}</td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------
// MODAL: CREAR / EDITAR REPUESTO
// -------------------------------------------------------------
function abrirModalCrearRepuesto() {
    document.getElementById('modalRepuestoTitle').textContent = 'Registrar Nuevo Repuesto';
    document.getElementById('modalRepuestoId').value = '';
    document.getElementById('modalRepuestoCodigo').value = '';
    document.getElementById('modalRepuestoCodigo').readOnly = false;
    document.getElementById('modalRepuestoNombre').value = '';
    document.getElementById('modalRepuestoCategoria').value = 'FILTROS';
    document.getElementById('modalRepuestoStockActual').value = '1';
    document.getElementById('modalRepuestoStockMinimo').value = '2';
    document.getElementById('modalRepuestoCosto').value = '';
    document.getElementById('modalRepuestoUbicacion').value = '';
    abrirModalCustom('modalRepuesto');
}
window.abrirModalCrearRepuesto = abrirModalCrearRepuesto;

async function abrirModalEditarRepuesto(id) {
    let r = _repuestosCache.find(x => x.id === id);
    if (!r) {
        try {
            const res = await fetch(`${API_BASE}/repuestos/${id}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) r = await res.json();
        } catch (e) {
            console.warn(e);
        }
    }

    if (!r) {
        Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se pudo localizar el repuesto', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    document.getElementById('modalRepuestoTitle').textContent = `Editar Repuesto: ${r.codigo}`;
    document.getElementById('modalRepuestoId').value = r.id;
    document.getElementById('modalRepuestoCodigo').value = r.codigo;
    document.getElementById('modalRepuestoCodigo').readOnly = true;
    document.getElementById('modalRepuestoNombre').value = r.nombre;
    document.getElementById('modalRepuestoCategoria').value = r.categoria || 'OTROS';
    document.getElementById('modalRepuestoStockActual').value = r.stockActual || 0;
    document.getElementById('modalRepuestoStockMinimo').value = r.stockMinimo || 1;
    document.getElementById('modalRepuestoCosto').value = r.costoUnitarioUSD || 0;
    document.getElementById('modalRepuestoUbicacion').value = r.ubicacionAlmacen || '';

    abrirModalCustom('modalRepuesto');
}
window.abrirModalEditarRepuesto = abrirModalEditarRepuesto;

async function guardarRepuestoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalRepuestoId').value;
    const codigo = document.getElementById('modalRepuestoCodigo').value.trim().toUpperCase();
    const nombre = document.getElementById('modalRepuestoNombre').value.trim();
    const categoria = document.getElementById('modalRepuestoCategoria').value;
    const stockActual = parseInt(document.getElementById('modalRepuestoStockActual').value) || 0;
    const stockMinimo = parseInt(document.getElementById('modalRepuestoStockMinimo').value) || 1;
    const costoUnitarioUSD = parseFloat(document.getElementById('modalRepuestoCosto').value) || 0;
    const ubicacionAlmacen = document.getElementById('modalRepuestoUbicacion').value.trim() || null;

    if (!codigo || !nombre) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Código y nombre son obligatorios', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const payload = {
        codigo,
        nombre,
        categoria,
        stockActual,
        stockMinimo,
        costoUnitarioUSD,
        ubicacionAlmacen,
        activo: true
    };

    const isEdit = id && id !== '';
    const url = isEdit ? `${API_BASE}/repuestos/${id}` : `${API_BASE}/repuestos`;
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
            const err = await res.json().catch(() => ({ message: 'Error procesando repuesto' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalRepuesto');
        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Repuesto Actualizado' : 'Repuesto Creado',
            text: `El repuesto "${nombre}" se guardó exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        cargarModuloRepuestos();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarRepuestoSubmit = guardarRepuestoSubmit;

async function eliminarRepuesto(id, nombre) {
    const result = await Swal.fire({
        title: '¿Desactivar repuesto?',
        text: `¿Desea desactivar "${nombre}" del catálogo?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/repuestos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error('Error al desactivar repuesto');

        Swal.fire({
            icon: 'success',
            title: 'Desactivado',
            text: 'Repuesto retirado del catálogo activo.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        cargarModuloRepuestos();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.eliminarRepuesto = eliminarRepuesto;

// -------------------------------------------------------------
// MODAL: REGISTRAR MOVIMIENTO (ENTRADA / SALIDA)
// -------------------------------------------------------------
function abrirModalMovimientoRepuesto(tipo) {
    document.getElementById('modalMovimientoTipo').value = tipo;
    document.getElementById('modalMovimientoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalMovimientoCantidad').value = '';
    document.getElementById('modalMovimientoCostoUSD').value = '';
    document.getElementById('modalMovimientoObservaciones').value = '';
    document.getElementById('modalMovimientoStockInfo').textContent = '';
    document.getElementById('modalMovimientoRepuestoId').value = '';

    const header = document.getElementById('modalMovimientoHeader');
    const title = document.getElementById('modalMovimientoTitle');
    const subtitle = document.getElementById('modalMovimientoSubtitle');
    const btn = document.getElementById('btnGuardarMovimiento');
    const grpCamion = document.getElementById('grupoCamionDestino');

    if (tipo === 'ENTRADA_COMPRA') {
        header.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
        title.textContent = 'Registrar Entrada / Compra de Repuestos';
        subtitle.textContent = 'Ingreso de piezas compradas al almacén central';
        btn.style.background = '#059669';
        btn.style.borderColor = '#059669';
        btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Registrar Ingreso';
        grpCamion.style.display = 'none';
        document.getElementById('modalMovimientoCamionId').required = false;
    } else {
        header.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
        title.textContent = 'Salida de Repuesto para Camión';
        subtitle.textContent = 'Consumo de repuesto por mantenimiento a vehículo cisterna';
        btn.style.background = '#dc2626';
        btn.style.borderColor = '#dc2626';
        btn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Procesar Salida';
        grpCamion.style.display = 'block';
        document.getElementById('modalMovimientoCamionId').required = true;
    }

    abrirModalCustom('modalMovimientoRepuesto');
}
window.abrirModalMovimientoRepuesto = abrirModalMovimientoRepuesto;

function alCambiarRepuestoMovimiento() {
    const sel = document.getElementById('modalMovimientoRepuestoId');
    const opt = sel.options[sel.selectedIndex];
    const stockInfo = document.getElementById('modalMovimientoStockInfo');
    const inputCosto = document.getElementById('modalMovimientoCostoUSD');

    if (!opt || !opt.value) {
        stockInfo.textContent = '';
        return;
    }

    const stock = opt.getAttribute('data-stock') || 0;
    const costo = opt.getAttribute('data-costo') || 0;

    stockInfo.textContent = `Stock disponible actual: ${stock} unidades`;
    if (!inputCosto.value || inputCosto.value === '0') {
        inputCosto.value = costo > 0 ? costo : '';
    }
}
window.alCambiarRepuestoMovimiento = alCambiarRepuestoMovimiento;

async function guardarMovimientoRepuestoSubmit(e) {
    e.preventDefault();
    const tipoMovimiento = document.getElementById('modalMovimientoTipo').value;
    const repuestoId = parseInt(document.getElementById('modalMovimientoRepuestoId').value);
    const cantidad = parseInt(document.getElementById('modalMovimientoCantidad').value) || 0;
    const fecha = document.getElementById('modalMovimientoFecha').value;
    const costoUnitarioUSD = parseFloat(document.getElementById('modalMovimientoCostoUSD').value) || 0;
    const observaciones = document.getElementById('modalMovimientoObservaciones').value.trim() || null;
    const camionVal = document.getElementById('modalMovimientoCamionId').value;
    const camionId = (tipoMovimiento === 'SALIDA_MANTENIMIENTO' && camionVal) ? parseInt(camionVal) : null;

    if (!repuestoId || cantidad <= 0 || !fecha) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Repuesto, cantidad y fecha son obligatorios', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    if (tipoMovimiento === 'SALIDA_MANTENIMIENTO' && !camionId) {
        Swal.fire({ icon: 'warning', title: 'Camión requerido', text: 'Debe seleccionar el camión receptor de la pieza', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const payload = {
        repuestoId,
        tipoMovimiento,
        cantidad,
        costoUnitarioUSD,
        camionId,
        fecha,
        observaciones
    };

    try {
        const res = await fetch(`${API_BASE}/repuestos/movimientos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error procesando movimiento' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalMovimientoRepuesto');
        Swal.fire({
            icon: 'success',
            title: 'Movimiento Procesado',
            text: `Se procesó la ${tipoMovimiento === 'ENTRADA_COMPRA' ? 'entrada' : 'salida'} de ${cantidad} unidades.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        cargarModuloRepuestos();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarMovimientoRepuestoSubmit = guardarMovimientoRepuestoSubmit;
