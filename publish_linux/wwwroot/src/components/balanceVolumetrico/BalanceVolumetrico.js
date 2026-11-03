// ==========================================================================
// MÓDULO: ANÁLISIS & BALANCE VOLUMÉTRICO DE LECHE (RECEPTORÍA Y LOS 4 PROCESOS)
// ==========================================================================

async function cargarBalanceReceptoria(cicloId) {
    const tbody = document.getElementById('tbodyBalanceMovimientos');
    const selectCiclo = document.getElementById('filtroCicloBalance');

    try {
        const activoId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;

        // 1. Cargar combo de ciclos si está vacío o solo tiene 0/1 elemento
        if (selectCiclo && selectCiclo.options.length <= 1) {
            let ciclos = state.semanas || [];
            if (!ciclos || ciclos.length === 0) {
                try {
                    const resCiclos = await fetch(`${API_BASE}/ciclos`, {
                        headers: { 'Authorization': `Bearer ${state.token}` }
                    });
                    if (resCiclos.ok) {
                        ciclos = await resCiclos.json();
                        state.semanas = ciclos;
                    }
                } catch (e) {
                    console.warn('Error al obtener lista de ciclos para balance:', e);
                }
            }

            if (ciclos && ciclos.length > 0) {
                // Ordenar descendente por id o fechaInicio
                const ordenados = [...ciclos].sort((a, b) => (b.id || 0) - (a.id || 0));
                selectCiclo.innerHTML = ordenados.map(c => {
                    const esActivo = (activoId && (c.id == activoId || c.Id == activoId))
                        || c.activo === true
                        || (c.estado && (c.estado.toUpperCase() === 'ABIERTO' || c.estado.toUpperCase() === 'ACTIVO' || c.estado.toUpperCase() === 'ACTIVA'));
                    return `<option value="${c.id}" ${esActivo ? 'selected data-activo="true"' : ''}>${formatearTextoSemana(c)} ${esActivo ? '★ ACTIVO' : ''}</option>`;
                }).join('');
            }
        }

        // Determinar cicloId a consultar (PRIORIZANDO EL CICLO ACTIVO)
        let targetCicloId = cicloId;
        if (!targetCicloId && activoId) {
            targetCicloId = activoId;
        }
        if (!targetCicloId && selectCiclo) {
            const optActiva = selectCiclo.querySelector('option[data-activo="true"]');
            if (optActiva) targetCicloId = optActiva.value;
            else if (selectCiclo.value) targetCicloId = selectCiclo.value;
        }

        if (selectCiclo && targetCicloId) {
            selectCiclo.value = targetCicloId;
        }

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 26px; margin-bottom: 10px; display: block; color: #0284c7;"></i>
                        Calculando balance volumétrico y trazabilidad de tanques...
                    </td>
                </tr>
            `;
        }

        const url = targetCicloId
            ? `${API_BASE}/receptoria/balance-volumetrico?cicloId=${targetCicloId}`
            : `${API_BASE}/receptoria/balance-volumetrico`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            throw new Error(`Error en servidor (${res.status})`);
        }

        const data = await res.json();
        state.balanceReceptoria = data;
        renderizarBalanceReceptoria(data);

    } catch (err) {
        console.error('Error al cargar balance volumétrico:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #ef4444;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
                        No se pudo cargar el balance volumétrico: ${err.message}
                    </td>
                </tr>
            `;
        }
    }
}
window.cargarBalanceReceptoria = cargarBalanceReceptoria;

