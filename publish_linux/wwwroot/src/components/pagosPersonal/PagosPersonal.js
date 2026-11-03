// =========================================================================
// MÓDULO: TABLA DE PAGOS Y NÓMINA DE PERSONAL (CHOFERES, MATERAS & FIJOS)
// =========================================================================

let cacheCalculoPagosUsuarios = [];
let cachePagosRegistradosUsuarios = [];

async function cargarModuloPagosUsuarios() {
    try {
        // 1. Cargar selector de semanas operativas
        const selCiclo = document.getElementById('filtroCicloPagosUsuarios');
        const selModalCiclo = document.getElementById('modalPagoSelectCiclo');
        
        if (!state.semanas || state.semanas.length === 0) {
            const respCiclos = await fetch(`${API_BASE}/ciclos`, { headers: getAuthHeaders() });
            if (respCiclos.ok) {
                state.semanas = await respCiclos.json();
            }
        }

        if (selCiclo && state.semanas && state.semanas.length > 0) {
            selCiclo.innerHTML = state.semanas.map(s => {
                let label = s.codigo || ('Semana #' + s.id);
                if (!label.includes('(') && s.fechaInicio && s.fechaFin) {
                    label += ` (${formatearFechaLocal(s.fechaInicio)} al ${formatearFechaLocal(s.fechaFin)})`;
                }
                if (s.estado === 'ACTIVO') label += ' [ACTIVA]';
                return `<option value="${s.id}" ${s.estado === 'ACTIVO' ? 'selected' : ''}>${label}</option>`;
            }).join('');
        }

        if (selModalCiclo && state.semanas && state.semanas.length > 0) {
            selModalCiclo.innerHTML = '<option value="">-- Pago Directo (Sin Ciclo) --</option>' + state.semanas.map(s => {
                let label = s.codigo || ('Semana #' + s.id);
                if (!label.includes('(') && s.fechaInicio && s.fechaFin) {
                    label += ` (${formatearFechaLocal(s.fechaInicio)} al ${formatearFechaLocal(s.fechaFin)})`;
                }
                return `<option value="${s.id}" ${s.estado === 'ACTIVO' ? 'selected' : ''}>${label}</option>`;
            }).join('');
        }

        // 2. Cargar selector de usuarios en modal
        await cargarSelectUsuariosModalPago();

        // 3. Cargar el cálculo semanal
        await cargarCalculoPagosUsuarios();
    } catch (err) {
        console.error('Error al inicializar módulo de pagos a usuarios:', err);
    }
}
window.cargarModuloPagosUsuarios = cargarModuloPagosUsuarios;

async function cargarSelectUsuariosModalPago() {
    const selUser = document.getElementById('modalPagoSelectUsuario');
    if (!selUser) return;
    try {
        const resp = await fetch(`${API_BASE}/usuarios?soloActivos=true`, { headers: getAuthHeaders() });
        if (resp.ok) {
            const users = await resp.json();
            state.usuarios = users;
            selUser.innerHTML = '<option value="">-- Seleccionar Trabajador --</option>' + users.map(u => {
                const rolTxt = u.rol || 'USUARIO';
                const fleteTxt = u.tarifaPorLitro ? ` ($${u.tarifaPorLitro}/L)` : '';
                return `<option value="${u.id}" data-rol="${rolTxt}" data-tarifa="${u.tarifaPorLitro || 0}">${u.nombreCompleto || u.username} [${rolTxt}]${fleteTxt}</option>`;
            }).join('');
        }
    } catch (e) {
        console.warn('Error al cargar usuarios para modal de pago:', e);
    }
}
window.cargarSelectUsuariosModalPago = cargarSelectUsuariosModalPago;

async function cargarCalculoPagosUsuarios() {
    const tbody = document.getElementById('tbodyPagosUsuariosSemana');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Calculando liquidaciones y nómina...</td></tr>';
    }

    const selCiclo = document.getElementById('filtroCicloPagosUsuarios');
    const cicloId = selCiclo ? parseInt(selCiclo.value) : 0;

    try {
        // Consultar cálculo semanal del backend si hay cicloId
        let calculoItems = [];
        if (cicloId && cicloId > 0) {
            const respCalc = await fetch(`${API_BASE}/pagos-usuarios/calculo-semanal/${cicloId}`, { headers: getAuthHeaders() });
            if (respCalc.ok) {
                calculoItems = await respCalc.json();
            }
        }

        // Consultar pagos ya registrados para esta semana
        let pagosRegistrados = [];
        const respPagos = await fetch(`${API_BASE}/pagos-usuarios${cicloId ? '?cicloId=' + cicloId : ''}`, { headers: getAuthHeaders() });
        if (respPagos.ok) {
            pagosRegistrados = await respPagos.json();
        }
        cachePagosRegistradosUsuarios = pagosRegistrados;

        // Consultar catálogo de usuarios para asegurar que todos los trabajadores (Choferes, Materas, Personal) aparezcan
        if (!state.usuarios || state.usuarios.length === 0) {
            const respUsers = await fetch(`${API_BASE}/usuarios`, { headers: getAuthHeaders() });
            if (respUsers.ok) state.usuarios = await respUsers.json();
        }

        // Unificar lista completa de trabajadores
        const mapaCalculo = new Map();
        (calculoItems || []).forEach(it => mapaCalculo.set(it.usuarioId || it.UsuarioId, it));

        const mapaPagos = new Map();
        (pagosRegistrados || []).forEach(p => {
            if (p.estadoPago !== 'ANULADO') {
                mapaPagos.set(p.usuarioId || p.UsuarioId, p);
            }
        });

        const listaFinal = [];

        // Asegurar que cada usuario activo esté en la lista
        (state.usuarios || []).filter(u => u.activo !== false && !u.isDeleted).forEach(u => {
            const uId = u.id;
            const rol = (u.rol || '').toUpperCase();
            const rolNombre = u.rolNombre || rol;

            // Determinar tipo de pago y frecuencia
            let tipoPago = 'Semanal';
            let modalidad = 'Variado x Flete';
            if (rol === 'CHOFER' || rol.includes('CONDUCTOR')) {
                tipoPago = 'Semanal';
                modalidad = 'Variado x Flete';
            } else if (rol === 'MATERA' || rol.includes('MATERA')) {
                tipoPago = 'Quincenal';
                modalidad = 'Fijo / Quincenal';
            } else {
                tipoPago = 'Quincenal';
                modalidad = 'Sueldo Fijo';
            }

            const calc = mapaCalculo.get(uId);
            const pagoReg = mapaPagos.get(uId);

            const litros = calc ? (calc.totalLitrosBase || calc.TotalLitrosBase || calc.totalLitrosRecolectados || 0) : 0;
            const tarifa = calc ? (calc.tarifaPorLitroUSD || calc.TarifaPorLitroUSD || u.tarifaPorLitro || 0) : (u.tarifaPorLitro || 0);
            const viajes = calc ? (calc.totalViajes || calc.TotalViajes || 0) : 0;
            
            let bruto = 0;
            if (rol === 'CHOFER') {
                bruto = calc ? (calc.montoBrutoUSD || (litros * tarifa)) : (litros * tarifa);
            } else {
                bruto = calc ? (calc.montoBrutoUSD || 0) : 0;
            }

            const adelantos = calc ? (calc.adelantoPendienteTotalUSD || calc.cuotaSugeridaUSD || 0) : 0;
            const descLeche = calc ? (calc.descuentoLecheUSD || 0) : 0;
            const netoUSD = pagoReg ? (pagoReg.totalNetoUSD || pagoReg.TotalNetoUSD) : Math.max(0, bruto - adelantos - descLeche);
            
            const tasaBcv = (state.tasaBcvHoy && state.tasaBcvHoy.tasa) ? state.tasaBcvHoy.tasa : 1;
            const netoBs = pagoReg ? (pagoReg.totalNetoBs || (netoUSD * tasaBcv)) : (netoUSD * tasaBcv);

            const estado = pagoReg ? (pagoReg.estadoPago || 'PAGADO') : (calc && calc.estadoPagoActual ? calc.estadoPagoActual : 'PENDIENTE');

            listaFinal.push({
                usuarioId: uId,
                nombreCompleto: u.nombreCompleto || u.username,
                cedula: u.cedula || 'N/A',
                telefono: u.telefono || '',
                bancoNombre: u.bancoNombre || '',
                numeroCuenta: u.numeroCuenta || '',
                cedulaPagoMovil: u.cedulaPagoMovil || '',
                telefonoPagoMovil: u.telefonoPagoMovil || '',
                rol: rol,
                rolNombre: rolNombre,
                modalidad: modalidad,
                tipoPago: tipoPago,
                litros: litros,
                viajes: viajes,
                tarifa: tarifa,
                bruto: bruto,
                adelantos: adelantos,
                descLeche: descLeche,
                netoUSD: netoUSD,
                netoBs: netoBs,
                estado: estado,
                pagoId: pagoReg ? pagoReg.id : null,
                pagoData: pagoReg || null,
                calcData: calc || null
            });
        });

        cacheCalculoPagosUsuarios = listaFinal;
        renderTablaPagosUsuarios(listaFinal);

    } catch (err) {
        console.error('Error al calcular pagos de usuarios:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos: ${err.message}</td></tr>`;
        }
    }
}
window.cargarCalculoPagosUsuarios = cargarCalculoPagosUsuarios;

