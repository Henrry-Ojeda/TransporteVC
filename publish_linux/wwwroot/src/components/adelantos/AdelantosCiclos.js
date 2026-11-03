// =========================================================================
// MÓDULO DE ADELANTOS Y ABONOS POR CICLOS OPERATIVOS (FINCAS Y RECEPTORÍA)
// =========================================================================

let adelantosFincasData = [];
let adelantosCompaniasData = [];
let adelantosReceptoriaData = [];
let adelantosFincasFiltro = '';
let adelantosCompaniasFiltro = '';
let adelantosReceptoriaFiltro = '';

async function asegurarSemanasCargadas() {
    if (!state.semanas || state.semanas.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/ciclos/semanas`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.semanas = await res.json();
        } catch (e) {
            console.warn('Error cargando semanas:', e);
        }
    }
}

function poblarSelectoresSemanasAdelantos() {
    const selects = [
        document.getElementById('filtroSemanaAdelantoFinca'),
        document.getElementById('filtroSemanaAdelantoCompania'),
        document.getElementById('filtroSemanaAdelantoReceptoria')
    ];

    const opcionesHtml = '<option value="">TODOS LOS CICLOS / SEMANAS</option>' + (state.semanas || []).map(s => {
        const id = s.id || s.Id;
        return `<option value="${id}">${formatearTextoSemana(s)}</option>`;
    }).join('');

    selects.forEach(sel => {
        if (sel) {
            const currentVal = sel.value;
            sel.innerHTML = opcionesHtml;
            if (currentVal) sel.value = currentVal;
        }
    });
}

function onFiltroAdelantosChange(tipoEntidad) {
    if (tipoEntidad === 'FINCA') {
        actualizarKpisAdelantosFincas();
        renderTablaAdelantos('FINCA');
    } else if (tipoEntidad === 'COMPANIA') {
        actualizarKpisAdelantosCompanias();
        renderTablaAdelantos('COMPANIA');
    } else {
        actualizarKpisAdelantosReceptoria();
        renderTablaAdelantos('RECEPTORIA');
    }
}
window.onFiltroAdelantosChange = onFiltroAdelantosChange;

async function cargarAdelantosFincas() {
    if (!state.token) return;
    const tbody = document.getElementById('tbodyAdelantosFincas');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando adelantos de fincas...</td></tr>`;
    }

    try {
        await asegurarSemanasCargadas();
        poblarSelectoresSemanasAdelantos();

        const url = `${API_BASE}/adelantos?tipoEntidad=FINCA`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.ok) {
            adelantosFincasData = await res.json();
            actualizarKpisAdelantosFincas();
            renderTablaAdelantos('FINCA');
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: #f87171;">Error al cargar los adelantos de fincas.</td></tr>`;
        }
    } catch (err) {
        console.error('Error al cargar adelantos fincas:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: #f87171;">Error de conexión con el servidor.</td></tr>`;
    }
}
window.cargarAdelantosFincas = cargarAdelantosFincas;

async function cargarAbonosCompanias() {
    if (!state.token) return;
    const tbody = document.getElementById('tbodyAdelantosCompanias');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando abonos de compañías...</td></tr>`;
    }

    try {
        await asegurarSemanasCargadas();
        poblarSelectoresSemanasAdelantos();

        const url = `${API_BASE}/adelantos?tipoEntidad=COMPANIA`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.ok) {
            adelantosCompaniasData = await res.json();
            actualizarKpisAdelantosCompanias();
            renderTablaAdelantos('COMPANIA');
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: #f87171;">Error al cargar los abonos de compañías.</td></tr>`;
        }
    } catch (err) {
        console.error('Error al cargar abonos compañías:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: #f87171;">Error de conexión con el servidor.</td></tr>`;
    }
}
window.cargarAbonosCompanias = cargarAbonosCompanias;

async function cargarAdelantosReceptoria() {
    if (!state.token) return;
    const tbody = document.getElementById('tbodyAdelantosReceptoria');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando anticipos de receptoría...</td></tr>`;
    }

    try {
        await asegurarSemanasCargadas();
        poblarSelectoresSemanasAdelantos();

        const url = `${API_BASE}/adelantos?tipoEntidad=RECEPTORIA`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.ok) {
            adelantosReceptoriaData = await res.json();
            actualizarKpisAdelantosReceptoria();
            renderTablaAdelantos('RECEPTORIA');
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: #f87171;">Error al cargar anticipos de receptoría.</td></tr>`;
        }
    } catch (err) {
        console.error('Error al cargar adelantos receptoría:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: #f87171;">Error de conexión con el servidor.</td></tr>`;
    }
}
window.cargarAdelantosReceptoria = cargarAdelantosReceptoria;

function actualizarKpisAdelantosFincas() {
    const semanaId = document.getElementById('filtroSemanaAdelantoFinca')?.value || '';
    let totalAdelantado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let totalCuotasCobradas = 0;
    let totalCuotasPendientes = 0;
    let cantCuotasPospuestas = 0;
    let cantAdelantos = 0;

    adelantosFincasData.forEach(a => {
        const sInicio = String(a.semanaInicioId || a.SemanaInicioId || '');
        const cuotas = a.cuotas || a.Cuotas || [];

        if (!semanaId) {
            cantAdelantos++;
            totalAdelantado += (a.montoTotalUSD || a.MontoTotalUSD || 0);
            totalCobrado += (a.montoPagadoUSD || a.MontoPagadoUSD || 0);
            totalPendiente += (a.montoPendienteUSD || a.MontoPendienteUSD || 0);

            cuotas.forEach(c => {
                const st = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
                if (st === 'COBRADO') totalCuotasCobradas++;
                if (st === 'PENDIENTE') totalCuotasPendientes++;
                if (st === 'POSPUESTO') cantCuotasPospuestas++;
            });
        } else {
            const cuotasEnSemana = cuotas.filter(c => String(c.semanaOperativaId || c.SemanaOperativaId || '') === String(semanaId));
            const esSemanaInicio = sInicio === String(semanaId);

            if (esSemanaInicio || cuotasEnSemana.length > 0) {
                cantAdelantos++;
                if (esSemanaInicio) {
                    totalAdelantado += (a.montoTotalUSD || a.MontoTotalUSD || 0);
                }
                cuotasEnSemana.forEach(c => {
                    const st = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
                    const cobUsd = Number(c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0);
                    const cuotaUsd = Number(c.montoCuotaUSD ?? c.MontoCuotaUSD ?? 0);

                    if (st === 'COBRADO') {
                        totalCobrado += cobUsd;
                        totalCuotasCobradas++;
                    } else if (st === 'PENDIENTE') {
                        totalPendiente += cuotaUsd;
                        totalCuotasPendientes++;
                    } else if (st === 'POSPUESTO') {
                        cantCuotasPospuestas++;
                    }
                });
            }
        }
    });

    const elTotal = document.getElementById('kpiTotalAdelantadoFincasUSD');
    const elCant = document.getElementById('kpiCantAdelantosFincas');
    const elCobrado = document.getElementById('kpiTotalCobradoFincasUSD');
    const elCuotasCob = document.getElementById('kpiCuotasCobradasFincas');
    const elPendiente = document.getElementById('kpiTotalPendienteFincasUSD');
    const elCuotasPend = document.getElementById('kpiCuotasPendientesFincas');
    const elPosp = document.getElementById('kpiCantCuotasPospuestasFincas');

    if (elTotal) elTotal.innerText = `$ ${formatearNumero(totalAdelantado, 2)}`;
    if (elCant) elCant.innerText = semanaId ? `${cantAdelantos} Adelantos en ciclo` : `${adelantosFincasData.length} Adelantos registrados`;
    if (elCobrado) elCobrado.innerText = `$ ${formatearNumero(totalCobrado, 2)}`;
    if (elCuotasCob) elCuotasCob.innerText = `${totalCuotasCobradas} Cuotas abonadas`;
    if (elPendiente) elPendiente.innerText = `$ ${formatearNumero(totalPendiente, 2)}`;
    if (elCuotasPend) elCuotasPend.innerText = `${totalCuotasPendientes} Cuotas por cobrar`;
    if (elPosp) elPosp.innerText = String(cantCuotasPospuestas);
}

function actualizarKpisAdelantosCompanias() {
    const semanaId = document.getElementById('filtroSemanaAdelantoCompania')?.value || '';
    let totalAdelantado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let totalCuotasCobradas = 0;
    let totalCuotasPendientes = 0;
    let cantCuotasPospuestas = 0;
    let cantRegistros = 0;

    adelantosCompaniasData.forEach(a => {
        const sInicio = String(a.semanaInicioId || a.SemanaInicioId || '');
        const cuotas = a.cuotas || a.Cuotas || [];

        if (!semanaId) {
            cantRegistros++;
            totalAdelantado += (a.montoTotalUSD || a.MontoTotalUSD || 0);
            totalCobrado += (a.montoPagadoUSD || a.MontoPagadoUSD || 0);
            totalPendiente += (a.montoPendienteUSD || a.MontoPendienteUSD || 0);

            cuotas.forEach(c => {
                const st = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
                if (st === 'COBRADO') totalCuotasCobradas++;
                if (st === 'PENDIENTE') totalCuotasPendientes++;
                if (st === 'POSPUESTO') cantCuotasPospuestas++;
            });
        } else {
            const cuotasEnSemana = cuotas.filter(c => String(c.semanaOperativaId || c.SemanaOperativaId || '') === String(semanaId));
            const esSemanaInicio = sInicio === String(semanaId);

            if (esSemanaInicio || cuotasEnSemana.length > 0) {
                cantRegistros++;
                if (esSemanaInicio) {
                    totalAdelantado += (a.montoTotalUSD || a.MontoTotalUSD || 0);
                }
                cuotasEnSemana.forEach(c => {
                    const st = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
                    const cobUsd = Number(c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0);
                    const cuotaUsd = Number(c.montoCuotaUSD ?? c.MontoCuotaUSD ?? 0);

                    if (st === 'COBRADO') {
                        totalCobrado += cobUsd;
                        totalCuotasCobradas++;
                    } else if (st === 'PENDIENTE') {
                        totalPendiente += cuotaUsd;
                        totalCuotasPendientes++;
                    } else if (st === 'POSPUESTO') {
                        cantCuotasPospuestas++;
                    }
                });
            }
        }
    });

    const elTotal = document.getElementById('kpiTotalAdelantadoCompaniasUSD');
    const elCant = document.getElementById('kpiCantAdelantosCompanias');
    const elCobrado = document.getElementById('kpiTotalCobradoCompaniasUSD');
    const elCuotasCob = document.getElementById('kpiCuotasCobradasCompanias');
    const elPendiente = document.getElementById('kpiTotalPendienteCompaniasUSD');
    const elCuotasPend = document.getElementById('kpiCuotasPendientesCompanias');
    const elPosp = document.getElementById('kpiCantCuotasPospuestasCompanias');

    if (elTotal) elTotal.innerText = `$ ${formatearNumero(totalAdelantado, 2)}`;
    if (elCant) elCant.innerText = semanaId ? `${cantRegistros} Registros en ciclo` : `${adelantosCompaniasData.length} Registros`;
    if (elCobrado) elCobrado.innerText = `$ ${formatearNumero(totalCobrado, 2)}`;
    if (elCuotasCob) elCuotasCob.innerText = `${totalCuotasCobradas} Cuotas amortizadas`;
    if (elPendiente) elPendiente.innerText = `$ ${formatearNumero(totalPendiente, 2)}`;
    if (elCuotasPend) elCuotasPend.innerText = `${totalCuotasPendientes} Cuotas por cobrar`;
    if (elPosp) elPosp.innerText = String(cantCuotasPospuestas);
}

function actualizarKpisAdelantosReceptoria() {
    const semanaId = document.getElementById('filtroSemanaAdelantoReceptoria')?.value || '';
    let totalAdelantado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let totalCuotasCobradas = 0;
    let totalCuotasPendientes = 0;
    let cantCuotasPospuestas = 0;
    let cantRegistros = 0;

    adelantosReceptoriaData.forEach(a => {
        const sInicio = String(a.semanaInicioId || a.SemanaInicioId || '');
        const cuotas = a.cuotas || a.Cuotas || [];

        if (!semanaId) {
            cantRegistros++;
            totalAdelantado += (a.montoTotalUSD || a.MontoTotalUSD || 0);
            totalCobrado += (a.montoPagadoUSD || a.MontoPagadoUSD || 0);
            totalPendiente += (a.montoPendienteUSD || a.MontoPendienteUSD || 0);

            cuotas.forEach(c => {
                const st = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
                if (st === 'COBRADO') totalCuotasCobradas++;
                if (st === 'PENDIENTE') totalCuotasPendientes++;
                if (st === 'POSPUESTO') cantCuotasPospuestas++;
            });
        } else {
            const cuotasEnSemana = cuotas.filter(c => String(c.semanaOperativaId || c.SemanaOperativaId || '') === String(semanaId));
            const esSemanaInicio = sInicio === String(semanaId);

            if (esSemanaInicio || cuotasEnSemana.length > 0) {
                cantRegistros++;
                if (esSemanaInicio) {
                    totalAdelantado += (a.montoTotalUSD || a.MontoTotalUSD || 0);
                }
                cuotasEnSemana.forEach(c => {
                    const st = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
                    const cobUsd = Number(c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0);
                    const cuotaUsd = Number(c.montoCuotaUSD ?? c.MontoCuotaUSD ?? 0);

                    if (st === 'COBRADO') {
                        totalCobrado += cobUsd;
                        totalCuotasCobradas++;
                    } else if (st === 'PENDIENTE') {
                        totalPendiente += cuotaUsd;
                        totalCuotasPendientes++;
                    } else if (st === 'POSPUESTO') {
                        cantCuotasPospuestas++;
                    }
                });
            }
        }
    });

    const elTotal = document.getElementById('kpiTotalAdelantadoReceptoriaUSD');
    const elCant = document.getElementById('kpiCantAdelantosReceptoria');
    const elCobrado = document.getElementById('kpiTotalCobradoReceptoriaUSD');
    const elCuotasCob = document.getElementById('kpiCuotasCobradasReceptoria');
    const elPendiente = document.getElementById('kpiTotalPendienteReceptoriaUSD');
    const elCuotasPend = document.getElementById('kpiCuotasPendientesReceptoria');
    const elPosp = document.getElementById('kpiCantCuotasPospuestasReceptoria');

    if (elTotal) elTotal.innerText = `$ ${formatearNumero(totalAdelantado, 2)}`;
    if (elCant) elCant.innerText = semanaId ? `${cantRegistros} Anticipos en ciclo` : `${adelantosReceptoriaData.length} Anticipos registrados`;
    if (elCobrado) elCobrado.innerText = `$ ${formatearNumero(totalCobrado, 2)}`;
    if (elCuotasCob) elCuotasCob.innerText = `${totalCuotasCobradas} Cuotas saldadas`;
    if (elPendiente) elPendiente.innerText = `$ ${formatearNumero(totalPendiente, 2)}`;
    if (elCuotasPend) elCuotasPend.innerText = `${totalCuotasPendientes} Cuotas pendientes`;
    if (elPosp) elPosp.innerText = String(cantCuotasPospuestas);
}

function filtrarAdelantosFincas(txt) {
    adelantosFincasFiltro = (txt || '').toLowerCase().trim();
    renderTablaAdelantos('FINCA');
}
window.filtrarAdelantosFincas = filtrarAdelantosFincas;

function filtrarAbonosCompanias(txt) {
    adelantosCompaniasFiltro = (txt || '').toLowerCase().trim();
    renderTablaAdelantos('COMPANIA');
}
window.filtrarAbonosCompanias = filtrarAbonosCompanias;

function filtrarAdelantosReceptoria(txt) {
    adelantosReceptoriaFiltro = (txt || '').toLowerCase().trim();
    renderTablaAdelantos('RECEPTORIA');
}
window.filtrarAdelantosReceptoria = filtrarAdelantosReceptoria;

function obtenerSemanaCobroAdelantoHtml(a) {
    const numCuotas = a.numeroCuotas ?? a.NumeroCuotas ?? 1;
    const cuotas = a.cuotas || a.Cuotas || [];
    const sInicioId = a.semanaInicioId || a.SemanaInicioId;
    const sInicioNom = a.semanaInicioNombre || a.SemanaInicioNombre;

    const getNomSem = (sId, fallbackNom) => {
        if (fallbackNom && fallbackNom !== 'Semana Operativa' && fallbackNom !== 'S/N') return fallbackNom;
        if (state.semanas && state.semanas.length > 0 && sId) {
            const sem = state.semanas.find(s => (s.id || s.Id) == sId);
            if (sem) return formatearTextoSemana(sem);
        }
        return fallbackNom || (sId ? `Semana #${sId}` : 'Semana Activa');
    };

    if (numCuotas <= 1 || cuotas.length <= 1) {
        const c0 = cuotas[0] || {};
        const semId = c0.semanaOperativaId || c0.SemanaOperativaId || sInicioId;
        const semNom = getNomSem(semId, c0.semanaNombre || c0.SemanaNombre || sInicioNom);
        const partes = String(semNom).split('(');
        const tituloSem = partes[0].trim();
        const rangoFechas = partes.length > 1 ? partes[1].replace(')', '').trim() : '';

        return `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-weight: 800; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                    <i class="fa-solid fa-calendar-check" style="color: #22c55e;"></i> ${tituloSem}
                </span>
                ${rangoFechas ? `<span style="font-size: 10px; color: #64748b; font-weight: 600;">${rangoFechas}</span>` : ''}
            </div>
        `;
    }

    // Múltiples cuotas
    const cuotasPendientes = cuotas.filter(c => (c.estado || c.Estado || 'PENDIENTE').toUpperCase() !== 'COBRADO');
    const proxCuota = cuotasPendientes[0] || cuotas[cuotas.length - 1];
    const semIdProx = proxCuota?.semanaOperativaId || proxCuota?.SemanaOperativaId;
    const semNomProx = getNomSem(semIdProx, proxCuota?.semanaNombre || proxCuota?.SemanaNombre);
    const titProx = String(semNomProx).split('(')[0].trim();

    const primeraCuota = cuotas[0];
    const ultimaCuota = cuotas[cuotas.length - 1];
    const nomPrim = String(getNomSem(primeraCuota?.semanaOperativaId || primeraCuota?.SemanaOperativaId || sInicioId, primeraCuota?.semanaNombre || sInicioNom)).split('(')[0].trim();
    const nomUlt = String(getNomSem(ultimaCuota?.semanaOperativaId || ultimaCuota?.SemanaOperativaId, ultimaCuota?.semanaNombre)).split('(')[0].trim();

    if (cuotasPendientes.length === 0) {
        return `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                    <i class="fa-solid fa-check-double" style="color: #16a34a;"></i> ${nomPrim} &rarr; ${nomUlt}
                </span>
                <span style="font-size: 10px; color: #16a34a; font-weight: 700;">Todas cobradas (${numCuotas}/${numCuotas})</span>
            </div>
        `;
    }

    const numC = proxCuota?.numeroCuota || proxCuota?.NumeroCuota || (cuotas.length - cuotasPendientes.length + 1);

    return `
        <div style="display: flex; flex-direction: column; gap: 2px;">
            <span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-weight: 800; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                <i class="fa-solid fa-clock" style="color: #3b82f6;"></i> ${titProx}
            </span>
            <span style="font-size: 10px; color: #64748b; font-weight: 600;">
                Cuota ${numC}/${numCuotas} (${nomPrim}..${nomUlt})
            </span>
        </div>
    `;
}
window.obtenerSemanaCobroAdelantoHtml = obtenerSemanaCobroAdelantoHtml;