function renderizarBalanceReceptoria(data) {
    if (!data) return;

    // Helper formato litros
    const fmtLts = (n) => formatearNumero(n || 0, 2);

    // KPI 1: STOCK FÍSICO ACTUAL EN TANQUES
    const elStock = document.getElementById('kpiStockTanquesLitros');
    if (elStock) elStock.textContent = fmtLts(data.stockActualTanque);

    const elSubEntradas = document.getElementById('kpiSubEntradasTanque');
    if (elSubEntradas) elSubEntradas.textContent = fmtLts(data.totalEntradasTanque) + ' Lts';

    const elSubSalidas = document.getElementById('kpiSubSalidasTanque');
    if (elSubSalidas) elSubSalidas.textContent = fmtLts(data.totalSalidasTanque) + ' Lts';

    const elSubInicial = document.getElementById('kpiSubInicialTanque');
    if (elSubInicial) elSubInicial.textContent = fmtLts(data.stockInicialTanque) + ' Lts';

    const barraNivel = document.getElementById('barraProgresoStockTanque');
    if (barraNivel) {
        const totalEnt = Number(data.totalEntradasTanque || 0);
        const stock = Number(data.stockActualTanque || 0);
        let pct = totalEnt > 0 ? (stock / totalEnt) * 100 : 0;
        pct = Math.min(100, Math.max(5, pct));
        barraNivel.style.width = pct + '%';
    }

    // KPI 2: TOTAL RECOLECTADO EN FINCAS
    const elTotalRec = document.getElementById('kpiTotalRecolectadoLitros');
    if (elTotalRec) elTotalRec.textContent = fmtLts(data.totalRecolectadoFincas);

    const elTotalMerma = document.getElementById('kpiTotalMermaLitros');
    if (elTotalMerma) elTotalMerma.textContent = fmtLts(data.totalMermaRuta) + ' Lts';

    // KPI 3: TOTAL COMERCIALIZADO / ENTREGADO
    const elTotalCom = document.getElementById('kpiTotalComercializadoLitros');
    if (elTotalCom) elTotalCom.textContent = fmtLts(data.totalComercializadoCompanias);

    const elSubDirectas = document.getElementById('kpiSubEntregasDirectas');
    if (elSubDirectas) elSubDirectas.textContent = fmtLts(data.totalEntregasDirectas) + ' Lts';

    const elSubDespachos = document.getElementById('kpiSubDespachosTanque');
    if (elSubDespachos) elSubDespachos.textContent = fmtLts(data.totalSalidasTanque) + ' Lts';

    // KPI 4: AUDITORÍA DE BALANCE (CUADRATURA)
    const elDescuadre = document.getElementById('kpiDiferenciaDescuadreLitros');
    const elEstadoTexto = document.getElementById('lblEstadoConciliacionTexto');
    const diff = Math.abs(Number(data.diferenciaDescuadre || 0));

    if (elDescuadre) {
        elDescuadre.textContent = fmtLts(data.diferenciaDescuadre);
        elDescuadre.style.color = diff < 0.01 ? '#10b981' : '#ef4444';
    }

    if (elEstadoTexto) {
        if (diff < 0.01) {
            elEstadoTexto.className = 'badge badge-success';
            elEstadoTexto.innerHTML = '<i class="fa-solid fa-check-double"></i> 100% Conciliado (0 Pérdidas)';
            elEstadoTexto.style.background = '#dcfce7';
            elEstadoTexto.style.color = '#15803d';
        } else {
            elEstadoTexto.className = 'badge badge-danger';
            elEstadoTexto.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Descuadre Detectado';
            elEstadoTexto.style.background = '#fee2e2';
            elEstadoTexto.style.color = '#b91c1c';
        }
    }

    // TARJETAS DE LOS 4 PROCESOS OPERATIVOS
    // Proceso 1
    const p1 = data.proceso1_FincaReceptoria || {};
    const elLtsP1 = document.getElementById('litrosP1');
    if (elLtsP1) elLtsP1.textContent = fmtLts(p1.totalLitros) + ' Lts';
    const elVp1 = document.getElementById('viajesP1');
    if (elVp1) elVp1.textContent = (p1.cantidadMovimientos || 0) + ' viajes';
    const elPctP1 = document.getElementById('porcentajeP1');
    if (elPctP1) elPctP1.textContent = (p1.porcentajeDelTotal || 0).toFixed(1) + '%';

    // Proceso 2
    const p2 = data.proceso2_FincaReceptoriaCompania || {};
    const elLtsP2 = document.getElementById('litrosP2');
    if (elLtsP2) elLtsP2.textContent = fmtLts(p2.totalLitros) + ' Lts';
    const elVp2 = document.getElementById('viajesP2');
    if (elVp2) elVp2.textContent = (p2.cantidadMovimientos || 0) + ' entregas';
    const elPctP2 = document.getElementById('porcentajeP2');
    if (elPctP2) elPctP2.textContent = (p2.porcentajeDelTotal || 0).toFixed(1) + '%';

    // Proceso 3
    const p3 = data.proceso3_FincaCompania || {};
    const elLtsP3 = document.getElementById('litrosP3');
    if (elLtsP3) elLtsP3.textContent = fmtLts(p3.totalLitros) + ' Lts';
    const elVp3 = document.getElementById('viajesP3');
    if (elVp3) elVp3.textContent = (p3.cantidadMovimientos || 0) + ' entregas';
    const elPctP3 = document.getElementById('porcentajeP3');
    if (elPctP3) elPctP3.textContent = (p3.porcentajeDelTotal || 0).toFixed(1) + '%';

    // Proceso 4
    const p4 = data.proceso4_ReceptoriaCompania || {};
    const elLtsP4 = document.getElementById('litrosP4');
    if (elLtsP4) elLtsP4.textContent = fmtLts(p4.totalLitros) + ' Lts';
    const elVp4 = document.getElementById('viajesP4');
    if (elVp4) elVp4.textContent = (p4.cantidadMovimientos || 0) + ' despachos';
    const elPctP4 = document.getElementById('porcentajeP4');
    if (elPctP4) elPctP4.textContent = (p4.porcentajeDelTotal || 0).toFixed(1) + '%';

    // Renderizar tabla con filtros actuales
    aplicarFiltrosTablaBalance();
}
window.renderizarBalanceReceptoria = renderizarBalanceReceptoria;

