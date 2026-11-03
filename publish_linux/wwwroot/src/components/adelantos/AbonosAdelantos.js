// ==========================================================================
// MÓDULO DE ABONOS & AMORTIZACIONES A PRÉSTAMOS / ADELANTOS
// ==========================================================================
var abonosCache = [];
var abonosFiltradosCache = [];
var paginaActualAbonos = 1;
var itemsPorPaginaAbonos = 25;

async function cargarAbonos() {
    const tbody = document.getElementById('tbodyAbonos');
    if (!tbody) return;

    try {
        const selectCiclos = document.getElementById('filtroCicloAbonos');
        if (selectCiclos && selectCiclos.options.length <= 1 && state.semanas && state.semanas.length > 0) {
            selectCiclos.innerHTML = '<option value="">TODAS LAS SEMANAS</option>' + 
                state.semanas.map(s => `<option value="${s.id || s.Id}">${s.codigo || s.Codigo || `Semana #${s.id}`}</option>`).join('');
        }

        const tipoEntidad = document.getElementById('filtroTipoEntidadAbonos')?.value || '';
        const cicloId = document.getElementById('filtroCicloAbonos')?.value || '';

        let url = `${API_BASE}/Adelantos/abonos`;
        const params = [];
        if (tipoEntidad) params.push(`tipoEntidad=${encodeURIComponent(tipoEntidad)}`);
        if (cicloId) params.push(`cicloId=${encodeURIComponent(cicloId)}`);
        if (params.length > 0) url += `?${params.join('&')}`;

        const res = await fetch(url, {
            headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
        });

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar lista de abonos.</td></tr>';
            return;
        }

        const data = await res.json();
        abonosCache = data || [];
        actualizarKpisAbonos(abonosCache);
        filtrarTablaAbonos();
    } catch (err) {
        console.warn('Error cargarAbonos:', err);
        tbody.innerHTML = '<tr><td colspan="11" class="text-center" style="padding: 20px; color: #f87171;">Error de conexión al cargar abonos.</td></tr>';
    }
}
window.cargarAbonos = cargarAbonos;

function actualizarKpisAbonos(items) {
    const elUsd = document.getElementById('kpiTotalAbonadoUSD');
    const elBs = document.getElementById('kpiTotalAbonadoBs');
    const elCuotas = document.getElementById('kpiTotalCuotasCobradas');
    const elFincas = document.getElementById('kpiTotalFincasAbonos');

    const totalUsd = (items || []).reduce((acc, a) => acc + Number(a.montoCobradoUSD || 0), 0);
    const totalBs = (items || []).reduce((acc, a) => acc + Number(a.montoCobradoBs || 0), 0);
    const cuotasCount = (items || []).length;
    const fincasSet = new Set((items || []).map(a => `${a.tipoEntidad}-${a.entidadId}`));

    if (elUsd) elUsd.textContent = `$${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elBs) elBs.textContent = `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elCuotas) elCuotas.textContent = cuotasCount.toLocaleString('es-VE');
    if (elFincas) elFincas.textContent = fincasSet.size.toLocaleString('es-VE');
}

function renderTablaAbonos(items) {
    const tbody = document.getElementById('tbodyAbonos');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center" style="padding: 24px; color: #94a3b8;">No se encontraron registros de abonos o amortizaciones.</td></tr>';
        renderPaginacionControles('Abonos', 0, 0, 0);
        return;
    }

    const total = items.length;
    const itemsPerPage = itemsPorPaginaAbonos;
    const totalPaginas = Math.ceil(total / itemsPerPage);
    if (paginaActualAbonos > totalPaginas) paginaActualAbonos = Math.max(1, totalPaginas);

    const inicio = (paginaActualAbonos - 1) * itemsPerPage;
    const fin = Math.min(inicio + itemsPerPage, total);
    const paginados = items.slice(inicio, fin);

    tbody.innerHTML = paginados.map(a => {
        const fechaStr = a.fechaCobro ? a.fechaCobro.split('T')[0] : '-';
        const entidadNom = capitalizarTexto(a.entidadNombre || 'S/N');
        const badgeEntidad = a.tipoEntidad === 'FINCA'
            ? '<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; padding: 2px 6px;">Finca</span>'
            : '<span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 11px; padding: 2px 6px;">Receptoría</span>';

        return `
            <tr>
                <td><strong style="color: #334155;">${fechaStr}</strong></td>
                <td><span class="badge badge-primary" style="font-size: 11px;">${a.semanaNombre || 'Semana S/N'}</span></td>
                <td><strong>${entidadNom}</strong> ${badgeEntidad}</td>
                <td style="text-align: center;"><span style="font-family: monospace; font-weight: 800; color: #64748b;">#${a.adelantoId}</span></td>
                <td style="text-align: center;"><span class="badge" style="background: #eff6ff; color: #1d4ed8; font-weight: 800;">Cuota ${a.numeroCuota}</span></td>
                <td style="text-align: right; font-weight: 800; color: #047857;">$${Number(a.montoCobradoUSD || 0).toFixed(2)}</td>
                <td style="text-align: right; color: #475569; font-size: 12px;">Bs. ${Number(a.tasaBcvAplicada || 0).toLocaleString('es-VE', { minimumFractionDigits: 4 })}</td>
                <td style="text-align: right; font-weight: 700; color: #b45309;">Bs. ${Number(a.montoCobradoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 700; color: ${Number(a.saldoRestanteUSD || 0) === 0 ? '#10b981' : '#dc2626'};">$${Number(a.saldoRestanteUSD || 0).toFixed(2)}</td>
                <td><small style="color: #64748b;">${a.observacion || 'Amortización'}</small></td>
                <td style="text-align: center;"><span class="badge badge-success" style="font-size: 11px; font-weight: 800;"><i class="fa-solid fa-check"></i> COBRADO</span></td>
            </tr>
        `;
    }).join('');

    renderPaginacionControles('Abonos', inicio + 1, fin, total, paginaActualAbonos, totalPaginas);
}

function filtrarTablaAbonos() {
    const q = (document.getElementById('buscarAbonoInput')?.value || '').toLowerCase().trim();
    const tipo = document.getElementById('filtroTipoEntidadAbonos')?.value || '';
    const cicloId = document.getElementById('filtroCicloAbonos')?.value || '';

    paginaActualAbonos = 1;

    abonosFiltradosCache = (abonosCache || []).filter(a => {
        const nom = (a.entidadNombre || '').toLowerCase();
        const obs = (a.observacion || '').toLowerCase();
        const sem = (a.semanaNombre || '').toLowerCase();
        const matchQ = !q || nom.includes(q) || obs.includes(q) || sem.includes(q) || String(a.adelantoId).includes(q);
        const matchTipo = !tipo || a.tipoEntidad === tipo;
        const matchCiclo = !cicloId || String(a.semanaOperativaId) === String(cicloId);
        return matchQ && matchTipo && matchCiclo;
    });

    renderTablaAbonos(abonosFiltradosCache);
}
window.filtrarTablaAbonos = filtrarTablaAbonos;

function exportarAbonosExcel() {
    const items = abonosFiltradosCache && abonosFiltradosCache.length > 0 ? abonosFiltradosCache : abonosCache;
    if (!items || items.length === 0) {
        showToast('No hay datos de abonos para exportar', 'warning');
        return;
    }

    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    csv += "Fecha Cobro,Semana,Tipo Entidad,Entidad,Adelanto ID,Cuota Numero,Monto Cobrado USD,Tasa BCV,Monto Cobrado Bs,Saldo Restante USD,Concepto / Obs,Estado\n";

    items.forEach(a => {
        const fecha = a.fechaCobro ? a.fechaCobro.split('T')[0] : '';
        const ent = `"${(a.entidadNombre || '').replace(/"/g, '""')}"`;
        const obs = `"${(a.observacion || '').replace(/"/g, '""')}"`;
        csv += `${fecha},${a.semanaNombre || ''},${a.tipoEntidad},${ent},${a.adelantoId},${a.numeroCuota},${a.montoCobradoUSD},${a.tasaBcvAplicada},${a.montoCobradoBs},${a.saldoRestanteUSD},${obs},${a.estado}\n`;
    });

    const uri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', `Abonos_Amortizaciones_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exportación de abonos generada exitosamente');
}
window.exportarAbonosExcel = exportarAbonosExcel;

async function abrirModalRegistrarAbonoDirecto() {
    const select = document.getElementById('modalAbonoAdelantoId');
    const selectSemana = document.getElementById('modalAbonoSemanaId');
    const inputTasa = document.getElementById('modalAbonoTasaBCV');
    const inputMonto = document.getElementById('modalAbonoMontoUSD');
    const inputBs = document.getElementById('modalAbonoMontoBs');
    const inputRef = document.getElementById('modalAbonoReferencia');
    const inputObs = document.getElementById('modalAbonoObs');
    const boxInfo = document.getElementById('boxInfoSaldoAdelantoAbono');

    if (boxInfo) boxInfo.style.display = 'none';
    if (inputMonto) inputMonto.value = '';
    if (inputBs) inputBs.value = '';
    if (inputRef) inputRef.value = '';
    if (inputObs) inputObs.value = '';
    if (inputTasa) inputTasa.value = state.tasaBcv > 0 ? state.tasaBcv.toFixed(4) : '791.3248';

    if (select) {
        select.innerHTML = '<option value="">Cargando préstamos activos...</option>';
        try {
            const res = await fetch(`${API_BASE}/Adelantos?estado=ACTIVO`, {
                headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
            });
            if (res.ok) {
                const adelantos = await res.json();
                const activos = (adelantos || []).filter(a => Number(a.montoPendienteUSD || 0) > 0);
                if (activos.length === 0) {
                    select.innerHTML = '<option value="">-- No hay préstamos con saldo pendiente --</option>';
                } else {
                    select.innerHTML = '<option value="">-- Seleccionar Préstamo a Abonar --</option>' +
                        activos.map(a => `<option value="${a.id}" data-saldo="${a.montoPendienteUSD}" data-cuotas="${(a.cuotas || []).filter(c => c.estado !== 'COBRADO').length}">#${a.id} - ${capitalizarTexto(a.entidadNombre)} (Saldo: $${Number(a.montoPendienteUSD).toFixed(2)} USD)</option>`).join('');
                }
            }
        } catch (e) { console.warn(e); }
    }

    if (selectSemana && state.semanas && state.semanas.length > 0) {
        selectSemana.innerHTML = state.semanas.map(s => {
            const sel = (state.cicloActivo && (state.cicloActivo.id === s.id || state.cicloActivo.Id === s.Id)) ? 'selected' : '';
            return `<option value="${s.id || s.Id}" ${sel}>${s.codigo || s.Codigo || `Semana #${s.id}`}</option>`;
        }).join('');
    }

    abrirModalCustom('modalRegistrarAbonoDirecto');
}
window.abrirModalRegistrarAbonoDirecto = abrirModalRegistrarAbonoDirecto;

function onCambioAdelantoEnModalAbono(adelantoId) {
    const select = document.getElementById('modalAbonoAdelantoId');
    const box = document.getElementById('boxInfoSaldoAdelantoAbono');
    const lblSaldo = document.getElementById('lblSaldoPendienteAbono');
    const lblCuotas = document.getElementById('lblCuotasRestantesAbono');
    const inputMonto = document.getElementById('modalAbonoMontoUSD');

    if (!adelantoId || !select) {
        if (box) box.style.display = 'none';
        return;
    }

    const opt = select.selectedOptions[0];
    if (opt && opt.dataset) {
        const saldo = Number(opt.dataset.saldo || 0);
        const cuotas = opt.dataset.cuotas || '0';
        if (lblSaldo) lblSaldo.textContent = `$${saldo.toFixed(2)} USD`;
        if (lblCuotas) lblCuotas.textContent = `${cuotas} cuota(s) pendiente(s)`;
        if (inputMonto && !inputMonto.value) inputMonto.value = saldo.toFixed(2);
        if (box) box.style.display = 'flex';
        calcularBsAbonoLive();
    }
}
window.onCambioAdelantoEnModalAbono = onCambioAdelantoEnModalAbono;

