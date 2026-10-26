// =========================================================================
// MÓDULO DE CATÁLOGOS INTERACTIVOS (DATATABLES & CRUD): COMPAÑÍAS, BANCOS, FINCAS
// =========================================================================

// --- 1. GESTIÓN DE COMPAÑÍAS ---
if (!state.datatableCompanias) {
    state.datatableCompanias = {
        search: '',
        sortColumn: 'nombre',
        sortDirection: 'asc',
        currentPage: 1,
        pageSize: 10,
        data: []
    };
}

async function cargarCompaniasCat() {
    try {
        const tbody = document.getElementById('tbodyCompaniasCat');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando compañías...</td></tr>`;
        }

        const res = await fetch(`${API_BASE}/catalogos/companias`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar compañías</td></tr>`;
            return;
        }

        const list = await res.json();
        state.companias = list || [];
        state.datatableCompanias.data = list || [];
        renderTablaCompanias();
    } catch (e) {
        console.warn('Error al cargar compañías:', e);
        const tbody = document.getElementById('tbodyCompaniasCat');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 20px; color: #f87171;">Error de conexión</td></tr>`;
    }
}
window.cargarCompaniasCat = cargarCompaniasCat;

function renderTablaCompanias() {
    const dt = state.datatableCompanias;
    const tbody = document.getElementById('tbodyCompaniasCat');
    if (!tbody) return;

    let items = [...(dt.data || [])];

    // Filtrar búsqueda
    if (dt.search && dt.search.trim() !== '') {
        const term = dt.search.toLowerCase().trim();
        items = items.filter(c => 
            (c.nombre && c.nombre.toLowerCase().includes(term)) ||
            (c.encargado && c.encargado.toLowerCase().includes(term)) ||
            (c.telefono && c.telefono.toLowerCase().includes(term)) ||
            (c.direccion && c.direccion.toLowerCase().includes(term)) ||
            (c.id && c.id.toString().includes(term))
        );
    }

    // Actualizar badge de total
    const badgeTotal = document.getElementById('badgeTotalCompanias');
    if (badgeTotal) {
        badgeTotal.textContent = `${items.length} ${items.length === 1 ? 'Compañía' : 'Compañías'}`;
    }

    // Ordenar
    items.sort((a, b) => {
        let valA, valB;
        if (dt.sortColumn === 'id') {
            valA = a.id || 0;
            valB = b.id || 0;
        } else if (dt.sortColumn === 'servicio') {
            valA = (a.tipoServicioNombre || (a.tipoServicioId === 2 ? 'TRANSPORTE' : 'RUTA')).toLowerCase();
            valB = (b.tipoServicioNombre || (b.tipoServicioId === 2 ? 'TRANSPORTE' : 'RUTA')).toLowerCase();
        } else if (dt.sortColumn === 'precio') {
            valA = a.precioCompraLitroUSD || 0;
            valB = b.precioCompraLitroUSD || 0;
        } else if (dt.sortColumn === 'activo') {
            valA = a.activo ? 1 : 0;
            valB = b.activo ? 1 : 0;
        } else if (dt.sortColumn === 'encargado') {
            valA = (a.encargado || '').toLowerCase();
            valB = (b.encargado || '').toLowerCase();
        } else {
            valA = (a.nombre || '').toLowerCase();
            valB = (b.nombre || '').toLowerCase();
        }

        if (valA < valB) return dt.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return dt.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginación
    const totalItems = items.length;
    let pageSize = parseInt(dt.pageSize);
    if (isNaN(pageSize) || pageSize <= 0) pageSize = totalItems || 1;

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (dt.currentPage > totalPages) dt.currentPage = totalPages;
    if (dt.currentPage < 1) dt.currentPage = 1;

    const startIndex = (dt.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = dt.pageSize === -1 ? items : items.slice(startIndex, endIndex);

    // Actualizar texto info
    const infoSpan = document.getElementById('infoPaginacionCompanias');
    if (infoSpan) {
        if (totalItems === 0) {
            infoSpan.textContent = 'Mostrando 0 a 0 de 0 registros';
        } else {
            infoSpan.textContent = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItems} registros`;
        }
    }

    // Renderizar botones de paginación
    renderPaginacionControls('paginacionCompanias', dt.currentPage, totalPages, 'irAPaginaCompanias');

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center" style="padding: 30px; color: #94a3b8;">
                    <i class="fa-solid fa-folder-open" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No se encontraron compañías registradas
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = paginatedItems.map(c => {
        const tipoServId = c.tipoServicioId || 1;
        const badgeServicio = tipoServId === 2 
            ? `<span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1.5px solid #d8b4fe; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-truck"></i> TRANSPORTE</span>`
            : `<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-road"></i> RUTA</span>`;

        const pVaca = Number(c.precioCompraLitroUSD || 0);
        const pBufala = Number(c.precioBufalaLitroUSD !== undefined && c.precioBufalaLitroUSD !== null ? c.precioBufalaLitroUSD : (tipoServId === 2 ? 0.1000 : pVaca));
        const pAcida = Number(c.precioAcidaLitroUSD !== undefined && c.precioAcidaLitroUSD !== null ? c.precioAcidaLitroUSD : 0);

        const diaApertura = c.diaAperturaSemana || 'Martes';
        const diaCierre = c.diaCierreSemana || 'Lunes';

        return `
            <tr>
                <td><span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; border: 1px solid #cbd5e1;">#${c.id}</span></td>
                <td>
                    <strong style="color: #0f172a; font-size: 14px; font-weight: 700;">${capitalizarTexto(c.nombre)}</strong>
                    <div style="margin-top: 3px;">
                        <span style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 700; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Ciclo operativo de la compañía">
                            <i class="fa-solid fa-calendar-week" style="color: #0284c7; font-size: 9px;"></i> ${diaApertura} a ${diaCierre} (Cierre: <strong style="color:#e11d48;">${diaCierre}</strong>)
                        </span>
                    </div>
                </td>
                <td style="text-align: center;">
                    ${badgeServicio}
                </td>
                <td>
                    <span style="color: #334155; font-size: 13.5px; font-weight: 600;">${c.encargado ? capitalizarTexto(c.encargado) : '<span style="color:#94a3b8;">-</span>'}</span>
                </td>
                <td>
                    <span style="color: #475569; font-size: 13px; font-weight: 500;">${c.telefono || '<span style="color:#94a3b8;">-</span>'}</span>
                </td>
                <td>
                    <span style="color: #475569; font-size: 12.5px;" title="${c.direccion || ''}">${c.direccion ? (c.direccion.length > 25 ? c.direccion.substring(0, 25) + '...' : c.direccion) : '<span style="color:#94a3b8;">-</span>'}</span>
                </td>
                <td style="text-align: right;">
                    <strong style="color: #047857; font-size: 13.5px; font-weight: 700;">$ ${pVaca.toFixed(4)}</strong>
                </td>
                <td style="text-align: right;">
                    <strong style="color: #0d9488; font-size: 13.5px; font-weight: 700;">$ ${pBufala.toFixed(4)}</strong>
                </td>
                <td style="text-align: right;">
                    <strong style="color: #e11d48; font-size: 13.5px; font-weight: 700;">$ ${pAcida.toFixed(4)}</strong>
                </td>
                <td style="text-align: center;">
                    <span class="badge ${c.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 11.5px;">
                        <i class="fa-solid ${c.activo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarCompania(${c.id})" title="Editar Compañía" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="eliminarCompania(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')" title="Eliminar Compañía" style="padding: 4px 8px; font-size: 12px; border-color: #fecdd3; color: #e11d48; background: #fff1f2;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
window.renderTablaCompanias = renderTablaCompanias;

function filtrarCompaniasCat(val) {
    state.datatableCompanias.search = val;
    state.datatableCompanias.currentPage = 1;
    renderTablaCompanias();
}
window.filtrarCompaniasCat = filtrarCompaniasCat;

function cambiarPageSizeCompanias(val) {
    state.datatableCompanias.pageSize = parseInt(val);
    state.datatableCompanias.currentPage = 1;
    renderTablaCompanias();
}
window.cambiarPageSizeCompanias = cambiarPageSizeCompanias;

function ordenarCompanias(col) {
    const dt = state.datatableCompanias;
    if (dt.sortColumn === col) {
        dt.sortDirection = dt.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        dt.sortColumn = col;
        dt.sortDirection = 'asc';
    }

    ['id', 'nombre', 'servicio', 'encargado', 'precio', 'precioBufala', 'precioAcida', 'activo'].forEach(c => {
        const icon = document.getElementById(`sort-companias-${c}`);
        if (icon) {
            if (c === col) {
                icon.className = dt.sortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                icon.style.color = '#38bdf8';
            } else {
                icon.className = 'fa-solid fa-sort';
                icon.style.color = '';
            }
        }
    });

    renderTablaCompanias();
}
window.ordenarCompanias = ordenarCompanias;

function irAPaginaCompanias(page) {
    state.datatableCompanias.currentPage = page;
    renderTablaCompanias();
}
window.irAPaginaCompanias = irAPaginaCompanias;

function actualizarLabelsModalCompaniaSegunTipo() {
    const selTipo = document.getElementById('modalCompaniaTipoServicioId');
    const tipoVal = selTipo ? parseInt(selTipo.value || '1') : 1;
    const esTransp = (tipoVal === 2);

    const lblTitulo = document.getElementById('lblTituloPreciosCompania');
    const badgeTarifa = document.getElementById('badgeTipoTarifaCompania');
    const lblVaca = document.getElementById('lblPrecioVacaCompania');
    const lblBufala = document.getElementById('lblPrecioBufalaCompania');
    const lblAcida = document.getElementById('lblPrecioAcidaCompania');
    const ayuda = document.getElementById('ayudaPreciosCompania');

    if (esTransp) {
        if (lblTitulo) lblTitulo.innerHTML = '<i class="fa-solid fa-truck-ramp-box" style="color: #7e22ce;"></i> Tarifas de Flete Cobrado a Terceros ($/Lt)';
        if (badgeTarifa) {
            badgeTarifa.textContent = 'FLETE POR LITRO';
            badgeTarifa.style.background = '#faf5ff';
            badgeTarifa.style.color = '#7e22ce';
        }
        if (lblVaca) lblVaca.textContent = 'Flete Leche Vaca ($/Lt)';
        if (lblBufala) lblBufala.textContent = 'Flete Leche Búfala ($/Lt)';
        if (lblAcida) lblAcida.textContent = 'Flete Leche Ácida ($/Lt)';
        if (ayuda) ayuda.textContent = 'Tarifa cobrada a la planta receptora por el acarreo de cada litro entregado (Vaca y Búfala habitual $0.1000).';
    } else {
        if (lblTitulo) lblTitulo.innerHTML = '<i class="fa-solid fa-tags" style="color: #2563eb;"></i> Precios de Venta Leche Propia ($/Lt)';
        if (badgeTarifa) {
            badgeTarifa.textContent = 'VENTA DE LECHE';
            badgeTarifa.style.background = '#e0f2fe';
            badgeTarifa.style.color = '#0284c7';
        }
        if (lblVaca) lblVaca.textContent = 'Leche Vaca ($/Lt)';
        if (lblBufala) lblBufala.textContent = 'Leche Búfala ($/Lt)';
        if (lblAcida) lblAcida.textContent = 'Ácida / Mala ($/Lt)';
        if (ayuda) ayuda.textContent = 'Precio al que se vende nuestra leche de ruta propia a esta receptora o planta.';
    }
}
window.actualizarLabelsModalCompaniaSegunTipo = actualizarLabelsModalCompaniaSegunTipo;

function abrirModalCrearCompania() {
    document.getElementById('modalCompaniaTitle').textContent = 'Registrar Nueva Compañía';
    document.getElementById('modalCompaniaId').value = '';
    document.getElementById('modalCompaniaNombre').value = '';
    const selTipo = document.getElementById('modalCompaniaTipoServicioId');
    if (selTipo) {
        selTipo.value = '1';
        selTipo.onchange = actualizarLabelsModalCompaniaSegunTipo;
    }
    document.getElementById('modalCompaniaEncargado').value = '';
    document.getElementById('modalCompaniaTelefono').value = '';
    document.getElementById('modalCompaniaDireccion').value = '';
    document.getElementById('modalCompaniaPrecio').value = '0.4000';
    const inputBufala = document.getElementById('modalCompaniaPrecioBufala');
    if (inputBufala) inputBufala.value = '0.4000';
    const inputAcida = document.getElementById('modalCompaniaPrecioAcida');
    if (inputAcida) inputAcida.value = '0.0000';
    
    const selApertura = document.getElementById('modalCompaniaDiaApertura');
    if (selApertura) selApertura.value = 'Martes';
    const selCierre = document.getElementById('modalCompaniaDiaCierre');
    if (selCierre) selCierre.value = 'Lunes';

    document.getElementById('modalCompaniaActivo').checked = true;

    actualizarLabelsModalCompaniaSegunTipo();

    const modal = document.getElementById('modalCompaniaCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalCrearCompania = abrirModalCrearCompania;

function abrirModalEditarCompania(id) {
    const compania = state.companias.find(c => c.id === id);
    if (!compania) return;

    document.getElementById('modalCompaniaTitle').textContent = 'Editar Compañía / Planta';
    document.getElementById('modalCompaniaId').value = compania.id;
    document.getElementById('modalCompaniaNombre').value = compania.nombre || '';
    const selTipo = document.getElementById('modalCompaniaTipoServicioId');
    if (selTipo) {
        selTipo.value = (compania.tipoServicioId || 1).toString();
        selTipo.onchange = actualizarLabelsModalCompaniaSegunTipo;
    }
    document.getElementById('modalCompaniaEncargado').value = compania.encargado || '';
    document.getElementById('modalCompaniaTelefono').value = compania.telefono || '';
    document.getElementById('modalCompaniaDireccion').value = compania.direccion || '';
    
    const pVaca = Number(compania.precioCompraLitroUSD || 0);
    const tipoServId = Number(compania.tipoServicioId || 1);
    const pBufala = Number(compania.precioBufalaLitroUSD !== undefined && compania.precioBufalaLitroUSD !== null ? compania.precioBufalaLitroUSD : (tipoServId === 2 ? 0.1000 : pVaca));
    const pAcida = Number(compania.precioAcidaLitroUSD !== undefined && compania.precioAcidaLitroUSD !== null ? compania.precioAcidaLitroUSD : 0);

    document.getElementById('modalCompaniaPrecio').value = pVaca.toFixed(4);
    const inputBufala = document.getElementById('modalCompaniaPrecioBufala');
    if (inputBufala) inputBufala.value = pBufala.toFixed(4);
    const inputAcida = document.getElementById('modalCompaniaPrecioAcida');
    if (inputAcida) inputAcida.value = pAcida.toFixed(4);

    const selApertura = document.getElementById('modalCompaniaDiaApertura');
    if (selApertura) selApertura.value = compania.diaAperturaSemana || 'Martes';
    const selCierre = document.getElementById('modalCompaniaDiaCierre');
    if (selCierre) selCierre.value = compania.diaCierreSemana || 'Lunes';

    document.getElementById('modalCompaniaActivo').checked = compania.activo !== false;

    actualizarLabelsModalCompaniaSegunTipo();

    const modal = document.getElementById('modalCompaniaCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalEditarCompania = abrirModalEditarCompania;

async function guardarCompaniaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalCompaniaId').value;
    const nombre = document.getElementById('modalCompaniaNombre').value.trim();
    const tipoServicioId = parseInt(document.getElementById('modalCompaniaTipoServicioId')?.value || '1') || 1;
    const encargado = document.getElementById('modalCompaniaEncargado').value.trim();
    const telefono = document.getElementById('modalCompaniaTelefono').value.trim();
    const direccion = document.getElementById('modalCompaniaDireccion').value.trim();
    const precioCompraLitroUSD = parseFloat(document.getElementById('modalCompaniaPrecio').value) || 0;
    const precioBufalaLitroUSD = parseFloat(document.getElementById('modalCompaniaPrecioBufala')?.value || precioCompraLitroUSD) || 0;
    const precioAcidaLitroUSD = parseFloat(document.getElementById('modalCompaniaPrecioAcida')?.value || '0') || 0;
    const diaAperturaSemana = document.getElementById('modalCompaniaDiaApertura')?.value || 'Martes';
    const diaCierreSemana = document.getElementById('modalCompaniaDiaCierre')?.value || 'Lunes';
    const activo = document.getElementById('modalCompaniaActivo').checked;

    if (!nombre) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'El nombre de la compañía es obligatorio', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const payload = { 
        nombre, 
        encargado, 
        telefono, 
        direccion, 
        tipoServicioId, 
        precioCompraLitroUSD, 
        precioBufalaLitroUSD, 
        precioAcidaLitroUSD, 
        diaAperturaSemana, 
        diaCierreSemana, 
        activo 
    };
    const isEdit = id && id !== '';
    const url = isEdit ? `${API_BASE}/catalogos/companias/${id}` : `${API_BASE}/catalogos/companias`;
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
            const err = await res.json().catch(() => ({ message: 'Error al procesar la solicitud' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalCompaniaCustom');
        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Compañía Actualizada' : 'Compañía Registrada',
            text: `La compañía "${nombre}" fue guardada exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        await cargarCompaniasCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarCompaniaSubmit = guardarCompaniaSubmit;

async function eliminarCompania(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar Compañía?',
        html: `¿Estás seguro de que deseas eliminar la compañía <strong>${nombre}</strong>?<br><small style="color: #94a3b8;">Esta acción la removerá del catálogo activo.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/catalogos/companias/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'No se pudo eliminar la compañía' }));
            throw new Error(err.message);
        }

        Swal.fire({
            icon: 'success',
            title: 'Compañía Eliminada',
            text: 'El registro fue removido correctamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });

        await cargarCompaniasCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error al Eliminar', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.eliminarCompania = eliminarCompania;


// --- 2. GESTIÓN DE BANCOS ---
if (!state.datatableBancos) {
    state.datatableBancos = {
        search: '',
        sortColumn: 'nombre',
        sortDirection: 'asc',
        currentPage: 1,
        pageSize: 10,
        data: []
    };
}

async function cargarBancosCat() {
    try {
        const tbody = document.getElementById('tbodyBancos');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando bancos...</td></tr>`;
        }

        const res = await fetch(`${API_BASE}/catalogos/bancos`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar bancos</td></tr>`;
            return;
        }

        const list = await res.json();
        state.bancos = list || [];
        state.datatableBancos.data = list || [];
        renderTablaBancos();
    } catch (e) {
        console.warn('Error al cargar bancos:', e);
        const tbody = document.getElementById('tbodyBancos');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #f87171;">Error de conexión</td></tr>`;
    }
}
window.cargarBancosCat = cargarBancosCat;

function renderTablaBancos() {
    const dt = state.datatableBancos;
    const tbody = document.getElementById('tbodyBancos');
    if (!tbody) return;

    let items = [...(dt.data || [])];

    // Filtrar búsqueda
    if (dt.search && dt.search.trim() !== '') {
        const term = dt.search.toLowerCase().trim();
        items = items.filter(b => 
            (b.nombre && b.nombre.toLowerCase().includes(term)) ||
            (b.codigo && b.codigo.toLowerCase().includes(term)) ||
            (b.id && b.id.toString().includes(term))
        );
    }

    // Actualizar badge de total
    const badgeTotal = document.getElementById('badgeTotalBancos');
    if (badgeTotal) {
        badgeTotal.textContent = `${items.length} ${items.length === 1 ? 'Banco' : 'Bancos'}`;
    }

    // Ordenar
    items.sort((a, b) => {
        let valA, valB;
        if (dt.sortColumn === 'codigo') {
            valA = (a.codigo || '').toLowerCase();
            valB = (b.codigo || '').toLowerCase();
        } else if (dt.sortColumn === 'fincas') {
            valA = a.fincasCount || 0;
            valB = b.fincasCount || 0;
        } else if (dt.sortColumn === 'activo') {
            valA = a.activo ? 1 : 0;
            valB = b.activo ? 1 : 0;
        } else {
            valA = (a.nombre || '').toLowerCase();
            valB = (b.nombre || '').toLowerCase();
        }

        if (valA < valB) return dt.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return dt.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginación
    const totalItems = items.length;
    let pageSize = parseInt(dt.pageSize);
    if (isNaN(pageSize) || pageSize <= 0) pageSize = totalItems || 1;

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (dt.currentPage > totalPages) dt.currentPage = totalPages;
    if (dt.currentPage < 1) dt.currentPage = 1;

    const startIndex = (dt.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = dt.pageSize === -1 ? items : items.slice(startIndex, endIndex);

    // Actualizar texto info
    const infoSpan = document.getElementById('infoPaginacionBancos');
    if (infoSpan) {
        if (totalItems === 0) {
            infoSpan.textContent = 'Mostrando 0 a 0 de 0 registros';
        } else {
            infoSpan.textContent = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItems} registros`;
        }
    }

    // Renderizar botones de paginación
    renderPaginacionControls('paginacionBancos', dt.currentPage, totalPages, 'irAPaginaBancos');

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="padding: 30px; color: #94a3b8;">
                    <i class="fa-solid fa-building-columns" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No se encontraron entidades bancarias registradas
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = paginatedItems.map(b => `
        <tr>
            <td>
                <span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-family: monospace; font-size: 13px; letter-spacing: 1px; border: 1px solid #bae6fd;">
                    ${b.codigo || '----'}
                </span>
            </td>
            <td>
                <strong style="color: #0f172a; font-size: 14px; font-weight: 700;">${capitalizarTexto(b.nombre)}</strong>
            </td>
            <td style="text-align: center;">
                <span class="badge" style="background: #fef3c7; color: #b45309; font-size: 12px; font-weight: 700; border: 1px solid #fde68a;">
                    <i class="fa-solid fa-cow" style="color: #d97706; margin-right: 4px;"></i> ${b.fincasCount || 0} Fincas
                </span>
            </td>
            <td style="text-align: center;">
                <span class="badge ${b.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 11.5px;">
                    <i class="fa-solid ${b.activo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${b.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button type="button" class="btn btn-outline" onclick="abrirModalEditarBanco(${b.id})" title="Editar Banco" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="btn btn-outline" onclick="eliminarBanco(${b.id}, '${b.nombre.replace(/'/g, "\\'")}')" title="Eliminar Banco" style="padding: 4px 8px; font-size: 12px; border-color: #fecdd3; color: #e11d48; background: #fff1f2;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}
window.renderTablaBancos = renderTablaBancos;

function filtrarBancosCat(val) {
    state.datatableBancos.search = val;
    state.datatableBancos.currentPage = 1;
    renderTablaBancos();
}
window.filtrarBancosCat = filtrarBancosCat;

function cambiarPageSizeBancos(val) {
    state.datatableBancos.pageSize = parseInt(val);
    state.datatableBancos.currentPage = 1;
    renderTablaBancos();
}
window.cambiarPageSizeBancos = cambiarPageSizeBancos;

function ordenarBancos(col) {
    const dt = state.datatableBancos;
    if (dt.sortColumn === col) {
        dt.sortDirection = dt.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        dt.sortColumn = col;
        dt.sortDirection = 'asc';
    }

    ['codigo', 'nombre', 'fincas', 'activo'].forEach(c => {
        const icon = document.getElementById(`sort-bancos-${c}`);
        if (icon) {
            if (c === col) {
                icon.className = dt.sortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                icon.style.color = '#38bdf8';
            } else {
                icon.className = 'fa-solid fa-sort';
                icon.style.color = '';
            }
        }
    });

    renderTablaBancos();
}
window.ordenarBancos = ordenarBancos;

function irAPaginaBancos(page) {
    state.datatableBancos.currentPage = page;
    renderTablaBancos();
}
window.irAPaginaBancos = irAPaginaBancos;

function abrirModalCrearBanco() {
    document.getElementById('modalBancoTitle').textContent = 'Registrar Nuevo Banco';
    document.getElementById('modalBancoId').value = '';
    document.getElementById('modalBancoCodigo').value = '';
    document.getElementById('modalBancoNombre').value = '';
    document.getElementById('modalBancoActivo').checked = true;

    const modal = document.getElementById('modalBancoCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalCrearBanco = abrirModalCrearBanco;

function abrirModalEditarBanco(id) {
    const banco = state.bancos.find(b => b.id === id);
    if (!banco) return;

    document.getElementById('modalBancoTitle').textContent = 'Editar Entidad Bancaria';
    document.getElementById('modalBancoId').value = banco.id;
    document.getElementById('modalBancoCodigo').value = banco.codigo || '';
    document.getElementById('modalBancoNombre').value = banco.nombre || '';
    document.getElementById('modalBancoActivo').checked = banco.activo !== false;

    const modal = document.getElementById('modalBancoCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalEditarBanco = abrirModalEditarBanco;

async function guardarBancoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalBancoId').value;
    const codigo = document.getElementById('modalBancoCodigo').value.trim();
    const nombre = document.getElementById('modalBancoNombre').value.trim();
    const activo = document.getElementById('modalBancoActivo').checked;

    if (!codigo || codigo.length < 4) {
        Swal.fire({ icon: 'warning', title: 'Código Inválido', text: 'El código bancario debe tener 4 dígitos (ej: 0102).', background: '#1e293b', color: '#f8fafc' });
        return;
    }
    if (!nombre) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'El nombre del banco es obligatorio', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const payload = { codigo, nombre, activo };
    const isEdit = id && id !== '';
    const url = isEdit ? `${API_BASE}/catalogos/bancos/${id}` : `${API_BASE}/catalogos/bancos`;
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
            const err = await res.json().catch(() => ({ message: 'Error al procesar la solicitud' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalBancoCustom');
        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Banco Actualizado' : 'Banco Registrado',
            text: `El banco "${nombre}" (${codigo}) fue guardado exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        await cargarBancosCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarBancoSubmit = guardarBancoSubmit;

async function eliminarBanco(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar / Desactivar Banco?',
        html: `¿Estás seguro de que deseas eliminar o desactivar el banco <strong>${nombre}</strong>?<br><small style="color: #94a3b8;">Si tiene fincas asociadas se desactivará de forma segura.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, continuar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/catalogos/bancos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'No se pudo eliminar el banco' }));
            throw new Error(err.message);
        }

        Swal.fire({
            icon: 'success',
            title: 'Operación Exitosa',
            text: 'El banco fue procesado correctamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });

        await cargarBancosCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error al Eliminar', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.eliminarBanco = eliminarBanco;


// --- 3. GESTIÓN DE FINCAS CON MULTI-BANCO ---
if (!state.datatableFincas) {
    state.datatableFincas = {
        search: '',
        sortColumn: 'nombre',
        sortDirection: 'asc',
        currentPage: 1,
        pageSize: 10,
        data: []
    };
}

async function cargarFincasCat() {
    try {
        const tbody = document.getElementById('tbodyFincasCat');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando fincas...</td></tr>`;
        }

        if (!state.bancos || state.bancos.length === 0) {
            try {
                const r = await fetch(`${API_BASE}/catalogos/bancos`, { headers: { 'Authorization': `Bearer ${state.token}` } });
                if (r.ok) state.bancos = await r.json();
            } catch (e) {}
        }

        const res = await fetch(`${API_BASE}/catalogos/fincas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar fincas</td></tr>`;
            return;
        }

        const list = await res.json();
        state.fincas = list || [];
        state.datatableFincas.data = list || [];
        renderTablaFincas();
    } catch (e) {
        console.warn('Error al cargar fincas:', e);
        const tbody = document.getElementById('tbodyFincasCat');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 20px; color: #f87171;">Error de conexión</td></tr>`;
    }
}
window.cargarFincasCat = cargarFincasCat;

function renderTablaFincas() {
    const dt = state.datatableFincas;
    const tbody = document.getElementById('tbodyFincasCat');
    if (!tbody) return;

    let items = [...(dt.data || [])];

    // Filtrar búsqueda
    if (dt.search && dt.search.trim() !== '') {
        const term = dt.search.toLowerCase().trim();
        items = items.filter(f => 
            (f.nombre && f.nombre.toLowerCase().includes(term)) ||
            (f.codigo && f.codigo.toLowerCase().includes(term)) ||
            (f.propietario && f.propietario.toLowerCase().includes(term)) ||
            (f.cedulaRIF && f.cedulaRIF.toLowerCase().includes(term)) ||
            (f.bancoNombre && f.bancoNombre.toLowerCase().includes(term)) ||
            (f.numeroCuenta && f.numeroCuenta.toLowerCase().includes(term)) ||
            (f.cuentas && f.cuentas.some(c => (c.bancoNombre && c.bancoNombre.toLowerCase().includes(term)) || (c.numeroCuenta && c.numeroCuenta.toLowerCase().includes(term))))
        );
    }

    // Actualizar badge de total
    const badgeTotal = document.getElementById('badgeTotalFincas');
    if (badgeTotal) {
        badgeTotal.textContent = `${items.length} ${items.length === 1 ? 'Finca' : 'Fincas'}`;
    }

    // Ordenar
    items.sort((a, b) => {
        let valA, valB;
        if (dt.sortColumn === 'codigo') {
            valA = (a.codigo || '').toLowerCase();
            valB = (b.codigo || '').toLowerCase();
        } else if (dt.sortColumn === 'servicio') {
            valA = (a.tipoServicioNombre || (a.tipoServicioId === 2 ? 'TRANSPORTE' : 'RUTA')).toLowerCase();
            valB = (b.tipoServicioNombre || (b.tipoServicioId === 2 ? 'TRANSPORTE' : 'RUTA')).toLowerCase();
        } else if (dt.sortColumn === 'propietario') {
            valA = (a.propietario || '').toLowerCase();
            valB = (b.propietario || '').toLowerCase();
        } else if (dt.sortColumn === 'banco') {
            valA = (a.bancoNombre || '').toLowerCase();
            valB = (b.bancoNombre || '').toLowerCase();
        } else if (dt.sortColumn === 'precio') {
            valA = a.precioLitroUSD || 0;
            valB = b.precioLitroUSD || 0;
        } else if (dt.sortColumn === 'activo') {
            valA = a.activo ? 1 : 0;
            valB = b.activo ? 1 : 0;
        } else {
            valA = (a.nombre || '').toLowerCase();
            valB = (b.nombre || '').toLowerCase();
        }

        if (valA < valB) return dt.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return dt.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginación
    const totalItems = items.length;
    let pageSize = parseInt(dt.pageSize);
    if (isNaN(pageSize) || pageSize <= 0) pageSize = totalItems || 1;

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (dt.currentPage > totalPages) dt.currentPage = totalPages;
    if (dt.currentPage < 1) dt.currentPage = 1;

    const startIndex = (dt.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = dt.pageSize === -1 ? items : items.slice(startIndex, endIndex);

    // Actualizar texto info
    const infoSpan = document.getElementById('infoPaginacionFincas');
    if (infoSpan) {
        if (totalItems === 0) {
            infoSpan.textContent = 'Mostrando 0 a 0 de 0 registros';
        } else {
            infoSpan.textContent = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItems} registros`;
        }
    }

    renderPaginacionControls('paginacionFincas', dt.currentPage, totalPages, 'irAPaginaFincas');

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center" style="padding: 30px; color: #94a3b8;">
                    <i class="fa-solid fa-cow" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No se encontraron fincas ni productores registrados
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = paginatedItems.map(f => {
        const cuentas = f.cuentas || [];
        let bancoDisplay = '';

        if (cuentas.length > 0) {
            const principal = cuentas.find(c => c.esPrincipal) || cuentas[0];
            const extraCount = cuentas.length - 1;
            const tooltipTitle = cuentas.map(c => `${c.bancoNombre}: ${c.numeroCuenta || 'Sin cuenta'}${c.esPrincipal ? ' (Principal)' : ''}`).join(' | ');

            bancoDisplay = `
                <div style="font-weight: 700; color: #1d4ed8; font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" title="${tooltipTitle}">
                    <span><i class="fa-solid fa-building-columns"></i> ${principal.bancoNombre || 'Banco'}</span>
                    ${extraCount > 0 ? `<span class="badge badge-primary" style="font-size: 10px; padding: 2px 6px;">+${extraCount} ${extraCount === 1 ? 'Banco' : 'Bancos'}</span>` : ''}
                </div>
                ${principal.numeroCuenta 
                    ? `<small style="color: #475569; font-family: monospace; font-size: 11.5px; font-weight: 600;">${principal.numeroCuenta}</small>`
                    : `<small style="color: #d97706; font-size: 11px; font-weight: 600; font-style: italic;">Cuenta: Pendiente (Opcional)</small>`}
            `;
        } else if (f.bancoNombre && f.bancoNombre !== 'Sin Banco') {
            bancoDisplay = `
                <div style="font-weight: 700; color: #1d4ed8; font-size: 13px;"><i class="fa-solid fa-building-columns"></i> ${f.bancoNombre}</div>
                ${f.numeroCuenta 
                    ? `<small style="color: #475569; font-family: monospace; font-size: 11.5px; font-weight: 600;">${f.numeroCuenta}</small>`
                    : `<small style="color: #d97706; font-size: 11px; font-weight: 600; font-style: italic;">Cuenta: Pendiente (Opcional)</small>`}
            `;
        } else {
            bancoDisplay = `<span style="color: #94a3b8; font-size: 12px;">Sin cuentas registradas</span>`;
        }

        const tipoServId = f.tipoServicioId || 1;
        const badgeServicio = tipoServId === 2 
            ? `<span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1.5px solid #d8b4fe; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-truck"></i> TRANSPORTE</span>`
            : `<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-road"></i> RUTA</span>`;

        return `
            <tr>
                <td>
                    <span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 800; font-family: monospace; font-size: 12px; border: 1px solid #fde68a;">
                        ${f.codigo || 'FINCA-' + f.id}
                    </span>
                </td>
                <td>
                    <strong style="color: #0f172a; font-size: 14px; font-weight: 700;">${capitalizarTexto(f.nombre)}</strong>
                </td>
                <td style="text-align: center;">
                    ${badgeServicio}
                </td>
                <td>
                    <div style="font-weight: 700; color: #1e293b; font-size: 13.5px;">${capitalizarTexto(f.propietario)}</div>
                    ${f.cedulaRIF ? `<small style="color: #64748b; font-size: 11.5px; font-weight: 600;"><i class="fa-solid fa-id-card"></i> ${f.cedulaRIF}</small>` : ''}
                </td>
                <td>
                    <span style="color: #475569; font-size: 13px; font-weight: 500;">${f.telefono || '<span style="color:#94a3b8;">-</span>'}</span>
                </td>
                <td>
                    ${bancoDisplay}
                </td>
                <td style="text-align: right;">
                    ${f.tieneDosTiposLeche ? `
                        <div style="color: #047857; font-size: 13px; font-weight: 700;" title="Precio Vaca">🐄 $${(f.precioLitroUSD || 0).toFixed(4)}</div>
                        <div style="color: #0284c7; font-size: 12px; font-weight: 700;" title="Precio Búfala">🐃 $${(f.precioBufalaLitroUSD || 0).toFixed(4)}</div>
                    ` : `
                        <strong style="color: #047857; font-size: 14px; font-weight: 700;">$${(f.precioLitroUSD || 0).toFixed(4)}</strong>
                    `}
                </td>
                <td style="text-align: center;">
                    <span class="badge ${f.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 11.5px;">
                        <i class="fa-solid ${f.activo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${f.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarFinca(${f.id})" title="Editar Finca" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="eliminarFinca(${f.id}, '${f.nombre.replace(/'/g, "\\'")}')" title="Eliminar Finca" style="padding: 4px 8px; font-size: 12px; border-color: #fecdd3; color: #e11d48; background: #fff1f2;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
window.renderTablaFincas = renderTablaFincas;

function filtrarFincasCat(val) {
    state.datatableFincas.search = val;
    state.datatableFincas.currentPage = 1;
    renderTablaFincas();
}
window.filtrarFincasCat = filtrarFincasCat;

function cambiarPageSizeFincas(val) {
    state.datatableFincas.pageSize = parseInt(val);
    state.datatableFincas.currentPage = 1;
    renderTablaFincas();
}
window.cambiarPageSizeFincas = cambiarPageSizeFincas;

function ordenarFincas(col) {
    const dt = state.datatableFincas;
    if (dt.sortColumn === col) {
        dt.sortDirection = dt.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        dt.sortColumn = col;
        dt.sortDirection = 'asc';
    }

    ['codigo', 'nombre', 'servicio', 'propietario', 'banco', 'precio', 'activo'].forEach(c => {
        const icon = document.getElementById(`sort-fincas-${c}`);
        if (icon) {
            if (c === col) {
                icon.className = dt.sortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                icon.style.color = '#38bdf8';
            } else {
                icon.className = 'fa-solid fa-sort';
                icon.style.color = '';
            }
        }
    });

    renderTablaFincas();
}
window.ordenarFincas = ordenarFincas;

function irAPaginaFincas(page) {
    state.datatableFincas.currentPage = page;
    renderTablaFincas();
}
window.irAPaginaFincas = irAPaginaFincas;

// --- FUNCIONES DINÁMICAS DE FILAS DE BANCOS EN MODAL FINCA ---
function generarOpcionesBancosHtml(selectedBancoId = null) {
    const bancos = state.bancos || [];
    return '<option value="">-- Seleccionar Banco --</option>' + bancos.map(b => `
        <option value="${b.id}" ${selectedBancoId && parseInt(selectedBancoId) === b.id ? 'selected' : ''}>
            ${b.codigo ? b.codigo + ' - ' : ''}${b.nombre}
        </option>
    `).join('');
}

function agregarFilaCuentaFinca(cuenta = null) {
    const container = document.getElementById('contenedorCuentasFinca');
    if (!container) return;

    const rowId = 'cuenta_row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const bancosOptions = generarOpcionesBancosHtml(cuenta ? cuenta.bancoId : null);
    const numeroCuenta = cuenta ? (cuenta.numeroCuenta || '') : '';
    const esPrincipal = cuenta ? (cuenta.esPrincipal === true) : (container.children.length === 0);

    const row = document.createElement('div');
    row.className = 'fila-cuenta-finca';
    row.id = rowId;
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 1.3fr auto auto; gap: 10px; align-items: center; background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; margin-bottom: 8px;';

    row.innerHTML = `
        <div>
            <select class="form-input select-banco-finca" required style="height: 40px; font-size: 13px; font-weight: 700; color: #0f172a; width: 100%; border: 1.5px solid #3b82f6; background: #ffffff;" title="Banco / Entidad Financiera (IMPORTANTE)">
                ${bancosOptions}
            </select>
        </div>
        <div>
            <input type="text" class="form-input input-cuenta-finca" maxlength="20" placeholder="N° de Cuenta (Opcional)" value="${numeroCuenta}" style="height: 40px; font-size: 13px; font-weight: 700; font-family: monospace; letter-spacing: 0.5px; width: 100%; color: #0f172a; border: 1.5px solid #cbd5e1; background: #ffffff;" title="Número de cuenta (Opcional - Próximamente obligatorio)">
        </div>
        <div>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #1e293b; font-size: 12px; font-weight: 700; white-space: nowrap; margin-bottom: 0; user-select: none;" title="Marcar como cuenta principal para transferencias">
                <input type="radio" name="radioCuentaPrincipalFinca" class="radio-cuenta-principal" ${esPrincipal ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: #2563eb; cursor: pointer;">
                <span>Principal</span>
            </label>
        </div>
        <div>
            <button type="button" class="btn btn-outline btn-eliminar-cuenta-finca" onclick="eliminarFilaCuentaFinca('${rowId}')" title="Eliminar este banco" style="padding: 0; width: 36px; height: 40px; border-color: #fecdd3; color: #e11d48; background: #fff1f2; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;

    container.appendChild(row);
}
window.agregarFilaCuentaFinca = agregarFilaCuentaFinca;

function eliminarFilaCuentaFinca(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const container = document.getElementById('contenedorCuentasFinca');
    
    // Si queda solo una fila, limpiarla en vez de borrarla
    if (container && container.children.length <= 1) {
        const select = row.querySelector('.select-banco-finca');
        const input = row.querySelector('.input-cuenta-finca');
        if (select) select.value = '';
        if (input) input.value = '';
        return;
    }

    const wasChecked = row.querySelector('.radio-cuenta-principal')?.checked;
    row.remove();

    // Si la eliminada era principal, marcar la primera que quede como principal
    if (wasChecked && container && container.children.length > 0) {
        const firstRadio = container.querySelector('.radio-cuenta-principal');
        if (firstRadio) firstRadio.checked = true;
    }
}
window.eliminarFilaCuentaFinca = eliminarFilaCuentaFinca;

let comboboxFincaPropietarioInstance = null;

async function inicializarComboboxFincaPropietario() {
    const container = document.getElementById('comboboxFincaPropietario');
    if (!container) return;

    if (!state.propietarios || state.propietarios.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/propietarios`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) state.propietarios = await res.json() || [];
        } catch (e) {
            console.warn('Error cargando propietarios:', e);
        }
    }

    if (!comboboxFincaPropietarioInstance) {
        comboboxFincaPropietarioInstance = setupCombobox({
            containerId: 'comboboxFincaPropietario',
            inputSearchId: 'searchFincaPropietarioInput',
            inputHiddenId: 'modalFincaPropietarioId',
            dropdownId: 'dropdownFincaPropietarioList',
            placeholder: 'SELECCIONE PROPIETARIO...',
            getItemsFn: () => {
                return (state.propietarios || []).map(p => ({
                    value: String(p.id || p.Id),
                    label: p.nombre || p.Nombre || '',
                    raw: p
                }));
            },
            onSelect: (item) => {
                const propHidden = document.getElementById('modalFincaPropietario');
                const rifInput = document.getElementById('modalFincaCedula');
                const telInput = document.getElementById('modalFincaTelefono');
                if (propHidden) propHidden.value = item ? item.label : '';
                if (item && item.raw) {
                    if (rifInput && item.raw.cedulaRIF && !rifInput.value) rifInput.value = item.raw.cedulaRIF;
                    if (telInput && item.raw.telefono && !telInput.value) telInput.value = item.raw.telefono;
                }
            }
        });
    }
}

function toggleFincaTipoServicio(tipoServicioId) {
    const group = document.getElementById('groupFincaCompaniaDestino');
    if (group) {
        group.style.display = String(tipoServicioId) === '2' ? 'block' : 'none';
    }
}
window.toggleFincaTipoServicio = toggleFincaTipoServicio;

function poblarSelectCompaniasFinca(selectedVal = '') {
    const select = document.getElementById('modalFincaCompaniaId');
    if (!select) return;
    const companias = (state.companias || []).filter(c => c.activo !== false);
    let html = '<option value="">-- Sin Compañía Asignada (Seleccionar al Despachar) --</option>';
    companias.forEach(c => {
        const id = c.id || c.Id;
        const nom = (c.nombre || c.Nombre || '').trim().toUpperCase();
        const esRecep = nom.includes('RECEPTORIA') || nom.includes('RECEPTORÍA');
        const badge = esRecep ? '🏛️ (Receptoría)' : '🏭 (Quesera/Planta)';
        html += `<option value="${id}">${nom} ${badge}</option>`;
    });
    select.innerHTML = html;
    if (selectedVal) {
        select.value = String(selectedVal);
    }
}
window.poblarSelectCompaniasFinca = poblarSelectCompaniasFinca;

async function abrirModalCrearFinca() {
    await inicializarComboboxFincaPropietario();
    if (comboboxFincaPropietarioInstance) comboboxFincaPropietarioInstance.selectItem('', '');

    // Asegurar compañías cargadas para el selector de destino
    if (!state.companias || state.companias.length === 0) {
        try {
            const resC = await fetch(`${API_BASE}/catalogos/companias`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (resC.ok) state.companias = await resC.json();
        } catch (e) {}
    }

    document.getElementById('modalFincaTitle').textContent = 'Registrar Nueva Finca / Productor';
    document.getElementById('modalFincaId').value = '';
    document.getElementById('modalFincaCodigo').value = 'FINCA-AUTO';
    document.getElementById('modalFincaNombre').value = '';
    document.getElementById('modalFincaPropietario').value = '';
    document.getElementById('modalFincaCedula').value = '';
    document.getElementById('modalFincaTelefono').value = '';
    document.getElementById('modalFincaPrecio').value = '0.3500';
    if (document.getElementById('modalFincaPrecioAcida')) document.getElementById('modalFincaPrecioAcida').value = '0.2000';
    if (document.getElementById('modalFincaTipoServicioId')) {
        document.getElementById('modalFincaTipoServicioId').value = '1';
        toggleFincaTipoServicio('1');
    }
    poblarSelectCompaniasFinca('');
    document.getElementById('modalFincaActivo').checked = true;

    const checkDualCrear = document.getElementById('modalFincaTieneDosTiposLeche');
    if (checkDualCrear) {
        checkDualCrear.checked = false;
        togglePrecioBufalaFinca(false);
    }
    if (document.getElementById('modalFincaPrecioBufala')) document.getElementById('modalFincaPrecioBufala').value = '0.4000';

    // Asegurar bancos cargados
    if (!state.bancos || state.bancos.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/catalogos/bancos`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.bancos = await res.json();
        } catch (e) {}
    }

    const container = document.getElementById('contenedorCuentasFinca');
    if (container) {
        container.innerHTML = '';
        agregarFilaCuentaFinca(); // Agregar primera fila limpia
    }

    const modal = document.getElementById('modalFincaCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalCrearFinca = abrirModalCrearFinca;

function togglePrecioBufalaFinca(checked) {
    const group = document.getElementById('groupPrecioBufalaFinca');
    const grid = document.getElementById('gridPreciosFinca');
    const label = document.getElementById('labelModalFincaPrecio');
    if (group) group.style.display = checked ? 'block' : 'none';
    if (grid) grid.style.gridTemplateColumns = checked ? '1fr 1fr 1fr' : '1fr 1fr';
    if (label) label.innerHTML = checked ? '🐄 Precio Vaca ($/Lt) <span style="color: #e11d48;">*</span>' : 'Precio Normal ($/Lt) <span style="color: #e11d48;">*</span>';
}
window.togglePrecioBufalaFinca = togglePrecioBufalaFinca;

async function abrirModalEditarFinca(id) {
    const finca = state.fincas.find(f => f.id === id);
    if (!finca) return;

    // Asegurar compañías cargadas para el selector de destino
    if (!state.companias || state.companias.length === 0) {
        try {
            const resC = await fetch(`${API_BASE}/catalogos/companias`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (resC.ok) state.companias = await resC.json();
        } catch (e) {}
    }

    await inicializarComboboxFincaPropietario();

    document.getElementById('modalFincaTitle').textContent = 'Editar Finca / Productor';
    document.getElementById('modalFincaId').value = finca.id;
    document.getElementById('modalFincaCodigo').value = finca.codigo || ('FINCA-' + finca.id);
    document.getElementById('modalFincaNombre').value = finca.nombre || '';
    document.getElementById('modalFincaCedula').value = finca.cedulaRIF || '';
    document.getElementById('modalFincaTelefono').value = finca.telefono || '';
    document.getElementById('modalFincaPrecio').value = (finca.precioLitroUSD || 0).toFixed(4);
    if (document.getElementById('modalFincaPrecioAcida')) document.getElementById('modalFincaPrecioAcida').value = (finca.precioLitroAcidaUSD || 0).toFixed(4);
    if (document.getElementById('modalFincaTipoServicioId')) {
        const servId = String(finca.tipoServicioId || 1);
        document.getElementById('modalFincaTipoServicioId').value = servId;
        toggleFincaTipoServicio(servId);
    }
    poblarSelectCompaniasFinca(finca.companiaId || finca.CompaniaId || '');
    document.getElementById('modalFincaActivo').checked = finca.activo !== false;

    const esDual = !!(finca.tieneDosTiposLeche || finca.TieneDosTiposLeche);
    const checkDualEdit = document.getElementById('modalFincaTieneDosTiposLeche');
    if (checkDualEdit) {
        checkDualEdit.checked = esDual;
        togglePrecioBufalaFinca(esDual);
    }
    if (document.getElementById('modalFincaPrecioBufala')) {
        const pBuf = (finca.precioBufalaLitroUSD != null ? finca.precioBufalaLitroUSD : finca.PrecioBufalaLitroUSD) || 0;
        document.getElementById('modalFincaPrecioBufala').value = Number(pBuf).toFixed(4);
    }

    // Seleccionar Propietario en el combobox
    const propObj = (state.propietarios || []).find(p => p.id === finca.propietarioId || (p.nombre && p.nombre.trim().toLowerCase() === (finca.propietario || '').trim().toLowerCase()));
    const targetPropId = propObj ? String(propObj.id) : String(finca.propietarioId || '');
    const targetPropNombre = propObj ? propObj.nombre : (finca.propietario || '');

    if (comboboxFincaPropietarioInstance) {
        comboboxFincaPropietarioInstance.selectItem(targetPropId, targetPropNombre);
    } else {
        const inputProp = document.getElementById('searchFincaPropietarioInput');
        const inputPropHidden = document.getElementById('modalFincaPropietario');
        const inputPropIdHidden = document.getElementById('modalFincaPropietarioId');
        if (inputProp) inputProp.value = targetPropNombre;
        if (inputPropHidden) inputPropHidden.value = targetPropNombre;
        if (inputPropIdHidden) inputPropIdHidden.value = targetPropId;
    }

    // Asegurar bancos cargados
    if (!state.bancos || state.bancos.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/catalogos/bancos`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.bancos = await res.json();
        } catch (e) {}
    }

    const container = document.getElementById('contenedorCuentasFinca');
    if (container) {
        container.innerHTML = '';
        if (finca.cuentas && finca.cuentas.length > 0) {
            finca.cuentas.forEach(c => agregarFilaCuentaFinca(c));
        } else if (finca.bancoId) {
            agregarFilaCuentaFinca({ bancoId: finca.bancoId, numeroCuenta: finca.numeroCuenta || '', esPrincipal: true });
        } else {
            agregarFilaCuentaFinca();
        }
    }

    const modal = document.getElementById('modalFincaCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalEditarFinca = abrirModalEditarFinca;

async function guardarFincaSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalFincaId').value;
    const codigo = document.getElementById('modalFincaCodigo').value.trim();
    const nombre = document.getElementById('modalFincaNombre').value.trim();
    const tipoServicioId = parseInt(document.getElementById('modalFincaTipoServicioId')?.value || '1') || 1;
    const companiaIdRaw = document.getElementById('modalFincaCompaniaId')?.value;
    const companiaId = (companiaIdRaw && companiaIdRaw !== '') ? parseInt(companiaIdRaw) : null;
    const propietarioIdRaw = document.getElementById('modalFincaPropietarioId')?.value || '';
    const propietarioId = propietarioIdRaw ? parseInt(propietarioIdRaw) : null;
    const propietario = (document.getElementById('searchFincaPropietarioInput')?.value || document.getElementById('modalFincaPropietario')?.value || '').trim();
    const cedulaRIF = document.getElementById('modalFincaCedula').value.trim();
    const telefono = document.getElementById('modalFincaTelefono').value.trim();
    const precioLitroUSD = parseFloat((document.getElementById('modalFincaPrecio')?.value || '').trim().replace(',', '.')) || 0;
    const precioLitroAcidaUSD = parseFloat((document.getElementById('modalFincaPrecioAcida')?.value || '').trim().replace(',', '.')) || 0;
    const tieneDosTiposLeche = document.getElementById('modalFincaTieneDosTiposLeche')?.checked || false;
    const rawBufalaVal = (document.getElementById('modalFincaPrecioBufala')?.value || '').trim().replace(',', '.');
    const precioBufalaLitroUSD = rawBufalaVal !== '' ? (parseFloat(rawBufalaVal) || 0) : (tieneDosTiposLeche ? precioLitroUSD : null);
    const activo = document.getElementById('modalFincaActivo').checked;

    if (!nombre) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'El nombre de la finca es obligatorio', background: '#1e293b', color: '#f8fafc' });
        return;
    }
    if (!propietario) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Debe seleccionar un Propietario / Ganadero de la lista', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    // Extraer lista de cuentas bancarias
    const container = document.getElementById('contenedorCuentasFinca');
    const cuentas = [];
    if (container) {
        const rows = container.querySelectorAll('.fila-cuenta-finca');
        rows.forEach(row => {
            const bancoSelect = row.querySelector('.select-banco-finca');
            const numInput = row.querySelector('.input-cuenta-finca');
            const radioPrincipal = row.querySelector('.radio-cuenta-principal');

            const bancoId = bancoSelect && bancoSelect.value ? parseInt(bancoSelect.value) : 0;
            const numeroCuenta = numInput ? numInput.value.trim() : '';
            const esPrincipal = radioPrincipal ? radioPrincipal.checked : false;

            // El banco es importante: si seleccionó un banco, se agrega la cuenta (el número de cuenta es opcional)
            if (bancoId > 0) {
                cuentas.push({
                    bancoId,
                    numeroCuenta,
                    titular: propietario,
                    cedulaRIF: cedulaRIF,
                    esPrincipal
                });
            }
        });
    }

    // Si hay cuentas pero ninguna marcada como principal, marcar la primera
    if (cuentas.length > 0 && !cuentas.some(c => c.esPrincipal)) {
        cuentas[0].esPrincipal = true;
    }

    const payload = {
        codigo,
        nombre,
        tipoServicioId,
        companiaId,
        propietarioId,
        propietario,
        cedulaRIF,
        telefono,
        precioLitroUSD,
        precioLitroAcidaUSD,
        tieneDosTiposLeche,
        precioBufalaLitroUSD,
        activo,
        cuentas,
        bancoId: cuentas.length > 0 ? (cuentas.find(c => c.esPrincipal) || cuentas[0]).bancoId : null,
        numeroCuenta: cuentas.length > 0 ? (cuentas.find(c => c.esPrincipal) || cuentas[0]).numeroCuenta : null
    };

    const isEdit = id && id !== '';
    const url = isEdit ? `${API_BASE}/catalogos/fincas/${id}` : `${API_BASE}/catalogos/fincas`;
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
            const err = await res.json().catch(() => ({ message: 'Error al procesar la solicitud' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalFincaCustom');
        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Finca Actualizada' : 'Finca Registrada',
            text: `La finca "${nombre}" fue guardada exitosamente con ${cuentas.length} ${cuentas.length === 1 ? 'cuenta bancaria' : 'cuentas bancarias'}.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        await cargarFincasCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.guardarFincaSubmit = guardarFincaSubmit;

async function eliminarFinca(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar Finca?',
        html: `¿Estás seguro de que deseas eliminar la finca <strong>${nombre}</strong>?<br><small style="color: #94a3b8;">Esta acción la removerá de las rutas y del catálogo activo.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/catalogos/fincas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'No se pudo eliminar la finca' }));
            throw new Error(err.message);
        }

        Swal.fire({
            icon: 'success',
            title: 'Finca Eliminada',
            text: 'El registro fue removido correctamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });

        await cargarFincasCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error al Eliminar', text: err.message, background: '#1e293b', color: '#f8fafc' });
    }
}
window.eliminarFinca = eliminarFinca;


// --- HELPER COMPARTIDO PARA PAGINACIÓN ---
function renderPaginacionControls(containerId, currentPage, totalPages, onClickFnName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let buttonsHtml = '';

    buttonsHtml += `
        <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;" 
            ${currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : `onclick="${onClickFnName}(${currentPage - 1})"`}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            const isActive = p === currentPage;
            buttonsHtml += `
                <button type="button" class="btn ${isActive ? 'btn-primary' : 'btn-outline'}" 
                    style="padding: 4px 10px; font-size: 12px; min-width: 32px; font-weight: ${isActive ? '700' : '500'};"
                    onclick="${onClickFnName}(${p})">
                    ${p}
                </button>
            `;
        } else if (p === currentPage - 2 || p === currentPage + 2) {
            buttonsHtml += `<span style="color: #64748b; font-size: 12px; padding: 0 2px;">...</span>`;
        }
    }

    buttonsHtml += `
        <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 12px;" 
            ${currentPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : `onclick="${onClickFnName}(${currentPage + 1})"`}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = buttonsHtml;
}
window.renderPaginacionControls = renderPaginacionControls;