function filtrarProcesoDesdeTarjeta(tipoProceso) {
    const sel = document.getElementById('filtroTipoProcesoBalance');
    const nuevoTipo = state.filtroProcesoBalance === tipoProceso ? 0 : tipoProceso;
    state.filtroProcesoBalance = nuevoTipo;

    if (sel) sel.value = nuevoTipo;

    // Resaltar tarjeta seleccionada
    [1, 2, 3, 4].forEach(p => {
        const card = document.getElementById(`card-p${p}`);
        if (!card) return;
        if (nuevoTipo === 0) {
            card.style.opacity = '1';
            card.style.transform = 'none';
            card.style.borderColor = p === 1 ? '#bae6fd' : p === 2 ? '#ddd6fe' : p === 3 ? '#fed7aa' : '#bbf7d0';
            card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.04)';
        } else if (nuevoTipo === p) {
            card.style.opacity = '1';
            card.style.transform = 'translateY(-3px)';
            card.style.borderColor = '#0284c7';
            card.style.boxShadow = '0 10px 20px rgba(2, 132, 199, 0.2)';
        } else {
            card.style.opacity = '0.55';
            card.style.transform = 'none';
            card.style.borderColor = '#e2e8f0';
            card.style.boxShadow = 'none';
        }
    });

    aplicarFiltrosTablaBalance();
}
window.filtrarProcesoDesdeTarjeta = filtrarProcesoDesdeTarjeta;