function calcularBsAbonoLive() {
    const montoUSD = Number(document.getElementById('modalAbonoMontoUSD')?.value || 0);
    const tasa = Number(document.getElementById('modalAbonoTasaBCV')?.value || 0);
    const inputBs = document.getElementById('modalAbonoMontoBs');
    if (inputBs) {
        const bs = (montoUSD * tasa);
        inputBs.value = `Bs. ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
window.calcularBsAbonoLive = calcularBsAbonoLive;

async function guardarAbonoDirectoSubmit(e) {
    if (e) e.preventDefault();

    const adelantoId = Number(document.getElementById('modalAbonoAdelantoId')?.value || 0);
    const montoUSD = Number(document.getElementById('modalAbonoMontoUSD')?.value || 0);
    const tasa = Number(document.getElementById('modalAbonoTasaBCV')?.value || 0);
    const semanaId = Number(document.getElementById('modalAbonoSemanaId')?.value || 0) || null;
    const metodoPago = document.getElementById('modalAbonoMetodoPago')?.value || 'TRANSFERENCIA';
    const referencia = document.getElementById('modalAbonoReferencia')?.value || '';
    const obs = document.getElementById('modalAbonoObs')?.value || '';

    if (!adelantoId || montoUSD <= 0) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Selecciona un préstamo e ingresa un monto válido en USD.', background: '#1e293b', color: '#fff' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/Adelantos/abonos/directo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                adelantoId,
                montoAbonoUSD: montoUSD,
                tasaBcv: tasa,
                semanaOperativaId: semanaId,
                metodoPago,
                referenciaComprobante: referencia,
                observacion: obs
            })
        });

        const data = await res.json();
        if (res.ok) {
            cerrarModalCustom('modalRegistrarAbonoDirecto');
            showToast('¡Abono directo registrado y amortizado exitosamente!');
            await cargarAbonos();
            if (typeof cargarAdelantosFincas === 'function') await cargarAdelantosFincas();
        } else {
            Swal.fire({ icon: 'error', title: 'Error al registrar abono', text: data.message || 'No se pudo registrar el abono.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de conexión', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.guardarAbonoDirectoSubmit = guardarAbonoDirectoSubmit;

function exportarHistorialPagosExcel() {
    if (!historialPagosCache || historialPagosCache.length === 0) {
        showToast('No hay datos en el historial para exportar', 'warning');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,Fecha Pago,Ciclo / Semana,Finca,Propietario,Cedula RIF,Banco,Cuenta,Total Litros,Litros Buenos,Litros Acidos,Total USD,Tasa BCV,Bruto Bs,Adelanto USD,Adelanto Bs,Otras Deduc Bs,Neto Pagado Bs,Estado\n";

    historialPagosCache.forEach(row => {
        const rowData = [
            row.id,
            `"${row.fechaPago ? row.fechaPago.split('T')[0] : ''}"`,
            `"${row.cicloNombre || ''}"`,
            `"${row.fincaNombre || ''}"`,
            `"${row.propietario || ''}"`,
            `"${row.cedulaRIF || ''}"`,
            `"${row.bancoNombre || ''}"`,
            `"${row.numeroCuenta || ''}"`,
            row.totalLitros,
            row.totalLitrosBuenos,
            row.totalLitrosAcidos,
            row.totalUSD,
            row.tasaBcv,
            row.totalBrutoBs,
            row.totalAdelantosUSD,
            row.totalAdelantosBs,
            row.otrasDeduccionesBs,
            row.totalNetoBs,
            `"${row.estadoPago}"`
        ];
        csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Historial_Pagos_Liquidacion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === 'function') showToast('¡Historial de pagos exportado a Excel exitosamente!');
}
window.exportarHistorialPagosExcel = exportarHistorialPagosExcel;

function verReciboPagoLiquidacionModal(pagoId, tabActiva = 'voucher') {
    const listProcesados = (typeof historialPagosProcesados !== 'undefined' && Array.isArray(historialPagosProcesados)) ? historialPagosProcesados : [];
    const listCache = (typeof historialPagosCache !== 'undefined' && Array.isArray(historialPagosCache)) ? historialPagosCache : [];
    const listPreLiq = (typeof preLiquidacionDataCache !== 'undefined' && Array.isArray(preLiquidacionDataCache)) ? preLiquidacionDataCache : [];

    const item = listProcesados.find(x => Number(x.pagoId || x.PagoId || x.id || x.Id) === Number(pagoId))
              || listCache.find(x => Number(x.id || x.pagoId || x.PagoId) === Number(pagoId))
              || listPreLiq.find(x => Number(x.pagoId || x.PagoId || x.fincaId || x.FincaId || x.id || x.Id) === Number(pagoId));

    if (!item) {
        if (typeof showToast === 'function') showToast('No se encontró la información del comprobante de pago', 'error');
        return;
    }

    const body = document.getElementById('bodyModalReciboPago');
    if (!body) return;

    const fincaIdVal = item.fincaId || item.FincaId || item.id || item.pagoId;
    const fInicio = item.fechaInicioCiclo ? item.fechaInicioCiclo.split('T')[0] : '';
    const fFin = item.fechaFinCiclo ? item.fechaFinCiclo.split('T')[0] : '';
    const fPago = item.fechaPago ? item.fechaPago.split('T')[0] + ' ' + (item.fechaPago.split('T')[1] || '').substring(0, 5) : new Date().toLocaleString();

    const fmtBs = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUSD = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtTasa = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const fmtLts = (val) => Number(val || 0).toLocaleString('es-VE');

    const tasaBcv = item.tasaBcv || state.tasaBcv || 798.3260;
    const ltsBuenos = item.totalLitrosBuenos || 0;
    const precioNormalUsd = item.precioLitroUSD || 0;
    const montoUsdBuenos = ltsBuenos * precioNormalUsd;
    const montoBsBuenos = montoUsdBuenos * tasaBcv;

    const ltsAcidos = item.totalLitrosAcidos || 0;
    const precioAcidaUsd = item.precioLitroAcidaUSD || 0;
    const montoUsdAcidos = ltsAcidos * precioAcidaUsd;
    const montoBsAcidos = montoUsdAcidos * tasaBcv;

    const totalUsd = item.totalUSD || (montoUsdBuenos + montoUsdAcidos);
    const totalBrutoBs = item.totalBrutoBs || (totalUsd * tasaBcv);
    const adelantosBs = item.totalAdelantosBs || 0;
    const deduccionesBs = item.otrasDeduccionesBs || 0;
    const totalNetoBs = item.totalNetoBs || (totalBrutoBs - adelantosBs - deduccionesBs);

    const numRecibo = String(item.id || item.pagoId || item.fincaId || 1).padStart(6, '0');
    const esDeudor = totalNetoBs < 0;

    body.innerHTML = `
        <!-- NAVEGACIÓN ENTRE COMPROBANTE BANCARIO Y DETALLE DE COMPRA -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
            <button type="button" class="btn" onclick="verReciboPagoLiquidacionModal(${fincaIdVal}, 'voucher')" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: none; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; box-shadow: 0 4px 10px rgba(37,99,235,0.25);">
                <i class="fa-solid fa-file-invoice-dollar"></i> 1. Comprobante Oficial de Pago
            </button>
            <button type="button" class="btn" onclick="verDetalleCompraLecheFincaModal(${fincaIdVal})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #475569;">
                <i class="fa-solid fa-list-check"></i> 2. Detalle Diario de Compra (Relación para Finca)
            </button>
        </div>

        <div id="areaImpresionReciboPago" style="background: #ffffff; padding: 28px; border-radius: 14px; border: 1.5px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative;">
            
            <!-- ENCABEZADO CORPORATIVO PREMIUM -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 8px 16px -4px rgba(37,99,235,0.4);">
                        <i class="fa-solid fa-truck-droplet"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; letter-spacing: -0.4px;">TRANSPORTE Y RECOLECCIÓN DE LECHE</h2>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px; border: 1px solid #bfdbfe; text-transform: uppercase;">
                                <i class="fa-solid fa-receipt"></i> COMPROBANTE DE LIQUIDACIÓN SEMANAL
                            </span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="background: #0f172a; color: #ffffff; font-weight: 900; font-size: 14px; padding: 6px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(15,23,42,0.25);">
                        <span style="color: #94a3b8; font-weight: 600; font-size: 11px;">RECIBO N°</span> ${numRecibo}
                    </div>
                    <div style="margin-top: 6px; font-size: 12px; color: #64748b; font-weight: 600; display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                        <span><strong>Fecha Pago:</strong> ${fPago}</span>
                    </div>
                </div>
            </div>

            <!-- TARJETAS DE INFORMACIÓN DE PRODUCTOR Y BANCO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px;">
                
                <!-- CARD PRODUCTOR / FINCA -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <div style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 12px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-cow"></i> Datos del Productor / Finca
                        </span>
                        <span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
                            ID #${item.fincaId || item.FincaId || '-'}
                        </span>
                    </div>
                    <div style="padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #1e293b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="color: #64748b; font-weight: 600;">Finca:</span>
                            <strong style="color: #0f172a; font-size: 14px;">${item.fincaNombre || item.FincaNombre || '-'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="color: #64748b; font-weight: 600;">Propietario / Titular:</span>
                            <strong style="color: #0f172a;">${item.propietario || item.Propietario || 'N/A'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b; font-weight: 600;">Cédula / RIF:</span>
                            <strong style="color: #0f172a; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${item.cedulaRIF || item.CedulaRIF || 'N/A'}</strong>
                        </div>
                    </div>
                </div>

                <!-- CARD CUENTA / PAGO -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <div style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-building-columns"></i> Cuenta Bancaria de Destino
                        </span>
                        <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
                            Tasa: Bs. ${fmtBs(tasaBcv)}
                        </span>
                    </div>
                    <div style="padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #1e293b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="color: #64748b; font-weight: 600;">Banco:</span>
                            <strong style="color: #0f172a;">${item.bancoNombre || item.BancoNombre || 'Sin Banco'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="color: #64748b; font-weight: 600;">N° Cuenta:</span>
                            <strong style="color: #0f172a; font-family: monospace; font-size: 13px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${item.numeroCuenta || item.NumeroCuenta || 'N/A'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b; font-weight: 600;">Ciclo Operativo:</span>
                            <strong style="color: #2563eb;">${item.cicloNombre || ('Semana (' + fInicio + ' al ' + fFin + ')')}</strong>
                        </div>
                    </div>
                </div>

            </div>

            <!-- TABLA DE DESGLOSE DE PAGO -->
            <div style="margin-bottom: 10px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-table-list" style="color: #2563eb;"></i> Detalle de Conceptos Liquidables
                </span>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    ${fmtLts(ltsBuenos + ltsAcidos)} Lts Totales
                </span>
            </div>

            <div style="border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                            <th style="padding: 11px 14px; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Concepto / Detalle</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Cantidad / Tasa</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Monto USD ($)</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Total Bolívares (Bs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                            <td style="padding: 12px 14px; font-weight: 700; color: #0f172a;">
                                <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 12px; margin-right: 4px;"></i> Recolección Leche Buena
                            </td>
                            <td style="padding: 12px 14px; text-align: right; color: #334155; font-weight: 600;">
                                ${fmtLts(ltsBuenos)} Lts @ $${precioNormalUsd.toFixed(4)}
                            </td>
                            <td style="padding: 12px 14px; text-align: right; color: #2563eb; font-weight: 800; font-size: 13px;">
                                $ ${fmtUSD(montoUsdBuenos)}
                            </td>
                            <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">
                                Bs. ${fmtBs(montoBsBuenos)}
                            </td>
                        </tr>
                        ${ltsAcidos > 0 ? `
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #fffbeb;">
                                <td style="padding: 12px 14px; font-weight: 700; color: #b45309;">
                                    <i class="fa-solid fa-flask" style="color: #d97706; margin-right: 4px;"></i> Recolección Leche Ácida
                                </td>
                                <td style="padding: 12px 14px; text-align: right; color: #b45309; font-weight: 600;">
                                    ${fmtLts(ltsAcidos)} Lts @ $${precioAcidaUsd.toFixed(4)}
                                </td>
                                <td style="padding: 12px 14px; text-align: right; color: #b45309; font-weight: 800; font-size: 13px;">
                                    $ ${fmtUSD(montoUsdAcidos)}
                                </td>
                                <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: #b45309; font-size: 13px;">
                                    Bs. ${fmtBs(montoBsAcidos)}
                                </td>
                            </tr>
                        ` : ''}
                        <tr style="background: #f8fafc; font-weight: 800; border-bottom: 1.5px solid #cbd5e1;">
                            <td style="padding: 12px 14px; color: #1e293b;" colspan="2">
                                TOTAL BRUTO RECOLECTADO
                                <span style="font-size: 11px; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 4px; margin-left: 8px;">Tasa BCV: ${fmtTasa(tasaBcv)} Bs/$</span>
                            </td>
                            <td style="padding: 12px 14px; text-align: right; color: #2563eb; font-weight: 900; font-size: 13.5px;">$ ${fmtUSD(totalUsd)}</td>
                            <td style="padding: 12px 14px; text-align: right; color: #0f172a; font-weight: 900; font-size: 13.5px;">Bs. ${fmtBs(totalBrutoBs)}</td>
                        </tr>
                        ${adelantosBs > 0 ? `
                            <tr style="color: #dc2626; border-bottom: 1px solid #fee2e2; background: #fff5f5;">
                                <td style="padding: 12px 14px; font-weight: 700;" colspan="3">
                                    <i class="fa-solid fa-hand-holding-dollar" style="margin-right: 4px;"></i> Descuento de Adelanto / Préstamo ${item.cuotasDetalle ? '<span style="background: #fee2e2; padding: 1px 6px; border-radius: 4px; font-size: 11.5px;">' + item.cuotasDetalle + '</span>' : ''}
                                </td>
                                <td style="padding: 12px 14px; text-align: right; font-weight: 900; font-size: 13.5px;">- Bs. ${fmtBs(adelantosBs)}</td>
                            </tr>
                        ` : ''}
                        ${deduccionesBs > 0 ? `
                            <tr style="color: #d97706; border-bottom: 1px solid #fef3c7; background: #fffbeb;">
                                <td style="padding: 12px 14px; font-weight: 700;" colspan="3">
                                    <i class="fa-solid fa-minus-circle" style="margin-right: 4px;"></i> Otras Deducciones ${item.conceptoDeducciones ? '<span style="background: #fef3c7; padding: 1px 6px; border-radius: 4px; font-size: 11.5px;">' + item.conceptoDeducciones + '</span>' : ''}
                                </td>
                                <td style="padding: 12px 14px; text-align: right; font-weight: 900; font-size: 13.5px;">- Bs. ${fmtBs(deduccionesBs)}</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>

            <!-- RESUMEN FINAL CONSOLIDADO PREMIUM -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 20px 24px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px -5px rgba(15,23,42,0.3); border: 1.5px solid #334155; margin-bottom: 28px;">
                <div>
                    <div style="font-size: 11.5px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-calculator" style="color: #38bdf8;"></i> RESUMEN DE LA LIQUIDACIÓN
                    </div>
                    <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12.5px; color: #cbd5e1;">
                        <span>Litros: <strong style="color: #ffffff;">${fmtLts(ltsBuenos + ltsAcidos)} L</strong></span>
                        <span>Total USD: <strong style="color: #38bdf8;">$ ${fmtUSD(totalUsd)}</strong></span>
                        <span>Total Bruto: <strong style="color: #ffffff;">Bs. ${fmtBs(totalBrutoBs)}</strong></span>
                        ${adelantosBs > 0 ? `<span>Adelantos: <strong style="color: #f87171;">- Bs. ${fmtBs(adelantosBs)}</strong></span>` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">MONTO NETO A TRANSFERIR:</div>
                    <div style="font-size: 26px; font-weight: 900; color: ${esDeudor ? '#f87171' : '#34d399'}; letter-spacing: -0.5px; margin-top: 2px;">
                        ${esDeudor ? '- Bs. ' + fmtBs(Math.abs(totalNetoBs)) : 'Bs. ' + fmtBs(totalNetoBs)}
                    </div>
                </div>
            </div>

            <!-- FIRMAS Y VERIFICACIÓN OFICIAL -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 24px; border-top: 1.5px dashed #cbd5e1;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 30px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Firma del Productor / Beneficiario</div>
                    <div style="font-size: 11px; color: #64748b;">${item.propietario || item.fincaNombre || ''}</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 30px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Autorizado y Liquidado por Administración</div>
                    <div style="font-size: 11px; color: #64748b;">Transporte y Recolección de Leche</div>
                </div>
            </div>

            <!-- SELLO DE VALIDACIÓN FOOTER -->
            <div style="margin-top: 22px; text-align: center; font-size: 10.5px; color: #94a3b8; font-weight: 600; letter-spacing: 0.4px;">
                <i class="fa-solid fa-shield-halved" style="color: #10b981;"></i> COMPROBANTE EMITIDO ELECTRÓNICAMENTE | TRANSPORTE V2 SISTEMA ADMINISTRATIVO INTEGRAL
            </div>

        </div>
    `;

    abrirModalCustom('modalReciboPagoLiquidacion');
}
window.verReciboPagoLiquidacionModal = verReciboPagoLiquidacionModal;

async function verDetalleCompraLecheFincaModal(fincaId) {
    const listProcesados = (typeof historialPagosProcesados !== 'undefined' && Array.isArray(historialPagosProcesados)) ? historialPagosProcesados : [];
    const listCache = (typeof historialPagosCache !== 'undefined' && Array.isArray(historialPagosCache)) ? historialPagosCache : [];
    const listPreLiq = (typeof preLiquidacionDataCache !== 'undefined' && Array.isArray(preLiquidacionDataCache)) ? preLiquidacionDataCache : [];

    const item = listPreLiq.find(x => Number(x.fincaId || x.FincaId || x.id || x.pagoId) === Number(fincaId))
              || listProcesados.find(x => Number(x.fincaId || x.FincaId || x.pagoId || x.id) === Number(fincaId))
              || listCache.find(x => Number(x.fincaId || x.FincaId || x.id) === Number(fincaId));

    if (!item) {
        if (typeof showToast === 'function') showToast('No se encontró información de la finca seleccionada', 'error');
        return;
    }

    const body = document.getElementById('bodyModalReciboPago');
    if (!body) return;

    const fincaIdVal = item.fincaId || item.FincaId || fincaId;
    const fincaNombre = item.fincaNombre || item.FincaNombre || 'Finca';
    const propietario = item.propietario || item.Propietario || 'Productor';
    const tasaBcv = item.tasaBcv || state.tasaBcv || 798.3260;
    const fInicio = item.fechaInicioCiclo ? item.fechaInicioCiclo.split('T')[0] : '';
    const fFin = item.fechaFinCiclo ? item.fechaFinCiclo.split('T')[0] : '';
    const periodoStr = (fInicio && fFin) ? `${fInicio} al ${fFin}` : 'Ciclo Actual';

    const fmtBs = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUSD = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLts = (val) => Number(val || 0).toLocaleString('es-VE');

    // Show loading spinner
    body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: #059669; margin-bottom: 16px;"></i>
            <h4 style="color: #0f172a; margin: 0; font-size: 16px; font-weight: 800;">Cargando Detalle Diario de Compra...</h4>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Consultando recolecciones diarias para ${fincaNombre}</p>
        </div>
    `;
    abrirModalCustom('modalReciboPagoLiquidacion');

    // Fetch daily report for this finca
    let detalleRows = [];
    try {
        const fIniParam = fInicio || (state.filtrosReporte && state.filtrosReporte.fechaInicio) || new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
        const fFinParam = fFin || (state.filtrosReporte && state.filtrosReporte.fechaFin) || new Date().toISOString().split('T')[0];
        const res = await fetch(`${API_BASE}/reportes/fincas?fechaInicio=${fIniParam}&fechaFin=${fFinParam}&fincaIds=${fincaIdVal}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                detalleRows = data[0].detalle || data[0].Detalle || [];
            }
        }
    } catch (e) {
        console.error('Error fetching finca detail:', e);
    }

    let totLtsVaca = 0, totUSDVaca = 0, totBsVaca = 0;
    let totLtsBufala = 0, totUSDBufala = 0, totBsBufala = 0;
    let totLtsAcida = 0, totUSDAcida = 0, totBsAcida = 0;
    let totalLtsGral = 0, totalUSDGral = 0, totalBsGral = 0;

    const precioNormalFinca = Number(item.precioLitroUSD || item.PrecioLitroUSD || 0.84);
    const precioAcidaFinca = Number(item.precioLitroAcidaUSD || item.PrecioLitroAcidaUSD || (precioNormalFinca / 2));
    const precioBufalaFinca = Number(item.precioLitroBufalaUSD || item.PrecioLitroBufalaUSD || (precioNormalFinca * 1.25));

    const processedRows = detalleRows.map(d => {
        const fecha = d.fecha || d.Fecha || '';
        const litros = Number(d.litros || d.Litros || 0);
        const esAcida = !!(d.esAcida || d.EsAcida);
        const tipoLeche = String(d.tipoLeche || d.TipoLeche || 'VACA').toUpperCase();
        
        let precioUSD = precioNormalFinca;
        if (esAcida) {
            precioUSD = precioAcidaFinca;
        } else if (tipoLeche === 'BUFALA') {
            precioUSD = precioBufalaFinca;
        }

        const subUSD = litros * precioUSD;
        const subBs = subUSD * tasaBcv;

        if (esAcida) {
            totLtsAcida += litros;
            totUSDAcida += subUSD;
            totBsAcida += subBs;
        } else if (tipoLeche === 'BUFALA') {
            totLtsBufala += litros;
            totUSDBufala += subUSD;
            totBsBufala += subBs;
        } else {
            totLtsVaca += litros;
            totUSDVaca += subUSD;
            totBsVaca += subBs;
        }

        totalLtsGral += litros;
        totalUSDGral += subUSD;
        totalBsGral += subBs;

        return {
            fecha,
            litros,
            tipoLeche,
            esAcida,
            precioUSD,
            subUSD,
            subBs
        };
    });

    // Fallback if no report rows found but we have pre-liquidation totals
    if (processedRows.length === 0 && (item.totalLitros || 0) > 0) {
        const ltsB = item.totalLitrosBuenos || item.totalLitros || 0;
        const ltsA = item.totalLitrosAcidos || 0;
        const pB = precioNormalFinca;
        const pA = precioAcidaFinca;
        if (ltsB > 0) {
            totLtsVaca = ltsB;
            totUSDVaca = ltsB * pB;
            totBsVaca = totUSDVaca * tasaBcv;
            processedRows.push({
                fecha: fInicio || 'Ciclo Completo',
                litros: ltsB,
                tipoLeche: 'VACA',
                esAcida: false,
                precioUSD: pB,
                subUSD: totUSDVaca,
                subBs: totBsVaca
            });
        }
        if (ltsA > 0) {
            totLtsAcida = ltsA;
            totUSDAcida = ltsA * pA;
            totBsAcida = totUSDAcida * tasaBcv;
            processedRows.push({
                fecha: fInicio || 'Ciclo Completo',
                litros: ltsA,
                tipoLeche: 'ACIDA',
                esAcida: true,
                precioUSD: pA,
                subUSD: totUSDAcida,
                subBs: totBsAcida
            });
        }
        totalLtsGral = ltsB + ltsA;
        totalUSDGral = totUSDVaca + totUSDAcida;
        totalBsGral = totBsVaca + totBsAcida;
    }

    // Sort chronologically
    processedRows.sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

    const totalAdelantosBs = Number(item.totalAdelantosBs || 0);
    const totalDeduccionesBs = Number(item.otrasDeduccionesBs || 0);
    const netoPagarBs = totalBsGral - totalAdelantosBs - totalDeduccionesBs;
    const netoPagarUSD = totalUSDGral - (tasaBcv > 0 ? (totalAdelantosBs + totalDeduccionesBs) / tasaBcv : 0);

    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const formatFechaDia = (fStr) => {
        if (!fStr) return '-';
        const parts = fStr.split('-');
        if (parts.length < 3) return fStr;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return `${nombresDias[d.getDay()]} ${parts[2]}/${parts[1]}`;
    };

    const filasHtml = processedRows.length > 0 ? processedRows.map((r, i) => {
        let badgeTipo = `<span style="background: #ecfdf5; color: #047857; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #a7f3d0;"><i class="fa-solid fa-cow"></i> VACA</span>`;
        if (r.esAcida) {
            badgeTipo = `<span style="background: #fffbeb; color: #b45309; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #fde68a;"><i class="fa-solid fa-flask"></i> ÁCIDA</span>`;
        } else if (r.tipoLeche === 'BUFALA') {
            badgeTipo = `<span style="background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #bfdbfe;"><i class="fa-solid fa-shield-cat"></i> BÚFALA</span>`;
        }

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; white-space: nowrap;">
                    ${formatFechaDia(r.fecha)}
                </td>
                <td style="padding: 10px 14px; text-align: center;">
                    ${badgeTipo}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 13.5px; color: #0f172a;">
                    ${fmtLts(r.litros)} <small style="font-weight: 600; color: #64748b;">L</small>
                </td>
                <td style="padding: 10px 14px; text-align: right; color: #2563eb; font-weight: 700; font-size: 12.5px;">
                    $${r.precioUSD.toFixed(4)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #2563eb; font-size: 13px;">
                    $${fmtUSD(r.subUSD)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">
                    Bs. ${fmtBs(r.subBs)}
                </td>
            </tr>
        `;
    }).join('') : `
        <tr>
            <td colspan="6" style="padding: 24px; text-align: center; color: #64748b; font-weight: 600;">
                No se registraron recolecciones diarias en el periodo seleccionado.
            </td>
        </tr>
    `;

    // Generate WhatsApp text
    let waTxt = `🥛 *DETALLE DE COMPRA DE LECHE* 🥛\n`;
    waTxt += `🏢 *TRANSPORTE Y RECOLECCIÓN DE LECHE*\n`;
    waTxt += `📍 *Finca:* ${fincaNombre}\n`;
    waTxt += `👤 *Productor:* ${propietario}\n`;
    waTxt += `📅 *Ciclo:* ${periodoStr}\n`;
    waTxt += `💵 *Tasa BCV:* Bs. ${fmtBs(tasaBcv)} / $\n\n`;
    waTxt += `📋 *RECOLECCIÓN DIARIA:*\n`;

    processedRows.forEach(r => {
        const tStr = r.esAcida ? 'Ácida' : (r.tipoLeche === 'BUFALA' ? 'Búfala' : 'Vaca');
        waTxt += `• ${formatFechaDia(r.fecha)}: ${fmtLts(r.litros)} L [${tStr}] @ $${r.precioUSD.toFixed(4)} = $${fmtUSD(r.subUSD)} (Bs. ${fmtBs(r.subBs)})\n`;
    });

    waTxt += `\n📊 *RESUMEN DE LECHE:*`;
    if (totLtsVaca > 0) waTxt += `\n• 🥛 Leche Vaca: ${fmtLts(totLtsVaca)} L | $${fmtUSD(totUSDVaca)} | Bs. ${fmtBs(totBsVaca)}`;
    if (totLtsBufala > 0) waTxt += `\n• 🦬 Leche Búfala: ${fmtLts(totLtsBufala)} L | $${fmtUSD(totUSDBufala)} | Bs. ${fmtBs(totBsBufala)}`;
    if (totLtsAcida > 0) waTxt += `\n• ⚠️ Leche Ácida: ${fmtLts(totLtsAcida)} L | $${fmtUSD(totUSDAcida)} | Bs. ${fmtBs(totBsAcida)}`;
    waTxt += `\n• *Total Litros:* ${fmtLts(totalLtsGral)} L`;
    waTxt += `\n• *Total Bruto:* $${fmtUSD(totalUSDGral)} (Bs. ${fmtBs(totalBsGral)})\n`;

    if (totalAdelantosBs > 0 || totalDeduccionesBs > 0) {
        waTxt += `\n💳 *DEDUCCIONES / ADELANTOS:*`;
        if (totalAdelantosBs > 0) waTxt += `\n• (-) Adelantos/Préstamos: - Bs. ${fmtBs(totalAdelantosBs)}`;
        if (totalDeduccionesBs > 0) waTxt += `\n• (-) Otras Deducciones: - Bs. ${fmtBs(totalDeduccionesBs)}`;
    }

    waTxt += `\n-----------------------------------`;
    waTxt += `\n💰 *TOTAL NETO A PAGAR: Bs. ${fmtBs(netoPagarBs)} ($${fmtUSD(netoPagarUSD)})*\n`;
    waTxt += `🏦 *Cuenta Destino:* ${item.bancoNombre || 'Banco'} (${item.numeroCuenta || 'N/A'})\n`;
    waTxt += `✅ *Estado:* LIQUIDACIÓN CONFORME`;

    const waTxtEscaped = encodeURIComponent(waTxt);

    body.innerHTML = `
        <!-- NAVEGACIÓN ENTRE COMPROBANTE BANCARIO Y DETALLE DE COMPRA -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
            <button type="button" class="btn" onclick="verReciboPagoLiquidacionModal(${fincaIdVal}, 'voucher')" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #475569;">
                <i class="fa-solid fa-file-invoice-dollar"></i> 1. Comprobante Oficial de Pago
            </button>
            <button type="button" class="btn" onclick="verDetalleCompraLecheFincaModal(${fincaIdVal})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: none; background: linear-gradient(135deg, #065f46, #059669); color: #ffffff; box-shadow: 0 4px 10px rgba(5,150,105,0.25);">
                <i class="fa-solid fa-list-check"></i> 2. Detalle Diario de Compra (Relación para Finca)
            </button>
        </div>

        <div id="areaImpresionReciboPago" style="background: #ffffff; padding: 26px; border-radius: 14px; border: 1.5px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            
            <!-- CABECERA DE RELACIÓN PARA FINCA -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #065f46 0%, #059669 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 8px 16px -4px rgba(5,150,105,0.4);">
                        <i class="fa-solid fa-clipboard-list"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; letter-spacing: -0.4px;">RELACIÓN DE COMPRA DE LECHE</h2>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="background: #ecfdf5; color: #047857; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">
                                <i class="fa-solid fa-calendar-week"></i> Periodo: ${periodoStr}
                            </span>
                            <span style="background: #eff6ff; color: #2563eb; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
                                <i class="fa-solid fa-dollar-sign"></i> Tasa BCV: Bs. ${fmtBs(tasaBcv)}
                            </span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <button type="button" class="btn" onclick="copiarDetalleLiquidacionWhatsApp(decodeURIComponent('${waTxtEscaped}'))" style="background: #10b981; color: #ffffff; font-weight: 800; font-size: 12.5px; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                        <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> Copiar para WhatsApp
                    </button>
                </div>
            </div>

            <!-- CARD FINCA Y RESUMEN -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">DATOS DE LA FINCA</div>
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${fincaNombre}</div>
                    <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                        <strong>Propietario:</strong> ${propietario}
                    </div>
                    <div style="font-size: 12px; color: #475569; margin-top: 2px;">
                        <strong>C.I. / RIF:</strong> <span style="font-family: monospace;">${item.cedulaRIF || item.CedulaRIF || 'N/A'}</span>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">PAGO Y TRANSFERENCIA</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${item.bancoNombre || 'Sin Banco'}</div>
                    <div style="font-size: 12.5px; font-family: monospace; color: #2563eb; margin-top: 2px;">
                        ${item.numeroCuenta || 'N/A'}
                    </div>
                    <div style="font-size: 11.5px; color: #059669; font-weight: 800; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-circle-check"></i> Liquidación Conforme
                    </div>
                </div>
            </div>

            <!-- TABLA DE RECOLECCIÓN DIARIA -->
            <div style="margin-bottom: 10px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-calendar-day" style="color: #059669;"></i> Registro Diario de Recolección
                </span>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    ${processedRows.length} Días / Registros
                </span>
            </div>

            <div style="border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                            <th style="padding: 10px 14px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Día / Fecha</th>
                            <th style="padding: 10px 14px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo Leche</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Litros</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Precio $/L</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal ($)</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal (Bs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml}
                    </tbody>
                </table>
            </div>

            <!-- RESUMEN POR TIPO DE LECHE -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
                ${totLtsVaca > 0 ? `
                    <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase;"><i class="fa-solid fa-cow"></i> Leche de Vaca</div>
                        <div style="font-size: 18px; font-weight: 900; color: #065f46; margin-top: 2px;">${fmtLts(totLtsVaca)} L</div>
                        <div style="font-size: 12px; color: #047857; font-weight: 700;">$${fmtUSD(totUSDVaca)} | Bs. ${fmtBs(totBsVaca)}</div>
                    </div>
                ` : ''}
                ${totLtsBufala > 0 ? `
                    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase;"><i class="fa-solid fa-shield-cat"></i> Leche de Búfala</div>
                        <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; margin-top: 2px;">${fmtLts(totLtsBufala)} L</div>
                        <div style="font-size: 12px; color: #1e40af; font-weight: 700;">$${fmtUSD(totUSDBufala)} | Bs. ${fmtBs(totBsBufala)}</div>
                    </div>
                ` : ''}
                ${totLtsAcida > 0 ? `
                    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase;"><i class="fa-solid fa-flask"></i> Leche Ácida</div>
                        <div style="font-size: 18px; font-weight: 900; color: #92400e; margin-top: 2px;">${fmtLts(totLtsAcida)} L</div>
                        <div style="font-size: 12px; color: #b45309; font-weight: 700;">$${fmtUSD(totUSDAcida)} | Bs. ${fmtBs(totBsAcida)}</div>
                    </div>
                ` : ''}
            </div>

            <!-- CUADRO DE LIQUIDACIÓN Y MONTO FINAL -->
            <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #ffffff; padding: 22px 26px; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(6,78,59,0.3); border: 1.5px solid #047857; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 14px; margin-bottom: 14px;">
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.8px;">TOTAL RECOLECTADO EN CICLO</div>
                        <div style="font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 2px;">${fmtLts(totalLtsGral)} Litros Totales</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.8px;">VALOR BRUTO LECHE</div>
                        <div style="font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 2px;">$${fmtUSD(totalUSDGral)} <span style="font-size: 14px; color: #cbd5e1;">(Bs. ${fmtBs(totalBsGral)})</span></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12.5px; color: #d1fae5;">
                        ${totalAdelantosBs > 0 ? `<div>(-) Adelantos / Préstamos: <strong style="color: #fca5a5;">- Bs. ${fmtBs(totalAdelantosBs)}</strong></div>` : ''}
                        ${totalDeduccionesBs > 0 ? `<div>(-) Otras Deducciones: <strong style="color: #fde68a;">- Bs. ${fmtBs(totalDeduccionesBs)}</strong></div>` : ''}
                        ${(totalAdelantosBs === 0 && totalDeduccionesBs === 0) ? `<div>Sin deducciones aplicadas en este ciclo</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.8px;">MONTO NETO A TRANSFERIR:</div>
                        <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; margin-top: 2px;">
                            Bs. ${fmtBs(netoPagarBs)}
                        </div>
                        <div style="font-size: 13px; font-weight: 800; color: #a7f3d0;">
                            ($ ${fmtUSD(netoPagarUSD)} USD)
                        </div>
                    </div>
                </div>
            </div>

            <!-- FIRMAS Y VERIFICACIÓN -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 20px; border-top: 1.5px dashed #cbd5e1;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Recibido Conforme Productor</div>
                    <div style="font-size: 11px; color: #64748b;">${propietario}</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Transporte y Recolección de Leche</div>
                    <div style="font-size: 11px; color: #64748b;">Administración y Liquidaciones</div>
                </div>
            </div>

        </div>
    `;
}
window.verDetalleCompraLecheFincaModal = verDetalleCompraLecheFincaModal;

async function verReciboPagoConsolidadoModal(propietarioNombre, fincaIds) {
    const listPreLiq = (typeof preLiquidacionDataCache !== 'undefined' && Array.isArray(preLiquidacionDataCache)) ? preLiquidacionDataCache : [];
    const consolidados = obtenerPreliquidacionConsolidada(listPreLiq);

    let g = null;
    if (propietarioNombre) {
        g = consolidados.find(x => (x.propietario || '').trim().toUpperCase() === propietarioNombre.trim().toUpperCase());
    }
    if (!g && Array.isArray(fincaIds) && fincaIds.length > 0) {
        g = consolidados.find(x => x.fincaIds.some(fid => fincaIds.includes(fid)));
    }

    if (!g) {
        if (typeof showToast === 'function') showToast('No se encontró información del productor consolidado', 'error');
        return;
    }

    const body = document.getElementById('bodyModalReciboPago');
    if (!body) return;

    const propNom = g.propietario || 'Productor';
    const tasaBcv = (g.fincas && g.fincas[0] && g.fincas[0].tasaBcv) ? g.fincas[0].tasaBcv : (state.tasaBcv || 798.3260);
    const fInicio = (g.fincas && g.fincas[0] && g.fincas[0].fechaInicioCiclo) ? g.fincas[0].fechaInicioCiclo.split('T')[0] : '';
    const fFin = (g.fincas && g.fincas[0] && g.fincas[0].fechaFinCiclo) ? g.fincas[0].fechaFinCiclo.split('T')[0] : '';
    const periodoStr = (fInicio && fFin) ? `${fInicio} al ${fFin}` : 'Ciclo Actual';

    const fmtBs = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUSD = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLts = (val) => Number(val || 0).toLocaleString('es-VE');
    const fmtTasa = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

    const totalLitros = g.totalLitros || 0;
    const totalLitrosBuenos = g.totalLitrosBuenos || 0;
    const totalLitrosAcidos = g.totalLitrosAcidos || 0;
    const totalLitrosVaca = g.totalLitrosVaca || 0;
    const totalLitrosBufala = g.totalLitrosBufala || 0;
    const totalUSD = g.totalUSD || 0;
    const totalBrutoBs = g.totalBrutoBs || 0;
    const totalAdelantosBs = g.totalAdelantosBs || 0;
    const otrasDeduccionesBs = g.otrasDeduccionesBs || 0;
    const totalNetoBs = g.totalNetoBs || (totalBrutoBs - totalAdelantosBs - otrasDeduccionesBs);
    const totalNetoUSD = tasaBcv > 0 ? (totalNetoBs / tasaBcv) : 0;
    const esDeudor = totalNetoBs < 0;

    const idsJson = JSON.stringify(g.fincaIds);
    const propEscaped = propNom.replace(/'/g, "\\'");

    const filasFincasHtml = g.fincas.map((f, idx) => {
        const lts = f.totalLitros || 0;
        const usd = f.totalUSD || 0;
        const bs = f.totalBrutoBs || 0;
        const ade = f.totalAdelantosBs || 0;
        const netBs = f.totalNetoBs || (bs - ade);
        const lB = f.totalLitrosBufala || 0;
        const lV = f.totalLitrosVaca || 0;
        const lA = f.totalLitrosAcidos || 0;

        let tipoStr = '';
        if (lB > 0 && lV > 0) tipoStr = `<small style="color: #047857; font-weight: 700;">${lV}L Vaca / ${lB}L Búfala</small>`;
        else if (lB > 0) tipoStr = `<span class="badge" style="background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px;">BÚFALA</span>`;
        else tipoStr = `<span style="color: #2563eb; font-size: 10.5px; font-weight: 700;">VACA</span>`;

        if (lA > 0) tipoStr += ` <span class="badge" style="background: #fffbeb; color: #b45309; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px;">${lA}L ÁCIDA</span>`;

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 10px 14px;">
                    <strong style="color: #0f172a; font-size: 13px;">${f.fincaNombre || f.FincaNombre}</strong>
                    <div>${tipoStr}</div>
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0f172a;">
                    ${fmtLts(lts)} Lts
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #2563eb;">
                    $ ${fmtUSD(usd)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #0f172a;">
                    Bs. ${fmtBs(bs)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: ${ade > 0 ? '#dc2626' : '#94a3b8'};">
                    ${ade > 0 ? `- Bs. ${fmtBs(ade)}` : '-'}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #047857; font-size: 13.5px;">
                    Bs. ${fmtBs(netBs)}
                </td>
            </tr>
        `;
    }).join('');

    body.innerHTML = `
        <!-- NAVEGACIÓN ENTRE COMPROBANTE CONSOLIDADO Y DETALLE DE COMPRA -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
            <button type="button" class="btn" onclick="verReciboPagoConsolidadoModal('${propEscaped}', ${idsJson})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: none; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; box-shadow: 0 4px 10px rgba(37,99,235,0.25);">
                <i class="fa-solid fa-file-invoice-dollar"></i> 1. Comprobante Oficial Consolidado
            </button>
            <button type="button" class="btn" onclick="verDetalleCompraLecheConsolidadaModal('${propEscaped}', ${idsJson})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #475569;">
                <i class="fa-solid fa-list-check"></i> 2. Detalle Diario Consolidado (Relación para Fincas)
            </button>
        </div>

        <div id="areaImpresionReciboPago" style="background: #ffffff; padding: 26px; border-radius: 14px; border: 1.5px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            
            <!-- CABECERA DE COMPROBANTE CONSOLIDADO -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 8px 16px -4px rgba(37,99,235,0.4);">
                        <i class="fa-solid fa-layer-group"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; letter-spacing: -0.4px;">COMPROBANTE DE PAGO CONSOLIDADO</h2>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="background: #eff6ff; color: #1e40af; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
                                <i class="fa-solid fa-user-check"></i> Productor Unificado (${g.fincas.length} Fincas)
                            </span>
                            <span style="background: #ecfdf5; color: #047857; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">
                                <i class="fa-solid fa-calendar-week"></i> Periodo: ${periodoStr}
                            </span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">ESTADO DEL PAGO</div>
                    <div style="margin-top: 4px;">
                        ${g.esPagado ? '<span style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-circle-check"></i> CONSOLIDADO PAGADO</span>' : '<span style="background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-clock"></i> PENDIENTE POR TRANSFERIR</span>'}
                    </div>
                </div>
            </div>

            <!-- CARDS DE PRODUCTOR Y BANCO -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">DATOS DEL PRODUCTOR</div>
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${propNom}</div>
                    <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                        <strong>C.I. / RIF:</strong> <span style="font-family: monospace;">${g.cedulaRIF || 'N/A'}</span>
                    </div>
                    <div style="font-size: 12px; color: #0369a1; font-weight: 700; margin-top: 2px;">
                        <strong>Fincas Asociadas:</strong> ${g.fincasNombresStr}
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">CUENTA DESTINO DE PAGO</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${g.propietarioBancoNombre || g.bancoNombre || 'Banco Registrado'}</div>
                    <div style="font-size: 12.5px; font-family: monospace; color: #2563eb; margin-top: 2px;">
                        ${g.propietarioNumeroCuenta || g.numeroCuenta || 'N/A'}
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
                        Tasa BCV Aplicada: <strong style="color: #0f172a;">Bs. ${fmtTasa(tasaBcv)}</strong>
                    </div>
                </div>
            </div>

            <!-- TABLA DE FINCAS CONSOLIDADAS -->
            <div style="margin-bottom: 10px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-list" style="color: #2563eb;"></i> Relación de Fincas Liquidadas
                </span>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    ${fmtLts(totalLitros)} Lts Totales en ${g.fincas.length} Fincas
                </span>
            </div>

            <div style="border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                            <th style="padding: 11px 14px; font-weight: 800; font-size: 11px; text-transform: uppercase;">Finca</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Litros</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Monto USD</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Bruto Bs</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Adelantos</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Neto Finca (Bs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasFincasHtml}
                    </tbody>
                </table>
            </div>

            <!-- CUADRO DE RESUMEN CONSOLIDADO FINAL -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 22px 26px; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(15,23,42,0.3); border: 1.5px solid #334155; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 14px; margin-bottom: 14px;">
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px;">TOTAL LITROS PRODUCTOR</div>
                        <div style="font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 2px;">${fmtLts(totalLitros)} L (${totalLitrosVaca > 0 ? fmtLts(totalLitrosVaca) + ' L Vaca ' : ''}${totalLitrosBufala > 0 ? fmtLts(totalLitrosBufala) + ' L Búfala ' : ''}${totalLitrosAcidos > 0 ? fmtLts(totalLitrosAcidos) + ' L Ácida' : ''})</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px;">VALOR BRUTO TOTAL</div>
                        <div style="font-size: 20px; font-weight: 900; color: #38bdf8; margin-top: 2px;">$ ${fmtUSD(totalUSD)} <span style="font-size: 14px; color: #cbd5e1;">(Bs. ${fmtBs(totalBrutoBs)})</span></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12.5px; color: #cbd5e1;">
                        ${totalAdelantosBs > 0 ? `<div>(-) Total Adelantos / Préstamos: <strong style="color: #fca5a5;">- Bs. ${fmtBs(totalAdelantosBs)}</strong></div>` : ''}
                        ${otrasDeduccionesBs > 0 ? `<div>(-) Otras Deducciones: <strong style="color: #fde68a;">- Bs. ${fmtBs(otrasDeduccionesBs)}</strong></div>` : ''}
                        ${(totalAdelantosBs === 0 && otrasDeduccionesBs === 0) ? `<div>Sin descuentos aplicados en este ciclo</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.8px;">PAGO NETO UNIFICADO A TRANSFERIR:</div>
                        <div style="font-size: 28px; font-weight: 900; color: ${esDeudor ? '#f87171' : '#34d399'}; letter-spacing: -0.5px; margin-top: 2px;">
                            ${esDeudor ? '- Bs. ' + fmtBs(Math.abs(totalNetoBs)) : 'Bs. ' + fmtBs(totalNetoBs)}
                        </div>
                        <div style="font-size: 13px; font-weight: 800; color: #a7f3d0;">
                            ($ ${fmtUSD(totalNetoUSD)} USD)
                        </div>
                    </div>
                </div>
            </div>

            <!-- FIRMAS Y VERIFICACIÓN OFICIAL -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 20px; border-top: 1.5px dashed #cbd5e1;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Firma del Productor / Beneficiario</div>
                    <div style="font-size: 11px; color: #64748b;">${propNom}</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Transporte y Recolección de Leche</div>
                    <div style="font-size: 11px; color: #64748b;">Administración y Liquidaciones</div>
                </div>
            </div>

            <div style="margin-top: 20px; text-align: center; font-size: 10.5px; color: #94a3b8; font-weight: 600;">
                <i class="fa-solid fa-shield-halved" style="color: #10b981;"></i> COMPROBANTE UNIFICADO EMITIDO ELECTRÓNICAMENTE | TRANSPORTE V2
            </div>

        </div>
    `;

    abrirModalCustom('modalReciboPagoLiquidacion');
}
window.verReciboPagoConsolidadoModal = verReciboPagoConsolidadoModal;

async function verDetalleCompraLecheConsolidadaModal(propietarioNombre, fincaIds) {
    const listPreLiq = (typeof preLiquidacionDataCache !== 'undefined' && Array.isArray(preLiquidacionDataCache)) ? preLiquidacionDataCache : [];
    const consolidados = obtenerPreliquidacionConsolidada(listPreLiq);

    let g = null;
    if (propietarioNombre) {
        g = consolidados.find(x => (x.propietario || '').trim().toUpperCase() === propietarioNombre.trim().toUpperCase());
    }
    if (!g && Array.isArray(fincaIds) && fincaIds.length > 0) {
        g = consolidados.find(x => x.fincaIds.some(fid => fincaIds.includes(fid)));
    }

    if (!g) {
        if (typeof showToast === 'function') showToast('No se encontró información del productor consolidado', 'error');
        return;
    }

    const body = document.getElementById('bodyModalReciboPago');
    if (!body) return;

    const propNom = g.propietario || 'Productor';
    const tasaBcv = (g.fincas && g.fincas[0] && g.fincas[0].tasaBcv) ? g.fincas[0].tasaBcv : (state.tasaBcv || 798.3260);
    const fInicio = (g.fincas && g.fincas[0] && g.fincas[0].fechaInicioCiclo) ? g.fincas[0].fechaInicioCiclo.split('T')[0] : '';
    const fFin = (g.fincas && g.fincas[0] && g.fincas[0].fechaFinCiclo) ? g.fincas[0].fechaFinCiclo.split('T')[0] : '';
    const periodoStr = (fInicio && fFin) ? `${fInicio} al ${fFin}` : 'Ciclo Actual';

    const fmtBs = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUSD = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLts = (val) => Number(val || 0).toLocaleString('es-VE');

    // Show loading spinner
    body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: #059669; margin-bottom: 16px;"></i>
            <h4 style="color: #0f172a; margin: 0; font-size: 16px; font-weight: 800;">Cargando Detalle Diario Consolidado...</h4>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Consultando recolecciones de ${g.fincas.length} fincas de ${propNom}</p>
        </div>
    `;
    abrirModalCustom('modalReciboPagoLiquidacion');

    // Fetch daily report for all fincas
    let allReportRows = [];
    try {
        const fIniParam = fInicio || (state.filtrosReporte && state.filtrosReporte.fechaInicio) || new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
        const fFinParam = fFin || (state.filtrosReporte && state.filtrosReporte.fechaFin) || new Date().toISOString().split('T')[0];
        const idsStr = g.fincaIds.join(',');
        const res = await fetch(`${API_BASE}/reportes/fincas?fechaInicio=${fIniParam}&fechaFin=${fFinParam}&fincaIds=${idsStr}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                data.forEach(ent => {
                    const fNom = ent.fincaNombre || ent.FincaNombre || 'Finca';
                    const det = ent.detalle || ent.Detalle || [];
                    det.forEach(d => {
                        allReportRows.push({
                            ...d,
                            fincaNombre: fNom,
                            fincaId: ent.fincaId || ent.FincaId
                        });
                    });
                });
            }
        }
    } catch (e) {
        console.error('Error fetching consolidated finca details:', e);
    }

    let totLtsVaca = 0, totUSDVaca = 0, totBsVaca = 0;
    let totLtsBufala = 0, totUSDBufala = 0, totBsBufala = 0;
    let totLtsAcida = 0, totUSDAcida = 0, totBsAcida = 0;
    let totalLtsGral = 0, totalUSDGral = 0, totalBsGral = 0;

    const processedRows = allReportRows.map(d => {
        const fecha = d.fecha || d.Fecha || '';
        const fincaNom = d.fincaNombre || '';
        const litros = Number(d.litros || d.Litros || 0);
        const esAcida = !!(d.esAcida || d.EsAcida);
        const tipoLeche = String(d.tipoLeche || d.TipoLeche || 'VACA').toUpperCase();
        
        const fItem = g.fincas.find(f => Number(f.fincaId || f.FincaId) === Number(d.fincaId)) || g.fincas[0] || {};
        const pNorm = Number(fItem.precioLitroUSD || fItem.PrecioLitroUSD || 0.84);
        const pAcid = Number(fItem.precioLitroAcidaUSD || fItem.PrecioLitroAcidaUSD || (pNorm / 2));
        const pBuf = Number(fItem.precioLitroBufalaUSD || fItem.PrecioLitroBufalaUSD || (pNorm * 1.25));

        let precioUSD = pNorm;
        if (esAcida) precioUSD = pAcid;
        else if (tipoLeche === 'BUFALA') precioUSD = pBuf;

        const subUSD = litros * precioUSD;
        const subBs = subUSD * tasaBcv;

        if (esAcida) {
            totLtsAcida += litros;
            totUSDAcida += subUSD;
            totBsAcida += subBs;
        } else if (tipoLeche === 'BUFALA') {
            totLtsBufala += litros;
            totUSDBufala += subUSD;
            totBsBufala += subBs;
        } else {
            totLtsVaca += litros;
            totUSDVaca += subUSD;
            totBsVaca += subBs;
        }

        totalLtsGral += litros;
        totalUSDGral += subUSD;
        totalBsGral += subBs;

        return {
            fecha,
            fincaNombre: fincaNom,
            litros,
            tipoLeche,
            esAcida,
            precioUSD,
            subUSD,
            subBs
        };
    });

    // Fallback if no report rows found
    if (processedRows.length === 0 && g.totalLitros > 0) {
        g.fincas.forEach(f => {
            const lB = f.totalLitrosBuenos || f.totalLitros || 0;
            const lA = f.totalLitrosAcidos || 0;
            const pNorm = Number(f.precioLitroUSD || f.PrecioLitroUSD || 0.84);
            const pAcid = Number(f.precioLitroAcidaUSD || f.PrecioLitroAcidaUSD || (pNorm / 2));

            if (lB > 0) {
                const subUSD = lB * pNorm;
                const subBs = subUSD * tasaBcv;
                totLtsVaca += lB;
                totUSDVaca += subUSD;
                totBsVaca += subBs;
                processedRows.push({
                    fecha: fInicio || 'Ciclo Completo',
                    fincaNombre: f.fincaNombre || f.FincaNombre,
                    litros: lB,
                    tipoLeche: 'VACA',
                    esAcida: false,
                    precioUSD: pNorm,
                    subUSD,
                    subBs
                });
            }
            if (lA > 0) {
                const subUSD = lA * pAcid;
                const subBs = subUSD * tasaBcv;
                totLtsAcida += lA;
                totUSDAcida += subUSD;
                totBsAcida += subBs;
                processedRows.push({
                    fecha: fInicio || 'Ciclo Completo',
                    fincaNombre: f.fincaNombre || f.FincaNombre,
                    litros: lA,
                    tipoLeche: 'ACIDA',
                    esAcida: true,
                    precioUSD: pAcid,
                    subUSD,
                    subBs
                });
            }
        });
        totalLtsGral = g.totalLitros;
        totalUSDGral = g.totalUSD;
        totalBsGral = g.totalBrutoBs;
    }

    processedRows.sort((a, b) => (a.fecha > b.fecha ? 1 : (a.fecha < b.fecha ? -1 : a.fincaNombre.localeCompare(b.fincaNombre))));

    const totalAdelantosBs = Number(g.totalAdelantosBs || 0);
    const totalDeduccionesBs = Number(g.otrasDeduccionesBs || 0);
    const netoPagarBs = totalBsGral - totalAdelantosBs - totalDeduccionesBs;
    const netoPagarUSD = totalUSDGral - (tasaBcv > 0 ? (totalAdelantosBs + totalDeduccionesBs) / tasaBcv : 0);

    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const formatFechaDia = (fStr) => {
        if (!fStr) return '-';
        const parts = fStr.split('-');
        if (parts.length < 3) return fStr;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return `${nombresDias[d.getDay()]} ${parts[2]}/${parts[1]}`;
    };

    const filasHtml = processedRows.length > 0 ? processedRows.map((r, i) => {
        let badgeTipo = `<span style="background: #ecfdf5; color: #047857; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #a7f3d0;"><i class="fa-solid fa-cow"></i> VACA</span>`;
        if (r.esAcida) {
            badgeTipo = `<span style="background: #fffbeb; color: #b45309; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #fde68a;"><i class="fa-solid fa-flask"></i> ÁCIDA</span>`;
        } else if (r.tipoLeche === 'BUFALA') {
            badgeTipo = `<span style="background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #bfdbfe;"><i class="fa-solid fa-shield-cat"></i> BÚFALA</span>`;
        }

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; white-space: nowrap;">
                    ${formatFechaDia(r.fecha)}
                </td>
                <td style="padding: 10px 14px; font-weight: 700; color: #0369a1;">
                    <i class="fa-solid fa-location-dot" style="font-size: 11px; margin-right: 3px;"></i> ${r.fincaNombre}
                </td>
                <td style="padding: 10px 14px; text-align: center;">
                    ${badgeTipo}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 13.5px; color: #0f172a;">
                    ${fmtLts(r.litros)} <small style="font-weight: 600; color: #64748b;">L</small>
                </td>
                <td style="padding: 10px 14px; text-align: right; color: #2563eb; font-weight: 700; font-size: 12.5px;">
                    $${r.precioUSD.toFixed(4)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #2563eb; font-size: 13px;">
                    $${fmtUSD(r.subUSD)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">
                    Bs. ${fmtBs(r.subBs)}
                </td>
            </tr>
        `;
    }).join('') : `
        <tr>
            <td colspan="7" style="padding: 24px; text-align: center; color: #64748b; font-weight: 600;">
                No se registraron recolecciones diarias en el periodo seleccionado.
            </td>
        </tr>
    `;

    // WhatsApp Formatted Text
    let waTxt = `🥛 *DETALLE DE COMPRA DE LECHE CONSOLIDADO* 🥛\n`;
    waTxt += `🏢 *TRANSPORTE Y RECOLECCIÓN DE LECHE*\n`;
    waTxt += `👤 *Productor:* ${propNom}\n`;
    waTxt += `📍 *Fincas (${g.fincas.length}):* ${g.fincasNombresStr}\n`;
    waTxt += `📅 *Ciclo:* ${periodoStr}\n`;
    waTxt += `💵 *Tasa BCV:* Bs. ${fmtBs(tasaBcv)} / $\n\n`;
    waTxt += `📋 *RECOLECCIÓN DIARIA POR FINCA:*\n`;

    processedRows.forEach(r => {
        const tStr = r.esAcida ? 'Ácida' : (r.tipoLeche === 'BUFALA' ? 'Búfala' : 'Vaca');
        waTxt += `• ${formatFechaDia(r.fecha)} [${r.fincaNombre}]: ${fmtLts(r.litros)} L (${tStr}) @ $${r.precioUSD.toFixed(4)} = $${fmtUSD(r.subUSD)} (Bs. ${fmtBs(r.subBs)})\n`;
    });

    waTxt += `\n📊 *RESUMEN TOTAL:*`;
    if (totLtsVaca > 0) waTxt += `\n• 🥛 Leche Vaca: ${fmtLts(totLtsVaca)} L | $${fmtUSD(totUSDVaca)} | Bs. ${fmtBs(totBsVaca)}`;
    if (totLtsBufala > 0) waTxt += `\n• 🦬 Leche Búfala: ${fmtLts(totLtsBufala)} L | $${fmtUSD(totUSDBufala)} | Bs. ${fmtBs(totBsBufala)}`;
    if (totLtsAcida > 0) waTxt += `\n• ⚠️ Leche Ácida: ${fmtLts(totLtsAcida)} L | $${fmtUSD(totUSDAcida)} | Bs. ${fmtBs(totBsAcida)}`;
    waTxt += `\n• *Total Litros:* ${fmtLts(totalLtsGral)} L`;
    waTxt += `\n• *Total Bruto:* $${fmtUSD(totalUSDGral)} (Bs. ${fmtBs(totalBsGral)})\n`;

    if (totalAdelantosBs > 0 || totalDeduccionesBs > 0) {
        waTxt += `\n💳 *DEDUCCIONES / ADELANTOS:*`;
        if (totalAdelantosBs > 0) waTxt += `\n• (-) Adelantos / Préstamos: - Bs. ${fmtBs(totalAdelantosBs)}`;
        if (totalDeduccionesBs > 0) waTxt += `\n• (-) Otras Deducciones: - Bs. ${fmtBs(totalDeduccionesBs)}`;
    }

    waTxt += `\n-----------------------------------`;
    waTxt += `\n💰 *TOTAL NETO CONSOLIDADO: Bs. ${fmtBs(netoPagarBs)} ($${fmtUSD(netoPagarUSD)})*\n`;
    waTxt += `🏦 *Cuenta:* ${g.propietarioBancoNombre || g.bancoNombre || 'Banco'} (${g.propietarioNumeroCuenta || g.numeroCuenta || 'N/A'})\n`;
    waTxt += `✅ *Estado:* LIQUIDACIÓN CONFORME`;

    const waTxtEscaped = encodeURIComponent(waTxt);
    const idsJson = JSON.stringify(g.fincaIds);
    const propEscaped = propNom.replace(/'/g, "\\'");

    body.innerHTML = `
        <!-- NAVEGACIÓN ENTRE COMPROBANTE Y DETALLE DE COMPRA -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
            <button type="button" class="btn" onclick="verReciboPagoConsolidadoModal('${propEscaped}', ${idsJson})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #475569;">
                <i class="fa-solid fa-file-invoice-dollar"></i> 1. Comprobante Oficial Consolidado
            </button>
            <button type="button" class="btn" onclick="verDetalleCompraLecheConsolidadaModal('${propEscaped}', ${idsJson})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: none; background: linear-gradient(135deg, #065f46, #059669); color: #ffffff; box-shadow: 0 4px 10px rgba(5,150,105,0.25);">
                <i class="fa-solid fa-list-check"></i> 2. Detalle Diario Consolidado (Relación para Fincas)
            </button>
        </div>

        <div id="areaImpresionReciboPago" style="background: #ffffff; padding: 26px; border-radius: 14px; border: 1.5px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            
            <!-- CABECERA DE RELACIÓN PARA FINCAS -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #065f46 0%, #059669 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 8px 16px -4px rgba(5,150,105,0.4);">
                        <i class="fa-solid fa-clipboard-list"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; letter-spacing: -0.4px;">RELACIÓN DE COMPRA CONSOLIDADA</h2>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="background: #ecfdf5; color: #047857; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">
                                <i class="fa-solid fa-calendar-week"></i> Periodo: ${periodoStr}
                            </span>
                            <span style="background: #eff6ff; color: #2563eb; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
                                <i class="fa-solid fa-dollar-sign"></i> Tasa BCV: Bs. ${fmtBs(tasaBcv)}
                            </span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <button type="button" class="btn" onclick="copiarDetalleLiquidacionWhatsApp(decodeURIComponent('${waTxtEscaped}'))" style="background: #10b981; color: #ffffff; font-weight: 800; font-size: 12.5px; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                        <i class="fa-brands fa-whatsapp" style="font-size: 16px;"></i> Copiar para WhatsApp
                    </button>
                </div>
            </div>

            <!-- CARD PRODUCTOR Y BANCO -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">DATOS DEL PRODUCTOR</div>
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${propNom}</div>
                    <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                        <strong>C.I. / RIF:</strong> <span style="font-family: monospace;">${g.cedulaRIF || 'N/A'}</span>
                    </div>
                    <div style="font-size: 12px; color: #0369a1; font-weight: 700; margin-top: 2px;">
                        <strong>Fincas (${g.fincas.length}):</strong> ${g.fincasNombresStr}
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">PAGO Y TRANSFERENCIA</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${g.propietarioBancoNombre || g.bancoNombre || 'Sin Banco'}</div>
                    <div style="font-size: 12.5px; font-family: monospace; color: #2563eb; margin-top: 2px;">
                        ${g.propietarioNumeroCuenta || g.numeroCuenta || 'N/A'}
                    </div>
                    <div style="font-size: 11.5px; color: #059669; font-weight: 800; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-circle-check"></i> Liquidación Conforme
                    </div>
                </div>
            </div>

            <!-- TABLA DE RECOLECCIÓN DIARIA CONSOLIDADA -->
            <div style="margin-bottom: 10px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-calendar-day" style="color: #059669;"></i> Registro Diario de Recolección por Finca
                </span>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    ${processedRows.length} Días / Registros
                </span>
            </div>

            <div style="border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                            <th style="padding: 10px 14px; font-weight: 800; font-size: 11px; text-transform: uppercase;">Día / Fecha</th>
                            <th style="padding: 10px 14px; font-weight: 800; font-size: 11px; text-transform: uppercase;">Finca</th>
                            <th style="padding: 10px 14px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase;">Tipo Leche</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Litros</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Precio $/L</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Subtotal ($)</th>
                            <th style="padding: 10px 14px; text-align: right; font-weight: 800; font-size: 11px; text-transform: uppercase;">Subtotal (Bs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml}
                    </tbody>
                </table>
            </div>

            <!-- RESUMEN POR TIPO DE LECHE -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
                ${totLtsVaca > 0 ? `
                    <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase;"><i class="fa-solid fa-cow"></i> Leche de Vaca</div>
                        <div style="font-size: 18px; font-weight: 900; color: #065f46; margin-top: 2px;">${fmtLts(totLtsVaca)} L</div>
                        <div style="font-size: 12px; color: #047857; font-weight: 700;">$${fmtUSD(totUSDVaca)} | Bs. ${fmtBs(totBsVaca)}</div>
                    </div>
                ` : ''}
                ${totLtsBufala > 0 ? `
                    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase;"><i class="fa-solid fa-shield-cat"></i> Leche de Búfala</div>
                        <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; margin-top: 2px;">${fmtLts(totLtsBufala)} L</div>
                        <div style="font-size: 12px; color: #1e40af; font-weight: 700;">$${fmtUSD(totUSDBufala)} | Bs. ${fmtBs(totBsBufala)}</div>
                    </div>
                ` : ''}
                ${totLtsAcida > 0 ? `
                    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase;"><i class="fa-solid fa-flask"></i> Leche Ácida</div>
                        <div style="font-size: 18px; font-weight: 900; color: #92400e; margin-top: 2px;">${fmtLts(totLtsAcida)} L</div>
                        <div style="font-size: 12px; color: #b45309; font-weight: 700;">$${fmtUSD(totUSDAcida)} | Bs. ${fmtBs(totBsAcida)}</div>
                    </div>
                ` : ''}
            </div>

            <!-- CUADRO DE LIQUIDACIÓN Y MONTO FINAL -->
            <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #ffffff; padding: 22px 26px; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(6,78,59,0.3); border: 1.5px solid #047857; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 14px; margin-bottom: 14px;">
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.8px;">TOTAL RECOLECTADO EN CICLO</div>
                        <div style="font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 2px;">${fmtLts(totalLtsGral)} Litros Totales (${g.fincas.length} Fincas)</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.8px;">VALOR BRUTO LECHE</div>
                        <div style="font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 2px;">$${fmtUSD(totalUSDGral)} <span style="font-size: 14px; color: #cbd5e1;">(Bs. ${fmtBs(totalBsGral)})</span></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12.5px; color: #d1fae5;">
                        ${totalAdelantosBs > 0 ? `<div>(-) Adelantos / Préstamos: <strong style="color: #fca5a5;">- Bs. ${fmtBs(totalAdelantosBs)}</strong></div>` : ''}
                        ${totalDeduccionesBs > 0 ? `<div>(-) Otras Deducciones: <strong style="color: #fde68a;">- Bs. ${fmtBs(totalDeduccionesBs)}</strong></div>` : ''}
                        ${(totalAdelantosBs === 0 && totalDeduccionesBs === 0) ? `<div>Sin deducciones aplicadas en este ciclo</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 11px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.8px;">MONTO NETO CONSOLIDADO:</div>
                        <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; margin-top: 2px;">
                            Bs. ${fmtBs(netoPagarBs)}
                        </div>
                        <div style="font-size: 13px; font-weight: 800; color: #a7f3d0;">
                            ($ ${fmtUSD(netoPagarUSD)} USD)
                        </div>
                    </div>
                </div>
            </div>

            <!-- FIRMAS Y VERIFICACIÓN -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 20px; border-top: 1.5px dashed #cbd5e1;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Recibido Conforme Productor</div>
                    <div style="font-size: 11px; color: #64748b;">${propNom}</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Transporte y Recolección de Leche</div>
                    <div style="font-size: 11px; color: #64748b;">Administración y Liquidaciones</div>
                </div>
            </div>

        </div>
    `;
}
window.verDetalleCompraLecheConsolidadaModal = verDetalleCompraLecheConsolidadaModal;

async function copiarDetalleLiquidacionWhatsApp(texto) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = texto;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: '¡Copiado para WhatsApp!',
                text: 'El detalle de compra se ha copiado al portapapeles. Pégalo directamente en el chat de WhatsApp con el productor o finca.',
                timer: 3500,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#fff'
            });
        } else if (typeof showToast === 'function') {
            showToast('¡Detalle de compra copiado al portapapeles para WhatsApp!');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Texto para WhatsApp',
                html: `<textarea readonly style="width: 100%; height: 220px; background: #0f172a; color: #38bdf8; font-family: monospace; font-size: 12px; padding: 10px; border-radius: 8px; border: 1px solid #334155;">${texto}</textarea>`,
                confirmButtonText: 'Listo',
                background: '#1e293b',
                color: '#fff'
            });
        }
    }
}
window.copiarDetalleLiquidacionWhatsApp = copiarDetalleLiquidacionWhatsApp;

function imprimirReciboPagoPDF() {
    const area = document.getElementById('areaImpresionReciboPago');
    if (!area) return;

    const ventana = window.open('', '_blank', 'width=900,height=800');
    ventana.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Comprobante_Pago_Liquidacion</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #ffffff; color: #0f172a; }
                    @page { size: letter portrait; margin: 15mm; }
                    @media print {
                        body { margin: 0; padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${area.outerHTML}
                <script>
                    window.onload = function() { window.print(); setTimeout(() => { window.close(); }, 600); }
                </script>
            </body>
        </html>
    `);
    ventana.document.close();
}
window.imprimirReciboPagoPDF = imprimirReciboPagoPDF;

async function abrirModalAjustarLiquidacion(fincaId) {
    const item = (preLiquidacionDataCache || []).find(x => Number(x.fincaId || x.FincaId) === Number(fincaId));
    if (!item) {
        Swal.fire({ icon: 'warning', title: 'Finca no encontrada', text: 'No se encontraron los datos de la finca seleccionada.', background: '#1e293b', color: '#fff' });
        return;
    }

    document.getElementById('modalAjustarLiqFincaId').value = item.fincaId || item.FincaId;
    document.getElementById('modalAjustarLiqTitle').innerText = `Editar Liquidación`;
    document.getElementById('modalAjustarLiqSubtitle').innerText = `${item.fincaNombre} (${item.propietario || 'S/P'})`;
    
    // 1. Litros Recolectados (SOLO LECTURA / NO MODIFICABLE)
    const totLitros = item.totalLitros || 0;
    const acidosLitros = item.totalLitrosAcidos || 0;
    const bufalaLitros = item.totalLitrosBufala || 0;
    const vacaLitros = item.totalLitrosVaca ?? (bufalaLitros > 0 ? (totLitros - bufalaLitros - acidosLitros) : (item.totalLitrosBuenos || (totLitros - acidosLitros)));

    const elTot = document.getElementById('modalAjustarLitrosTotales');
    const elVac = document.getElementById('modalAjustarLitrosVaca');
    const elBuf = document.getElementById('modalAjustarLitrosBufala');
    const elAci = document.getElementById('modalAjustarLitrosAcidos');
    const rawVac = document.getElementById('modalAjustarRawLitrosVaca');
    const rawBuf = document.getElementById('modalAjustarRawLitrosBufala');
    const rawAci = document.getElementById('modalAjustarRawLitrosAcidos');

    if (elTot) elTot.value = `${totLitros.toLocaleString()} Lts`;
    if (elVac) elVac.value = `${vacaLitros.toLocaleString()} Lts`;
    if (elBuf) elBuf.value = `${bufalaLitros.toLocaleString()} Lts`;
    if (elAci) elAci.value = `${acidosLitros.toLocaleString()} Lts`;
    if (rawVac) rawVac.value = vacaLitros;
    if (rawBuf) rawBuf.value = bufalaLitros;
    if (rawAci) rawAci.value = acidosLitros;

    // 2. Valores Modificables: Valor Dólar Bs, Valor Leche Vaca, Valor Leche Búfala, Valor Leche Ácida
    const tasaVal = Number(item.tasaBcv || item.paidTasaBcv || state.tasaBcv || 0);
    const inputTasa = document.getElementById('modalAjustarTasaDolarBs');
    if (inputTasa) inputTasa.value = tasaVal > 0 ? tasaVal.toFixed(4) : (state.tasaBcv ? state.tasaBcv.toFixed(4) : '');

    const inputNormal = document.getElementById('modalAjustarPrecioNormalUsd');
    if (inputNormal) inputNormal.value = item.precioLitroUSD ?? 0.82;

    const inputBufala = document.getElementById('modalAjustarPrecioBufalaUsd');
    if (inputBufala) inputBufala.value = item.precioLitroBufalaUSD ?? 1.02;

    const inputAcida = document.getElementById('modalAjustarPrecioAcidaUsd');
    if (inputAcida) inputAcida.value = item.precioLitroAcidaUSD ?? 0.60;

    // 3. Cuota de Adelanto
    const lblBadge = document.getElementById('lblAjustarCuotaBadge');
    if (lblBadge) {
        if (item.cuotasDetalle && item.cuotasDetalle.trim() !== '') {
            lblBadge.innerText = item.cuotasDetalle;
            lblBadge.style.background = '#ffe4e6';
            lblBadge.style.color = '#be123c';
        } else if ((item.totalAdelantosBs || 0) > 0) {
            lblBadge.innerText = 'Adelanto Activo';
            lblBadge.style.background = '#ffe4e6';
            lblBadge.style.color = '#be123c';
        } else {
            lblBadge.innerText = 'Sin Adelantos Activos';
            lblBadge.style.background = '#f1f5f9';
            lblBadge.style.color = '#64748b';
        }
    }
    document.getElementById('modalAjustarAdelantoCuotaUsd').value = item.totalAdelantosUSD ? item.totalAdelantosUSD.toFixed(2) : '0.00';
    document.getElementById('modalAjustarAdelantoCuotaBs').value = item.totalAdelantosBs ? item.totalAdelantosBs.toFixed(2) : '0.00';

    // 4. Otras Deducciones
    document.getElementById('modalAjustarOtrasDeduccionesBs').value = item.otrasDeduccionesBs ? item.otrasDeduccionesBs.toFixed(2) : '0.00';
    document.getElementById('modalAjustarConceptoDeducciones').value = item.conceptoDeducciones || '';

    // Ejecutar recálculo para previsualización inmediata
    recalcularModalEditarLiquidacion();

    abrirModalCustom('modalAjustarLiquidacionFincaCustom');
}
window.abrirModalAjustarLiquidacion = abrirModalAjustarLiquidacion;
window.abrirModalEditarLiquidacion = abrirModalAjustarLiquidacion;

function recalcularModalEditarLiquidacion() {
    const rawVac = parseFloat((document.getElementById('modalAjustarRawLitrosVaca')?.value || '0').toString().replace(',', '.')) || 0;
    const rawBuf = parseFloat((document.getElementById('modalAjustarRawLitrosBufala')?.value || '0').toString().replace(',', '.')) || 0;
    const rawAci = parseFloat((document.getElementById('modalAjustarRawLitrosAcidos')?.value || '0').toString().replace(',', '.')) || 0;

    const tasa = parseFloat((document.getElementById('modalAjustarTasaDolarBs')?.value || '0').toString().replace(',', '.')) || 0;
    const precioVaca = parseFloat((document.getElementById('modalAjustarPrecioNormalUsd')?.value || '0').toString().replace(',', '.')) || 0;
    const precioBufala = parseFloat((document.getElementById('modalAjustarPrecioBufalaUsd')?.value || '0').toString().replace(',', '.')) || 0;
    const precioAcida = parseFloat((document.getElementById('modalAjustarPrecioAcidaUsd')?.value || '0').toString().replace(',', '.')) || 0;

    const subVaca = rawVac * precioVaca;
    const subBufala = rawBuf * precioBufala;
    const subAcida = rawAci * precioAcida;
    const totalUSD = subVaca + subBufala + subAcida;
    const totalBrutoBs = totalUSD * tasa;

    // Si modifica adelanto en USD y adelanto en Bs está en 0 o se recalcula con la tasa
    const adelantoBsInput = parseFloat((document.getElementById('modalAjustarAdelantoCuotaBs')?.value || '0').toString().replace(',', '.')) || 0;
    const adelantoUsdInput = parseFloat((document.getElementById('modalAjustarAdelantoCuotaUsd')?.value || '0').toString().replace(',', '.')) || 0;
    const adelantoFinalBs = adelantoBsInput > 0 ? adelantoBsInput : (adelantoUsdInput > 0 ? (adelantoUsdInput * tasa) : 0);

    const otrasDeducBs = parseFloat((document.getElementById('modalAjustarOtrasDeduccionesBs')?.value || '0').toString().replace(',', '.')) || 0;
    const totalNetoBs = totalBrutoBs - adelantoFinalBs - otrasDeducBs;

    const totalBrutoBsRounded = Math.round(totalBrutoBs * 100) / 100;
    const totalNetoBsRounded = Math.round(totalNetoBs * 100) / 100;

    const elBadgeTasa = document.getElementById('badgeTasaPreview');
    const elSubVac = document.getElementById('previewSubtotalVaca');
    const elSubBuf = document.getElementById('previewSubtotalBufala');
    const elSubAci = document.getElementById('previewSubtotalAcida');
    const elTotUSD = document.getElementById('previewTotalUSD');
    const elTotBruto = document.getElementById('previewTotalBrutoBs');
    const elTotNeto = document.getElementById('previewTotalNetoBs');
    if (elSubVac) elSubVac.innerText = `$${subVaca.toFixed(2)}`;
    if (elSubBuf) elSubBuf.innerText = `$${subBufala.toFixed(2)}`;
    if (elSubAci) elSubAci.innerText = `$${subAcida.toFixed(2)}`;
    if (elTotUSD) elTotUSD.innerText = `$${totalUSD.toFixed(2)}`;
    if (elTotBruto) elTotBruto.innerText = `Bs. ${totalBrutoBsRounded.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elTotNeto) {
        if (totalNetoBsRounded < 0) {
            elTotNeto.innerHTML = `<span style="color: #f87171;">- Bs. ${Math.abs(totalNetoBsRounded).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (SALDO DEUDOR)</span>`;
        } else {
            elTotNeto.innerText = `Bs. ${totalNetoBsRounded.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            elTotNeto.style.color = '#34d399';
        }
    }
}
window.recalcularModalEditarLiquidacion = recalcularModalEditarLiquidacion;

async function guardarAjustarLiquidacionSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const fincaId = parseInt(document.getElementById('modalAjustarLiqFincaId').value, 10);
    const tasaDolarBs = parseFloat((document.getElementById('modalAjustarTasaDolarBs')?.value || '0').trim().replace(',', '.')) || 0;
    const precioNormalUsd = parseFloat((document.getElementById('modalAjustarPrecioNormalUsd')?.value || '0').trim().replace(',', '.')) || 0;
    const precioBufalaUsd = parseFloat((document.getElementById('modalAjustarPrecioBufalaUsd')?.value || '0').trim().replace(',', '.')) || null;
    const precioAcidaUsd = parseFloat((document.getElementById('modalAjustarPrecioAcidaUsd')?.value || '0').trim().replace(',', '.')) || 0;
    
    const adelantoCuotaUsdRaw = (document.getElementById('modalAjustarAdelantoCuotaUsd')?.value || '').trim().replace(',', '.');
    const adelantoCuotaUsd = adelantoCuotaUsdRaw !== '' ? parseFloat(adelantoCuotaUsdRaw) : null;

    const adelantoCuotaBsRaw = (document.getElementById('modalAjustarAdelantoCuotaBs')?.value || '').trim().replace(',', '.');
    const adelantoCuotaBs = adelantoCuotaBsRaw !== '' ? parseFloat(adelantoCuotaBsRaw) : null;

    const otrasDeduccionesBs = parseFloat((document.getElementById('modalAjustarOtrasDeduccionesBs')?.value || '0').trim().replace(',', '.')) || 0;
    const conceptoDeducciones = (document.getElementById('modalAjustarConceptoDeducciones')?.value || '').trim();

    if (!fincaId || isNaN(precioNormalUsd) || precioNormalUsd <= 0) {
        Swal.fire({ icon: 'warning', title: 'Datos Incompletos', text: 'Por favor especifica un valor de leche válido.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (isNaN(tasaDolarBs) || tasaDolarBs <= 0) {
        Swal.fire({ icon: 'warning', title: 'Tasa Inválida', text: 'Por favor especifica un valor dólar (tasa Bs/$) mayor a cero.', background: '#1e293b', color: '#fff' });
        return;
    }

    const btn = document.getElementById('btnGuardarAjustarLiqSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Guardar';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; btn.disabled = true; }

    try {
        let cicloId = null;
        if (state.cicloSeleccionadoLiquidacion && state.cicloSeleccionadoLiquidacion !== 'ACTIVO' && state.cicloSeleccionadoLiquidacion !== 'MULTI') {
            cicloId = Number(state.cicloSeleccionadoLiquidacion);
        } else {
            cicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;
        }

        const payload = {
            fincaId,
            precioLitroUSD: precioNormalUsd,
            precioLitroBufalaUSD: precioBufalaUsd,
            precioLitroAcidaUSD: precioAcidaUsd,
            tasaDolarBs,
            adelantoCuotaUSD: adelantoCuotaUsd,
            adelantoCuotaBs: adelantoCuotaBs,
            otrasDeduccionesBs,
            conceptoDeducciones: conceptoDeducciones !== '' ? conceptoDeducciones : null,
            cicloId
        };

        const res = await fetch(`${API_BASE}/catalogos/pre-liquidacion/ajustar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }

        if (res.ok) {
            cerrarModalCustom('modalAjustarLiquidacionFincaCustom');
            showToast('¡Liquidación actualizada exitosamente!');
            await cargarPreLiquidacion(true);
        } else {
            const err = await res.json();
            Swal.fire({ icon: 'error', title: 'Error', text: err.mensaje || 'No se pudo guardar la edición.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
        console.error('Error al guardar edición de liquidación:', err);
        Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'No se pudo guardar la edición.', background: '#1e293b', color: '#fff' });
    }
}
window.guardarAjustarLiquidacionSubmit = guardarAjustarLiquidacionSubmit;

// --- ACTUALIZAR TASA BCV A FINCAS PENDIENTES ---
function abrirModalActualizarTasaPendientes() {
    const pendientes = (preLiquidacionDataCache || []).filter(x => !x.esPagado && !x.EsPagado);
    const totalUsd = pendientes.reduce((acc, curr) => acc + (curr.totalUSD || curr.TotalUSD || 0), 0);
    const totalBsAnt = pendientes.reduce((acc, curr) => acc + (curr.totalBrutoBs || curr.TotalBrutoBs || 0), 0);

    const elCant = document.getElementById('lblCantFincasPendientesActualizar');
    if (elCant) elCant.innerText = `${pendientes.length} fincas pendientes`;

    const elUsd = document.getElementById('lblPreviewUsdPendiente');
    if (elUsd) elUsd.innerText = `$ ${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const elBsAnt = document.getElementById('lblPreviewBsAnterior');
    if (elBsAnt) elBsAnt.innerText = `Bs. ${totalBsAnt.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const tasaHoy = Number(state.tasaBcv || 0);
    const elTasaHoy = document.getElementById('lblTasaHoySugerida');
    if (elTasaHoy) elTasaHoy.innerText = `Bs. ${tasaHoy > 0 ? tasaHoy.toFixed(4) : '0.0000'}`;

    const inputTasa = document.getElementById('inputNuevaTasaPendientes');
    if (inputTasa) inputTasa.value = tasaHoy > 0 ? tasaHoy.toFixed(4) : '';

    recalcularPreviewTasaPendientes();
    abrirModalCustom('modalActualizarTasaPendientesCustom');
}
window.abrirModalActualizarTasaPendientes = abrirModalActualizarTasaPendientes;

function usarTasaBcvHoyPendientes() {
    const tasaHoy = Number(state.tasaBcv || 0);
    if (tasaHoy > 0) {
        const inputTasa = document.getElementById('inputNuevaTasaPendientes');
        if (inputTasa) inputTasa.value = tasaHoy.toFixed(4);
        recalcularPreviewTasaPendientes();
    }
}
window.usarTasaBcvHoyPendientes = usarTasaBcvHoyPendientes;

function recalcularPreviewTasaPendientes() {
    const inputTasa = document.getElementById('inputNuevaTasaPendientes');
    const nuevaTasa = parseFloat(inputTasa?.value || '0');
    const pendientes = (preLiquidacionDataCache || []).filter(x => !x.esPagado && !x.EsPagado);
    const totalUsd = pendientes.reduce((acc, curr) => acc + (curr.totalUSD || curr.TotalUSD || 0), 0);
    const totalBsAnt = pendientes.reduce((acc, curr) => acc + (curr.totalBrutoBs || curr.TotalBrutoBs || 0), 0);
    const nuevoBrutoBs = totalUsd * (isNaN(nuevaTasa) ? 0 : nuevaTasa);
    const dif = nuevoBrutoBs - totalBsAnt;

    const elNuevo = document.getElementById('lblPreviewBsNuevo');
    const elDif = document.getElementById('lblPreviewDiferenciaBs');
    if (elNuevo) elNuevo.innerText = `Bs. ${nuevoBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elDif) {
        const sign = dif >= 0 ? '+' : '-';
        elDif.innerText = `${sign} Bs. ${Math.abs(dif).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        elDif.style.color = dif >= 0 ? '#fde047' : '#f87171';
    }
}
window.recalcularPreviewTasaPendientes = recalcularPreviewTasaPendientes;

async function aplicarTasaPendientesSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const inputTasa = document.getElementById('inputNuevaTasaPendientes');
    const tasaVal = parseFloat(inputTasa?.value || '0');

    if (isNaN(tasaVal) || tasaVal <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Tasa Inválida',
            text: 'Por favor ingresa un valor de tasa mayor a cero.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    let cicloId = null;
    let cicloIds = null;

    if (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
        cicloIds = state.ciclosMultiLiquidacion.join(',');
    } else if (state.cicloSeleccionadoLiquidacion && state.cicloSeleccionadoLiquidacion !== 'ACTIVO') {
        cicloId = Number(state.cicloSeleccionadoLiquidacion);
    } else {
        cicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;
    }

    const btn = document.getElementById('btnConfirmarActualizarTasaPendientes');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...';
    }

    try {
        const res = await fetch(`${API_BASE}/catalogos/pre-liquidacion/actualizar-tasa-pendientes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cicloId: cicloId,
                cicloIds: cicloIds,
                tasaBcv: tasaVal
            })
        });

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Aplicar a Fincas Pendientes';
        }

        if (res.ok) {
            const data = await res.json();
            cerrarModalCustom('modalActualizarTasaPendientesCustom');
            state.tasaBcv = tasaVal;
            const inputTasa = document.getElementById('txtTasaBcv');
            if (inputTasa) inputTasa.value = tasaVal;
            Swal.fire({
                icon: 'success',
                title: '¡Tasa Actualizada!',
                text: data.mensaje || 'Se actualizó la tasa BCV a las fincas pendientes y sus adelantos.',
                background: '#1e293b',
                color: '#fff'
            });
            await cargarPreLiquidacion(true);
            if (typeof cargarAdelantosFincas === 'function') {
                cargarAdelantosFincas();
            }
            actualizarBarraUnificarPagos();
        } else {
            const err = await res.json();
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.mensaje || 'No se pudo actualizar la tasa.',
                background: '#1e293b',
                color: '#fff'
            });
        }
    } catch (err) {
        console.error('Error al actualizar tasa pendientes:', err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Aplicar a Fincas Pendientes';
        }
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: 'No se pudo conectar con el servidor.',
            background: '#1e293b',
            color: '#fff'
        });
    }
}
window.aplicarTasaPendientesSubmit = aplicarTasaPendientesSubmit;
