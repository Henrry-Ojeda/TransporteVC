// =====================================================================
// MÓDULO: TRAZABILIDAD Y CONTROL DE LECHE BÚFALA
// =====================================================================

let stateBufala = {
    modoFiltro: 'semana', // 'semana' | 'rango'
    tipoServicio: 'TODOS', // 'TODOS' | 'RUTA' | 'TRANSPORTE'
    datos: null,
    detalleOriginal: []
};

function cambiarTipoServicioBufala(tipo) {
    stateBufala.tipoServicio = tipo || 'TODOS';
    const btns = document.querySelectorAll('.btn-tipo-bufala');
    btns.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.fontWeight = '700';
    });

    const activeBtn = document.getElementById(`btnTipoServicioBufala${tipo === 'TODOS' ? 'Todos' : (tipo === 'RUTA' ? 'Ruta' : 'Transporte')}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = '#6366f1';
        activeBtn.style.color = '#ffffff';
        activeBtn.style.fontWeight = '800';
    }

    cargarTrazabilidadBufala();
}
window.cambiarTipoServicioBufala = cambiarTipoServicioBufala;

async function cargarTrazabilidadBufala() {
    try {
        const tbody = document.getElementById('tbodyTrazabilidadBufala');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 8px; display: block; color: #0d9488;"></i>
                        Cargando trazabilidad de leche de búfala...
                    </td>
                </tr>`;
        }

        // 1. Inicializar Selectores si están vacíos
        await inicializarSelectoresBufala();

        // 2. Construir Parámetros de Filtro
        let params = new URLSearchParams();

        if (stateBufala.modoFiltro === 'semana') {
            const selSemana = document.getElementById('selectSemanaBufala');
            if (selSemana && selSemana.value) {
                params.append('cicloId', selSemana.value);
            }
        } else {
            const fechaDesde = document.getElementById('filtroFechaDesdeBufala')?.value;
            const fechaHasta = document.getElementById('filtroFechaHastaBufala')?.value;
            if (fechaDesde) params.append('fechaDesde', fechaDesde);
            if (fechaHasta) params.append('fechaHasta', fechaHasta);
        }

        const fincaId = document.getElementById('selectFincaFiltroBufala')?.value;
        if (fincaId) params.append('fincaId', fincaId);

        const companiaId = document.getElementById('selectCompaniaFiltroBufala')?.value;
        if (companiaId) params.append('companiaId', companiaId);

        const usuarioId = document.getElementById('selectChoferFiltroBufala')?.value;
        if (usuarioId) params.append('usuarioId', usuarioId);

        if (stateBufala.tipoServicio && stateBufala.tipoServicio !== 'TODOS') {
            params.append('tipoServicio', stateBufala.tipoServicio);
        }

        // 3. Consultar API Backend
        const resp = await fetch(`${API_BASE}/control-companias/trazabilidad-bufala?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!resp.ok) {
            throw new Error('Error al cargar la trazabilidad de búfala.');
        }

        const data = await resp.json();
        stateBufala.datos = data;
        stateBufala.detalleOriginal = data.detalle || [];

        // 4. Actualizar Tarjetas KPI
        actualizarKpisBufala(data);

        // 5. Renderizar Tablas
        renderTrazabilidadBufala(stateBufala.detalleOriginal);
        renderMatrizBufala(stateBufala.detalleOriginal);
        renderResumenFincasBufala(stateBufala.detalleOriginal);

    } catch (err) {
        console.error('Error en cargarTrazabilidadBufala:', err);
        const tbody = document.getElementById('tbodyTrazabilidadBufala');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 30px; color: #ef4444; font-weight: 700;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 6px; display: block;"></i>
                        ${err.message || 'No se pudo cargar la trazabilidad.'}
                    </td>
                </tr>`;
        }
    }
}
window.cargarTrazabilidadBufala = cargarTrazabilidadBufala;