function renderTablaAdelantos(tipoEntidad) {
    let tbodyId = 'tbodyAdelantosFincas';
    let dataOriginal = adelantosFincasData;
    let filtroText = adelantosFincasFiltro;
    let selectFiltroEstadoId = 'filtroEstadoAdelantoFinca';
    let selectFiltroSemanaId = 'filtroSemanaAdelantoFinca';

    if (tipoEntidad === 'FINCA') {
        tbodyId = 'tbodyAdelantosFincas';
        dataOriginal = adelantosFincasData;
        filtroText = adelantosFincasFiltro;
        selectFiltroEstadoId = 'filtroEstadoAdelantoFinca';
        selectFiltroSemanaId = 'filtroSemanaAdelantoFinca';
    } else if (tipoEntidad === 'COMPANIA') {
        tbodyId = 'tbodyAdelantosCompanias';
        dataOriginal = adelantosCompaniasData;
        filtroText = adelantosCompaniasFiltro;
        selectFiltroEstadoId = 'filtroEstadoAdelantoCompania';
        selectFiltroSemanaId = 'filtroSemanaAdelantoCompania';
    } else {
        tbodyId = 'tbodyAdelantosReceptoria';
        dataOriginal = adelantosReceptoriaData;
        filtroText = adelantosReceptoriaFiltro;
        selectFiltroEstadoId = 'filtroEstadoAdelantoReceptoria';
        selectFiltroSemanaId = 'filtroSemanaAdelantoReceptoria';
    }

    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const filtroEstado = document.getElementById(selectFiltroEstadoId)?.value || '';
    const filtroSemana = document.getElementById(selectFiltroSemanaId)?.value || '';

    // Filtrar según ciclo operativo (semana), estado y texto
    let items = (dataOriginal || []).filter(a => {
        const sInicio = String(a.semanaInicioId || a.SemanaInicioId || '');
        const cuotas = a.cuotas || a.Cuotas || [];

        // Filtro por Ciclo Operativo / Semana
        if (filtroSemana) {
            const tieneCuotaEnSemana = cuotas.some(c => String(c.semanaOperativaId || c.SemanaOperativaId || '') === String(filtroSemana));
            const esSemanaInicio = sInicio === String(filtroSemana);
            if (!esSemanaInicio && !tieneCuotaEnSemana) return false;
        }

        // Filtro por Estado
        const est = (a.estado || a.Estado || '').toUpperCase();
        const pend = Number(a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0);
        if (filtroEstado === 'ACTIVO') {
            return est !== 'PAGADO' && pend > 0.001;
        } else if (filtroEstado === 'PAGADO') {
            return est === 'PAGADO' || pend <= 0.001;
        } else if (filtroEstado === 'POSPUESTO') {
            return cuotas.some(c => (c.estado || c.Estado || '').toUpperCase() === 'POSPUESTO');
        }
        return true; // TODOS LOS ESTADOS
    });

    if (filtroText) {
        items = items.filter(a => {
            const nom = (a.entidadNombre || a.EntidadNombre || '').toLowerCase();
            const obs = (a.observacion || a.Observacion || '').toLowerCase();
            const id = String(a.id || a.Id || '');
            return nom.includes(filtroText) || obs.includes(filtroText) || id.includes(filtroText);
        });
    }

    if (!items || items.length === 0) {
        let mensajeVacio = 'No se encontraron registros de adelantos o préstamos con los filtros aplicados.';
        if (filtroEstado === 'ACTIVO') {
            mensajeVacio = 'No hay adelantos activos o pendientes en este filtro. Cambia a "TODOS LOS ESTADOS" o selecciona otro ciclo.';
        } else if (filtroEstado === 'POSPUESTO') {
            mensajeVacio = 'No hay cuotas pospuestas en la selección actual.';
        }
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center" style="padding: 36px 20px; color: #64748b;">
                    <div style="font-size: 32px; color: #94a3b8; margin-bottom: 8px;"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                    <div style="font-weight: 700; font-size: 15px; color: #334155;">Sin registros para esta consulta</div>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${mensajeVacio}</div>
                </td>
            </tr>`;
        return;
    }

    const tasaActual = Number(state.tasaBcv || 791.3248);
    let rowsHtml = '';
    items.forEach((a, idx) => {
        const id = a.id || a.Id;
        const nom = a.entidadNombre || a.EntidadNombre || 'S/N';
        const totalUsd = a.montoTotalUSD ?? a.MontoTotalUSD ?? 0;
        const numCuotas = a.numeroCuotas ?? a.NumeroCuotas ?? 1;
        const cuotaUsd = a.montoCuotaUSD ?? a.MontoCuotaUSD ?? 0;
        const pagadoUsd = a.montoPagadoUSD ?? a.MontoPagadoUSD ?? 0;
        const pendienteUsd = a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0;
        const estado = (a.estado || a.Estado || 'ACTIVO').toUpperCase();
        const obs = a.observacion || a.Observacion || '-';

        const cuotas = a.cuotas || a.Cuotas || [];
        const cuotasCobradasCount = cuotas.filter(c => (c.estado || c.Estado) === 'COBRADO').length;

        const badgeEstado = estado === 'PAGADO'
            ? `<span class="badge" style="background: #eff6ff; color: #16a34a; border: 1px solid #bbf7d0; font-weight: 800;">PAGADO</span>`
            : `<span class="badge" style="background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; font-weight: 800;">ACTIVO (${cuotasCobradasCount}/${numCuotas})</span>`;

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        // Cálculo dinámico de Monto en Bs (mientras no esté pagado cambia con el dólar)
        let montoBsHtml = '';
        if (estado === 'PAGADO' || pendienteUsd <= 0.001) {
            const totalCobradoBs = cuotas.reduce((acc, c) => {
                const cCobBs = Number(c.montoCobradoBs ?? c.MontoCobradoBs ?? 0);
                if (cCobBs > 0) return acc + cCobBs;
                const cCobUsd = Number(c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0);
                const cTasa = Number(c.tasaBcvAplicada ?? c.TasaBcvAplicada ?? tasaActual);
                return acc + (cCobUsd * cTasa);
            }, 0);
            const montoBsFinal = totalCobradoBs > 0 ? totalCobradoBs : (totalUsd * tasaActual);
            montoBsHtml = `
                <div style="font-weight: 800; color: #047857; font-size: 13.5px; font-family: monospace;">Bs. ${formatearNumero(montoBsFinal, 2)}</div>
                <div style="font-size: 10px; color: #16a34a; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Liquidado</div>
            `;
        } else {
            const saldoPendienteBs = (pendienteUsd > 0 ? pendienteUsd : totalUsd) * tasaActual;
            const totalBsDinamico = totalUsd * tasaActual;
            montoBsHtml = `
                <div style="font-weight: 800; color: #b45309; font-size: 13.5px; font-family: monospace;" title="Equivalente en Bolívares calculado a Tasa BCV: Bs. ${formatearNumero(tasaActual, 4)}">
                    Bs. ${formatearNumero(saldoPendienteBs, 2)}
                </div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">
                    ${pagadoUsd > 0 ? `Total: Bs. ${formatearNumero(totalBsDinamico, 2)}` : `@ ${formatearNumero(tasaActual, 2)} Bs/$`}
                </div>
            `;
        }

        // Renderizar cuotas por ciclo operativo en acordeón
        let cuotasRowsHtml = '';
        cuotas.forEach(c => {
            const cId = c.id || c.Id;
            const numC = c.numeroCuota || c.NumeroCuota;
            const semNom = c.semanaNombre || c.SemanaNombre || 'Semana Operativa';
            const nomCuotaUsd = c.montoCuotaUSD ?? c.MontoCuotaUSD ?? 0;
            const cobUsd = c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0;
            const tasaAplic = c.tasaBcvAplicada ?? c.TasaBcvAplicada ?? tasaActual;
            const cobBs = (c.estado || c.Estado) === 'COBRADO' 
                ? (c.montoCobradoBs ?? c.MontoCobradoBs ?? (cobUsd * tasaAplic))
                : (nomCuotaUsd * tasaActual);
            const stCuota = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();
            const obsCuota = c.observacion || c.Observacion || '';

            let badgeStCuota = `<span class="badge" style="background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; font-size: 11px;">PENDIENTE</span>`;
            if (stCuota === 'COBRADO') {
                badgeStCuota = `<span class="badge" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 800;">COBRADO</span>`;
            } else if (stCuota === 'POSPUESTO') {
                badgeStCuota = `<span class="badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800;">POSPUESTO</span>`;
            }

            cuotasRowsHtml += `
                <tr style="background: #f1f5f9; font-size: 12.5px;">
                    <td style="text-align: center; font-weight: 700; color: #475569;">Cuota ${numC}/${numCuotas}</td>
                    <td style="font-weight: 700; color: #1e293b;">${semNom}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">$ ${formatearNumero(nomCuotaUsd, 2)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 800; color: ${stCuota === 'COBRADO' ? '#047857' : '#64748b'};">$ ${formatearNumero(cobUsd, 2)}</td>
                    <td style="text-align: right; font-family: monospace; font-size: 12px; color: #475569;">Bs. ${formatearNumero(stCuota === 'COBRADO' ? tasaAplic : tasaActual, 4)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 800; color: #b45309;">Bs. ${formatearNumero(cobBs, 2)}</td>
                    <td style="text-align: center;">${badgeStCuota}</td>
                    <td style="color: #64748b; font-size: 11.5px;">${obsCuota}</td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button type="button" class="btn btn-outline" onclick="abrirModalEditarCuota(${cId}, ${id})" title="Ajustar Cuota / Abonar" style="padding: 3px 8px; font-size: 11.5px; font-weight: 700; background: #eff6ff; color: #1d4ed8; border-color: #93c5fd;">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            ${stCuota !== 'COBRADO' ? `
                            <button type="button" class="btn btn-outline" onclick="abrirModalDividirCuota(${cId})" title="Deducción parcial y trasladar remanente" style="padding: 3px 8px; font-size: 11.5px; font-weight: 700; background: #ecfdf5; color: #047857; border-color: #a7f3d0;">
                                <i class="fa-solid fa-scissors"></i> Dividir
                            </button>
                            <button type="button" class="btn btn-outline" onclick="abrirModalPosponerCuota(${cId})" title="Posponer cuota al siguiente ciclo" style="padding: 3px 8px; font-size: 11.5px; font-weight: 700; background: #fefce8; color: #b45309; border-color: #fde047;">
                                <i class="fa-solid fa-calendar-minus"></i> Posponer
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        const semanaCobroHtml = obtenerSemanaCobroAdelantoHtml(a);

        rowsHtml += `
            <tr style="background: ${rowBg}; transition: background 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${rowBg}'">
                <td style="text-align: center;">
                    <button type="button" onclick="toggleDetalleCuotas(${id})" title="Ver / Ocultar plan de cuotas por ciclo" style="background: none; border: none; cursor: pointer; color: #2563eb; font-size: 14px;">
                        <i class="fa-solid fa-chevron-right" id="iconToggleAdelanto_${id}"></i>
                    </button>
                </td>
                <td style="text-align: center;">
                    <span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 800; font-size: 12px; border: 1px solid #cbd5e1;">#${id}</span>
                </td>
                <td>
                    <div style="font-weight: 800; color: #0f172a; font-size: 13.5px;">${capitalizarTexto(nom)}</div>
                    <div style="font-size: 11.5px; color: #64748b;">${obs}</div>
                </td>
                <td>
                    ${semanaCobroHtml}
                </td>
                <td style="text-align: right; font-weight: 800; color: #0f172a; font-size: 14.5px; font-family: monospace;">$ ${formatearNumero(totalUsd, 2)}</td>
                <td style="text-align: right;">${montoBsHtml}</td>
                <td style="text-align: center;">
                    <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-weight: 700; border: 1px solid #bfdbfe;">${numCuotas} ${numCuotas === 1 ? 'Cuota' : 'Cuotas'}</span>
                </td>
                <td style="text-align: right; font-weight: 700; color: #334155; font-family: monospace;">$ ${formatearNumero(cuotaUsd, 2)}</td>
                <td style="text-align: right; font-weight: 800; color: #047857; font-family: monospace;">$ ${formatearNumero(pagadoUsd, 2)}</td>
                <td style="text-align: right; font-weight: 800; color: ${pendienteUsd > 0 ? '#e11d48' : '#64748b'}; font-family: monospace;">$ ${formatearNumero(pendienteUsd, 2)}</td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn btn-outline" onclick="toggleDetalleCuotas(${id})" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-color: #cbd5e1; color: #334155; background: #ffffff; border-radius: 6px;">
                            <i class="fa-solid fa-list"></i> Cuotas
                        </button>
                        ${estado !== 'PAGADO' ? `
                        <button type="button" class="btn btn-outline" onclick="abrirModalReestructurarCuotas(${id})" title="Reestructurar plan de cuotas pendientes" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; border-radius: 6px;">
                            <i class="fa-solid fa-calculator"></i> Reestructurar
                        </button>` : ''}
                        <button type="button" class="btn btn-outline" onclick="eliminarAdelanto(${id}, '${tipoEntidad}')" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-color: #fecdd3; color: #e11d48; background: #fff1f2; border-radius: 6px;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            <!-- SUB-TABLA DE CUOTAS POR CICLO (OCULTA POR DEFECTO) -->
            <tr id="trDetalleCuotas_${id}" style="display: none; background: #f8fafc;">
                <td colspan="12" style="padding: 12px 18px; border-top: 2px solid #3b82f6;">
                    <div style="font-size: 12.5px; font-weight: 800; color: #1e293b; margin-bottom: 8px; text-transform: uppercase;">
                        <i class="fa-solid fa-calendar-days" style="color: #2563eb;"></i> Plan de Cuotas por Ciclo Operativo - Adelanto #${id} (${nom}):
                    </div>
                    <table class="table" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #ffffff;">
                        <thead>
                            <tr style="background: #e2e8f0; font-size: 11.5px; font-weight: 800; color: #334155;">
                                <th style="text-align: center;">N° CUOTA</th>
                                <th>CICLO OPERATIVO (SEMANA)</th>
                                <th style="text-align: right;">CUOTA PACTADA ($)</th>
                                <th style="text-align: right;">ABONADO ($)</th>
                                <th style="text-align: right;">TASA BCV</th>
                                <th style="text-align: right;">DESCUENTO (BS)</th>
                                <th style="text-align: center;">ESTADO</th>
                                <th>OBSERVACIONES</th>
                                <th style="text-align: center;">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cuotasRowsHtml || '<tr><td colspan="9" class="text-center" style="padding: 12px; color: #94a3b8;">Sin cuotas programadas.</td></tr>'}
                        </tbody>
                    </table>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

function toggleDetalleCuotas(adelantoId) {
    const tr = document.getElementById(`trDetalleCuotas_${adelantoId}`);
    const icon = document.getElementById(`iconToggleAdelanto_${adelantoId}`);
    if (!tr) return;

    const isVisible = tr.style.display === 'table-row';
    if (isVisible) {
        tr.style.display = 'none';
        if (icon) icon.className = 'fa-solid fa-chevron-right';
    } else {
        tr.style.display = 'table-row';
        if (icon) icon.className = 'fa-solid fa-chevron-down';
    }
}
window.toggleDetalleCuotas = toggleDetalleCuotas;

function inicializarComboboxAdelantoEntidad(tipoEntidad) {
    const isFinca = tipoEntidad === 'FINCA';
    const placeholder = isFinca ? 'SELECCIONE FINCA / PRODUCTOR...' : 'SELECCIONE COMPAÑÍA / RECEPTORÍA...';
    
    const searchInput = document.getElementById('inputAdelantoEntidadSearch');
    if (searchInput) searchInput.placeholder = placeholder;

    if (!comboboxAdelantoEntidadInstance && document.getElementById('comboboxAdelantoEntidad')) {
        comboboxAdelantoEntidadInstance = setupCombobox({
            containerId: 'comboboxAdelantoEntidad',
            inputSearchId: 'inputAdelantoEntidadSearch',
            inputHiddenId: 'modalAdelantoEntidadId',
            dropdownId: 'dropdownAdelantoEntidad',
            placeholder: placeholder,
            getItemsFn: () => {
                const tipo = document.getElementById('modalAdelantoTipoEntidad')?.value || 'FINCA';
                if (tipo === 'FINCA') {
                    return (state.fincas || [])
                        .filter(f => f.activo !== false && f.Activo !== false)
                        .map(f => {
                            const id = f.id || f.Id;
                            const nom = (f.nombre || f.Nombre || '').toUpperCase();
                            const prop = f.propietario || f.Propietario || '';
                            return {
                                value: id,
                                label: `${nom} ${prop ? `(${prop})` : ''}`.trim(),
                                sub: prop
                            };
                        });
                } else {
                    return (state.companias || [])
                        .filter(c => c.activo !== false && c.Activo !== false)
                        .map(c => {
                            const id = c.id || c.Id;
                            const nom = (c.nombre || c.Nombre || '').toUpperCase();
                            return {
                                value: id,
                                label: nom,
                                sub: ''
                            };
                        });
                }
            }
        });
        window.comboboxAdelantoEntidadInstance = comboboxAdelantoEntidadInstance;
    }

    if (comboboxAdelantoEntidadInstance) {
        comboboxAdelantoEntidadInstance.reset();
        const firstItem = isFinca 
            ? (state.fincas && state.fincas[0]) 
            : (state.companias && state.companias[0]);
        if (firstItem) {
            const firstId = firstItem.id || firstItem.Id;
            const firstNom = (firstItem.nombre || firstItem.Nombre || '').toUpperCase();
            const firstProp = firstItem.propietario || firstItem.Propietario || '';
            const firstLabel = isFinca ? `${firstNom} ${firstProp ? `(${firstProp})` : ''}`.trim() : firstNom;
            comboboxAdelantoEntidadInstance.selectItem(firstId, firstLabel);
        }
    }
}

async function abrirModalCrearAdelanto(tipoEntidad) {
    const isFinca = tipoEntidad === 'FINCA';
    const isCompania = tipoEntidad === 'COMPANIA';
    const modalTipo = document.getElementById('modalAdelantoTipoEntidad');
    const title = document.getElementById('modalCrearAdelantoTitle');
    const subtitle = document.getElementById('modalCrearAdelantoSubtitle');
    const lblEntidad = document.getElementById('lblAdelantoEntidad');
    const selectEntidad = document.getElementById('modalAdelantoEntidadId');
    const selectSemana = document.getElementById('modalAdelantoSemanaInicioId');
    const inputTasa = document.getElementById('modalAdelantoTasaBcv');

    if (modalTipo) modalTipo.value = tipoEntidad;
    if (title) title.innerText = isFinca ? 'Registrar Nuevo Adelanto a Finca' : (isCompania ? 'Registrar Abono / Adelanto a Compañía' : 'Registrar Anticipo a Receptoría');
    if (subtitle) subtitle.innerText = isFinca 
        ? 'Préstamo o anticipo otorgado a productor pagadero en cuotas semanales' 
        : (isCompania ? 'Abono financiero o anticipo concedido a la compañía / planta láctea pagadero en cuotas' : 'Anticipo concedido a planta receptora/compañía pagadero en cuotas por ciclo');
    if (lblEntidad) lblEntidad.innerHTML = isFinca ? 'Finca / Productor <span style="color: #e11d48;">*</span>' : (isCompania ? 'Compañía / Planta <span style="color: #e11d48;">*</span>' : 'Compañía Receptoría <span style="color: #e11d48;">*</span>');

    // Cargar selector de entidad (Searchable Combobox)
    inicializarComboboxAdelantoEntidad(tipoEntidad);

    // Asegurar semanas operativas cargadas
    if (!state.semanas || state.semanas.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/ciclos/semanas`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.semanas = await res.json();
        } catch (e) {
            console.warn('Error cargando semanas para modal:', e);
        }
    }

    // Cargar selector de semanas operativas (del ciclo activo en adelante)
    if (selectSemana) {
        const cicloActivo = (state.semanas || []).find(s => s.esActivo || s.EsActivo) || state.cicloActivo;
        const idCicloActivo = cicloActivo ? (cicloActivo.id || cicloActivo.Id) : 0;
        const semanasDisponibles = (state.semanas || [])
            .filter(s => (s.id || s.Id) >= idCicloActivo)
            .sort((a, b) => (a.id || a.Id) - (b.id || b.Id));

        selectSemana.innerHTML = semanasDisponibles.map(s => {
            const id = s.id || s.Id;
            const esAct = (s.esActivo || s.EsActivo || id === idCicloActivo);
            return `<option value="${id}">${formatearTextoSemana(s)}${esAct ? ' ★ [CICLO ACTIVO]' : ''}</option>`;
        }).join('');

        if (state.cicloActivo && state.cicloActivo.id) {
            selectSemana.value = state.cicloActivo.id;
        }
    }

    if (inputTasa) {
        inputTasa.value = state.tasaBcv > 0 ? state.tasaBcv : 791.3248;
    }

    document.getElementById('modalAdelantoMontoTotal').value = '';
    document.getElementById('modalAdelantoNumeroCuotas').value = '1';
    document.getElementById('modalAdelantoFechaSolicitud').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalAdelantoObservacion').value = '';

    calcularCuotasPreview();
    abrirModalCustom('modalCrearAdelantoCustom');
}
window.abrirModalCrearAdelanto = abrirModalCrearAdelanto;

