// =========================================================================
// MÓDULO CONTROL COMPAÑÍAS (SALIDAS A QUESERAS) Y CONTROL RUTAS (ENTRADAS)
// =========================================================================

// 1. CARGAR DESPACHO ACTIVO DEL CHOFER (TB_CONTROL_COMPANIAS: EN VIA)
async function cargarDespachoActivoChofer() {
    const banner = document.getElementById('bannerDespachoCompaniaActivoChofer');
    if (!banner || !state.token) return;

    try {
        const res = await fetch(`${API_BASE}/control-companias/chofer-activo`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok || res.status === 204) {
            banner.style.display = 'none';
            return;
        }

        const text = await res.text();
        if (!text || !text.trim()) {
            banner.style.display = 'none';
            return;
        }

        const despacho = JSON.parse(text);
        if (!despacho || !despacho.id) {
            banner.style.display = 'none';
            return;
        }

        // Mostrar banner de despacho asignado
        banner.style.display = 'block';
        banner.innerHTML = `
            <div style="background: linear-gradient(135deg, #1e1b4b, #31104b); border: 1.5px solid #a855f7; border-radius: 14px; padding: 18px 22px; box-shadow: 0 8px 25px rgba(147, 51, 234, 0.25); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 50px; height: 50px; border-radius: 14px; background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                        <i class="fa-solid fa-truck-arrow-right"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                            <span style="font-size: 11px; font-weight: 800; background: #9333ea; color: #fff; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
                                DESPACHO A COMPAÑÍA #${despacho.id}
                            </span>
                            <span class="badge" style="background: rgba(192, 132, 252, 0.2); color: #e9d5ff; font-weight: 700; border: 1px solid rgba(192, 132, 252, 0.4);">
                                <i class="fa-solid fa-route"></i> EN VÍA
                            </span>
                        </div>
                        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff;">
                            Destino: ${despacho.nombreCompania || 'Quesera / Planta'} &bull; ${(despacho.litrosDespachados || 0).toLocaleString('es-VE')} Lts Despachados
                        </h3>
                        <p style="margin: 3px 0 0 0; font-size: 12.5px; color: #d8b4fe;">
                            Conductor: <strong>${despacho.nombreConductor || despacho.conductorNombre || despacho.nombreUsuario || (state.choferes || []).find(u => (u.id || u.Id) == (despacho.usuarioId || despacho.UsuarioId))?.nombreCompleto || 'Chofer'}</strong> &bull; Fecha: <strong>${formatearFechaTicket(despacho.fecha)}</strong>
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn" onclick="abrirModalValidarEntregaDespacho(${despacho.id})" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 800; height: 42px; padding: 0 20px; border: none; border-radius: 9px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-clipboard-check"></i> Validar Entrega en Quesera
                    </button>
                </div>
            </div>
        `;
    } catch (e) {
        console.warn('No hay despacho activo para el chofer o error menor:', e);
        banner.style.display = 'none';
    }
}
window.cargarDespachoActivoChofer = cargarDespachoActivoChofer;