async function inicializarSelectoresBufala() {
    const selSemana = document.getElementById('selectSemanaBufala');
    const selFinca = document.getElementById('selectFincaFiltroBufala');
    const selComp = document.getElementById('selectCompaniaFiltroBufala');
    const selChofer = document.getElementById('selectChoferFiltroBufala');

    // Cargar en paralelo catálogos si no existen en memoria
    const fetchPromises = [];
    if (selSemana && (selSemana.options.length <= 1 || selSemana.options[0].value === '') && (!state.semanas || state.semanas.length === 0)) {
        fetchPromises.push(fetch(`${API_BASE}/ciclos`, { headers: { 'Authorization': `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).then(d => { state.semanas = d; }).catch(() => {}));
    }
    if (selFinca && selFinca.options.length <= 1 && (!state.fincas || state.fincas.length === 0)) {
        fetchPromises.push(fetch(`${API_BASE}/catalogos/fincas`, { headers: { 'Authorization': `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).then(d => { state.fincas = d; }).catch(() => {}));
    }
    if (selComp && selComp.options.length <= 1 && (!state.companias || state.companias.length === 0)) {
        fetchPromises.push(fetch(`${API_BASE}/catalogos/companias`, { headers: { 'Authorization': `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).then(d => { state.companias = d; }).catch(() => {}));
    }
    if (selChofer && selChofer.options.length <= 1 && (!state.usuarios || state.usuarios.length === 0)) {
        fetchPromises.push(fetch(`${API_BASE}/usuarios`, { headers: { 'Authorization': `Bearer ${state.token}` } }).then(r => r.ok ? r.json() : []).then(d => { state.usuarios = d; }).catch(() => {}));
    }

    if (fetchPromises.length > 0) {
        await Promise.all(fetchPromises);
    }

    // 1. Semanas Operativas
    if (selSemana && (selSemana.options.length <= 1 || selSemana.options[0].value === '') && state.semanas && state.semanas.length > 0) {
        const hoy = new Date().toISOString().split('T')[0];
        const formatF = (d) => {
            if (!d) return '';
            const parts = d.substring(0, 10).split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d.substring(0, 10);
        };

        const semanasFiltradas = state.semanas.filter(s => {
            const estado = (s.estado || s.Estado || '').toUpperCase();
            if (estado === 'ABIERTO' || estado === 'CERRADO') return true;
            const fIni = (s.fechaInicio || s.FechaInicio || '').substring(0, 10);
            return fIni && fIni <= hoy;
        });

        semanasFiltradas.sort((a, b) => {
            const estA = (a.estado || a.Estado || '').toUpperCase() === 'ABIERTO' ? 1 : 0;
            const estB = (b.estado || b.Estado || '').toUpperCase() === 'ABIERTO' ? 1 : 0;
            if (estA !== estB) return estB - estA;

            const fA = (a.fechaInicio || a.FechaInicio || '').substring(0, 10);
            const fB = (b.fechaInicio || b.FechaInicio || '').substring(0, 10);
            return fB.localeCompare(fA);
        });

        const listaFinal = semanasFiltradas.length > 0 ? semanasFiltradas : state.semanas;

        selSemana.innerHTML = listaFinal.map(s => {
            const id = s.id || s.Id;
            const semNum = s.numeroSemana || s.NumeroSemana || id;
            const fInicio = s.fechaInicio || s.FechaInicio || '';
            const fFin = s.fechaFin || s.FechaFin || '';
            const formatRango = fInicio ? `${formatF(fInicio)} al ${formatF(fFin)}` : '';
            const estado = (s.estado || s.Estado || '').toUpperCase();
            const esActivo = estado === 'ABIERTO' || s.activo || s.Activo;
            const badgeEstado = esActivo ? '⭐ [ACTIVA]' : (estado ? `[${estado}]` : '');
            return `<option value="${id}" ${esActivo ? 'selected' : ''}>Semana S${semNum} (${formatRango}) ${badgeEstado}</option>`;
        }).join('');
    }

    // 2. Fincas de Búfala
    if (selFinca && selFinca.options.length <= 1 && state.fincas && state.fincas.length > 0) {
        const fincasBufala = state.fincas.filter(f => {
            const nom = (f.nombre || f.Nombre || '').toUpperCase();
            const tieneDos = f.tieneDosTiposLeche || f.TieneDosTiposLeche;
            const pBuf = f.precioBufalaLitroUSD || f.PrecioBufalaLitroUSD;
            return nom.includes('BUFAL') || tieneDos || (pBuf && pBuf > 0);
        });

        const fincasLista = fincasBufala.length > 0 ? fincasBufala : state.fincas;
        selFinca.innerHTML = '<option value="">🏡 TODAS LAS FINCAS DE BÚFALA</option>' +
            fincasLista.map(f => {
                const id = f.id || f.Id;
                const nombre = (f.nombre || f.Nombre || '').trim();
                const prop = (f.propietario || f.Propietario || '').trim();
                const servId = f.tipoServicioId || f.TipoServicioId || 1;
                const servTxt = servId === 2 ? '[TRANSPORTE]' : '[RUTA]';
                return `<option value="${id}">${nombre} (${prop || 'Sin prop.'}) ${servTxt}</option>`;
            }).join('');
    }

    // 3. Compañías
    if (selComp && selComp.options.length <= 1 && state.companias && state.companias.length > 0) {
        selComp.innerHTML = '<option value="">🏢 TODAS LAS COMPAÑÍAS</option>' +
            state.companias.map(c => {
                const id = c.id || c.Id;
                const nombre = (c.nombre || c.Nombre || '').trim();
                const servId = c.tipoServicioId || c.TipoServicioId || 1;
                const servTxt = servId === 2 ? '[TRANSPORTE]' : '[RUTA]';
                return `<option value="${id}">${nombre} ${servTxt}</option>`;
            }).join('');
    }

    // 4. Choferes
    if (selChofer && selChofer.options.length <= 1 && state.usuarios && state.usuarios.length > 0) {
        const choferes = state.usuarios.filter(u => (u.rol || u.Rol || '').toUpperCase() === 'CHOFER' || u.rolId === 2 || (u.rol || u.Rol || '').toUpperCase() === 'ADMIN');
        const listaChof = choferes.length > 0 ? choferes : state.usuarios;
        selChofer.innerHTML = '<option value="">🚚 TODOS LOS CONDUCTORES</option>' +
            listaChof.map(u => {
                const id = u.id || u.Id;
                const nombre = (u.nombreCompleto || u.NombreCompleto || u.username || u.Username || '').trim();
                return `<option value="${id}">${nombre}</option>`;
            }).join('');
    }
}

function actualizarKpisBufala(data) {
    const kpiFincas = document.getElementById('kpiBufalaLitrosFincas');
    if (kpiFincas) kpiFincas.innerHTML = `${(data.totalLitrosFincas || 0).toLocaleString('es-VE')} <small style="font-size: 13px; font-weight: 700; color: #0d9488;">Lts</small>`;

    const kpiRutaFincas = document.getElementById('kpiBufalaFincasRutaLitros');
    if (kpiRutaFincas) kpiRutaFincas.textContent = (data.totalLitrosRuta || 0).toLocaleString('es-VE');

    const kpiTransFincas = document.getElementById('kpiBufalaFincasTransporteLitros');
    if (kpiTransFincas) kpiTransFincas.textContent = (data.totalLitrosTransporte || 0).toLocaleString('es-VE');

    // 2. EN TANQUES RECEPTORÍA
    const kpiTanques = document.getElementById('kpiBufalaLitrosTanques');
    if (kpiTanques) kpiTanques.innerHTML = `${(data.totalLitrosTanques || 0).toLocaleString('es-VE')} <small style="font-size: 13px; font-weight: 700; color: #2563eb;">Lts</small>`;

    // 3. EN COMPAÑÍAS (VENTA / PLANTA)
    const kpiCompanias = document.getElementById('kpiBufalaLitrosCompanias');
    if (kpiCompanias) kpiCompanias.innerHTML = `${(data.totalLitrosCompaniasDirectas || 0).toLocaleString('es-VE')} <small style="font-size: 13px; font-weight: 700; color: #7e22ce;">Lts</small>`;

    const kpiCompRuta = document.getElementById('kpiBufalaCompaniasRutaLitros');
    if (kpiCompRuta) kpiCompRuta.textContent = (data.totalCompaniasDirectasRuta || 0).toLocaleString('es-VE');

    const kpiCompTrans = document.getElementById('kpiBufalaCompaniasTransporteLitros');
    if (kpiCompTrans) kpiCompTrans.textContent = (data.totalCompaniasDirectasTransporte || 0).toLocaleString('es-VE');

    // 4. MERMA Y BALANCE GLOBAL
    const kpiMerma = document.getElementById('kpiBufalaMermaLitros');
    const dif = data.totalDiferenciaLitros || 0;
    if (kpiMerma) {
        const sign = dif > 0 ? '-' : (dif < 0 ? '+' : '');
        kpiMerma.innerHTML = `${sign}${Math.abs(dif).toLocaleString('es-VE')} <small style="font-size: 13px; font-weight: 700; color: #c2410c;">Lts</small>`;
    }

    const kpiMermaPct = document.getElementById('kpiBufalaMermaPct');
    if (kpiMermaPct) {
        kpiMermaPct.textContent = `${(data.porcentajeMermaGlobal || 0).toFixed(2)}% Merma`;
        kpiMermaPct.style.color = (data.porcentajeMermaGlobal || 0) > 1.0 ? '#e11d48' : '#059669';
    }

    // 5. VIAJES
    const kpiViajes = document.getElementById('kpiBufalaViajesCount');
    if (kpiViajes) kpiViajes.innerHTML = `${data.cantidadViajes || 0} <small style="font-size: 13px; font-weight: 700; color: #0369a1;">Viajes</small>`;

    const kpiPromedio = document.getElementById('kpiBufalaPromedioPorViaje');
    if (kpiPromedio) {
        const promedio = data.cantidadViajes > 0 ? Math.round(data.totalLitrosFincas / data.cantidadViajes) : 0;
        kpiPromedio.textContent = `${promedio.toLocaleString('es-VE')} Lts promedio / viaje`;
    }
}

function renderTrazabilidadBufala(lista) {
    const tbody = document.getElementById('tbodyTrazabilidadBufala');
    const lblContador = document.getElementById('lblContadorTrazabilidadBufala');
    if (lblContador) lblContador.textContent = `${lista.length} Registros`;

    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8; font-weight: 600;">
                    <i class="fa-solid fa-cow" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No se encontraron registros de leche de búfala con los filtros aplicados.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = lista.map((item, idx) => {
        const fechaRaw = item.fecha ? item.fecha.substring(0, 10) : '';
        let fechaFormateada = fechaRaw;
        let diaNom = '';
        if (fechaRaw) {
            const parts = fechaRaw.split('-');
            if (parts.length === 3) {
                fechaFormateada = `${parts[2]}/${parts[1]}/${parts[0]}`;
                const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
                const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
                diaNom = diasSemana[dt.getDay()];
            }
        }

        const semTag = item.cicloId ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:800; padding:1px 5px; border-radius:4px; margin-right:4px;">S${item.cicloId}</span>` : '';

        const esTransporte = (item.tipoServicio || '').toUpperCase() === 'TRANSPORTE';
        const badgeServicio = esTransporte 
            ? '<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:800; font-size:10.5px; padding:2px 7px;">🚛 TRANSPORTE</span>'
            : '<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; font-size:10.5px; padding:2px 7px;">🏠 RUTA</span>';

        const difLitros = item.diferenciaLitros || 0;
        const pctMerma = item.porcentajeMerma || 0;
        let mermaBadge = '<span class="badge" style="background:#ecfdf5; color:#047857; font-weight:700; font-size:11px;">0 L (Exacto)</span>';
        if (difLitros > 0) {
            mermaBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:800; font-size:11px;">-${difLitros} L (${pctMerma.toFixed(2)}%)</span>`;
        } else if (difLitros < 0) {
            mermaBadge = `<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:800; font-size:11px;">+${Math.abs(difLitros)} L (Sobrante)</span>`;
        }

        const estadoColor = item.estadoViaje === 'FINALIZADO' || item.estadoViaje === 'CERRADO' ? '#059669' : '#d97706';
        const estadoBg = item.estadoViaje === 'FINALIZADO' || item.estadoViaje === 'CERRADO' ? '#ecfdf5' : '#fffbeb';

        const totalDespacho = item.litrosRecibidosCompania || item.litrosDespachadosCompania || 0;

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px 14px; text-align: center; white-space: nowrap;">
                    ${semTag}
                    <strong style="color: #0f172a; font-size: 13px;">${fechaFormateada}</strong>
                    <br><small style="color: #0d9488; font-weight: 800; font-size: 10.5px; text-transform: uppercase;">${diaNom}</small>
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    ${badgeServicio}
                </td>
                <td style="padding: 12px 14px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="badge" style="background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">🐃 BÚFALA</span>
                        <strong style="color: #0f172a; font-size: 13.5px;">${item.fincaNombre}</strong>
                    </div>
                    <small style="color: #64748b; display: block; margin-top: 2px;">
                        <i class="fa-solid fa-user-tag" style="color: #94a3b8; font-size: 10px;"></i> ${item.propietario}
                    </small>
                </td>
                <td style="padding: 12px 14px; text-align: right;">
                    <strong style="color: #059669; font-size: 14.5px; font-family: monospace;">
                        ${(item.litrosFinca || 0).toLocaleString('es-VE')}
                    </strong>
                    <span style="font-size: 11px; color: #059669; font-weight: 700;">Lts</span>
                </td>
                <td style="padding: 12px 14px;">
                    <strong style="color: #1e293b; font-size: 13px;">${item.choferNombre}</strong>
                    ${item.controlRutaId ? `<br><span class="badge badge-info" style="font-size: 10.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; margin-top: 3px;" onclick="if(typeof abrirModalTrazabilidadViaje==='function') abrirModalTrazabilidadViaje(${item.controlRutaId})" title="Ver trazabilidad del viaje"><i class="fa-solid fa-route"></i> Ticket #${item.controlRutaId}</span>` : ''}
                </td>
                <td style="padding: 12px 14px;">
                    ${(() => {
                        const esTanque = item.esTanqueReceptoria || (item.companiaNombre || '').toUpperCase().includes('RECEPTORIA');
                        if (esTanque) {
                            return `
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                                        <span class="badge" style="background: #e0f2fe; color: #0369a1; border: 1.5px solid #7dd3fc; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(3,105,161,0.08);">
                                            <i class="fa-solid fa-boxes-stacked" style="color: #0284c7;"></i> TANQUES (Receptoría Acopio)
                                        </span>
                                    </div>
                                    ${item.controlCompaniaId ? `<small style="color: #64748b; font-weight: 600; font-size: 11px;">Entrada a Tanque #${item.controlCompaniaId} ${totalDespacho > 0 ? `(${totalDespacho.toLocaleString('es-VE')} L)` : ''}</small>` : ''}
                                    ${item.destinosFinales ? `
                                        <div style="display: inline-flex; align-items: center; gap: 5px; background: #faf5ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #e9d5ff; font-size: 11px; color: #6b21a8; font-weight: 700; margin-top: 2px;">
                                            <i class="fa-solid fa-arrow-right" style="color: #9333ea; font-size: 10px;"></i>
                                            <span>Salida / Destino: <strong>${item.destinosFinales}</strong></span>
                                        </div>
                                    ` : `<small style="color: #94a3b8; font-style: italic; font-size: 10.5px;">En Tanque de Almacenamiento</small>`}
                                </div>`;
                        } else {
                            return `
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                                        <span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1.5px solid #d8b4fe; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px;">
                                            <i class="fa-solid fa-building" style="color: #9333ea;"></i> ${item.companiaNombre || 'Sin Asignar'}
                                        </span>
                                    </div>
                                    ${item.controlCompaniaId ? `<small style="color: #64748b; font-weight: 600; font-size: 11px;">Despacho Directo #${item.controlCompaniaId} ${totalDespacho > 0 ? `(${totalDespacho.toLocaleString('es-VE')} L)` : ''}</small>` : ''}
                                </div>`;
                        }
                    })()}
                </td>
                <td style="padding: 12px 14px; text-align: right;">
                    ${item.litrosRecibidosCompania != null ? `
                        <strong style="color: #7c3aed; font-size: 14px; font-family: monospace;">
                            ${(item.litrosFinca || item.litrosRecibidosCompania).toLocaleString('es-VE')}
                        </strong>
                        <span style="font-size: 11px; color: #7c3aed; font-weight: 700;">Lts</span>
                        ${totalDespacho > (item.litrosFinca || 0) ? `<small style="color: #64748b; font-size: 10px; display: block;">de ${totalDespacho.toLocaleString('es-VE')} L viaje</small>` : ''}
                    ` : `<span style="color: #94a3b8; font-size: 12px; font-style: italic;">En Tránsito</span>`}
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    ${mermaBadge}
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    <span class="badge" style="background: ${estadoBg}; color: ${estadoColor}; font-weight: 800; font-size: 10.5px; border-radius: 6px; padding: 3px 8px;">
                        ${item.estadoViaje || 'FINALIZADO'}
                    </span>
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    ${item.controlRutaId ? `
                        <button type="button" class="btn-icon" onclick="if(typeof abrirModalTrazabilidadViaje==='function') abrirModalTrazabilidadViaje(${item.controlRutaId})" title="Ver trazabilidad completa del ticket #${item.controlRutaId}" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #bae6fd; background: #f0f9ff; color: #0284c7; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    ` : '-'}
                </td>
            </tr>`;
    }).join('');
}

function renderMatrizBufala(lista) {
    const tbody = document.getElementById('tbodyMatrizBufala');
    const tfoot = document.getElementById('tfootMatrizBufala');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:30px; color:#94a3b8;">No hay entregas para mostrar en la matriz.</td></tr>`;
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    // Agrupar por Compañía de Destino
    let matriz = {};
    let totalGeneral = 0;
    let totalesDias = [0, 0, 0, 0, 0, 0, 0]; // Lun, Mar, Mie, Jue, Vie, Sab, Dom

    lista.forEach(item => {
        const comp = item.companiaNombre || 'Sin Destino / En Ruta';
        const tipoServ = (item.tipoServicio || 'RUTA').toUpperCase();
        if (!matriz[comp]) {
            matriz[comp] = {
                nombre: comp,
                esTanque: item.esTanqueReceptoria || comp.toUpperCase().includes('RECEPTORIA'),
                tipoServicio: tipoServ,
                dias: [0, 0, 0, 0, 0, 0, 0],
                total: 0
            };
        }

        const lts = item.litrosFinca || item.litrosRecibidosCompania || 0;
        if (item.fecha) {
            const fechaRaw = item.fecha.substring(0, 10);
            const parts = fechaRaw.split('-');
            if (parts.length === 3) {
                const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
                const dayOfWeek = dt.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
                const colIdx = (dayOfWeek + 6) % 7; // 0=Lun, 1=Mar, ..., 6=Dom
                matriz[comp].dias[colIdx] += lts;
                matriz[comp].total += lts;
                totalesDias[colIdx] += lts;
                totalGeneral += lts;
            }
        }
    });

    const companias = Object.values(matriz).sort((a, b) => b.total - a.total);

    tbody.innerHTML = companias.map(c => {
        const pct = totalGeneral > 0 ? ((c.total * 100.0) / totalGeneral).toFixed(1) : '0.0';
        const esTrans = c.tipoServicio === 'TRANSPORTE';
        const badgeServ = esTrans 
            ? '<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10.5px; font-weight:800; padding:1px 6px;">TRANSPORTE</span>'
            : '<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:10.5px; font-weight:800; padding:1px 6px;">RUTA</span>';

        const nombreHtml = c.esTanque 
            ? `<span style="color: #0369a1; font-weight: 800;"><i class="fa-solid fa-boxes-stacked" style="color: #0284c7; margin-right: 6px;"></i> TANQUES (Receptoría Acopio)</span>`
            : `<span style="color: #1e1b4b; font-weight: 800;"><i class="fa-solid fa-building" style="color: #7c3aed; margin-right: 6px;"></i> ${c.nombre}</span>`;

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 14px; display: flex; align-items: center; gap: 8px;">
                    ${nombreHtml}
                </td>
                <td style="padding: 12px 10px; text-align: center;">
                    ${badgeServ}
                </td>
                ${c.dias.map(d => `<td style="padding: 12px 10px; text-align: right; font-family: monospace; font-weight: 700; color: ${d > 0 ? '#0f172a' : '#cbd5e1'};">${d > 0 ? d.toLocaleString('es-VE') : '-'}</td>`).join('')}
                <td style="padding: 12px 14px; text-align: right; font-family: monospace; font-weight: 900; color: #7c3aed; background: #faf5ff;">
                    ${c.total.toLocaleString('es-VE')} Lts
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    <span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 800; font-size: 11px;">${pct}%</span>
                </td>
            </tr>`;
    }).join('');

    if (tfoot) {
        tfoot.innerHTML = `
            <tr>
                <td colspan="2" style="padding: 12px 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
                    <i class="fa-solid fa-sigma"></i> TOTALES CONSOLIDADOS
                </td>
                ${totalesDias.map(td => `<td style="padding: 12px 10px; text-align: right; font-family: monospace; font-weight: 900; color: #0f172a;">${td > 0 ? td.toLocaleString('es-VE') : '-'}</td>`).join('')}
                <td style="padding: 12px 14px; text-align: right; font-family: monospace; font-weight: 900; color: #059669; font-size: 14px; background: #ecfdf5;">
                    ${totalGeneral.toLocaleString('es-VE')} Lts
                </td>
                <td style="padding: 12px 14px; text-align: center; font-weight: 900; color: #059669;">
                    100%
                </td>
            </tr>`;
    }
}

function renderResumenFincasBufala(lista) {
    const tbody = document.getElementById('tbodyResumenFincasBufala');
    const tfoot = document.getElementById('tfootResumenFincasBufala');
    const lblTotal = document.getElementById('lblTotalFincasBufalaResumen');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">No hay datos de fincas.</td></tr>`;
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    let fincasMap = {};
    let totalLitros = 0;

    lista.forEach(item => {
        const id = item.fincaId || item.fincaNombre;
        if (!fincasMap[id]) {
            fincasMap[id] = {
                id: item.fincaId,
                nombre: item.fincaNombre,
                propietario: item.propietario,
                tipoServicio: (item.tipoServicio || 'RUTA').toUpperCase(),
                litros: 0,
                dias: new Set(),
                companias: new Set()
            };
        }
        fincasMap[id].litros += (item.litrosFinca || 0);
        totalLitros += (item.litrosFinca || 0);
        if (item.fecha) fincasMap[id].dias.add(item.fecha.substring(0, 10));
        if (item.companiaNombre) {
            const compLabel = (item.esTanqueReceptoria || item.companiaNombre.toUpperCase().includes('RECEPTORIA'))
                ? 'TANQUES (Receptoría)'
                : item.companiaNombre;
            fincasMap[id].companias.add(compLabel);
        }
    });

    const fincasArray = Object.values(fincasMap).sort((a, b) => b.litros - a.litros);
    if (lblTotal) lblTotal.textContent = `${fincasArray.length} Fincas productoras`;

    tbody.innerHTML = fincasArray.map(f => {
        const pct = totalLitros > 0 ? ((f.litros * 100.0) / totalLitros).toFixed(1) : '0.0';
        const compsBadges = Array.from(f.companias).map(c => {
            const esTnk = c.includes('TANQUES');
            return esTnk 
                ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; font-size:10.5px; font-weight:800; margin-right:3px;"><i class="fa-solid fa-boxes-stacked"></i> ${c}</span>`
                : `<span class="badge" style="background:#faf5ff; color:#7e22ce; border:1px solid #d8b4fe; font-size:10.5px; font-weight:700; margin-right:3px;"><i class="fa-solid fa-building"></i> ${c}</span>`;
        }).join('') || '<span style="color:#94a3b8;">Sin asignar</span>';

        const esTrans = f.tipoServicio === 'TRANSPORTE';
        const badgeServ = esTrans 
            ? '<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10.5px; font-weight:800; padding:1px 6px;">TRANSPORTE</span>'
            : '<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:10.5px; font-weight:800; padding:1px 6px;">RUTA</span>';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 14px; font-weight: 800; color: #064e3b;">
                    <i class="fa-solid fa-seedling" style="color: #10b981; margin-right: 6px;"></i> ${f.nombre}
                </td>
                <td style="padding: 12px 14px; color: #475569; font-weight: 600;">
                    ${f.propietario}
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    ${badgeServ}
                </td>
                <td style="padding: 12px 14px; text-align: right; font-family: monospace; font-weight: 900; color: #059669; font-size: 14px;">
                    ${f.litros.toLocaleString('es-VE')} Lts
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    <span class="badge badge-info" style="font-weight: 800; font-size: 11px;">${f.dias.size} días</span>
                </td>
                <td style="padding: 12px 14px;">
                    ${compsBadges}
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                    <span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 900; font-size: 11.5px;">${pct}%</span>
                </td>
            </tr>`;
    }).join('');

    if (tfoot) {
        tfoot.innerHTML = `
            <tr>
                <td colspan="3" style="padding: 12px 14px; font-weight: 900; color: #064e3b; text-transform: uppercase;">
                    TOTAL APORTE FINCAS BÚFALA
                </td>
                <td style="padding: 12px 14px; text-align: right; font-family: monospace; font-weight: 900; color: #059669; font-size: 14.5px;">
                    ${totalLitros.toLocaleString('es-VE')} Lts
                </td>
                <td colspan="2"></td>
                <td style="padding: 12px 14px; text-align: center; font-weight: 900; color: #059669;">
                    100%
                </td>
            </tr>`;
    }
}

function conmutarSubPestanaBufala(subtab) {
    const tabs = ['trazabilidad', 'matriz', 'fincas'];
    tabs.forEach(t => {
        const btn = document.getElementById('btnSubtabBufala' + t.charAt(0).toUpperCase() + t.slice(1));
        const panel = document.getElementById('panelBufala' + t.charAt(0).toUpperCase() + t.slice(1));
        if (t === subtab) {
            if (btn) {
                btn.classList.add('active');
                btn.style.background = '#0d9488';
                btn.style.color = '#ffffff';
                btn.style.border = 'none';
            }
            if (panel) panel.style.display = 'block';
        } else {
            if (btn) {
                btn.classList.remove('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#475569';
                btn.style.border = '1.5px solid #cbd5e1';
            }
            if (panel) panel.style.display = 'none';
        }
    });
}
window.conmutarSubPestanaBufala = conmutarSubPestanaBufala;

function cambiarModoFiltroBufala(modo) {
    stateBufala.modoFiltro = modo;
    const btnSem = document.getElementById('btnModoBufalaSemana');
    const btnRango = document.getElementById('btnModoBufalaRango');
    const wrapSem = document.getElementById('wrapperControlesSemanaBufala');
    const wrapRango = document.getElementById('wrapperControlesRangoBufala');

    if (modo === 'semana') {
        if (btnSem) { btnSem.classList.add('active'); btnSem.style.background = '#0d9488'; btnSem.style.color = '#fff'; }
        if (btnRango) { btnRango.classList.remove('active'); btnRango.style.background = 'transparent'; btnRango.style.color = '#64748b'; }
        if (wrapSem) wrapSem.style.display = 'flex';
        if (wrapRango) wrapRango.style.display = 'none';
    } else {
        if (btnRango) { btnRango.classList.add('active'); btnRango.style.background = '#0d9488'; btnRango.style.color = '#fff'; }
        if (btnSem) { btnSem.classList.remove('active'); btnSem.style.background = 'transparent'; btnSem.style.color = '#64748b'; }
        if (wrapSem) wrapSem.style.display = 'none';
        if (wrapRango) wrapRango.style.display = 'flex';
    }
    cargarTrazabilidadBufala();
}
window.cambiarModoFiltroBufala = cambiarModoFiltroBufala;

function navegarSemanaBufala(delta) {
    const sel = document.getElementById('selectSemanaBufala');
    if (!sel || sel.options.length <= 1) return;

    let newIndex = sel.selectedIndex + delta;
    if (newIndex >= 0 && newIndex < sel.options.length) {
        sel.selectedIndex = newIndex;
        cargarTrazabilidadBufala();
    }
}
window.navegarSemanaBufala = navegarSemanaBufala;

function filtrarTablaTrazabilidadBufalaLive() {
    const query = (document.getElementById('buscadorTrazabilidadBufala')?.value || '').toLowerCase().trim();
    if (!stateBufala.detalleOriginal) return;

    if (!query) {
        renderTrazabilidadBufala(stateBufala.detalleOriginal);
        return;
    }

    const filtrados = stateBufala.detalleOriginal.filter(item => {
        const serv = (item.tipoServicio || '').toLowerCase();
        const finca = (item.fincaNombre || '').toLowerCase();
        const prop = (item.propietario || '').toLowerCase();
        const chofer = (item.choferNombre || '').toLowerCase();
        const comp = (item.companiaNombre || '').toLowerCase();
        const ticket = String(item.controlRutaId || '');
        const fecha = (item.fecha || '').toLowerCase();
        return serv.includes(query) || finca.includes(query) || prop.includes(query) || chofer.includes(query) || comp.includes(query) || ticket.includes(query) || fecha.includes(query);
    });

    renderTrazabilidadBufala(filtrados);
}
window.filtrarTablaTrazabilidadBufalaLive = filtrarTablaTrazabilidadBufalaLive;

function limpiarFiltrosBufala() {
    stateBufala.tipoServicio = 'TODOS';
    const btns = document.querySelectorAll('.btn-tipo-bufala');
    btns.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.fontWeight = '700';
    });
    const btnTodos = document.getElementById('btnTipoServicioBufalaTodos');
    if (btnTodos) {
        btnTodos.classList.add('active');
        btnTodos.style.background = '#6366f1';
        btnTodos.style.color = '#fff';
        btnTodos.style.fontWeight = '800';
    }

    const selFinca = document.getElementById('selectFincaFiltroBufala');
    if (selFinca) selFinca.value = '';

    const selComp = document.getElementById('selectCompaniaFiltroBufala');
    if (selComp) selComp.value = '';

    const selChofer = document.getElementById('selectChoferFiltroBufala');
    if (selChofer) selChofer.value = '';

    const inputBuscador = document.getElementById('buscadorTrazabilidadBufala');
    if (inputBuscador) inputBuscador.value = '';

    cargarTrazabilidadBufala();
}
window.limpiarFiltrosBufala = limpiarFiltrosBufala;

function exportarReporteBufalaExcel() {
    if (!stateBufala.detalleOriginal || stateBufala.detalleOriginal.length === 0) {
        Swal.fire({ icon: 'info', title: 'Sin Datos', text: 'No hay registros de búfala para exportar.' });
        return;
    }

    const encabezados = [
        'ID',
        'Fecha',
        'Semana',
        'Tipo Servicio',
        'Finca',
        'Propietario',
        'Tipo Leche',
        'Litros Finca',
        'Chofer',
        'Ticket Ruta',
        'Compañia Destino',
        'Despacho ID',
        'Litros Recibidos Planta',
        'Diferencia Litros',
        'Porcentaje Merma',
        'Estado Viaje',
        'Observacion'
    ];

    const filas = stateBufala.detalleOriginal.map(item => [
        item.id || '',
        item.fecha ? item.fecha.substring(0, 10) : '',
        item.cicloId ? `S${item.cicloId}` : '',
        `"${item.tipoServicio || 'RUTA'}"`,
        `"${(item.fincaNombre || '').replace(/"/g, '""')}"`,
        `"${(item.propietario || '').replace(/"/g, '""')}"`,
        item.tipoLeche || 'BUFALA',
        item.litrosFinca || 0,
        `"${(item.choferNombre || '').replace(/"/g, '""')}"`,
        item.controlRutaId || '',
        `"${(item.companiaNombre || '').replace(/"/g, '""')}"`,
        item.controlCompaniaId || '',
        item.litrosRecibidosCompania || '',
        item.diferenciaLitros || 0,
        item.porcentajeMerma || 0,
        item.estadoViaje || '',
        `"${(item.observacion || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [encabezados.join(';'), ...filas.map(f => f.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trazabilidad_Bufala_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
window.exportarReporteBufalaExcel = exportarReporteBufalaExcel;