function calcularCuotasPreview() {
    const montoTotal = parseFloat(document.getElementById('modalAdelantoMontoTotal')?.value) || 0;
    const numCuotas = parseInt(document.getElementById('modalAdelantoNumeroCuotas')?.value, 10) || 1;
    const tasaBCV = parseFloat(document.getElementById('modalAdelantoTasaBcv')?.value) || (state.tasaBcv > 0 ? state.tasaBcv : 791.3248);
    const semanaInicioId = parseInt(document.getElementById('modalAdelantoSemanaInicioId')?.value, 10);
    const lblEstimado = document.getElementById('lblCuotaMontoEstimado');
    const box = document.getElementById('boxPreviewCuotasAdelanto');

    if (montoTotal <= 0 || numCuotas <= 0) {
        if (lblEstimado) lblEstimado.innerText = '$0.00 / cuota';
        if (box) box.innerHTML = `<span style="color: #94a3b8;">Ingresa el monto total y cuotas para previsualizar el plan.</span>`;
        return;
    }

    const cuotaUsdBase = Math.round((montoTotal / numCuotas) * 100) / 100;
    if (lblEstimado) lblEstimado.innerText = `$ ${formatearNumero(cuotaUsdBase, 2)} / cuota (Promedio)`;

    const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => (a.id || a.Id) - (b.id || b.Id));
    let startIdx = semanasOrdenadas.findIndex(s => (s.id || s.Id) == semanaInicioId);
    if (startIdx < 0) {
        if (state.cicloActivo) {
            startIdx = semanasOrdenadas.findIndex(s => (s.id || s.Id) == state.cicloActivo.id);
        }
        if (startIdx < 0) startIdx = 0;
    }

    let previewHtml = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    for (let i = 1; i <= numCuotas; i++) {
        const valCuota = (i === numCuotas) ? Math.round((montoTotal - (cuotaUsdBase * (numCuotas - 1))) * 100) / 100 : cuotaUsdBase;
        const valBs = Math.round(valCuota * tasaBCV * 100) / 100;

        const targetSemIdx = Math.min(startIdx + (i - 1), Math.max(0, semanasOrdenadas.length - 1));
        const targetSemanaId = semanasOrdenadas[targetSemIdx] ? (semanasOrdenadas[targetSemIdx].id || semanasOrdenadas[targetSemIdx].Id) : semanaInicioId;

        const semSelectOptions = semanasOrdenadas.map(s => {
            const sId = s.id || s.Id;
            const isSel = sId === targetSemanaId ? 'selected' : '';
            return `<option value="${sId}" ${isSel}>${formatearTextoSemana(s)}</option>`;
        }).join('');

        previewHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 10px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">
                <span style="font-size: 12px; font-weight: 800; color: #1e293b; min-width: 60px;">Cuota ${i}:</span>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <select class="input-cuota-preview-semana" data-index="${i}" title="Semana operativa donde se cobrará esta cuota" style="height: 32px; padding: 2px 6px; font-size: 11.5px; font-weight: 700; color: #1e40af; background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 4px; max-width: 175px;">
                        ${semSelectOptions}
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 3px;">
                    <span style="font-size: 12px; font-weight: 700; color: #0f172a;">$</span>
                    <input type="number" step="0.01" min="0" value="${valCuota.toFixed(2)}" class="input-cuota-preview-usd" data-index="${i}" oninput="actualizarBsFilaPreview(this)" style="width: 80px; height: 32px; padding: 2px 6px; font-size: 12.5px; font-weight: 700; color: #047857; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px;">
                </div>
                <div style="display: flex; align-items: center; gap: 3px;">
                    <span style="font-size: 11px; font-weight: 600; color: #64748b;">Tasa:</span>
                    <input type="number" step="0.0001" min="0.0001" value="${tasaBCV}" class="input-cuota-preview-tasa" data-index="${i}" oninput="actualizarBsFilaPreview(this)" style="width: 85px; height: 32px; padding: 2px 6px; font-size: 12px; font-weight: 700; color: #b45309; background: #fefce8; border: 1px solid #fde047; border-radius: 4px;">
                </div>
                <span class="span-cuota-preview-bs" style="font-size: 11.5px; font-weight: 800; color: #b45309; min-width: 95px; text-align: right;">Bs. ${formatearNumero(valBs, 2)}</span>
            </div>`;
    }
    previewHtml += '</div>';

    if (box) box.innerHTML = previewHtml;
    actualizarSumaCuotasPreview();
}
window.calcularCuotasPreview = calcularCuotasPreview;

function actualizarBsFilaPreview(inputEl) {
    const parent = inputEl.closest('div[style*="display: flex"]');
    if (!parent) return;
    const usdInput = parent.querySelector('.input-cuota-preview-usd');
    const tasaInput = parent.querySelector('.input-cuota-preview-tasa');
    const spanBs = parent.querySelector('.span-cuota-preview-bs');
    
    const valUsd = parseFloat(usdInput?.value) || 0;
    const valTasa = parseFloat(tasaInput?.value) || 0;
    const valBs = valUsd * valTasa;
    if (spanBs) spanBs.innerText = `Bs. ${formatearNumero(valBs, 2)}`;
    actualizarSumaCuotasPreview();
}
window.actualizarBsFilaPreview = actualizarBsFilaPreview;

function actualizarSumaCuotasPreview() {
    const inputsUsd = document.querySelectorAll('.input-cuota-preview-usd');
    let sumaTotal = 0;
    inputsUsd.forEach(inp => {
        sumaTotal += parseFloat(inp.value) || 0;
    });
    const montoTotal = parseFloat(document.getElementById('modalAdelantoMontoTotal')?.value) || 0;
    const badge = document.getElementById('lblCuotaMontoEstimado');
    if (badge) {
        const diff = Math.abs(sumaTotal - montoTotal);
        if (montoTotal > 0 && diff > 0.01) {
            badge.style.background = '#fff7ed';
            badge.style.color = '#c2410c';
            badge.style.border = '1px solid #ffedd5';
            badge.innerText = `Suma: $${formatearNumero(sumaTotal, 2)} (Req: $${formatearNumero(montoTotal, 2)})`;
        } else {
            badge.style.background = '';
            badge.style.color = '';
            badge.style.border = '';
            badge.innerText = `Suma Total: $${formatearNumero(sumaTotal, 2)}`;
        }
    }
}
window.actualizarSumaCuotasPreview = actualizarSumaCuotasPreview;

async function guardarCrearAdelantoSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const tipoEntidad = document.getElementById('modalAdelantoTipoEntidad')?.value || 'FINCA';
    const entidadId = parseInt(document.getElementById('modalAdelantoEntidadId')?.value, 10);
    const montoTotalUSD = parseFloat(document.getElementById('modalAdelantoMontoTotal')?.value);
    const numeroCuotas = parseInt(document.getElementById('modalAdelantoNumeroCuotas')?.value, 10);
    const tasaBcvInicial = parseFloat(document.getElementById('modalAdelantoTasaBcv')?.value);
    const fechaSolicitud = document.getElementById('modalAdelantoFechaSolicitud')?.value;
    const semanaInicioId = parseInt(document.getElementById('modalAdelantoSemanaInicioId')?.value, 10);
    const observacion = (document.getElementById('modalAdelantoObservacion')?.value || '').trim();

    if (isNaN(entidadId) || entidadId <= 0) {
        Swal.fire({ icon: 'warning', title: 'Selección Requerida', text: 'Por favor selecciona la finca o compañía.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (isNaN(montoTotalUSD) || montoTotalUSD <= 0) {
        Swal.fire({ icon: 'warning', title: 'Monto Inválido', text: 'Ingresa un monto total mayor a 0 USD.', background: '#1e293b', color: '#fff' });
        return;
    }
    if (isNaN(numeroCuotas) || numeroCuotas <= 0) {
        Swal.fire({ icon: 'warning', title: 'Cuotas Inválidas', text: 'El número de cuotas debe ser al menos 1.', background: '#1e293b', color: '#fff' });
        return;
    }

    const cuotasCustom = [];
    const usdInputs = document.querySelectorAll('.input-cuota-preview-usd');
    const tasaInputs = document.querySelectorAll('.input-cuota-preview-tasa');
    const semanaSelects = document.querySelectorAll('.input-cuota-preview-semana');
    usdInputs.forEach((inp, idx) => {
        const usdVal = parseFloat(inp.value) || 0;
        const tasaVal = parseFloat(tasaInputs[idx]?.value) || tasaBcvInicial;
        const semId = parseInt(semanaSelects[idx]?.value, 10);
        cuotasCustom.push({
            numeroCuota: idx + 1,
            montoCuotaUSD: usdVal,
            tasaBcvAplicada: tasaVal,
            semanaOperativaId: !isNaN(semId) && semId > 0 ? semId : (!isNaN(semanaInicioId) ? semanaInicioId : null)
        });
    });

    const btn = document.getElementById('btnGuardarCrearAdelantoSubmit') || document.getElementById('btnGuardarAdelantoSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Registrar Adelanto';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    try {
        const payload = {
            tipoEntidad,
            entidadId,
            montoTotalUSD,
            numeroCuotas,
            tasaBcvInicial: isNaN(tasaBcvInicial) || tasaBcvInicial <= 0 ? null : tasaBcvInicial,
            fechaSolicitud,
            semanaInicioId: isNaN(semanaInicioId) ? null : semanaInicioId,
            observacion,
            cuotasPersonalizadas: cuotasCustom
        };

        const res = await fetch(`${API_BASE}/adelantos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalCrearAdelantoCustom');
            showToast('¡Adelanto registrado exitosamente con plan de cuotas!');
            if (tipoEntidad === 'FINCA') {
                await cargarAdelantosFincas();
            } else if (tipoEntidad === 'COMPANIA') {
                if (typeof cargarAbonosCompanias === 'function') await cargarAbonosCompanias();
            } else {
                await cargarAdelantosReceptoria();
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Error de Registro',
                text: errData.message || 'No se pudo registrar el adelanto.',
                background: '#1e293b',
                color: '#fff'
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Servidor',
            text: err.message,
            background: '#1e293b',
            color: '#fff'
        });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}
window.guardarCrearAdelantoSubmit = guardarCrearAdelantoSubmit;

// ==========================================================================
// REESTRUCTURACIÓN DE CUOTAS PENDIENTES SOBRE SALDO RESTANTE
// ==========================================================================
var _currentAdelantoReestructurar = null;