// 2. MODAL PARA VALIDAR ENTREGA EN COMPAÑÍA (MULTI-DESTINO / DESGLOSE BÚFALA Y VACA / MERMA)
async function abrirModalValidarEntregaDespacho(despachoId) {
    let despacho = null;
    try {
        const res = await fetch(`${API_BASE}/control-companias/${despachoId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok && res.status !== 204) {
            const text = await res.text();
            if (text && text.trim()) despacho = JSON.parse(text);
        }
    } catch (e) {}

    if (!despacho) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener la información del despacho.', background: '#ffffff', color: '#0f172a' });
        return;
    }

    const despachados = Number(despacho.litrosDespachados || 0);
    const nombreCompania = despacho.nombreCompania || 'Quesera / Planta';
    const choferNombre = despacho.nombreConductor || despacho.conductorNombre || despacho.nombreUsuario || (state.choferes || []).find(u => (u.id || u.Id) == (despacho.usuarioId || despacho.UsuarioId))?.nombreCompleto || 'Chofer';
    const tipoDespachoRaw = (despacho.tipoLeche || despacho.TipoLeche || ((despacho.observacion || '').toUpperCase().includes('BUFAL') ? 'BUFALO' : 'VACA')).toUpperCase();
    const tipoDespacho = tipoDespachoRaw.includes('BUFAL') ? 'BUFALA' : 'VACA';
    const esDespachoAcido = (despacho.tipoLeche || '').toUpperCase().includes('ACID') || (despacho.observacion || '').toUpperCase().includes('ACID');

    const companiasOpciones = (state.companias || []).filter(c => {
        const nombre = (c.nombre || c.Nombre || '').toUpperCase();
        return !nombre.includes('RECEPTORIA') && !nombre.includes('RECEPTORÍA');
    });

    const { value: formValues } = await Swal.fire({
        title: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 20px; font-weight: 800; color: #1e1b4b;"><i class="fa-solid fa-clipboard-check" style="color: #10b981;"></i> Validar Entrega en Queseras / Destinos</div>`,
        customClass: {
            popup: 'swal2-modal-overflow-visible'
        },
        width: 820,
        html: `
            <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                <!-- BANNER DE INFORMACIÓN DEL TICKET -->
                <div style="background: linear-gradient(135deg, #faf5ff, #f3e8ff); border: 1.5px solid #d8b4fe; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span><strong>Ticket de Salida:</strong> #${despacho.id}</span>
                        <span><strong>Fecha:</strong> ${formatearFechaTicket(despacho.fecha)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span><strong>Conductor:</strong> <strong style="color: #6b21a8;">${choferNombre}</strong></span>
                        <span><strong>Destino Inicial:</strong> <strong>${nombreCompania}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span><strong>Tipo Despachado:</strong> <span class="badge" style="background: ${tipoDespacho === 'BUFALA' ? '#ecfdf5; color: #065f46; border: 1px solid #a7f3d0' : '#eff6ff; color: #1e40af; border: 1px solid #bfdbfe'}; font-weight: 800; padding: 2px 8px; border-radius: 6px;">${tipoDespacho === 'BUFALA' ? '🐃 BÚFALA' : '🐄 VACA'}</span>${esDespachoAcido ? ' <span class="badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-left: 4px;">⚠️ ÁCIDA</span>' : ''}</span>
                        <span><strong>Ticket Estado:</strong> <span class="badge" style="background: #faf5ff; color: #9333ea; border: 1px solid #d8b4fe; font-weight: 700; padding: 2px 8px; border-radius: 6px;">EN VÍA</span></span>
                    </div>
                    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #d8b4fe; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: #7e22ce;">Litros Despachados:</span>
                        <strong style="font-size: 17px; color: #9333ea;">${despachados.toLocaleString('es-VE')} Lts</strong>
                    </div>
                </div>

                <!-- CONTENEDOR DE DESGLOSES POR DESTINO Y TIPO DE LECHE -->
                <div style="margin-bottom: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px; overflow: visible;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                        <div style="font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-building-wheat" style="color: #7c3aed;"></i> Desglose por Destino, Tipo de Leche y Condición *
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" id="btnAgregarFilaValidacion" style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: #ffffff; font-weight: 700; font-size: 11.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px; box-shadow: 0 2px 5px rgba(16, 185, 129, 0.3);">
                                <i class="fa-solid fa-circle-plus"></i> + Añadir Otra Compañía / Tipo
                            </button>
                        </div>
                    </div>

                    <div id="contenedorFilasValidacion" style="display: flex; flex-direction: column; gap: 12px; overflow: visible;">
                        <!-- Las filas con combobox buscable se insertan dinámicamente -->
                    </div>

                    <!-- INDICADOR EN VIVO DE TOTAL Y MERMA -->
                    <div id="boxFallaLiveDespacho" style="margin-top: 14px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px 14px; font-size: 13px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: #166534;" id="lblFallaLiveTitulo">
                                Total Recibido: <strong id="lblTotalRecibidoLive" style="font-size: 15px; color: #0f172a;">${despachados.toLocaleString('es-VE')} Lts</strong>
                            </span>
                            <strong style="font-size: 15px; color: #16a34a;" id="lblFallaLiveValor">Diferencia: 0 Lts (0.00%)</strong>
                        </div>
                        <div style="font-size: 12px; color: #15803d; margin-top: 4px; font-weight: 600;" id="lblFallaLiveMsg">
                            <i class="fa-solid fa-circle-check"></i> Entrega 100% exacta sin variación.
                        </div>
                    </div>
                </div>

                <!-- OBSERVACIÓN GENERAL -->
                <div style="margin-bottom: 4px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                        OBSERVACIÓN GENERAL / TICKET DE PESAJE QUESERA
                    </label>
                    <input id="swalObsEntregaCompania" type="text" class="form-input" placeholder="Ej: Ticket de pesaje #1042..." value="${despacho.observacion || ''}" style="width: 100%; height: 38px; border-radius: 8px; font-size: 13px;">
                </div>
            </div>
        `,
        didOpen: (popup) => {
            const content = popup.querySelector('.swal2-html-container');
            if (content) content.style.overflow = 'visible';

            const contenedor = document.getElementById('contenedorFilasValidacion');
            const boxFalla = document.getElementById('boxFallaLiveDespacho');
            const lblTotalRec = document.getElementById('lblTotalRecibidoLive');
            const lblValor = document.getElementById('lblFallaLiveValor');
            const lblMsg = document.getElementById('lblFallaLiveMsg');

            let rowCounter = 0;

            const actualizarFallaLive = () => {
                let totalRec = 0;
                const rows = contenedor.querySelectorAll('.fila-validacion-item');
                rows.forEach(r => {
                    const inp = r.querySelector('.input-litros-val-row');
                    const val = parseInt(inp?.value) || 0;
                    totalRec += val;
                });

                if (lblTotalRec) lblTotalRec.textContent = `${totalRec.toLocaleString('es-VE')} Lts`;

                const dif = despachados - totalRec; // Falla positiva = faltante
                const pct = despachados > 0 ? ((dif / despachados) * 100).toFixed(2) : '0.00';

                if (dif === 0) {
                    boxFalla.style.background = '#f0fdf4';
                    boxFalla.style.borderColor = '#86efac';
                    lblValor.style.color = '#16a34a';
                    lblValor.innerText = 'Diferencia: 0 Lts (0.00%)';
                    lblMsg.style.color = '#15803d';
                    lblMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Entrega 100% exacta sin variación.';
                } else if (dif > 0) {
                    boxFalla.style.background = '#fff7ed';
                    boxFalla.style.borderColor = '#fed7aa';
                    lblValor.style.color = '#ea580c';
                    lblValor.innerText = `Falla: -${dif.toLocaleString('es-VE')} Lts (${pct}%)`;
                    lblMsg.style.color = '#9a3412';
                    lblMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Faltante en quesera: <strong>${dif.toLocaleString('es-VE')} Lts menos</strong> que al salir.`;
                } else {
                    boxFalla.style.background = '#eff6ff';
                    boxFalla.style.borderColor = '#bfdbfe';
                    lblValor.style.color = '#2563eb';
                    lblValor.innerText = `Sobrante: +${Math.abs(dif).toLocaleString('es-VE')} Lts (${pct}%)`;
                    lblMsg.style.color = '#1e40af';
                    lblMsg.innerHTML = `<i class="fa-solid fa-circle-info"></i> La quesera reporta <strong>${Math.abs(dif).toLocaleString('es-VE')} Lts más</strong> que al salir.`;
                }
            };

            const agregarFila = (defaultCompId = null, defaultTipo = tipoDespacho, defaultLitros = '', defaultEsAcida = false, defaultObs = '') => {
                rowCounter++;
                const rowId = `val_row_${rowCounter}`;
                const cbContainerId = `swalComboboxValComp_${rowCounter}`;
                const cbInputSearchId = `searchValCompInput_${rowCounter}`;
                const cbInputHiddenId = `swalValCompVal_${rowCounter}`;
                const cbDropdownId = `dropdownValCompList_${rowCounter}`;

                const div = document.createElement('div');
                div.className = 'fila-validacion-item';
                div.id = rowId;
                div.style.cssText = 'display: grid; grid-template-columns: 1.3fr 1fr 0.85fr 0.95fr auto; gap: 8px; align-items: center; background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.02); position: relative; overflow: visible;';

                div.innerHTML = `
                    <div style="position: relative; overflow: visible;">
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            QUESERA / DESTINO *
                        </label>
                        <div class="searchable-select" id="${cbContainerId}" style="position: relative;">
                            <input type="hidden" class="input-compania-val-row" id="${cbInputHiddenId}">
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="${cbInputSearchId}" placeholder="Buscar quesera..." autocomplete="off" style="border-radius: 7px; height: 38px; font-size: 13px; font-weight: 600;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="${cbDropdownId}" style="display: none; max-height: 160px; z-index: 99999;"></div>
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            TIPO DE LECHE
                        </label>
                        <select class="form-input select-tipo-leche-val-row" style="width: 100%; height: 38px; border-radius: 7px; font-size: 12px; font-weight: 700; color: #334155; padding: 0 6px;">
                            <option value="VACA" ${defaultTipo === 'VACA' ? 'selected' : ''}>🐄 Leche VACA</option>
                            <option value="BUFALA" ${defaultTipo === 'BUFALA' || defaultTipo === 'BUFALO' ? 'selected' : ''}>🐃 Leche BÚFALA</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            ¿ES ÁCIDA?
                        </label>
                        <select class="form-input select-es-acida-val-row" style="width: 100%; height: 38px; border-radius: 7px; font-size: 12px; font-weight: 800; padding: 0 6px; ${defaultEsAcida ? 'background: #fef2f2; border-color: #ef4444; color: #b91c1c;' : 'background: #ffffff; border-color: #cbd5e1; color: #334155;'}">
                            <option value="0" ${!defaultEsAcida ? 'selected' : ''}>🥛 Normal</option>
                            <option value="1" ${defaultEsAcida ? 'selected' : ''}>⚠️ Ácida</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            LITROS RECIBIDOS *
                        </label>
                        <input type="number" class="form-input input-litros-val-row" placeholder="Ej: 1596" value="${defaultLitros}" style="width: 100%; height: 38px; border-radius: 7px; font-size: 14px; font-weight: 800; color: #0f172a; text-align: right; padding-right: 10px;">
                    </div>

                    <div style="padding-top: 18px;">
                        <button type="button" class="btn-eliminar-fila-val" title="Eliminar destino" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; width: 36px; height: 38px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;

                contenedor.appendChild(div);

                const selectAcida = div.querySelector('.select-es-acida-val-row');
                if (selectAcida) {
                    selectAcida.addEventListener('change', (e) => {
                        if (e.target.value === '1') {
                            e.target.style.background = '#fef2f2';
                            e.target.style.borderColor = '#ef4444';
                            e.target.style.color = '#b91c1c';
                        } else {
                            e.target.style.background = '#ffffff';
                            e.target.style.borderColor = '#cbd5e1';
                            e.target.style.color = '#334155';
                        }
                    });
                }

                const cbInst = setupCombobox({
                    containerId: cbContainerId,
                    inputSearchId: cbInputSearchId,
                    inputHiddenId: cbInputHiddenId,
                    dropdownId: cbDropdownId,
                    placeholder: 'Buscar quesera...',
                    getItemsFn: () => {
                        return companiasOpciones.map(c => ({
                            value: c.id || c.Id,
                            label: (c.nombre || c.Nombre || '').toUpperCase()
                        }));
                    }
                });

                const compToSelect = defaultCompId || despacho.companiaId;
                if (compToSelect) {
                    const compObj = companiasOpciones.find(c => (c.id || c.Id) == compToSelect);
                    if (compObj) {
                        cbInst.selectItem(compToSelect, (compObj.nombre || compObj.Nombre || '').toUpperCase());
                    } else if (despacho.nombreCompania) {
                        cbInst.selectItem(compToSelect, despacho.nombreCompania.toUpperCase());
                    }
                }

                const inpLitros = div.querySelector('.input-litros-val-row');
                if (inpLitros) {
                    inpLitros.addEventListener('input', actualizarFallaLive);
                }

                const btnEliminar = div.querySelector('.btn-eliminar-fila-val');
                if (btnEliminar) {
                    btnEliminar.addEventListener('click', () => {
                        const totalActualRows = contenedor.querySelectorAll('.fila-validacion-item').length;
                        if (totalActualRows <= 1) {
                            Swal.showValidationMessage('Debe existir al menos una línea de entrega.');
                            setTimeout(() => Swal.resetValidationMessage(), 2500);
                            return;
                        }
                        div.remove();
                        actualizarFallaLive();
                    });
                }

                actualizarFallaLive();
            };

            // Inicializar con 1 fila por defecto con los litros despachados, compañía y tipo del ticket
            const esAcidaInicial = (despacho.observacion || '').toUpperCase().includes('ACID');
            agregarFila(despacho.companiaId, tipoDespacho, despachados > 0 ? despachados : '', esAcidaInicial);

            const btnAdd = document.getElementById('btnAgregarFilaValidacion');
            if (btnAdd) {
                btnAdd.addEventListener('click', () => {
                    agregarFila(despacho.companiaId, tipoDespacho === 'BUFALA' ? 'VACA' : 'BUFALA', '', false);
                });
            }
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check-double"></i> Confirmar y Finalizar Despacho',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
            const obsGeneral = document.getElementById('swalObsEntregaCompania')?.value || '';
            const rows = document.querySelectorAll('.fila-validacion-item');
            if (!rows || rows.length === 0) {
                Swal.showValidationMessage('Debes ingresar al menos una línea de entrega.');
                return false;
            }

            const desgloses = [];
            let totalRecibido = 0;

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const compInput = r.querySelector('.input-compania-val-row');
                const tipoSelect = r.querySelector('.select-tipo-leche-val-row');
                const acidaSelect = r.querySelector('.select-es-acida-val-row');
                const ltsInput = r.querySelector('.input-litros-val-row');

                const compId = parseInt(compInput?.value) || despacho.companiaId;
                const tipoBase = tipoSelect?.value || tipoDespacho;
                const esAcida = acidaSelect?.value === '1';
                const lts = parseInt(ltsInput?.value);

                if (!compId) {
                    Swal.showValidationMessage(`Fila #${i + 1}: Selecciona una quesera de destino.`);
                    return false;
                }
                if (isNaN(lts) || lts <= 0) {
                    Swal.showValidationMessage(`Fila #${i + 1}: Ingresa una cantidad válida de litros mayor a cero.`);
                    return false;
                }

                totalRecibido += lts;
                const tipoFinal = esAcida ? (tipoBase === 'BUFALA' ? 'BUFALA_ACIDA' : 'ACIDA') : tipoBase;
                const obsFila = esAcida ? `[LECHE ÁCIDA] ${obsGeneral}`.trim() : obsGeneral;

                desgloses.push({
                    companiaId: compId,
                    tipoLeche: tipoFinal,
                    litrosRecibidos: lts,
                    observacion: obsFila
                });
            }

            return {
                litrosRecibidosCompania: totalRecibido,
                tipoLeche: desgloses.length > 0 ? desgloses[0].tipoLeche : tipoDespacho,
                observacion: desgloses.length > 0 ? desgloses[0].observacion : obsGeneral,
                desgloses
            };
        }
    });

    if (!formValues) return;

    try {
        const res = await fetch(`${API_BASE}/control-companias/${despachoId}/validar-entrega`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify(formValues)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al validar entrega.' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const dif = despachados - formValues.litrosRecibidosCompania;
        const msgFalla = dif === 0 ? 'Entrega 100% exacta' : (dif > 0 ? `Falla: -${dif.toLocaleString('es-VE')} Lts` : `Sobrante: +${Math.abs(dif).toLocaleString('es-VE')} Lts`);
        const cantDesg = formValues.desgloses ? formValues.desgloses.length : 1;

        showToast(
            '¡Entrega Validada y Finalizada!',
            'success',
            `Se registraron ${formValues.litrosRecibidosCompania.toLocaleString('es-VE')} Lts en ${cantDesg} ${cantDesg === 1 ? 'entrega' : 'desgloses/destinos'}. ${msgFalla}.`,
            2200
        );

        await refrescarVistasGlobales();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.abrirModalValidarEntregaDespacho = abrirModalValidarEntregaDespacho;

// 3. MODAL PARA QUE EL CHOFER EN RUTA ENVÍE A COMPAÑÍA (MÚLTIPLES COMPAÑÍAS DESTINO AUTO-CREA TICKETS CONTROL COMPAÑÍAS)
async function abrirModalEnviarACompaniaDesdeRuta(ticketRutaId, totalLitros, choferRutaId = null) {
    const totalRecogido = Number(totalLitros) || 0;

    const companiasOpciones = (state.companias || []).filter(c => {
        const nombre = (c.nombre || c.Nombre || '').toUpperCase();
        return !nombre.includes('RECEPTORIA') && !nombre.includes('RECEPTORÍA');
    });

    const { value: formValues } = await Swal.fire({
        title: '<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 20px; font-weight: 800; color: #1e1b4b;"><i class="fa-solid fa-truck-moving" style="color: #7c3aed;"></i> Despachar Leche de Ruta a Compañías</div>',
        customClass: {
            popup: 'swal2-modal-overflow-visible'
        },
        width: 760,
        html: `
            <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1.5px solid #ddd6fe; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 42px; height: 42px; border-radius: 10px; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);">
                        <i class="fa-solid fa-route"></i>
                    </div>
                    <div style="font-size: 12.5px; color: #581c87; line-height: 1.4; font-weight: 500;">
                        Ticket de Ruta <strong>#${ticketRutaId}</strong> &bull; Total Recogido en Fincas: <strong style="font-size: 14px; color: #6d28d9;">${totalRecogido.toLocaleString('es-VE')} Lts</strong>.<br>
                        Distribuye la leche recogida hacia una o <strong>múltiples queseras / compañías de destino</strong>.
                    </div>
                </div>

                <!-- 1. CONDUCTOR QUE TRASLADA -->
                <div style="margin-bottom: 14px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                        CONDUCTOR QUE TRASLADARÁ LA LECHE *
                    </label>
                    <div class="searchable-select" id="swalComboboxEnvioRutaChofer" style="position: relative;">
                        <input type="hidden" id="swalSelectChoferEnvioRuta" required>
                        <div class="combobox-input-wrapper">
                            <input type="text" class="form-input combobox-search" id="searchEnvioRutaChoferInput" placeholder="Buscar o seleccionar conductor..." autocomplete="off" style="border-radius: 8px; font-weight: 600; height: 40px; font-size: 13.5px;">
                            <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                        </div>
                        <div class="combobox-dropdown" id="dropdownEnvioRutaChoferList" style="display: none; max-height: 180px; z-index: 99999;"></div>
                    </div>
                </div>

                <!-- 2. CONTENEDOR DE FILAS DE DESTINO -->
                <div style="margin-bottom: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px; overflow: visible;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                        <div style="font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-building" style="color: #7c3aed;"></i> Queseras Destino (Buscables) y Litros *
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" id="btnAgregarFilaDestinoRuta" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border: none; color: #ffffff; font-weight: 700; font-size: 11.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px; box-shadow: 0 2px 5px rgba(124, 58, 237, 0.3);">
                                <i class="fa-solid fa-circle-plus"></i> + Añadir Otra Compañía
                            </button>
                        </div>
                    </div>

                    <div id="contenedorFilasDestinoRuta" style="display: flex; flex-direction: column; gap: 12px; overflow: visible;">
                        <!-- Las filas con combobox buscable se insertan dinámicamente -->
                    </div>

                    <!-- RESUMEN EN VIVO DE DISTRIBUCIÓN -->
                    <div id="boxResumenDistribucionRuta" style="margin-top: 14px; background: #ffffff; border: 1.5px solid #d8b4fe; border-radius: 10px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(147, 51, 234, 0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 12px; font-weight: 700; color: #475569;">
                                <i class="fa-solid fa-calculator" style="color: #7c3aed; margin-right: 4px;"></i> TOTAL DISTRIBUIDO:
                                <span id="lblCantDestinosRutaBadge" style="background: #f3e8ff; color: #6b21a8; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 800; margin-left: 6px;">1 compañía</span>
                            </span>
                            <div id="lblTotalLitrosRepartirRuta" style="font-size: 18px; font-weight: 900; color: #7c3aed;">
                                0 <span style="font-size: 13px; font-weight: 700;">/ ${totalRecogido.toLocaleString('es-VE')} Lts</span>
                            </div>
                        </div>
                        <div id="lblEstadoDistribucionRuta" style="font-size: 12px; font-weight: 600; color: #16a34a; margin-top: 4px;">
                            Distribución lista para ser despachada.
                        </div>
                    </div>
                </div>

                <!-- 3. OBSERVACIÓN GENERAL -->
                <div style="margin-bottom: 4px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                        OBSERVACIÓN GENERAL (OPCIONAL)
                    </label>
                    <input id="swalEnvioRutaObs" type="text" class="form-input" placeholder="Ej: Traslado directo desde ruta de campo..." style="width: 100%; height: 38px; border-radius: 8px; font-size: 13px;">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Iniciar Envío a Compañías',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#64748b',
        didOpen: (popup) => {
            const content = popup.querySelector('.swal2-html-container');
            if (content) content.style.overflow = 'visible';

            // 1. Setup Chofer combobox (SOLO CHOFERES REALES, NUNCA ADMIN)
            const cbChofer = setupCombobox({
                containerId: 'swalComboboxEnvioRutaChofer',
                inputSearchId: 'searchEnvioRutaChoferInput',
                inputHiddenId: 'swalSelectChoferEnvioRuta',
                dropdownId: 'dropdownEnvioRutaChoferList',
                placeholder: 'Buscar o seleccionar conductor...',
                getItemsFn: () => {
                    const list = state.choferes || [];
                    return list.map(u => ({
                        value: u.id || u.Id,
                        label: (u.nombreCompleto || u.NombreCompleto || u.username || u.Username || '').toUpperCase()
                    }));
                }
            });

            // Pre-seleccionar únicamente si el sugerido o el usuario actual es un CHOFER REAL
            let choferSeleccionado = null;
            if (choferRutaId) {
                choferSeleccionado = (state.choferes || []).find(u => (u.id || u.Id) == choferRutaId);
            }
            if (!choferSeleccionado && state.user && state.user.rol === 'CHOFER') {
                choferSeleccionado = (state.choferes || []).find(u => (u.id || u.Id) == state.user.id);
            }

            if (choferSeleccionado) {
                cbChofer.selectItem(choferSeleccionado.id || choferSeleccionado.Id, (choferSeleccionado.nombreCompleto || choferSeleccionado.NombreCompleto || choferSeleccionado.username || '').toUpperCase());
            }

            // 2. Manejo dinámico de filas de destinos con comboboxes buscables
            const contenedor = document.getElementById('contenedorFilasDestinoRuta');
            let rowCounter = 0;

            const recalcularTotal = () => {
                let total = 0;
                const rows = contenedor.querySelectorAll('.fila-destino-ruta-item');
                rows.forEach(r => {
                    const ltsInput = r.querySelector('.input-litros-destino-ruta');
                    const val = parseInt(ltsInput?.value) || 0;
                    total += val;
                });

                const lblTotal = document.getElementById('lblTotalLitrosRepartirRuta');
                if (lblTotal) {
                    lblTotal.innerHTML = `${formatearNumero(total)} <span style="font-size: 13px; font-weight: 700;">/ ${formatearNumero(totalRecogido)} Lts</span>`;
                }

                const lblBadge = document.getElementById('lblCantDestinosRutaBadge');
                if (lblBadge) {
                    const countRows = rows.length;
                    lblBadge.textContent = `${countRows} ${countRows === 1 ? 'compañía' : 'compañías'}`;
                }

                const boxResumen = document.getElementById('boxResumenDistribucionRuta');
                const lblEstado = document.getElementById('lblEstadoDistribucionRuta');
                if (boxResumen && lblEstado) {
                    const dif = totalRecogido - total;
                    if (dif === 0 && total > 0) {
                        boxResumen.style.borderColor = '#86efac';
                        boxResumen.style.background = '#f0fdf4';
                        lblEstado.style.color = '#15803d';
                        lblEstado.innerHTML = '<i class="fa-solid fa-circle-check"></i> Distribución 100% exacta: el total coincide con lo recogido en fincas.';
                    } else if (dif > 0) {
                        boxResumen.style.borderColor = '#fed7aa';
                        boxResumen.style.background = '#fff7ed';
                        lblEstado.style.color = '#c2410c';
                        lblEstado.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Faltan <strong>${formatearNumero(dif)} Lts</strong> por asignar a las queseras.`;
                    } else if (dif < 0) {
                        boxResumen.style.borderColor = '#fca5a5';
                        boxResumen.style.background = '#fef2f2';
                        lblEstado.style.color = '#b91c1c';
                        lblEstado.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Has asignado <strong>${formatearNumero(Math.abs(dif))} Lts de más</strong> respecto a lo recogido (${formatearNumero(totalRecogido)} Lts).`;
                    } else {
                        boxResumen.style.borderColor = '#d8b4fe';
                        boxResumen.style.background = '#ffffff';
                        lblEstado.style.color = '#6b21a8';
                        lblEstado.innerHTML = 'Ingresa los litros a despachar para cada compañía.';
                    }
                }
            };

            const agregarFila = (defaultCompId = null, defaultLitros = '', defaultTipo = 'VACA') => {
                rowCounter++;
                const rowId = `destino_ruta_row_${rowCounter}`;
                const cbContainerId = `swalComboboxDestinoRutaComp_${rowCounter}`;
                const cbInputSearchId = `searchDestinoRutaCompInput_${rowCounter}`;
                const cbInputHiddenId = `swalDestinoRutaCompVal_${rowCounter}`;
                const cbDropdownId = `dropdownDestinoRutaCompList_${rowCounter}`;

                const div = document.createElement('div');
                div.className = 'fila-destino-ruta-item';
                div.id = rowId;
                div.style.cssText = 'display: grid; grid-template-columns: 1.4fr 110px 1fr auto; gap: 8px; align-items: center; background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.02); position: relative; overflow: visible;';

                div.innerHTML = `
                    <div style="position: relative; overflow: visible;">
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            COMPAÑÍA DESTINO *
                        </label>
                        <div class="searchable-select" id="${cbContainerId}" style="position: relative;">
                            <input type="hidden" class="input-compania-destino-ruta" id="${cbInputHiddenId}">
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="${cbInputSearchId}" placeholder="Buscar quesera..." autocomplete="off" style="border-radius: 7px; height: 38px; font-size: 13px; font-weight: 600;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="${cbDropdownId}" style="display: none; max-height: 160px; z-index: 99999;"></div>
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            TIPO LECHE
                        </label>
                        <select class="form-input select-tipo-leche-destino-ruta" style="width: 100%; height: 38px; border-radius: 7px; font-size: 12px; font-weight: 700; color: #1e293b; background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 0 6px;">
                            <option value="VACA" ${defaultTipo === 'VACA' ? 'selected' : ''}>🐄 VACA</option>
                            <option value="BUFALO" ${defaultTipo === 'BUFALO' || defaultTipo === 'BUFALA' ? 'selected' : ''}>🐃 BÚFALO</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block;">
                            LITROS A DESPACHAR *
                        </label>
                        <input type="number" class="form-input input-litros-destino-ruta" placeholder="Ej: 2500" value="${defaultLitros}" style="width: 100%; height: 38px; border-radius: 7px; font-size: 14px; font-weight: 800; color: #0f172a; text-align: right; padding-right: 10px;">
                    </div>

                    <div style="padding-top: 18px;">
                        <button type="button" class="btn-eliminar-fila-destino-ruta" title="Eliminar destino" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; width: 36px; height: 38px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;

                contenedor.appendChild(div);

                const cbInst = setupCombobox({
                    containerId: cbContainerId,
                    inputSearchId: cbInputSearchId,
                    inputHiddenId: cbInputHiddenId,
                    dropdownId: cbDropdownId,
                    placeholder: 'Buscar quesera...',
                    getItemsFn: () => {
                        return companiasOpciones.map(c => ({
                            value: c.id || c.Id,
                            label: (c.nombre || c.Nombre || '').toUpperCase()
                        }));
                    }
                });

                if (defaultCompId) {
                    const compObj = companiasOpciones.find(c => (c.id || c.Id) == defaultCompId);
                    if (compObj) {
                        cbInst.selectItem(defaultCompId, (compObj.nombre || compObj.Nombre || '').toUpperCase());
                    }
                }

                const inpLitros = div.querySelector('.input-litros-destino-ruta');
                if (inpLitros) {
                    inpLitros.addEventListener('input', recalcularTotal);
                }

                const btnEliminar = div.querySelector('.btn-eliminar-fila-destino-ruta');
                if (btnEliminar) {
                    btnEliminar.addEventListener('click', () => {
                        const totalActualRows = contenedor.querySelectorAll('.fila-destino-ruta-item').length;
                        if (totalActualRows <= 1) {
                            Swal.showValidationMessage('Debe existir al menos una compañía de destino.');
                            setTimeout(() => Swal.resetValidationMessage(), 2500);
                            return;
                        }
                        div.remove();
                        recalcularTotal();
                    });
                }

                recalcularTotal();
            };

            // Fila inicial con el total recogido en fincas
            agregarFila(null, totalRecogido > 0 ? totalRecogido : '', 'VACA');

            const btnAdd = document.getElementById('btnAgregarFilaDestinoRuta');
            if (btnAdd) {
                btnAdd.addEventListener('click', () => {
                    agregarFila();
                });
            }
        },
        preConfirm: () => {
            const choferId = parseInt(document.getElementById('swalSelectChoferEnvioRuta')?.value);
            const obsGeneral = document.getElementById('swalEnvioRutaObs')?.value || '';

            if (!choferId || isNaN(choferId) || choferId <= 0) {
                Swal.showValidationMessage('Debe seleccionar el conductor asignado para el traslado.');
                return false;
            }

            const rows = document.querySelectorAll('.fila-destino-ruta-item');
            if (!rows || rows.length === 0) {
                Swal.showValidationMessage('Debes agregar al menos una compañía de destino.');
                return false;
            }

            const destinos = [];
            let sumLitros = 0;

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const compInput = r.querySelector('.input-compania-destino-ruta');
                const tipoSelect = r.querySelector('.select-tipo-leche-destino-ruta');
                const ltsInput = r.querySelector('.input-litros-destino-ruta');

                const compId = parseInt(compInput?.value);
                const lts = parseInt(ltsInput?.value);
                const tipoLeche = tipoSelect?.value || 'VACA';

                if (!compId) {
                    Swal.showValidationMessage(`Fila #${i + 1}: Selecciona una compañía de destino.`);
                    return false;
                }

                if (isNaN(lts) || lts <= 0) {
                    Swal.showValidationMessage(`Fila #${i + 1}: Ingresa una cantidad válida de litros mayor a cero.`);
                    return false;
                }

                sumLitros += lts;
                destinos.push({
                    companiaId: compId,
                    litrosDespachados: lts,
                    tipoLeche: tipoLeche,
                    observacion: obsGeneral
                });
            }

            if (totalRecogido > 0 && sumLitros !== totalRecogido) {
                Swal.showValidationMessage(`La suma distribuida (${sumLitros.toLocaleString('es-VE')} Lts) debe ser exactamente igual al total recogido en fincas (${totalRecogido.toLocaleString('es-VE')} Lts). Diferencia: ${Math.abs(totalRecogido - sumLitros).toLocaleString('es-VE')} Lts.`);
                return false;
            }

            return {
                choferId,
                observacion: obsGeneral,
                destinos
            };
        }
    });

    if (!formValues) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketRutaId}/enviar-compania`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify(formValues)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al enviar a compañía.' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const data = await res.json();

        // Desvincular ticket activo del formulario ya que fue cerrado en RECEPCIONADO
        actualizarEstadoBotonNuevoViaje(null);
        state.ticketAsignadoActivo = null;
        const bannerTicket = document.getElementById('bannerTicketActivoForm');
        if (bannerTicket) bannerTicket.style.display = 'none';

        showToast(
            '¡Despacho a Compañías Creado!',
            'success',
            `Ruta #${ticketRutaId} marcada como RECEPCIONADO. Se generaron ${cantDest} ${cantDest === 1 ? 'ticket de salida' : 'tickets de salida'}.`,
            2200
        );

        await cargarViajeActivoChofer();
        await cargarDespachoActivoChofer();
        if (typeof cargarViajesRutasDelDia === 'function') await cargarViajesRutasDelDia();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.abrirModalEnviarACompaniaDesdeRuta = abrirModalEnviarACompaniaDesdeRuta;