function filtrarTablaPagosUsuarios() {
    const filtroRol = document.getElementById('filtroTipoBeneficiarioPagos')?.value || '';
    const filtroEstado = document.getElementById('filtroEstadoPagosUsuarios')?.value || '';

    let filtrados = cacheCalculoPagosUsuarios || [];

    if (filtroRol) {
        filtrados = filtrados.filter(item => {
            if (filtroRol === 'CHOFER') return item.rol === 'CHOFER' || item.rol.includes('CONDUCTOR');
            if (filtroRol === 'MATERA') return item.rol === 'MATERA' || item.rol.includes('MATERA');
            if (filtroRol === 'PERSONAL') return item.rol !== 'CHOFER' && item.rol !== 'MATERA';
            return true;
        });
    }

    if (filtroEstado) {
        filtrados = filtrados.filter(item => item.estado === filtroEstado);
    }

    renderTablaPagosUsuarios(filtrados);
}
window.filtrarTablaPagosUsuarios = filtrarTablaPagosUsuarios;

function renderTablaPagosUsuarios(items) {
    const tbody = document.getElementById('tbodyPagosUsuariosSemana');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 30px; color: #94a3b8;"><i class="fa-solid fa-users-slash" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No se encontraron trabajadores en este criterio</td></tr>';
        actualizarKpisPagosUsuarios(0, 0, 0, 0, 0, 0);
        return;
    }

    let totBrutoUSD = 0;
    let totNetoUSD = 0;
    let totNetoBs = 0;
    let totLitros = 0;
    let totAdelantos = 0;
    let totDescLeche = 0;

    const htmlRows = items.map(item => {
        totBrutoUSD += (item.bruto || 0);
        totNetoUSD += (item.netoUSD || 0);
        totNetoBs += (item.netoBs || 0);
        totLitros += (item.litros || 0);
        totAdelantos += (item.adelantos || 0);
        totDescLeche += (item.descLeche || 0);

        // Badge de Rol
        let badgeRol = '';
        if (item.rol === 'CHOFER' || item.rol.includes('CONDUCTOR')) {
            badgeRol = `<span class="badge" style="background: rgba(37,99,235,0.12); color: #2563eb; font-weight: 800; border: 1px solid rgba(37,99,235,0.3);"><i class="fa-solid fa-truck"></i> CHOFER</span>`;
        } else if (item.rol === 'MATERA' || item.rol.includes('MATERA')) {
            badgeRol = `<span class="badge" style="background: rgba(16,185,129,0.12); color: #059669; font-weight: 800; border: 1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-cow"></i> MATERA</span>`;
        } else if (item.rol === 'ADMIN' || item.rol === 'ADMINISTRADOR') {
            badgeRol = `<span class="badge" style="background: rgba(220,38,38,0.12); color: #dc2626; font-weight: 800; border: 1px solid rgba(220,38,38,0.3);"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>`;
        } else {
            badgeRol = `<span class="badge" style="background: rgba(147,51,234,0.12); color: #7c3aed; font-weight: 800; border: 1px solid rgba(147,51,234,0.3);"><i class="fa-solid fa-user-tie"></i> ${item.rolNombre || item.rol}</span>`;
        }

        // Badge de Tipo de Pago / Frecuencia
        let badgeTipoPago = '';
        if (item.tipoPago === 'Semanal') {
            badgeTipoPago = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 800; border: 1px solid #bae6fd; font-size: 11px;"><i class="fa-solid fa-calendar-week"></i> SEMANAL</span>`;
        } else {
            badgeTipoPago = `<span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 800; border: 1px solid #a7f3d0; font-size: 11px;"><i class="fa-solid fa-calendar-days"></i> QUINCENAL</span>`;
        }

        // Modalidad / Sueldo
        let modalidadHtml = '';
        if (item.rol === 'CHOFER') {
            modalidadHtml = `<div style="font-weight: 700; color: #0f172a; font-size: 12.5px;">Variado x Flete</div><div style="font-size: 11.5px; font-weight: 800; color: #059669;">$${(item.tarifa || 0).toFixed(4)} / L</div>`;
        } else if (item.rol === 'MATERA') {
            modalidadHtml = `<div style="font-weight: 700; color: #0f172a; font-size: 12.5px;">Fijo / Jornal</div><div style="font-size: 11.5px; color: #64748b;">Quincenal</div>`;
        } else {
            modalidadHtml = `<div style="font-weight: 700; color: #0f172a; font-size: 12.5px;">Sueldo Fijo</div><div style="font-size: 11.5px; color: #64748b;">Nómina</div>`;
        }

        // Producción / Base
        let produccionHtml = '';
        if (item.rol === 'CHOFER') {
            produccionHtml = `<div style="font-weight: 800; color: #0284c7; font-size: 13px;">${(item.litros || 0).toLocaleString('de-DE')} L</div><div style="font-size: 11px; color: #64748b;">${item.viajes || 0} viajes</div>`;
        } else {
            produccionHtml = `<div style="font-weight: 700; color: #475569; font-size: 12px;">Período Quincenal</div>`;
        }

        // Estado del Pago
        let estadoBadge = '';
        if (item.estado === 'PAGADO') {
            estadoBadge = `<span class="badge badge-success" style="font-size: 11px; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> PAGADO</span>`;
        } else {
            estadoBadge = `<span class="badge badge-warning" style="font-size: 11px; font-weight: 800;"><i class="fa-solid fa-clock"></i> PENDIENTE</span>`;
        }

        // Datos bancarios resumen
        let bancoInfo = '';
        if (item.bancoNombre || item.numeroCuenta) {
            bancoInfo = `<div style="font-size: 11px; color: #64748b; margin-top: 2px;"><i class="fa-solid fa-building-columns" style="color: #94a3b8;"></i> ${item.bancoNombre || ''} ${item.numeroCuenta ? '...' + item.numeroCuenta.slice(-4) : ''}</div>`;
        }

        // Botones de acciones
        let accionesHtml = '';
        if (item.estado === 'PAGADO') {
            accionesHtml = `
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button type="button" class="btn-icon" onclick="imprimirReciboPagoUsuario(${item.usuarioId})" title="Ver Comprobante / Recibo" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; width: 32px; height: 32px; border-radius: 6px;">
                        <i class="fa-solid fa-receipt"></i>
                    </button>
                    <button type="button" class="btn-icon" onclick="anularPagoUsuario(${item.pagoId})" title="Anular Pago" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; width: 32px; height: 32px; border-radius: 6px;">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                </div>
            `;
        } else {
            accionesHtml = `
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button type="button" class="btn btn-primary" onclick="abrirModalPagarUsuario(${item.usuarioId}, ${item.litros || 0}, ${item.tarifa || 0}, ${item.bruto || 0}, ${item.adelantos || 0}, ${item.descLeche || 0})" style="padding: 4px 10px; font-size: 12px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
                        <i class="fa-solid fa-hand-holding-dollar"></i> Pagar
                    </button>
                </div>
            `;
        }

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="padding: 12px 14px;">
                    <div style="font-weight: 800; color: #0f172a; font-size: 13.5px;">${item.nombreCompleto}</div>
                    <div style="font-size: 11.5px; color: #64748b;">CI: ${item.cedula} ${item.telefono ? ' | Tel: ' + item.telefono : ''}</div>
                    ${bancoInfo}
                </td>
                <td style="padding: 12px; text-align: center;">${badgeRol}</td>
                <td style="padding: 12px; text-align: center;">${modalidadHtml}</td>
                <td style="padding: 12px; text-align: center;">${badgeTipoPago}</td>
                <td style="padding: 12px; text-align: right;">${produccionHtml}</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13.5px;">$ ${(item.bruto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 12px; text-align: right; font-weight: 700; color: #d97706; font-size: 13px;">${item.adelantos > 0 ? '-$ ' + (item.adelantos).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$ 0.00'}</td>
                <td style="padding: 12px; text-align: right; background: rgba(241, 245, 249, 0.6);">
                    <div style="font-weight: 900; color: #0f172a; font-size: 14px;">$ ${(item.netoUSD || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style="font-size: 11.5px; font-weight: 800; color: #059669;">Bs. ${(item.netoBs || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                <td style="padding: 12px; text-align: center;">${estadoBadge}</td>
                <td style="padding: 12px; text-align: center;">${accionesHtml}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = htmlRows;
    actualizarKpisPagosUsuarios(totBrutoUSD, totNetoBs, totLitros, totAdelantos, totDescLeche, items.length);
}

function actualizarKpisPagosUsuarios(totalUSD, totalBs, totalLitros, totalAdelantos, totalDescLeche, count) {
    const kpiUSD = document.getElementById('kpiPagosUsuariosTotalUSD');
    const kpiBs = document.getElementById('kpiPagosUsuariosTotalBs');
    const kpiLitros = document.getElementById('kpiPagosUsuariosTotalLitros');
    const kpiAdel = document.getElementById('kpiPagosUsuariosTotalAdelantos');
    const kpiDesc = document.getElementById('kpiPagosUsuariosTotalDescLeche');
    const badgeCount = document.getElementById('badgeTotalItemsPagosUsuarios');

    if (kpiUSD) kpiUSD.textContent = `$ ${totalUSD.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiBs) kpiBs.textContent = `Bs. ${totalBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiLitros) kpiLitros.textContent = `${totalLitros.toLocaleString('de-DE')} L`;
    if (kpiAdel) kpiAdel.textContent = `-$ ${totalAdelantos.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiDesc) kpiDesc.textContent = `-$ ${totalDescLeche.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (badgeCount) badgeCount.textContent = `${count} Trabajadores`;
}

function abrirModalLiquidarPagoDirecto() {
    const selCiclo = document.getElementById('filtroCicloPagosUsuarios');
    const cicloId = selCiclo ? selCiclo.value : '';
    abrirModalPagarUsuario(null, 0, 0, 0, 0, 0, cicloId);
}
window.abrirModalLiquidarPagoDirecto = abrirModalLiquidarPagoDirecto;

function abrirModalPagarUsuario(userId, litros = 0, tarifa = 0, bruto = 0, adelantos = 0, descLeche = 0, defaultCicloId = null) {
    const modal = document.getElementById('modalLiquidarPagoUsuario');
    if (!modal) return;

    document.getElementById('modalPagoUsuarioId').value = userId || '';
    const selUser = document.getElementById('modalPagoSelectUsuario');
    if (selUser && userId) selUser.value = userId;

    const selCiclo = document.getElementById('modalPagoSelectCiclo');
    const filtroCiclo = document.getElementById('filtroCicloPagosUsuarios');
    if (selCiclo) {
        selCiclo.value = defaultCicloId || (filtroCiclo ? filtroCiclo.value : '');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const inpFecha = document.getElementById('modalPagoFecha');
    if (inpFecha) inpFecha.value = todayStr;

    const tasaBcvVal = (state.tasaBcvHoy && state.tasaBcvHoy.tasa) ? state.tasaBcvHoy.tasa : 1;
    const inpTasa = document.getElementById('modalPagoTasaBcv');
    if (inpTasa) inpTasa.value = tasaBcvVal;

    document.getElementById('modalPagoTotalLitros').value = litros || 0;
    document.getElementById('modalPagoTarifaLitro').value = tarifa || 0;
    document.getElementById('modalPagoMontoFijo').value = (bruto && !litros) ? bruto : 0;
    document.getElementById('modalPagoTotalAdelantos').value = adelantos || 0;
    document.getElementById('modalPagoDescuentoLecheUSD').value = descLeche || 0;
    document.getElementById('modalPagoOtrasDeduccionesUSD').value = 0;

    if (userId) {
        onCambioUsuarioEnModalPago(userId);
    } else {
        recalcularTotalesModalPago();
    }

    modal.style.display = 'flex';
}
window.abrirModalPagarUsuario = abrirModalPagarUsuario;

async function onCambioUsuarioEnModalPago(userId) {
    if (!userId) {
        recalcularTotalesModalPago();
        return;
    }
    const u = (state.usuarios || []).find(x => x.id === parseInt(userId));
    if (u) {
        const selRol = document.getElementById('modalPagoTipoBeneficiario');
        if (selRol) {
            if (u.rol === 'CHOFER') selRol.value = 'CHOFER';
            else if (u.rol === 'MATERA') selRol.value = 'MATERA';
            else selRol.value = 'PERSONAL';
        }

        const inpTarifa = document.getElementById('modalPagoTarifaLitro');
        if (inpTarifa && (!inpTarifa.value || parseFloat(inpTarifa.value) === 0)) {
            inpTarifa.value = u.tarifaPorLitro || 0;
        }

        const inpBanco = document.getElementById('modalPagoBancoDestino');
        if (inpBanco) inpBanco.value = u.bancoNombre || '';
    }

    // Consultar cuotas de adelantos del usuario
    const contenedorCuotas = document.getElementById('contenedorListaCuotasAdelantoPago');
    const lblTotalSaldo = document.getElementById('lblTotalAdelantoPendienteUser');
    try {
        const resp = await fetch(`${API_BASE}/pagos-usuarios/adelantos?usuarioId=${userId}&estado=APROBADO`, { headers: getAuthHeaders() });
        if (resp.ok) {
            const adelantos = await resp.json();
            if (adelantos && adelantos.length > 0) {
                let htmlCuotas = '';
                let totalSaldo = 0;
                adelantos.forEach(a => {
                    const saldo = a.saldoPendienteUSD || (a.montoTotalUSD - (a.montoAmortizadoUSD || 0));
                    totalSaldo += saldo;
                    htmlCuotas += `<div style="padding: 4px 0; border-bottom: 1px dashed #fde68a;">📌 Adelanto #${a.id}: Saldo $${saldo.toFixed(2)} (${a.observacion || 'Sin nota'})</div>`;
                });
                if (contenedorCuotas) contenedorCuotas.innerHTML = htmlCuotas;
                if (lblTotalSaldo) lblTotalSaldo.textContent = `Saldo Total: $${totalSaldo.toFixed(2)}`;
            } else {
                if (contenedorCuotas) contenedorCuotas.innerHTML = '<em>No tiene adelantos pendientes por descontar</em>';
                if (lblTotalSaldo) lblTotalSaldo.textContent = 'Saldo: $0.00';
            }
        }
    } catch (e) {
        console.warn('Error al cargar adelantos de usuario en modal:', e);
    }

    recalcularTotalesModalPago();
}
window.onCambioUsuarioEnModalPago = onCambioUsuarioEnModalPago;

function recalcularTotalesModalPago() {
    const litros = parseFloat(document.getElementById('modalPagoTotalLitros')?.value) || 0;
    const tarifa = parseFloat(document.getElementById('modalPagoTarifaLitro')?.value) || 0;
    const montoFijo = parseFloat(document.getElementById('modalPagoMontoFijo')?.value) || 0;

    let bruto = (litros * tarifa) + montoFijo;
    bruto = Math.round(bruto * 100) / 100;

    const adelantos = parseFloat(document.getElementById('modalPagoTotalAdelantos')?.value) || 0;
    const descLeche = parseFloat(document.getElementById('modalPagoDescuentoLecheUSD')?.value) || 0;
    const otrasDeduc = parseFloat(document.getElementById('modalPagoOtrasDeduccionesUSD')?.value) || 0;

    const totalDeducciones = adelantos + descLeche + otrasDeduc;
    const netoUSD = Math.max(0, bruto - totalDeducciones);

    const tasaBcv = parseFloat(document.getElementById('modalPagoTasaBcv')?.value) || ((state.tasaBcvHoy && state.tasaBcvHoy.tasa) ? state.tasaBcvHoy.tasa : 1);
    const netoBs = netoUSD * tasaBcv;

    const lblBruto = document.getElementById('lblPagoTotalBrutoUSD');
    const lblNetoUSD = document.getElementById('lblPagoTotalNetoUSD');
    const lblNetoBs = document.getElementById('lblPagoTotalNetoBs');

    if (lblBruto) lblBruto.textContent = `$ ${bruto.toFixed(2)}`;
    if (lblNetoUSD) lblNetoUSD.textContent = `$ ${netoUSD.toFixed(2)}`;
    if (lblNetoBs) lblNetoBs.textContent = `Bs. ${netoBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
window.recalcularTotalesModalPago = recalcularTotalesModalPago;

async function guardarPagoUsuarioSubmit(e) {
    e.preventDefault();
    const selUser = document.getElementById('modalPagoSelectUsuario');
    const usuarioId = parseInt(selUser ? selUser.value : 0);
    if (!usuarioId || usuarioId <= 0) {
        Swal.fire({ icon: 'warning', title: 'Seleccionar Beneficiario', text: 'Debe seleccionar el trabajador a liquidar', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const cicloIdVal = document.getElementById('modalPagoSelectCiclo')?.value;
    const cicloId = cicloIdVal ? parseInt(cicloIdVal) : null;
    const fechaPago = document.getElementById('modalPagoFecha')?.value || new Date().toISOString().split('T')[0];
    const tipoBeneficiario = document.getElementById('modalPagoTipoBeneficiario')?.value || 'CHOFER';
    const tasaBcv = parseFloat(document.getElementById('modalPagoTasaBcv')?.value) || 1;

    const totalLitros = parseFloat(document.getElementById('modalPagoTotalLitros')?.value) || 0;
    const tarifaPorLitroUSD = parseFloat(document.getElementById('modalPagoTarifaLitro')?.value) || 0;
    const montoFijoUSD = parseFloat(document.getElementById('modalPagoMontoFijo')?.value) || 0;

    const totalAdelantosUSD = parseFloat(document.getElementById('modalPagoTotalAdelantos')?.value) || 0;
    const descuentoLecheUSD = parseFloat(document.getElementById('modalPagoDescuentoLecheUSD')?.value) || 0;
    const conceptoDescuentoLeche = document.getElementById('modalPagoConceptoDescLeche')?.value || '';
    const otrasDeduccionesUSD = parseFloat(document.getElementById('modalPagoOtrasDeduccionesUSD')?.value) || 0;
    const conceptoDeducciones = document.getElementById('modalPagoConceptoDeducciones')?.value || '';

    const metodoPago = document.getElementById('modalPagoMetodoPago')?.value || 'TRANSFERENCIA';
    const bancoDestino = document.getElementById('modalPagoBancoDestino')?.value || '';
    const numeroReferencia = document.getElementById('modalPagoNumeroReferencia')?.value || '';
    const observaciones = document.getElementById('modalPagoObservaciones')?.value || '';

    const payload = {
        usuarioId,
        cicloId,
        tipoBeneficiario,
        fechaPago,
        totalLitros,
        tarifaPorLitroUSD,
        montoFijoUSD,
        tasaBcv,
        totalAdelantosUSD,
        descuentoLecheUSD,
        conceptoDescuentoLeche,
        otrasDeduccionesUSD,
        conceptoDeducciones,
        metodoPago,
        bancoDestino,
        numeroReferencia,
        observaciones
    };

    try {
        const resp = await fetch(`${API_BASE}/pagos-usuarios`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al procesar el pago');
        }

        cerrarModalCustom('modalLiquidarPagoUsuario');

        Swal.fire({
            icon: 'success',
            title: '¡Pago Procesado Exitosamente!',
            text: 'La liquidación ha sido registrada y deducida de la nómina correctamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        await cargarCalculoPagosUsuarios();

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Procesar Pago',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.guardarPagoUsuarioSubmit = guardarPagoUsuarioSubmit;

async function anularPagoUsuario(pagoId) {
    if (!pagoId) return;
    const { value: motivo } = await Swal.fire({
        title: '¿Anular este Pago?',
        text: 'Esta acción revertirá los adelantos amortizados y cambiará el estado a ANULADO.',
        input: 'text',
        inputPlaceholder: 'Ingrese motivo de anulación...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Anular Pago',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        background: '#1e293b',
        color: '#f8fafc',
        inputValidator: (value) => {
            if (!value) return '¡El motivo de anulación es obligatorio para la auditoría!';
        }
    });

    if (motivo) {
        try {
            const resp = await fetch(`${API_BASE}/pagos-usuarios/${pagoId}?motivo=${encodeURIComponent(motivo)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message || 'Error al anular pago');
            }

            Swal.fire({ icon: 'success', title: 'Pago Anulado', text: 'El comprobante ha sido anulado con éxito.', background: '#1e293b', color: '#f8fafc', timer: 1800, showConfirmButton: false });
            await cargarCalculoPagosUsuarios();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message, background: '#1e293b', color: '#f8fafc' });
        }
    }
}
window.anularPagoUsuario = anularPagoUsuario;

function imprimirReciboPagoUsuario(userId) {
    const item = (cacheCalculoPagosUsuarios || []).find(x => x.usuarioId === userId);
    if (!item) return;

    const p = item.pagoData || item;
    const netoUSD = (item.netoUSD || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const netoBs = (item.netoBs || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brutoUSD = (item.bruto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const adelUSD = (item.adelantos || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const htmlRecibo = `
        <div style="text-align: left; font-family: 'Inter', sans-serif; padding: 10px; color: #1e293b;">
            <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 800;">🥛 RUTAS DE LECHE</h3>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">Comprobante de Pago de Nómina &amp; Flete</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 14px;">
                <div><strong>Trabajador:</strong> ${item.nombreCompleto}</div>
                <div><strong>Cédula:</strong> ${item.cedula}</div>
                <div><strong>Cargo / Rol:</strong> ${item.rol}</div>
                <div><strong>Tipo Pago:</strong> ${item.tipoPago}</div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 14px;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                        <th style="padding: 8px; text-align: left;">Concepto</th>
                        <th style="padding: 8px; text-align: right;">Base / Litros</th>
                        <th style="padding: 8px; text-align: right;">Monto USD</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">Flete / Sueldo Devengado</td>
                        <td style="padding: 8px; text-align: right;">${item.litros ? item.litros.toLocaleString('de-DE') + ' L' : 'Período'}</td>
                        <td style="padding: 8px; text-align: right; font-weight: 700;">$ ${brutoUSD}</td>
                    </tr>
                    ${item.adelantos > 0 ? `
                    <tr style="border-bottom: 1px solid #e2e8f0; color: #d97706;">
                        <td style="padding: 8px;">Amortización Adelanto / Préstamo</td>
                        <td style="padding: 8px; text-align: right;">-</td>
                        <td style="padding: 8px; text-align: right; font-weight: 700;">-$ ${adelUSD}</td>
                    </tr>` : ''}
                </tbody>
                <tfoot>
                    <tr style="background: #0f172a; color: #ffffff; font-size: 14px; font-weight: 900;">
                        <td style="padding: 10px;" colspan="2">TOTAL NETO PAGADO</td>
                        <td style="padding: 10px; text-align: right;">$ ${netoUSD}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px; text-align: center; font-weight: 800; color: #047857; font-size: 14px; margin-bottom: 14px;">
                Monto en Bolívares: Bs. ${netoBs}
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #94a3b8; text-align: center;">
                <div style="width: 45%;">Firma de Conforme Trabajador</div>
                <div style="width: 45%;">Firma Administración</div>
            </div>
        </div>
    `;

    Swal.fire({
        html: htmlRecibo,
        width: 520,
        showCloseButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-print"></i> Imprimir',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#2563eb',
        background: '#ffffff',
        didOpen: () => {
            const confirmBtn = Swal.getConfirmButton();
            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    const win = window.open('', '_blank');
                    win.document.write(`<html><head><title>Recibo de Pago</title></head><body onload="window.print();window.close();">${htmlRecibo}</body></html>`);
                    win.document.close();
                };
            }
        }
    });
}
window.imprimirReciboPagoUsuario = imprimirReciboPagoUsuario;

function exportarNominaPagosExcel() {
    const items = cacheCalculoPagosUsuarios || [];
    if (items.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin Datos', text: 'No hay registros en la tabla de pagos para exportar', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const selCiclo = document.getElementById('filtroCicloPagosUsuarios');
    const semanaTexto = selCiclo && selCiclo.options[selCiclo.selectedIndex] ? selCiclo.options[selCiclo.selectedIndex].text : 'Nómina';

    let filasHtml = items.map(item => `
        <tr>
            <td class="excel-td excel-td-left">${item.nombreCompleto}</td>
            <td class="excel-td excel-td-center">${item.cedula}</td>
            <td class="excel-td excel-td-center">${item.rol}</td>
            <td class="excel-td excel-td-center">${item.tipoPago}</td>
            <td class="excel-td excel-td-left">${item.modalidad}</td>
            <td class="excel-td excel-td-num">${(item.litros || 0).toLocaleString('de-DE')}</td>
            <td class="excel-td excel-td-currency">$ ${(item.tarifa || 0).toFixed(4)}</td>
            <td class="excel-td excel-td-currency">$ ${(item.bruto || 0).toFixed(2)}</td>
            <td class="excel-td excel-td-currency" style="color: #d97706;">$ ${(item.adelantos || 0).toFixed(2)}</td>
            <td class="excel-td excel-td-bold excel-td-currency">$ ${(item.netoUSD || 0).toFixed(2)}</td>
            <td class="excel-td excel-td-bold excel-td-currency">Bs. ${(item.netoBs || 0).toFixed(2)}</td>
            <td class="excel-td excel-td-center">${item.estado}</td>
        </tr>
    `).join('');

    const tablasHtml = `
        <table>
            <thead>
                <tr>
                    <th colspan="12" class="excel-sec-header">TABLA DE PAGOS &amp; NÓMINA DE PERSONAL - ${semanaTexto}</th>
                </tr>
                <tr>
                    <th class="excel-th">TRABAJADOR</th>
                    <th class="excel-th">CÉDULA</th>
                    <th class="excel-th">ROL</th>
                    <th class="excel-th">TIPO PAGO</th>
                    <th class="excel-th">MODALIDAD</th>
                    <th class="excel-th">LITROS SEMANA</th>
                    <th class="excel-th">TARIFA ($/L)</th>
                    <th class="excel-th">BRUTO ($)</th>
                    <th class="excel-th">ADELANTOS ($)</th>
                    <th class="excel-th">NETO ($)</th>
                    <th class="excel-th">NETO (Bs)</th>
                    <th class="excel-th">ESTADO</th>
                </tr>
            </thead>
            <tbody>
                ${filasHtml}
            </tbody>
        </table>
    `;

    descargarExcelConDiseno(tablasHtml, `NOMINA_PAGOS_PERSONAL_${new Date().toISOString().split('T')[0]}`, 'TABLA DE PAGOS');
}
window.exportarNominaPagosExcel = exportarNominaPagosExcel;

// =========================================================================
// MÓDULO: CONFIGURACIÓN DE SUELDOS, TARIFAS Y DATOS DE PAGO POR TRABAJADOR
// =========================================================================

function cambiarSubTabPagos(subtab) {
    const vistaSemanales = document.getElementById('vistaSubTabPagosSemanales');
    const vistaConfig = document.getElementById('vistaSubTabConfigSueldos');
    const btnSemanales = document.getElementById('btnSubTabPagosSemanales');
    const btnConfig = document.getElementById('btnSubTabConfigSueldos');

    if (subtab === 'config') {
        if (vistaSemanales) vistaSemanales.style.display = 'none';
        if (vistaConfig) vistaConfig.style.display = 'block';

        if (btnSemanales) {
            btnSemanales.className = 'btn btn-sm btn-outline';
            btnSemanales.style.background = '#ffffff';
            btnSemanales.style.color = '#475569';
            btnSemanales.style.borderColor = '#cbd5e1';
        }
        if (btnConfig) {
            btnConfig.className = 'btn btn-sm btn-primary';
            btnConfig.style.background = 'linear-gradient(135deg, #0284c7, #2563eb)';
            btnConfig.style.color = '#ffffff';
            btnConfig.style.borderColor = 'transparent';
        }

        cargarConfigSueldosUsuarios();
    } else {
        if (vistaSemanales) vistaSemanales.style.display = 'block';
        if (vistaConfig) vistaConfig.style.display = 'none';

        if (btnSemanales) {
            btnSemanales.className = 'btn btn-sm btn-primary';
            btnSemanales.style.background = 'linear-gradient(135deg, #0284c7, #2563eb)';
            btnSemanales.style.color = '#ffffff';
            btnSemanales.style.borderColor = 'transparent';
        }
        if (btnConfig) {
            btnConfig.className = 'btn btn-sm btn-outline';
            btnConfig.style.background = '#ffffff';
            btnConfig.style.color = '#475569';
            btnConfig.style.borderColor = '#cbd5e1';
        }

        cargarCalculoPagosUsuarios();
    }
}
window.cambiarSubTabPagos = cambiarSubTabPagos;

async function cargarConfigSueldosUsuarios() {
    const tbody = document.getElementById('tbodyConfigSueldosUsuarios');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando perfiles salariales...</td></tr>';
    }

    try {
        const resp = await fetch(`${API_BASE}/usuarios`, { headers: getAuthHeaders() });
        if (resp.ok) {
            const users = await resp.json();
            state.usuarios = users;
            renderTablaConfigSueldos(users);
        } else {
            throw new Error('No se pudo obtener el catálogo de trabajadores');
        }
    } catch (err) {
        console.error('Error al cargar configuración salarial:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</td></tr>`;
        }
    }
}
window.cargarConfigSueldosUsuarios = cargarConfigSueldosUsuarios;

function renderTablaConfigSueldos(users) {
    const tbody = document.getElementById('tbodyConfigSueldosUsuarios');
    if (!tbody) return;

    const lista = (users || []).filter(u => !u.isDeleted);
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;">No se encontraron trabajadores registrados</td></tr>';
        return;
    }

    const html = lista.map(u => {
        const rol = (u.rol || 'USUARIO').toUpperCase();
        let badgeRol = '';
        if (rol === 'CHOFER') {
            badgeRol = `<span class="badge" style="background: rgba(37,99,235,0.12); color: #2563eb; font-weight: 800; border: 1px solid rgba(37,99,235,0.3);"><i class="fa-solid fa-truck"></i> CHOFER</span>`;
        } else if (rol === 'MATERA') {
            badgeRol = `<span class="badge" style="background: rgba(16,185,129,0.12); color: #059669; font-weight: 800; border: 1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-cow"></i> MATERA</span>`;
        } else {
            badgeRol = `<span class="badge" style="background: rgba(147,51,234,0.12); color: #7c3aed; font-weight: 800; border: 1px solid rgba(147,51,234,0.3);">${u.rolNombre || rol}</span>`;
        }

        const freq = u.frecuenciaPago || (rol === 'MATERA' ? 'Quincenal' : 'Semanal');
        const badgeFreq = freq === 'Semanal' 
            ? `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 800; border: 1px solid #bae6fd;"><i class="fa-solid fa-calendar-week"></i> SEMANAL</span>`
            : `<span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 800; border: 1px solid #a7f3d0;"><i class="fa-solid fa-calendar-days"></i> QUINCENAL</span>`;

        const tipoModalidad = u.tipoPago || (rol === 'MATERA' ? 'Fijo' : 'Variado');
        let modalidadHtml = '';
        if (tipoModalidad === 'Fijo') {
            modalidadHtml = `<span style="font-weight: 700; color: #0f172a;"><i class="fa-solid fa-file-invoice-dollar" style="color: #0284c7;"></i> Sueldo Fijo</span>`;
        } else if (tipoModalidad === 'Mixto') {
            modalidadHtml = `<span style="font-weight: 700; color: #7c3aed;"><i class="fa-solid fa-layer-group"></i> Mixto (Fijo + Flete)</span>`;
        } else {
            modalidadHtml = `<span style="font-weight: 700; color: #059669;"><i class="fa-solid fa-truck-ramp-box"></i> Variado x Flete</span>`;
        }

        const sueldoBase = u.sueldoBase ? `$ ${parseFloat(u.sueldoBase).toFixed(2)}` : '$ 0.00';
        const tarifa = u.tarifaPorLitro ? `$ ${parseFloat(u.tarifaPorLitro).toFixed(4)} / L` : '$ 0.0000 / L';

        let bancoHtml = '';
        if (u.bancoNombre || u.numeroCuenta) {
            bancoHtml += `<div><strong>${u.bancoNombre || 'Banco'}:</strong> ${u.numeroCuenta || '-'}</div>`;
        }
        if (u.cedulaPagoMovil || u.telefonoPagoMovil) {
            bancoHtml += `<div style="font-size: 11px; color: #0284c7;"><i class="fa-solid fa-mobile-screen"></i> PM: ${u.cedulaPagoMovil || ''} ${u.telefonoPagoMovil || ''}</div>`;
        }
        if (!bancoHtml) bancoHtml = '<span style="color: #94a3b8; font-style: italic;">Sin datos bancarios</span>';

        const estadoBadge = u.activo !== false
            ? `<span class="badge badge-success" style="font-size: 11px;">ACTIVO</span>`
            : `<span class="badge badge-secondary" style="font-size: 11px;">INACTIVO</span>`;

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="padding: 12px 14px;">
                    <div style="font-weight: 800; color: #0f172a; font-size: 13.5px;">${u.nombreCompleto || u.username}</div>
                    <div style="font-size: 11.5px; color: #64748b;">Usuario: @${u.username}</div>
                </td>
                <td style="padding: 12px; text-align: center; font-size: 12px;">
                    <div><strong>CI:</strong> ${u.cedula || 'N/A'}</div>
                    <div style="color: #64748b;"><strong>Tel:</strong> ${u.telefono || 'N/A'}</div>
                </td>
                <td style="padding: 12px; text-align: center;">${badgeRol}</td>
                <td style="padding: 12px; text-align: center;">${badgeFreq}</td>
                <td style="padding: 12px; text-align: center;">${modalidadHtml}</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13.5px;">${sueldoBase}</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #0284c7; font-size: 13px;">${tarifa}</td>
                <td style="padding: 12px; font-size: 11.5px; color: #334155;">${bancoHtml}</td>
                <td style="padding: 12px; text-align: center;">${estadoBadge}</td>
                <td style="padding: 12px; text-align: center;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalConfigurarSueldoTrabajador(${u.id})" style="font-size: 12px; font-weight: 800; color: #0284c7; border-color: #bae6fd; background: #f0f9ff; padding: 5px 10px; border-radius: 6px;">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

function abrirModalConfigurarSueldoTrabajador(userId = null) {
    const modal = document.getElementById('modalConfigurarSueldoTrabajador');
    if (!modal) return;

    const selUser = document.getElementById('modalConfigSelectUsuario');
    if (selUser && state.usuarios && state.usuarios.length > 0) {
        selUser.innerHTML = '<option value="">-- Seleccionar Trabajador --</option>' + state.usuarios.map(u => {
            const rolTxt = u.rol || 'USUARIO';
            return `<option value="${u.id}">${u.nombreCompleto || u.username} [${rolTxt}]</option>`;
        }).join('');
    }

    if (userId) {
        if (selUser) selUser.value = userId;
        cargarDatosConfigUsuarioEnModal(userId);
    } else {
        document.getElementById('modalConfigUserId').value = '';
        document.getElementById('modalConfigRol').value = '';
        document.getElementById('modalConfigSueldoBase').value = '';
        document.getElementById('modalConfigTarifaPorLitro').value = '';
        document.getElementById('modalConfigBancoNombre').value = '';
        document.getElementById('modalConfigNumeroCuenta').value = '';
        document.getElementById('modalConfigCedulaPagoMovil').value = '';
        document.getElementById('modalConfigTelefonoPagoMovil').value = '';
    }

    modal.style.display = 'flex';
}
window.abrirModalConfigurarSueldoTrabajador = abrirModalConfigurarSueldoTrabajador;

function cargarDatosConfigUsuarioEnModal(userId) {
    if (!userId) return;
    const u = (state.usuarios || []).find(x => x.id === parseInt(userId));
    if (!u) return;

    document.getElementById('modalConfigUserId').value = u.id;
    document.getElementById('modalConfigRol').value = u.rol || 'CHOFER';
    
    const selFreq = document.getElementById('modalConfigFrecuenciaPago');
    if (selFreq) {
        selFreq.value = u.frecuenciaPago || (u.rol === 'MATERA' ? 'Quincenal' : 'Semanal');
    }

    const selTipo = document.getElementById('modalConfigTipoPago');
    if (selTipo) {
        selTipo.value = u.tipoPago || (u.rol === 'MATERA' ? 'Fijo' : 'Variado');
    }

    document.getElementById('modalConfigSueldoBase').value = u.sueldoBase || 0;
    document.getElementById('modalConfigTarifaPorLitro').value = u.tarifaPorLitro || 0;
    document.getElementById('modalConfigBancoNombre').value = u.bancoNombre || '';
    document.getElementById('modalConfigNumeroCuenta').value = u.numeroCuenta || '';
    document.getElementById('modalConfigCedulaPagoMovil').value = u.cedulaPagoMovil || '';
    document.getElementById('modalConfigTelefonoPagoMovil').value = u.telefonoPagoMovil || '';
}
window.cargarDatosConfigUsuarioEnModal = cargarDatosConfigUsuarioEnModal;

async function guardarConfiguracionSueldoSubmit(e) {
    e.preventDefault();
    const selUser = document.getElementById('modalConfigSelectUsuario');
    const userId = parseInt(document.getElementById('modalConfigUserId')?.value || (selUser ? selUser.value : 0));

    if (!userId || userId <= 0) {
        Swal.fire({ icon: 'warning', title: 'Seleccionar Trabajador', text: 'Debe seleccionar el trabajador a configurar', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const u = (state.usuarios || []).find(x => x.id === userId);
    if (!u) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Trabajador no encontrado en el sistema', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const frecuenciaPago = document.getElementById('modalConfigFrecuenciaPago')?.value || 'Semanal';
    const tipoPago = document.getElementById('modalConfigTipoPago')?.value || 'Variado';
    const sueldoBase = parseFloat(document.getElementById('modalConfigSueldoBase')?.value) || 0;
    const tarifaPorLitro = parseFloat(document.getElementById('modalConfigTarifaPorLitro')?.value) || 0;
    const bancoNombre = document.getElementById('modalConfigBancoNombre')?.value || '';
    const numeroCuenta = document.getElementById('modalConfigNumeroCuenta')?.value || '';
    const cedulaPagoMovil = document.getElementById('modalConfigCedulaPagoMovil')?.value || '';
    const telefonoPagoMovil = document.getElementById('modalConfigTelefonoPagoMovil')?.value || '';

    const payload = {
        nombreCompleto: u.nombreCompleto,
        cedula: u.cedula,
        telefono: u.telefono,
        rol: u.rol,
        rolId: u.rolId,
        sueldoBase: sueldoBase,
        tarifaPorLitro: tarifaPorLitro,
        frecuenciaPago: frecuenciaPago,
        tipoPago: tipoPago,
        bancoNombre: bancoNombre,
        numeroCuenta: numeroCuenta,
        cedulaPagoMovil: cedulaPagoMovil,
        telefonoPagoMovil: telefonoPagoMovil
    };

    try {
        const resp = await fetch(`${API_BASE}/usuarios/${userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al actualizar perfil salarial');
        }

        cerrarModalCustom('modalConfigurarSueldoTrabajador');

        Swal.fire({
            icon: 'success',
            title: '¡Perfil Salarial Guardado!',
            text: 'Los sueldos, tarifas y datos de pago se han actualizado exitosamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        // Refrescar catálogo y tablas
        const respUsers = await fetch(`${API_BASE}/usuarios`, { headers: getAuthHeaders() });
        if (respUsers.ok) state.usuarios = await respUsers.json();

        cargarConfigSueldosUsuarios();
        cargarCalculoPagosUsuarios();

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.guardarConfiguracionSueldoSubmit = guardarConfiguracionSueldoSubmit;

// =========================================================================
// MÓDULO: ADELANTOS & PRÉSTAMOS DE PERSONAL / USUARIOS
// =========================================================================

var cacheAdelantosUsuarios = window.cacheAdelantosUsuarios || [];

async function abrirModalCrearAdelantoUsuario() {
    const selUser = document.getElementById('modalAdelantoSelectUsuario');
    if (selUser) {
        selUser.innerHTML = '<option value="">-- Cargando trabajadores... --</option>';
        if (!state.usuarios || state.usuarios.length === 0) {
            try {
                const resp = await fetch(`${API_BASE}/usuarios`, { headers: getAuthHeaders() });
                if (resp.ok) state.usuarios = await resp.json();
            } catch (e) {
                console.warn('Error al cargar catálogo de usuarios:', e);
            }
        }

        const lista = (state.usuarios || []).filter(u => !u.isDeleted);
        selUser.innerHTML = '<option value="">-- Seleccionar Trabajador --</option>' + lista.map(u => {
            const rolTxt = u.rol || 'USUARIO';
            const ciTxt = u.cedula ? ` - CI: ${u.cedula}` : '';
            return `<option value="${u.id}">${u.nombreCompleto || u.username} [${rolTxt}]${ciTxt}</option>`;
        }).join('');
    }

    const inpMonto = document.getElementById('modalAdelantoMontoTotalUSD');
    const inpCuotas = document.getElementById('modalAdelantoNumeroCuotas');
    const inpObs = document.getElementById('modalAdelantoObservacion');

    if (inpMonto) inpMonto.value = '';
    if (inpCuotas) inpCuotas.value = '1';
    if (inpObs) inpObs.value = '';

    calcularCuotaAdelantoUsuarioPreview();
    abrirModalCustom('modalCrearAdelantoUsuarioCustom');
}
window.abrirModalCrearAdelantoUsuario = abrirModalCrearAdelantoUsuario;

function calcularCuotaAdelantoUsuarioPreview() {
    const montoTotal = parseFloat(document.getElementById('modalAdelantoMontoTotalUSD')?.value) || 0;
    const numCuotas = parseInt(document.getElementById('modalAdelantoNumeroCuotas')?.value, 10) || 1;
    const lblPreview = document.getElementById('lblPreviewCuotaAdelantoUsuario');

    if (!lblPreview) return;

    if (montoTotal <= 0 || numCuotas <= 0) {
        lblPreview.innerText = '$0.00 / semana';
        return;
    }

    const cuota = montoTotal / numCuotas;
    lblPreview.innerText = `$ ${formatearNumero(cuota, 2)} / semana`;
}
window.calcularCuotaAdelantoUsuarioPreview = calcularCuotaAdelantoUsuarioPreview;

async function guardarAdelantoUsuarioSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const selUser = document.getElementById('modalAdelantoSelectUsuario');
    const usuarioId = parseInt(selUser ? selUser.value : 0, 10);
    const montoTotalUSD = parseFloat(document.getElementById('modalAdelantoMontoTotalUSD')?.value) || 0;
    const numeroCuotas = parseInt(document.getElementById('modalAdelantoNumeroCuotas')?.value, 10) || 1;
    const observacion = document.getElementById('modalAdelantoObservacion')?.value?.trim() || '';

    if (!usuarioId || usuarioId <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Seleccionar Trabajador',
            text: 'Debes seleccionar el trabajador beneficiario del adelanto.',
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    if (montoTotalUSD <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Monto Inválido',
            text: 'Debes ingresar un monto total en dólares mayor a cero.',
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    const payload = {
        usuarioId,
        montoTotalUSD,
        numeroCuotas: numeroCuotas > 0 ? numeroCuotas : 1,
        observacion
    };

    try {
        const resp = await fetch(`${API_BASE}/pagos-usuarios/adelantos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al registrar el adelanto');
        }

        cerrarModalCustom('modalCrearAdelantoUsuarioCustom');

        Swal.fire({
            icon: 'success',
            title: '¡Préstamo Registrado!',
            text: `Se ha registrado el préstamo de $ ${formatearNumero(montoTotalUSD, 2)} en ${numeroCuotas} cuota(s) exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        await cargarAdelantosUsuarios();
        if (typeof cargarCalculoPagosUsuarios === 'function') {
            await cargarCalculoPagosUsuarios();
        }

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Registrar',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.guardarAdelantoUsuarioSubmit = guardarAdelantoUsuarioSubmit;

async function cargarAdelantosUsuarios() {
    const tbody = document.getElementById('tbodyAdelantosUsuarios');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando préstamos...</td></tr>';
    }

    const filtroEstado = document.getElementById('filtroEstadoAdelantoUsuario')?.value || '';
    let url = `${API_BASE}/pagos-usuarios/adelantos`;
    if (filtroEstado) {
        url += `?estado=${encodeURIComponent(filtroEstado)}`;
    }

    try {
        const resp = await fetch(url, { headers: getAuthHeaders() });
        if (!resp.ok) {
            throw new Error('No se pudo obtener la lista de préstamos.');
        }

        const items = await resp.json();
        cacheAdelantosUsuarios = items || [];

        // Actualizar KPIs
        let totalOtorgado = 0;
        let totalCobrado = 0;
        let totalPendiente = 0;
        let cantPrestamos = cacheAdelantosUsuarios.length;

        cacheAdelantosUsuarios.forEach(a => {
            const mTotal = Number(a.montoTotalUSD || a.MontoTotalUSD || 0);
            const mPag = Number(a.montoPagadoUSD || a.MontoPagadoUSD || 0);
            const mPend = Number(a.montoPendienteUSD || a.MontoPendienteUSD || (mTotal - mPag));
            totalOtorgado += mTotal;
            totalCobrado += mPag;
            totalPendiente += mPend;
        });

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setTxt('kpiTotalAdelantosUsuariosUSD', `$ ${formatearNumero(totalOtorgado, 2)}`);
        setTxt('kpiCantAdelantosUsuarios', `${cantPrestamos} Préstamos registrados`);
        setTxt('kpiTotalCobradoUsuariosUSD', `$ ${formatearNumero(totalCobrado, 2)}`);
        setTxt('kpiTotalPendienteUsuariosUSD', `$ ${formatearNumero(totalPendiente, 2)}`);

        renderTablaAdelantosUsuarios(cacheAdelantosUsuarios);

    } catch (err) {
        console.error('Error al cargar adelantos de usuarios:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</td></tr>`;
        }
    }
}
window.cargarAdelantosUsuarios = cargarAdelantosUsuarios;

function renderTablaAdelantosUsuarios(items) {
    const tbody = document.getElementById('tbodyAdelantosUsuarios');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 24px; color: #94a3b8;">No se encontraron préstamos o adelantos registrados</td></tr>';
        return;
    }

    const html = items.map(a => {
        const id = a.id || a.Id;
        const nombre = a.usuarioNombre || a.UsuarioNombre || 'Sin nombre';
        const cedula = a.cedula || a.Cedula || 'N/A';
        const rol = (a.rol || a.Rol || 'USUARIO').toUpperCase();
        const fecha = (a.fechaSolicitud || a.FechaSolicitud || '').split('T')[0] || '-';
        const mTotal = Number(a.montoTotalUSD || a.MontoTotalUSD || 0);
        const cuotas = Number(a.numeroCuotas || a.NumeroCuotas || 1);
        const mCuota = Number(a.montoCuotaUSD || a.MontoCuotaUSD || (cuotas > 0 ? mTotal / cuotas : mTotal));
        const mPag = Number(a.montoPagadoUSD || a.MontoPagadoUSD || 0);
        const mPend = Number(a.montoPendienteUSD || a.MontoPendienteUSD || (mTotal - mPag));
        const estado = (a.estado || a.Estado || 'APROBADO').toUpperCase();
        const obs = a.observacion || a.Observacion || '-';

        let badgeRol = '';
        if (rol === 'CHOFER') {
            badgeRol = `<span class="badge" style="background: rgba(37,99,235,0.12); color: #2563eb; font-weight: 800; border: 1px solid rgba(37,99,235,0.3);"><i class="fa-solid fa-truck"></i> CHOFER</span>`;
        } else if (rol === 'MATERA') {
            badgeRol = `<span class="badge" style="background: rgba(16,185,129,0.12); color: #059669; font-weight: 800; border: 1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-cow"></i> MATERA</span>`;
        } else {
            badgeRol = `<span class="badge" style="background: rgba(147,51,234,0.12); color: #7c3aed; font-weight: 800; border: 1px solid rgba(147,51,234,0.3);">${rol}</span>`;
        }

        let badgeEstado = '';
        if (estado === 'PAGADO' || estado === 'COMPLETADO') {
            badgeEstado = `<span class="badge badge-success" style="font-size: 11px; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> PAGADO</span>`;
        } else if (estado === 'ANULADO') {
            badgeEstado = `<span class="badge badge-danger" style="font-size: 11px; font-weight: 800;"><i class="fa-solid fa-circle-xmark"></i> ANULADO</span>`;
        } else {
            badgeEstado = `<span class="badge badge-warning" style="font-size: 11px; font-weight: 800;"><i class="fa-solid fa-clock"></i> PENDIENTE</span>`;
        }

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="padding: 12px 14px;">
                    <div style="font-weight: 800; color: #0f172a; font-size: 13.5px;">${nombre}</div>
                    <div style="font-size: 11.5px; color: #64748b;">CI: ${cedula} | ID #${id}</div>
                </td>
                <td style="padding: 12px; text-align: center;">${badgeRol}</td>
                <td style="padding: 12px; font-size: 12.5px; color: #334155; font-weight: 600;">${fecha}</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13.5px;">$ ${formatearNumero(mTotal, 2)}</td>
                <td style="padding: 12px; text-align: center; font-weight: 700; color: #2563eb; font-size: 12.5px;">${cuotas} cuota(s)</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #d97706; font-size: 13px;">$ ${formatearNumero(mCuota, 2)}</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #059669; font-size: 13px;">$ ${formatearNumero(mPag, 2)}</td>
                <td style="padding: 12px; text-align: right; font-weight: 900; color: #dc2626; font-size: 13.5px;">$ ${formatearNumero(mPend, 2)}</td>
                <td style="padding: 12px; text-align: center;">${badgeEstado}</td>
                <td style="padding: 12px; font-size: 12px; color: #475569; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${obs}">${obs}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}
window.renderTablaAdelantosUsuarios = renderTablaAdelantosUsuarios;

function filtrarTablaAdelantosUsuarios(q) {
    const texto = (q || '').toLowerCase().trim();
    if (!texto) {
        renderTablaAdelantosUsuarios(cacheAdelantosUsuarios);
        return;
    }

    const filtrados = (cacheAdelantosUsuarios || []).filter(a => {
        const nom = (a.usuarioNombre || a.UsuarioNombre || '').toLowerCase();
        const ci = (a.cedula || a.Cedula || '').toLowerCase();
        const obs = (a.observacion || a.Observacion || '').toLowerCase();
        return nom.includes(texto) || ci.includes(texto) || obs.includes(texto);
    });

    renderTablaAdelantosUsuarios(filtrados);
}
window.filtrarTablaAdelantosUsuarios = filtrarTablaAdelantosUsuarios;

/* ==========================================================================
   MÓDULO DE SEGURIDAD RBAC: MÓDULOS, ACCIONES Y PERMISOS POR ROL
   ========================================================================== */