async function abrirModalReestructurarCuotas(adelantoId) {
    let adelanto = null;
    if (state.adelantosFincas) {
        adelanto = state.adelantosFincas.find(a => (a.id || a.Id) === adelantoId);
    }
    if (!adelanto && state.adelantosReceptoria) {
        adelanto = state.adelantosReceptoria.find(a => (a.id || a.Id) === adelantoId);
    }
    if (!adelanto) {
        try {
            const res = await fetch(`${API_BASE}/adelantos/${adelantoId}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) adelanto = await res.json();
        } catch (e) {
            console.warn(e);
        }
    }
    if (!adelanto) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la información del adelanto.', background: '#1e293b', color: '#fff' });
        return;
    }

    _currentAdelantoReestructurar = adelanto;

    const id = adelanto.id || adelanto.Id;
    const montoTotal = adelanto.montoTotalUSD || adelanto.MontoTotalUSD || 0;
    const montoPagado = adelanto.montoPagadoUSD || adelanto.MontoPagadoUSD || 0;
    const montoPendiente = adelanto.montoPendienteUSD || adelanto.MontoPendienteUSD || (montoTotal - montoPagado);
    const cuotas = adelanto.cuotas || adelanto.Cuotas || [];

    document.getElementById('modalReestructurarAdelantoId').value = id;
    document.getElementById('lblReestructurarMontoTotal').innerText = `$ ${formatearNumero(montoTotal, 2)}`;
    document.getElementById('lblReestructurarMontoPagado').innerText = `$ ${formatearNumero(montoPagado, 2)}`;
    document.getElementById('lblReestructurarMontoPendiente').innerText = `$ ${formatearNumero(montoPendiente, 2)}`;

    const cuotasCobradas = cuotas.filter(c => (c.estado || c.Estado) === 'COBRADO');
    const cuotasPendientesCount = Math.max(1, (cuotas.length - cuotasCobradas.length));

    document.getElementById('modalReestructurarNumCuotas').value = cuotasPendientesCount;
    document.getElementById('modalReestructurarTasaBcv').value = state.tasaBcv > 0 ? state.tasaBcv : 791.3248;

    calcularReestructuracionPreview();
    abrirModalCustom('modalReestructurarCuotasCustom');
}
window.abrirModalReestructurarCuotas = abrirModalReestructurarCuotas;

function calcularReestructuracionPreview() {
    if (!_currentAdelantoReestructurar) return;
    const adelanto = _currentAdelantoReestructurar;
    const montoTotal = adelanto.montoTotalUSD || adelanto.MontoTotalUSD || 0;
    const montoPagado = adelanto.montoPagadoUSD || adelanto.MontoPagadoUSD || 0;
    const montoPendiente = adelanto.montoPendienteUSD || adelanto.MontoPendienteUSD || (montoTotal - montoPagado);
    const cuotas = adelanto.cuotas || adelanto.Cuotas || [];
    const cuotasCobradas = cuotas.filter(c => (c.estado || c.Estado) === 'COBRADO');

    const numPendientes = parseInt(document.getElementById('modalReestructurarNumCuotas')?.value, 10) || 1;
    const tasaBCV = parseFloat(document.getElementById('modalReestructurarTasaBcv')?.value) || (state.tasaBcv > 0 ? state.tasaBcv : 791.3248);
    const box = document.getElementById('boxReestructurarCuotasPreview');

    if (montoPendiente <= 0) {
        if (box) box.innerHTML = `<div style="padding: 12px; color: #16a34a; font-weight: 700; text-align: center;">Este adelanto ya fue completamente pagado. No hay saldo pendiente por reestructurar.</div>`;
        return;
    }

    const cuotaUsdBase = Math.round((montoPendiente / numPendientes) * 100) / 100;

    let html = '<div style="display: flex; flex-direction: column; gap: 6px;">';

    cuotasCobradas.forEach((c, idx) => {
        const numC = c.numeroCuota || c.NumeroCuota || (idx + 1);
        const mUsd = c.montoCuotaUSD || c.MontoCuotaUSD || 0;
        const mBs = c.montoCobradoBs || c.MontoCobradoBs || 0;
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #f1f5f9; border-radius: 6px; border: 1px solid #cbd5e1; opacity: 0.85;">
                <span style="font-size: 12px; font-weight: 700; color: #475569;">Cuota ${numC} <span class="badge badge-success" style="font-size: 10px; margin-left: 4px;">COBRADA</span>:</span>
                <span style="font-size: 12.5px; font-weight: 800; color: #047857;">$${formatearNumero(mUsd, 2)}</span>
                <span style="font-size: 12px; font-weight: 700; color: #64748b;">Bs. ${formatearNumero(mBs, 2)} (Fijo)</span>
            </div>`;
    });

    const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => (a.id || a.Id) - (b.id || b.Id));
    let lastSemId = 0;
    cuotasCobradas.forEach(c => {
        const sId = c.semanaOperativaId || c.SemanaOperativaId;
        if (sId && sId > lastSemId) lastSemId = sId;
    });
    let reestStartIdx = -1;
    if (lastSemId > 0) {
        const idx = semanasOrdenadas.findIndex(s => (s.id || s.Id) == lastSemId);
        if (idx >= 0) reestStartIdx = idx + 1;
    }
    if (reestStartIdx < 0 && state.cicloActivo) {
        reestStartIdx = semanasOrdenadas.findIndex(s => (s.id || s.Id) == state.cicloActivo.id);
    }
    if (reestStartIdx < 0) reestStartIdx = 0;

    for (let i = 1; i <= numPendientes; i++) {
        const numCuotaFutura = cuotasCobradas.length + i;
        const valCuota = (i === numPendientes) ? Math.round((montoPendiente - (cuotaUsdBase * (numPendientes - 1))) * 100) / 100 : cuotaUsdBase;
        const valBs = Math.round(valCuota * tasaBCV * 100) / 100;

        const targetSemIdx = Math.min(reestStartIdx + (i - 1), Math.max(0, semanasOrdenadas.length - 1));
        const targetSemanaId = semanasOrdenadas[targetSemIdx] ? (semanasOrdenadas[targetSemIdx].id || semanasOrdenadas[targetSemIdx].Id) : null;

        const semSelectOptions = semanasOrdenadas.map(s => {
            const sId = s.id || s.Id;
            const isSel = sId === targetSemanaId ? 'selected' : '';
            return `<option value="${sId}" ${isSel}>${formatearTextoSemana(s)}</option>`;
        }).join('');

        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 10px; background: #ffffff; border-radius: 6px; border: 1px solid #93c5fd;">
                <span style="font-size: 12px; font-weight: 700; color: #1d4ed8; min-width: 65px;">Cuota ${numCuotaFutura}:</span>
                <select class="input-reest-semana" data-index="${i}" title="Semana operativa para cobrar esta cuota" style="height: 32px; padding: 2px 6px; font-size: 11px; font-weight: 700; color: #1e40af; background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 4px; max-width: 165px;">
                    ${semSelectOptions}
                </select>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <span style="font-size: 12px; font-weight: 700; color: #0f172a;">$</span>
                    <input type="number" step="0.01" min="0" value="${valCuota.toFixed(2)}" class="input-reest-usd" data-index="${i}" oninput="actualizarBsFilaReest(this)" style="width: 80px; height: 32px; padding: 2px 6px; font-size: 12.5px; font-weight: 700; color: #047857; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px;">
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <span style="font-size: 11px; font-weight: 600; color: #64748b;">Tasa:</span>
                    <input type="number" step="0.0001" min="0.0001" value="${tasaBCV}" class="input-reest-tasa" data-index="${i}" oninput="actualizarBsFilaReest(this)" style="width: 85px; height: 32px; padding: 2px 6px; font-size: 12px; font-weight: 700; color: #b45309; background: #fefce8; border: 1px solid #fde047; border-radius: 4px;">
                </div>
                <span class="span-reest-bs" style="font-size: 11.5px; font-weight: 700; color: #b45309; min-width: 95px; text-align: right;">Bs. ${formatearNumero(valBs, 2)}</span>
            </div>`;
    }

    html += '</div>';
    if (box) box.innerHTML = html;
    actualizarSumaReestructuracion();
}
window.calcularReestructuracionPreview = calcularReestructuracionPreview;

function actualizarBsFilaReest(inputEl) {
    const parent = inputEl.closest('div[style*="display: flex"]');
    if (!parent) return;
    const usdInput = parent.querySelector('.input-reest-usd');
    const tasaInput = parent.querySelector('.input-reest-tasa');
    const spanBs = parent.querySelector('.span-reest-bs');
    
    const valUsd = parseFloat(usdInput?.value) || 0;
    const valTasa = parseFloat(tasaInput?.value) || 0;
    const valBs = valUsd * valTasa;
    if (spanBs) spanBs.innerText = `Bs. ${formatearNumero(valBs, 2)}`;
    actualizarSumaReestructuracion();
}
window.actualizarBsFilaReest = actualizarBsFilaReest;

function actualizarSumaReestructuracion() {
    const inputsUsd = document.querySelectorAll('.input-reest-usd');
    let sumaPendiente = 0;
    inputsUsd.forEach(inp => {
        sumaPendiente += parseFloat(inp.value) || 0;
    });

    const adelanto = _currentAdelantoReestructurar;
    const montoTotal = adelanto?.montoTotalUSD || adelanto?.MontoTotalUSD || 0;
    const montoPagado = adelanto?.montoPagadoUSD || adelanto?.MontoPagadoUSD || 0;
    const montoPendienteReq = adelanto?.montoPendienteUSD || adelanto?.MontoPendienteUSD || (montoTotal - montoPagado);

    const badge = document.getElementById('lblReestructurarSumaBadge');
    if (badge) {
        const diff = Math.abs(sumaPendiente - montoPendienteReq);
        if (diff > 0.01) {
            badge.style.background = '#fff7ed';
            badge.style.color = '#c2410c';
            badge.style.borderColor = '#ffedd5';
            badge.innerText = `Suma Pendientes: $${formatearNumero(sumaPendiente, 2)} (Req: $${formatearNumero(montoPendienteReq, 2)})`;
        } else {
            badge.style.background = '#f0fdf4';
            badge.style.color = '#16a34a';
            badge.style.borderColor = '#86efac';
            badge.innerText = `Suma Pendientes Correcta: $${formatearNumero(sumaPendiente, 2)}`;
        }
    }
}
window.actualizarSumaReestructuracion = actualizarSumaReestructuracion;

async function guardarReestructuracionSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const adelantoId = parseInt(document.getElementById('modalReestructurarAdelantoId')?.value, 10);
    if (!adelantoId || isNaN(adelantoId)) return;

    const usdInputs = document.querySelectorAll('.input-reest-usd');
    const tasaInputs = document.querySelectorAll('.input-reest-tasa');
    const semanaSelects = document.querySelectorAll('.input-reest-semana');

    const nuevasCuotas = [];
    usdInputs.forEach((inp, idx) => {
        const valUsd = parseFloat(inp.value) || 0;
        const valTasa = parseFloat(tasaInputs[idx]?.value) || state.tasaBcv;
        const semId = parseInt(semanaSelects[idx]?.value, 10);
        nuevasCuotas.push({
            numeroCuota: idx + 1,
            montoCuotaUSD: valUsd,
            tasaBcvAplicada: valTasa,
            semanaOperativaId: !isNaN(semId) && semId > 0 ? semId : null
        });
    });

    if (nuevasCuotas.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Atención', text: 'Debes definir al menos 1 cuota pendiente.', background: '#1e293b', color: '#fff' });
        return;
    }

    const btn = document.getElementById('btnGuardarReestructurarSubmit');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/adelantos/${adelantoId}/reestructurar-cuotas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ nuevasCuotasPendientes: nuevasCuotas })
        });

        if (res.ok) {
            cerrarModalCustom('modalReestructurarCuotasCustom');
            showToast('¡Plan de cuotas pendientes reestructurado con éxito!');
            const tEnt = _currentAdelantoReestructurar ? (_currentAdelantoReestructurar.tipoEntidad || _currentAdelantoReestructurar.TipoEntidad) : '';
            if (tEnt === 'FINCA') {
                await cargarAdelantosFincas();
            } else if (tEnt === 'COMPANIA') {
                if (typeof cargarAbonosCompanias === 'function') await cargarAbonosCompanias();
            } else {
                await cargarAdelantosReceptoria();
            }
        } else {
            const err = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'No se pudo reestructurar el plan de cuotas.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        console.error('Error reestructurando cuotas:', err);
    } finally {
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Aplicar Reestructuración';
            btn.disabled = false;
        }
    }
}
window.guardarReestructuracionSubmit = guardarReestructuracionSubmit;

// ==========================================================================
// EDICIÓN INDIVIDUAL Y POSPOSICIÓN DE CUOTAS
// ==========================================================================
async function abrirModalEditarCuota(cuotaId, adelantoId) {
    const list = [...(adelantosFincasData || []), ...(adelantosCompaniasData || []), ...(adelantosReceptoriaData || [])];
    const adelanto = list.find(a => (a.id || a.Id) == adelantoId);
    if (!adelanto) return;

    const cuota = (adelanto.cuotas || adelanto.Cuotas || []).find(c => (c.id || c.Id) == cuotaId);
    if (!cuota) return;

    document.getElementById('modalEditCuotaId').value = cuotaId;
    document.getElementById('modalEditCuotaAdelantoId').value = adelantoId;

    const montoUsd = cuota.montoCobradoUSD > 0 ? cuota.montoCobradoUSD : (cuota.montoCuotaUSD || cuota.MontoCuotaUSD || 0);
    const tasaBcv = cuota.tasaBcvAplicada > 0 ? cuota.tasaBcvAplicada : (state.tasaBcv || 791.3248);
    const montoBs = cuota.montoCobradoBs > 0 ? cuota.montoCobradoBs : (montoUsd * tasaBcv);

    document.getElementById('modalEditCuotaMontoUSD').value = montoUsd;
    document.getElementById('modalEditCuotaTasaBcv').value = tasaBcv;
    document.getElementById('modalEditCuotaMontoBs').value = montoBs.toFixed(2);
    document.getElementById('modalEditCuotaEstado').value = cuota.estado || cuota.Estado || 'PENDIENTE';
    document.getElementById('modalEditCuotaObservacion').value = cuota.observacion || cuota.Observacion || '';

    // Poblar Selector de Semana de Cobro
    const selSemana = document.getElementById('modalEditCuotaSemanaOperativa');
    if (selSemana) {
        let semanas = state.semanas || state.ciclos || [];
        if (!semanas.length) {
            try {
                const res = await fetch(`${API_BASE}/ciclos`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
                if (res.ok) {
                    semanas = await res.json();
                    state.semanas = semanas;
                }
            } catch (e) {
                console.error('Error cargando semanas para edición de cuota:', e);
            }
        }
        const cicloActivo = (semanas || []).find(s => s.esActivo || s.EsActivo) || state.cicloActivo;
        const idCicloActivo = cicloActivo ? (cicloActivo.id || cicloActivo.Id) : 0;
        const currentSemanaId = cuota.semanaOperativaId || cuota.SemanaOperativaId || adelanto.semanaInicioId || adelanto.SemanaInicioId;

        // Filtrar únicamente ciclos vigentes y futuros (del ciclo actual en adelante), orden ascendente
        const semanasFuturas = (semanas || [])
            .filter(s => {
                const sId = s.id || s.Id;
                return sId >= idCicloActivo || (currentSemanaId && sId == currentSemanaId);
            })
            .sort((a, b) => (a.id || a.Id) - (b.id || b.Id));

        selSemana.innerHTML = semanasFuturas.map(s => {
            const sId = s.id || s.Id;
            const texto = formatearTextoSemana(s);
            const isSelected = (currentSemanaId && currentSemanaId == sId);
            const esAct = (s.esActivo || s.EsActivo || sId === idCicloActivo);
            return `<option value="${sId}" ${isSelected ? 'selected' : ''}>${texto}${esAct ? ' ★ [CICLO ACTIVO]' : ''}</option>`;
        }).join('');

        if (currentSemanaId) {
            selSemana.value = currentSemanaId;
        }
    }

    const title = document.getElementById('modalEditarCuotaTitle');
    if (title) title.innerText = `Ajustar Cuota #${cuota.numeroCuota || cuota.NumeroCuota} - ${adelanto.entidadNombre || adelanto.EntidadNombre}`;

    const subtitle = document.getElementById('modalEditarCuotaSubtitle');
    if (subtitle) subtitle.innerText = `Adelanto #${adelanto.id || adelanto.Id} • Cuota ${cuota.numeroCuota || cuota.NumeroCuota} de ${adelanto.numeroCuotas || adelanto.NumeroCuotas || 1}`;

    abrirModalCustom('modalEditarCuotaAdelantoCustom');
}
window.abrirModalEditarCuota = abrirModalEditarCuota;

function recalcularMontoCuotaBs() {
    const usd = parseFloat(document.getElementById('modalEditCuotaMontoUSD')?.value) || 0;
    const tasa = parseFloat(document.getElementById('modalEditCuotaTasaBcv')?.value) || (state.tasaBcv || 791.3248);
    const inputBs = document.getElementById('modalEditCuotaMontoBs');

    if (inputBs) {
        inputBs.value = (usd * tasa).toFixed(2);
    }
}
window.recalcularMontoCuotaBs = recalcularMontoCuotaBs;

async function guardarEditarCuotaSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const cuotaId = parseInt(document.getElementById('modalEditCuotaId')?.value, 10);
    const montoCobradoUSD = parseFloat(document.getElementById('modalEditCuotaMontoUSD')?.value);
    const tasaBcvAplicada = parseFloat(document.getElementById('modalEditCuotaTasaBcv')?.value);
    const montoCobradoBs = parseFloat(document.getElementById('modalEditCuotaMontoBs')?.value);
    const selSemana = document.getElementById('modalEditCuotaSemanaOperativa');
    const semanaOperativaId = selSemana && selSemana.value ? parseInt(selSemana.value, 10) : null;
    const estado = document.getElementById('modalEditCuotaEstado')?.value;
    const observacion = (document.getElementById('modalEditCuotaObservacion')?.value || '').trim();

    if (isNaN(cuotaId) || cuotaId <= 0) return;

    const btn = document.getElementById('btnGuardarEditCuotaSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Guardar';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; btn.disabled = true; }

    try {
        const payload = {
            montoCuotaUSD: montoCobradoUSD,
            montoCobradoUSD,
            tasaBcvAplicada,
            montoCobradoBs,
            semanaOperativaId: semanaOperativaId && !isNaN(semanaOperativaId) ? semanaOperativaId : null,
            estado,
            observacion
        };

        const res = await fetch(`${API_BASE}/adelantos/cuotas/${cuotaId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalEditarCuotaAdelantoCustom');
            showToast('Cuota y semana de cobro actualizadas exitosamente.');
            if (typeof cargarAdelantosFincas === 'function') await cargarAdelantosFincas();
            if (typeof cargarAbonosCompanias === 'function') await cargarAbonosCompanias();
            if (typeof cargarAdelantosReceptoria === 'function') await cargarAdelantosReceptoria();
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Actualizar', text: errData.message || 'No se pudo actualizar la cuota.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
    }
}
window.guardarEditarCuotaSubmit = guardarEditarCuotaSubmit;

function abrirModalPosponerCuota(cuotaId) {
    document.getElementById('modalPosponerCuotaId').value = cuotaId;
    document.getElementById('modalPosponerMotivo').value = '';

    // Buscar la cuota y su adelanto
    const allAdelantos = [
        ...(typeof adelantosFincasData !== 'undefined' ? adelantosFincasData : []),
        ...(typeof adelantosCompaniasData !== 'undefined' ? adelantosCompaniasData : []),
        ...(typeof adelantosReceptoriaData !== 'undefined' ? adelantosReceptoriaData : [])
    ];

    let foundCuota = null;
    let foundAdelanto = null;
    for (const ad of allAdelantos) {
        const cuotas = ad.cuotas || ad.Cuotas || [];
        const c = cuotas.find(item => (item.id || item.Id) === cuotaId);
        if (c) {
            foundCuota = c;
            foundAdelanto = ad;
            break;
        }
    }

    const lblInfo = document.getElementById('lblPosponerCuotaInfo');
    const lblActual = document.getElementById('lblPosponerSemanaActual');
    const selectDestino = document.getElementById('modalPosponerSemanaDestino');

    const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => (a.id || a.Id) - (b.id || b.Id));

    let currentSemId = null;
    if (foundCuota) {
        currentSemId = foundCuota.semanaOperativaId || foundCuota.SemanaOperativaId;
        const numC = foundCuota.numeroCuota || foundCuota.NumeroCuota || 1;
        const mUSD = foundCuota.montoCuotaUSD || foundCuota.MontoCuotaUSD || 0;
        if (lblInfo) lblInfo.innerText = `Cuota #${numC} - ($ ${formatearNumero(mUSD, 2)})`;
    } else {
        if (lblInfo) lblInfo.innerText = `Cuota #${cuotaId}`;
    }

    if (!currentSemId && foundAdelanto) {
        currentSemId = foundAdelanto.semanaOperativaId || foundAdelanto.SemanaOperativaId;
    }
    if (!currentSemId && state.cicloActivo) {
        currentSemId = state.cicloActivo.id;
    }

    const currentSem = semanasOrdenadas.find(s => (s.id || s.Id) == currentSemId);
    if (lblActual) {
        lblActual.innerText = currentSem ? (currentSem.codigo || currentSem.Codigo || `Semana #${currentSemId}`) : `Semana #${currentSemId || 'N/A'}`;
    }

    // Determinar siguiente ciclo de forma automática:
    // Buscamos el mayor SemanaOperativaId entre todas las cuotas activas/pendientes de este adelanto
    let maxSemanaIdAdelanto = currentSemId || 0;
    if (foundAdelanto) {
        const cuotas = foundAdelanto.cuotas || foundAdelanto.Cuotas || [];
        cuotas.forEach(c => {
            const sId = c.semanaOperativaId || c.SemanaOperativaId;
            const st = (c.estado || c.Estado || '').toUpperCase();
            if (sId && st !== 'POSPUESTO' && st !== 'ANULADA' && sId > maxSemanaIdAdelanto) {
                maxSemanaIdAdelanto = sId;
            }
        });
    }

    const nextSemanaAuto = semanasOrdenadas.find(s => (s.id || s.Id) > maxSemanaIdAdelanto)
        || semanasOrdenadas.find(s => (s.id || s.Id) > currentSemId)
        || semanasOrdenadas[semanasOrdenadas.length - 1];

    if (selectDestino) {
        const cicloActivo = (semanasOrdenadas || []).find(s => s.esActivo || s.EsActivo) || state.cicloActivo;
        const idCicloActivo = cicloActivo ? (cicloActivo.id || cicloActivo.Id) : 0;
        const semanasDisponibles = semanasOrdenadas.filter(s => (s.id || s.Id) > (currentSemId || 0) || (s.id || s.Id) >= idCicloActivo);

        selectDestino.innerHTML = semanasDisponibles.map(s => {
            const sId = s.id || s.Id;
            const isAuto = nextSemanaAuto && (nextSemanaAuto.id || nextSemanaAuto.Id) === sId;
            return `<option value="${sId}" ${isAuto ? 'selected' : ''}>${formatearTextoSemana(s)} ${isAuto ? '★ (Siguiente disponible)' : ''}</option>`;
        }).join('');
    }

    abrirModalCustom('modalPosponerCuotaCustom');
}
window.abrirModalPosponerCuota = abrirModalPosponerCuota;

async function guardarPosponerCuotaSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const cuotaId = parseInt(document.getElementById('modalPosponerCuotaId')?.value, 10);
    const motivo = (document.getElementById('modalPosponerMotivo')?.value || '').trim();
    const selDestino = document.getElementById('modalPosponerSemanaDestino');
    const semanaOperativaIdDestino = selDestino && selDestino.value ? parseInt(selDestino.value, 10) : null;

    if (isNaN(cuotaId) || cuotaId <= 0) return;

    const btn = document.getElementById('btnGuardarPosponerCuotaSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Confirmar Posposición';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posponiendo...'; btn.disabled = true; }

    try {
        const payload = {
            motivo: motivo,
            semanaOperativaIdDestino: semanaOperativaIdDestino && !isNaN(semanaOperativaIdDestino) ? semanaOperativaIdDestino : null
        };

        const res = await fetch(`${API_BASE}/adelantos/cuotas/${cuotaId}/posponer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalPosponerCuotaCustom');
            showToast('Cuota pospuesta y reprogramada al siguiente ciclo exitosamente.');
            if (typeof cargarAdelantosFincas === 'function') await cargarAdelantosFincas();
            if (typeof cargarAbonosCompanias === 'function') await cargarAbonosCompanias();
            if (typeof cargarAdelantosReceptoria === 'function') await cargarAdelantosReceptoria();
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Posponer', text: errData.message || 'No se pudo posponer la cuota.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
    }
}
window.guardarPosponerCuotaSubmit = guardarPosponerCuotaSubmit;

// ==========================================
// ACTUALIZACIÓN GLOBAL DE VALOR DÓLAR (TASA BCV) EN ADELANTOS ACTIVOS
// ==========================================
let _adelantosActivosParaActualizarTasa = [];

async function abrirModalActualizarValorDolarAdelantos(tipoEntidad = 'FINCA') {
    tipoEntidad = (tipoEntidad || 'FINCA').toUpperCase();
    const inputTipo = document.getElementById('adelantosTipoEntidadTasa');
    if (inputTipo) inputTipo.value = tipoEntidad;

    let lista = [];
    if (tipoEntidad === 'FINCA') lista = adelantosFincasData || [];
    else if (tipoEntidad === 'COMPANIA') lista = adelantosCompaniasData || [];
    else if (tipoEntidad === 'RECEPTORIA') lista = adelantosReceptoriaData || [];

    if (!lista || lista.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/adelantos?tipoEntidad=${tipoEntidad}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) {
                lista = await res.json();
                if (tipoEntidad === 'FINCA') adelantosFincasData = lista;
                else if (tipoEntidad === 'COMPANIA') adelantosCompaniasData = lista;
                else if (tipoEntidad === 'RECEPTORIA') adelantosReceptoriaData = lista;
            }
        } catch (e) {
            console.error('Error al precargar adelantos para actualización de tasa:', e);
        }
    }

    _adelantosActivosParaActualizarTasa = (lista || []).filter(a => {
        const pend = a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0;
        const st = (a.estado || a.Estado || '').toUpperCase();
        return pend > 0 && st !== 'PAGADO' && st !== 'ANULADO';
    });

    const cantActivos = _adelantosActivosParaActualizarTasa.length;
    const totalPendienteUSD = _adelantosActivosParaActualizarTasa.reduce((acc, a) => {
        return acc + (a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0);
    }, 0);

    const elCant = document.getElementById('resumenCantAdelantosActivos');
    const elPend = document.getElementById('resumenTotalPendienteUSD');
    const inputTasa = document.getElementById('inputNuevoValorDolarAdelantos');

    if (elCant) elCant.innerText = `${cantActivos} ${tipoEntidad === 'FINCA' ? 'Finca(s)' : 'Entidad(es)'}`;
    if (elPend) elPend.innerText = `$ ${formatearNumero(totalPendienteUSD, 2)}`;

    const tasaActual = state.tasaBcv || state.tasaDolar || 791.3248;
    if (inputTasa) {
        inputTasa.value = tasaActual > 0 ? tasaActual : '';
    }

    recalcularPrevisualizacionValorDolar();
    abrirModalCustom('modalActualizarValorDolarAdelantos');
}
window.abrirModalActualizarValorDolarAdelantos = abrirModalActualizarValorDolarAdelantos;

function recalcularPrevisualizacionValorDolar() {
    const inputTasa = document.getElementById('inputNuevoValorDolarAdelantos');
    const previewEl = document.getElementById('previewTotalPendienteBs');
    if (!previewEl) return;

    const nuevaTasa = parseFloat(inputTasa?.value) || 0;
    const totalPendienteUSD = (_adelantosActivosParaActualizarTasa || []).reduce((acc, a) => {
        return acc + (a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0);
    }, 0);

    const totalPendienteBs = totalPendienteUSD * nuevaTasa;
    previewEl.innerText = `Bs. ${formatearNumero(totalPendienteBs, 2)}`;
}
window.recalcularPrevisualizacionValorDolar = recalcularPrevisualizacionValorDolar;

async function guardarActualizarValorDolarAdelantos(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const inputTipo = document.getElementById('adelantosTipoEntidadTasa');
    const tipoEntidad = (inputTipo?.value || 'FINCA').toUpperCase();
    const inputTasa = document.getElementById('inputNuevoValorDolarAdelantos');
    const nuevaTasa = parseFloat(inputTasa?.value);

    if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Tasa Inválida',
            text: 'Por favor ingrese un valor de dólar / Tasa BCV mayor a 0.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    const cantActivos = (_adelantosActivosParaActualizarTasa || []).length;
    if (cantActivos === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin Adelantos Activos',
            text: `No hay adelantos activos de ${tipoEntidad.toLowerCase()} pendientes por actualizar.`,
            background: '#1e293b',
            color: '#fff'
        });
        cerrarModalCustom('modalActualizarValorDolarAdelantos');
        return;
    }

    const confirm = await Swal.fire({
        title: '¿Confirmar Actualización de Valor Dólar?',
        html: `
            <div style="text-align: left; font-size: 13.5px; color: #cbd5e1; line-height: 1.6;">
                <p>Se actualizará el valor del dólar a <strong>Bs. ${nuevaTasa.toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong> en:</p>
                <div style="background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(2, 132, 199, 0.4); border-radius: 8px; padding: 10px 14px; margin: 12px 0;">
                    <div style="color: #38bdf8; font-weight: 700;">🎯 Destino: ${cantActivos} Adelanto(s) Activo(s) de ${tipoEntidad}</div>
                    <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Las cuotas y saldos pendientes se recalcularán con esta tasa. Las cuotas históricas ya cobradas se conservan intactas.</div>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check"></i> Sí, Actualizar Todos',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) return;

    const btn = document.getElementById('btnConfirmarActualizarValorDolarAdelantos');
    let oldHtml = '';
    if (btn) {
        oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/adelantos/actualizar-tasa-activos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                tipoEntidad: tipoEntidad,
                tasaBcv: nuevaTasa
            })
        });

        if (res.ok) {
            const data = await res.json();
            cerrarModalCustom('modalActualizarValorDolarAdelantos');
            Swal.fire({
                icon: 'success',
                title: '¡Valor Dólar Actualizado!',
                text: data.mensaje || `Se actualizó la tasa a Bs. ${nuevaTasa.toFixed(4)} exitosamente.`,
                background: '#1e293b',
                color: '#fff',
                timer: 3000,
                showConfirmButton: false
            });

            if (tipoEntidad === 'FINCA' && typeof cargarAdelantosFincas === 'function') {
                await cargarAdelantosFincas();
            } else if (tipoEntidad === 'COMPANIA' && typeof cargarAbonosCompanias === 'function') {
                await cargarAbonosCompanias();
            } else if (tipoEntidad === 'RECEPTORIA' && typeof cargarAdelantosReceptoria === 'function') {
                await cargarAdelantosReceptoria();
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Error al Actualizar Tasa',
                text: errData.message || 'No se pudo actualizar la tasa de los adelantos.',
                background: '#1e293b',
                color: '#fff'
            });
        }
    } catch (err) {
        console.error('Error al actualizar tasa de adelantos activos:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Red',
            text: err.message,
            background: '#1e293b',
            color: '#fff'
        });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}