// 4. MODAL PARA QUE RECEPTORÍA CREE UNO O VARIOS TICKETS DE SALIDA / ENVÍO (MÚLTIPLES COMPAÑÍAS DESTINO)
async function abrirModalNuevoDespachoReceptoria(initialData = null) {
    if (state.user && state.user.rol === 'CHOFER') {
        Swal.fire({
            icon: 'warning',
            title: 'Acceso Denegado',
            text: 'Un chofer no puede crear tickets de receptoría. Solo la administración puede emitir tickets de salida hacia queseras.',
            background: '#ffffff',
            color: '#0f172a'
        });
        return;
    }

    const hoy = new Date().toISOString().split('T')[0];
    const fechaVal = (initialData && initialData.fecha) ? initialData.fecha : hoy;

    const companiasOpciones = (state.companias || []).filter(c => {
        const nombre = (c.nombre || c.Nombre || '').toUpperCase();
        return !nombre.includes('RECEPTORIA') && !nombre.includes('RECEPTORÍA');
    });

    const { value: formValues } = await Swal.fire({
        title: '<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 20px; font-weight: 800; color: #1e1b4b;"><i class="fa-solid fa-truck-ramp-box" style="color: #9333ea;"></i> Despacho / Salida Multi-Destino</div>',
        customClass: {
            popup: 'swal2-modal-overflow-visible'
        },
        width: 760,
        html: `
            <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1.5px solid #ddd6fe; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: #9333ea; color: white; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(147, 51, 234, 0.3);">
                        <i class="fa-solid fa-route"></i>
                    </div>
                    <div style="font-size: 12.5px; color: #581c87; line-height: 1.4; font-weight: 500;">
                        Distribuye la salida de leche hacia una o <strong>múltiples compañías de destino</strong> con búsqueda inteligente (ej. Colona 1.500 Lts + Pablo Marin 6.000 Lts = Total 7.500 Lts).
                    </div>
                </div>

                <!-- 1. CONDUCTOR Y FECHA -->
                <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                            CONDUCTOR ASIGNADO *
                        </label>
                        <div class="searchable-select" id="swalComboboxDespachoChofer" style="position: relative;">
                            <input type="hidden" id="swalNuevoDespachoChofer" required>
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="searchDespachoChoferInput" placeholder="Buscar o seleccionar chofer..." autocomplete="off" style="border-radius: 8px; font-weight: 600; height: 40px; font-size: 13.5px;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="dropdownDespachoChoferList" style="display: none; max-height: 180px; z-index: 99999;"></div>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                            FECHA DE SALIDA *
                        </label>
                        <input id="swalNuevoDespachoFecha" type="date" class="form-input" value="${fechaVal}" style="width: 100%; height: 40px; border-radius: 8px; font-size: 13.5px; font-weight: 600;">
                    </div>
                </div>

                <!-- 2. CONTENEDOR DE FILAS DE DESTINO -->
                <div style="margin-bottom: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px; overflow: visible;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                        <div style="font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-building" style="color: #7c3aed;"></i> Compañías Destino (Buscables) y Litros *
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" id="btnAbrirQuickCompModal" title="Crear nueva quesera en el catálogo" style="background: #ffffff; border: 1px solid #d8b4fe; color: #7c3aed; font-weight: 700; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px;">
                                <i class="fa-solid fa-plus"></i> Catálogo
                            </button>
                            <button type="button" id="btnAgregarFilaDestino" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border: none; color: #ffffff; font-weight: 700; font-size: 11.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px; box-shadow: 0 2px 5px rgba(124, 58, 237, 0.3);">
                                <i class="fa-solid fa-circle-plus"></i> + Añadir Otra Compañía
                            </button>
                        </div>
                    </div>

                    <div id="contenedorFilasDestino" style="display: flex; flex-direction: column; gap: 12px; overflow: visible;">
                        <!-- Las filas con combobox buscable se insertan dinámicamente -->
                    </div>

                    <!-- RESUMEN EN VIVO DE LITROS -->
                    <div style="margin-top: 14px; background: #ffffff; border: 1.5px solid #d8b4fe; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 6px rgba(147, 51, 234, 0.05);">
                        <div style="font-size: 12px; font-weight: 700; color: #475569;">
                            <i class="fa-solid fa-calculator" style="color: #7c3aed; margin-right: 4px;"></i> TOTAL GENERAL A REPARTIR:
                            <span id="lblCantDestinosBadge" style="background: #f3e8ff; color: #6b21a8; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 800; margin-left: 6px;">1 compañía</span>
                        </div>
                        <div id="lblTotalLitrosRepartir" style="font-size: 18px; font-weight: 900; color: #7c3aed;">
                            0 <span style="font-size: 13px; font-weight: 700;">Lts</span>
                        </div>
                    </div>
                </div>

                <!-- 3. OBSERVACIÓN GENERAL -->
                <div style="margin-bottom: 4px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                        OBSERVACIÓN GENERAL (OPCIONAL)
                    </label>
                    <input id="swalNuevoDespachoObs" type="text" class="form-input" placeholder="Ej: Cisterna #2, leche fría de silo..." value="${initialData && initialData.observacion ? initialData.observacion : ''}" style="width: 100%; height: 38px; border-radius: 8px; font-size: 13px;">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Crear Tickets de Despacho',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#64748b',
        didOpen: (popup) => {
            const content = popup.querySelector('.swal2-html-container');
            if (content) content.style.overflow = 'visible';

            // 1. Setup Chofer combobox (SOLO CHOFERES REALES)
            const cbChofer = setupCombobox({
                containerId: 'swalComboboxDespachoChofer',
                inputSearchId: 'searchDespachoChoferInput',
                inputHiddenId: 'swalNuevoDespachoChofer',
                dropdownId: 'dropdownDespachoChoferList',
                placeholder: 'Buscar o seleccionar chofer...',
                getItemsFn: () => {
                    const list = state.choferes || [];
                    return list.map(u => ({
                        value: u.id || u.Id,
                        label: (u.nombreCompleto || u.NombreCompleto || u.username || u.Username || '').toUpperCase()
                    }));
                }
            });

            if (initialData && initialData.usuarioId) {
                const choferObj = (state.choferes || []).find(u => (u.id || u.Id) == initialData.usuarioId);
                if (choferObj) {
                    cbChofer.selectItem(initialData.usuarioId, (choferObj.nombreCompleto || choferObj.NombreCompleto || choferObj.username || '').toUpperCase());
                }
            }

            // 2. Manejo dinámico de filas de destinos con comboboxes buscables
            const contenedor = document.getElementById('contenedorFilasDestino');
            let rowCounter = 0;

            const recalcularTotal = () => {
                let total = 0;
                const rows = contenedor.querySelectorAll('.fila-destino-item');
                rows.forEach(r => {
                    const ltsInput = r.querySelector('.input-litros-destino');
                    const val = parseInt(ltsInput?.value) || 0;
                    total += val;
                });

                const lblTotal = document.getElementById('lblTotalLitrosRepartir');
                if (lblTotal) {
                    lblTotal.innerHTML = `${formatearNumero(total)} <span style="font-size: 13px; font-weight: 700;">Lts</span>`;
                }

                const lblBadge = document.getElementById('lblCantDestinosBadge');
                if (lblBadge) {
                    const countRows = rows.length;
                    lblBadge.textContent = `${countRows} ${countRows === 1 ? 'compañía' : 'compañías'}`;
                }
            };

            const agregarFila = (defaultCompId = null, defaultLitros = '', defaultTipo = 'VACA') => {
                rowCounter++;
                const rowId = `destino_row_${rowCounter}`;
                const cbContainerId = `swalComboboxDestinoComp_${rowCounter}`;
                const cbInputSearchId = `searchDestinoCompInput_${rowCounter}`;
                const cbInputHiddenId = `swalDestinoCompVal_${rowCounter}`;
                const cbDropdownId = `dropdownDestinoCompList_${rowCounter}`;

                const div = document.createElement('div');
                div.className = 'fila-destino-item';
                div.id = rowId;
                div.style.cssText = 'display: grid; grid-template-columns: 1.4fr 110px 1fr auto; gap: 8px; align-items: center; background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.02); position: relative; overflow: visible;';

                div.innerHTML = `
                    <div style="position: relative; overflow: visible;">
                        <div class="searchable-select" id="${cbContainerId}" style="position: relative; width: 100%;">
                            <input type="hidden" class="input-comp-id-hidden" id="${cbInputHiddenId}" required>
                            <div class="combobox-input-wrapper">
                                <input type="text" class="form-input combobox-search" id="${cbInputSearchId}" placeholder="Buscar o seleccionar compañía..." autocomplete="off" style="border-radius: 8px; font-weight: 600; height: 38px; font-size: 13px;">
                                <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                            </div>
                            <div class="combobox-dropdown" id="${cbDropdownId}" style="display: none; max-height: 180px; z-index: 99999;"></div>
                        </div>
                    </div>
                    <div>
                        <select class="form-input select-tipo-leche-destino" style="width: 100%; height: 38px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1e293b; background: #faf5ff; border: 1.5px solid #d8b4fe; padding: 0 6px;">
                            <option value="VACA" ${defaultTipo === 'VACA' ? 'selected' : ''}>🐄 VACA</option>
                            <option value="BUFALO" ${defaultTipo === 'BUFALO' || defaultTipo === 'BUFALA' ? 'selected' : ''}>🐃 BÚFALO</option>
                        </select>
                    </div>
                    <div>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="number" min="1" class="form-input input-litros-destino" placeholder="Litros..." value="${defaultLitros}" style="width: 100%; height: 38px; border-radius: 8px; font-size: 14px; font-weight: 800; color: #6d28d9; background: #faf5ff; border: 1.5px solid #d8b4fe; padding-right: 28px; text-align: right;">
                            <span style="position: absolute; right: 8px; font-size: 11px; font-weight: 800; color: #9333ea; pointer-events: none;">L</span>
                        </div>
                    </div>
                    <div>
                        <button type="button" class="btn-eliminar-fila" title="Eliminar fila" style="background: #fee2e2; border: 1px solid #fecaca; color: #dc2626; width: 36px; height: 38px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s ease;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;

                contenedor.appendChild(div);

                // Configurar combobox buscable para esta fila
                const cb = setupCombobox({
                    containerId: cbContainerId,
                    inputSearchId: cbInputSearchId,
                    inputHiddenId: cbInputHiddenId,
                    dropdownId: cbDropdownId,
                    placeholder: 'Buscar o seleccionar compañía...',
                    getItemsFn: () => {
                        return companiasOpciones.map(c => ({
                            value: c.id || c.Id,
                            label: (c.nombre || c.Nombre || '').toUpperCase()
                        }));
                    },
                    onSelect: () => {
                        recalcularTotal();
                    }
                });

                if (defaultCompId) {
                    const compObj = companiasOpciones.find(c => (c.id || c.Id) == defaultCompId);
                    if (compObj) {
                        cb.selectItem(defaultCompId, (compObj.nombre || compObj.Nombre || '').toUpperCase());
                    }
                }

                // Eventos de la fila
                const inputLitros = div.querySelector('.input-litros-destino');
                const btnDel = div.querySelector('.btn-eliminar-fila');

                inputLitros.addEventListener('input', recalcularTotal);

                btnDel.addEventListener('click', () => {
                    const todas = contenedor.querySelectorAll('.fila-destino-item');
                    if (todas.length <= 1) {
                        Swal.showValidationMessage('Debe existir al menos una compañía de destino.');
                        setTimeout(() => Swal.resetValidationMessage(), 2000);
                        return;
                    }
                    div.remove();
                    recalcularTotal();
                });

                recalcularTotal();
            };

            // Insertar fila inicial
            const initComp = initialData && initialData.companiaId ? initialData.companiaId : null;
            const initLts = initialData && initialData.litrosDespachados ? initialData.litrosDespachados : '';
            const initTipo = initialData && initialData.tipoLeche ? initialData.tipoLeche : 'VACA';
            agregarFila(initComp, initLts, initTipo);

            // Botón añadir otra fila
            const btnAdd = document.getElementById('btnAgregarFilaDestino');
            if (btnAdd) {
                btnAdd.addEventListener('click', () => agregarFila());
            }

            // Botón abrir catálogo rápido de compañías
            const btnQuickComp = document.getElementById('btnAbrirQuickCompModal');
            if (btnQuickComp) {
                btnQuickComp.addEventListener('click', () => {
                    const currentData = {
                        usuarioId: document.getElementById('swalNuevoDespachoChofer')?.value,
                        fecha: document.getElementById('swalNuevoDespachoFecha')?.value,
                        observacion: document.getElementById('swalNuevoDespachoObs')?.value
                    };
                    abrirModalRapidoCrearCompaniaDespacho(currentData);
                });
            }
        },
        preConfirm: () => {
            const choferId = parseInt(document.getElementById('swalNuevoDespachoChofer')?.value);
            const fecha = document.getElementById('swalNuevoDespachoFecha')?.value;
            const obsGeneral = (document.getElementById('swalNuevoDespachoObs')?.value || '').trim();

            if (!choferId || isNaN(choferId) || choferId <= 0) {
                Swal.showValidationMessage('Debe seleccionar el conductor asignado para el despacho.');
                return false;
            }
            if (!fecha) {
                Swal.showValidationMessage('Por favor selecciona la fecha de salida.');
                return false;
            }

            const rows = document.querySelectorAll('#contenedorFilasDestino .fila-destino-item');
            if (!rows || rows.length === 0) {
                Swal.showValidationMessage('Debes añadir al menos una compañía de destino.');
                return false;
            }

            const destinos = [];
            let errorMsg = null;

            rows.forEach((r, idx) => {
                const compId = parseInt(r.querySelector('.input-comp-id-hidden')?.value);
                const tipoLeche = r.querySelector('.select-tipo-leche-destino')?.value || 'VACA';
                const lts = parseInt(r.querySelector('.input-litros-destino')?.value);

                if (!compId) {
                    errorMsg = `Fila #${idx + 1}: Busca y selecciona la compañía de destino.`;
                    return;
                }
                if (isNaN(lts) || lts <= 0) {
                    errorMsg = `Fila #${idx + 1}: Ingresa una cantidad válida de litros (> 0).`;
                    return;
                }

                const compObj = companiasOpciones.find(c => (c.id || c.Id) === compId);
                const compNombre = compObj ? (compObj.nombre || compObj.Nombre || '').toUpperCase() : `Compañía #${compId}`;

                destinos.push({
                    companiaId: compId,
                    companiaNombre: compNombre,
                    litrosDespachados: lts,
                    tipoLeche: tipoLeche,
                    fecha: fecha,
                    observacion: obsGeneral
                });
            });

            if (errorMsg) {
                Swal.showValidationMessage(errorMsg);
                return false;
            }

            return {
                usuarioId: choferId,
                fecha: fecha,
                observacion: obsGeneral,
                destinos: destinos
            };
        }
    });

    if (!formValues || !formValues.destinos || formValues.destinos.length === 0) return;

    try {
        Swal.fire({
            title: 'Creando Tickets de Despacho...',
            html: `Generando ${formValues.destinos.length} ticket(s) de salida...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const creados = [];
        for (const item of formValues.destinos) {
            const payload = {
                usuarioId: formValues.usuarioId,
                companiaId: item.companiaId,
                litrosDespachados: item.litrosDespachados,
                tipoLeche: item.tipoLeche,
                fecha: item.fecha,
                observacion: item.observacion
            };

            const res = await fetch(`${API_BASE}/control-companias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: `Error al crear ticket para ${item.companiaNombre}` }));
                throw new Error(err.message || `Error creando ticket para ${item.companiaNombre}`);
            }

            const data = await res.json();
            creados.push({ ...item, ticketId: data.id });
        }

        const totalLts = creados.reduce((acc, c) => acc + c.litrosDespachados, 0);
        const desgloseHtml = creados.map(c => `• <strong>${c.companiaNombre}</strong>: ${formatearNumero(c.litrosDespachados)} Lts (Ticket #${c.ticketId})`).join('<br>');

        Swal.fire({
            icon: 'success',
            title: '¡Despacho Registrado con Éxito!',
            html: `
                <div style="text-align: left; font-size: 13.5px; color: #334155; margin-top: 8px;">
                    <p style="margin-bottom: 8px;">Se generaron correctamente <strong>${creados.length} tickets de salida</strong> por un total de <strong style="color: #047857; font-size: 15px;">${formatearNumero(totalLts)} Lts</strong>:</p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 12.5px; line-height: 1.6; color: #1e293b;">
                        ${desgloseHtml}
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#7c3aed'
        });

        await refrescarVistasGlobales();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.abrirModalNuevoDespachoReceptoria = abrirModalNuevoDespachoReceptoria;

async function abrirModalRapidoCrearCompaniaDespacho(parentFormData) {
    const { value: compData } = await Swal.fire({
        title: '<div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 19px; font-weight: 800; color: #1e1b4b;"><i class="fa-solid fa-building-circle-plus" style="color: #7c3aed;"></i> Nueva Compañía / Quesera</div>',
        html: `
            <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                <p style="margin: 0 0 14px 0; color: #64748b; font-size: 12.5px;">
                    Registra una nueva compañía o quesera para asignarla inmediatamente a este ticket de salida.
                </p>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">
                        NOMBRE DE LA COMPAÑÍA / QUESERA *
                    </label>
                    <input id="swalQuickCompNombre" type="text" class="form-input" placeholder="Ej: Lácteos San Antonio C.A." style="width: 100%; height: 38px; border-radius: 8px; font-size: 13.5px; font-weight: 600;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">
                            PRECIO BASE ($/L)
                        </label>
                        <input id="swalQuickCompPrecio" type="number" step="0.0001" class="form-input" value="0.4000" style="width: 100%; height: 38px; border-radius: 8px; font-size: 13.5px; font-weight: 600;">
                    </div>
                    <div>
                        <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">
                            ENCARGADO / CONTACTO
                        </label>
                        <input id="swalQuickCompEncargado" type="text" class="form-input" placeholder="Opcional" style="width: 100%; height: 38px; border-radius: 8px; font-size: 13.5px;">
                    </div>
                </div>
                <div>
                    <label style="font-size: 11.5px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">
                        TELÉFONO / DIRECCIÓN
                    </label>
                    <input id="swalQuickCompTelefono" type="text" class="form-input" placeholder="Ej: 0414-1234567" style="width: 100%; height: 38px; border-radius: 8px; font-size: 13px;">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-save"></i> Guardar y Seleccionar',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
            const nombre = document.getElementById('swalQuickCompNombre')?.value.trim();
            const precio = parseFloat(document.getElementById('swalQuickCompPrecio')?.value) || 0;
            const encargado = document.getElementById('swalQuickCompEncargado')?.value.trim();
            const telefono = document.getElementById('swalQuickCompTelefono')?.value.trim();

            if (!nombre) {
                Swal.showValidationMessage('El nombre de la compañía es obligatorio.');
                return false;
            }
            return {
                nombre,
                precioCompraLitroUSD: precio,
                encargado,
                telefono,
                tipoServicioId: 1,
                activo: true
            };
        }
    });

    if (!compData) {
        // Retornar al modal principal preservando los datos
        abrirModalNuevoDespachoReceptoria(parentFormData);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/catalogos/companias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify(compData)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al registrar la compañía.' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const data = await res.json();
        const nuevaCompaniaId = data.id;

        // Refrescar catálogos
        if (typeof cargarCatalogos === 'function') {
            await cargarCatalogos();
        }

        // Reabrir modal de despacho con la nueva compañía seleccionada
        const updatedData = {
            ...(parentFormData || {}),
            companiaId: nuevaCompaniaId
        };
        abrirModalNuevoDespachoReceptoria(updatedData);

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message,
            background: '#ffffff',
            color: '#0f172a'
        }).then(() => {
            abrirModalNuevoDespachoReceptoria(parentFormData);
        });
    }
}
window.abrirModalRapidoCrearCompaniaDespacho = abrirModalRapidoCrearCompaniaDespacho;

