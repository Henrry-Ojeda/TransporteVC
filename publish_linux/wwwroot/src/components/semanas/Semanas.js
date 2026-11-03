// =========================================================================
// VALIDACIÓN DE SEMANAS PENDIENTES (Solo semanas anteriores CERRADAS)
// =========================================================================
function obtenerSemanasCerradasAnterioresStr(semPendientesRaw) {
    if (!semPendientesRaw || typeof semPendientesRaw !== 'string') return '';
    const ciclos = state.semanas || [];
    // Determinar ciclo actual (el de estado ABIERTO con mayor fecha/id, o el primero)
    const ciclosAbiertos = ciclos.filter(c => (c.estado || '').toUpperCase() === 'ABIERTO')
        .sort((a, b) => (b.id || 0) - (a.id || 0));
    const cicloActivo = ciclosAbiertos.length > 0 ? ciclosAbiertos[0] : (ciclos[0] || null);
    const cicloActivoId = cicloActivo ? (cicloActivo.id || 0) : 999999;
    const cicloActivoFechaIni = cicloActivo?.fechaInicio ? new Date(cicloActivo.fechaInicio) : null;

    const matches = semPendientesRaw.match(/\d+/g);
    if (!matches || matches.length === 0) return '';

    const validas = [];
    matches.forEach(numStr => {
        const cId = parseInt(numStr, 10);
        const cicloObj = ciclos.find(c => c.id === cId);
        if (cicloObj) {
            const esCerrado = (cicloObj.estado || '').toUpperCase() === 'CERRADO';
            const esAnterior = cicloObj.id < cicloActivoId || 
                (cicloActivoFechaIni && cicloObj.fechaFin && new Date(cicloObj.fechaFin) < cicloActivoFechaIni);
            // REGLA ESTRICTA: Solo mostrar si es ANTERIOR a la actual Y ESTÁ CERRADA
            if (esCerrado && esAnterior) {
                validas.push(`Sem. ${cId}`);
            }
        }
    });

    return [...new Set(validas)].join(', ');
}
window.obtenerSemanasCerradasAnterioresStr = obtenerSemanasCerradasAnterioresStr;

function irALiquidacionCiclo(cicloId) {
    irAPestana('liquidacion');
    if (cicloId) {
        setTimeout(async () => {
            const sel = document.getElementById('selectCicloLiquidacion');
            if (sel) {
                sel.value = String(cicloId);
                await onCambiarCicloLiquidacion(String(cicloId));
            }
        }, 150);
    }
}
window.irALiquidacionCiclo = irALiquidacionCiclo;

async function cerrarSemana(id) {
    let resumen = null;
    let fincasSinPagar = [];
    try {
        const [resRes, resLiq] = await Promise.all([
            fetch(`${API_BASE}/ciclos/${id}/resumen-cierre`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            }),
            fetch(`${API_BASE}/catalogos/pre-liquidacion?cicloId=${id}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            })
        ]);
        if (resRes.ok) {
            resumen = await resRes.json();
        }
        if (resLiq.ok) {
            const dataLiq = await resLiq.json();
            const items = Array.isArray(dataLiq) ? dataLiq : (dataLiq.items || []);
            fincasSinPagar = items.filter(f => {
                const lts = Number(f.totalLitros || f.TotalLitros || 0);
                const pag = !!(f.esPagado || f.EsPagado);
                return lts > 0 && !pag;
            });
        }
    } catch (e) {
        console.warn('No se pudo precargar resumen o fincas de cierre:', e);
    }

    const cicloObj = (state.semanas || []).find(s => s.id === id) || {};
    const codigoCiclo = resumen?.codigo || cicloObj.codigo || `Ciclo #${id}`;
    const balanceCalculado = resumen ? Number(resumen.balanceCalculadoTanque || 0) : 0;
    const stockIni = resumen ? Number(resumen.stockInicialTanques || 0) : 0;
    const recFincas = resumen ? Number(resumen.totalRecolectadoFincas || 0) : 0;
    const entReceptoria = resumen ? Number(resumen.totalEntregasReceptoria || 0) : 0;
    const despCompanias = resumen ? Number(resumen.totalDespachosCompanias || 0) : 0;
    const merma = resumen ? Number(resumen.totalMerma || 0) : 0;
    const sigCicloCodigo = resumen?.siguienteCicloCodigo || 'Siguiente Ciclo Correlativo';

    // Generar alerta de fincas no pagadas con botón "Ir a Liquidación" si existen
    let alertaFincasHtml = '';
    if (fincasSinPagar.length > 0) {
        const fincasListado = fincasSinPagar.map(f => {
            const nom = f.fincaNombre || f.FincaNombre || 'Finca';
            const prop = f.propietario || f.Propietario || '';
            const lts = Number(f.totalLitros || f.TotalLitros || 0).toLocaleString('es-VE');
            const neto = Number(f.totalNetoBs || f.TotalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-bottom: 1px solid rgba(239, 68, 68, 0.2); font-size: 12px;">
                    <div>
                        <strong style="color: #fef08a;">${nom}</strong>
                        ${prop && prop !== 'N/A' && prop !== nom ? `<span style="color: #94a3b8; font-size: 11px;"> (${prop})</span>` : ''}
                    </div>
                    <div style="text-align: right; white-space: nowrap;">
                        <span style="color: #38bdf8; font-weight: 700;">${lts} L</span>
                        <span style="color: #f87171; font-weight: 800; margin-left: 8px;">Bs. ${neto}</span>
                    </div>
                </div>
            `;
        }).join('');

        alertaFincasHtml = `
            <div style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid #ef4444; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <div style="color: #f87171; font-weight: 800; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; color: #ef4444;"></i>
                        <span>¡Atención! Hay <strong>${fincasSinPagar.length}</strong> finca(s) sin pagar en esta semana</span>
                    </div>
                    <button type="button" class="btn btn-sm" onclick="Swal.close(); irALiquidacionCiclo(${id});" 
                        style="background: #2563eb; color: #ffffff; border: none; font-weight: 800; font-size: 12px; padding: 5px 12px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3); transition: all 0.2s;"
                        onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                        <i class="fa-solid fa-money-bill-wave"></i> Ir a Liquidación
                    </button>
                </div>
                <div style="max-height: 110px; overflow-y: auto; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; padding: 4px 8px; margin-bottom: 8px;">
                    ${fincasListado}
                </div>
                <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
                    <i class="fa-solid fa-circle-info" style="color: #38bdf8;"></i> Si deseas pagar primero haz clic en <strong>"Ir a Liquidación"</strong>.<br>
                    Si prefieres cerrar la semana ahora, aún puedes presionar <strong>"Continuar y Cerrar Ciclo"</strong> abajo.
                </div>
            </div>
        `;
    }

    const { value: formValues } = await Swal.fire({
        title: `<i class="fa-solid fa-lock" style="color: #ef4444;"></i> Cerrar Ciclo: ${codigoCiclo}`,
        html: `
            <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                ${alertaFincasHtml}
                <p style="margin-bottom: 10px; color: #f1f5f9;">
                    Revisa el <strong>balance operativo rápido</strong> antes de confirmar el cierre definitivo:
                </p>
                
                <!-- TARJETA DE DETALLE RÁPIDO OPERATIVO -->
                <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #334155; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12.5px; margin-bottom: 8px;">
                        <div style="background: #1e293b; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #38bdf8;">
                            <span style="color: #94a3b8; font-size: 11px; display: block;">Stock Inicial Tanque:</span>
                            <strong style="color: #38bdf8; font-size: 13.5px;">${stockIni.toLocaleString('es-VE')} Lts</strong>
                        </div>
                        <div style="background: #1e293b; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                            <span style="color: #94a3b8; font-size: 11px; display: block;">Recolectado Fincas:</span>
                            <strong style="color: #10b981; font-size: 13.5px;">${recFincas.toLocaleString('es-VE')} Lts</strong>
                        </div>
                        <div style="background: #1e293b; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #06b6d4;">
                            <span style="color: #94a3b8; font-size: 11px; display: block;">Ingreso a Receptoría:</span>
                            <strong style="color: #06b6d4; font-size: 13.5px;">${entReceptoria.toLocaleString('es-VE')} Lts</strong>
                        </div>
                        <div style="background: #1e293b; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                            <span style="color: #94a3b8; font-size: 11px; display: block;">Despachado a Plantas:</span>
                            <strong style="color: #f59e0b; font-size: 13.5px;">${despCompanias.toLocaleString('es-VE')} Lts</strong>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #334155; font-size: 12px;">
                        <span style="color: #94a3b8;"><i class="fa-solid fa-route"></i> Merma Rutas: <strong style="color: #f87171;">${merma.toLocaleString('es-VE')} Lts</strong></span>
                        <span style="color: #cbd5e1;"><i class="fa-solid fa-oil-well" style="color: #38bdf8;"></i> Saldo Tanque Calculado: <strong style="color: #38bdf8; font-size: 14px;">${balanceCalculado.toLocaleString('es-VE')} Lts</strong></span>
                    </div>
                </div>

                <!-- TARJETA DE TRASPASO AL SIGUIENTE CICLO -->
                <div style="background: rgba(6, 182, 212, 0.1); border: 1.5px solid #0891b2; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
                    <div style="color: #22d3ee; font-weight: 800; font-size: 12.5px; margin-bottom: 4px;">
                        <i class="fa-solid fa-forward-step"></i> Traspaso al Siguiente Ciclo:
                    </div>
                    <p style="margin: 0; color: #f8fafc; font-size: 12.5px;">
                        El stock final que confirmes se guardará y asignará automáticamente como <strong>Stock Inicial</strong> de: <strong style="color: #67e8f9;">${sigCicloCodigo}</strong>.
                    </p>
                </div>

                <!-- CAMPO DE CONFIRMACIÓN O AJUSTE DE STOCK FINAL -->
                <div style="background: rgba(30, 41, 59, 0.9); border: 1.5px solid #475569; border-radius: 10px; padding: 12px 14px;">
                    <label for="swalStockFinalTanques" style="display: block; font-weight: 800; color: #f8fafc; font-size: 13px; margin-bottom: 6px;">
                        Confirmar Litros Finales que quedan en Tanque:
                    </label>
                    <input id="swalStockFinalTanques" type="number" step="1" min="0" value="${balanceCalculado}" class="swal2-input" 
                        style="width: 100%; box-sizing: border-box; margin: 0; height: 44px; font-size: 16px; font-weight: 800; color: #0284c7; background: #ffffff; border: 2px solid #38bdf8; border-radius: 8px; text-align: center;" />
                    <small style="display: block; color: #94a3b8; font-size: 11px; margin-top: 6px;">
                        * Si el volumen físico real medido en tanque difiere, puedes ajustar el número aquí antes de cerrar.
                    </small>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: fincasSinPagar.length > 0 
            ? '<i class="fa-solid fa-check"></i> Continuar y Cerrar Ciclo de Todas Formas' 
            : '<i class="fa-solid fa-check"></i> Confirmar y Cerrar Ciclo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#0f172a',
        color: '#fff',
        focusConfirm: false,
        preConfirm: () => {
            const inputVal = document.getElementById('swalStockFinalTanques').value;
            const parsed = parseFloat(inputVal);
            if (isNaN(parsed) || parsed < 0) {
                Swal.showValidationMessage('Por favor especifica un valor de litros en tanque válido (cero o positivo).');
                return false;
            }
            return { stockFinalTanques: parsed };
        }
    });

    if (!formValues) return;

    try {
        const res = await fetch(`${API_BASE}/ciclos/${id}/cerrar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}` 
            },
            body: JSON.stringify({ stockFinalTanques: formValues.stockFinalTanques })
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Ciclo Cerrado con Éxito',
                text: `El ciclo '${codigoCiclo}' fue cerrado. Se guardaron ${formValues.stockFinalTanques.toLocaleString('es-VE')} Lts como stock inicial de '${sigCicloCodigo}'.`,
                background: '#1e293b',
                color: '#fff'
            });
            await cargarSemanas();
            await cargarCicloActivo();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message, background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.cerrarSemana = cerrarSemana;

function cerrarSemanaActivaBanner() {
    const activa = (state.semanas || []).find(s => s.estado === 'ABIERTO');
    if (activa) {
        cerrarSemana(activa.id);
    } else {
        Swal.fire({ icon: 'info', title: 'Sin Semana Activa', text: 'No hay ninguna semana operativa actualmente activa.', background: '#1e293b', color: '#fff' });
    }
}
window.cerrarSemanaActivaBanner = cerrarSemanaActivaBanner;

async function reabrirSemana(id, codigo) {
    const { value: motivo } = await Swal.fire({
        title: '¿Reabrir Ciclo Operativo?',
        html: `<p style="font-size: 13.5px; color: #94a3b8; margin-bottom: 12px;">Se reactivará la <strong>${codigo || 'Semana'}</strong> para permitir registrar, corregir tickets o conciliar rutas rezagadas.</p>`,
        input: 'textarea',
        inputLabel: 'Motivo de la Re-apertura (Requerido para Auditoría y Log) *',
        inputPlaceholder: 'Ej: Carga de ruta rezagada del chofer, corrección de tickets, ajuste contable...',
        inputAttributes: {
            'aria-label': 'Motivo de la re-apertura',
            'style': 'height: 90px; font-size: 13px; color: #ffffff; background: #0f172a; border: 1px solid #334155; border-radius: 6px;'
        },
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-lock-open"></i> Sí, Reabrir Semana',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return '¡Debe ingresar el motivo de la re-apertura para el registro en el log de auditoría!';
            }
        }
    });

    if (!motivo) return;

    try {
        const res = await fetch(`${API_BASE}/ciclos/${id}/reabrir`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}` 
            },
            body: JSON.stringify({ motivo: motivo.trim() })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Semana reabierta exitosamente y registrada en el log de auditoría.');
            await cargarSemanas();
            await cargarCicloActivo();
        } else {
            Swal.fire({ icon: 'error', title: 'Error al Reabrir', text: data.message, background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.reabrirSemana = reabrirSemana;

// MODULO MERMAS & PRELIQUIDACION
// --------------------------------------------------------------------------
var mermasCache = [];

async function cargarMermas() {
    const inputDesde = document.getElementById('filtroMermasDesde');
    const inputHasta = document.getElementById('filtroMermasHasta');
    const choferSelect = document.getElementById('filtroMermasChoferSelect');
    const tbody = document.getElementById('tbodyMermas');

    const hoyStr = new Date().toISOString().split('T')[0];
    if (inputDesde && !inputDesde.value) inputDesde.value = hoyStr;
    if (inputHasta && !inputHasta.value) inputHasta.value = hoyStr;

    // Inicializar combobox buscable de conductores para mermas
    if (!comboboxFiltroMermasChoferInstance && document.getElementById('comboboxFiltroMermasChofer')) {
        comboboxFiltroMermasChoferInstance = setupCombobox({
            containerId: 'comboboxFiltroMermasChofer',
            inputSearchId: 'searchFiltroMermasChoferInput',
            inputHiddenId: 'filtroMermasChoferVal',
            dropdownId: 'dropdownFiltroMermasChoferList',
            placeholder: 'TODOS LOS CONDUCTORES',
            getItemsFn: () => {
                const list = [{ value: '', label: 'TODOS LOS CONDUCTORES', sub: '' }];
                const listChoferes = (state.choferes && state.choferes.length) ? state.choferes : (state.conductores || []);
                const mapeados = listChoferes.map(c => {
                    const id = c.id || c.Id;
                    const nombre = c.nombreCompleto || c.NombreCompleto || c.username || c.Username || `Chofer #${id}`;
                    const cedula = c.cedula || c.Cedula;
                    return {
                        value: id,
                        label: capitalizarTexto(nombre),
                        sub: cedula ? `C.I: ${cedula}` : ''
                    };
                });
                return list.concat(mapeados);
            },
            onSelect: () => {
                cargarMermas();
            }
        });
        window.comboboxFiltroMermasChoferInstance = comboboxFiltroMermasChoferInstance;
    }

    const fechaDesde = inputDesde?.value || hoyStr;
    const fechaHasta = inputHasta?.value || hoyStr;
    const choferId = document.getElementById('filtroMermasChoferVal')?.value || '';

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Consultando balance de mermas...</td></tr>`;
    }

    try {
        let url = `${API_BASE}/catalogos/mermas?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}`;
        if (choferId) url += `&choferId=${choferId}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error('Error consultando mermas.');
        const data = await res.json();
        mermasCache = data || [];

        actualizarKpisMermas(mermasCache);

        const q = (document.getElementById('buscarMermaInput')?.value || '').trim();
        filtrarMermasLocal(q);
    } catch (err) {
        console.warn('Error al cargar mermas:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 20px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar mermas: ${err.message}</td></tr>`;
        }
    }
}
window.cargarMermas = cargarMermas;

function actualizarKpisMermas(lista) {
    let totFincas = 0;
    let totPlantas = 0;

    lista.forEach(m => {
        totFincas += (m.litrosRecolectados || 0);
        totPlantas += (m.litrosEntregados || 0);
    });

    const mermaNeta = totFincas - totPlantas;
    const pctGlobal = totFincas > 0 ? ((mermaNeta * 100) / totFincas) : 0;

    const elFincas = document.getElementById('kpiMermasLitrosFincas');
    const elPlantas = document.getElementById('kpiMermasLitrosPlantas');
    const elMerma = document.getElementById('kpiMermasMermaLitros');
    const elMermaFoot = document.getElementById('kpiMermasMermaFoot');
    const elPct = document.getElementById('kpiMermasPorcentaje');
    const elPctFoot = document.getElementById('kpiMermasPorcentajeFoot');
    const elCantChoferes = document.getElementById('kpiMermasCantConductores');

    if (elFincas) elFincas.innerText = `${formatearNumero(totFincas)} Lts`;
    if (elPlantas) elPlantas.innerText = `${formatearNumero(totPlantas)} Lts`;
    if (elCantChoferes) elCantChoferes.innerText = `${lista.length} Registros / Choferes`;

    if (elMerma) {
        elMerma.innerText = `${mermaNeta > 0 ? '-' : (mermaNeta < 0 ? '+' : '')}${formatearNumero(Math.abs(mermaNeta))} Lts`;
        elMerma.style.color = mermaNeta > 0 ? '#e11d48' : (mermaNeta < 0 ? '#16a34a' : '#ca8a04');
    }
    if (elMermaFoot) {
        elMermaFoot.innerText = mermaNeta > 0 ? 'Faltante de leche en receptorías' : (mermaNeta < 0 ? 'Excedente de leche a favor' : 'Cuadre exacto (0.00%)');
        elMermaFoot.style.color = mermaNeta > 0 ? '#e11d48' : (mermaNeta < 0 ? '#16a34a' : '#ca8a04');
    }

    if (elPct) {
        elPct.innerText = `${formatearNumero(Math.abs(pctGlobal), 2)}%`;
        elPct.style.color = mermaNeta > 0 ? '#e11d48' : (mermaNeta < 0 ? '#16a34a' : '#ca8a04');
    }
    if (elPctFoot) {
        if (mermaNeta > 0) {
            elPctFoot.innerText = '⚠️ Merma / Faltante en receptorías';
            elPctFoot.style.color = '#e11d48';
        } else if (mermaNeta < 0) {
            elPctFoot.innerText = '✓ Excedente a favor en receptorías';
            elPctFoot.style.color = '#16a34a';
        } else {
            elPctFoot.innerText = '● Cuadre exacto (0.00%)';
            elPctFoot.style.color = '#ca8a04';
        }
    }
}

function filtrarMermasLocal(q) {
    if (!mermasCache) return;
    const query = (q || '').toLowerCase().trim();

    if (!query) {
        renderMermasTable(mermasCache);
        return;
    }

    const filtrados = mermasCache.filter(m => {
        const cond = (m.nombreConductor || '').toLowerCase();
        const fecha = (m.fecha || '').toLowerCase();
        return cond.includes(query) || fecha.includes(query);
    });

    renderMermasTable(filtrados);
}
window.filtrarMermasLocal = filtrarMermasLocal;