window.guardarActualizarValorDolarAdelantos = guardarActualizarValorDolarAdelantos;

// ==========================================
// TICKET / DETALLE Y DEDUCCIÓN PARCIAL DE ADELANTOS
// ==========================================

async function abrirModalTicketAdelantoFinca(fincaId, nombreFinca, valorActualUSD) {
    const modal = document.getElementById('modalTicketAdelantoFincaCustom');
    if (!modal) return;

    // Resetear campos
    document.getElementById('ticketAdelantoFincaId').value = fincaId;
    document.getElementById('ticketAdelantoCuotaId').value = '';
    document.getElementById('ticketAdelantoMontoOriginalUSD').value = valorActualUSD || 0;
    
    // Obtener datos del reporte actual
    let propFinca = '';
    let tasaBCV = state.tasaBcv || 820.1018;
    let fechaDesde = '';
    let fechaHasta = '';

    if (window.ultimosDatosReporteFincas) {
        fechaDesde = window.ultimosDatosReporteFincas.fechaDesde;
        fechaHasta = window.ultimosDatosReporteFincas.fechaHasta;
        const fObj = (window.ultimosDatosReporteFincas.data || []).find(f => (f.id || f.Id) == fincaId);
        if (fObj) {
            propFinca = fObj.propietario || fObj.Propietario || '';
            tasaBCV = fObj.tasaBcv || tasaBCV;
        }
    }

    document.getElementById('ticketAdelantoTasaBCV').value = tasaBCV;
    document.getElementById('ticketFincaNombre').innerText = (nombreFinca || 'FINCA').toUpperCase();
    document.getElementById('ticketPropietario').innerText = propFinca ? `Propietario: ${propFinca}` : '';
    document.getElementById('ticketTasaBcv').innerText = `Bs. ${formatearNumero(tasaBCV, 4)}`;
    
    // Ciclo actual
    const cicloActualTxt = state.cicloActivo 
        ? formatearTextoSemana(state.cicloActivo)
        : (fechaDesde && fechaHasta ? `Periodo: ${fechaDesde} al ${fechaHasta}` : 'Semana de Liquidación');
    document.getElementById('ticketCicloActual').innerText = cicloActualTxt;

    // Poblar select de ciclos destino
    const selDestino = document.getElementById('ticketSelectSemanaDestino');
    const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => (a.id || a.Id) - (b.id || b.Id));
    
    let currentCicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : 0;
    if (!currentCicloId && semanasOrdenadas.length > 0) {
        const matchSem = semanasOrdenadas.find(s => {
            const fI = (s.fechaInicio || s.FechaInicio || '').split('T')[0];
            const fF = (s.fechaFin || s.FechaFin || '').split('T')[0];
            return fechaDesde >= fI && fechaDesde <= fF;
        });
        if (matchSem) currentCicloId = matchSem.id || matchSem.Id;
    }

    const nextSemanaAuto = semanasOrdenadas.find(s => (s.id || s.Id) > currentCicloId) || semanasOrdenadas[semanasOrdenadas.length - 1];

    if (selDestino) {
        selDestino.innerHTML = semanasOrdenadas.map(s => {
            const sId = s.id || s.Id;
            const isAuto = nextSemanaAuto && (nextSemanaAuto.id || nextSemanaAuto.Id) === sId;
            return `<option value="${sId}" ${isAuto ? 'selected' : ''}>${formatearTextoSemana(s)} ${isAuto ? '★ (Siguiente disponible)' : ''}</option>`;
        }).join('');
    }

    // Inicializar UI previa
    document.getElementById('ticketBadgeId').innerText = `Cargando...`;
    document.getElementById('ticketCuotaBadge').innerText = `Buscando cuota...`;
    document.getElementById('ticketMontoProgramadoUSD').innerText = `$ ${formatearNumero(valorActualUSD, 2)}`;
    document.getElementById('ticketMontoProgramadoBs').innerText = `Bs. ${formatearNumero(valorActualUSD * tasaBCV, 2)}`;
    document.getElementById('ticketInputMontoDescontar').value = valorActualUSD || '';
    document.getElementById('ticketInputMotivo').value = '';

    abrirModalCustom('modalTicketAdelantoFincaCustom');

    // Consultar API de adelantos para la Finca
    try {
        const resp = await fetch(`${API_BASE}/adelantos?tipoEntidad=FINCA&entidadId=${fincaId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        let cuotaEncontrada = null;
        let adelantoEncontrado = null;

        if (resp.ok) {
            const adelantos = await resp.json();
            if (Array.isArray(adelantos) && adelantos.length > 0) {
                for (const ad of adelantos) {
                    const cuotas = ad.cuotas || ad.Cuotas || [];
                    // 1. Buscar cuota de esta semana
                    let c = cuotas.find(item => {
                        const semId = item.semanaOperativaId || item.SemanaOperativaId;
                        const st = (item.estado || item.Estado || '').toUpperCase();
                        return currentCicloId && semId == currentCicloId && st !== 'ANULADA' && st !== 'POSPUESTO';
                    });
                    // 2. Si no, buscar cuota PENDIENTE
                    if (!c) {
                        c = cuotas.find(item => {
                            const st = (item.estado || item.Estado || '').toUpperCase();
                            return st === 'PENDIENTE';
                        });
                    }
                    if (c) {
                        cuotaEncontrada = c;
                        adelantoEncontrado = ad;
                        break;
                    }
                }
            }
        }

        if (cuotaEncontrada && adelantoEncontrado) {
            const cId = cuotaEncontrada.id || cuotaEncontrada.Id;
            const numCuota = cuotaEncontrada.numeroCuota || cuotaEncontrada.NumeroCuota || 1;
            const totalCuotas = adelantoEncontrado.numeroCuotas || adelantoEncontrado.NumeroCuotas || 1;
            const montoCuotaUSD = cuotaEncontrada.montoCuotaUSD || cuotaEncontrada.MontoCuotaUSD || valorActualUSD;

            document.getElementById('ticketAdelantoCuotaId').value = cId;
            document.getElementById('ticketAdelantoMontoOriginalUSD').value = montoCuotaUSD;
            document.getElementById('ticketBadgeId').innerText = `Adelanto #${adelantoEncontrado.id || adelantoEncontrado.Id}`;
            document.getElementById('ticketCuotaBadge').innerText = `Cuota ${numCuota} de ${totalCuotas}`;
            document.getElementById('ticketMontoProgramadoUSD').innerText = `$ ${formatearNumero(montoCuotaUSD, 2)}`;
            document.getElementById('ticketMontoProgramadoBs').innerText = `Bs. ${formatearNumero(montoCuotaUSD * tasaBCV, 2)}`;

            document.getElementById('ticketInputMontoDescontar').value = valorActualUSD;

            document.getElementById('seccionTicketAccionesDeduccion').style.display = 'block';
            document.getElementById('seccionTicketAjusteManual').style.display = 'none';
            document.getElementById('btnTicketPosponerCuotaCompleta').style.display = 'inline-flex';
            document.getElementById('btnConfirmarTicketDeduccion').style.display = 'inline-flex';
            document.getElementById('btnTicketGuardarManual').style.display = 'none';

            actualizarTicketCalculoRemanente();
        } else {
            // No hay cuota en BD, permitir ajuste manual
            document.getElementById('ticketBadgeId').innerText = `Ajuste Directo`;
            document.getElementById('ticketCuotaBadge').innerText = `Sin plan de cuotas`;
            document.getElementById('seccionTicketAccionesDeduccion').style.display = 'none';
            document.getElementById('seccionTicketAjusteManual').style.display = 'block';
            document.getElementById('ticketInputAjusteManualDirecto').value = valorActualUSD || 0;
            document.getElementById('btnTicketPosponerCuotaCompleta').style.display = 'none';
            document.getElementById('btnConfirmarTicketDeduccion').style.display = 'none';
            document.getElementById('btnTicketGuardarManual').style.display = 'inline-flex';
        }
    } catch (err) {
        console.error('Error al cargar detalle del ticket de adelanto:', err);
    }
}
window.abrirModalTicketAdelantoFinca = abrirModalTicketAdelantoFinca;

function actualizarTicketCalculoRemanente() {
    const montoOriginal = parseFloat(document.getElementById('ticketAdelantoMontoOriginalUSD')?.value) || 0;
    const montoDescontar = parseFloat(document.getElementById('ticketInputMontoDescontar')?.value) || 0;
    const tasaBCV = parseFloat(document.getElementById('ticketAdelantoTasaBCV')?.value) || 1;

    const remanenteUSD = Math.max(0, montoOriginal - montoDescontar);
    const descontarBs = montoDescontar * tasaBCV;
    const remanenteBs = remanenteUSD * tasaBCV;

    const lblDescUSD = document.getElementById('lblTicketDescontarUSD');
    const lblDescBs = document.getElementById('lblTicketDescontarBs');
    const lblRemUSD = document.getElementById('lblTicketRemanenteUSD');
    const lblRemBs = document.getElementById('lblTicketRemanenteBs');
    const btnConfirmar = document.getElementById('btnConfirmarTicketDeduccion');

    if (lblDescUSD) lblDescUSD.innerText = `$ ${formatearNumero(montoDescontar, 2)}`;
    if (lblDescBs) lblDescBs.innerText = `Bs. ${formatearNumero(descontarBs, 2)}`;
    if (lblRemUSD) lblRemUSD.innerText = `$ ${formatearNumero(remanenteUSD, 2)}`;
    if (lblRemBs) lblRemBs.innerText = `Bs. ${formatearNumero(remanenteBs, 2)}`;

    if (btnConfirmar) {
        if (montoDescontar <= 0) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = `<i class="fa-solid fa-ban"></i> Ingrese un monto mayor a 0`;
        } else if (montoDescontar >= montoOriginal) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = `<i class="fa-solid fa-check"></i> Cobrar Cuota Completa ($${formatearNumero(montoOriginal, 2)})`;
        } else {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = `<i class="fa-solid fa-scissors"></i> Descontar $${formatearNumero(montoDescontar, 2)} y Trasladar $${formatearNumero(remanenteUSD, 2)}`;
        }
    }
}
window.actualizarTicketCalculoRemanente = actualizarTicketCalculoRemanente;