async function refrescarVistasGlobales() {
    try {
        if (typeof cargarEntregasHoy === 'function') await cargarEntregasHoy();
        if (typeof cargarDashboard === 'function') await cargarDashboard();
        if (typeof cargarBandejaReceptoria === 'function') await cargarBandejaReceptoria();
        if (typeof cargarViajesRutasDelDia === 'function') await cargarViajesRutasDelDia();
        if (typeof cargarControlViajesTickets === 'function') await cargarControlViajesTickets();
        if (typeof cargarDespachoActivoChofer === 'function') await cargarDespachoActivoChofer();
        if (typeof cargarViajeActivoChofer === 'function') await cargarViajeActivoChofer();
    } catch (e) {
        console.warn('Error al refrescar vistas globales:', e);
    }
}
window.refrescarVistasGlobales = refrescarVistasGlobales;

// 5. BANDEJAS DE RECEPTORÍA (ENTRADAS TB_CONTROL_RUTAS Y SALIDAS TB_CONTROL_COMPANIAS)
async function cargarBandejaReceptoria() {
    const contenedorCamiones = document.getElementById('contenedorCamionesReceptoria');
    const contenedorTransito = document.getElementById('contenedorCamionesTransitoQuesera');

    if (!contenedorCamiones && !contenedorTransito) return;

    try {
        // 1. Cargar Entradas (Control de Rutas)
        const resRutas = await fetch(`${API_BASE}/control-rutas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resRutas.ok) {
            state.todosLosViajesReceptoria = await resRutas.json() || [];
        }

        // 2. Cargar Salidas (Control de Compañías)
        const resComp = await fetch(`${API_BASE}/control-companias`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resComp.ok) {
            state.todosLosDespachosCompanias = await resComp.json() || [];
        }

        aplicarFiltrosBandejaReceptoria();
        actualizarVisibilidadFormularioReceptoria();
    } catch (e) {
        console.error('Error en bandeja receptoría:', e);
    }
}
window.cargarBandejaReceptoria = cargarBandejaReceptoria;

function aplicarFiltrosBandejaReceptoria() {
    const contenedorCamiones = document.getElementById('contenedorCamionesReceptoria');
    const contenedorTransito = document.getElementById('contenedorCamionesTransitoQuesera');
    const badgeReceptoria = document.getElementById('badgeContadorCamionesReceptoria');
    const badgeTransito = document.getElementById('badgeContadorCamionesTransito');
    const cardEnEspera = document.getElementById('cardBandejaEnEspera');
    const cardEnTransito = document.getElementById('cardBandejaEnTransito');
    const bannerVacio = document.getElementById('contenedorBandejasVaciasInfo');
    const pillEntradas = document.getElementById('badgePillEntradas');
    const pillSalidas = document.getElementById('badgePillSalidas');

    const rutas = state.todosLosViajesReceptoria || [];
    const despachos = state.todosLosDespachosCompanias || [];
    const filtroEstado = document.getElementById('filtroEstadoBandejaReceptoria')?.value || 'TODOS';
    const filtroFecha = document.getElementById('filtroFechaBandejaReceptoria')?.value || '';

    // Regla de Negocio Estricta: En la vista de RECEPTORÍA NO se muestran tickets en estado FINALIZADO (ProcesoActualId = 4).
    // Toda la información de tickets finalizados pertenece a la vista de Control de Viajes (Rutas / Histórico).
    let entradasFiltradas = rutas.filter(v => {
        const pId = Number(v.procesoActualId || 1);
        const st = (v.estado || '').toUpperCase();
        return pId !== 4 && st !== 'FINALIZADO';
    });

    if (filtroFecha) {
        entradasFiltradas = entradasFiltradas.filter(v => (v.fecha || '').split('T')[0] === filtroFecha);
    }

    // Filtrar Salidas (TB_CONTROL_COMPANIAS): Excluir despachos finalizados de la bandeja de Receptoría activa
    let salidasFiltradas = despachos.filter(d => {
        const pId = Number(d.procesoActualId || 1);
        const st = (d.estado || '').toUpperCase();
        return pId !== 4 && st !== 'FINALIZADO';
    });

    if (filtroFecha) {
        salidasFiltradas = salidasFiltradas.filter(d => (d.fecha || '').split('T')[0] === filtroFecha);
    }

    // Actualizar pills de segmentos rápidos
    if (pillEntradas) pillEntradas.textContent = `${entradasFiltradas.length}`;
    if (pillSalidas) pillSalidas.textContent = `${salidasFiltradas.length}`;

    // Aplicar filtro por estado
    if (filtroEstado === 'EN_ESPERA') {
        entradasFiltradas = entradasFiltradas.filter(v => {
            const pId = Number(v.procesoActualId || 1);
            const st = (v.estado || '').toUpperCase();
            const ltsR = v.totalLitrosReceptoria != null ? Number(v.totalLitrosReceptoria) : Number(v.litrosRecibidosReceptoria || 0);
            return pId === 1 && st !== 'RECEPCIONADO' && st !== 'RECIBIDO' && ltsR === 0;
        });
        salidasFiltradas = [];
        if (cardEnEspera) cardEnEspera.style.display = 'block';
        if (cardEnTransito) cardEnTransito.style.display = 'none';
        if (bannerVacio) bannerVacio.style.display = 'none';
    } else if (filtroEstado === 'RECEPCIONADO') {
        entradasFiltradas = entradasFiltradas.filter(v => {
            const pId = Number(v.procesoActualId || 1);
            const st = (v.estado || '').toUpperCase();
            const ltsR = v.totalLitrosReceptoria != null ? Number(v.totalLitrosReceptoria) : Number(v.litrosRecibidosReceptoria || 0);
            return (pId === 2 || pId === 3 || st === 'RECEPCIONADO' || st === 'RECIBIDO' || st === 'ENTREGADO') || ltsR > 0;
        });
        salidasFiltradas = [];
        if (cardEnEspera) cardEnEspera.style.display = 'block';
        if (cardEnTransito) cardEnTransito.style.display = 'none';
        if (bannerVacio) bannerVacio.style.display = 'none';
    } else if (filtroEstado === 'EN_VIA') {
        entradasFiltradas = [];
        salidasFiltradas = salidasFiltradas.filter(d => (d.estado || '').toUpperCase() === 'EN VIA');
        if (cardEnEspera) cardEnEspera.style.display = 'none';
        if (cardEnTransito) cardEnTransito.style.display = 'block';
        if (bannerVacio) bannerVacio.style.display = 'none';
    } else if (filtroEstado === 'DESPACHO') {
        entradasFiltradas = [];
        salidasFiltradas = salidasFiltradas.filter(d => (d.estado || '').toUpperCase() === 'DESPACHO');
        if (cardEnEspera) cardEnEspera.style.display = 'none';
        if (cardEnTransito) cardEnTransito.style.display = 'block';
        if (bannerVacio) bannerVacio.style.display = 'none';
    } else {
        // MODO TODOS / GENERAL: Auto-ocultar divs si no hay camiones para evitar ocupar espacio vertical
        const hayEntradas = entradasFiltradas.length > 0;
        const haySalidas = salidasFiltradas.length > 0;
        const forzar = Boolean(state.forzarMostrarBandejas);

        if (cardEnEspera) {
            cardEnEspera.style.display = (hayEntradas || forzar) ? 'block' : 'none';
        }
        if (cardEnTransito) {
            cardEnTransito.style.display = (haySalidas || forzar) ? 'block' : 'none';
        }
        if (bannerVacio) {
            bannerVacio.style.display = (!hayEntradas && !haySalidas && !forzar) ? 'flex' : 'none';
        }
    }

    if (badgeReceptoria) badgeReceptoria.textContent = `${entradasFiltradas.length} Camiones`;
    if (badgeTransito) badgeTransito.textContent = `${salidasFiltradas.length} Despachos`;

    // Renderizar Entradas (Bandeja 1 - TB_CONTROL_RUTAS)
    if (contenedorCamiones) {
        if (entradasFiltradas.length === 0) {
            contenedorCamiones.innerHTML = `
                <div style="grid-column: 1/-1; padding: 22px; text-align: center; color: #64748b; font-size: 13px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;">
                    <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    No hay camiones pendientes de recibir con los filtros seleccionados.
                </div>
            `;
        } else {
            contenedorCamiones.innerHTML = entradasFiltradas.map(v => {
                const procId = Number(v.procesoActualId || v.ProcesoActualId || 1);
                const stUpper = (v.estado || v.Estado || '').toUpperCase();
                const ltsRecibidosVal = v.totalLitrosReceptoria != null ? Number(v.totalLitrosReceptoria) : (v.litrosRecibidosReceptoria != null ? Number(v.litrosRecibidosReceptoria) : null);

                const esFinalizado = stUpper === 'FINALIZADO' || procId === 4;
                const esRecepcionado = procId >= 2 || stUpper === 'RECEPCIONADO' || stUpper === 'RECIBIDO' || esFinalizado || (ltsRecibidosVal != null && ltsRecibidosVal > 0);

                const badgeColor = esFinalizado ? '#15803d' : (esRecepcionado ? '#166534' : '#0284c7');
                const badgeBg = esFinalizado ? '#dcfce7' : (esRecepcionado ? '#dcfce7' : '#e0f2fe');
                const badgeBorder = esFinalizado ? '#86efac' : (esRecepcionado ? '#bbf7d0' : '#bae6fd');
                const badgeText = esFinalizado ? 'Finalizado' : (esRecepcionado ? 'Recepcionado' : 'En Espera');

                const litrosFinca = Math.round(Number(v.totalLitrosFinca || v.TotalLitrosFinca || 0));
                const litrosRecibidos = ltsRecibidosVal != null ? Math.round(ltsRecibidosVal) : null;
                const diferencia = (litrosRecibidos != null) ? Math.round(litrosFinca - litrosRecibidos) : null;

                return `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid ${esFinalizado ? '#15803d' : (esRecepcionado ? '#10b981' : '#0284c7')}; border-radius: 10px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <strong style="color: #0284c7; font-size: 15px;"><i class="fa-solid fa-ticket"></i> Ticket #${v.id}</strong>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                ${(state.user && (state.user.rol === 'ADMIN' || state.user.rol === 'SUPERADMIN')) ? `
                                    <button type="button" class="btn btn-sm" onclick="abrirModalEditarTicket('RUTA', ${v.id})" title="Editar Ticket (Admin)" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 7px; font-size: 11px; cursor: pointer;">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm" onclick="eliminarTicketAdmin('RUTA', ${v.id})" title="Eliminar Ticket (Admin)" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 2px 7px; font-size: 11px; cursor: pointer;">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                ` : ''}
                                <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; font-size: 11px; border: 1px solid ${badgeBorder};">
                                    ${badgeText}
                                </span>
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-regular fa-calendar-days" style="color: #0284c7;"></i>
                            <span>Fecha: <strong style="color: #0f172a;">${formatearFechaTicket(v.fecha)}</strong></span>
                        </div>
                        <div style="font-size: 14px; color: #0f172a; font-weight: 800; margin-bottom: 4px;">
                            <i class="fa-solid fa-user-tie" style="color: #0284c7; margin-right: 6px;"></i>${v.nombreConductor || 'Conductor'}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #f0f9ff; border: 1px solid #bae6fd; padding: 8px 10px; border-radius: 6px; margin: 10px 0;">
                            <span style="font-size: 12px; color: #0369a1; font-weight: 600;">Litros en Fincas:</span>
                            <strong style="font-size: 16px; color: #0284c7; font-weight: 800;">${litrosFinca.toLocaleString('es-VE')} Lts</strong>
                        </div>
                        ${litrosRecibidos != null ? `
                            <div style="background: ${diferencia === 0 ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${diferencia === 0 ? '#bbf7d0' : '#fef3c7'}; padding: 6px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #475569;">Litros Recibidos:</span>
                                    <strong style="color: #0f172a;">${litrosRecibidos.toLocaleString('es-VE')} Lts</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                                    <span style="color: ${diferencia > 0 ? '#b45309' : '#166534'}; font-weight: 600;">Falla / Merma:</span>
                                    <strong style="color: ${diferencia > 0 ? '#dc2626' : '#16a34a'};">${diferencia > 0 ? `-${diferencia}` : (diferencia < 0 ? `+${Math.abs(diferencia)}` : '0')} Lts</strong>
                                </div>
                            </div>
                        ` : ''}
                        <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                            <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalRecibirEnReceptoria(${v.id})" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); border: none; padding: 8px 4px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 2px 6px rgba(2,132,199,0.25); font-size: 11px;">
                                <i class="fa-solid fa-scale-balanced"></i> ${esRecepcionado ? 'Re-medir' : 'Medir'}
                            </button>
                            <button type="button" class="btn btn-sm" onclick="prepararEntregaDirecta(${v.id})" style="font-weight: 700; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; border: none; padding: 8px 4px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 2px 6px rgba(16,185,129,0.25); font-size: 11px;" title="Modificar o añadir destinos/compañías de despacho">
                                <i class="fa-solid fa-building-circle-check"></i> ${v.tipoDestino === 'COMPANIA_DIRECTA' ? 'Despachos' : 'Despachar'}
                            </button>
                            <button type="button" class="btn btn-sm" onclick="abrirModalTraspasoLeche(${v.id})" style="font-weight: 700; background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; padding: 8px 4px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 11px;" title="Traspasar leche a otro chofer">
                                <i class="fa-solid fa-right-left"></i> Traspasar
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Renderizar Salidas (Bandeja 2 - TB_CONTROL_COMPANIAS)
    if (contenedorTransito) {
        if (salidasFiltradas.length === 0) {
            contenedorTransito.innerHTML = `
                <div style="grid-column: 1/-1; padding: 22px; text-align: center; color: #64748b; font-size: 13px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px;">
                    <i class="fa-solid fa-road" style="color: #94a3b8; font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    No hay despachos hacia compañías con los filtros seleccionados.
                </div>
            `;
        } else {
            contenedorTransito.innerHTML = salidasFiltradas.map(d => {
                const stUpper = (d.estado || '').toUpperCase();
                const recibidos = d.litrosRecibidosCompania != null ? Number(d.litrosRecibidosCompania) : null;
                const esFinalizado = stUpper === 'FINALIZADO' || d.procesoActualId === 4 || recibidos != null;
                const esEnVia = stUpper === 'CAMINO A COMPAÑIA' || stUpper === 'CAMINO A COMPAÑÍA' || stUpper === 'EN VIA';

                const badgeColor = esFinalizado ? '#166534' : (esEnVia ? '#7e22ce' : '#0284c7');
                const badgeBg = esFinalizado ? '#dcfce7' : (esEnVia ? '#f3e8ff' : '#e0f2fe');
                const badgeBorder = esFinalizado ? '#bbf7d0' : (esEnVia ? '#e9d5ff' : '#bae6fd');
                const badgeText = esFinalizado ? 'FINALIZADO' : (esEnVia ? 'CAMINO A COMPAÑÍA' : 'DESPACHO');

                const despachados = Number(d.litrosDespachados || 0);
                const falla = d.diferenciaLitros != null ? Number(d.diferenciaLitros) : null;
                const mermaPct = d.porcentajeMerma != null ? Number(d.porcentajeMerma) : null;

                return `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid ${esFinalizado ? '#10b981' : (esEnVia ? '#9333ea' : '#0284c7')}; border-radius: 10px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <strong style="color: #9333ea; font-size: 15px;"><i class="fa-solid fa-file-invoice"></i> Salida #${d.id}</strong>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                ${(state.user && (state.user.rol === 'ADMIN' || state.user.rol === 'SUPERADMIN')) ? `
                                    <button type="button" class="btn btn-sm" onclick="abrirModalEditarTicket('RECEPTORIA', ${d.id})" title="Editar Salida (Admin)" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 7px; font-size: 11px; cursor: pointer;">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm" onclick="eliminarTicketAdmin('RECEPTORIA', ${d.id})" title="Eliminar Salida (Admin)" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 2px 7px; font-size: 11px; cursor: pointer;">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                ` : ''}
                                <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 800; font-size: 11px; border: 1px solid ${badgeBorder}; letter-spacing: 0.04em;">
                                    ${badgeText}
                                </span>
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-regular fa-calendar-days" style="color: #9333ea;"></i>
                            <span>Fecha: <strong style="color: #0f172a;">${formatearFechaTicket(d.fecha)}</strong></span>
                        </div>
                        <div style="font-size: 14px; color: #0f172a; font-weight: 800; margin-bottom: 4px;">
                            <i class="fa-solid fa-user-tie" style="color: #9333ea; margin-right: 6px;"></i>${d.nombreConductor || d.conductorNombre || d.nombreUsuario || (state.choferes || []).find(u => (u.id || u.Id) == (d.usuarioId || d.UsuarioId))?.nombreCompleto || 'Chofer'}
                        </div>
                        <div style="font-size: 12.5px; color: #475569; margin-bottom: 8px;">
                            <i class="fa-solid fa-building-wheat" style="color: #9333ea; margin-right: 6px;"></i>Destino: <strong>${d.nombreCompania || 'Quesera / Planta'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #faf5ff; border: 1px solid #e9d5ff; padding: 8px 10px; border-radius: 6px; margin: 10px 0;">
                            <span style="font-size: 12px; color: #7e22ce; font-weight: 600;">Litros Salida:</span>
                            <strong style="font-size: 16px; color: #9333ea; font-weight: 800;">${despachados.toLocaleString('es-VE')} Lts</strong>
                        </div>
                        ${recibidos != null ? `
                            <div style="background: ${falla === 0 ? '#f0fdf4' : '#fff7ed'}; border: 1px solid ${falla === 0 ? '#bbf7d0' : '#fed7aa'}; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #475569;">Litros en Quesera:</span>
                                    <strong style="color: #0f172a; font-size: 13px;">${recibidos.toLocaleString('es-VE')} Lts</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-top: 3px;">
                                    <span style="color: ${falla > 0 ? '#c2410c' : '#166534'}; font-weight: 700;">Falla / Merma:</span>
                                    <strong style="color: ${falla > 0 ? '#ea580c' : '#16a34a'}; font-weight: 800;">
                                        ${falla > 0 ? `-${falla.toLocaleString('es-VE')} Lts (${mermaPct}%)` : (falla < 0 ? `+${Math.abs(falla).toLocaleString('es-VE')} Lts` : '0 Lts (0%)')}
                                    </strong>
                                </div>
                            </div>
                        ` : ''}
                        <div>
                            ${!esFinalizado ? `
                                <button type="button" class="btn btn-sm btn-primary" onclick="abrirModalValidarEntregaDespacho(${d.id})" style="width: 100%; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 8px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(16,185,129,0.25); color: #fff;">
                                    <i class="fa-solid fa-clipboard-check"></i> Validar Entrega en Quesera
                                </button>
                            ` : `
                                <div style="font-size: 12px; color: #166534; font-weight: 800; text-align: center; padding: 7px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                                    <i class="fa-solid fa-check-double"></i> Entrega Finalizada
                                </div>
                            `}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Actualizar visibilidad del formulario de captura según tickets abiertos
    actualizarVisibilidadFormularioReceptoria();
}
window.aplicarFiltrosBandejaReceptoria = aplicarFiltrosBandejaReceptoria;

// Control Global de Fecha Sincronizada en Receptoría
function onCambiarFechaGlobalReceptoria(nuevaFecha) {
    const fTop = document.getElementById('filtroFechaBandejaReceptoria');
    const fBot = document.getElementById('filtroFechaEntregas');
    const fReg = document.getElementById('inputFechaEntrega');
    if (fTop && fTop.value !== (nuevaFecha || '')) fTop.value = nuevaFecha || '';
    if (fBot && fBot.value !== (nuevaFecha || '')) fBot.value = nuevaFecha || '';
    if (fReg && nuevaFecha) fReg.value = nuevaFecha;
    
    state.forzarMostrarBandejas = false;
    aplicarFiltrosBandejaReceptoria();
    if (typeof cargarEntregasHoy === 'function') {
        cargarEntregasHoy();
    }
}
window.onCambiarFechaGlobalReceptoria = onCambiarFechaGlobalReceptoria;

function filtrarFechaHoyReceptoria() {
    const hoyStr = new Date().toISOString().split('T')[0];
    onCambiarFechaGlobalReceptoria(hoyStr);
}
window.filtrarFechaHoyReceptoria = filtrarFechaHoyReceptoria;

function limpiarFiltroFechaBandejaReceptoria() {
    onCambiarFechaGlobalReceptoria('');
}
window.limpiarFiltroFechaBandejaReceptoria = limpiarFiltroFechaBandejaReceptoria;

function forzarMostrarBandejasReceptoria() {
    state.forzarMostrarBandejas = true;
    aplicarFiltrosBandejaReceptoria();
}
window.forzarMostrarBandejasReceptoria = forzarMostrarBandejasReceptoria;

function conmutarVistaSegmentoReceptoria(segmento) {
    document.querySelectorAll('.btn-segment-receptoria').forEach(b => {
        b.style.background = '#ffffff';
        b.style.color = '#475569';
        b.style.borderColor = '#cbd5e1';
        b.classList.remove('active');
    });

    const activeBtn = document.getElementById(
        segmento === 'TODOS' ? 'btnSegmentoTodo' :
        segmento === 'ENTRADAS' ? 'btnSegmentoEntradas' :
        segmento === 'SALIDAS' ? 'btnSegmentoSalidas' :
        segmento === 'FORM' ? 'btnSegmentoForm' : 'btnSegmentoHistorial'
    );
    if (activeBtn) {
        activeBtn.style.background = '#0284c7';
        activeBtn.style.color = '#ffffff';
        activeBtn.style.borderColor = '#0284c7';
        activeBtn.classList.add('active');
    }

    const selEstado = document.getElementById('filtroEstadoBandejaReceptoria');
    if (segmento === 'TODOS') {
        if (selEstado) selEstado.value = 'TODOS';
        state.forzarMostrarBandejas = false;
        aplicarFiltrosBandejaReceptoria();
    } else if (segmento === 'ENTRADAS') {
        if (selEstado) selEstado.value = 'EN_ESPERA';
        state.forzarMostrarBandejas = true;
        aplicarFiltrosBandejaReceptoria();
    } else if (segmento === 'SALIDAS') {
        if (selEstado) selEstado.value = 'EN_VIA';
        state.forzarMostrarBandejas = true;
        aplicarFiltrosBandejaReceptoria();
    } else if (segmento === 'FORM') {
        const cardForm = document.getElementById('cardRegistroEntregaReceptoria');
        const cuerpoForm = document.getElementById('cuerpoFormularioRegistroEntrega');
        if (cuerpoForm) cuerpoForm.style.display = 'block';
        if (cardForm) cardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (segmento === 'HISTORIAL') {
        const cardHist = document.getElementById('cardHistorialEntregas');
        if (cardHist) cardHist.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.conmutarVistaSegmentoReceptoria = conmutarVistaSegmentoReceptoria;

function toggleFormularioEntregaReceptoria() {
    const cuerpo = document.getElementById('cuerpoFormularioRegistroEntrega');
    const icon = document.getElementById('iconToggleFormularioEntrega');
    const lbl = document.getElementById('lblBtnToggleFormulario');
    if (!cuerpo) return;
    if (cuerpo.style.display === 'none') {
        cuerpo.style.display = 'block';
        if (icon) icon.className = 'fa-solid fa-chevron-up';
        if (lbl) lbl.textContent = 'Ocultar Formulario';
    } else {
        cuerpo.style.display = 'none';
        if (icon) icon.className = 'fa-solid fa-chevron-down';
        if (lbl) lbl.textContent = 'Registrar Entrega';
    }
}
window.toggleFormularioEntregaReceptoria = toggleFormularioEntregaReceptoria;

// 6. CONFIRMAR ENTREGA EN PLANTA (COMPATIBILIDAD CON VISTAS ANTERIORES)
// 6. CONFIRMAR ENTREGA EN DESTINOS (MULTI-DESTINO Y PLANTA)
async function abrirModalEntregaPlanta(ticketId) {
    let viaje = (state.viajesDelDia || state.todosLosViajesReceptoria || []).find(x => x.id === ticketId);
    if (!viaje) {
        try {
            const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) viaje = await res.json();
        } catch (e) {}
    }

    // Buscar si hay despachos asociados en TB_CONTROL_COMPANIAS o entregas registradas
    let despachosAsociados = (state.cacheTicketsViajes?.companias || []).filter(c => (c.controlRutaId || c.ControlRutaId) === ticketId);
    if (!despachosAsociados || despachosAsociados.length === 0) {
        try {
            const resComp = await fetch(`${API_BASE}/control-companias`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (resComp.ok) {
                const allComp = await resComp.json();
                despachosAsociados = (allComp || []).filter(c => (c.controlRutaId || c.ControlRutaId) === ticketId);
            }
        } catch (e) {}
    }

    let entregasViaje = [];
    try {
        const resEnt = await fetch(`${API_BASE}/control-rutas/${ticketId}/entregas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resEnt.ok) entregasViaje = await resEnt.json();
    } catch (e) {}

    const totalLitrosFincas = viaje ? (viaje.totalLitrosFinca || viaje.totalLitrosReceptoria || 0) : 0;
    const fechaStr = viaje?.fecha ? formatearFechaTicket(viaje.fecha) : 'Hoy';
    const choferNombre = viaje?.nombreConductor || state.user?.nombreCompleto || 'Chofer';

    // Lista de destinos a confirmar
    let destinosAConfirmar = [];
    if (despachosAsociados && despachosAsociados.length > 0) {
        destinosAConfirmar = despachosAsociados.map(d => ({
            id: d.id,
            entregaId: 0,
            companiaId: d.companiaId,
            nombreCompania: d.nombreCompania || (state.companias || []).find(c => (c.id || c.Id) === d.companiaId)?.nombre || 'Compañía',
            litrosDespachados: d.litrosDespachados || 0,
            litrosRecibidos: d.litrosRecibidosCompania != null ? d.litrosRecibidosCompania : d.litrosDespachados,
            observacion: d.observacion || ''
        }));
    } else if (entregasViaje && entregasViaje.length > 0) {
        destinosAConfirmar = entregasViaje.map(e => ({
            id: 0,
            entregaId: e.id,
            companiaId: e.companiaId,
            nombreCompania: e.companiaNombre || (state.companias || []).find(c => (c.id || c.Id) === e.companiaId)?.nombre || 'Compañía',
            litrosDespachados: e.litros || 0,
            litrosRecibidos: e.litros || 0,
            observacion: e.observacion || ''
        }));
        const destId = viaje?.companiaDestinoId || 0;
        const destNom = viaje?.nombreCompaniaDestino || (state.companias || []).find(c => (c.id || c.Id) === destId)?.nombre || 'Quesera / Receptoría';
        const ltsRecarga = Number(viaje?.litrosCargadosAdicional || viaje?.LitrosCargadosAdicional || 0);
        const ltsMedidos = Number(viaje?.litrosRecibidosReceptoria != null ? viaje.litrosRecibidosReceptoria : (viaje?.totalLitrosFinca || viaje?.totalLitrosReceptoria || totalLitrosFincas));
        const ltsEsperados = ltsMedidos + ltsRecarga;
        const ltsDesp = (viaje?.litrosEntregadosCompania && viaje.litrosEntregadosCompania > 0 && viaje.litrosEntregadosCompania >= ltsEsperados) ? viaje.litrosEntregadosCompania : (ltsEsperados > 0 ? ltsEsperados : totalLitrosFincas);
        destinosAConfirmar = [{
            id: 0,
            entregaId: 0,
            companiaId: destId,
            nombreCompania: destNom,
            litrosDespachados: ltsDesp,
            litrosRecibidos: ltsDesp,
            observacion: viaje?.observacion || ''
        }];
    }

    const opcionesCompanias = (state.companias || []).map(c => {
        const nombre = (c.nombre || c.Nombre || '').trim();
        const esRecep = nombre.toUpperCase().includes('RECEPTORIA') || nombre.toUpperCase().includes('RECEPTORÍA');
        return {
            value: c.id || c.Id,
            label: nombre.toUpperCase(),
            sub: esRecep ? '🏛️ Centro de Acopio / Receptoría' : '🏭 Quesera / Planta Comercial',
            esRecep: esRecep
        };
    }).sort((a, b) => {
        if (a.esRecep && !b.esRecep) return -1;
        if (!a.esRecep && b.esRecep) return 1;
        return a.label.localeCompare(b.label);
    });

    const filasHtml = destinosAConfirmar.map((d, index) => {
        const rowId = `rowConfDestino_${index}`;
        const esRecep = (d.nombreCompania || '').toUpperCase().includes('RECEPTORIA') || (d.nombreCompania || '').toUpperCase().includes('RECEPTORÍA');
        const badgeIcon = esRecep ? 'fa-warehouse' : 'fa-building';
        const badgeColor = esRecep ? '#7c3aed' : '#059669';
        const badgeBg = esRecep ? '#f5f3ff' : '#ecfdf5';

        return `
            <div class="card-conf-destino-item" data-despacho-id="${d.id}" data-index="${index}" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: ${badgeBg}; color: ${badgeColor}; width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px;">
                            <i class="fa-solid ${badgeIcon}"></i>
                        </span>
                        <strong style="font-size: 14px; color: #0f172a;">Destino ${index + 1}: ${d.nombreCompania}</strong>
                    </div>
                    <span style="font-size: 12px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 20px;">
                        Despachado: <strong style="color: #7c3aed;">${Number(d.litrosDespachados).toLocaleString('es-VE')} Lts</strong>
                    </span>
                </div>

                <!-- SELECTOR DE DESTINO BUSCABLE -->
                <div style="margin-bottom: 10px; position: relative;">
                    <label style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Compañía / Receptoría</label>
                    <div class="searchable-select" id="comboboxConfDestino_${rowId}" style="position: relative;">
                        <input type="hidden" class="hidden-conf-compania-id" id="hiddenConfDestino_${rowId}" value="${d.companiaId}">
                        <div class="combobox-input-wrapper">
                            <input type="text" class="form-input combobox-search" id="searchConfDestino_${rowId}" placeholder="Buscar destino..." autocomplete="off" style="border-radius: 8px; height: 38px; font-size: 13px; font-weight: 600; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a;">
                            <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                        </div>
                        <div class="combobox-dropdown" id="dropdownConfDestino_${rowId}" style="display: none; max-height: 200px; z-index: 99999;"></div>
                    </div>
                </div>

                <!-- LITROS RECIBIDOS Y OBSERVACIÓN -->
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px; align-items: start;">
                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Litros Recibidos *</label>
                        <div style="position: relative;">
                            <input type="number" class="form-input input-conf-litros-recibidos" id="inputLitrosRecibidos_${rowId}" value="${d.litrosRecibidos}" min="1" step="1" data-despachados="${d.litrosDespachados}" style="height: 38px; font-size: 14px; font-weight: 700; color: #059669; text-align: right; padding-right: 36px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff;" required>
                            <span style="position: absolute; right: 10px; top: 10px; font-size: 11px; color: #64748b; font-weight: 800; pointer-events: none;">Lts</span>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Observación / Pesaje</label>
                        <input type="text" class="form-input input-conf-observacion" id="inputObs_${rowId}" value="${d.observacion}" placeholder="Ej: Ticket #5829..." style="height: 38px; font-size: 13px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a;">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const { value: formValues } = await Swal.fire({
        title: `<div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 20px; font-weight: 800; color: #1e1b4b;"><i class="fa-solid fa-clipboard-check" style="color: #7c3aed;"></i> Confirmar Entrega en Destinos</div>`,
        customClass: {
            popup: 'swal2-modal-overflow-visible'
        },
        width: 720,
        html: `
            <div style="text-align: left; font-size: 13px; color: #334155; padding: 2px 4px;">
                <!-- TARJETA INFORMATIVA DEL TICKET -->
                <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1.5px solid #ddd6fe; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.04em; display: block;">Viaje de Ruta #${ticketId}</span>
                        <strong style="font-size: 14px; color: #581c87;">Chofer: ${choferNombre} &bull; Fecha: ${fechaStr}</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Total Fincas</span>
                        <strong style="font-size: 18px; color: #7c3aed;">${Number(totalLitrosFincas).toLocaleString('es-VE')} Lts</strong>
                    </div>
                </div>

                <!-- CONTENEDOR DE DESTINOS -->
                <div id="contenedorDestinosConfirmacion" style="margin-bottom: 14px;">
                    ${filasHtml}
                </div>

                <!-- BALANCE VOLUMÉTRICO LIVE -->
                <div id="boxBalanceConfirmacionLive" style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; padding: 10px 14px; text-align: center; font-size: 13px; margin-bottom: 4px;">
                    <span id="lblBalanceConfMsg" style="font-weight: 700; color: #065f46;">
                        <i class="fa-solid fa-circle-check" style="color: #059669;"></i> Verificando balance de entrega...
                    </span>
                </div>
            </div>
        `,
        didOpen: (popup) => {
            const content = popup.querySelector('.swal2-html-container');
            if (content) content.style.overflow = 'visible';

            // Inicializar comboboxes para cada destino
            destinosAConfirmar.forEach((d, index) => {
                const rowId = `rowConfDestino_${index}`;
                const cb = setupCombobox({
                    containerId: `comboboxConfDestino_${rowId}`,
                    inputSearchId: `searchConfDestino_${rowId}`,
                    inputHiddenId: `hiddenConfDestino_${rowId}`,
                    dropdownId: `dropdownConfDestino_${rowId}`,
                    placeholder: 'Buscar destino...',
                    getItemsFn: () => opcionesCompanias,
                    onSelect: () => recalcularBalanceLive()
                });

                if (d.companiaId && cb) {
                    const found = opcionesCompanias.find(o => o.value == d.companiaId);
                    if (found) cb.setValue(found.value, found.label);
                }
            });

            // Función para recalcular balance en vivo
            const recalcularBalanceLive = () => {
                const inputs = popup.querySelectorAll('.input-conf-litros-recibidos');
                let totalRec = 0;
                let totalDesp = 0;
                inputs.forEach(inp => {
                    totalRec += parseInt(inp.value) || 0;
                    totalDesp += parseInt(inp.getAttribute('data-despachados')) || 0;
                });

                const box = document.getElementById('boxBalanceConfirmacionLive');
                const msg = document.getElementById('lblBalanceConfMsg');
                if (!box || !msg) return;

                const baseTotal = totalDesp > 0 ? totalDesp : totalLitrosFincas;
                const dif = baseTotal - totalRec;

                if (dif === 0) {
                    box.style.background = '#ecfdf5';
                    box.style.border = '1.5px solid #a7f3d0';
                    msg.style.color = '#065f46';
                    msg.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669;"></i> Total Recibido: <strong>${totalRec.toLocaleString('es-VE')} Lts</strong> (0 Lts Diferencia - 100% Cuadrado)`;
                } else if (dif > 0) {
                    box.style.background = '#fffbeb';
                    box.style.border = '1.5px solid #fde68a';
                    msg.style.color = '#92400e';
                    msg.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #d97706;"></i> Total Recibido: <strong>${totalRec.toLocaleString('es-VE')} Lts</strong> (Faltan ${dif.toLocaleString('es-VE')} Lts respecto a despachado)`;
                } else {
                    box.style.background = '#eff6ff';
                    box.style.border = '1.5px solid #bfdbfe';
                    msg.style.color = '#1e40af';
                    msg.innerHTML = `<i class="fa-solid fa-circle-plus" style="color: #2563eb;"></i> Total Recibido: <strong>${totalRec.toLocaleString('es-VE')} Lts</strong> (+${Math.abs(dif).toLocaleString('es-VE')} Lts Excedente a favor)`;
                }
            };

            popup.querySelectorAll('.input-conf-litros-recibidos').forEach(inp => {
                inp.addEventListener('input', recalcularBalanceLive);
            });

            recalcularBalanceLive();
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check"></i> Confirmar Entrega en Destinos',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
            const items = [];
            const rows = document.querySelectorAll('.card-conf-destino-item');
            for (const r of rows) {
                const despachoId = parseInt(r.getAttribute('data-despacho-id')) || 0;
                const compId = parseInt(r.querySelector('.hidden-conf-compania-id')?.value) || 0;
                const lts = parseInt(r.querySelector('.input-conf-litros-recibidos')?.value) || 0;
                const obs = r.querySelector('.input-conf-observacion')?.value || '';

                if (!compId) {
                    Swal.showValidationMessage('Selecciona la compañía o receptoría para cada destino.');
                    return false;
                }
                if (lts <= 0) {
                    Swal.showValidationMessage('Los litros recibidos deben ser mayores a 0.');
                    return false;
                }

                items.push({ despachoId, companiaId: compId, litrosRecibidos: lts, observacion: obs });
            }
            return items;
        }
    });

    if (!formValues) return;

    try {
        const totalRecibido = formValues.reduce((acc, curr) => acc + (parseInt(curr.litrosRecibidos) || 0), 0);

        // Confirmar cada destino en TB_CONTROL_COMPANIAS o registrar entregas
        for (const item of formValues) {
            if (item.despachoId > 0) {
                // Actualizar ticket en TB_CONTROL_COMPANIAS
                await fetch(`${API_BASE}/control-companias/${item.despachoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                    body: JSON.stringify({
                        companiaId: item.companiaId,
                        litrosRecibidosCompania: item.litrosRecibidos,
                        estado: 'FINALIZADO',
                        observacion: item.observacion
                    })
                });
            }
        }

        // Actualizar el total consolidado recibido en el viaje de ruta
        await fetch(`${API_BASE}/control-rutas/${ticketId}/entregar-planta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify({
                litrosEntregados: totalRecibido,
                observacion: `Entrega confirmada en ${formValues.length} destino(s). Total Recibido: ${totalRecibido.toLocaleString('es-VE')} Lts`
            })
        });

        // Finalizar la ruta contablemente
        try {
            await fetch(`${API_BASE}/control-rutas/${ticketId}/finalizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                body: JSON.stringify({ observacion: `Cierre con ${totalRecibido.toLocaleString('es-VE')} Lts recibidos en destinos.` })
            });
        } catch (e) {}

        Swal.fire({
            icon: 'success',
            title: '¡Entrega Confirmada Exitosamente!',
            text: `Se verificaron y confirmaron los ${formValues.length} destino(s) de la ruta.`,
            timer: 2400,
            showConfirmButton: false
        });

        await cargarViajesRutasDelDia();
        await cargarBandejaReceptoria();
        if (typeof cargarControlViajesTickets === 'function') await cargarControlViajesTickets();
        if (typeof refrescarVistasGlobales === 'function') await refrescarVistasGlobales();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.abrirModalEntregaPlanta = abrirModalEntregaPlanta;
window.abrirModalEntregaPlanta = abrirModalEntregaPlanta;

// 7. FUNCIÓN PARA CAMBIAR ESTADO DE TICKET DIRECTAMENTE
async function cambiarEstadoTicketDirecto(ticketId, nuevoEstado) {
    const confirm = await Swal.fire({
        title: `¿Cambiar estado a ${nuevoEstado}?`,
        text: `¿Deseas actualizar el estado del Ticket #${ticketId} a ${nuevoEstado}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `<i class="fa-solid fa-check"></i> Sí, cambiar a ${nuevoEstado}`,
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#64748b'
    });

    if (!confirm.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al actualizar estado' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        showToast(`Ticket #${ticketId} actualizado a ${nuevoEstado}`);
        await cargarBandejaReceptoria();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#ffffff', color: '#0f172a' });
    }
}
window.cambiarEstadoTicketDirecto = cambiarEstadoTicketDirecto;

// Alias para abrir modal de recepción y medición
window.abrirModalMedirReceptoria = function(ticketId) {
    if (typeof abrirModalRecibirEnReceptoria === 'function') {
        abrirModalRecibirEnReceptoria(ticketId);
    }
};

function irAReceptoriaParaTicket(ticketId) {
    irAPestana('receptoria');
    setTimeout(() => {
        cargarBandejaReceptoria();
        const v = (state.viajesDelDia || state.todosLosViajesReceptoria || []).find(x => x.id === ticketId);
        if (v && v.procesoActualId === 2) {
            abrirModalMedirReceptoria(ticketId);
        } else if (v && v.procesoActualId === 3) {
            abrirModalEntregaPlanta(ticketId);
        }
    }, 150);
}
window.irAReceptoriaParaTicket = irAReceptoriaParaTicket;