function aplicarFiltrosTablaBalance() {
    if (!state.balanceReceptoria || !state.balanceReceptoria.movimientos) return;

    const tbody = document.getElementById('tbodyBalanceMovimientos');
    const lblTotal = document.getElementById('lblTotalRegistrosBalance');
    const txtBuscar = (document.getElementById('buscarMovimientoBalance')?.value || '').toLowerCase().trim();
    const selTipo = parseInt(document.getElementById('filtroTipoProcesoBalance')?.value ?? state.filtroProcesoBalance ?? 0, 10);
    state.filtroProcesoBalance = isNaN(selTipo) ? 0 : selTipo;

    const todos = state.balanceReceptoria.movimientos || [];
    const filtrados = todos.filter(m => {
        // Filtro por proceso
        if (state.filtroProcesoBalance !== 0 && m.tipoProceso !== state.filtroProcesoBalance) {
            return false;
        }

        // Filtro por texto
        if (txtBuscar) {
            const matchesTicket = (m.ticketReferencia || '').toLowerCase().includes(txtBuscar);
            const matchesChofer = (m.conductor || '').toLowerCase().includes(txtBuscar);
            const matchesPlaca = (m.camionPlaca || '').toLowerCase().includes(txtBuscar);
            const matchesOrigen = (m.origen || '').toLowerCase().includes(txtBuscar);
            const matchesDestino = (m.destino || '').toLowerCase().includes(txtBuscar);
            const matchesProceso = (m.tipoProcesoNombre || '').toLowerCase().includes(txtBuscar);
            const matchesObs = (m.observacion || '').toLowerCase().includes(txtBuscar);

            if (!matchesTicket && !matchesChofer && !matchesPlaca && !matchesOrigen && !matchesDestino && !matchesProceso && !matchesObs) {
                return false;
            }
        }

        return true;
    });

    if (lblTotal) {
        lblTotal.textContent = `${filtrados.length} de ${todos.length} Movimientos`;
    }

    if (!tbody) return;

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8;">
                    <i class="fa-solid fa-filter-circle-xmark" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
                    No se encontraron movimientos que coincidan con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    const fmtNum = (n) => formatearNumero(n || 0, 2);

    const badgesProceso = {
        0: { label: '📦 Stock Inicial Tanques', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
        1: { label: '📥 1. Finca ➔ Receptoría', bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd' },
        2: { label: '🔄 2. Finca ➔ Receptoría ➔ Cía', bg: '#ede9fe', color: '#7c3aed', border: '#ddd6fe' },
        3: { label: '🚛 3. Finca ➔ Cía (Directa)', bg: '#ffedd5', color: '#ea580c', border: '#fed7aa' },
        4: { label: '📤 4. Receptoría ➔ Cía', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' }
    };

    tbody.innerHTML = filtrados.map(m => {
        const fechaStr = m.fecha ? m.fecha.split('T')[0] : '-';
        const bInfo = badgesProceso[m.tipoProceso] || { label: `Proceso ${m.tipoProceso}`, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

        // Columnas numéricas con información de verificación en planta
        const infoVerifSalida = (m.tipoProceso === 4 && m.infoVerificacion)
            ? `<div style="font-size: 10.5px; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 2px 6px; margin-top: 3px; font-weight: 700; white-space: nowrap;">
                 <i class="fa-solid fa-clipboard-check"></i> ${m.infoVerificacion}
               </div>`
            : '';

        const infoVerifEntrada = (m.tipoProceso === 1 && m.infoVerificacion)
            ? `<div style="font-size: 10.5px; color: #0369a1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 2px 6px; margin-top: 3px; font-weight: 700; white-space: nowrap;">
                 <i class="fa-solid fa-scale-balanced"></i> ${m.infoVerificacion}
               </div>`
            : '';

        const colEntrada = m.litrosEntradaTanque > 0
            ? `<div style="text-align: right;">
                 <span style="color: #16a34a; font-weight: 800; font-family: monospace;">+${fmtNum(m.litrosEntradaTanque)} Lts</span>
                 ${infoVerifEntrada}
               </div>`
            : `<span style="color: #cbd5e1;">-</span>`;

        const colSalida = m.litrosSalidaTanque > 0
            ? `<div style="text-align: right;">
                 <span style="color: #dc2626; font-weight: 800; font-family: monospace;">-${fmtNum(m.litrosSalidaTanque)} Lts</span>
                 ${infoVerifSalida}
               </div>`
            : `<span style="color: #cbd5e1;">-</span>`;

        const colDirecta = m.litrosEntregaDirecta > 0
            ? `<span style="color: #0284c7; font-weight: 800; font-family: monospace;">${fmtNum(m.litrosEntregaDirecta)} Lts</span>`
            : `<span style="color: #cbd5e1;">-</span>`;

        const saldoColor = m.saldoTanque < 0 ? '#ef4444' : '#38bdf8';
        const saldoBg = m.saldoTanque < 0 ? '#450a0a' : '#0f172a';
        const colSaldo = `<span class="badge" style="background: ${saldoBg}; color: ${saldoColor}; font-family: monospace; font-size: 12.5px; font-weight: 800; padding: 4px 8px; border-radius: 6px;">${fmtNum(m.saldoTanque)} Lts</span>`;

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px 14px; text-align: center; font-size: 12.5px; font-weight: 600; color: #475569; white-space: nowrap;">
                    ${fechaStr}
                </td>
                <td style="padding: 10px 14px; white-space: nowrap;">
                    <span class="badge" style="background: ${bInfo.bg}; color: ${bInfo.color}; border: 1px solid ${bInfo.border}; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px;">
                        ${bInfo.label}
                    </span>
                </td>
                <td style="padding: 10px 14px; font-size: 12.5px; white-space: nowrap;">
                    <strong style="color: #0f172a; font-family: monospace;">#${m.ticketReferencia || m.id}</strong>
                </td>
                <td style="padding: 10px 14px; font-size: 12.5px;">
                    <div style="font-weight: 700; color: #0f172a;">${m.conductor || 'Sin Chofer'}</div>
                    <small style="color: #64748b; font-size: 11px;">${m.camionPlaca ? '<i class=\"fa-solid fa-truck\"></i> ' + m.camionPlaca : ''}</small>
                </td>
                <td style="padding: 10px 14px; font-size: 12px;">
                    <span style="color: #475569; font-weight: 600;">${m.origen}</span>
                    <i class="fa-solid fa-arrow-right" style="color: #94a3b8; margin: 0 4px; font-size: 10px;"></i>
                    <strong style="color: #0f172a;">${m.destino}</strong>
                </td>
                <td style="padding: 10px 14px; text-align: right;">
                    ${colEntrada}
                </td>
                <td style="padding: 10px 14px; text-align: right;">
                    ${colSalida}
                </td>
                <td style="padding: 10px 14px; text-align: right;">
                    ${colDirecta}
                </td>
                <td style="padding: 10px 14px; text-align: right;">
                    ${colSaldo}
                </td>
            </tr>
        `;
    }).join('');
}
window.aplicarFiltrosTablaBalance = aplicarFiltrosTablaBalance;

function onCambiarCicloBalance(cicloId) {
    cargarBalanceReceptoria(cicloId);
}
window.onCambiarCicloBalance = onCambiarCicloBalance;

function exportarExcelBalanceReceptoria() {
    if (!state.balanceReceptoria || !state.balanceReceptoria.movimientos || state.balanceReceptoria.movimientos.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin Datos',
            text: 'No hay datos en el balance volumétrico para exportar.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    const data = state.balanceReceptoria;
    const movimientos = data.movimientos;

    let csvContent = "\uFEFFFECHA;PROCESO;TICKET_REFERENCIA;CONDUCTOR;PLACA;ORIGEN;DESTINO;ENTRADA_TANQUE_LTS;SALIDA_TANQUE_LTS;ENTREGA_DIRECTA_LTS;SALDO_TANQUE_LTS;INFO_VERIFICACION;ESTADO;OBSERVACIONES\n";

    movimientos.forEach(m => {
        const fecha = m.fecha ? m.fecha.split('T')[0] : '';
        const proceso = (m.tipoProcesoNombre || '').replace(/;/g, ',');
        const ticket = (m.ticketReferencia || '').replace(/;/g, ',');
        const conductor = (m.conductor || '').replace(/;/g, ',');
        const placa = (m.camionPlaca || '').replace(/;/g, ',');
        const origen = (m.origen || '').replace(/;/g, ',');
        const destino = (m.destino || '').replace(/;/g, ',');
        const ent = m.litrosEntradaTanque || 0;
        const sal = m.litrosSalidaTanque || 0;
        const dir = m.litrosEntregaDirecta || 0;
        const saldo = m.saldoTanque || 0;
        const verif = (m.infoVerificacion || '').replace(/;/g, ',');
        const est = (m.estado || '').replace(/;/g, ',');
        const obs = (m.observacion || '').replace(/;/g, ',');

        csvContent += `${fecha};${proceso};${ticket};${conductor};${placa};${origen};${destino};${ent};${sal};${dir};${saldo};${verif};${est};${obs}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const nombreCiclo = data.codigoCiclo ? data.codigoCiclo.replace(/\s+/g, '_') : 'Ciclo';
    link.setAttribute("download", `Balance_Volumetrico_Receptoria_${nombreCiclo}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('¡Balance volumétrico y trazabilidad exportados a Excel/CSV exitosamente!');
}
window.exportarExcelBalanceReceptoria = exportarExcelBalanceReceptoria;

async function abrirModalStockInicial() {
    const balance = state.balanceReceptoria;
    const cicloId = balance?.cicloId || document.getElementById('filtroCicloBalance')?.value || state.cicloActivo?.id;
    const stockActual = balance?.stockInicialTanque || 0;
    const codigoCiclo = balance?.codigoCiclo || (state.cicloActivo ? state.cicloActivo.codigo : 'Ciclo Actual');

    if (!cicloId) {
        mostrarNotificacion('No se ha detectado el ciclo operativo seleccionado.', 'error');
        return;
    }

    if (typeof Swal !== 'undefined') {
        const { value: nuevoStock } = await Swal.fire({
            title: `<i class="fa-solid fa-pen-to-square" style="color: #0284c7;"></i> Ajustar Stock Inicial`,
            html: `
                <div style="text-align: left; font-size: 13.5px; color: #475569; margin-bottom: 12px;">
                    <p style="margin-bottom: 8px;">Ingrese los litros físicos reales que estaban en los tanques al momento de <strong>abrir este ciclo operativo (${codigoCiclo})</strong>:</p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-size: 12.5px; color: #64748b;">
                        <i class="fa-solid fa-circle-info" style="color: #0284c7;"></i> Este valor establece el punto de partida (T=0) del balance para que los despachos de leche no generen saldo negativo ni desbalances ficticios.
                    </div>
                </div>
            `,
            input: 'number',
            inputValue: stockActual,
            inputAttributes: {
                min: '0',
                step: '1',
                placeholder: 'Litros en tanques al iniciar'
            },
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar Stock Inicial',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#0284c7',
            showLoaderOnConfirm: true,
            preConfirm: async (val) => {
                if (val === '' || isNaN(val) || Number(val) < 0) {
                    Swal.showValidationMessage('Ingrese una cantidad válida de litros (mayor o igual a 0).');
                    return false;
                }
                try {
                    const res = await fetch(`${API_BASE}/ciclos/${cicloId}/stock-inicial`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: JSON.stringify({ stockInicial: Number(val) })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.message || `Error en servidor (${res.status})`);
                    }
                    return Number(val);
                } catch (err) {
                    Swal.showValidationMessage(err.message || 'No se pudo actualizar el stock inicial');
                    return false;
                }
            }
        });

        if (nuevoStock !== undefined && nuevoStock !== false) {
            Swal.fire({
                icon: 'success',
                title: '¡Stock Inicial Actualizado!',
                text: `Se fijó el stock inicial de tanques en ${formatearNumero(nuevoStock, 2)} Lts exitosamente.`,
                timer: 1600,
                showConfirmButton: false
            });
            await cargarBalanceReceptoria(cicloId);
        }
    } else {
        const val = prompt(`Ingrese los litros físicos iniciales en tanques para ${codigoCiclo}:`, stockActual);
        if (val !== null && val.trim() !== '' && !isNaN(val)) {
            try {
                const res = await fetch(`${API_BASE}/ciclos/${cicloId}/stock-inicial`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.token}`
                    },
                    body: JSON.stringify({ stockInicial: Number(val) })
                });
                if (res.ok) {
                    alert('Stock inicial actualizado con éxito.');
                    cargarBalanceReceptoria(cicloId);
                } else {
                    alert('Error al actualizar stock inicial.');
                }
            } catch (e) {
                alert('Error de conexión: ' + e.message);
            }
        }
    }
}
window.abrirModalStockInicial = abrirModalStockInicial;