async function confirmarTicketDeduccionParcial(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const cuotaId = parseInt(document.getElementById('ticketAdelantoCuotaId')?.value, 10);
    const fincaId = parseInt(document.getElementById('ticketAdelantoFincaId')?.value, 10);
    const montoOriginal = parseFloat(document.getElementById('ticketAdelantoMontoOriginalUSD')?.value) || 0;
    const montoDescontar = parseFloat(document.getElementById('ticketInputMontoDescontar')?.value) || 0;
    const selDestino = document.getElementById('ticketSelectSemanaDestino');
    const semanaDestinoId = selDestino && selDestino.value ? parseInt(selDestino.value, 10) : null;
    const motivo = (document.getElementById('ticketInputMotivo')?.value || '').trim();

    if (montoDescontar <= 0) {
        Swal.fire({ icon: 'warning', title: 'Monto Inválido', text: 'El monto a descontar debe ser mayor a 0.', background: '#1e293b', color: '#fff' });
        return;
    }

    // Si descuenta el total o no hay cuotaId
    if (montoDescontar >= montoOriginal) {
        if (window.adelantosManualesFincasReporte && window.adelantosManualesFincasReporte[fincaId] !== undefined) {
            delete window.adelantosManualesFincasReporte[fincaId];
        }
        cerrarModalCustom('modalTicketAdelantoFincaCustom');
        showToast(`Se mantiene el cobro completo de la cuota ($${formatearNumero(montoOriginal, 2)}).`);
        if (window.ultimosDatosReporteFincas) {
            renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
        }
        return;
    }

    if (isNaN(cuotaId) || cuotaId <= 0) {
        ticketGuardarManualDirecto();
        return;
    }

    const remanente = montoOriginal - montoDescontar;
    const btn = document.getElementById('btnConfirmarTicketDeduccion');
    const oldHtml = btn ? btn.innerHTML : 'Aplicar Deducción Parcial';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...'; btn.disabled = true; }

    try {
        const payload = {
            montoDescontarUSD: montoDescontar,
            semanaOperativaIdDestino: semanaDestinoId,
            motivo: motivo || `Deducción parcial desde liquidación: $${montoDescontar.toFixed(2)} cobrados, $${remanente.toFixed(2)} trasladados`
        };

        const res = await fetch(`${API_BASE}/adelantos/cuotas/${cuotaId}/dividir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalTicketAdelantoFincaCustom');

            if (!window.adelantosManualesFincasReporte) window.adelantosManualesFincasReporte = {};
            window.adelantosManualesFincasReporte[fincaId] = montoDescontar;

            await Swal.fire({
                icon: 'success',
                title: '¡Deducción Parcial Aplicada!',
                html: `
                    <div style="font-size: 14px; text-align: left; color: #cbd5e1;">
                        <p style="margin: 0 0 8px 0;"><strong>Cobro en este ciclo:</strong> <span style="color: #38bdf8;">$ ${formatearNumero(montoDescontar, 2)}</span></p>
                        <p style="margin: 0 0 8px 0;"><strong>Remanente trasladado:</strong> <span style="color: #facc15;">$ ${formatearNumero(remanente, 2)}</span></p>
                        <p style="margin: 0; font-size: 12.5px; color: #94a3b8;">La cuota fue reprogramada automáticamente en el plan de adelantos y la tabla de liquidación ha sido actualizada.</p>
                    </div>
                `,
                confirmButtonColor: '#059669',
                background: '#1e293b',
                color: '#fff'
            });

            if (window.ultimosDatosReporteFincas) {
                const fObj = (window.ultimosDatosReporteFincas.data || []).find(f => (f.id || f.Id) == fincaId);
                if (fObj) {
                    fObj.totalAdelantosUSD = montoDescontar;
                    fObj.totalAdelantosBs = montoDescontar * (fObj.tasaBcv || 1);
                }
                renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
            }
            if (typeof cargarAdelantosFincas === 'function') cargarAdelantosFincas();
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Dividir Cuota', text: errData.message || 'No se pudo aplicar la deducción parcial.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
    }
}
window.confirmarTicketDeduccionParcial = confirmarTicketDeduccionParcial;

async function ticketPosponerCuotaCompleta() {
    const cuotaId = parseInt(document.getElementById('ticketAdelantoCuotaId')?.value, 10);
    const fincaId = parseInt(document.getElementById('ticketAdelantoFincaId')?.value, 10);
    const selDestino = document.getElementById('ticketSelectSemanaDestino');
    const semanaDestinoId = selDestino && selDestino.value ? parseInt(selDestino.value, 10) : null;
    const motivo = (document.getElementById('ticketInputMotivo')?.value || '').trim() || 'Posposición completa solicitada desde liquidación';

    if (isNaN(cuotaId) || cuotaId <= 0) {
        if (!window.adelantosManualesFincasReporte) window.adelantosManualesFincasReporte = {};
        window.adelantosManualesFincasReporte[fincaId] = 0;
        cerrarModalCustom('modalTicketAdelantoFincaCustom');
        showToast('Adelanto pospuesto (0 para este ciclo).');
        if (window.ultimosDatosReporteFincas) {
            renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
        }
        return;
    }

    const confirm = await Swal.fire({
        title: '¿Posponer Cuota Completa?',
        text: 'Esta cuota no se descontará en esta liquidación y se reprogramará completa al siguiente ciclo operativo.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Posponer',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) return;

    try {
        const payload = {
            motivo: motivo,
            semanaOperativaIdDestino: semanaDestinoId
        };

        const res = await fetch(`${API_BASE}/adelantos/cuotas/${cuotaId}/posponer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalTicketAdelantoFincaCustom');

            if (!window.adelantosManualesFincasReporte) window.adelantosManualesFincasReporte = {};
            window.adelantosManualesFincasReporte[fincaId] = 0;

            showToast('Cuota pospuesta y reprogramada al siguiente ciclo.');

            if (window.ultimosDatosReporteFincas) {
                const fObj = (window.ultimosDatosReporteFincas.data || []).find(f => (f.id || f.Id) == fincaId);
                if (fObj) {
                    fObj.totalAdelantosUSD = 0;
                    fObj.totalAdelantosBs = 0;
                }
                renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
            }
            if (typeof cargarAdelantosFincas === 'function') cargarAdelantosFincas();
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Posponer', text: errData.message || 'No se pudo posponer la cuota.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.ticketPosponerCuotaCompleta = ticketPosponerCuotaCompleta;

function ticketGuardarManualDirecto() {
    const fincaId = parseInt(document.getElementById('ticketAdelantoFincaId')?.value, 10);
    const monto = parseFloat(document.getElementById('ticketInputAjusteManualDirecto')?.value) || 0;

    if (!window.adelantosManualesFincasReporte) window.adelantosManualesFincasReporte = {};
    window.adelantosManualesFincasReporte[fincaId] = monto;
    state.mostrarAdelantoReporteFincas = true;
    cerrarModalCustom('modalTicketAdelantoFincaCustom');
    showToast(`Adelanto de la finca actualizado a $${formatearNumero(monto, 2)}.`);

    if (window.ultimosDatosReporteFincas) {
        renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
    }
}
window.ticketGuardarManualDirecto = ticketGuardarManualDirecto;

// ==========================================
// DEDUCCIÓN PARCIAL EN MÓDULO ADELANTOS
// ==========================================

function abrirModalDividirCuota(cuotaId) {
    document.getElementById('modalDividirCuotaId').value = cuotaId;
    document.getElementById('modalDividirMotivo').value = '';

    const allAdelantos = [
        ...(typeof adelantosFincasData !== 'undefined' ? adelantosFincasData : []),
        ...(typeof adelantosCompaniasData !== 'undefined' ? adelantosCompaniasData : []),
        ...(typeof adelantosReceptoriaData !== 'undefined' ? adelantosReceptoriaData : [])
    ];

    let foundCuota = null;
    let foundAdelanto = null;
    for (const ad of allAdelantos) {
        const cuotas = ad.cuotas || ad.Cuotas || [];
        const c = cuotas.find(item => (item.id || item.Id) === cuotaId);
        if (c) {
            foundCuota = c;
            foundAdelanto = ad;
            break;
        }
    }

    const lblInfo = document.getElementById('lblDividirCuotaInfo');
    const lblActual = document.getElementById('lblDividirSemanaActual');
    const selectDestino = document.getElementById('modalDividirSemanaDestino');
    const inputMonto = document.getElementById('modalDividirMontoDescontar');

    const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => (a.id || a.Id) - (b.id || b.Id));

    let currentSemId = null;
    let montoCuota = 0;

    if (foundCuota) {
        currentSemId = foundCuota.semanaOperativaId || foundCuota.SemanaOperativaId;
        const numC = foundCuota.numeroCuota || foundCuota.NumeroCuota || 1;
        montoCuota = foundCuota.montoCuotaUSD || foundCuota.MontoCuotaUSD || 0;
        if (lblInfo) lblInfo.innerText = `Cuota #${numC} - ($ ${formatearNumero(montoCuota, 2)})`;
    } else {
        if (lblInfo) lblInfo.innerText = `Cuota #${cuotaId}`;
    }

    document.getElementById('modalDividirMontoTotalCuota').value = montoCuota;
    if (inputMonto) inputMonto.value = '';

    if (!currentSemId && foundAdelanto) {
        currentSemId = foundAdelanto.semanaOperativaId || foundAdelanto.SemanaOperativaId;
    }
    if (!currentSemId && state.cicloActivo) {
        currentSemId = state.cicloActivo.id;
    }

    const currentSem = semanasOrdenadas.find(s => (s.id || s.Id) == currentSemId);
    if (lblActual) {
        lblActual.innerText = currentSem ? (currentSem.codigo || currentSem.Codigo || `Semana #${currentSemId}`) : `Semana #${currentSemId || 'N/A'}`;
    }

    let maxSemanaIdAdelanto = currentSemId || 0;
    if (foundAdelanto) {
        const cuotas = foundAdelanto.cuotas || foundAdelanto.Cuotas || [];
        cuotas.forEach(c => {
            const sId = c.semanaOperativaId || c.SemanaOperativaId;
            const st = (c.estado || c.Estado || '').toUpperCase();
            if (sId && st !== 'POSPUESTO' && st !== 'ANULADA' && sId > maxSemanaIdAdelanto) {
                maxSemanaIdAdelanto = sId;
            }
        });
    }

    const nextSemanaAuto = semanasOrdenadas.find(s => (s.id || s.Id) > maxSemanaIdAdelanto)
        || semanasOrdenadas.find(s => (s.id || s.Id) > currentSemId)
        || semanasOrdenadas[semanasOrdenadas.length - 1];

    if (selectDestino) {
        selectDestino.innerHTML = semanasOrdenadas.map(s => {
            const sId = s.id || s.Id;
            const isAuto = nextSemanaAuto && (nextSemanaAuto.id || nextSemanaAuto.Id) === sId;
            return `<option value="${sId}" ${isAuto ? 'selected' : ''}>${formatearTextoSemana(s)} ${isAuto ? '★ (Siguiente disponible)' : ''}</option>`;
        }).join('');
    }

    actualizarDividirCalculoRemanente();
    abrirModalCustom('modalDividirCuotaCustom');
}
window.abrirModalDividirCuota = abrirModalDividirCuota;

function actualizarDividirCalculoRemanente() {
    const totalCuota = parseFloat(document.getElementById('modalDividirMontoTotalCuota')?.value) || 0;
    const aDescontar = parseFloat(document.getElementById('modalDividirMontoDescontar')?.value) || 0;
    const remanente = Math.max(0, totalCuota - aDescontar);

    const lblAhora = document.getElementById('lblDividirAhoraUSD');
    const lblRem = document.getElementById('lblDividirRemanenteUSD');
    const btn = document.getElementById('btnGuardarDividirCuotaSubmit');

    if (lblAhora) lblAhora.innerText = `$ ${formatearNumero(aDescontar, 2)}`;
    if (lblRem) lblRem.innerText = `$ ${formatearNumero(remanente, 2)}`;

    if (btn) {
        if (aDescontar <= 0) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-ban"></i> Ingrese un monto mayor a 0`;
        } else if (aDescontar >= totalCuota) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Monto debe ser menor al total ($${formatearNumero(totalCuota, 2)})`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Descontar $${formatearNumero(aDescontar, 2)} y Trasladar $${formatearNumero(remanente, 2)}`;
        }
    }
}
window.actualizarDividirCalculoRemanente = actualizarDividirCalculoRemanente;