function renderMermasTable(lista) {
    const tbody = document.getElementById('tbodyMermas');
    const tfoot = document.getElementById('tfootMermas');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 28px; color: #64748b;"><i class="fa-solid fa-scale-balanced" style="font-size: 28px; display: block; margin-bottom: 8px; color: #94a3b8;"></i> No hay registros de balance de mermas para la consulta realizada.</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    const fechaDefault = document.getElementById('filtroMermasDesde')?.value || new Date().toISOString().split('T')[0];

    let totFincas = 0;
    let totPlantas = 0;

    let rowsHtml = '';
    lista.forEach((m, idx) => {
        const recolectados = m.litrosRecolectados || 0;
        const entregados = m.litrosEntregados || 0;
        const merma = recolectados - entregados;
        const pct = recolectados > 0 ? ((merma * 100) / recolectados) : 0;
        const fechaDisplay = m.fecha ? formatearFechaLocal(m.fecha) : formatearFechaLocal(fechaDefault);

        totFincas += recolectados;
        totPlantas += entregados;

        const bgStyle = idx % 2 === 1 ? 'background: #f8fafc;' : 'background: #ffffff;';

        // SEMÁFORO DE COLORES SOLICITADO:
        // 1) Merma / Faltante (recolectados > entregados, ej: 0.25%): ROJO (#e11d48)
        // 2) Exacto (recolectados == entregados, 0.00%): AMARILLO (#a16207)
        // 3) Excedente (entregados > recolectados, +a favor > 0.1%): VERDE (#15803d)
        let pillPctStyle = 'background: #ffe4e6; color: #e11d48; border: 1px solid #fecdd3; font-weight: 800;';
        let badgeEstado = `<span class="badge" style="background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> Merma (Faltante)</span>`;
        let colorMermaText = '#e11d48';
        let signoMerma = '-';

        if (merma === 0 || Math.abs(pct) < 0.01) {
            pillPctStyle = 'background: #fef9c3; color: #a16207; border: 1px solid #fef08a; font-weight: 800;';
            badgeEstado = `<span class="badge" style="background: #fef9c3; color: #a16207; border: 1px solid #fef08a; font-weight: 800;"><i class="fa-solid fa-circle"></i> Exacto (0.00%)</span>`;
            colorMermaText = '#ca8a04';
            signoMerma = '';
        } else if (merma < 0) {
            pillPctStyle = 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 800;';
            badgeEstado = `<span class="badge" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-weight: 800;"><i class="fa-solid fa-check"></i> Excedente (+A Favor)</span>`;
            colorMermaText = '#16a34a';
            signoMerma = '+';
        }

        rowsHtml += `
            <tr style="${bgStyle} border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                <td style="font-weight: 600; color: #475569;">${fechaDisplay}</td>
                <td><strong style="color: #0f172a; font-size: 13.5px;">${m.nombreConductor}</strong></td>
                <td style="text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">${formatearNumero(recolectados)} Lts</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">${formatearNumero(entregados)} Lts</td>
                <td style="text-align: right; font-weight: 800; font-family: monospace; color: ${colorMermaText};">
                    ${signoMerma}${formatearNumero(Math.abs(merma))} Lts
                </td>
                <td style="text-align: center;">
                    <span class="badge" style="${pillPctStyle}">
                        ${formatearNumero(Math.abs(pct), 2)}%
                    </span>
                </td>
                <td style="text-align: center;">${badgeEstado}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;

    // Pie de tabla con totales consolidados
    const mermaTotal = totFincas - totPlantas;
    const pctGlobal = totFincas > 0 ? ((mermaTotal * 100) / totFincas) : 0;

    if (tfoot) {
        let tfootPillStyle = 'background: #ffe4e6; color: #e11d48; border: 1px solid #fecdd3; font-weight: 800;';
        let tfootBadge = '<span class="badge" style="background: #e11d48; color: #ffffff; font-weight: 800;">ALERTA MERMA</span>';
        let tfootColor = '#e11d48';
        let tfootSigno = '-';

        if (mermaTotal === 0 || Math.abs(pctGlobal) < 0.01) {
            tfootPillStyle = 'background: #fef9c3; color: #a16207; border: 1px solid #fef08a; font-weight: 800;';
            tfootBadge = '<span class="badge" style="background: #ca8a04; color: #ffffff; font-weight: 800;">EXACTO (0.00%)</span>';
            tfootColor = '#ca8a04';
            tfootSigno = '';
        } else if (mermaTotal < 0) {
            tfootPillStyle = 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 800;';
            tfootBadge = '<span class="badge" style="background: #10b981; color: #ffffff; font-weight: 800;">EXCEDENTE A FAVOR</span>';
            tfootColor = '#16a34a';
            tfootSigno = '+';
        }

        tfoot.innerHTML = `
            <tr style="font-size: 13.5px;">
                <td colspan="2" style="padding: 12px 14px; color: #0f172a;">TOTALES GENERALES</td>
                <td style="text-align: right; font-size: 14px; color: #0f172a; font-family: monospace;">${formatearNumero(totFincas)} Lts</td>
                <td style="text-align: right; font-size: 14px; color: #0f172a; font-family: monospace;">${formatearNumero(totPlantas)} Lts</td>
                <td style="text-align: right; font-size: 14px; font-family: monospace; color: ${tfootColor};">
                    ${tfootSigno}${formatearNumero(Math.abs(mermaTotal))} Lts
                </td>
                <td style="text-align: center; font-size: 14px;">
                    <span class="badge" style="${tfootPillStyle}">
                        ${formatearNumero(Math.abs(pctGlobal), 2)}%
                    </span>
                </td>
                <td style="text-align: center;">${tfootBadge}</td>
            </tr>
        `;
    }
}

function exportarMermasExcel() {
    if (!mermasCache || mermasCache.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin Datos', text: 'No hay datos en el balance de mermas para exportar.', background: '#1e293b', color: '#fff' });
        return;
    }

    let csvContent = "\uFEFFFECHA;CONDUCTOR;LITROS_FINCAS;LITROS_COMPANIAS;DIFERENCIA_MERMA_LTS;PORCENTAJE_MERMA;ESTADO\n";

    mermasCache.forEach(m => {
        const fecha = m.fecha ? m.fecha.split('T')[0] : '';
        const conductor = (m.nombreConductor || '').replace(/;/g, ',');
        const fincas = m.litrosRecolectados || 0;
        const plantas = m.litrosEntregados || 0;
        const merma = m.mermaLitros ?? (fincas - plantas);
        const pct = (m.porcentajeMerma ?? 0).toFixed(2).replace('.', ',');
        const estado = pct > 2 ? 'ALERTA MERMA' : 'NORMAL';

        csvContent += `${fecha};${conductor};${fincas};${plantas};${merma};${pct};${estado}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Balance_Mermas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('¡Balance de mermas exportado a CSV/Excel exitosamente!');
}
window.exportarMermasExcel = exportarMermasExcel;

var preLiquidacionDataCache = window.preLiquidacionDataCache || [];
var preLiquidacionFiltradosCache = window.preLiquidacionFiltradosCache || [];
var itemsPorPaginaLiquidacion = window.itemsPorPaginaLiquidacion || 50;
var paginaActualLiquidacion = window.paginaActualLiquidacion || 1;

var historialPagosProcesados = window.historialPagosProcesados || [];
var historialPagosCache = window.historialPagosCache || [];
var historialPagosFiltradosCache = window.historialPagosFiltradosCache || [];
var itemsPorPaginaHistorial = window.itemsPorPaginaHistorial || 50;
var paginaActualHistorial = window.paginaActualHistorial || 1;

window.preLiquidacionDataCache = preLiquidacionDataCache;
window.historialPagosProcesados = historialPagosProcesados;
window.historialPagosCache = historialPagosCache;

function cambiarCantRegistrosLiquidacion(cant) {
    itemsPorPaginaLiquidacion = parseInt(cant) || 50;
    paginaActualLiquidacion = 1;
    filtrarTablaLiquidacion(false);
}
window.cambiarCantRegistrosLiquidacion = cambiarCantRegistrosLiquidacion;

function cambiarPaginaLiquidacion(pag) {
    paginaActualLiquidacion = pag;
    filtrarTablaLiquidacion(true);
}
window.cambiarPaginaLiquidacion = cambiarPaginaLiquidacion;

function cambiarCantRegistrosHistorial(cant) {
    itemsPorPaginaHistorial = parseInt(cant) || 50;
    paginaActualHistorial = 1;
    const items = (historialPagosFiltradosCache && historialPagosFiltradosCache.length > 0) || (document.getElementById('inputBuscarHistorialPagos')?.value.trim()) ? historialPagosFiltradosCache : historialPagosCache;
    renderHistorialPagosLiquidacion(items);
}
window.cambiarCantRegistrosHistorial = cambiarCantRegistrosHistorial;

function cambiarPaginaHistorial(pag) {
    paginaActualHistorial = pag;
    const items = (historialPagosFiltradosCache && historialPagosFiltradosCache.length > 0) || (document.getElementById('inputBuscarHistorialPagos')?.value.trim()) ? historialPagosFiltradosCache : historialPagosCache;
    renderHistorialPagosLiquidacion(items);
}
window.cambiarPaginaHistorial = cambiarPaginaHistorial;

function renderPaginacionControles(tipo, desde, hasta, total, pagActual = 1, totalPaginas = 1) {
    const infoElem = document.getElementById(`infoPaginacion${tipo}`);
    const navElem = document.getElementById(`navPaginacion${tipo}`);
    if (!infoElem || !navElem) return;

    if (total === 0) {
        infoElem.innerText = 'Mostrando 0 a 0 de 0 registros';
        navElem.innerHTML = '';
        return;
    }

    infoElem.innerText = `Mostrando ${desde} a ${hasta} de ${total} registros`;

    if (totalPaginas <= 1) {
        navElem.innerHTML = '';
        return;
    }

    const fnCambiar = tipo === 'Liquidacion' ? 'cambiarPaginaLiquidacion' : 'cambiarPaginaHistorial';
    let btnsHtml = '';

    btnsHtml += `<button type="button" class="btn btn-sm" ${pagActual === 1 ? 'disabled' : ''} onclick="${fnCambiar}(${pagActual - 1})" style="padding: 4px 10px; font-weight: 600; font-size: 12px; border: 1px solid #cbd5e1; background: ${pagActual === 1 ? '#f1f5f9' : '#fff'}; color: ${pagActual === 1 ? '#94a3b8' : '#1e293b'}; border-radius: 6px;">Anterior</button>`;

    let startPage = Math.max(1, pagActual - 2);
    let endPage = Math.min(totalPaginas, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
        const isCurrent = p === pagActual;
        btnsHtml += `<button type="button" class="btn btn-sm" onclick="${fnCambiar}(${p})" style="padding: 4px 10px; font-weight: ${isCurrent ? '800' : '600'}; font-size: 12px; border: 1px solid ${isCurrent ? '#2563eb' : '#cbd5e1'}; background: ${isCurrent ? '#2563eb' : '#fff'}; color: ${isCurrent ? '#ffffff' : '#1e293b'}; border-radius: 6px;">${p}</button>`;
    }

    btnsHtml += `<button type="button" class="btn btn-sm" ${pagActual === totalPaginas ? 'disabled' : ''} onclick="${fnCambiar}(${pagActual + 1})" style="padding: 4px 10px; font-weight: 600; font-size: 12px; border: 1px solid #cbd5e1; background: ${pagActual === totalPaginas ? '#f1f5f9' : '#fff'}; color: ${pagActual === totalPaginas ? '#94a3b8' : '#1e293b'}; border-radius: 6px;">Siguiente</button>`;

    navElem.innerHTML = btnsHtml;
}

// (Funciones de unificación multi-semana definidas más adelante en cargarSemanasLiquidacionSelect)

let fincasSeleccionadasUnificarSet = new Set();

function toggleFincaUnificar(fincaId, isChecked) {
    const fId = Number(fincaId);
    const finca = (preLiquidacionDataCache || []).find(f => Number(f.fincaId || f.FincaId) === fId);
    if (finca && (finca.esPagado || finca.EsPagado)) {
        fincasSeleccionadasUnificarSet.delete(fId);
        actualizarBarraUnificarPagos();
        return;
    }
    if (isChecked) {
        fincasSeleccionadasUnificarSet.add(fId);
    } else {
        fincasSeleccionadasUnificarSet.delete(fId);
    }
    actualizarBarraUnificarPagos();
}
window.toggleFincaUnificar = toggleFincaUnificar;

function toggleTodosUnificar(isChecked) {
    const checkboxes = document.querySelectorAll('.chk-finca-unificar:not([disabled])');
    checkboxes.forEach(chk => {
        const fId = Number(chk.value);
        const finca = (preLiquidacionDataCache || []).find(f => Number(f.fincaId || f.FincaId) === fId);
        if (finca && (finca.esPagado || finca.EsPagado)) {
            chk.checked = false;
            fincasSeleccionadasUnificarSet.delete(fId);
            return;
        }
        chk.checked = isChecked;
        if (isChecked) {
            fincasSeleccionadasUnificarSet.add(fId);
        } else {
            fincasSeleccionadasUnificarSet.delete(fId);
        }
    });
    actualizarBarraUnificarPagos();
}
window.toggleTodosUnificar = toggleTodosUnificar;

function seleccionarFincasDeProductorParaUnificar(propietarioNombre) {
    if (!propietarioNombre) return;
    const propUpper = propietarioNombre.trim().toUpperCase();

    // Limpiar selección previa
    fincasSeleccionadasUnificarSet.clear();

    const fincasDelProp = (preLiquidacionDataCache || []).filter(f => {
        const p = (f.propietario || f.Propietario || '').trim().toUpperCase();
        return p === propUpper;
    });

    const fincasPendientes = fincasDelProp.filter(f => !f.esPagado && !f.EsPagado);

    if (fincasPendientes.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Fincas Ya Pagadas',
            text: `Todas las fincas de ${propietarioNombre} ya se encuentran pagadas en esta semana. Puedes consultar el recibo unificado directamente.`,
            background: '#1e293b',
            color: '#fff',
            confirmButtonText: '<i class="fa-solid fa-file-invoice"></i> Ver Recibo Unificado',
            showCancelButton: true,
            cancelButtonText: 'Cerrar'
        }).then(res => {
            if (res.isConfirmed) {
                const ids = fincasDelProp.map(f => Number(f.fincaId || f.FincaId));
                verReciboPagoConsolidadoModal(propietarioNombre, ids);
            }
        });
        return;
    }

    fincasPendientes.forEach(f => {
        fincasSeleccionadasUnificarSet.add(Number(f.fincaId || f.FincaId));
    });

    filtrarTablaLiquidacion(true);
    actualizarBarraUnificarPagos();

    // Desplazamiento suave al panel de unificar
    const panel = document.getElementById('panelBarraUnificarPagos');
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
window.seleccionarFincasDeProductorParaUnificar = seleccionarFincasDeProductorParaUnificar;

function cancelarSeleccionUnificar() {
    fincasSeleccionadasUnificarSet.clear();
    const chkTodos = document.getElementById('chkTodosUnificar');
    if (chkTodos) chkTodos.checked = false;

    const checkboxes = document.querySelectorAll('.chk-finca-unificar');
    checkboxes.forEach(chk => chk.checked = false);

    actualizarBarraUnificarPagos();
    filtrarTablaLiquidacion(true);
}
window.cancelarSeleccionUnificar = cancelarSeleccionUnificar;

function actualizarBarraUnificarPagos() {
    const panel = document.getElementById('panelBarraUnificarPagos');
    if (!panel) return;

    // Remover cualquier finca que esté pagada del set de pago
    for (const fId of Array.from(fincasSeleccionadasUnificarSet)) {
        const f = (preLiquidacionDataCache || []).find(x => Number(x.fincaId || x.FincaId) === fId);
        if (!f || f.esPagado || f.EsPagado) {
            fincasSeleccionadasUnificarSet.delete(fId);
        }
    }

    if (fincasSeleccionadasUnificarSet.size === 0) {
        panel.style.display = 'none';
        return;
    }

    const fincasSel = (preLiquidacionDataCache || []).filter(f => 
        fincasSeleccionadasUnificarSet.has(Number(f.fincaId || f.FincaId)) && !f.esPagado && !f.EsPagado
    );

    if (fincasSel.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    const count = fincasSel.length;
    const lblContador = document.getElementById('labelContadorFincasUnificar');
    if (lblContador) lblContador.innerText = `${count} Finca${count > 1 ? 's' : ''} Seleccionada${count > 1 ? 's' : ''}`;

    let totalLitros = 0;
    let totalUSD = 0;
    let totalBrutoBs = 0;
    let totalAdelantosBs = 0;
    let totalAdelantosUSD = 0;
    let totalOtrasDeducBs = 0;

    fincasSel.forEach(f => {
        const esPag = !!(f.esPagado || f.EsPagado);
        const bUSD = f.totalUSD || f.TotalUSD || 0;
        const fincaTasa = (f.tasaBcv && f.tasaBcv > 0) 
            ? f.tasaBcv 
            : ((f.TasaBcv && f.TasaBcv > 0) 
                ? f.TasaBcv 
                : ((state.tasaBcv && state.tasaBcv > 0) 
                    ? state.tasaBcv 
                    : (bUSD > 0 && (f.totalBrutoBs || f.TotalBrutoBs || 0) > 0 ? ((f.totalBrutoBs || f.TotalBrutoBs || 0) / bUSD) : 0)));
        const bBs = (!esPag && fincaTasa > 0 && bUSD > 0)
            ? Math.round(bUSD * fincaTasa * 100) / 100
            : ((f.totalBrutoBs !== undefined && f.totalBrutoBs !== null) ? f.totalBrutoBs : (f.TotalBrutoBs || 0));
        const adUSD = (f.totalAdelantosUSD !== undefined ? f.totalAdelantosUSD : (f.TotalAdelantosUSD || 0));
        const adBs = (!esPag && fincaTasa > 0 && adUSD > 0)
            ? Math.round(adUSD * fincaTasa * 100) / 100
            : ((f.totalAdelantosBs !== undefined && f.totalAdelantosBs !== null) ? f.totalAdelantosBs : (f.TotalAdelantosBs || 0));
        const otrasBs = f.otrasDeduccionesBs || f.OtrasDeduccionesBs || 0;

        totalLitros += (f.totalLitros || 0);
        totalUSD += bUSD;
        totalBrutoBs += bBs;
        totalAdelantosBs += adBs;
        totalAdelantosUSD += adUSD;
        totalOtrasDeducBs += otrasBs;
    });

    const saldoNetoRealBs = totalBrutoBs - totalAdelantosBs - totalOtrasDeducBs;
    const esDeudorTotal = (totalAdelantosUSD > totalUSD + 0.01) || (saldoNetoRealBs < -0.01);
    const deudaRestanteUSD = esDeudorTotal ? Math.round((totalAdelantosUSD - totalUSD) * 100) / 100 : 0;
    const deudaRestanteBs = esDeudorTotal ? Math.round((totalAdelantosBs - totalBrutoBs) * 100) / 100 : 0;
    const montoNetoPagarBs = Math.max(0, saldoNetoRealBs);

    const detallesHtml = fincasSel.map(f => {
        const nom = f.fincaNombre || f.FincaNombre;
        const esPag = !!(f.esPagado || f.EsPagado);
        const bUSD = f.totalUSD || f.TotalUSD || 0;
        const fincaTasa = (f.tasaBcv && f.tasaBcv > 0) 
            ? f.tasaBcv 
            : ((f.TasaBcv && f.TasaBcv > 0) 
                ? f.TasaBcv 
                : ((state.tasaBcv && state.tasaBcv > 0) 
                    ? state.tasaBcv 
                    : (bUSD > 0 && (f.totalBrutoBs || f.TotalBrutoBs || 0) > 0 ? ((f.totalBrutoBs || f.TotalBrutoBs || 0) / bUSD) : 0)));
        const bBs = (!esPag && fincaTasa > 0 && bUSD > 0)
            ? Math.round(bUSD * fincaTasa * 100) / 100
            : ((f.totalBrutoBs !== undefined && f.totalBrutoBs !== null) ? f.totalBrutoBs : (f.TotalBrutoBs || 0));
        const adUSD = (f.totalAdelantosUSD !== undefined ? f.totalAdelantosUSD : (f.TotalAdelantosUSD || 0));
        const adBs = (!esPag && fincaTasa > 0 && adUSD > 0)
            ? Math.round(adUSD * fincaTasa * 100) / 100
            : ((f.totalAdelantosBs !== undefined && f.totalAdelantosBs !== null) ? f.totalAdelantosBs : (f.TotalAdelantosBs || 0));
        const otrasBs = f.otrasDeduccionesBs || f.OtrasDeduccionesBs || 0;
        const netoFincaBs = (!esPag) ? Math.max(0, bBs - adBs - otrasBs) : ((f.totalNetoBs !== undefined && f.totalNetoBs !== null) ? f.totalNetoBs : (f.TotalNetoBs !== undefined ? f.TotalNetoBs : Math.max(0, bBs - adBs - otrasBs)));
        const netoFincaUSD = Math.max(0, bUSD - adUSD);
        const esDeudorFinca = (adUSD > bUSD + 0.01) || (bBs - adBs - otrasBs < -0.01);

        if (esDeudorFinca) {
            const remUSD = Math.max(0, adUSD - bUSD);
            const remBs = Math.max(0, adBs - bBs);
            return `<span style="display: inline-block; background: rgba(239, 68, 68, 0.18); padding: 5px 12px; border-radius: 8px; margin-right: 6px; margin-top: 3px; border: 1.5px solid #ef4444;">
                <strong style="color: #ffffff; font-size: 12.5px;">${nom}:</strong> <span style="color: #fca5a5; font-weight: 800;">Bs. 0,00 ($0.00 USD)</span>
                <span style="color: #ef4444; font-weight: 800; display: block; font-size: 11px; margin-top: 2px;">
                    <i class="fa-solid fa-circle-minus"></i> Adelanto: -$${adUSD.toFixed(2)} USD (-Bs. ${adBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                </span>
                <small style="color: #f87171; font-weight: 800; display: block; font-size: 10.5px;">(Saldo deudor: -$${remUSD.toFixed(2)} USD / -Bs. ${remBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</small>
            </span>`;
        } else if (adUSD > 0) {
            return `<span style="display: inline-block; background: rgba(15, 23, 42, 0.85); padding: 5px 12px; border-radius: 8px; margin-right: 6px; margin-top: 3px; border: 1.5px solid #3b82f6;">
                <strong style="color: #ffffff; font-size: 12.5px;">${nom}:</strong> <span style="color: #34d399; font-weight: 800;">+ Bs. ${netoFincaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                <small style="color: #6ee7b7; font-weight: 700; font-size: 11px;">($${netoFincaUSD.toFixed(2)} USD)</small>
                <span style="color: #f87171; font-weight: 800; display: block; font-size: 11px; margin-top: 2px;">
                    <i class="fa-solid fa-circle-minus"></i> Adelanto: -$${adUSD.toFixed(2)} USD (-Bs. ${adBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                </span>
            </span>`;
        } else {
            return `<span style="display: inline-block; background: rgba(15, 23, 42, 0.85); padding: 5px 12px; border-radius: 8px; margin-right: 6px; margin-top: 3px; border: 1.5px solid #10b981;">
                <strong style="color: #ffffff; font-size: 12.5px;">${nom}:</strong> <span style="color: #34d399; font-weight: 800;">+ Bs. ${netoFincaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                <small style="color: #6ee7b7; font-weight: 700; font-size: 11px;">($${netoFincaUSD.toFixed(2)} USD)</small>
            </span>`;
        }
    }).join(' ');

    const fincasConAdelanto = fincasSel.filter(f => (f.totalAdelantosUSD || 0) > 0);
    const adelantoResumenHtml = fincasConAdelanto.length > 0 
        ? `<span style="color: #ef4444; font-weight: 800; background: rgba(239, 68, 68, 0.15); padding: 2px 8px; border-radius: 5px; border: 1px solid #ef4444;">
            <i class="fa-solid fa-circle-minus"></i> Adelantos: -$${totalAdelantosUSD.toFixed(2)} (-Bs. ${totalAdelantosBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}) 
            <span style="color: #fca5a5; font-size: 11px; font-weight: 700; margin-left: 4px;">(${fincasConAdelanto.map(f => `${f.fincaNombre || f.FincaNombre}: -$${(f.totalAdelantosUSD || 0).toFixed(2)}`).join(', ')})</span>
           </span>`
        : `<span>Adelantos: <strong style="color: #94a3b8;">$0.00</strong></span>`;

    const detElem = document.getElementById('detalleFincasUnificarResumen');
    if (detElem) {
        detElem.innerHTML = `
            <div style="margin-bottom: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${detallesHtml}</div>
            <div style="font-size: 12px; color: #cbd5e1; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">
                <span>Total Bruto: <strong style="color: #38bdf8;">$${totalUSD.toFixed(2)} (Bs. ${totalBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</strong></span>
                ${adelantoResumenHtml}
                ${esDeudorTotal ? `<span style="color: #fca5a5; font-weight: 800; background: rgba(239,68,68,0.2); padding: 1px 8px; border-radius: 4px; border: 1px solid #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Sigue Debiendo: -$${deudaRestanteUSD.toFixed(2)} USD (-Bs. ${deudaRestanteBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</span>` : ''}
            </div>
        `;
    }

    const montoDisp = document.getElementById('montoNetoTotalUnificadoDisplay');
    if (montoDisp) {
        if (esDeudorTotal) {
            montoDisp.style.color = '#f87171';
            montoDisp.innerHTML = `Bs. 0,00<br><span style="font-size: 12px; font-weight: 800; color: #fca5a5;">(Deuda Restante: -$${deudaRestanteUSD.toFixed(2)} USD)</span>`;
        } else {
            montoDisp.style.color = '#34d399';
            montoDisp.innerHTML = `Bs. ${montoNetoPagarBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
        }
    }

    const btnPagar = document.getElementById('btnEjecutarPagoUnificado');
    if (btnPagar) {
        btnPagar.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${esDeudorTotal ? `Compensar y Registrar Adelanto (${fincasSel.length} Fincas)` : `Realizar Pago Unificado (${fincasSel.length} Fincas)`}`;
    }
}
window.actualizarBarraUnificarPagos = actualizarBarraUnificarPagos;

async function ejecutarPagoUnificadoModal() {
    const fincasSel = (preLiquidacionDataCache || []).filter(f => 
        fincasSeleccionadasUnificarSet.has(Number(f.fincaId || f.FincaId)) && !f.esPagado && !f.EsPagado
    );
    if (fincasSel.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Fincas Ya Pagadas',
            text: 'Las fincas seleccionadas ya se encuentran pagadas o no hay fincas pendientes.',
            background: '#1e293b',
            color: '#fff'
        });
        cancelarSeleccionUnificar();
        return;
    }

    let totalLitros = 0;
    let totalUSD = 0;
    let totalBrutoBs = 0;
    let totalAdelantosBs = 0;
    let totalAdelantosUSD = 0;
    let totalOtrasDeducBs = 0;

    fincasSel.forEach(f => {
        const esPag = !!(f.esPagado || f.EsPagado);
        const bUSD = f.totalUSD || 0;
        const fincaTasa = (f.tasaBcv && f.tasaBcv > 0) ? f.tasaBcv : ((state.tasaBcv && state.tasaBcv > 0) ? state.tasaBcv : (bUSD > 0 && (f.totalBrutoBs || 0) > 0 ? ((f.totalBrutoBs || 0) / bUSD) : 0));
        const bBs = (f.totalBrutoBs !== undefined && f.totalBrutoBs !== null) ? f.totalBrutoBs : ((!esPag && fincaTasa > 0) ? Math.round(bUSD * fincaTasa * 100) / 100 : (f.totalBrutoBs || 0));
        const adUSD = f.totalAdelantosUSD || 0;
        const adBs = (f.totalAdelantosBs !== undefined && f.totalAdelantosBs !== null) ? f.totalAdelantosBs : ((!esPag && fincaTasa > 0) ? Math.round(adUSD * fincaTasa * 100) / 100 : (f.totalAdelantosBs || 0));
        const otrasBs = f.otrasDeduccionesBs || 0;

        totalLitros += (f.totalLitros || 0);
        totalUSD += bUSD;
        totalBrutoBs += bBs;
        totalAdelantosBs += adBs;
        totalAdelantosUSD += adUSD;
        totalOtrasDeducBs += otrasBs;
    });

    const saldoNetoRealBs = totalBrutoBs - totalAdelantosBs - totalOtrasDeducBs;
    const esDeudor = (totalAdelantosUSD > totalUSD + 0.01) || (saldoNetoRealBs < -0.01);
    const deudaRestanteUSD = esDeudor ? Math.round((totalAdelantosUSD - totalUSD) * 100) / 100 : 0;
    const deudaRestanteBs = esDeudor ? Math.round((totalAdelantosBs - totalBrutoBs) * 100) / 100 : 0;
    const montoNetoPagarBs = Math.max(0, saldoNetoRealBs);

    const primerItem = fincasSel[0];
    const propietarioNombre = primerItem.propietario || primerItem.Propietario || 'Productor';
    const nombresFincas = fincasSel.map(f => f.fincaNombre || f.FincaNombre).join(', ');
    const fincasConAdelantoModal = fincasSel.filter(f => (f.totalAdelantosUSD || 0) > 0);
    const adelantoModalDetalleHtml = fincasConAdelantoModal.length > 0
        ? `<span style="color: #f87171; font-weight: 800;">-$${totalAdelantosUSD.toFixed(2)} (-Bs. ${totalAdelantosBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</span>
           <span style="color: #fca5a5; font-size: 11.5px; display: block; margin-top: 2px; font-weight: 700;">(Asignado a: ${fincasConAdelantoModal.map(f => `${f.fincaNombre || f.FincaNombre}: -$${(f.totalAdelantosUSD || 0).toFixed(2)}`).join(', ')})</span>`
        : `<span style="color: #94a3b8;">$0.00</span>`;

    const confirm = await Swal.fire({
        title: esDeudor ? '¿Compensar Saldos y Registrar Pago?' : '¿Confirmar Pago Unificado?',
        html: `
            <div style="text-align: left; font-size: 13.5px; line-height: 1.6; color: #cbd5e1;">
                <p style="margin-bottom: 8px;">Se realizará un <strong>pago unificado con compensación cruzada de saldos y adelantos</strong> para:</p>
                <div style="background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 10px;">
                    <strong>Productor / Titular:</strong> <span style="color: #38bdf8;">${propietarioNombre}</span><br>
                    <strong>Fincas Unificadas (${fincasSel.length}):</strong> <span style="color: #ffffff;">${nombresFincas}</span><br>
                    <strong>Total Bruto Leche:</strong> <span style="color: #38bdf8;">$${totalUSD.toFixed(2)} (Bs. ${totalBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</span><br>
                    <strong>Total Adelantos:</strong> ${adelantoModalDetalleHtml}
                </div>
                <div style="background: #0f172a; padding: 12px 14px; border-radius: 8px; border: 1.5px solid ${esDeudor ? '#ef4444' : '#10b981'}; text-align: center;">
                    <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">${esDeudor ? 'SALDO DEUDOR REMANENTE TRAS COMPENSACIÓN:' : 'MONTO NETO A TRANSFERIR:'}</span>
                    <div style="font-size: 22px; font-weight: 900; color: ${esDeudor ? '#f87171' : '#34d399'};">
                        ${esDeudor ? `Bs. 0,00` : `Bs. ${montoNetoPagarBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
                    </div>
                    ${esDeudor ? `<div style="color: #fca5a5; font-size: 13px; font-weight: 800; margin-top: 4px;">Sigue debiendo: -$${deudaRestanteUSD.toFixed(2)} USD (-Bs. ${deudaRestanteBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</div>` : ''}
                    <small style="color: #94a3b8; font-size: 11px; display: block; margin-top: 4px;">(Se amortiza el adelanto con la suma de la leche de ambas fincas)</small>
                </div>
            </div>
        `,
        icon: esDeudor ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonText: esDeudor ? 'Sí, Compensar y Registrar Pago' : 'Sí, Realizar Pago Unificado',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) return;

    try {
        let cicloIdParam = null;
        let cicloIdsParam = null;
        if (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
            cicloIdsParam = state.ciclosMultiLiquidacion.join(',');
        } else if (state.cicloSeleccionadoLiquidacion && state.cicloSeleccionadoLiquidacion !== 'ACTIVO') {
            cicloIdParam = Number(state.cicloSeleccionadoLiquidacion);
        } else {
            cicloIdParam = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;
        }

        let exitoCount = 0;

        for (const f of fincasSel) {
            const fId = Number(f.fincaId || f.FincaId);
            const res = await fetch(`${API_BASE}/catalogos/pre-liquidacion/pagar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    fincaId: fId,
                    cicloId: cicloIdParam,
                    cicloIds: cicloIdsParam,
                    pagado: true,
                    tasaBcv: state.tasaBcv || null
                })
            });
            if (res.ok) exitoCount++;
        }

        if (exitoCount > 0) {
            showToast(`¡Pago unificado registrado exitosamente para ${propietarioNombre}!`);
            const idsArray = fincasSel.map(f => Number(f.fincaId || f.FincaId));
            cancelarSeleccionUnificar();
            await cargarPreLiquidacion(true);

            // Desplegar de inmediato el comprobante oficial de pago unificado
            verReciboPagoConsolidadoModal(propietarioNombre, idsArray);
        } else {
            Swal.fire({ icon: 'error', title: 'Error al procesar pago unificado', text: 'No se pudo registrar el pago de las fincas.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.ejecutarPagoUnificadoModal = ejecutarPagoUnificadoModal;

function renderTablaLiquidacion(items) {
    const tbody = document.getElementById('tbodyLiquidacion');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center" style="padding: 20px; color: #9ca3af;">No se encontraron fincas ni recolecciones con el filtro especificado.</td></tr>';
        renderPaginacionControles('Liquidacion', 0, 0, 0);
        return;
    }

    // Contar cuantas fincas tiene cada propietario en este ciclo
    const mapPropietarioCount = {};
    items.forEach(l => {
        const propKey = (l.propietario || l.Propietario || '').trim().toUpperCase();
        if (propKey) mapPropietarioCount[propKey] = (mapPropietarioCount[propKey] || 0) + 1;
    });

    const total = items.length;
    const itemsPerPage = itemsPorPaginaLiquidacion;
    const totalPaginas = Math.ceil(total / itemsPerPage);
    if (paginaActualLiquidacion > totalPaginas) paginaActualLiquidacion = Math.max(1, totalPaginas);

    const inicio = (paginaActualLiquidacion - 1) * itemsPerPage;
    const fin = Math.min(inicio + itemsPerPage, total);
    const paginados = items.slice(inicio, fin);

    tbody.innerHTML = paginados
        .filter(l => {
            const nom = (l.fincaNombre || l.FincaNombre || '').toUpperCase();
            const prop = (l.propietario || l.Propietario || '').toUpperCase();
            const fId = l.fincaId || l.FincaId || 0;
            return !nom.includes('CHOFER') && !prop.includes('CHOFER') && fId !== 68;
        })
        .map(l => {
        const fIdNum = Number(l.fincaId || l.FincaId);
        const estaSeleccionadaUnificar = fincasSeleccionadasUnificarSet.has(fIdNum);

        const buenos = l.totalLitrosBuenos ?? (l.totalLitros - (l.totalLitrosAcidos || 0));
        const acidos = l.totalLitrosAcidos || 0;
        const lVaca = l.totalLitrosVaca || 0;
        const lBufala = l.totalLitrosBufala || 0;
        const esSoloBufala = (lBufala > 0 && lVaca === 0) || (l.fincaNombre || '').toUpperCase().includes('TARITA');
        const esMixta = lBufala > 0 && lVaca > 0;

        const badgeAcidos = acidos > 0 
            ? `<span style="color: #fbbf24; font-weight: 700; background: #451a03; border: 1px solid #78350f; padding: 2px 6px; border-radius: 4px; font-size: 11px;"><i class="fa-solid fa-flask"></i> ${acidos.toLocaleString()} L Ácida</span>`
            : '';

        let desgloseLitrosHtml = '';
        let preciosHtml = '';

        if (esMixta) {
            desgloseLitrosHtml = `
                <span style="color: #2563eb; font-weight: 700; font-size: 11px;"><i class="fa-solid fa-mug-saucer"></i> ${lVaca.toLocaleString()} L Vaca</span><br>
                <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px;"><i class="fa-solid fa-cow"></i> ${lBufala.toLocaleString()} L Búfala</span>
                ${acidos > 0 ? `<br>${badgeAcidos}` : ''}
            `;
            preciosHtml = `
                <span style="color: #2563eb; font-weight: 700; font-size: 11px;">Vaca: $${(l.precioLitroUSD || 0.84).toFixed(4)}</span><br>
                <span style="color: #047857; font-weight: 800; font-size: 11px;">Búfala: $${(l.precioLitroBufalaUSD || 1.02).toFixed(4)}</span>
                ${acidos > 0 ? `<br><small style="color: #fbbf24; font-size: 10.5px; font-weight: 700;">Ácida: $${(l.precioLitroAcidaUSD || 0.42).toFixed(4)}</small>` : ''}
            `;
        } else if (esSoloBufala) {
            desgloseLitrosHtml = `
                <span class="badge" style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-weight: 800; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; display: inline-block;"><i class="fa-solid fa-cow"></i> ${buenos.toLocaleString()} L Búfala</span>
                ${acidos > 0 ? `<br>${badgeAcidos}` : ''}
            `;
            const pBuf = l.precioLitroBufalaUSD > 0 ? l.precioLitroBufalaUSD : (l.precioLitroUSD > 0 ? l.precioLitroUSD : 1.02);
            preciosHtml = `
                <span style="color: #047857; font-weight: 800; font-size: 12.5px;">$${pBuf.toFixed(4)}</span><br>
                <small style="color: #047857; font-weight: 700; font-size: 10px;">(Búfala)</small>
                ${acidos > 0 ? `<br><small style="color: #fbbf24; font-size: 10.5px; font-weight: 700;">Ácida: $${(l.precioLitroAcidaUSD || 0.42).toFixed(4)}</small>` : ''}
            `;
        } else {
            desgloseLitrosHtml = `
                <span style="color: #2563eb; font-weight: 700; font-size: 11.5px;"><i class="fa-solid fa-mug-saucer"></i> ${buenos.toLocaleString()} L Vaca</span>
                ${acidos > 0 ? `<br>${badgeAcidos}` : ''}
            `;
            preciosHtml = `
                <span style="color: #2563eb; font-weight: 700; font-size: 12.5px;">$${(l.precioLitroUSD || 0.84).toFixed(4)}</span>
                ${acidos > 0 ? `<br><small style="color: #fbbf24; font-size: 10.5px; font-weight: 700;">Ácida: $${(l.precioLitroAcidaUSD || 0.42).toFixed(4)}</small>` : ''}
            `;
        }

        const adelantoDetalleStr = l.cuotasDetalle ? `<br><small style="color: #e11d48; font-size: 10.5px; font-weight: 600;">${l.cuotasDetalle}</small>` : '';
        const adelantoBsVal = l.totalAdelantosBs || 0;
        const adelantoUSDVal = l.totalAdelantosUSD || 0;
        const brutoUSDVal = l.totalUSD || 0;

        const esPagadoFlag = !!(l.esPagado || l.EsPagado);
        const esDeudor = (adelantoUSDVal > brutoUSDVal + 0.01) || (l.totalNetoBs <= 0 && adelantoBsVal > 0);
        const deudaRestanteUSD = esDeudor ? Math.round((adelantoUSDVal - brutoUSDVal) * 100) / 100 : 0;
        const deudaRestanteBs = esDeudor ? Math.round((adelantoBsVal - (l.totalBrutoBs || 0)) * 100) / 100 : 0;

        let badgeEstado = '';
        if (esPagadoFlag) {
            badgeEstado = `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> PAGADO</span>`;
        } else if (esDeudor) {
            badgeEstado = `<span class="badge" style="background: #fef2f2; color: #dc2626; border: 1.5px solid #fecdd3; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;" title="Adelantos superan el bruto del pago"><i class="fa-solid fa-triangle-exclamation"></i> SALDO DEUDOR</span>`;
        } else {
            badgeEstado = `<span class="badge" style="background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700;"><i class="fa-solid fa-clock"></i> PENDIENTE</span>`;
        }

        const esAdmin = state.user && ((state.user.rol || '').toUpperCase().includes('ADMIN') || (state.user.rol || '').toUpperCase() === 'ADMINISTRADOR GENERAL');
        const puedePagar = esAdmin || tienePermiso('LIQUIDACIONES_PAGAR') || tienePermiso('LIQUIDACIONES_CREAR');
        const puedeEditar = esAdmin || tienePermiso('LIQUIDACIONES_EDITAR');

        const switchPago = `
            <div style="display: flex; justify-content: center; align-items: center;">
                <input type="checkbox" ${esPagadoFlag ? 'checked' : ''} ${!puedePagar ? 'disabled' : ''} onchange="togglePagoLiquidacion(${l.fincaId}, this.checked)" style="width: 22px; height: 22px; cursor: ${puedePagar ? 'pointer' : 'not-allowed'}; accent-color: #10b981;" title="${!puedePagar ? 'Sin permisos para registrar/modificar pagos' : (esPagadoFlag ? 'Marcar como Pendiente (Revertir)' : 'Marcar como Pagado')}">
            </div>
        `;

        const propKey = (l.propietario || l.Propietario || '').trim().toUpperCase();
        const fincasDelProp = (preLiquidacionDataCache || []).filter(x => (x.propietario || x.Propietario || '').trim().toUpperCase() === propKey);
        const tieneVariasFincas = fincasDelProp.length > 1;
        const fincasDelPropIds = fincasDelProp.map(x => Number(x.fincaId || x.FincaId));
        const fincasIdsJson = JSON.stringify(fincasDelPropIds);

        const btnRecibo = tieneVariasFincas
            ? `<button type="button" class="btn btn-outline" onclick="verReciboPagoConsolidadoModal('${(l.propietario || '').replace(/'/g, "\\'")}', ${fincasIdsJson})" title="Ver Comprobante Oficial Unificado (${fincasDelProp.length} Fincas)" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; margin-left: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-file-invoice"></i> Recibo</button>`
            : `<button type="button" class="btn btn-outline" onclick="verReciboPagoLiquidacionModal(${l.fincaId})" title="Ver Comprobante de Pago" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; margin-left: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-file-invoice"></i> Recibo</button>`;

        const btnUnirPagos = tieneVariasFincas
            ? `<br><button type="button" class="btn btn-sm" onclick="seleccionarFincasDeProductorParaUnificar('${(l.propietario || '').replace(/'/g, "\\'")}')" style="padding: 3px 8px; font-size: 11px; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1.5px solid #93c5fd; border-radius: 6px; margin-top: 5px; cursor: pointer;" title="Seleccionar y Unificar Pagos de este productor"><i class="fa-solid fa-link"></i> Unir Pagos (${fincasDelProp.length} Fincas)</button>`
            : '';

        const netoDisplay = esDeudor
            ? `<strong style="color: #dc2626; font-size: 14.5px;">Bs. 0,00</strong><br><small style="color: #dc2626; font-weight: 800; font-size: 10px;">Deuda Restante: -$${deudaRestanteUSD.toFixed(2)} USD<br>(-Bs. ${deudaRestanteBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</small>`
            : `<strong style="color: #047857; font-size: 15px;">Bs. ${(l.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>`;

        const rowBackground = estaSeleccionadaUnificar 
            ? 'background-color: #eff6ff; border-left: 4px solid #2563eb;' 
            : (esPagadoFlag ? 'background-color: #f0fdf4;' : (esDeudor ? 'background-color: #fff5f5;' : ''));

        const semPendientesRaw = l.semanasPendientes || l.SemanasPendientes || '';
        const semPendientes = obtenerSemanasCerradasAnterioresStr(semPendientesRaw);
        const semPagadas = l.semanasPagadas || l.SemanasPagadas || '';
        const cantSemPend = semPendientes ? semPendientes.split(',').length : 0;

        let badgeSemanasHtml = '';
        if (!esPagadoFlag && semPendientes) {
            badgeSemanasHtml = `
                <div style="margin-top: 4px;">
                    <span class="badge" style="background: #fff7ed; color: #c2410c; border: 1.5px solid #fed7aa; font-size: 11px; padding: 2.5px 7px; border-radius: 6px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;" title="Semanas no pagadas de esta finca">
                        <i class="fa-solid fa-calendar-xmark" style="color: #ea580c;"></i>
                        ${cantSemPend > 1 ? `Semanas no pagadas (${cantSemPend}): ${semPendientes}` : `Semana no pagada: ${semPendientes}`}
                    </span>
                </div>
            `;
            if (semPagadas) {
                badgeSemanasHtml += `
                    <div style="margin-top: 2px;">
                        <span class="badge" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 10px; padding: 1.5px 6px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                            <i class="fa-solid fa-circle-check"></i> Pagadas: ${semPagadas}
                        </span>
                    </div>
                `;
            }
        } else if (esPagadoFlag && (semPagadas || l.semanasUnificadas)) {
            const semTxt = semPagadas || l.semanasUnificadas;
            badgeSemanasHtml = `
                <div style="margin-top: 4px;">
                    <span class="badge" style="background: #f0fdf4; color: #15803d; border: 1.5px solid #bbf7d0; font-size: 11px; padding: 2.5px 7px; border-radius: 6px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-circle-check"></i> Pagado: ${semTxt}
                    </span>
                </div>
            `;
        }

        return `
            <tr style="${rowBackground}">
                <td style="text-align: center; vertical-align: middle;">
                    <input type="checkbox" class="chk-finca-unificar" value="${l.fincaId}" ${estaSeleccionadaUnificar ? 'checked' : ''} onchange="toggleFincaUnificar(${l.fincaId}, this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: #2563eb;" title="Seleccionar para unificar pago">
                </td>
                <td>
                    <strong>${capitalizarTexto(l.fincaNombre)}</strong><br>
                    <small style="color: #64748b;">${capitalizarTexto(l.propietario)}</small>
                    ${badgeSemanasHtml}
                    ${btnUnirPagos}
                </td>
                <td style="text-align: right;"><strong>${l.totalLitros.toLocaleString()} Lts</strong></td>
                <td style="text-align: center;">
                    ${desgloseLitrosHtml}
                </td>
                <td style="text-align: right;">
                    ${preciosHtml}
                </td>
                <td style="text-align: right; font-weight: 700; color: #2563eb;">$${l.totalUSD.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 600;">
                    Bs. ${l.totalBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    <br><small style="color: #475569; font-size: 10.5px; font-weight: 700;">@ Bs. ${(l.tasaBcv || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${!esPagadoFlag ? ' (BCV Actual)' : ''}</small>
                </td>
                <td style="text-align: right;"><span style="color: ${adelantoBsVal > 0 ? '#ef4444' : '#94a3b8'}; font-weight: 800;">${adelantoBsVal > 0 ? `- Bs. ${adelantoBsVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '-'}${adelantoBsVal > 0 ? adelantoDetalleStr : ''}</span></td>
                <td style="text-align: right;">${netoDisplay}</td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: center;">${switchPago}</td>
                <td style="text-align: center; white-space: nowrap;">
                    ${puedeEditar ? `
                    <button type="button" class="btn btn-outline" onclick="abrirModalEditarLiquidacion(${l.fincaId})" title="Editar Liquidación: Litros, Tasa Bs, Valor Leche" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #93c5fd; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    ` : ''}
                    <button type="button" class="btn btn-outline" onclick="verDetalleCompraLecheFincaModal(${l.fincaId})" title="Ver Detalle Diario de Compra de Leche" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; border-radius: 6px; margin-left: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-list-check"></i> Detalle
                    </button>
                    ${btnRecibo}
                </td>
            </tr>
        `;
    }).join('');

    renderPaginacionControles('Liquidacion', inicio + 1, fin, total, paginaActualLiquidacion, totalPaginas);
}

function actualizarContadorFincasPagadas(items) {
    const badge = document.getElementById('badgeContadorFincasPagadas');
    const spanPag = document.getElementById('spanFincasPagadas');
    const spanTot = document.getElementById('spanFincasTotales');
    if (!badge || !spanPag || !spanTot) return;

    // Excluir choferes igual que en renderTablaLiquidacion
    const filtradas = (items || []).filter(l => {
        const nom = (l.fincaNombre || l.FincaNombre || '').toUpperCase();
        const prop = (l.propietario || l.Propietario || '').toUpperCase();
        const fId = l.fincaId || l.FincaId || 0;
        return !nom.includes('CHOFER') && !prop.includes('CHOFER') && fId !== 68;
    });

    const total = filtradas.length;
    const pagadas = filtradas.filter(l => !!(l.esPagado || l.EsPagado)).length;

    spanPag.innerText = pagadas;
    spanTot.innerText = total;

    // Actualizar color del badge según ratio
    if (total === 0) {
        badge.style.display = 'none';
    } else {
        badge.style.display = 'inline-flex';
        if (pagadas === total) {
            // Todas pagadas — verde brillante
            badge.style.background = '#ecfdf5';
            badge.style.borderColor = '#6ee7b7';
            badge.style.color = '#047857';
        } else if (pagadas > 0) {
            // Parcialmente pagadas — azul
            badge.style.background = '#eff6ff';
            badge.style.borderColor = '#93c5fd';
            badge.style.color = '#1d4ed8';
        } else {
            // Ninguna pagada — amarillo/pendiente
            badge.style.background = '#fffbeb';
            badge.style.borderColor = '#fde68a';
            badge.style.color = '#b45309';
        }
    }
}
window.actualizarContadorFincasPagadas = actualizarContadorFincasPagadas;

// Obtiene el banco efectivo para un registro de liquidación (Prioridad 1: Propietario, Prioridad 2: Finca)
function obtenerBancoEfectivoLiquidacion(item) {
    if (!item) return '';
    const bProp = (item.propietarioBancoNombre || item.PropietarioBancoNombre || '').trim();
    if (bProp && bProp.toUpperCase() !== 'SIN BANCO' && bProp !== 'N/A') return bProp;
    const bFinca = (item.bancoNombre || item.BancoNombre || '').trim();
    if (bFinca && bFinca.toUpperCase() !== 'SIN BANCO' && bFinca !== 'N/A') return bFinca;
    return '';
}
window.obtenerBancoEfectivoLiquidacion = obtenerBancoEfectivoLiquidacion;

// Puebla el select de bancos con los bancos únicos de los PROPIETARIOS / FINCAS
function poblarFiltroBancosLiquidacion(items) {
    const sel = document.getElementById('selectFiltroBancoLiquidacion');
    if (!sel) return;

    const valorActual = sel.value || 'TODOS';

    const bancosUnicos = new Set();
    (items || []).forEach(l => {
        const nom = (l.fincaNombre || l.FincaNombre || '').toUpperCase();
        const prop = (l.propietario || l.Propietario || '').toUpperCase();
        const fId = l.fincaId || l.FincaId || 0;
        if (nom.includes('CHOFER') || prop.includes('CHOFER') || fId === 68) return;
        const b = obtenerBancoEfectivoLiquidacion(l);
        if (b) bancosUnicos.add(b);
    });

    const listaOrdenada = [...bancosUnicos].sort();
    const opcionesActuales = Array.from(sel.options).map(o => o.value);
    const nuevasOpciones = ['TODOS', ...listaOrdenada];

    // Evitar parpadeo y reseteo si las opciones no han cambiado
    const opcionesCambiaron = opcionesActuales.length !== nuevasOpciones.length || !opcionesActuales.every((v, i) => v === nuevasOpciones[i]);

    if (opcionesCambiaron) {
        sel.innerHTML = '<option value="TODOS">Todos los Bancos</option>';
        listaOrdenada.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            sel.appendChild(opt);
        });
    }

    // Mantener selección anterior si sigue disponible
    if (valorActual && Array.from(sel.options).some(o => o.value === valorActual)) {
        sel.value = valorActual;
    } else {
        sel.value = 'TODOS';
    }
}
window.poblarFiltroBancosLiquidacion = poblarFiltroBancosLiquidacion;

// Actualiza el panel resumen financiero (USD/Bs pagados vs pendientes)
function actualizarResumenFinanciero(items) {
    const panel = document.getElementById('panelResumenFinanciero');
    if (!panel) return;

    const filtradas = (items || []).filter(l => {
        const nom = (l.fincaNombre || l.FincaNombre || '').toUpperCase();
        const prop = (l.propietario || l.Propietario || '').toUpperCase();
        const fId = l.fincaId || l.FincaId || 0;
        return !nom.includes('CHOFER') && !prop.includes('CHOFER') && fId !== 68;
    });

    if (filtradas.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    let totalUSD = 0, totalNetoBs = 0;
    let pagadoUSD = 0, pagadoNetoBs = 0;

    filtradas.forEach(l => {
        const usd = Number(l.totalUSD || l.TotalUSD || 0);
        const neto = Number(l.totalNetoBs || l.TotalNetoBs || 0);
        const pagado = !!(l.esPagado || l.EsPagado);
        totalUSD += usd;
        totalNetoBs += neto;
        if (pagado) { pagadoUSD += usd; pagadoNetoBs += neto; }
    });

    const totalFincas = filtradas.length;
    const pagadasFincas = filtradas.filter(l => !!(l.esPagado || l.EsPagado)).length;
    const pendientesFincas = totalFincas - pagadasFincas;

    const pendienteUSD = totalUSD - pagadoUSD;
    const pendienteNetoBs = totalNetoBs - pagadoNetoBs;

    // Cálculo dinámico y preciso del porcentaje de avance:
    // Si faltan fincas por pagar (ej: 50 de 52), nunca debe redondearse al 100%.
    let pct = 0;
    if (totalFincas > 0) {
        if (pagadasFincas === totalFincas && pendienteUSD <= 0.01) {
            pct = 100;
        } else if (pagadasFincas === 0) {
            pct = 0;
        } else {
            // Porcentaje exacto basado en fincas pagadas vs fincas totales (ej. 50/52 = 96.15% -> 96%)
            const rawPct = (pagadasFincas / totalFincas) * 100;
            pct = Math.min(99, Math.floor(rawPct));
        }
    }

    const fmt2 = n => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setEl('resumenTotalUSD',     fmt2(totalUSD));
    setEl('resumenTotalBs',      fmt2(totalNetoBs));
    setEl('resumenPagadoUSD',    fmt2(pagadoUSD));
    setEl('resumenPagadoBs',     fmt2(pagadoNetoBs));
    setEl('resumenPendienteUSD', fmt2(Math.max(0, pendienteUSD)));
    setEl('resumenPendienteBs',  fmt2(Math.max(0, pendienteNetoBs)));
    setEl('resumenPorcentaje',   pct);

    const barra = document.getElementById('resumenBarraProg');
    if (barra) barra.style.width = pct + '%';
}
window.actualizarResumenFinanciero = actualizarResumenFinanciero;

function filtrarTablaLiquidacion(mantenerPagina = false) {
    const q = (document.getElementById('inputBuscarLiquidacionFinca')?.value || '').toLowerCase().trim();
    const filtroPago = (document.getElementById('selectFiltroPagadoLiquidacion')?.value || 'TODOS').toUpperCase();
    const filtroBanco = (document.getElementById('selectFiltroBancoLiquidacion')?.value || 'TODOS').trim();
    if (!mantenerPagina) {
        paginaActualLiquidacion = 1;
    }

    // Aplicar filtros sobre el cache completo
    let resultado = (preLiquidacionDataCache || []);

    if (q) {
        resultado = resultado.filter(item => {
            const finca = (item.fincaNombre || item.FincaNombre || '').toLowerCase();
            const prop = (item.propietario || item.Propietario || '').toLowerCase();
            const banco = obtenerBancoEfectivoLiquidacion(item).toLowerCase();
            return finca.includes(q) || prop.includes(q) || banco.includes(q);
        });
    }

    // Filtro por BANCO EFECTIVO DEL PRODUCTOR O FINCA
    if (filtroBanco && filtroBanco !== 'TODOS') {
        resultado = resultado.filter(item => {
            const b = obtenerBancoEfectivoLiquidacion(item);
            return b.toLowerCase() === filtroBanco.toLowerCase();
        });
    }

    if (filtroPago === 'PAGADO') {
        resultado = resultado.filter(item => !!(item.esPagado || item.EsPagado));
    } else if (filtroPago === 'PENDIENTE') {
        resultado = resultado.filter(item => !(item.esPagado || item.EsPagado));
    }

    preLiquidacionFiltradosCache = resultado;

    if (state.modoPreliquidacion === 'PROPIETARIO') {
        renderTablaLiquidacionConsolidadaPropietario(resultado);
    } else {
        renderTablaLiquidacion(resultado);
    }
    // Siempre actualizar contador y resumen con datos totales reales
    actualizarContadorFincasPagadas(preLiquidacionDataCache);
    actualizarResumenFinanciero(preLiquidacionDataCache);
}
window.filtrarTablaLiquidacion = filtrarTablaLiquidacion;

function cambiarModoPreliquidacion(modo) {
    state.modoPreliquidacion = modo;
    const btnFinca = document.getElementById('btnModoLiqFinca');
    const btnProp = document.getElementById('btnModoLiqPropietario');

    if (modo === 'PROPIETARIO') {
        if (btnFinca) {
            btnFinca.style.background = 'transparent';
            btnFinca.style.color = '#64748b';
        }
        if (btnProp) {
            btnProp.style.background = '#2563eb';
            btnProp.style.color = '#ffffff';
        }
    } else {
        if (btnFinca) {
            btnFinca.style.background = '#2563eb';
            btnFinca.style.color = '#ffffff';
        }
        if (btnProp) {
            btnProp.style.background = 'transparent';
            btnProp.style.color = '#64748b';
        }
    }
    filtrarTablaLiquidacion(true);
}
window.cambiarModoPreliquidacion = cambiarModoPreliquidacion;

function obtenerPreliquidacionConsolidada(items) {
    if (!items || items.length === 0) return [];

    const grupos = {};
    items.forEach(l => {
        const nom = (l.fincaNombre || l.FincaNombre || '').toUpperCase();
        const prop = (l.propietario || l.Propietario || '').toUpperCase();
        const fId = l.fincaId || l.FincaId || 0;

        if (nom.includes('CHOFER') || prop.includes('CHOFER') || fId === 68) return;

        const propKey = prop.trim() || nom.trim();

        if (!grupos[propKey]) {
            grupos[propKey] = {
                propietario: l.propietario || l.Propietario || l.fincaNombre,
                propietarioId: l.propietarioId || l.PropietarioId || 0,
                cedulaRIF: l.cedulaRIF || l.CedulaRIF || '',
                bancoNombre: l.bancoNombre || l.BancoNombre || '',
                numeroCuenta: l.numeroCuenta || l.NumeroCuenta || '',
                propietarioBancoNombre: l.propietarioBancoNombre || l.PropietarioBancoNombre || '',
                propietarioBancoId: l.propietarioBancoId || l.PropietarioBancoId || null,
                propietarioNumeroCuenta: l.propietarioNumeroCuenta || l.PropietarioNumeroCuenta || '',
                fincas: [],
                fincaIds: [],
                totalLitros: 0,
                totalLitrosBuenos: 0,
                totalLitrosVaca: 0,
                totalLitrosBufala: 0,
                totalLitrosAcidos: 0,
                totalUSD: 0,
                totalBrutoBs: 0,
                totalAdelantosBs: 0,
                totalAdelantosUSD: 0,
                otrasDeduccionesBs: 0,
                totalNetoBs: 0,
                deudaRestanteUSD: 0,
                deudaRestanteBs: 0,
                cuotasDetalles: [],
                semanasUnificadas: l.semanasUnificadas || l.SemanasUnificadas || '',
                semanasPendientesSet: new Set(),
                semanasPagadasSet: new Set(),
                esPagado: true,
                algunoPagado: false
            };
        }

        const g = grupos[propKey];
        g.fincas.push(l);
        g.fincaIds.push(l.fincaId || l.FincaId);

        const semPRaw = l.semanasPendientes || l.SemanasPendientes || '';
        const semP = obtenerSemanasCerradasAnterioresStr(semPRaw);
        if (semP) {
            semP.split(',').forEach(s => {
                const tr = s.trim();
                if (tr) g.semanasPendientesSet.add(tr);
            });
        }
        const semPag = l.semanasPagadas || l.SemanasPagadas || '';
        if (semPag) {
            semPag.split(',').forEach(s => {
                const tr = s.trim();
                if (tr) g.semanasPagadasSet.add(tr);
            });
        }

        const buenos = l.totalLitrosBuenos ?? (l.totalLitros - (l.totalLitrosAcidos || 0));
        const acidos = l.totalLitrosAcidos ?? 0;
        const lV = l.totalLitrosVaca || 0;
        const lB = l.totalLitrosBufala || 0;

        g.totalLitros += (l.totalLitros || 0);
        g.totalLitrosBuenos += buenos;
        g.totalLitrosVaca += lV;
        g.totalLitrosBufala += lB;
        g.totalLitrosAcidos += acidos;
        g.totalUSD += (l.totalUSD || 0);
        g.totalBrutoBs += (l.totalBrutoBs || 0);
        g.totalAdelantosBs += (l.totalAdelantosBs || 0);
        g.totalAdelantosUSD += (l.totalAdelantosUSD || 0);
        g.otrasDeduccionesBs += (l.otrasDeduccionesBs || 0);
        if (l.cuotasDetalle) g.cuotasDetalles.push(`${l.fincaNombre}: ${l.cuotasDetalle}`);

        const esP = !!(l.esPagado || l.EsPagado);
        if (!esP) g.esPagado = false;
        if (esP) g.algunoPagado = true;
    });

    return Object.values(grupos).map(g => {
        g.totalNetoBs = Math.max(0, g.totalBrutoBs - g.totalAdelantosBs - g.otrasDeduccionesBs);
        if (g.totalAdelantosUSD > g.totalUSD) {
            g.deudaRestanteUSD = Math.round((g.totalAdelantosUSD - g.totalUSD) * 100) / 100;
            g.deudaRestanteBs = Math.round((g.totalAdelantosBs - g.totalBrutoBs) * 100) / 100;
        } else {
            g.deudaRestanteUSD = 0;
            g.deudaRestanteBs = 0;
        }
        g.fincasNombresStr = g.fincas.map(f => f.fincaNombre || f.FincaNombre).join(', ');
        g.cuotasDetalle = g.cuotasDetalles.join(' | ');
        g.semanasPendientesStr = Array.from(g.semanasPendientesSet || []).join(', ');
        g.cantidadSemanasPendientes = (g.semanasPendientesSet ? g.semanasPendientesSet.size : 0);
        g.semanasPagadasStr = Array.from(g.semanasPagadasSet || []).join(', ');
        g.cantidadSemanasPagadas = (g.semanasPagadasSet ? g.semanasPagadasSet.size : 0);
        return g;
    });
}
window.obtenerPreliquidacionConsolidada = obtenerPreliquidacionConsolidada;

function renderTablaLiquidacionConsolidadaPropietario(items) {
    const tbody = document.getElementById('tbodyLiquidacion');
    if (!tbody) return;

    const consolidados = obtenerPreliquidacionConsolidada(items);

    if (!consolidados || consolidados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center" style="padding: 20px; color: #9ca3af;">No se encontraron productores con el filtro especificado.</td></tr>';
        renderPaginacionControles('Liquidacion', 0, 0, 0);
        return;
    }

    const total = consolidados.length;
    const itemsPerPage = itemsPorPaginaLiquidacion;
    const totalPaginas = Math.ceil(total / itemsPerPage);
    if (paginaActualLiquidacion > totalPaginas) paginaActualLiquidacion = Math.max(1, totalPaginas);

    const inicio = (paginaActualLiquidacion - 1) * itemsPerPage;
    const fin = Math.min(inicio + itemsPerPage, total);
    const paginados = consolidados.slice(inicio, fin);

    tbody.innerHTML = paginados.map(g => {
        const buenos = g.totalLitrosBuenos;
        const acidos = g.totalLitrosAcidos;
        const lVaca = g.totalLitrosVaca || 0;
        const lBufala = g.totalLitrosBufala || 0;
        const esSoloBufala = lBufala > 0 && lVaca === 0;
        const esMixta = lBufala > 0 && lVaca > 0;

        const badgeAcidos = acidos > 0 
            ? `<span style="color: #fbbf24; font-weight: 700; background: #451a03; border: 1px solid #78350f; padding: 2px 6px; border-radius: 4px; font-size: 11px;"><i class="fa-solid fa-flask"></i> ${acidos.toLocaleString()} L Ácida</span>`
            : '';

        let desgloseLitrosHtml = '';
        if (esMixta) {
            desgloseLitrosHtml = `
                <span style="color: #2563eb; font-weight: 700; font-size: 11px;"><i class="fa-solid fa-mug-saucer"></i> ${lVaca.toLocaleString()} L Vaca</span><br>
                <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px;"><i class="fa-solid fa-cow"></i> ${lBufala.toLocaleString()} L Búfala</span>
                ${acidos > 0 ? `<br>${badgeAcidos}` : ''}
            `;
        } else if (esSoloBufala) {
            desgloseLitrosHtml = `
                <span class="badge" style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-weight: 800; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; display: inline-block;"><i class="fa-solid fa-cow"></i> ${buenos.toLocaleString()} L Búfala</span>
                ${acidos > 0 ? `<br>${badgeAcidos}` : ''}
            `;
        } else {
            desgloseLitrosHtml = `
                <span style="color: #2563eb; font-weight: 700; font-size: 11.5px;"><i class="fa-solid fa-mug-saucer"></i> ${buenos.toLocaleString()} L Vaca</span>
                ${acidos > 0 ? `<br>${badgeAcidos}` : ''}
            `;
        }

        const precioPromedio = g.totalLitros > 0 ? (g.totalUSD / g.totalLitros) : 0;
        const precioNormalStr = `$${precioPromedio.toFixed(4)} <small style="color: #94a3b8;">(Prom.)</small>`;

        const otrasDeduc = g.otrasDeduccionesBs;
        const adelantoBsVal = g.totalAdelantosBs;
        const adelantoDetalleStr = g.cuotasDetalle ? `<br><small style="color: #e11d48; font-size: 10.5px; font-weight: 600;">${g.cuotasDetalle}</small>` : '';

        const esPagadoFlag = g.esPagado;
        const esDeudor = g.deudaRestanteUSD > 0.01 || (g.totalAdelantosUSD > g.totalUSD);

        let badgeEstado = '';
        if (esPagadoFlag) {
            badgeEstado = `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> CONSOLIDADO PAGADO</span>`;
        } else if (g.algunoPagado) {
            badgeEstado = `<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;"><i class="fa-solid fa-circle-half-stroke"></i> PARCIALMENTE PAGADO</span>`;
        } else if (esDeudor) {
            badgeEstado = `<span class="badge" style="background: #fef2f2; color: #dc2626; border: 1.5px solid #fecdd3; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;" title="Adelantos superan el valor bruto del período"><i class="fa-solid fa-triangle-exclamation"></i> SALDO DEUDOR</span>`;
        } else {
            badgeEstado = `<span class="badge" style="background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700;"><i class="fa-solid fa-clock"></i> PENDIENTE</span>`;
        }

        const esAdmin = state.user && ((state.user.rol || '').toUpperCase().includes('ADMIN') || (state.user.rol || '').toUpperCase() === 'ADMINISTRADOR GENERAL');
        const puedePagar = esAdmin || tienePermiso('LIQUIDACIONES_PAGAR') || tienePermiso('LIQUIDACIONES_CREAR');

        const idsJson = JSON.stringify(g.fincaIds);
        const switchPago = `
            <div style="display: flex; justify-content: center; align-items: center;">
                <input type="checkbox" ${esPagadoFlag ? 'checked' : ''} ${!puedePagar ? 'disabled' : ''} onchange="togglePagoLiquidacionConsolidada('${g.propietario.replace(/'/g, "\\'")}', ${idsJson}, this.checked)" style="width: 22px; height: 22px; cursor: ${puedePagar ? 'pointer' : 'not-allowed'}; accent-color: #10b981;" title="${!puedePagar ? 'Sin permisos para procesar pagos' : (esPagadoFlag ? 'Revertir Pago Consolidado' : 'Registrar Pago Consolidado')}">
            </div>
        `;

        const btnDetalle = `
            <button type="button" class="btn btn-outline" onclick="verDetalleCompraLecheConsolidadaModal('${g.propietario.replace(/'/g, "\\'")}', ${idsJson})" title="Ver Detalle Diario de Compra de Leche Consolidado" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; border-radius: 6px; margin-left: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-list-check"></i> Detalle
            </button>
        `;

        const btnRecibo = `
            <button type="button" class="btn btn-outline" onclick="verReciboPagoConsolidadoModal('${g.propietario.replace(/'/g, "\\'")}', ${idsJson})" title="Ver / Imprimir Comprobante Oficial Consolidado" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; margin-left: 4px;">
                <i class="fa-solid fa-file-invoice"></i> Recibo
            </button>
        `;

        const netoDisplay = esDeudor
            ? `<strong style="color: #dc2626; font-size: 15px;">Bs. 0,00</strong><br><small style="color: #dc2626; font-weight: 800; font-size: 10px;">Deuda Restante: -$${g.deudaRestanteUSD.toFixed(2)}<br>(-Bs. ${g.deudaRestanteBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })})</small>`
            : `<strong style="color: #047857; font-size: 15px;">Bs. ${g.totalNetoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>`;

        const badgeFincas = `<span class="badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-size: 10.5px; padding: 2px 6px; font-weight: 700; margin-top: 3px; display: inline-block;"><i class="fa-solid fa-layer-group"></i> ${g.fincas.length} Finca${g.fincas.length > 1 ? 's' : ''}: ${g.fincasNombresStr}</span>`;

        let badgeSemanasHtml = '';
        if (!esPagadoFlag && g.semanasPendientesStr) {
            badgeSemanasHtml = `
                <div style="margin-top: 4px;">
                    <span class="badge" style="background: #fff7ed; color: #c2410c; border: 1.5px solid #fed7aa; font-size: 11px; padding: 2.5px 7px; border-radius: 6px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;" title="Semanas no pagadas de este productor">
                        <i class="fa-solid fa-calendar-xmark" style="color: #ea580c;"></i>
                        ${(g.cantidadSemanasPendientes || 1) > 1 ? `Semanas no pagadas (${g.cantidadSemanasPendientes}): ${g.semanasPendientesStr}` : `Semana no pagada: ${g.semanasPendientesStr}`}
                    </span>
                </div>
            `;
            if (g.semanasPagadasStr) {
                badgeSemanasHtml += `
                    <div style="margin-top: 2px;">
                        <span class="badge" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 10px; padding: 1.5px 6px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                            <i class="fa-solid fa-circle-check"></i> Pagadas: ${g.semanasPagadasStr}
                        </span>
                    </div>
                `;
            }
        } else if (esPagadoFlag && (g.semanasPagadasStr || g.semanasUnificadas)) {
            const semTxt = g.semanasPagadasStr || g.semanasUnificadas;
            badgeSemanasHtml = `
                <div style="margin-top: 4px;">
                    <span class="badge" style="background: #f0fdf4; color: #15803d; border: 1.5px solid #bbf7d0; font-size: 11px; padding: 2.5px 7px; border-radius: 6px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-circle-check"></i> Pagado: ${semTxt}
                    </span>
                </div>
            `;
        }

        return `
            <tr style="${esPagadoFlag ? 'background-color: #f0fdf4;' : (esDeudor ? 'background-color: #fff5f5;' : '')}">
                <td>
                    <strong style="font-size: 13.5px; color: #0f172a;"><i class="fa-solid fa-user-check" style="color: #2563eb;"></i> ${g.propietario}</strong>
                    <br>${badgeFincas}
                    ${badgeSemanasHtml}
                </td>
                <td style="text-align: right;"><strong>${g.totalLitros.toLocaleString()} Lts</strong></td>
                <td style="text-align: center;">
                    ${desgloseLitrosHtml}
                </td>
                <td style="text-align: right; font-size: 12px; font-weight: 700; color: #2563eb;">
                    ${precioNormalStr}
                </td>
                <td style="text-align: right; font-weight: 700; color: #2563eb;">$${g.totalUSD.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 600;">
                    Bs. ${g.totalBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    <br><small style="color: #475569; font-size: 10.5px; font-weight: 700;">@ Bs. ${(g.fincas[0]?.tasaBcv || state.tasaBcv || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${!esPagadoFlag ? ' (BCV Actual)' : ''}</small>
                </td>
                <td style="text-align: right;"><span style="color: ${adelantoBsVal > 0 ? '#ef4444' : '#94a3b8'}; font-weight: 800;">${adelantoBsVal > 0 ? `- Bs. ${adelantoBsVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '-'}${adelantoBsVal > 0 ? adelantoDetalleStr : ''}</span></td>
                <td style="text-align: right;">${netoDisplay}</td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: center;">${switchPago}</td>
                <td style="text-align: center; white-space: nowrap;">
                    ${btnDetalle}
                    ${btnRecibo}
                </td>
            </tr>
        `;
    }).join('');

    renderPaginacionControles('Liquidacion', inicio + 1, fin, total, paginaActualLiquidacion, totalPaginas);
}
window.renderTablaLiquidacionConsolidadaPropietario = renderTablaLiquidacionConsolidadaPropietario;

async function togglePagoLiquidacionConsolidada(propietarioNombre, fincaIds, isChecked) {
    if (!state.token) {
        showToast('Debes iniciar sesión para procesar pagos.', 'warning');
        return;
    }

    const fincas = (preLiquidacionDataCache || []).filter(x => fincaIds.map(Number).includes(Number(x.fincaId || x.FincaId)));
    const semPendSet = new Set();
    let totalNetoBsConsolidado = 0;
    let totalUSDConsolidado = 0;
    fincas.forEach(f => {
        const sp = f.semanasPendientes || f.SemanasPendientes || '';
        if (sp) sp.split(',').forEach(s => { const tr = s.trim(); if (tr) semPendSet.add(tr); });
        totalNetoBsConsolidado += (f.totalNetoBs || 0);
        totalUSDConsolidado += (f.totalUSD || 0);
    });
    const semPendStr = Array.from(semPendSet).join(', ');
    const tasaFmt = Number(state.tasaBcv || (fincas[0] ? fincas[0].tasaBcv : 0) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    const confirm = await Swal.fire({
        title: isChecked ? '¿Registrar Pago Consolidado?' : '¿Revertir Pago Consolidado?',
        html: isChecked
            ? `Se registrará el pago oficial unificado para <strong>${propietarioNombre}</strong> correspondiente a <strong>${fincaIds.length} finca(s)</strong>.${semPendStr ? `<br><div style="margin: 6px 0; color: #f59e0b; font-weight: 800; font-size: 13px;"><i class="fa-solid fa-calendar-xmark"></i> Semanas a pagar: ${semPendStr}</div>` : ''}<div style="margin-top: 6px; font-size: 13.5px;"><strong>Monto a Pagar:</strong> <span style="color: #10b981; font-weight: 900;">Bs. ${totalNetoBsConsolidado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> ($${totalUSDConsolidado.toFixed(2)} USD)<br><small style="color: #94a3b8; font-size: 11px;">@ Bs. ${tasaFmt} (Tasa BCV Actual)</small></div>`
            : `Se revertirán los pagos de <strong>${propietarioNombre}</strong> (${fincaIds.length} fincas).`,
        icon: isChecked ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: isChecked ? 'Sí, Registrar Pago Consolidado' : 'Sí, Revertir Pago',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: isChecked ? '#10b981' : '#f59e0b',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) {
        filtrarTablaLiquidacion(true);
        return;
    }

    try {
        let cicloIdParam = null;
        let cicloIdsParam = null;
        if (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
            cicloIdsParam = state.ciclosMultiLiquidacion.join(',');
        } else if (state.cicloSeleccionadoLiquidacion && state.cicloSeleccionadoLiquidacion !== 'ACTIVO') {
            cicloIdParam = Number(state.cicloSeleccionadoLiquidacion);
        } else {
            cicloIdParam = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;
        }

        let exitoCount = 0;

        for (const fId of fincaIds) {
            const res = await fetch(`${API_BASE}/catalogos/pre-liquidacion/pagar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    fincaId: Number(fId),
                    cicloId: cicloIdParam,
                    cicloIds: cicloIdsParam,
                    pagado: isChecked,
                    tasaBcv: state.tasaBcv || null
                })
            });
            if (res.ok) exitoCount++;
        }

        if (exitoCount > 0) {
            showToast(isChecked ? `¡Pago consolidado registrado para ${propietarioNombre}!` : `Pago consolidado revertido para ${propietarioNombre}.`);
            await cargarPreLiquidacion(true);
        } else {
            Swal.fire({ icon: 'error', title: 'Error al procesar pago consolidado', text: 'No se pudo procesar la acción para las fincas.', background: '#1e293b', color: '#fff' });
            filtrarTablaLiquidacion(true);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
        filtrarTablaLiquidacion(true);
    }
}
window.togglePagoLiquidacionConsolidada = togglePagoLiquidacionConsolidada;

function obtenerPeriodoSemanaTexto(fincaItem) {
    if (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
        return `Semanas Unificadas (${state.ciclosMultiLiquidacion.join(' + ')})`;
    }
    let semNum = '';
    if (state.cicloActivo) {
        semNum = state.cicloActivo.semanaNumero || state.cicloActivo.SemanaNumero || '';
    }
    let fIni = (fincaItem && fincaItem.fechaInicioCiclo) || (state.cicloActivo && (state.cicloActivo.fechaInicio || state.cicloActivo.FechaInicio)) || '';
    let fFin = (fincaItem && fincaItem.fechaFinCiclo) || (state.cicloActivo && (state.cicloActivo.fechaFin || state.cicloActivo.FechaFin)) || '';
    if (fIni.includes('T')) fIni = fIni.split('T')[0];
    if (fFin.includes('T')) fFin = fFin.split('T')[0];

    if (fIni && fFin) {
        const pIni = fIni.split('-');
        const pFin = fFin.split('-');
        const dIniStr = `${pIni[2]}/${pIni[1]}/${pIni[0]}`;
        const dFinStr = `${pFin[2]}/${pFin[1]}/${pFin[0]}`;
        return semNum ? `Semana ${semNum} (${dIniStr} al ${dFinStr})` : `Semana: Del ${dIniStr} al ${dFinStr}`;
    }
    return semNum ? `Semana ${semNum}` : 'Semana Operativa';
}

function copiarDetalleLiquidacionWhatsApp(texto) {
    if (!texto) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            if (typeof showToast === 'function') {
                showToast('¡Relación de leche copiada al portapapeles para WhatsApp!', 'success');
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Copiado!',
                    text: 'El detalle de compra se copió al portapapeles con formato para WhatsApp.',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#1e293b',
                    color: '#fff'
                });
            }
        }).catch(() => {
            prompt('Copia este texto para WhatsApp:', texto);
        });
    } else {
        prompt('Copia este texto para WhatsApp:', texto);
    }
}
window.copiarDetalleLiquidacionWhatsApp = copiarDetalleLiquidacionWhatsApp;

function verReciboPagoConsolidadoModal(propietarioNombre, fincaIds, tabActiva = 'voucher') {
    const fincas = (preLiquidacionDataCache || []).filter(x => fincaIds.map(Number).includes(Number(x.fincaId || x.FincaId)));

    if (!fincas || fincas.length === 0) {
        if (typeof showToast === 'function') showToast('No se encontró la información de las fincas', 'error');
        return;
    }

    const body = document.getElementById('bodyModalReciboPago');
    if (!body) return;

    const primerItem = fincas[0];
    const fPago = primerItem.fechaPago ? primerItem.fechaPago.split('T')[0] + ' ' + (primerItem.fechaPago.split('T')[1] || '').substring(0, 5) : new Date().toLocaleDateString('es-VE');
    const tasaBcv = primerItem.tasaBcv || state.tasaBcv || 853.4993;
    const semanaStr = obtenerPeriodoSemanaTexto(primerItem);

    const fmtBs = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUSD = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLts = (val) => Number(val || 0).toLocaleString('es-VE');

    const emp = window.empresaConfigData || {};
    const empNombre = emp.nombre || 'TRANSPORTE VERGEL & CARRILLO';
    const empRif = emp.rif || 'J-50000000-0';
    const empDir = emp.direccion || 'Sector El Cruce, Estado Zulia, Venezuela';
    const empLogoHtml = (emp.logoUrl && emp.logoUrl.trim().length > 10)
        ? `<img src="${emp.logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`
        : `<i class="fa-solid fa-truck-droplet" style="color: #38bdf8;"></i>`;

    const fincasIdsJson = JSON.stringify(fincaIds);
    const numRecibo = String(primerItem.pagoId || primerItem.PagoId || 1).padStart(6, '0');

    let totalLtsBuenos = 0, totalLtsAcidos = 0, totalUSDAcc = 0, totalBrutoBsAcc = 0, totalAdelantosBsAcc = 0, totalAdelantosUSDAcc = 0, otrasDeduccionesBsAcc = 0;
    let totalLtsVaca = 0, totalLtsBufala = 0;

    const filasFincasHtml = fincas.map((f, idx) => {
        const lBuenos = f.totalLitrosBuenos ?? (f.totalLitros - (f.totalLitrosAcidos || 0));
        const lAcidos = f.totalLitrosAcidos ?? 0;
        const lVaca = f.totalLitrosVaca ?? (f.tieneDosTiposLeche ? (f.totalLitrosBuenos || 0) : f.totalLitros);
        const lBufala = f.totalLitrosBufala ?? 0;
        const pUSD = f.totalUSD || 0;
        const bBs = f.totalBrutoBs || (pUSD * tasaBcv);
        const adBs = f.totalAdelantosBs || 0;
        const adUSD = f.totalAdelantosUSD || 0;
        const odBs = f.otrasDeduccionesBs || 0;
        const netoFincaBs = bBs - adBs - odBs;
        const remFincaUSD = Math.max(0, adUSD - pUSD);

        totalLtsBuenos += lBuenos;
        totalLtsAcidos += lAcidos;
        totalLtsVaca += lVaca;
        totalLtsBufala += lBufala;
        totalUSDAcc += pUSD;
        totalBrutoBsAcc += bBs;
        totalAdelantosBsAcc += adBs;
        totalAdelantosUSDAcc += adUSD;
        otrasDeduccionesBsAcc += odBs;

        const esDeudorFinca = (adUSD > pUSD + 0.01) || (netoFincaBs < -0.01);
        const netoStr = esDeudorFinca
            ? `<span style="color: #dc2626; font-weight: 900; font-size: 13.5px;">- Bs. ${fmtBs(Math.abs(netoFincaBs))}</span><br><small style="color: #ef4444; font-size: 10px; font-weight: 800;">(SALDO DEUDOR: -$${fmtUSD(remFincaUSD)} USD)</small>`
            : `<span style="color: #059669; font-weight: 900; font-size: 14px;">+ Bs. ${fmtBs(netoFincaBs)}</span><br><small style="color: #059669; font-size: 10px; font-weight: 700;">(+$${fmtUSD(pUSD)} USD)</small>`;

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${esDeudorFinca ? '#fff5f5' : rowBg};">
                <td style="padding: 12px 14px; color: #0f172a;">
                    <div style="font-weight: 800; font-size: 13.5px; color: #0f172a;">${f.fincaNombre || f.FincaNombre}</div>
                    <div style="color: #64748b; font-size: 11.5px; margin-top: 1px;"><i class="fa-solid fa-user" style="font-size: 10px; color: #94a3b8;"></i> ${f.propietario || propietarioNombre}</div>
                    ${f.semanasPendientes ? `<div style="color: #ea580c; font-size: 11px; font-weight: 800; margin-top: 2px;"><i class="fa-solid fa-calendar-xmark"></i> Semanas pendientes: ${f.semanasPendientes}</div>` : ''}
                </td>
                <td style="padding: 12px 14px; text-align: right;">
                    <span style="font-weight: 800; color: #0f172a; font-size: 13px;">${fmtLts(f.totalLitros)}</span>
                    <small style="color: #64748b; font-weight: 600;"> Lts</small>
                </td>
                <td style="padding: 12px 14px; text-align: right; color: #2563eb; font-weight: 800; font-size: 13px;">
                    $ ${fmtUSD(pUSD)}
                </td>
                <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #334155; font-size: 13px;">
                    Bs. ${fmtBs(bBs)}
                </td>
                <td style="padding: 12px 14px; text-align: right;">
                    ${adBs > 0 ? `<span style="color: #dc2626; font-weight: 800; font-size: 12.5px;">- Bs. ${fmtBs(adBs)}</span><br><small style="color: #e11d48; font-weight: 700; font-size: 10.5px;">(-$${fmtUSD(adUSD)} USD)</small>` : `<span style="color: #94a3b8;">-</span>`}
                    ${odBs > 0 ? `<br><small style="color: #d97706; font-weight: 700;">- Bs. ${fmtBs(odBs)} (Deduc.)</small>` : ''}
                </td>
                <td style="padding: 12px 14px; text-align: right;">
                    ${netoStr}
                </td>
            </tr>
        `;
    }).join('');

    const saldoNetoRealConsolidadoBs = totalBrutoBsAcc - totalAdelantosBsAcc - otrasDeduccionesBsAcc;
    const esDeudorConsolidado = (totalAdelantosUSDAcc > totalUSDAcc + 0.01) || (saldoNetoRealConsolidadoBs < -0.01);
    const deudaRestanteUSD = esDeudorConsolidado ? Math.round((totalAdelantosUSDAcc - totalUSDAcc) * 100) / 100 : 0;
    const deudaRestanteBs = esDeudorConsolidado ? Math.round((totalAdelantosBsAcc - totalBrutoBsAcc) * 100) / 100 : 0;
    const totalNetoPagarBs = Math.max(0, saldoNetoRealConsolidadoBs);

    body.innerHTML = `
        <!-- NAVEGACIÓN ENTRE COMPROBANTE Y DETALLE DIARIO DE COMPRA -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
            <button type="button" class="btn" onclick="verReciboPagoConsolidadoModal('${propietarioNombre.replace(/'/g, "\\'")}', ${fincasIdsJson}, 'voucher')" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: none; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; box-shadow: 0 4px 10px rgba(15,23,42,0.25);">
                <i class="fa-solid fa-file-invoice-dollar"></i> 1. Comprobante Oficial de Pago
            </button>
            <button type="button" class="btn" onclick="verDetalleCompraLecheConsolidadaModal('${propietarioNombre.replace(/'/g, "\\'")}', ${fincasIdsJson})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #475569;">
                <i class="fa-solid fa-list-check"></i> 2. Detalle Diario de Compra (Relación para Finca)
            </button>
        </div>

        <div id="areaImpresionReciboPago" style="background: #ffffff; padding: 28px; border-radius: 14px; border: 1.5px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative;">
            
            <!-- MEMBRETE OFICIAL DE LA EMPRESA -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 6px 16px rgba(15,23,42,0.3); border: 2px solid #334155; overflow: hidden; padding: 4px;">
                        ${empLogoHtml}
                    </div>
                    <div>
                        <h1 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; letter-spacing: -0.4px; text-transform: uppercase;">${empNombre}</h1>
                        <div style="font-size: 11.5px; color: #475569; font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 8px;">
                            <span><strong>RIF:</strong> ${empRif}</span>
                            <span>•</span>
                            <span>Transporte y Recolección de Leche</span>
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
                            ${empDir}
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="background: #0f172a; color: #ffffff; font-weight: 900; font-size: 13.5px; padding: 6px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; letter-spacing: 0.5px;">
                        <span style="color: #94a3b8; font-weight: 600; font-size: 11px;">RECIBO N°</span> ${numRecibo}
                    </div>
                    <div style="margin-top: 6px; font-size: 12px; color: #64748b; font-weight: 700; display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                        <span style="background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 5px; border: 1px solid #a7f3d0;">
                            <i class="fa-solid fa-calendar-check"></i> ${semanaStr}
                        </span>
                        <span style="background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 5px; border: 1px solid #bfdbfe;">
                            Tasa: Bs. ${fmtBs(tasaBcv)}
                        </span>
                    </div>
                </div>
            </div>

            <!-- TARJETA DEL PRODUCTOR / FINCAS -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">PRODUCTOR / BENEFICIARIO</div>
                        <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${propietarioNombre}</div>
                        <div style="font-size: 12px; color: #475569; margin-top: 3px; display: flex; gap: 14px; flex-wrap: wrap;">
                            <span><strong>Fincas:</strong> ${fincas.map(x => x.fincaNombre || x.FincaNombre).join(', ')}</span>
                            <span><strong>C.I. / RIF:</strong> <span style="font-family: monospace;">${primerItem.cedulaRIF || primerItem.CedulaRIF || 'N/A'}</span></span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: ${esDeudorConsolidado ? '#fef2f2' : '#ecfdf5'}; color: ${esDeudorConsolidado ? '#dc2626' : '#059669'}; border: 1px solid ${esDeudorConsolidado ? '#fecdd3' : '#a7f3d0'}; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid ${esDeudorConsolidado ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${esDeudorConsolidado ? 'Compensación de Adelanto (Saldo Deudor)' : 'Liquidación Conforme'}
                        </span>
                    </div>
                </div>
            </div>

            <!-- DESGLOSE POR FINCAS -->
            <div style="margin-bottom: 10px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-table-list" style="color: #2563eb;"></i> Desglose Detallado por Finca
                </span>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    ${fincas.length} Finca${fincas.length > 1 ? 's' : ''} unificada${fincas.length > 1 ? 's' : ''}
                </span>
            </div>

            <div style="border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                            <th style="padding: 11px 14px; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Finca / Productor</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Total Litros</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Monto ($)</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Bruto (Bs)</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Adelantos ($ / Bs)</th>
                            <th style="padding: 11px 14px; text-align: right; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase;">Neto Finca (Bs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasFincasHtml}
                    </tbody>
                </table>
            </div>

            <!-- RESUMEN FINAL CONSOLIDADO PREMIUM -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 20px 24px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px -5px rgba(15,23,42,0.3); border: 1.5px solid #334155; margin-bottom: 28px;">
                <div>
                    <div style="font-size: 11.5px; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-calculator" style="color: #38bdf8;"></i> RESUMEN CONSOLIDADO DEL PRODUCTOR (${fincas.length} FINCAS UNIFICADAS)
                    </div>
                    <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12.5px; color: #cbd5e1; flex-wrap: wrap;">
                        <span>Litros: <strong style="color: #ffffff;">${fmtLts(totalLtsBuenos + totalLtsAcidos)} L</strong></span>
                        <span>Total USD: <strong style="color: #38bdf8;">$ ${fmtUSD(totalUSDAcc)}</strong></span>
                        <span>Total Bruto: <strong style="color: #ffffff;">Bs. ${fmtBs(totalBrutoBsAcc)}</strong></span>
                        ${totalAdelantosBsAcc > 0 ? `<span>Adelantos: <strong style="color: #f87171;">-$${fmtUSD(totalAdelantosUSDAcc)} (-Bs. ${fmtBs(totalAdelantosBsAcc)})</strong></span>` : ''}
                    </div>
                    ${esDeudorConsolidado ? `
                        <div style="margin-top: 8px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: 6px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; color: #fca5a5; font-size: 12px; font-weight: 800;">
                            <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> SALDO DEUDOR REMANENTE: -$${fmtUSD(deudaRestanteUSD)} USD (-Bs. ${fmtBs(deudaRestanteBs)})
                        </div>
                    ` : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">MONTO NETO A TRANSFERIR:</div>
                    <div style="font-size: 26px; font-weight: 900; color: ${esDeudorConsolidado ? '#f87171' : '#34d399'}; letter-spacing: -0.5px; margin-top: 2px;">
                        ${esDeudorConsolidado ? 'Bs. 0,00' : 'Bs. ' + fmtBs(totalNetoPagarBs)}
                    </div>
                    ${esDeudorConsolidado ? `
                        <small style="color: #f87171; font-weight: 800; font-size: 11px; display: block; margin-top: 2px;">
                            (Sigue debiendo: -$${fmtUSD(deudaRestanteUSD)} USD)
                        </small>
                    ` : ''}
                </div>
            </div>

            <!-- FIRMAS Y VERIFICACIÓN OFICIAL -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 24px; border-top: 1.5px dashed #cbd5e1;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 30px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Firma del Productor / Beneficiario</div>
                    <div style="font-size: 11px; color: #64748b;">${propietarioNombre}</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 30px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Autorizado y Liquidado por Administración</div>
                    <div style="font-size: 11px; color: #64748b;">TRANSPORTE VERGEL & CARRILLO</div>
                </div>
            </div>

            <!-- SELLO DE VALIDACIÓN FOOTER -->
            <div style="margin-top: 22px; text-align: center; font-size: 10.5px; color: #94a3b8; font-weight: 600; letter-spacing: 0.4px;">
                <i class="fa-solid fa-shield-halved" style="color: #10b981;"></i> COMPROBANTE EMITIDO ELECTRÓNICAMENTE | TRANSPORTE VERGEL & CARRILLO
            </div>

        </div>
    `;

    abrirModalCustom('modalReciboPagoLiquidacion');
}
window.verReciboPagoConsolidadoModal = verReciboPagoConsolidadoModal;

async function verDetalleCompraLecheConsolidadaModal(propietarioNombre, fincaIds) {
    const fincas = (preLiquidacionDataCache || []).filter(x => fincaIds.map(Number).includes(Number(x.fincaId || x.FincaId)));
    if (!fincas || fincas.length === 0) {
        if (typeof showToast === 'function') showToast('No se encontró información de las fincas', 'error');
        return;
    }

    const body = document.getElementById('bodyModalReciboPago');
    if (!body) return;

    const primerItem = fincas[0];
    const tasaBcv = primerItem.tasaBcv || state.tasaBcv || 853.4993;
    const semanaStr = obtenerPeriodoSemanaTexto(primerItem);

    const fmtBs = (val) => Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtUSD = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtLts = (val) => Number(val || 0).toLocaleString('es-VE');

    // Render loading spinner
    body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: #059669; margin-bottom: 16px;"></i>
            <h4 style="color: #0f172a; margin: 0; font-size: 16px; font-weight: 800;">Cargando Detalle Diario de Compra...</h4>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Consultando recolecciones de leche de ${propietarioNombre}</p>
        </div>
    `;
    abrirModalCustom('modalReciboPagoLiquidacion');

    // Fetch daily report data
    let reportesData = [];
    try {
        const fIniParam = (primerItem.fechaInicioCiclo ? primerItem.fechaInicioCiclo.split('T')[0] : '') || (state.filtrosReporte && state.filtrosReporte.fechaInicio) || new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
        const fFinParam = (primerItem.fechaFinCiclo ? primerItem.fechaFinCiclo.split('T')[0] : '') || (state.filtrosReporte && state.filtrosReporte.fechaFin) || new Date().toISOString().split('T')[0];
        const res = await fetch(`${API_BASE}/reportes/fincas?fechaInicio=${fIniParam}&fechaFin=${fFinParam}&fincaIds=${fincaIds.join(',')}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            reportesData = await res.json();
        }
    } catch (e) {
        console.error('Error fetching detail:', e);
    }

    // Build daily rows across all fincas
    let todasLasFilas = [];
    let totLtsVaca = 0, totUSDVaca = 0, totBsVaca = 0;
    let totLtsBufala = 0, totUSDBufala = 0, totBsBufala = 0;
    let totLtsAcida = 0, totUSDAcida = 0, totBsAcida = 0;
    let totalLtsGral = 0, totalUSDGral = 0, totalBsGral = 0;

    (reportesData || []).forEach(rep => {
        const repFincaId = Number(rep.id || rep.fincaId || 0);
        const fincaLiq = fincas.find(f => Number(f.fincaId || f.FincaId) === repFincaId) || primerItem;
        const precioNormalFinca = Number(fincaLiq.precioLitroUSD || fincaLiq.PrecioLitroUSD || 0.84);
        const precioAcidaFinca = Number(fincaLiq.precioLitroAcidaUSD || fincaLiq.PrecioLitroAcidaUSD || (precioNormalFinca / 2));
        const precioBufalaFinca = Number(fincaLiq.precioLitroBufalaUSD || fincaLiq.PrecioLitroBufalaUSD || (precioNormalFinca * 1.25));

        (rep.detalle || rep.Detalle || []).forEach(d => {
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
            const fincaNom = d.entidadNombre || rep.nombre || fincaLiq.fincaNombre || fincaLiq.FincaNombre || 'Finca';

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

            todasLasFilas.push({
                fecha,
                fincaNom,
                litros,
                tipoLeche,
                esAcida,
                precioUSD,
                subUSD,
                subBs
            });
        });
    });

    // Sort rows chronologically
    todasLasFilas.sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

    // Calculate deductions
    let totalAdelantosBs = 0;
    let totalAdelantosUSD = 0;
    let totalDeduccionesBs = 0;
    let cuotasDetallesArr = [];
    let conceptosDeduccionesArr = [];

    fincas.forEach(f => {
        totalAdelantosBs += Number(f.totalAdelantosBs || 0);
        totalAdelantosUSD += Number(f.totalAdelantosUSD || 0);
        totalDeduccionesBs += Number(f.otrasDeduccionesBs || 0);
        if (f.cuotasDetalle) cuotasDetallesArr.push(fincas.length > 1 ? `${f.fincaNombre}: ${f.cuotasDetalle}` : f.cuotasDetalle);
        if (f.conceptoDeducciones) conceptosDeduccionesArr.push(fincas.length > 1 ? `${f.fincaNombre}: ${f.conceptoDeducciones}` : f.conceptoDeducciones);
    });

    const cuotasDetalleGlobal = cuotasDetallesArr.join(' | ');
    const conceptoDeduccionesGlobal = conceptosDeduccionesArr.join(' | ');

    const netoPagarBs = totalBsGral - totalAdelantosBs - totalDeduccionesBs;
    const netoPagarUSD = totalUSDGral - (tasaBcv > 0 ? (totalAdelantosBs + totalDeduccionesBs) / tasaBcv : 0);

    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const formatFechaDia = (fStr) => {
        if (!fStr) return '-';
        const parts = fStr.split('T')[0].split('-');
        if (parts.length < 3) return fStr;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return `${nombresDias[d.getDay()]} ${parts[2]}/${parts[1]}`;
    };

    const filasHtml = todasLasFilas.length > 0 ? todasLasFilas.map((r, i) => {
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
                ${fincas.length > 1 ? `
                    <td style="padding: 10px 14px; color: #0f172a; font-size: 12.5px; font-weight: 800;">
                        ${r.fincaNom}
                    </td>
                ` : ''}
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
            <td colspan="${fincas.length > 1 ? 7 : 6}" style="padding: 24px; text-align: center; color: #64748b; font-weight: 600;">
                No se registraron recolecciones diarias en el periodo seleccionado.
            </td>
        </tr>
    `;

    // Generate WhatsApp text
    let waTxt = `🥛 *DETALLE DE COMPRA DE LECHE* 🥛\n`;
    waTxt += `🏢 *TRANSPORTE VERGEL & CARRILLO*\n`;
    waTxt += `👤 *Productor:* ${propietarioNombre}\n`;
    waTxt += `📍 *Fincas:* ${fincas.map(x => x.fincaNombre || x.FincaNombre).join(', ')}\n`;
    waTxt += `📅 *${semanaStr}*\n`;
    waTxt += `💵 *Tasa BCV:* Bs. ${fmtBs(tasaBcv)} / $\n\n`;
    waTxt += `📋 *RECOLECCIÓN DIARIA:*\n`;

    todasLasFilas.forEach(r => {
        const tStr = r.esAcida ? 'Ácida' : (r.tipoLeche === 'BUFALA' ? 'Búfala' : 'Vaca');
        const fStr = fincas.length > 1 ? ` (${r.fincaNom})` : '';
        waTxt += `• ${formatFechaDia(r.fecha)}${fStr}: ${fmtLts(r.litros)} L [${tStr}] @ $${r.precioUSD.toFixed(4)} = $${fmtUSD(r.subUSD)} (Bs. ${fmtBs(r.subBs)})\n`;
    });

    waTxt += `\n📊 *RESUMEN DE LECHE:*`;
    if (totLtsVaca > 0) waTxt += `\n• 🥛 Leche Vaca: ${fmtLts(totLtsVaca)} L | $${fmtUSD(totUSDVaca)} | Bs. ${fmtBs(totBsVaca)}`;
    if (totLtsBufala > 0) waTxt += `\n• 🦬 Leche Búfala: ${fmtLts(totLtsBufala)} L | $${fmtUSD(totUSDBufala)} | Bs. ${fmtBs(totBsBufala)}`;
    if (totLtsAcida > 0) waTxt += `\n• ⚠️ Leche Ácida: ${fmtLts(totLtsAcida)} L | $${fmtUSD(totUSDAcida)} | Bs. ${fmtBs(totBsAcida)}`;
    waTxt += `\n• *Total Litros:* ${fmtLts(totalLtsGral)} L`;
    waTxt += `\n• *Total Bruto:* $${fmtUSD(totalUSDGral)} (Bs. ${fmtBs(totalBsGral)})\n`;

    if (totalAdelantosBs > 0 || totalDeduccionesBs > 0) {
        waTxt += `\n💳 *DEDUCCIONES / ADELANTOS:*`;
        if (totalAdelantosBs > 0) waTxt += `\n• (-) Adelantos/Préstamos: - Bs. ${fmtBs(totalAdelantosBs)}${cuotasDetalleGlobal ? ` (${cuotasDetalleGlobal})` : ''}`;
        if (totalDeduccionesBs > 0) waTxt += `\n• (-) Otras Deducciones: - Bs. ${fmtBs(totalDeduccionesBs)}${conceptoDeduccionesGlobal ? ` (${conceptoDeduccionesGlobal})` : ''}`;
    }

    waTxt += `\n-----------------------------------`;
    waTxt += `\n💰 *TOTAL NETO A PAGAR: Bs. ${fmtBs(netoPagarBs)} ($${fmtUSD(netoPagarUSD)} USD)*\n`;
    waTxt += `✅ *Estado:* LIQUIDACIÓN CONFORME`;

    const fincasIdsJson = JSON.stringify(fincaIds);
    const waTxtEscaped = encodeURIComponent(waTxt);

    const emp = window.empresaConfigData || {};
    const empNombre = emp.nombre || 'TRANSPORTE VERGEL & CARRILLO';
    const empRif = emp.rif || 'J-50000000-0';
    const empDir = emp.direccion || 'Sector El Cruce, Estado Zulia, Venezuela';
    const empLogoHtml = (emp.logoUrl && emp.logoUrl.trim().length > 10)
        ? `<img src="${emp.logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`
        : `<i class="fa-solid fa-truck-droplet" style="color: #38bdf8;"></i>`;

    body.innerHTML = `
        <!-- NAVEGACIÓN ENTRE COMPROBANTE Y DETALLE DIARIO DE COMPRA -->
        <div style="display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
            <button type="button" class="btn" onclick="verReciboPagoConsolidadoModal('${propietarioNombre.replace(/'/g, "\\'")}', ${fincasIdsJson}, 'voucher')" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #475569;">
                <i class="fa-solid fa-file-invoice-dollar"></i> 1. Comprobante Oficial de Pago
            </button>
            <button type="button" class="btn" onclick="verDetalleCompraLecheConsolidadaModal('${propietarioNombre.replace(/'/g, "\\'")}', ${fincasIdsJson})" style="padding: 9px 18px; font-size: 13px; font-weight: 800; border-radius: 8px; cursor: pointer; border: none; background: linear-gradient(135deg, #065f46, #059669); color: #ffffff; box-shadow: 0 4px 10px rgba(5,150,105,0.25);">
                <i class="fa-solid fa-list-check"></i> 2. Detalle Diario de Compra (Relación para Finca)
            </button>
        </div>

        <div id="areaImpresionReciboPago" style="background: #ffffff; padding: 26px; border-radius: 14px; border: 1.5px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            
            <!-- MEMBRETE OFICIAL DE LA EMPRESA -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 6px 16px rgba(15,23,42,0.3); border: 2px solid #334155; overflow: hidden; padding: 4px;">
                        ${empLogoHtml}
                    </div>
                    <div>
                        <h1 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; letter-spacing: -0.4px; text-transform: uppercase;">${empNombre}</h1>
                        <div style="font-size: 11.5px; color: #475569; font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 8px;">
                            <span><strong>RIF:</strong> ${empRif}</span>
                            <span>•</span>
                            <span>Transporte y Recolección de Leche</span>
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
                            ${empDir}
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="background: #065f46; color: #ffffff; font-weight: 900; font-size: 13.5px; padding: 6px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-clipboard-check" style="color: #a7f3d0;"></i> RELACIÓN DE COMPRA DE LECHE
                    </div>
                    <div style="margin-top: 6px; display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                        <span style="background: #ecfdf5; color: #047857; font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; border: 1px solid #a7f3d0;">
                            <i class="fa-solid fa-calendar-week"></i> ${semanaStr}
                        </span>
                        <span style="background: #eff6ff; color: #2563eb; font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; border: 1px solid #bfdbfe;">
                            <i class="fa-solid fa-dollar-sign"></i> Tasa BCV: Bs. ${fmtBs(tasaBcv)}
                        </span>
                    </div>
                </div>
            </div>

            <!-- CARD PRODUCTOR Y FINCA (SIN INFORMACIÓN DE BANCO) -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">DATOS DEL PRODUCTOR Y FINCA</div>
                    <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 2px;">
                        ${fincas.length === 1 ? (fincas[0].fincaNombre || fincas[0].FincaNombre) : propietarioNombre}
                    </div>
                    <div style="font-size: 12.5px; color: #475569; margin-top: 4px; display: flex; gap: 14px; flex-wrap: wrap;">
                        ${fincas.length > 1 ? `<span><strong>Fincas:</strong> ${fincas.map(x => x.fincaNombre || x.FincaNombre).join(', ')}</span>` : `<span><strong>Productor:</strong> ${propietarioNombre}</span>`}
                        <span><strong>C.I. / RIF:</strong> <span style="font-family: monospace;">${primerItem.cedulaRIF || primerItem.CedulaRIF || 'N/A'}</span></span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <button type="button" class="btn" onclick="copiarDetalleLiquidacionWhatsApp(decodeURIComponent('${waTxtEscaped}'))" style="background: #10b981; color: #ffffff; font-weight: 800; font-size: 13px; padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                        <i class="fa-brands fa-whatsapp" style="font-size: 17px;"></i> Copiar para WhatsApp
                    </button>
                </div>
            </div>

            <!-- TABLA DE RECOLECCIÓN DIARIA -->
            <div style="margin-bottom: 10px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-calendar-day" style="color: #059669;"></i> Registro Diario de Recolección
                </span>
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">
                    ${todasLasFilas.length} Días / Registros
                </span>
            </div>

            <div style="border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); padding: 12px; background: #ffffff;">
                <table id="tablaDetalleRecoleccionDiaria" class="display responsive nowrap dataTable" style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
                            <th style="padding: 10px 14px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Día / Fecha</th>
                            ${fincas.length > 1 ? `<th style="padding: 10px 14px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Finca</th>` : ''}
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

            <!-- DESGLOSE FINANCIERO Y ADELANTOS (MUY CLARO Y DESTACADO) -->
            <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
                <div style="background: #0f172a; color: #ffffff; padding: 12px 20px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-calculator" style="color: #38bdf8;"></i> Liquidación y Estado de Cuenta Semanal</span>
                    <span style="color: #94a3b8; font-size: 11px;">Tasa de Conversión: Bs. ${fmtBs(tasaBcv)} / $</span>
                </div>
                
                <div style="padding: 18px 22px;">
                    <!-- FILA BRUTO -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                        <div>
                            <span style="font-size: 14px; font-weight: 800; color: #0f172a;">(+) TOTAL VALOR BRUTO DE LECHE:</span>
                            <div style="font-size: 11.5px; color: #64748b; margin-top: 1px;">${fmtLts(totalLtsGral)} Litros Totales recolectados en la semana</div>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 15px; font-weight: 800; color: #2563eb;">$ ${fmtUSD(totalUSDGral)} USD</span>
                            <span style="font-size: 16px; font-weight: 900; color: #0f172a; margin-left: 10px;">Bs. ${fmtBs(totalBsGral)}</span>
                        </div>
                    </div>

                    <!-- FILA ADELANTOS / PRÉSTAMOS -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; background: ${totalAdelantosBs > 0 ? '#fff5f5' : 'transparent'}; border-radius: 6px; margin: 4px 0; padding-left: ${totalAdelantosBs > 0 ? '10px' : '0'}; padding-right: ${totalAdelantosBs > 0 ? '10px' : '0'};">
                        <div>
                            <span style="font-size: 14px; font-weight: 800; color: ${totalAdelantosBs > 0 ? '#dc2626' : '#64748b'};">
                                <i class="fa-solid fa-hand-holding-dollar"></i> (-) ADELANTOS / PRÉSTAMOS DE LA SEMANA:
                            </span>
                            ${cuotasDetalleGlobal ? `<div style="font-size: 11.5px; color: #b91c1c; font-weight: 700; margin-top: 2px;"><i class="fa-solid fa-circle-info"></i> ${cuotasDetalleGlobal}</div>` : (totalAdelantosBs === 0 ? '<div style="font-size: 11.5px; color: #94a3b8;">Sin cuotas de adelanto cobradas</div>' : '')}
                        </div>
                        <div style="text-align: right;">
                            ${totalAdelantosUSD > 0 ? `<span style="font-size: 14.5px; font-weight: 800; color: #dc2626;">- $ ${fmtUSD(totalAdelantosUSD)} USD</span>` : ''}
                            <span style="font-size: 16px; font-weight: 900; color: ${totalAdelantosBs > 0 ? '#dc2626' : '#94a3b8'}; margin-left: 10px;">
                                ${totalAdelantosBs > 0 ? `- Bs. ${fmtBs(totalAdelantosBs)}` : 'Bs. 0,00'}
                            </span>
                        </div>
                    </div>

                    <!-- FILA OTRAS DEDUCCIONES -->
                    ${totalDeduccionesBs > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; background: #fffbeb; border-radius: 6px; margin: 4px 0;">
                            <div>
                                <span style="font-size: 13.5px; font-weight: 800; color: #b45309;">
                                    <i class="fa-solid fa-receipt"></i> (-) OTRAS DEDUCCIONES:
                                </span>
                                ${conceptoDeduccionesGlobal ? `<div style="font-size: 11.5px; color: #92400e; font-weight: 600; margin-top: 1px;">${conceptoDeduccionesGlobal}</div>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 16px; font-weight: 900; color: #b45309;">- Bs. ${fmtBs(totalDeduccionesBs)}</span>
                            </div>
                        </div>
                    ` : ''}

                    <!-- FILA TOTAL NETO FINAL -->
                    <div style="margin-top: 14px; background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #ffffff; padding: 18px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 20px -4px rgba(6,78,59,0.35);">
                        <div>
                            <div style="font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.8px;">MONTO NETO A PAGAR / TRANSFERIR:</div>
                            <div style="font-size: 13px; color: #d1fae5; margin-top: 2px;">Liquidación ${fincas.length > 1 ? 'consolidada' : 'semanal'} conforme</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                                Bs. ${fmtBs(netoPagarBs)}
                            </div>
                            <div style="font-size: 13.5px; font-weight: 800; color: #a7f3d0; margin-top: 2px;">
                                ($ ${fmtUSD(netoPagarUSD)} USD)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- FIRMAS Y VERIFICACIÓN -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 20px; border-top: 1.5px dashed #cbd5e1;">
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">Recibido Conforme Productor</div>
                    <div style="font-size: 11px; color: #64748b;">${propietarioNombre}</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-bottom: 1.5px solid #475569; width: 75%; margin: 26px auto 8px auto;"></div>
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a;">TRANSPORTE VERGEL & CARRILLO</div>
                    <div style="font-size: 11px; color: #64748b;">Administración y Liquidaciones</div>
                </div>
            </div>

            <!-- SELLO DE VALIDACIÓN FOOTER -->
            <div style="margin-top: 22px; text-align: center; font-size: 10.5px; color: #94a3b8; font-weight: 600; letter-spacing: 0.4px;">
                <i class="fa-solid fa-shield-halved" style="color: #10b981;"></i> COMPROBANTE EMITIDO ELECTRÓNICAMENTE | TRANSPORTE VERGEL & CARRILLO
            </div>

        </div>
    `;

    // Inicializar DataTable con búsqueda, paginación y ordenamiento dinámico
    setTimeout(() => {
        try {
            if (window.$ && $.fn && $.fn.DataTable) {
                if ($.fn.DataTable.isDataTable('#tablaDetalleRecoleccionDiaria')) {
                    $('#tablaDetalleRecoleccionDiaria').DataTable().destroy();
                }
                $('#tablaDetalleRecoleccionDiaria').DataTable({
                    language: {
                        search: "🔍 Filtrar:",
                        searchPlaceholder: "Día, fecha, tipo...",
                        lengthMenu: "_MENU_ filas",
                        info: "Registros: _START_ al _END_ de _TOTAL_",
                        infoEmpty: "Sin datos",
                        infoFiltered: "(de _MAX_ totales)",
                        zeroRecords: "No hay datos que coincidan",
                        paginate: {
                            first: "«",
                            previous: "‹",
                            next: "›",
                            last: "»"
                        }
                    },
                    pageLength: 10,
                    lengthMenu: [[7, 10, 15, 30, -1], [7, 10, 15, 30, "Todos"]],
                    order: [],
                    responsive: true,
                    autoWidth: false
                });
            }
        } catch (e) {
            console.warn('DataTable init warning:', e);
        }
    }, 120);
}
window.verDetalleCompraLecheConsolidadaModal = verDetalleCompraLecheConsolidadaModal;

async function verDetalleCompraLecheFincaModal(fincaId) {
    const fIdNum = Number(fincaId);
    const finca = (preLiquidacionDataCache || []).find(x => Number(x.fincaId || x.FincaId) === fIdNum);
    const propNombre = finca ? (finca.propietario || finca.Propietario || finca.fincaNombre || finca.FincaNombre) : 'Finca';
    await verDetalleCompraLecheConsolidadaModal(propNombre, [fIdNum]);
}
window.verDetalleCompraLecheFincaModal = verDetalleCompraLecheFincaModal;

async function verReciboPagoLiquidacionModal(fincaIdOrPagoId) {
    const fIdNum = Number(fincaIdOrPagoId);
    const finca = (preLiquidacionDataCache || []).find(x => Number(x.fincaId || x.FincaId) === fIdNum || Number(x.pagoId || x.PagoId) === fIdNum);
    const propNombre = finca ? (finca.propietario || finca.Propietario || finca.fincaNombre || finca.FincaNombre) : 'Productor';
    const targetFincaId = finca ? Number(finca.fincaId || finca.FincaId) : fIdNum;
    verReciboPagoConsolidadoModal(propNombre, [targetFincaId]);
}
window.verReciboPagoLiquidacionModal = verReciboPagoLiquidacionModal;

function copiarDetalleLiquidacionWhatsApp(texto) {
    if (!texto) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            if (typeof showToast === 'function') {
                showToast('¡Detalle de compra copiado al portapapeles para WhatsApp!', 'success');
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Copiado para WhatsApp!',
                    text: 'El detalle de compra ha sido copiado a tu portapapeles.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        }).catch(() => {
            copiarTextoFallbackWhatsApp(texto);
        });
    } else {
        copiarTextoFallbackWhatsApp(texto);
    }
}

function copiarTextoFallbackWhatsApp(texto) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
        if (typeof showToast === 'function') {
            showToast('¡Detalle de compra copiado al portapapeles para WhatsApp!', 'success');
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: '¡Copiado para WhatsApp!',
                text: 'El detalle de compra ha sido copiado a tu portapapeles.',
                timer: 2000,
                showConfirmButton: false
            });
        }
    } catch (err) {
        console.error('Error al copiar texto:', err);
    }
    document.body.removeChild(textarea);
}
window.copiarDetalleLiquidacionWhatsApp = copiarDetalleLiquidacionWhatsApp;

function imprimirReciboPagoPDF() {
    const area = document.getElementById('areaImpresionReciboPago');
    if (!area) {
        if (typeof showToast === 'function') showToast('No hay contenido disponible para imprimir', 'error');
        return;
    }
    const ventanaImpresion = window.open('', '_blank', 'width=900,height=800');
    if (!ventanaImpresion) {
        window.print();
        return;
    }
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Comprobante de Pago y Detalle de Leche</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #ffffff;
                    color: #0f172a;
                    margin: 0;
                    padding: 24px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @media print {
                    body { padding: 0; }
                    @page { margin: 1cm; size: auto; }
                }
            </style>
        </head>
        <body>
            ${area.outerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 600);
                };
            <\/script>
        </body>
        </html>
    `);
    ventanaImpresion.document.close();
}
window.imprimirReciboPagoPDF = imprimirReciboPagoPDF;


async function togglePagoLiquidacion(fincaId, isChecked) {
    if (!state.token) {
        showToast('Debes iniciar sesión para procesar pagos.', 'warning');
        return;
    }

    const finca = (preLiquidacionDataCache || []).find(x => Number(x.fincaId || x.FincaId) === Number(fincaId));
    const fincaNombre = finca ? (finca.fincaNombre || finca.FincaNombre) : 'Finca';
    const semPend = finca ? (finca.semanasPendientes || finca.SemanasPendientes || '') : '';
    const netoBsFmt = finca ? Number(finca.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
    const usdFmt = finca ? Number(finca.totalUSD || 0).toFixed(2) : '0.00';
    const tasaFmt = finca ? Number(finca.tasaBcv || state.tasaBcv || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0,00';

    const confirm = await Swal.fire({
        title: isChecked ? '¿Registrar Pago?' : '¿Revertir Pago?',
        html: isChecked
            ? `Se registrará el pago oficial de <strong>${fincaNombre}</strong>.${semPend ? `<br><div style="margin: 6px 0; color: #f59e0b; font-weight: 800; font-size: 13px;"><i class="fa-solid fa-calendar-xmark"></i> Semanas a pagar: ${semPend}</div>` : ''}<div style="margin-top: 6px; font-size: 13.5px;"><strong>Monto a Pagar:</strong> <span style="color: #10b981; font-weight: 900;">Bs. ${netoBsFmt}</span> ($${usdFmt} USD)<br><small style="color: #94a3b8; font-size: 11px;">@ Bs. ${tasaFmt} (Tasa BCV Actual)</small></div>`
            : `Se revertirá el pago de <strong>${fincaNombre}</strong> y la cuota de adelanto volverá a estar pendiente.`,
        icon: isChecked ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: isChecked ? 'Sí, Registrar Pago' : 'Sí, Revertir Pago',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: isChecked ? '#10b981' : '#f59e0b',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) {
        if (typeof ejecutarBusquedaReporte === 'function' && datosReporteActual && datosReporteActual.tipo) {
            await ejecutarBusquedaReporte();
        }
        filtrarTablaLiquidacion(true);
        return;
    }

    try {
        let cicloIdParam = null;
        let cicloIdsParam = null;
        if (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
            cicloIdsParam = state.ciclosMultiLiquidacion.join(',');
        } else if (state.cicloSeleccionadoLiquidacion && state.cicloSeleccionadoLiquidacion !== 'ACTIVO') {
            cicloIdParam = Number(state.cicloSeleccionadoLiquidacion);
        } else {
            cicloIdParam = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;
        }

        const res = await fetch(`${API_BASE}/catalogos/pre-liquidacion/pagar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fincaId: Number(fincaId),
                cicloId: cicloIdParam,
                cicloIds: cicloIdsParam,
                pagado: isChecked,
                tasaBcv: state.tasaBcv || null
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(isChecked ? `¡Pago registrado para ${fincaNombre}!` : `Pago revertido para ${fincaNombre}.`);
            await cargarPreLiquidacion(true);
            if (typeof ejecutarBusquedaReporte === 'function' && datosReporteActual && datosReporteActual.tipo) {
                await ejecutarBusquedaReporte();
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error al procesar pago', text: data.mensaje || data.message || 'No se pudo procesar la acción.', background: '#1e293b', color: '#fff' });
            if (typeof ejecutarBusquedaReporte === 'function' && datosReporteActual && datosReporteActual.tipo) {
                await ejecutarBusquedaReporte();
            }
            filtrarTablaLiquidacion(true);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: err.message, background: '#1e293b', color: '#fff' });
        if (typeof ejecutarBusquedaReporte === 'function' && datosReporteActual && datosReporteActual.tipo) {
            await ejecutarBusquedaReporte();
        }
        filtrarTablaLiquidacion(true);
    }
}
window.togglePagoLiquidacion = togglePagoLiquidacion;

async function togglePagoLiquidacionDesdeReporte(fincaId, isChecked) {
    await togglePagoLiquidacion(fincaId, isChecked);
    if (typeof ejecutarBusquedaReporte === 'function') {
        await ejecutarBusquedaReporte();
    }
}
window.togglePagoLiquidacionDesdeReporte = togglePagoLiquidacionDesdeReporte;

async function cargarSemanasLiquidacionSelect() {
    try {
        const select = document.getElementById('selectCicloLiquidacion');
        if (!select) return;

        if (!state.semanas || state.semanas.length === 0) {
            const res = await fetch(`${API_BASE}/ciclos/semanas`, {
                headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
            });
            if (res.ok) {
                state.semanas = await res.json();
            }
        }

        if (!state.cicloActivo) {
            const resAct = await fetch(`${API_BASE}/ciclos/activo`, {
                headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
            });
            if (resAct.ok) {
                state.cicloActivo = await resAct.json();
            }
        }

        const selVal = state.cicloSeleccionadoLiquidacion || 'ACTIVO';
        const cicloActivoId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : null;

        const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => {
            const numA = a.semanaNumero || a.SemanaNumero || a.id || a.Id || 0;
            const numB = b.semanaNumero || b.SemanaNumero || b.id || b.Id || 0;
            return numB - numA;
        });

        let html = '<option value="ACTIVO">🟢 Semana Operativa Activa</option>';
        if (state.cicloSeleccionadoLiquidacion === 'MULTI' && state.ciclosMultiLiquidacion && state.ciclosMultiLiquidacion.length > 0) {
            html += `<option value="MULTI">🗂️ Semanas Unificadas (${state.ciclosMultiLiquidacion.length} semanas)</option>`;
        } else {
            html += '<option value="MULTI">🗂️ Unificar Semanas (Múltiples)...</option>';
        }

        semanasOrdenadas.forEach(s => {
            const sId = s.id || s.Id;
            const sNum = s.semanaNumero || s.SemanaNumero || sId;
            const fIni = (s.fechaInicio || s.FechaInicio || '').split('T')[0];
            const fFin = (s.fechaFin || s.FechaFin || '').split('T')[0];
            const esActivo = cicloActivoId && String(sId) === String(cicloActivoId);
            const esCerrado = (s.estado || s.Estado) === 'CERRADO';
            html += `<option value="${sId}">Semana ${sNum} (${fIni} al ${fFin})${esActivo ? ' [ACTIVA]' : (esCerrado ? ' [CERRADA]' : '')}</option>`;
        });

        select.innerHTML = html;
        select.value = selVal;
    } catch (e) {
        console.warn('Error al poblar selector de semanas en liquidación:', e);
    }
}
window.cargarSemanasLiquidacionSelect = cargarSemanasLiquidacionSelect;

async function onCambiarCicloLiquidacion(val) {
    if (val === 'MULTI') {
        abrirModalMultiSemanaLiquidacion();
        return;
    }

    state.cicloSeleccionadoLiquidacion = val;
    state.ciclosMultiLiquidacion = [];
    preLiquidacionDataCache = null;
    await cargarPreLiquidacion(false);
}
window.onCambiarCicloLiquidacion = onCambiarCicloLiquidacion;

function abrirModalMultiSemanaLiquidacion() {
    const contenedor = document.getElementById('contenedorCheckboxesSemanasLiq');
    if (!contenedor) return;

    const semanasOrdenadas = [...(state.semanas || [])].sort((a, b) => {
        const numA = a.semanaNumero || a.SemanaNumero || a.id || a.Id || 0;
        const numB = b.semanaNumero || b.SemanaNumero || b.id || b.Id || 0;
        return numB - numA;
    });

    const seleccionadasActuales = (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0)
        ? state.ciclosMultiLiquidacion.map(Number)
        : [];

    const cicloActivoId = state.cicloActivo ? Number(state.cicloActivo.id || state.cicloActivo.Id) : null;

    let html = '';
    semanasOrdenadas.forEach(s => {
        const sId = Number(s.id || s.Id);
        const sNum = s.semanaNumero || s.SemanaNumero || sId;
        const fIni = (s.fechaInicio || s.FechaInicio || '').split('T')[0];
        const fFin = (s.fechaFin || s.FechaFin || '').split('T')[0];
        const esActivo = cicloActivoId && sId === cicloActivoId;
        const esCerrado = (s.estado || s.Estado) === 'CERRADO';
        
        let isChecked = false;
        if (seleccionadasActuales.length > 0) {
            isChecked = seleccionadasActuales.includes(sId);
        } else if (esActivo) {
            isChecked = true;
        }

        html += `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; border: 1.5px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}; background: ${isChecked ? '#eff6ff' : '#ffffff'}; cursor: pointer; transition: all 0.15s; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" class="chk-semana-unificar" value="${sId}" data-sem="${sNum}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;" onchange="this.closest('label').style.background = this.checked ? '#eff6ff' : '#ffffff'; this.closest('label').style.borderColor = this.checked ? '#3b82f6' : '#e2e8f0'; actualizarResumenModalSemanas();">
                <div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a;">Semana ${sNum}</div>
                    <div style="font-size: 11px; color: #64748b;">${fIni} al ${fFin}</div>
                </div>
            </div>
            <div>
                ${esActivo ? '<span style="font-size: 10px; font-weight: 800; color: #16a34a; background: #dcfce7; padding: 2px 7px; border-radius: 6px; border: 1px solid #bbf7d0;">ACTIVA</span>' : ''}
                ${esCerrado ? '<span style="font-size: 10px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 7px; border-radius: 6px; border: 1px solid #e2e8f0;">CERRADA</span>' : ''}
            </div>
        </label>
        `;
    });

    contenedor.innerHTML = html;
    actualizarResumenModalSemanas();
    abrirModalCustom('modalUnificarSemanasLiquidacion');
}
window.abrirModalMultiSemanaLiquidacion = abrirModalMultiSemanaLiquidacion;

function seleccionarShortcutSemanas(tipo) {
    const checks = document.querySelectorAll('#contenedorCheckboxesSemanasLiq .chk-semana-unificar');
    if (!checks || checks.length === 0) return;

    if (tipo === 'LIMPIAR') {
        checks.forEach(c => c.checked = false);
    } else if (tipo === 'TODAS') {
        checks.forEach(c => c.checked = true);
    } else if (tipo === 'ACTIVA_ANTERIOR') {
        checks.forEach((c, idx) => {
            c.checked = (idx === 0 || idx === 1);
        });
    } else if (tipo === 'ULTIMAS_3') {
        checks.forEach((c, idx) => {
            c.checked = (idx < 3);
        });
    }

    checks.forEach(c => {
        const lbl = c.closest('label');
        if (lbl) {
            lbl.style.background = c.checked ? '#eff6ff' : '#ffffff';
            lbl.style.borderColor = c.checked ? '#3b82f6' : '#e2e8f0';
        }
    });

    actualizarResumenModalSemanas();
}
window.seleccionarShortcutSemanas = seleccionarShortcutSemanas;

function actualizarResumenModalSemanas() {
    const lbl = document.getElementById('lblResumenSemanasSeleccionadas');
    if (!lbl) return;

    const checks = document.querySelectorAll('#contenedorCheckboxesSemanasLiq .chk-semana-unificar:checked');
    const count = checks.length;

    if (count === 0) {
        lbl.innerText = '0 semanas seleccionadas';
        lbl.style.color = '#ef4444';
    } else if (count === 1) {
        const sNum = checks[0].getAttribute('data-sem') || checks[0].value;
        lbl.innerText = `1 semana seleccionada (Sem. ${sNum})`;
        lbl.style.color = '#f59e0b';
    } else {
        const sNums = Array.from(checks).map(c => `Sem. ${c.getAttribute('data-sem') || c.value}`).join(', ');
        lbl.innerText = `${count} semanas unificadas (${sNums})`;
        lbl.style.color = '#0284c7';
    }
}
window.actualizarResumenModalSemanas = actualizarResumenModalSemanas;

async function aplicarUnificacionSemanasLiquidacion() {
    const checks = document.querySelectorAll('#contenedorCheckboxesSemanasLiq .chk-semana-unificar:checked');
    if (!checks || checks.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Debes seleccionar al menos una semana operativa.',
            background: '#1e293b',
            color: '#ffffff'
        });
        return;
    }

    const selectedIds = Array.from(checks).map(c => Number(c.value));
    
    if (selectedIds.length === 1) {
        state.cicloSeleccionadoLiquidacion = selectedIds[0];
        state.ciclosMultiLiquidacion = [];
    } else {
        state.cicloSeleccionadoLiquidacion = 'MULTI';
        state.ciclosMultiLiquidacion = selectedIds;
    }

    cerrarModalCustom('modalUnificarSemanasLiquidacion');
    preLiquidacionDataCache = null;
    await cargarSemanasLiquidacionSelect();
    await cargarPreLiquidacion(false);
}
window.aplicarUnificacionSemanasLiquidacion = aplicarUnificacionSemanasLiquidacion;

async function cargarPreLiquidacion(mantenerPagina = false) {
    try {
        const tbody = document.getElementById('tbodyLiquidacion');
        if (!tbody) return;

        // Cargar opciones del selector de ciclo
        cargarSemanasLiquidacionSelect().catch(console.warn);

        const labelCiclo = document.getElementById('labelCicloLiquidacionTexto');
        const spanFechas = document.getElementById('spanRangoFechasLiquidacion');

        let url = `${API_BASE}/catalogos/pre-liquidacion?_t=${Date.now()}`;

        if (state.cicloSeleccionadoLiquidacion === 'MULTI' && Array.isArray(state.ciclosMultiLiquidacion) && state.ciclosMultiLiquidacion.length > 0) {
            url += `&cicloIds=${state.ciclosMultiLiquidacion.join(',')}`;
            const txtMulti = `Semanas Unificadas (${state.ciclosMultiLiquidacion.map(c => `Sem ${c}`).join(', ')})`;
            if (labelCiclo) labelCiclo.innerText = `Ciclos Unificados: ${txtMulti}`;
            if (spanFechas) spanFechas.innerText = txtMulti;
        } else if (state.cicloSeleccionadoLiquidacion && state.cicloSeleccionadoLiquidacion !== 'ACTIVO') {
            const cicloId = Number(state.cicloSeleccionadoLiquidacion);
            url += `&cicloId=${cicloId}`;
            const sObj = (state.semanas || []).find(s => (s.id || s.Id) === cicloId);
            const semNum = sObj ? (sObj.semanaNumero || sObj.SemanaNumero || cicloId) : cicloId;
            const fIni = sObj ? (sObj.fechaInicio || sObj.FechaInicio || '').split('T')[0] : '';
            const fFin = sObj ? (sObj.fechaFin || sObj.FechaFin || '').split('T')[0] : '';
            const txtCiclo = `Semana ${semNum} (${fIni} al ${fFin})`;
            if (labelCiclo) labelCiclo.innerText = `Ciclo: ${txtCiclo}`;
            if (spanFechas) spanFechas.innerText = txtCiclo;
        } else {
            if (!state.cicloActivo) {
                try { await cargarCicloActivo(); } catch (e) { }
            }
            const cicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : '';
            if (cicloId) url += `&cicloId=${cicloId}`;
            if (state.cicloActivo) {
                const semNum = state.cicloActivo.semanaNumero || state.cicloActivo.SemanaNumero || state.cicloActivo.id || state.cicloActivo.Id;
                const fIni = state.cicloActivo.fechaInicio || state.cicloActivo.FechaInicio;
                const fFin = state.cicloActivo.fechaFin || state.cicloActivo.FechaFin;
                const fIniStr = fIni ? fIni.split('T')[0] : '';
                const fFinStr = fFin ? fFin.split('T')[0] : '';
                const txtCiclo = `Semana ${semNum} (${fIniStr} al ${fFinStr})`;
                if (labelCiclo) labelCiclo.innerText = `Ciclo Activo: ${txtCiclo}`;
                if (spanFechas) spanFechas.innerText = txtCiclo;
            } else {
                if (labelCiclo) labelCiclo.innerText = 'Ciclo Activo: Semana Activa';
                if (spanFechas) spanFechas.innerText = 'Semana Activa';
            }
        }

        // Render instantáneo desde caché si ya existe data en memoria para respuesta de 0ms
        if (preLiquidacionDataCache && preLiquidacionDataCache.length > 0) {
            filtrarTablaLiquidacion(mantenerPagina);
        } else {
            tbody.innerHTML = '<tr><td colspan="13" class="text-center" style="padding: 28px; background: rgba(255,255,255,0.02);"><div style="display: inline-flex; align-items: center; gap: 10px; color: #2563eb; font-weight: 800; font-size: 13.5px;"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i> Cargando pre-liquidación...</div></td></tr>';
        }

        const res = await fetch(url, {
            cache: 'no-store',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            if (res.status === 401) {
                tbody.innerHTML = '<tr><td colspan="13" class="text-center" style="padding: 24px; color: #f87171;"><i class="fa-solid fa-lock" style="margin-right: 6px;"></i> Su sesión ha expirado o no es válida. <button class="btn btn-sm btn-primary" onclick="cerrarSesion()" style="margin-left: 10px; cursor: pointer;"><i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar Sesión</button></td></tr>';
                return;
            }
            tbody.innerHTML = '<tr><td colspan="13" class="text-center" style="padding: 24px; color: #f87171;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> No se pudo consultar la pre-liquidación. <button class="btn btn-sm btn-outline-secondary" onclick="cargarPreLiquidacion(false)" style="margin-left: 10px; cursor: pointer;"><i class="fa-solid fa-rotate"></i> Reintentar</button></td></tr>';
            return;
        }

        const items = await res.json();
        preLiquidacionDataCache = items || [];

        // Guardar valores actuales de filtros antes de cualquier refresco
        const filtroPagoEl = document.getElementById('selectFiltroPagadoLiquidacion');
        const filtroBancoEl = document.getElementById('selectFiltroBancoLiquidacion');
        const inputBuscarEl = document.getElementById('inputBuscarLiquidacionFinca');

        const valFiltroPago = filtroPagoEl ? filtroPagoEl.value : null;
        const valFiltroBanco = filtroBancoEl ? filtroBancoEl.value : null;
        const valBuscar = inputBuscarEl ? inputBuscarEl.value : null;

        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="text-center" style="padding: 20px; color: #9ca3af;">No hay recolecciones en el ciclo para liquidar.</td></tr>';
            actualizarContadorFincasPagadas([]);
            actualizarResumenFinanciero([]);
        } else {
            // Poblar filtro de bancos preservando la selección actual
            poblarFiltroBancosLiquidacion(preLiquidacionDataCache);

            // Asegurar que los filtros retengan exactamente su valor seleccionado
            if (filtroPagoEl && valFiltroPago) filtroPagoEl.value = valFiltroPago;
            if (filtroBancoEl && valFiltroBanco && Array.from(filtroBancoEl.options).some(o => o.value === valFiltroBanco)) {
                filtroBancoEl.value = valFiltroBanco;
            }
            if (inputBuscarEl && valBuscar !== null) inputBuscarEl.value = valBuscar;

            // Siempre respetar los filtros activos (búsqueda, estado pagado/pendiente, banco y modo)
            filtrarTablaLiquidacion(mantenerPagina);
        }

        // Cargar historial en segundo plano de forma no bloqueante
        cargarHistorialPagosLiquidacion().catch(console.warn);
    } catch (err) {
        console.warn('Error al cargar pre-liquidación:', err);
    }
}
window.cargarPreLiquidacion = cargarPreLiquidacion;

async function cargarHistorialPagosLiquidacion(cicloIdParam = null) {
    try {
        const tbody = document.getElementById('tbodyHistorialPagos');
        if (!tbody) return;

        const selectCiclos = document.getElementById('filtroCicloHistorialPagos');

        // Asegurar que las semanas operativas estén cargadas en state
        if (!state.semanas || state.semanas.length === 0) {
            try {
                const resSemanas = await fetch(`${API_BASE}/ciclos/semanas`, {
                    headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
                });
                if (resSemanas.ok) {
                    state.semanas = await resSemanas.json();
                }
            } catch (e) {
                console.warn('Error cargando semanas para historial:', e);
            }
        }

        // Asegurar ciclo activo
        if (!state.cicloActivo) {
            try {
                const resAct = await fetch(`${API_BASE}/ciclos/activo`, {
                    headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : {}
                });
                if (resAct.ok) {
                    state.cicloActivo = await resAct.json();
                }
            } catch (e) {}
        }

        const cicloActivoId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : '';

        // Poblar selector de ciclos si está vacío o solo tiene 1 opción
        if (selectCiclos && selectCiclos.options.length <= 1 && state.semanas && state.semanas.length > 0) {
            const semanasOrdenadas = [...state.semanas].sort((a, b) => (b.id || b.Id || 0) - (a.id || a.Id || 0));
            
            let htmlOptions = '<option value="">TODOS LOS CICLOS (HISTÓRICO ACUMULADO)</option>';
            semanasOrdenadas.forEach(s => {
                const sId = s.id || s.Id;
                let codigo = s.codigo || s.Codigo || s.nombre || s.Nombre || `Ciclo #${sId}`;
                const fIni = (s.fechaInicio || s.FechaInicio || '').split('T')[0];
                const fFin = (s.fechaFin || s.FechaFin || '').split('T')[0];
                if (!codigo.includes('(') && fIni && fFin) {
                    codigo += ` (${fIni} al ${fFin})`;
                }
                const esActivo = (cicloActivoId && String(sId) === String(cicloActivoId));
                htmlOptions += `<option value="${sId}" ${esActivo ? 'selected' : ''}>${codigo}${esActivo ? ' (ACTUAL)' : ''}</option>`;
            });
            selectCiclos.innerHTML = htmlOptions;

            if (cicloActivoId && !selectCiclos.value) {
                selectCiclos.value = cicloActivoId;
            }
        }

        // Si no se especificó parámetro y es la primera carga, priorizar el ciclo activo
        let cicloFiltro = cicloIdParam !== null ? cicloIdParam : (selectCiclos ? selectCiclos.value : '');
        if (cicloIdParam === null && (!cicloFiltro || cicloFiltro === '') && cicloActivoId && selectCiclos) {
            selectCiclos.value = cicloActivoId;
            cicloFiltro = cicloActivoId;
        }

        let url = `${API_BASE}/catalogos/liquidacion/historial`;
        if (cicloFiltro) url += `?cicloId=${encodeURIComponent(cicloFiltro)}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center" style="padding: 20px; color: #f87171;">Error al cargar el historial de pagos.</td></tr>';
            return;
        }

        const items = await res.json();
        historialPagosCache = items || [];
        filtrarTablaHistorialPagos();
    } catch (err) {
        console.warn('Error al cargar historial de pagos:', err);
    }
}
window.cargarHistorialPagosLiquidacion = cargarHistorialPagosLiquidacion;

function cambiarCicloHistorialPagos(cicloId) {
    cargarHistorialPagosLiquidacion(cicloId);
}
window.cambiarCicloHistorialPagos = cambiarCicloHistorialPagos;

function renderHistorialPagosLiquidacion(items) {
    const tbody = document.getElementById('tbodyHistorialPagos');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center" style="padding: 20px; color: #9ca3af;">No hay pagos registrados en el historial para los filtros seleccionados.</td></tr>';
        renderPaginacionControles('Historial', 0, 0, 0);
        return;
    }

    const total = items.length;
    const itemsPerPage = itemsPorPaginaHistorial;
    const totalPaginas = Math.ceil(total / itemsPerPage);
    if (paginaActualHistorial > totalPaginas) paginaActualHistorial = Math.max(1, totalPaginas);

    const inicio = (paginaActualHistorial - 1) * itemsPerPage;
    const fin = Math.min(inicio + itemsPerPage, total);
    const paginados = items.slice(inicio, fin);

    tbody.innerHTML = paginados.map(p => {
        const fPagoStr = p.fechaPago ? p.fechaPago.split('T')[0] + ' ' + (p.fechaPago.split('T')[1] || '').substring(0, 5) : '-';
        const esAnulado = p.estadoPago === 'ANULADO';
        const badgeEst = esAnulado
            ? '<span class="badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecdd3; font-size: 11px; padding: 3px 6px; font-weight: 700;">ANULADO</span>'
            : '<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 11px; padding: 3px 6px; font-weight: 800;"><i class="fa-solid fa-check-double"></i> PAGADO</span>';

        const btnImprimir = !esAnulado
            ? `<button type="button" class="btn btn-outline" onclick="verReciboPagoLiquidacionModal(${p.id})" title="Ver / Imprimir Recibo" style="padding: 4px 8px; font-size: 11.5px; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px;"><i class="fa-solid fa-receipt"></i> Recibo</button>`
            : '<span style="color: #94a3b8; font-size: 11px;">-</span>';

        const fincaNom = capitalizarTexto(p.fincaNombre || 'S/N');
        const propNom = capitalizarTexto(p.propietario || '');

        return `
            <tr style="${esAnulado ? 'opacity: 0.6; background-color: #f8fafc;' : ''}">
                <td><span style="font-weight: 600; color: #334155;">${fPagoStr}</span></td>
                <td><strong style="color: #2563eb; font-size: 12px;">${p.cicloNombre}</strong></td>
                <td><strong>${fincaNom}</strong><br><small style="color: #64748b;">${propNom} ${p.cedulaRIF ? '(' + p.cedulaRIF + ')' : ''}</small></td>
                <td style="text-align: right;"><strong>${p.totalLitros.toLocaleString()} Lts</strong><br><small style="color: #047857;">${p.totalLitrosBuenos} B</small> / <small style="color: #b45309;">${p.totalLitrosAcidos} Á</small></td>
                <td style="text-align: right; font-weight: 700; color: #2563eb;">$${p.totalUSD.toFixed(2)}</td>
                <td style="text-align: right; font-size: 11.5px; color: #475569;">Bs. ${p.tasaBcv.toLocaleString('es-VE', { minimumFractionDigits: 4 })}</td>
                <td style="text-align: right; font-weight: 600;">Bs. ${p.totalBrutoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right; color: ${p.totalAdelantosBs > 0 ? '#ef4444' : '#94a3b8'}; font-weight: 700;">${p.totalAdelantosBs > 0 ? '- Bs. ' + p.totalAdelantosBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}</td>
                <td style="text-align: right; color: ${p.otrasDeduccionesBs > 0 ? '#d97706' : '#94a3b8'}; font-weight: 700;">${p.otrasDeduccionesBs > 0 ? '- Bs. ' + p.otrasDeduccionesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}</td>
                <td style="text-align: right;"><strong style="color: #047857; font-size: 14px;">Bs. ${p.totalNetoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></td>
                <td style="text-align: center;">${badgeEst}</td>
                <td style="text-align: center;">${btnImprimir}</td>
            </tr>
        `;
    }).join('');

    renderPaginacionControles('Historial', inicio + 1, fin, total, paginaActualHistorial, totalPaginas);
}

function actualizarKpisHistorialPagos(items) {
    const list = items || [];
    const activos = list.filter(p => p.estadoPago !== 'ANULADO');

    // Fincas únicas
    const fincasSet = new Set();
    activos.forEach(p => {
        const fKey = p.fincaId || p.FincaId || (p.fincaNombre || '').trim().toUpperCase();
        if (fKey) fincasSet.add(fKey);
    });

    let totalLitros = 0;
    let totalBuenos = 0;
    let totalAcidos = 0;
    let totalUSD = 0;
    let totalBrutoBs = 0;
    let totalAdelantosBs = 0;
    let totalOtrasDeducBs = 0;
    let totalNetoBs = 0;

    activos.forEach(p => {
        totalLitros += Number(p.totalLitros || p.TotalLitros || 0);
        totalBuenos += Number(p.totalLitrosBuenos || p.TotalLitrosBuenos || 0);
        totalAcidos += Number(p.totalLitrosAcidos || p.TotalLitrosAcidos || 0);
        totalUSD += Number(p.totalUSD || p.TotalUSD || 0);
        totalBrutoBs += Number(p.totalBrutoBs || p.TotalBrutoBs || 0);
        totalAdelantosBs += Number(p.totalAdelantosBs || p.TotalAdelantosBs || 0);
        totalOtrasDeducBs += Number(p.otrasDeduccionesBs || p.OtrasDeduccionesBs || 0);
        totalNetoBs += Number(p.totalNetoBs || p.TotalNetoBs || 0);
    });

    const cantFincasEl = document.getElementById('kpiHistorialCantFincas');
    const cantPagosEl = document.getElementById('kpiHistorialCantPagos');
    const totalLitrosEl = document.getElementById('kpiHistorialTotalLitros');
    const desgloseLitrosEl = document.getElementById('kpiHistorialDesgloseLitros');
    const totalUSDEl = document.getElementById('kpiHistorialTotalUSD');
    const totalNetoBsEl = document.getElementById('kpiHistorialTotalNetoBs');
    const deducEl = document.getElementById('kpiHistorialDeducciones');
    const filtroTextoEl = document.getElementById('kpiHistorialFiltroTexto');

    if (cantFincasEl) cantFincasEl.innerText = fincasSet.size.toLocaleString();
    if (cantPagosEl) cantPagosEl.innerText = `${activos.length} pago${activos.length !== 1 ? 's' : ''} procesado${activos.length !== 1 ? 's' : ''}`;
    if (totalLitrosEl) totalLitrosEl.innerText = `${totalLitros.toLocaleString()} L`;
    if (desgloseLitrosEl) desgloseLitrosEl.innerText = `${totalBuenos.toLocaleString()} B / ${totalAcidos.toLocaleString()} Á`;
    if (totalUSDEl) totalUSDEl.innerText = totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (totalNetoBsEl) totalNetoBsEl.innerText = totalNetoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (deducEl) {
        const totalDeduc = totalAdelantosBs + totalOtrasDeducBs;
        deducEl.innerText = totalDeduc > 0 ? `- Bs. ${totalDeduc.toLocaleString('es-VE', { minimumFractionDigits: 2 })} adelantos` : 'Neto Transferido';
    }

    if (filtroTextoEl) {
        const q = (document.getElementById('inputBuscarHistorialPagos')?.value || '').trim();
        const selCiclo = document.getElementById('filtroCicloHistorialPagos');
        const cicloVal = selCiclo ? selCiclo.value : '';
        const cicloTexto = (selCiclo && cicloVal && selCiclo.selectedIndex >= 0) ? selCiclo.options[selCiclo.selectedIndex].text : '';

        if (cicloTexto && q) {
            filtroTextoEl.innerText = `${cicloTexto} | Filtro: "${q}"`;
        } else if (cicloTexto) {
            filtroTextoEl.innerText = `${cicloTexto}`;
        } else if (q) {
            filtroTextoEl.innerText = `Histórico General | Filtro: "${q}"`;
        } else {
            filtroTextoEl.innerText = `Histórico Acumulado (Todas las Semanas)`;
        }
    }
}
window.actualizarKpisHistorialPagos = actualizarKpisHistorialPagos;

function filtrarTablaHistorialPagos() {
    const q = (document.getElementById('inputBuscarHistorialPagos')?.value || '').toLowerCase().trim();
    paginaActualHistorial = 1;
    if (!q) {
        historialPagosFiltradosCache = [];
        actualizarKpisHistorialPagos(historialPagosCache);
        renderHistorialPagosLiquidacion(historialPagosCache);
        return;
    }

    historialPagosFiltradosCache = (historialPagosCache || []).filter(item => {
        const finca = (item.fincaNombre || '').toLowerCase();
        const prop = (item.propietario || '').toLowerCase();
        const ciclo = (item.cicloNombre || '').toLowerCase();
        return finca.includes(q) || prop.includes(q) || ciclo.includes(q);
    });

    actualizarKpisHistorialPagos(historialPagosFiltradosCache);
    renderHistorialPagosLiquidacion(historialPagosFiltradosCache);
}
window.filtrarTablaHistorialPagos = filtrarTablaHistorialPagos;