async function guardarDividirCuotaSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const cuotaId = parseInt(document.getElementById('modalDividirCuotaId')?.value, 10);
    const montoTotal = parseFloat(document.getElementById('modalDividirMontoTotalCuota')?.value) || 0;
    const montoDescontar = parseFloat(document.getElementById('modalDividirMontoDescontar')?.value) || 0;
    const motivo = (document.getElementById('modalDividirMotivo')?.value || '').trim();
    const selDestino = document.getElementById('modalDividirSemanaDestino');
    const semanaDestinoId = selDestino && selDestino.value ? parseInt(selDestino.value, 10) : null;

    if (isNaN(cuotaId) || cuotaId <= 0) return;
    if (montoDescontar <= 0 || montoDescontar >= montoTotal) {
        Swal.fire({ icon: 'warning', title: 'Monto Inválido', text: 'El monto a descontar debe ser mayor a 0 y menor al total de la cuota.', background: '#1e293b', color: '#fff' });
        return;
    }

    const btn = document.getElementById('btnGuardarDividirCuotaSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Confirmar Deducción Parcial';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dividiendo...'; btn.disabled = true; }

    try {
        const remanente = montoTotal - montoDescontar;
        const payload = {
            montoDescontarUSD: montoDescontar,
            semanaOperativaIdDestino: semanaDestinoId,
            motivo: motivo || `Deducción parcial: $${montoDescontar.toFixed(2)} ahora, $${remanente.toFixed(2)} reprogramados`
        };

        const res = await fetch(`${API_BASE}/adelantos/cuotas/${cuotaId}/dividir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            cerrarModalCustom('modalDividirCuotaCustom');
            showToast('Cuota dividida exitosamente. Remanente trasladado al siguiente ciclo.');
            if (typeof cargarAdelantosFincas === 'function') await cargarAdelantosFincas();
            if (typeof cargarAbonosCompanias === 'function') await cargarAbonosCompanias();
            if (typeof cargarAdelantosReceptoria === 'function') await cargarAdelantosReceptoria();
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Dividir', text: errData.message || 'No se pudo dividir la cuota.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
    }
}
window.guardarDividirCuotaSubmit = guardarDividirCuotaSubmit;

async function eliminarAdelanto(id, tipoEntidad) {
    const confirmRes = await Swal.fire({
        title: '¿Eliminar Adelanto?',
        text: `Esta acción eliminará el adelanto #${id} y todas sus cuotas asociadas.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirmRes.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/adelantos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.ok) {
            showToast('Adelanto eliminado exitosamente.');
            if (tipoEntidad === 'FINCA') {
                await cargarAdelantosFincas();
            } else if (tipoEntidad === 'COMPANIA') {
                if (typeof cargarAbonosCompanias === 'function') await cargarAbonosCompanias();
            } else {
                await cargarAdelantosReceptoria();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error al Eliminar', text: 'No se pudo eliminar el adelanto.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.eliminarAdelanto = eliminarAdelanto;

// --------------------------------------------------------------------------
// MÓDULO HISTORIAL GENERAL DE ADELANTOS Y ABONOS
// --------------------------------------------------------------------------
var historialAdelantosCache = [];

async function cargarHistorialAdelantos() {
    const tbody = document.getElementById('tbodyHistorialAdelantos');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando historial completo de adelantos...</td></tr>`;
    }

    const tipoEntidad = document.getElementById('filtroHistorialTipoEntidad')?.value || '';
    const estado = document.getElementById('filtroHistorialEstado')?.value || '';

    try {
        let url = `${API_BASE}/adelantos?`;
        if (tipoEntidad) url += `tipoEntidad=${tipoEntidad}&`;
        if (estado) url += `estado=${estado}&`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error('Error al cargar historial de adelantos.');
        const data = await res.json();
        historialAdelantosCache = data || [];

        actualizarKpisHistorialAdelantos(historialAdelantosCache);
        
        const q = (document.getElementById('buscarHistorialAdelantoInput')?.value || '').trim();
        filtrarHistorialAdelantos(q);
    } catch (err) {
        console.error('Error en cargarHistorialAdelantos:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 20px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos: ${err.message}</td></tr>`;
        }
    }
}
window.cargarHistorialAdelantos = cargarHistorialAdelantos;

function actualizarKpisHistorialAdelantos(lista) {
    let totalUsd = 0;
    let cobradoUsd = 0;
    let pendienteUsd = 0;
    let cuotasCobradasCount = 0;
    let cuotasPendientesCount = 0;
    let cuotasPospuestasCount = 0;

    lista.forEach(a => {
        totalUsd += (a.montoTotalUSD ?? a.MontoTotalUSD ?? 0);
        cobradoUsd += (a.montoPagadoUSD ?? a.MontoPagadoUSD ?? 0);
        pendienteUsd += (a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0);

        const cuotas = a.cuotas || a.Cuotas || [];
        cuotas.forEach(c => {
            const st = (c.estado || c.Estado || '').toUpperCase();
            if (st === 'COBRADO') cuotasCobradasCount++;
            else if (st === 'PENDIENTE') cuotasPendientesCount++;
            else if (st === 'POSPUESTO') cuotasPospuestasCount++;
        });
    });

    const elTotalUsd = document.getElementById('kpiHistorialTotalUSD');
    const elCantTotal = document.getElementById('kpiHistorialCantTotal');
    const elCobradoUsd = document.getElementById('kpiHistorialCobradoUSD');
    const elCuotasCobradas = document.getElementById('kpiHistorialCuotasCobradas');
    const elPendienteUsd = document.getElementById('kpiHistorialPendienteUSD');
    const elCuotasPendientes = document.getElementById('kpiHistorialCuotasPendientes');
    const elCuotasPospuestas = document.getElementById('kpiHistorialCuotasPospuestas');

    if (elTotalUsd) elTotalUsd.innerText = `$ ${formatearNumero(totalUsd, 2)}`;
    if (elCantTotal) elCantTotal.innerText = `${lista.length} Adelantos en total`;
    if (elCobradoUsd) elCobradoUsd.innerText = `$ ${formatearNumero(cobradoUsd, 2)}`;
    if (elCuotasCobradas) elCuotasCobradas.innerText = `${cuotasCobradasCount} Cuotas cobradas`;
    if (elPendienteUsd) elPendienteUsd.innerText = `$ ${formatearNumero(pendienteUsd, 2)}`;
    if (elCuotasPendientes) elCuotasPendientes.innerText = `${cuotasPendientesCount} Cuotas por cobrar`;
    if (elCuotasPospuestas) elCuotasPospuestas.innerText = `${cuotasPospuestasCount}`;
}

function filtrarHistorialAdelantos(q) {
    if (!historialAdelantosCache) return;
    const query = (q || '').toLowerCase().trim();

    if (!query) {
        renderHistorialAdelantos(historialAdelantosCache);
        return;
    }

    const filtrados = historialAdelantosCache.filter(a => {
        const id = String(a.id || a.Id || '');
        const entidad = (a.entidadNombre || a.EntidadNombre || '').toLowerCase();
        const obs = (a.observacion || a.Observacion || '').toLowerCase();
        const tipo = (a.tipoEntidad || a.TipoEntidad || '').toLowerCase();
        return id.includes(query) || entidad.includes(query) || obs.includes(query) || tipo.includes(query);
    });

    renderHistorialAdelantos(filtrados);
}
window.filtrarHistorialAdelantos = filtrarHistorialAdelantos;

function renderHistorialAdelantos(lista) {
    const tbody = document.getElementById('tbodyHistorialAdelantos');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center" style="padding: 32px; color: #64748b;">
                    <i class="fa-solid fa-folder-open" style="font-size: 28px; display: block; margin-bottom: 8px; color: #94a3b8;"></i>
                    No se encontraron registros de adelantos en el historial con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    let rowsHtml = '';
    lista.forEach((a, idx) => {
        const id = a.id || a.Id;
        const tipo = (a.tipoEntidad || a.TipoEntidad || 'FINCA').toUpperCase();
        const entidadNombre = a.entidadNombre || a.EntidadNombre || 'Sin Nombre';
        const totalUsd = a.montoTotalUSD ?? a.MontoTotalUSD ?? 0;
        const pagadoUsd = a.montoPagadoUSD ?? a.MontoPagadoUSD ?? 0;
        const pendienteUsd = a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0;
        const numCuotas = a.numeroCuotas ?? a.NumeroCuotas ?? 1;
        const fechaSolicitudStr = (a.fechaSolicitud || a.FechaSolicitud || '').split('T')[0];
        const estado = (a.estado || a.Estado || 'ACTIVO').toUpperCase();
        const obs = a.observacion || a.Observacion || 'Sin observaciones';
        const cuotas = a.cuotas || a.Cuotas || [];

        const cuotasCobradas = cuotas.filter(c => (c.estado || c.Estado || '').toUpperCase() === 'COBRADO').length;

        const bgClass = idx % 2 === 1 ? '#f8fafc' : '#ffffff';

        // Badge Tipo
        const badgeTipo = tipo === 'FINCA'
            ? `<span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-weight: 700; font-size: 11px;"><i class="fa-solid fa-leaf"></i> FINCA</span>`
            : `<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-weight: 700; font-size: 11px;"><i class="fa-solid fa-truck"></i> RECEPTORÍA</span>`;

        // Badge Estado
        const badgeEstado = estado === 'PAGADO'
            ? `<span class="badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 800; font-size: 11.5px;"><i class="fa-solid fa-circle-check"></i> PAGADO</span>`
            : `<span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-weight: 800; font-size: 11.5px;"><i class="fa-solid fa-clock"></i> ACTIVO</span>`;

        // Filas de cuotas para despliegue acordeón
        let subTableRows = '';
        cuotas.forEach((c, cIdx) => {
            const numC = c.numeroCuota || c.NumeroCuota || (cIdx + 1);
            const semNom = c.semanaNombre || c.SemanaNombre || `Ciclo #${c.semanaOperativaId || 'N/A'}`;
            const nomCuotaUsd = c.montoCuotaUSD ?? c.MontoCuotaUSD ?? 0;
            const cobUsd = c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0;
            const tasaAplic = c.tasaBcvAplicada ?? c.TasaBcvAplicada ?? state.tasaBcv ?? 798.326;
            const cobBs = c.montoCobradoBs ?? c.MontoCobradoBs ?? (cobUsd * tasaAplic);
            const stCuota = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();

            let stCuotaBadge = `<span class="badge" style="background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; font-size: 10.5px;">PENDIENTE</span>`;
            if (stCuota === 'COBRADO') {
                stCuotaBadge = `<span class="badge" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 10.5px; font-weight: 800;">COBRADO</span>`;
            } else if (stCuota === 'POSPUESTO') {
                stCuotaBadge = `<span class="badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 10.5px; font-weight: 800;">POSPUESTO</span>`;
            }

            subTableRows += `
                <tr style="background: ${cIdx % 2 === 1 ? '#f8fafc' : '#ffffff'}; font-size: 12px;">
                    <td style="text-align: center; font-weight: 700; color: #475569;">Cuota ${numC}/${numCuotas}</td>
                    <td style="font-weight: 700; color: #0f172a;">${semNom}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700;">$ ${formatearNumero(nomCuotaUsd, 2)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 800; color: #047857;">$ ${formatearNumero(cobUsd, 2)}</td>
                    <td style="text-align: right; font-family: monospace; font-size: 11.5px; color: #b45309;">Bs. ${formatearNumero(tasaAplic, 2)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 800; color: #b45309;">Bs. ${formatearNumero(cobBs, 2)}</td>
                    <td style="text-align: center;">${stCuotaBadge}</td>
                </tr>
            `;
        });

        rowsHtml += `
            <tr style="background: ${bgClass}; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                <td style="text-align: center; padding: 10px 8px;">
                    <button type="button" onclick="toggleExpandirHistorialCuotas(${id})" id="btnToggleHist_${id}" class="btn-icon" title="Ver desglose de cuotas" style="color: #2563eb; font-size: 14px; cursor: pointer; transition: transform 0.2s ease;">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </td>
                <td style="font-weight: 800; color: #0f172a; text-align: center;">#${id}</td>
                <td style="color: #475569; font-weight: 600;">${formatearFechaLocal(fechaSolicitudStr)}</td>
                <td style="text-align: center;">${badgeTipo}</td>
                <td style="font-weight: 800; color: #0f172a;">${entidadNombre} <div style="font-size: 11.5px; font-weight: 400; color: #64748b;">${obs}</div></td>
                <td style="font-weight: 800; color: #2563eb; text-align: right; font-family: monospace;">$ ${formatearNumero(totalUsd, 2)}</td>
                <td style="text-align: center; font-weight: 700; color: #475569;"><span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">${cuotasCobradas} / ${numCuotas}</span></td>
                <td style="font-weight: 800; color: #059669; text-align: right; font-family: monospace;">$ ${formatearNumero(pagadoUsd, 2)}</td>
                <td style="font-weight: 800; color: ${pendienteUsd > 0 ? '#e11d48' : '#64748b'}; text-align: right; font-family: monospace;">$ ${formatearNumero(pendienteUsd, 2)}</td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" onclick="verDetalleAdelantosModal(${a.entidadId || a.EntidadId}, '${entidadNombre.replace(/'/g, "\\'")}')" class="btn btn-outline" style="padding: 4px 8px; font-size: 11.5px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;" title="Ver Modal de Detalle">
                            <i class="fa-solid fa-eye"></i> Detalle
                        </button>
                        <button type="button" onclick="eliminarAdelanto(${id}, '${tipo}')" class="btn btn-outline" style="padding: 4px 8px; font-size: 11.5px; border-color: #fecdd3; color: #e11d48; background: #fff1f2;" title="Eliminar Adelanto">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            <tr id="subrow_historial_${id}" style="display: none; background: #f8fafc;">
                <td colspan="11" style="padding: 12px 24px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-list-check" style="color: #2563eb;"></i> Plan de Cuotas y Calendario de Pagos para Adelanto #${id}
                        </div>
                        <table class="table" style="width: 100%; border: 1px solid #e2e8f0; margin: 0;">
                            <thead>
                                <tr style="background: #f1f5f9; font-size: 11.5px; font-weight: 800; color: #334155;">
                                    <th style="text-align: center;">CUOTA</th>
                                    <th>CICLO OPERATIVO</th>
                                    <th style="text-align: right;">PACTADO ($)</th>
                                    <th style="text-align: right;">ABONADO ($)</th>
                                    <th style="text-align: right;">TASA BCV</th>
                                    <th style="text-align: right;">DESCONTADO (BS)</th>
                                    <th style="text-align: center;">ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${subTableRows || '<tr><td colspan="7" class="text-center" style="color: #94a3b8; padding: 8px;">Sin cuotas registradas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

function toggleExpandirHistorialCuotas(id) {
    const subrow = document.getElementById(`subrow_historial_${id}`);
    const btn = document.getElementById(`btnToggleHist_${id}`);
    if (!subrow) return;

    if (subrow.style.display === 'none' || !subrow.style.display) {
        subrow.style.display = 'table-row';
        if (btn) btn.style.transform = 'rotate(180deg)';
    } else {
        subrow.style.display = 'none';
        if (btn) btn.style.transform = 'rotate(0deg)';
    }
}
window.toggleExpandirHistorialCuotas = toggleExpandirHistorialCuotas;

function exportarHistorialAdelantosExcel() {
    if (!historialAdelantosCache || historialAdelantosCache.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin Datos', text: 'No hay datos en el historial de adelantos para exportar.', background: '#1e293b', color: '#fff' });
        return;
    }

    let csvContent = "\uFEFFID;FECHA_SOLICITUD;TIPO_ENTIDAD;PRODUCTOR_RECEPTORIA;TOTAL_USD;CUOTAS_COBRADAS;TOTAL_CUOTAS;MONTO_COBRADO_USD;MONTO_PENDIENTE_USD;ESTADO;OBSERVACION\n";

    historialAdelantosCache.forEach(a => {
        const id = a.id || a.Id;
        const fecha = (a.fechaSolicitud || a.FechaSolicitud || '').split('T')[0];
        const tipo = a.tipoEntidad || a.TipoEntidad || 'FINCA';
        const entidad = (a.entidadNombre || a.EntidadNombre || '').replace(/;/g, ',');
        const totalUsd = (a.montoTotalUSD ?? a.MontoTotalUSD ?? 0).toFixed(2).replace('.', ',');
        const numCuotas = a.numeroCuotas ?? a.NumeroCuotas ?? 1;
        const cuotas = a.cuotas || a.Cuotas || [];
        const cobradasCount = cuotas.filter(c => (c.estado || c.Estado || '').toUpperCase() === 'COBRADO').length;
        const cobradoUsd = (a.montoPagadoUSD ?? a.MontoPagadoUSD ?? 0).toFixed(2).replace('.', ',');
        const pendienteUsd = (a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0).toFixed(2).replace('.', ',');
        const estado = a.estado || a.Estado || 'ACTIVO';
        const obs = (a.observacion || a.Observacion || 'Sin observaciones').replace(/;/g, ',');

        csvContent += `${id};${fecha};${tipo};${entidad};${totalUsd};${cobradasCount};${numCuotas};${cobradoUsd};${pendienteUsd};${estado};${obs}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Historial_Adelantos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('¡Historial exportado a CSV/Excel exitosamente!');
}
window.exportarHistorialAdelantosExcel = exportarHistorialAdelantosExcel;

// --- MÓDULO PROPIETARIOS / PRODUCTORES (DATATABLE ENGINE) ---
state.propietarios = [];
state.modoPreliquidacion = 'FINCA';

let dtPropietariosState = {
    pageSize: 10,
    currentPage: 1,
    sortCol: 'nombre',
    sortAsc: true,
    searchQuery: '',
    filteredData: []
};

async function cargarPropietarios() {
    try {
        const tbody = document.getElementById('tbodyPropietarios');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando propietarios...</td></tr>';

        const res = await fetch(`${API_BASE}/propietarios`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error('Error al cargar la lista de propietarios.');

        const data = await res.json();
        state.propietarios = data || [];
        poblarFiltrosPropietarios();
        dtPropietariosState.currentPage = 1;
        aplicarFiltrosYRenderizarDataTablePropietarios();
    } catch (err) {
        console.error('Error en cargarPropietarios:', err);
        const tbody = document.getElementById('tbodyPropietarios');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #ef4444;">${err.message}</td></tr>`;
    }
}
window.cargarPropietarios = cargarPropietarios;

function poblarFiltrosPropietarios() {
    const selProp = document.getElementById('filtroSelectPropietario');
    const selBanco = document.getElementById('filtroBancoPropietario');
    const selFinca = document.getElementById('filtroFincaPropietario');

    const lista = state.propietarios || [];

    // 1. Poblar Filtro Propietarios
    if (selProp) {
        const valActual = selProp.value;
        const props = [...new Set(lista.map(p => (p.nombre || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        selProp.innerHTML = `<option value="">Todos los Propietarios (${lista.length})</option>` + 
            props.map(nom => `<option value="${escaparHTML(nom.toLowerCase())}">${capitalizarTexto(nom)}</option>`).join('');
        if (valActual) selProp.value = valActual;
    }

    // 2. Poblar Filtro Bancos
    if (selBanco) {
        const valActual = selBanco.value;
        const bancos = [...new Set(lista.map(p => (p.bancoNombre || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        selBanco.innerHTML = '<option value="">Todos los Bancos</option>' +
            '<option value="__SIN_BANCO__">⚪ Sin Datos Bancarios</option>' +
            bancos.map(b => `<option value="${escaparHTML(b.toLowerCase())}">${capitalizarTexto(b)}</option>`).join('');
        if (valActual) selBanco.value = valActual;
    }

    // 3. Poblar Filtro Fincas Asociadas
    if (selFinca) {
        const valActual = selFinca.value;
        const todasFincas = new Set();
        lista.forEach(p => {
            (p.fincasNombres || []).forEach(f => {
                if (f && f.trim()) todasFincas.add(f.trim());
            });
        });
        const fincasArr = Array.from(todasFincas).sort((a, b) => a.localeCompare(b));

        selFinca.innerHTML = '<option value="">Todas las Fincas</option>' +
            '<option value="__CON_FINCAS__">🌾 Con Fincas Asociadas</option>' +
            '<option value="__SIN_FINCAS__">⚪ Sin Fincas Asociadas</option>' +
            (fincasArr.length > 0 ? `<optgroup label="Fincas Específicas">${fincasArr.map(f => `<option value="${escaparHTML(f.toLowerCase())}">${capitalizarTexto(f)}</option>`).join('')}</optgroup>` : '');
        if (valActual) selFinca.value = valActual;
    }
}
window.poblarFiltrosPropietarios = poblarFiltrosPropietarios;

// --- FUNCIONES DATATABLE PROPIETARIOS ---
function cambiarPageSizePropietarios(val) {
    dtPropietariosState.pageSize = val === 'all' ? 999999 : Number(val);
    dtPropietariosState.currentPage = 1;
    renderTablaPropietarios();
}
window.cambiarPageSizePropietarios = cambiarPageSizePropietarios;

function irAPaginaPropietarios(page) {
    dtPropietariosState.currentPage = page;
    renderTablaPropietarios();
}
window.irAPaginaPropietarios = irAPaginaPropietarios;

function ordenarDataTablePropietarios(col) {
    if (dtPropietariosState.sortCol === col) {
        dtPropietariosState.sortAsc = !dtPropietariosState.sortAsc;
    } else {
        dtPropietariosState.sortCol = col;
        dtPropietariosState.sortAsc = true;
    }

    // Actualizar iconos de ordenamiento en cabeceras
    const cols = ['nombre', 'bancoNombre', 'totalFincas', 'estado'];
    cols.forEach(c => {
        const icon = document.getElementById(`sortIconProp_${c}`);
        if (icon) {
            if (c === dtPropietariosState.sortCol) {
                icon.className = dtPropietariosState.sortAsc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                icon.style.color = '#2563eb';
            } else {
                icon.className = 'fa-solid fa-sort';
                icon.style.color = '#94a3b8';
            }
        }
    });

    aplicarFiltrosYRenderizarDataTablePropietarios();
}
window.ordenarDataTablePropietarios = ordenarDataTablePropietarios;

function filtrarTablaPropietarios() {
    const q = (document.getElementById('inputBuscarPropietarios')?.value || '').toLowerCase().trim();
    const btnLimpiar = document.getElementById('btnLimpiarBuscarPropietarios');
    if (btnLimpiar) {
        btnLimpiar.style.display = q ? 'block' : 'none';
    }

    dtPropietariosState.searchQuery = q;
    dtPropietariosState.currentPage = 1;
    aplicarFiltrosYRenderizarDataTablePropietarios();
}
window.filtrarTablaPropietarios = filtrarTablaPropietarios;

function aplicarFiltrosYRenderizarDataTablePropietarios() {
    const q = dtPropietariosState.searchQuery;
    const filtroProp = (document.getElementById('filtroSelectPropietario')?.value || '').toLowerCase().trim();
    const filtroBanco = (document.getElementById('filtroBancoPropietario')?.value || '').toLowerCase().trim();
    const filtroFinca = (document.getElementById('filtroFincaPropietario')?.value || '').toLowerCase().trim();

    let filtrados = [...(state.propietarios || [])];

    // 1. Filtro por Propietario (Select)
    if (filtroProp) {
        filtrados = filtrados.filter(p => (p.nombre || '').toLowerCase().trim() === filtroProp);
    }

    // 2. Filtro por Banco (Select)
    if (filtroBanco) {
        if (filtroBanco === '__sin_banco__') {
            filtrados = filtrados.filter(p => !p.bancoNombre || p.bancoNombre.trim() === '');
        } else {
            filtrados = filtrados.filter(p => (p.bancoNombre || '').toLowerCase().trim() === filtroBanco);
        }
    }

    // 3. Filtro por Finca (Select)
    if (filtroFinca) {
        if (filtroFinca === '__con_fincas__') {
            filtrados = filtrados.filter(p => (p.totalFincas > 0) || (p.fincasNombres && p.fincasNombres.length > 0));
        } else if (filtroFinca === '__sin_fincas__') {
            filtrados = filtrados.filter(p => !p.totalFincas || p.totalFincas === 0 || !p.fincasNombres || p.fincasNombres.length === 0);
        } else {
            filtrados = filtrados.filter(p => (p.fincasNombres || []).some(fn => fn.toLowerCase().trim() === filtroFinca));
        }
    }

    // 4. Filtro por Búsqueda Rápida de Texto (Nombre, Teléfono, Banco, Cuenta, Fincas)
    if (q) {
        filtrados = filtrados.filter(p => {
            const nom = (p.nombre || '').toLowerCase();
            const tel = (p.telefono || '').toLowerCase();
            const banco = (p.bancoNombre || '').toLowerCase();
            const cuenta = (p.numeroCuenta || '').toLowerCase();
            const fincas = (p.fincasNombres || []).join(' ').toLowerCase();
            return nom.includes(q) || tel.includes(q) || banco.includes(q) || cuenta.includes(q) || fincas.includes(q);
        });
    }

    // 5. Ordenamiento DataTable
    const col = dtPropietariosState.sortCol;
    const asc = dtPropietariosState.sortAsc;

    filtrados.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'totalFincas') {
            valA = Number(valA || 0);
            valB = Number(valB || 0);
        } else if (col === 'estado') {
            valA = 'ACTIVO';
            valB = 'ACTIVO';
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
    });

    dtPropietariosState.filteredData = filtrados;
    renderTablaPropietarios();
}

function renderTablaPropietarios() {
    const tbody = document.getElementById('tbodyPropietarios');
    const badgeContador = document.getElementById('badgeContadorPropietarios');
    const dtInfo = document.getElementById('dtInfoPropietarios');
    const dtPagination = document.getElementById('dtPaginationPropietarios');

    const totalGeneral = (state.propietarios || []).length;
    const lista = dtPropietariosState.filteredData || [];
    const totalFiltrados = lista.length;

    // Actualizar Badge Contador Superior
    if (badgeContador) {
        if (totalFiltrados === totalGeneral) {
            badgeContador.innerHTML = `<i class="fa-solid fa-users"></i> ${totalGeneral} Propietarios`;
            badgeContador.style.background = '#eff6ff';
            badgeContador.style.color = '#1d4ed8';
            badgeContador.style.border = '1px solid #bfdbfe';
        } else {
            badgeContador.innerHTML = `<i class="fa-solid fa-filter"></i> ${totalFiltrados} de ${totalGeneral} Propietarios`;
            badgeContador.style.background = '#fef3c7';
            badgeContador.style.color = '#b45309';
            badgeContador.style.border = '1px solid #fde68a';
        }
    }

    if (!tbody) return;

    if (totalFiltrados === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 32px; color: #94a3b8; font-size: 14px;"><i class="fa-solid fa-magnifying-glass" style="margin-right: 6px;"></i> No se encontraron propietarios con los filtros aplicados.</td></tr>';
        if (dtInfo) dtInfo.innerText = 'Mostrando 0 a 0 de 0 registros';
        if (dtPagination) dtPagination.innerHTML = '';
        return;
    }

    // Paginación DataTable
    const pageSize = dtPropietariosState.pageSize;
    const totalPages = Math.ceil(totalFiltrados / pageSize) || 1;
    if (dtPropietariosState.currentPage > totalPages) {
        dtPropietariosState.currentPage = totalPages;
    }
    const curPage = dtPropietariosState.currentPage;
    const startIdx = (curPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalFiltrados);
    const paginados = lista.slice(startIdx, endIdx);

    // Renderizar Filas
    tbody.innerHTML = paginados.map(p => {
        const fincasBadge = p.totalFincas > 0
            ? `<span class="badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-leaf"></i> ${p.totalFincas} Finca(s): ${(p.fincasNombres || []).map(n => capitalizarTexto(n)).join(', ')}</span>`
            : `<span style="color: #94a3b8; font-size: 11px;">Sin fincas asociadas</span>`;

        const bancoStr = p.bancoNombre ? `<strong>${capitalizarTexto(p.bancoNombre)}</strong><br><small style="color: #64748b; font-family: monospace;">${p.numeroCuenta || 'Sin cuenta'}</small>` : '<span style="color: #94a3b8; font-size: 11px;">Sin datos bancarios</span>';

        return `
            <tr>
                <td><strong>${capitalizarTexto(p.nombre)}</strong>${p.telefono ? `<br><small style="color: #64748b;"><i class="fa-solid fa-phone"></i> ${p.telefono}</small>` : ''}</td>
                <td>${bancoStr}</td>
                <td style="text-align: center;">${fincasBadge}</td>
                <td style="text-align: center;"><span class="badge" style="background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; font-weight: 700; font-size: 11px;">ACTIVO</span></td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="abrirModalEditarPropietario(${p.id})" title="Editar Propietario" style="padding: 4px 8px; font-size: 11px; font-weight: 700; color: #2563eb; border: 1px solid #93c5fd; border-radius: 6px; margin-right: 4px;">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="eliminarPropietario(${p.id})" title="Desvincular y Eliminar Propietario" style="padding: 4px 8px; font-size: 11px; font-weight: 700; color: #ef4444; border: 1px solid #fca5a5; border-radius: 6px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Actualizar Texto Informativo
    if (dtInfo) {
        if (totalFiltrados === totalGeneral) {
            dtInfo.innerHTML = `Mostrando <strong>${startIdx + 1}</strong> a <strong>${endIdx}</strong> de <strong>${totalGeneral}</strong> propietarios`;
        } else {
            dtInfo.innerHTML = `Mostrando <strong>${startIdx + 1}</strong> a <strong>${endIdx}</strong> de <strong>${totalFiltrados}</strong> propietarios (filtrados de un total de <strong>${totalGeneral}</strong>)`;
        }
    }

    // Renderizar Controles de Paginación
    if (dtPagination) {
        if (totalPages <= 1) {
            dtPagination.innerHTML = '';
            return;
        }

        let pagHtml = `
            <button type="button" onclick="irAPaginaPropietarios(${curPage - 1})" ${curPage === 1 ? 'disabled' : ''} style="padding: 4px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: ${curPage === 1 ? '#f8fafc' : '#ffffff'}; color: ${curPage === 1 ? '#94a3b8' : '#1e293b'}; font-size: 12px; font-weight: 700; cursor: ${curPage === 1 ? 'not-allowed' : 'pointer'};">
                <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
        `;

        // Generar números de página inteligentes
        let startPage = Math.max(1, curPage - 2);
        let endPage = Math.min(totalPages, curPage + 2);

        if (startPage > 1) {
            pagHtml += `<button type="button" onclick="irAPaginaPropietarios(1)" style="padding: 4px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #1e293b; font-size: 12px; font-weight: 700; cursor: pointer;">1</button>`;
            if (startPage > 2) {
                pagHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
            }
        }

        for (let p = startPage; p <= endPage; p++) {
            const isAct = p === curPage;
            pagHtml += `
                <button type="button" onclick="irAPaginaPropietarios(${p})" style="padding: 4px 10px; border-radius: 6px; border: 1.5px solid ${isAct ? '#2563eb' : '#cbd5e1'}; background: ${isAct ? '#2563eb' : '#ffffff'}; color: ${isAct ? '#ffffff' : '#1e293b'}; font-size: 12px; font-weight: 700; cursor: pointer;">
                    ${p}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pagHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
            }
            pagHtml += `<button type="button" onclick="irAPaginaPropietarios(${totalPages})" style="padding: 4px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #1e293b; font-size: 12px; font-weight: 700; cursor: pointer;">${totalPages}</button>`;
        }

        pagHtml += `
            <button type="button" onclick="irAPaginaPropietarios(${curPage + 1})" ${curPage === totalPages ? 'disabled' : ''} style="padding: 4px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: ${curPage === totalPages ? '#f8fafc' : '#ffffff'}; color: ${curPage === totalPages ? '#94a3b8' : '#1e293b'}; font-size: 12px; font-weight: 700; cursor: ${curPage === totalPages ? 'not-allowed' : 'pointer'};">
                Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;

        dtPagination.innerHTML = pagHtml;
    }
}
window.renderTablaPropietarios = renderTablaPropietarios;

function exportarPropietariosExcel() {
    const lista = (dtPropietariosState.filteredData && dtPropietariosState.filteredData.length > 0)
        ? dtPropietariosState.filteredData
        : (state.propietarios || []);

    if (!lista || lista.length === 0) {
        showToast('No hay propietarios para exportar', 'warning');
        return;
    }

    let csv = "\uFEFF"; // BOM UTF-8
    csv += "ID,Propietario / Productor,Teléfono,Banco,Número de Cuenta,Total Fincas,Fincas Asociadas,Estado\n";

    lista.forEach(p => {
        const id = p.id || '';
        const nom = `"${(p.nombre || '').replace(/"/g, '""')}"`;
        const tel = `"${(p.telefono || '').replace(/"/g, '""')}"`;
        const banco = `"${(p.bancoNombre || '').replace(/"/g, '""')}"`;
        const cuenta = `"${(p.numeroCuenta || '').replace(/"/g, '""')}"`;
        const totalFincas = p.totalFincas || 0;
        const fincas = `"${(p.fincasNombres || []).join(', ').replace(/"/g, '""')}"`;
        const estado = '"ACTIVO"';

        csv += `${id},${nom},${tel},${banco},${cuenta},${totalFincas},${fincas},${estado}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Catalogo_Propietarios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('¡Catálogo de propietarios exportado exitosamente!');
}
window.exportarPropietariosExcel = exportarPropietariosExcel;

function limpiarFiltrosPropietarios() {
    const inputBuscar = document.getElementById('inputBuscarPropietarios');
    const selProp = document.getElementById('filtroSelectPropietario');
    const selBanco = document.getElementById('filtroBancoPropietario');
    const selFinca = document.getElementById('filtroFincaPropietario');
    const btnLimpiar = document.getElementById('btnLimpiarBuscarPropietarios');

    if (inputBuscar) inputBuscar.value = '';
    if (btnLimpiar) btnLimpiar.style.display = 'none';
    if (selProp) selProp.value = '';
    if (selBanco) selBanco.value = '';
    if (selFinca) selFinca.value = '';

    dtPropietariosState.searchQuery = '';
    dtPropietariosState.currentPage = 1;
    dtPropietariosState.sortCol = 'nombre';
    dtPropietariosState.sortAsc = true;

    aplicarFiltrosYRenderizarDataTablePropietarios();
}
window.limpiarFiltrosPropietarios = limpiarFiltrosPropietarios;

async function poblarSelectBancosPropietario(bancoIdSelected) {
    const sel = document.getElementById('modalPropietarioBancoId');
    if (!sel) return;

    if (!state.bancos || state.bancos.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/catalogos/bancos`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.bancos = await res.json();
        } catch (e) { console.warn('Error al cargar bancos:', e); }
    }

    sel.innerHTML = '<option value="">-- Seleccionar Banco --</option>' + (state.bancos || []).map(b =>
        `<option value="${b.id}" ${b.id === bancoIdSelected ? 'selected' : ''}>${b.codigo} - ${capitalizarTexto(b.nombre)}</option>`
    ).join('');
}

let fincasSeleccionadasModalPropietario = new Set();

async function renderFincasModalPropietario(queryFiltro = '') {
    const containerLista = document.getElementById('contenedorFincasCheckboxesModal');
    const containerChips = document.getElementById('contenedorFincasSeleccionadasChips');
    if (!containerLista) return;

    if (!state.fincas || state.fincas.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/catalogos/fincas`, { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.fincas = await res.json();
        } catch (e) { console.warn('Error al cargar fincas:', e); }
    }

    const todasFincas = state.fincas || [];

    // 1. RENDERIZAR CHIPS SELECCIONADOS AL PRINCIPIO
    if (containerChips) {
        const fincasSel = todasFincas.filter(f => fincasSeleccionadasModalPropietario.has(f.id));
        if (fincasSel.length === 0) {
            containerChips.innerHTML = `<span style="color: #94a3b8; font-size: 12px; font-style: italic;">No hay fincas seleccionadas. Selecciona abajo para asignarlas a este productor.</span>`;
        } else {
            containerChips.innerHTML = fincasSel.map(f => `
                <span style="display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #93c5fd; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                    <i class="fa-solid fa-leaf" style="color: #10b981;"></i> ${capitalizarTexto(f.nombre)}
                    <button type="button" onclick="deseleccionarFincaModalPropietario(${f.id})" style="border: none; background: transparent; color: #ef4444; font-weight: 900; font-size: 14px; cursor: pointer; padding: 0 2px; line-height: 1; margin-left: 2px;" title="Quitar finca">&times;</button>
                </span>
            `).join('');
        }
    }

    // 2. FILTRADO Y ORDENACIÓN: ¡LAS SELECCIONADAS VAN AL PRINCIPIO!
    const q = (queryFiltro || '').toLowerCase().trim();
    const fincasFiltradas = todasFincas.filter(f => {
        const nom = (f.nombre || '').toLowerCase();
        const prop = (f.propietario || '').toLowerCase();
        return !q || nom.includes(q) || prop.includes(q);
    });

    if (fincasFiltradas.length === 0) {
        containerLista.innerHTML = '<div style="padding: 18px; color: #94a3b8; text-align: center; font-size: 13px;"><i class="fa-solid fa-magnifying-glass"></i> No se encontraron fincas con ese criterio de búsqueda.</div>';
        actualizarContadorFincasModal();
        return;
    }

    const seleccionadas = [];
    const noSeleccionadas = [];
    fincasFiltradas.forEach(f => {
        if (fincasSeleccionadasModalPropietario.has(f.id)) {
            seleccionadas.push(f);
        } else {
            noSeleccionadas.push(f);
        }
    });

    seleccionadas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    noSeleccionadas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    let htmlLista = '';

    if (seleccionadas.length > 0) {
        htmlLista += `
            <div style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 6px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-circle-check"></i> Fincas Seleccionadas (${seleccionadas.length})
            </div>
        `;
        htmlLista += seleccionadas.map(f => renderItemFincaModal(f, true)).join('');
    }

    if (noSeleccionadas.length > 0) {
        if (seleccionadas.length > 0) {
            htmlLista += `
                <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 6px 4px 6px; border-top: 1px dashed #cbd5e1; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-layer-group"></i> Otras Fincas Disponibles (${noSeleccionadas.length})
                </div>
            `;
        }
        htmlLista += noSeleccionadas.map(f => renderItemFincaModal(f, false)).join('');
    }

    containerLista.innerHTML = htmlLista;
    actualizarContadorFincasModal();
}

function renderItemFincaModal(f, isSelected) {
    return `
        <div onclick="toggleSeleccionFincaModalPropietario(${f.id})" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1.5px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}; background: ${isSelected ? '#eff6ff' : '#ffffff'}; cursor: pointer; transition: all 0.15s; user-select: none; box-shadow: ${isSelected ? '0 1px 3px rgba(59,130,246,0.1)' : 'none'};">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                <div style="width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}; background: ${isSelected ? '#2563eb' : '#ffffff'}; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 12px;">
                    ${isSelected ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
                <div style="min-width: 0;">
                    <div style="font-weight: 800; font-size: 13px; color: ${isSelected ? '#1e3a8a' : '#0f172a'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${capitalizarTexto(f.nombre)}
                    </div>
                    <small style="color: #64748b; font-size: 11.5px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${f.propietario ? `Propietario actual: <strong style="color: #475569;">${capitalizarTexto(f.propietario)}</strong>` : '<span style="color: #10b981; font-weight: 600;">Sin propietario asignado</span>'}
                    </small>
                </div>
            </div>
            <div>
                ${isSelected 
                    ? '<span class="badge" style="background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;"><i class="fa-solid fa-check"></i> Asignada</span>'
                    : '<span style="color: #64748b; font-size: 11px; font-weight: 700; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; white-space: nowrap; border: 1px solid #e2e8f0;">+ Asignar</span>'
                }
            </div>
        </div>
    `;
}

function toggleSeleccionFincaModalPropietario(id) {
    if (fincasSeleccionadasModalPropietario.has(id)) {
        fincasSeleccionadasModalPropietario.delete(id);
    } else {
        fincasSeleccionadasModalPropietario.add(id);
    }
    const q = document.getElementById('inputBuscarFincasModalPropietario')?.value || '';
    renderFincasModalPropietario(q);
}
window.toggleSeleccionFincaModalPropietario = toggleSeleccionFincaModalPropietario;

function deseleccionarFincaModalPropietario(id) {
    fincasSeleccionadasModalPropietario.delete(id);
    const q = document.getElementById('inputBuscarFincasModalPropietario')?.value || '';
    renderFincasModalPropietario(q);
}
window.deseleccionarFincaModalPropietario = deseleccionarFincaModalPropietario;

function limpiarTodasFincasModalPropietario() {
    fincasSeleccionadasModalPropietario.clear();
    const q = document.getElementById('inputBuscarFincasModalPropietario')?.value || '';
    renderFincasModalPropietario(q);
}
window.limpiarTodasFincasModalPropietario = limpiarTodasFincasModalPropietario;

function filtrarFincasModalPropietario(q) {
    renderFincasModalPropietario(q);
}
window.filtrarFincasModalPropietario = filtrarFincasModalPropietario;

function actualizarContadorFincasModal() {
    const count = fincasSeleccionadasModalPropietario.size;
    const badge = document.getElementById('badgeContadorFincasPropietario');
    if (badge) badge.innerText = `${count} Finca(s) Seleccionada(s)`;
}
window.actualizarContadorFincasModal = actualizarContadorFincasModal;

async function abrirModalCrearPropietario() {
    document.getElementById('modalPropietarioTitulo').innerText = 'Nuevo Propietario / Productor';
    document.getElementById('modalPropietarioId').value = '0';
    document.getElementById('modalPropietarioNombre').value = '';
    document.getElementById('modalPropietarioCedulaRIF').value = '';
    document.getElementById('modalPropietarioTelefono').value = '';
    const selBanco = document.getElementById('modalPropietarioBancoId');
    if (selBanco) selBanco.value = '';
    const inputCuenta = document.getElementById('modalPropietarioNumeroCuenta');
    if (inputCuenta) inputCuenta.value = '';
    const inputSearch = document.getElementById('inputBuscarFincasModalPropietario');
    if (inputSearch) inputSearch.value = '';

    await poblarSelectBancosPropietario(null);

    fincasSeleccionadasModalPropietario = new Set();
    await renderFincasModalPropietario('');
    abrirModalCustom('modalPropietarioCustom');
}
window.abrirModalCrearPropietario = abrirModalCrearPropietario;

async function abrirModalEditarPropietario(id) {
    const p = state.propietarios.find(x => x.id === id);
    if (!p) return;

    document.getElementById('modalPropietarioTitulo').innerText = 'Editar Propietario / Productor';
    document.getElementById('modalPropietarioId').value = p.id;
    document.getElementById('modalPropietarioNombre').value = p.nombre || '';
    document.getElementById('modalPropietarioCedulaRIF').value = p.cedulaRIF || '';
    document.getElementById('modalPropietarioTelefono').value = p.telefono || '';
    const inputCuenta = document.getElementById('modalPropietarioNumeroCuenta');
    if (inputCuenta) inputCuenta.value = p.numeroCuenta || '';

    await poblarSelectBancosPropietario(p.bancoId || null);

    const inputSearch = document.getElementById('inputBuscarFincasModalPropietario');
    if (inputSearch) inputSearch.value = '';

    const fincasDeProp = (state.fincas || []).filter(f => f.propietarioId === id || f.propietario === p.nombre).map(f => f.id);
    fincasSeleccionadasModalPropietario = new Set(fincasDeProp);

    await renderFincasModalPropietario('');
    abrirModalCustom('modalPropietarioCustom');
}
window.abrirModalEditarPropietario = abrirModalEditarPropietario;

async function guardarPropietarioSubmit(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('modalPropietarioId').value) || 0;
    const nombre = document.getElementById('modalPropietarioNombre').value.trim();
    const cedulaRIF = document.getElementById('modalPropietarioCedulaRIF').value.trim();
    const telefono = document.getElementById('modalPropietarioTelefono').value.trim();
    const bancoId = parseInt(document.getElementById('modalPropietarioBancoId')?.value) || null;
    const numeroCuenta = document.getElementById('modalPropietarioNumeroCuenta')?.value.trim() || null;

    const fincaIds = Array.from(fincasSeleccionadasModalPropietario);

    if (!nombre) {
        Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'El nombre del propietario es obligatorio.' });
        return;
    }

    const payload = {
        nombre,
        cedulaRIF: cedulaRIF || null,
        telefono: telefono || null,
        bancoId,
        numeroCuenta,
        fincaIds
    };

    const isEdit = id > 0;
    const url = isEdit ? `${API_BASE}/propietarios/${id}` : `${API_BASE}/propietarios`;
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
            const errData = await res.json();
            throw new Error(errData.mensaje || 'Error al guardar propietario.');
        }

        cerrarModalCustom('modalPropietarioCustom');
        showToast(isEdit ? 'Propietario actualizado exitosamente.' : 'Propietario creado exitosamente.');
        await cargarPropietarios();
        if (typeof cargarFincasCat === 'function') await cargarFincasCat();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}
window.guardarPropietarioSubmit = guardarPropietarioSubmit;
window.guardarPropietarioSubmit = guardarPropietarioSubmit;

async function eliminarPropietario(id) {
    const p = state.propietarios.find(x => x.id === id);
    if (!p) return;

    const confirm = await Swal.fire({
        title: '¿Desvincular y eliminar propietario?',
        text: `El propietario "${p.nombre}" será eliminado, pero TODAS SUS FINCAS SE PRESERVARÁN INTACTAS (sin eliminar ni modificar recolecciones ni datos históricos).`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, Eliminar Propietario',
        cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/propietarios/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error('No se pudo eliminar el propietario.');

        showToast('Propietario eliminado. Sus fincas se conservaron de forma segura.');
        await cargarPropietarios();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}
window.eliminarPropietario = eliminarPropietario;

