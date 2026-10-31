// ==========================================================================
// MÓDULO RUTAS: CARGA MASIVA Y RECONOCIMIENTO POR IMAGEN (OCR / GEMINI VISION)
// ==========================================================================

let comboboxMasivoConductorInstance = window.comboboxMasivoConductorInstance || null;
let masivoRowCounter = window.masivoRowCounter || 0;

async function abrirModalRutasMasivo() {
    if (state.user && state.user.rol === 'CHOFER' && stateViajes.viajeActivo && stateViajes.viajeActivo.procesoActualId > 1) {
        Swal.fire({
            icon: 'warning',
            title: 'Ticket en Receptoría / Cerrado',
            text: `Tu Ticket #${stateViajes.viajeActivo.id} ya fue enviado a Receptoría o cerrado. No puedes agregar más recolecciones.`,
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    if (!state.choferes || state.choferes.length === 0 || !state.fincas || state.fincas.length === 0) {
        await cargarCatalogos();
    }

    // 1. Detectar si estamos posicionados en un ticket activo / abierto
    const ticketIdActivo = state.ticketAsignadoActivo || state.filtroTicketId || stateViajes.viajeActivo?.id;
    let viaje = null;
    if (ticketIdActivo) {
        viaje = (state.viajesDelDia || state.todosLosViajesReceptoria || state.cacheTicketsViajes?.todos || []).find(v => (v.id || v.Id) == ticketIdActivo) ||
                (state.rutas || []).find(r => (r.controlRutaId || r.ControlRutaId) == ticketIdActivo);
    }

    const fechaTicket = viaje?.fecha ? viaje.fecha.split('T')[0] : (state.rutasFechaFiltro || document.getElementById('filtroFechaRutas')?.value || new Date().toISOString().split('T')[0]);
    
    let conductorId = viaje?.usuarioId || viaje?.conductorId;
    let conductorNombre = viaje?.nombreConductor || viaje?.conductorNombre || '';

    if (!conductorId && conductorNombre) {
        const condObj = (state.choferes || []).find(c => {
            const nom = (c.nombreCompleto || c.NombreCompleto || c.username || c.Username || '').toLowerCase();
            return nom === conductorNombre.toLowerCase();
        });
        if (condObj) conductorId = condObj.id || condObj.Id;
    }

    if (!conductorId && state.user && state.user.rol === 'CHOFER') {
        conductorId = state.user.id;
        conductorNombre = state.user.nombreCompleto || state.user.username;
    } else if (!conductorId && state.user && state.user.rol === 'ADMIN') {
        const filterChoferVal = document.getElementById('filterChoferVal')?.value;
        if (filterChoferVal) {
            const condObj = (state.choferes || []).find(c => {
                const nom = (c.nombreCompleto || c.NombreCompleto || c.username || c.Username || '').toLowerCase();
                return nom === filterChoferVal.toLowerCase();
            });
            if (condObj) {
                conductorId = condObj.id || condObj.Id;
                conductorNombre = condObj.nombreCompleto || condObj.username;
            }
        }
    }

    // 2. Sincronizar Banner del Ticket en el Modal
    const lblTicket = document.getElementById('lblTicketAsignadoMasivo');
    const sublblTicket = document.getElementById('sublblTicketAsignadoMasivo');
    if (ticketIdActivo) {
        state.ticketAsignadoActivo = ticketIdActivo;
        if (lblTicket) {
            lblTicket.innerText = `Ticket #${ticketIdActivo}`;
            lblTicket.style.background = '#2563eb';
        }
        if (sublblTicket) {
            sublblTicket.innerHTML = `Asociando fincas a este viaje <strong>(${conductorNombre || 'Conductor'})</strong>`;
        }
    } else {
        if (lblTicket) {
            lblTicket.innerText = 'Auto-Apertura de Ticket';
            lblTicket.style.background = '#64748b';
        }
        if (sublblTicket) {
            sublblTicket.innerText = 'Las fincas escaneadas o agregadas se vincularán automáticamente a este viaje.';
        }
    }

    // 3. Sincronizar Fecha de Recolección
    const inputFecha = document.getElementById('inputMasivoFecha');
    if (inputFecha) {
        inputFecha.value = fechaTicket;
    }

    // 4. Inicializar y preseleccionar Conductor
    const searchConductorInput = document.getElementById('searchMasivoConductorInput');
    const selectConductorHidden = document.getElementById('selectMasivoConductor');

    if (searchConductorInput && selectConductorHidden) {
        if (!comboboxMasivoConductorInstance) {
            comboboxMasivoConductorInstance = setupCombobox({
                containerId: 'comboboxMasivoConductor',
                inputSearchId: 'searchMasivoConductorInput',
                inputHiddenId: 'selectMasivoConductor',
                dropdownId: 'dropdownMasivoConductorList',
                placeholder: 'SELECCIONE CONDUCTOR...',
                getItemsFn: () => (state.choferes || []).map(c => {
                    const cId = c.id || c.Id;
                    const cNombre = c.nombreCompleto || c.NombreCompleto || c.username || c.Username || `Conductor #${cId}`;
                    return {
                        value: cId,
                        label: capitalizarTexto(cNombre),
                        sub: c.vehiculoPlaca ? `Vehículo: ${c.vehiculoPlaca}` : `Cédula: ${c.cedula || 'N/A'}`
                    };
                }),
                onSelect: () => {
                    recalcularTotalLitrosMasivo();
                    setTimeout(() => {
                        const firstFincaInput = document.querySelector('#tbodyRutasMasivo tr:first-child .masivo-finca-search');
                        if (firstFincaInput) {
                            firstFincaInput.focus();
                        }
                    }, 50);
                }
            });
            window.comboboxMasivoConductorInstance = comboboxMasivoConductorInstance;
        }

        if (state.user && state.user.rol === 'CHOFER') {
            comboboxMasivoConductorInstance.selectItem(state.user.id, state.user.nombreCompleto || state.user.username);
            searchConductorInput.disabled = true;
            searchConductorInput.style.opacity = '0.85';
            searchConductorInput.style.cursor = 'not-allowed';
        } else if (ticketIdActivo) {
            // Fijo y Bloqueado según el Ticket Activo
            if (conductorId && conductorNombre) {
                comboboxMasivoConductorInstance.selectItem(conductorId, capitalizarTexto(conductorNombre));
            } else if (conductorId) {
                const condObj = (state.choferes || []).find(c => (c.id || c.Id) == conductorId);
                comboboxMasivoConductorInstance.selectItem(conductorId, condObj ? capitalizarTexto(condObj.nombreCompleto || condObj.username) : `Conductor #${conductorId}`);
            }
            searchConductorInput.disabled = true;
            searchConductorInput.style.opacity = '0.85';
            searchConductorInput.style.cursor = 'not-allowed';
            searchConductorInput.title = `Conductor fijo según Ticket Activo #${ticketIdActivo}`;
        } else {
            searchConductorInput.disabled = false;
            searchConductorInput.style.opacity = '1';
            searchConductorInput.style.cursor = '';
            searchConductorInput.title = '';
            if (conductorId && conductorNombre) {
                comboboxMasivoConductorInstance.selectItem(conductorId, capitalizarTexto(conductorNombre));
            } else if (conductorId) {
                const condObj = (state.choferes || []).find(c => (c.id || c.Id) == conductorId);
                comboboxMasivoConductorInstance.selectItem(conductorId, condObj ? capitalizarTexto(condObj.nombreCompleto || condObj.username) : `Conductor #${conductorId}`);
            } else {
                comboboxMasivoConductorInstance.reset();
            }
        }
    }

    if (inputFecha) {
        if (ticketIdActivo) {
            inputFecha.disabled = true;
            inputFecha.style.cursor = 'not-allowed';
            inputFecha.style.opacity = '0.85';
            inputFecha.title = `Fecha fija según Ticket Activo #${ticketIdActivo}`;
        } else {
            inputFecha.disabled = false;
            inputFecha.style.cursor = '';
            inputFecha.style.opacity = '1';
            inputFecha.title = '';
        }
    }

    const alertaOcr = document.getElementById('alertaVerificacionOcr');
    if (alertaOcr) alertaOcr.style.display = 'none';

    const inputFile = document.getElementById('inputFileOcrMasivo');
    if (inputFile) inputFile.value = '';

    limpiarTablaMasivaRuta();
    abrirModalCustom('modalRutasMasivo');

    setTimeout(() => {
        const firstFincaSearch = document.querySelector('#tbodyRutasMasivo tr:first-child .masivo-finca-search');
        if (firstFincaSearch) {
            firstFincaSearch.focus();
        }
    }, 250);
}
window.abrirModalRutasMasivo = abrirModalRutasMasivo;

function agregarFilaMasivaRuta(fincaIdSugerida = '', litrosSugeridos = '', observacionSugerida = '', autoFocus = false, esAcidaSugerida = false) {
    const tbody = document.getElementById('tbodyRutasMasivo');
    if (!tbody) return;

    masivoRowCounter++;
    window.masivoRowCounter = masivoRowCounter;
    const rowId = masivoRowCounter;

    let fincaNombreInicial = '';
    let fincaIdInicial = '';

    if (fincaIdSugerida) {
        const matchedFinca = (state.fincas || []).find(f => 
            f.id == fincaIdSugerida || 
            (f.nombre && String(f.nombre).toLowerCase().includes(String(fincaIdSugerida).toLowerCase())) ||
            (f.propietario && String(f.propietario).toLowerCase().includes(String(fincaIdSugerida).toLowerCase()))
        );
        if (matchedFinca) {
            fincaIdInicial = matchedFinca.id;
            fincaNombreInicial = `${matchedFinca.nombre} (${matchedFinca.propietario})`;
        } else {
            fincaNombreInicial = fincaIdSugerida;
        }
    }

    const isFincaNoIdentificada = (!fincaIdInicial && fincaNombreInicial);
    const borderStyle = isFincaNoIdentificada ? 'border: 2px solid #f59e0b; background: #fffbeb; color: #b45309; font-weight: 700;' : 'border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a;';

    const isAcidaInitial = Boolean(esAcidaSugerida) || 
        (observacionSugerida && String(observacionSugerida).toLowerCase().includes('acid')) || 
        (fincaIdSugerida && String(fincaIdSugerida).toLowerCase().includes('acid'));

    const isBufalaInitial = (fincaNombreInicial && (fincaNombreInicial.toUpperCase().includes('BUFAL') || fincaNombreInicial.toUpperCase().includes('TARITA'))) || 
        (observacionSugerida && (String(observacionSugerida).toUpperCase().includes('BUFAL') || String(observacionSugerida).toUpperCase().includes('TARITA')));

    const matchedFincaInicial = fincaIdInicial ? (state.fincas || []).find(f => (f.id || f.Id) == fincaIdInicial) : null;
    const esDualInicial = !!(matchedFincaInicial?.tieneDosTiposLeche || matchedFincaInicial?.TieneDosTiposLeche);

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #e2e8f0';
    tr.id = `rowMasivo_${rowId}`;
    tr.innerHTML = `
        <td style="padding: 10px 12px; position: relative;">
            <div class="searchable-select masivo-finca-combobox" id="comboboxMasivoFinca_${rowId}">
                <input type="hidden" class="masivo-finca-hidden" id="inputMasivoFincaHidden_${rowId}" value="${fincaIdInicial}">
                <div class="combobox-input-wrapper">
                    <input type="text" class="form-input combobox-search masivo-finca-search" id="inputMasivoFincaSearch_${rowId}" placeholder="SELECCIONE FINCA / GANADERO..." autocomplete="off" value="${fincaNombreInicial}" style="height: 38px; font-size: 13px; font-weight: 600; width: 100%; border-radius: 8px; ${borderStyle}">
                    <i class="fa-solid fa-chevron-down combobox-chevron"></i>
                </div>
                <div class="combobox-dropdown" id="dropdownMasivoFinca_${rowId}" style="display: none;"></div>
            </div>
            ${isFincaNoIdentificada ? `<div class="finca-alert-badge" id="alertBadge_${rowId}" style="font-size: 11px; color: #d97706; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> Finca no registrada (Verificar)</div>` : `<div class="finca-alert-badge" id="alertBadge_${rowId}" style="display: none;"></div>`}
        </td>
        <td style="padding: 10px 10px; text-align: center;">
            <select class="masivo-tipo-select form-input" id="selectMasivoTipo_${rowId}" style="height: 38px; background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; font-size: 12.5px; font-weight: 700; border-radius: 8px; width: 100%; text-align: center; cursor: pointer; display: ${esDualInicial ? 'block' : 'none'};">
                <option value="VACA" ${!isBufalaInitial ? 'selected' : ''}>🐄 Vaca</option>
                <option value="BUFALA" ${isBufalaInitial ? 'selected' : ''}>🐃 Búfala</option>
            </select>
        </td>
        <td style="padding: 10px 10px;">
            <input type="number" class="masivo-litros-input form-input" step="1" value="${litrosSugeridos}" placeholder="Litros" oninput="if(this.value && Number(this.value) < 0){ this.style.color = '#ef4444'; } else { this.style.color = '#0f172a'; }; recalcularTotalLitrosMasivo();" style="height: 38px; background: #ffffff; color: ${Number(litrosSugeridos) < 0 ? '#ef4444' : '#0f172a'}; border: 1.5px solid #cbd5e1; font-size: 14px; font-weight: 800; text-align: right; border-radius: 8px; width: 100%;">
        </td>
        <td style="padding: 10px 8px; text-align: center;">
            <label style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 6px; transition: all 0.2s; border: 1.5px solid ${isAcidaInitial ? '#f87171' : '#cbd5e1'}; background: ${isAcidaInitial ? '#fef2f2' : '#f8fafc'}; color: ${isAcidaInitial ? '#dc2626' : '#64748b'};" class="masivo-acida-chip-wrap">
                <input type="checkbox" class="masivo-acida-check" ${isAcidaInitial ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: #ef4444;" onchange="this.parentElement.style.borderColor = this.checked ? '#f87171' : '#cbd5e1'; this.parentElement.style.background = this.checked ? '#fef2f2' : '#f8fafc'; this.parentElement.style.color = this.checked ? '#dc2626' : '#64748b';"> Ácida
            </label>
        </td>
        <td style="padding: 10px 10px;">
            <input type="text" class="masivo-obs-input form-input" value="${observacionSugerida}" placeholder="Comentarios..." style="height: 38px; background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; font-size: 12.5px; border-radius: 8px; width: 100%;">
        </td>
        <td style="padding: 10px 8px; text-align: center;">
            <button type="button" class="btn btn-sm" onclick="eliminarFilaMasivaRuta(this)" title="Quitar fila" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; width: 36px; height: 38px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    setupCombobox({
        containerId: `comboboxMasivoFinca_${rowId}`,
        inputSearchId: `inputMasivoFincaSearch_${rowId}`,
        inputHiddenId: `inputMasivoFincaHidden_${rowId}`,
        dropdownId: `dropdownMasivoFinca_${rowId}`,
        placeholder: 'SELECCIONE FINCA...',
        getItemsFn: () => (state.fincas || [])
            .filter(f => f.activo !== false && f.Activo !== false)
            .map(f => {
                const esChofer = state.user && state.user.rol === 'CHOFER';
                return {
                    value: f.id,
                    label: f.nombre,
                    sub: esChofer ? `Propietario: ${f.propietario || '-'}` : `Propietario: ${f.propietario} | USD/L: $${f.precioLitroUSD || 0}`
                };
            }),
        onSelect: async (item) => {
            const searchInputEl = document.getElementById(`inputMasivoFincaSearch_${rowId}`);
            const alertBadgeEl = document.getElementById(`alertBadge_${rowId}`);
            if (searchInputEl) {
                searchInputEl.style.border = '1.5px solid #cbd5e1';
                searchInputEl.style.background = '#ffffff';
                searchInputEl.style.color = '#0f172a';
            }
            if (alertBadgeEl) {
                alertBadgeEl.style.display = 'none';
            }
            const hiddenEl = document.getElementById(`inputMasivoFincaHidden_${rowId}`);
            const selectedFincaId = hiddenEl ? hiddenEl.value : (item ? item.value : null);

            // Verificación: ¿Esta finca ya fue recogida hoy por otro chofer o en otro ticket?
            if (selectedFincaId) {
                const fechaActual = document.getElementById('inputMasivoFecha')?.value || state.rutasFechaFiltro || new Date().toISOString().split('T')[0];
                const recoleccionesPrevias = (state.rutas || []).filter(r => 
                    Number(r.fincaId || r.FincaId) === Number(selectedFincaId) && 
                    (r.fecha ? r.fecha.split('T')[0] === fechaActual : true) &&
                    (Number(r.litros || 0) > 0)
                );

                if (recoleccionesPrevias.length > 0) {
                    const previa = recoleccionesPrevias[0];
                    const choferPrevio = previa.conductorNombre || 'otro chofer';
                    const litrosPrevios = Number(previa.litros || 0).toLocaleString('es-VE');
                    const ticketPrevio = previa.controlRutaId || previa.ControlRutaId ? `Ticket #${previa.controlRutaId || previa.ControlRutaId}` : 'otro viaje';

                    const conf = await Swal.fire({
                        icon: 'info',
                        title: 'Finca Ya Recolectada Hoy',
                        html: `
                            <div style="text-align: left; font-size: 13.5px; line-height: 1.6; color: #f8fafc;">
                                El chofer <strong style="color: #38bdf8;">${choferPrevio}</strong> ya registró una recolección de 
                                <strong style="color: #34d399;">${litrosPrevios} Litros</strong> para esta finca el día de hoy (${ticketPrevio}).
                                <br><br>
                                <span style="color: #fbbf24; font-size: 12.5px;">
                                    <i class="fa-solid fa-circle-info"></i> Recuerde que algunas fincas ordeñan 2 veces al día. 
                                    ¿Desea confirmar y agregar un segundo ticket/recolección para esta finca?
                                </span>
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: '<i class="fa-solid fa-check"></i> Sí, Recoger / Agregar',
                        cancelButtonText: '<i class="fa-solid fa-xmark"></i> Cancelar',
                        confirmButtonColor: '#0284c7',
                        cancelButtonColor: '#64748b',
                        background: '#1e293b',
                        color: '#f8fafc'
                    });

                    if (!conf.isConfirmed) {
                        // Limpiar selección de esta fila
                        if (hiddenEl) hiddenEl.value = '';
                        if (searchInputEl) searchInputEl.value = '';
                        return;
                    }
                }
            }

            const tipoSelect = tr.querySelector('.masivo-tipo-select');
            if (tipoSelect && hiddenEl) {
                const matchedF = (state.fincas || []).find(f => (f.id || f.Id) == hiddenEl.value);
                const esDual = !!(matchedF?.tieneDosTiposLeche || matchedF?.TieneDosTiposLeche);
                const nomUpper = (matchedF?.nombre || matchedF?.Nombre || '').toUpperCase();
                const searchUpper = (searchInputEl?.value || '').toUpperCase();

                if (esDual) {
                    tipoSelect.style.display = 'block';
                } else {
                    tipoSelect.style.display = 'none';
                    tipoSelect.value = 'VACA';
                }
            }
            recalcularTotalLitrosMasivo();
            const inputLitros = tr.querySelector('.masivo-litros-input');
            if (inputLitros) {
                setTimeout(() => {
                    inputLitros.focus();
                    inputLitros.select();
                }, 50);
            }
        }
    });

    const searchInput = tr.querySelector('.masivo-finca-search');
    const inputLitros = tr.querySelector('.masivo-litros-input');
    const inputObs = tr.querySelector('.masivo-obs-input');

    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && e.shiftKey) {
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const currentIndex = rows.indexOf(tr);
                if (currentIndex > 0) {
                    e.preventDefault();
                    const prevRow = rows[currentIndex - 1];
                    const prevObsInput = prevRow.querySelector('.masivo-obs-input');
                    if (prevObsInput) {
                        prevObsInput.focus();
                    }
                }
            }
        });
    }

    if (inputLitros) {
        inputLitros.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (inputObs) inputObs.focus();
            }
        });
    }

    if (inputObs) {
        inputObs.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && e.shiftKey) {
                // Permitir retroceso natural a Litros cuando se presiona Shift + Tab
                return;
            }
            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const isLastRow = (rows[rows.length - 1] === tr);

                if (isLastRow) {
                    e.preventDefault();
                    agregarFilaMasivaRuta('', '', '', true);
                } else {
                    const currentIndex = rows.indexOf(tr);
                    if (currentIndex >= 0 && currentIndex < rows.length - 1) {
                        const nextRow = rows[currentIndex + 1];
                        const nextSearchInput = nextRow.querySelector('.masivo-finca-search');
                        if (nextSearchInput) {
                            e.preventDefault();
                            nextSearchInput.focus();
                        }
                    }
                }
            }
        });
    }

    recalcularTotalLitrosMasivo();

    if (autoFocus) {
        const searchInput = document.getElementById(`inputMasivoFincaSearch_${rowId}`);
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 60);
        }
    }
}
window.agregarFilaMasivaRuta = agregarFilaMasivaRuta;

function eliminarFilaMasivaRuta(btn) {
    const tr = btn.closest('tr');
    if (tr) {
        tr.remove();
        recalcularTotalLitrosMasivo();
    }
    const tbody = document.getElementById('tbodyRutasMasivo');
    if (tbody && tbody.children.length === 0) {
        agregarFilaMasivaRuta();
    }
}
window.eliminarFilaMasivaRuta = eliminarFilaMasivaRuta;

function recalcularTotalLitrosMasivo() {
    const inputsLitros = document.querySelectorAll('.masivo-litros-input');
    let total = 0;
    let cant = 0;

    inputsLitros.forEach(input => {
        const val = parseInt(input.value) || 0;
        if (val !== 0) {
            total += val;
        }
        cant++;
    });

    const lblTotal = document.getElementById('lblTotalLitrosMasivo');
    if (lblTotal) {
        lblTotal.innerText = `${total.toLocaleString('es-VE')} L`;
        lblTotal.style.color = total < 0 ? '#ef4444' : '#10b981';
    }

    const lblCant = document.getElementById('lblCantFilasMasivas');
    if (lblCant) lblCant.innerText = `${cant}`;
}
window.recalcularTotalLitrosMasivo = recalcularTotalLitrosMasivo;

function limpiarTablaMasivaRuta() {
    const tbody = document.getElementById('tbodyRutasMasivo');
    if (tbody) tbody.innerHTML = '';

    const alertaOcr = document.getElementById('alertaVerificacionOcr');
    if (alertaOcr) alertaOcr.style.display = 'none';

    agregarFilaMasivaRuta();
}
window.limpiarTablaMasivaRuta = limpiarTablaMasivaRuta;

// --- FUNCIONES DE CÁMARA WEBCAM EMBEBIDA PARA REGISTRO MASIVO (OCR) ---
let currentMediaStream = null;
let currentFacingMode = 'user'; // 'user' por defecto para compatibilidad inmediata con laptops y webcams

async function iniciarCamaraLiveMasiva() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Swal.fire({
            icon: 'error',
            title: 'Cámara No Soportada',
            text: 'Tu navegador no permite el acceso a la cámara o el sitio no se está ejecutando en una conexión segura (HTTPS/Localhost). Puedes usar el botón "Subir Archivo de Imagen".',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    const initialSt = document.getElementById('ocrInitialState');
    const cameraSt = document.getElementById('ocrCameraState');
    const statusMsg = document.getElementById('webcamStatusMsg');
    const btnCambiar = document.getElementById('btnCambiarCamara');

    if (initialSt) initialSt.style.display = 'none';
    if (cameraSt) cameraSt.style.display = 'block';
    if (statusMsg) statusMsg.style.display = 'flex';

    try {
        await iniciarStreamCamara();

        // Verificar si hay más de una cámara para mostrar el botón de cambiar
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (btnCambiar) {
            btnCambiar.style.display = videoDevices.length > 1 ? 'inline-flex' : 'none';
        }
    } catch (err) {
        if (statusMsg) statusMsg.style.display = 'none';
        detenerCamaraLiveMasiva();

        let detailMsg = err.message || 'Verifica los permisos del navegador.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            detailMsg = 'Permiso de cámara bloqueado. Haz clic en el ícono del candado o cámara en la barra de direcciones de tu navegador y selecciona "Permitir".';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.name === 'OverconstrainedError') {
            detailMsg = 'No se detectó una cámara web disponible en tu equipo. Puedes usar el botón "Subir Archivo de Imagen" para procesar la foto.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            detailMsg = 'La cámara está siendo ocupada por otra aplicación (Zoom, Teams, Skype, etc.). Ciérrala e intenta nuevamente.';
        }

        Swal.fire({
            icon: 'warning',
            title: 'Acceso a la Cámara',
            html: `
                <div style="font-size: 13.5px; line-height: 1.5; color: #cbd5e1; text-align: left; margin-top: 8px;">
                    <p style="margin-bottom: 8px;">${detailMsg}</p>
                    <div style="background: rgba(30,41,59,0.8); border: 1px solid #475569; border-radius: 8px; padding: 10px; font-size: 12px; color: #94a3b8;">
                        💡 <strong>Alternativa rápida:</strong> También puedes tomar la foto con tu teléfono y subirla con el botón <strong>"Subir Archivo de Imagen"</strong>.
                    </div>
                </div>
            `,
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'Entendido'
        });
    }
}
window.iniciarCamaraLiveMasiva = iniciarCamaraLiveMasiva;
window.abrirCamaraModal = iniciarCamaraLiveMasiva;

async function iniciarStreamCamara() {
    if (currentMediaStream) {
        try {
            currentMediaStream.getTracks().forEach(track => track.stop());
        } catch (e) {}
        currentMediaStream = null;
    }

    const videoEl = document.getElementById('webcamPreview');
    const statusMsg = document.getElementById('webcamStatusMsg');

    if (statusMsg) statusMsg.style.display = 'flex';

    // Priorizar acceso directo rápido sin restricciones complejas que puedan bloquearse en laptops
    const constraintList = [
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: currentFacingMode } },
        { video: true },
        { video: { facingMode: 'user' } },
        { video: { facingMode: 'environment' } }
    ];

    let stream = null;
    let lastErr = null;

    for (const c of constraintList) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(c);
            if (stream) break;
        } catch (e) {
            lastErr = e;
        }
    }

    if (!stream) {
        throw lastErr || new Error('No se pudo acceder a ninguna cámara disponible.');
    }

    currentMediaStream = stream;

    if (videoEl) {
        videoEl.muted = true;
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('autoplay', '');
        videoEl.setAttribute('muted', '');
        videoEl.setAttribute('playsinline', '');

        videoEl.srcObject = currentMediaStream;

        const hideLoading = () => {
            if (statusMsg) statusMsg.style.display = 'none';
        };

        videoEl.onloadedmetadata = hideLoading;
        videoEl.onloadeddata = hideLoading;
        videoEl.oncanplay = hideLoading;
        videoEl.onplay = hideLoading;

        try {
            await videoEl.play();
            hideLoading();
        } catch (pErr) {
            console.warn('Video play resolved with warning:', pErr);
            hideLoading();
        }

        // Temporizador de seguridad máximo de 1.2s para forzar visualización si el stream está activo
        setTimeout(() => {
            if (currentMediaStream && currentMediaStream.active) {
                hideLoading();
            }
        }, 1200);
    }
}

async function cambiarCamara() {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    const statusMsg = document.getElementById('webcamStatusMsg');
    if (statusMsg) statusMsg.style.display = 'flex';
    await iniciarStreamCamara();
}
window.cambiarCamara = cambiarCamara;

function detenerCamaraLiveMasiva() {
    if (currentMediaStream) {
        currentMediaStream.getTracks().forEach(track => track.stop());
        currentMediaStream = null;
    }
    const videoEl = document.getElementById('webcamPreview');
    if (videoEl) videoEl.srcObject = null;

    const initialSt = document.getElementById('ocrInitialState');
    const cameraSt = document.getElementById('ocrCameraState');
    if (cameraSt) cameraSt.style.display = 'none';
    if (initialSt) initialSt.style.display = 'block';
}
window.detenerCamaraLiveMasiva = detenerCamaraLiveMasiva;
window.cerrarCamaraModal = detenerCamaraLiveMasiva;

function capturarFotoCamara() {
    const videoEl = document.getElementById('webcamPreview');
    const canvasEl = document.getElementById('webcamCanvas');
    if (!videoEl || !canvasEl || !currentMediaStream) {
        showToast('La cámara no está activa.', 'warning');
        return;
    }

    const width = videoEl.videoWidth > 0 ? videoEl.videoWidth : 1280;
    const height = videoEl.videoHeight > 0 ? videoEl.videoHeight : 720;
    canvasEl.width = width;
    canvasEl.height = height;

    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, width, height);

    const base64Image = canvasEl.toDataURL('image/jpeg', 0.95);
    detenerCamaraLiveMasiva();
    enviarBase64AOcr(base64Image);
}
window.capturarFotoCamara = capturarFotoCamara;

async function procesarFotoOcrPlanilla(event) {
    const inputEl = event.target;
    const file = (inputEl && inputEl.files && inputEl.files[0]) ? inputEl.files[0] : null;
    if (!file) return;
    if (inputEl) inputEl.value = '';

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Image = e.target.result;
        await enviarBase64AOcr(base64Image);
    };
    reader.readAsDataURL(file);
}
window.procesarFotoOcrPlanilla = procesarFotoOcrPlanilla;

async function enviarBase64AOcr(base64Image) {
    if (!base64Image) return;

    const initialSt = document.getElementById('ocrInitialState');
    const loadingSt = document.getElementById('ocrLoadingState');
    const alertaOcr = document.getElementById('alertaVerificacionOcr');
    const alertaTxt = document.getElementById('alertaVerificacionOcrTexto');

    if (initialSt) initialSt.style.display = 'none';
    if (loadingSt) loadingSt.style.display = 'block';
    if (alertaOcr) alertaOcr.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/rutas/ocr-imagen`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ imagenBase64: base64Image })
        });

        if (loadingSt) loadingSt.style.display = 'none';
        if (initialSt) initialSt.style.display = 'block';

        if (res.ok) {
            const data = await res.json();
            const items = data.items || [];

            if (items.length > 0) {
                const tbody = document.getElementById('tbodyRutasMasivo');
                if (tbody) tbody.innerHTML = '';
                masivoRowCounter = 0;

                items.forEach(it => {
                    const isAcida = Boolean(it.esAcida) || (it.observacion && String(it.observacion).toLowerCase().includes('acid')) || (it.fincaNombreDetectado && String(it.fincaNombreDetectado).toLowerCase().includes('acid'));
                    agregarFilaMasivaRuta(it.fincaId || it.fincaNombreDetectado, it.litros, it.observacion, false, isAcida);
                });

                if (alertaOcr && alertaTxt) {
                    alertaTxt.innerText = data.mensaje || `Se leyeron ${items.length} registros de la foto. Por favor, verifica y edita cualquier dato en la tabla a continuación antes de guardar.`;
                    alertaOcr.style.display = 'flex';
                }

                showToast(`Se extrajeron ${items.length} registros de la foto con IA.`, 'success');
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sin datos detectados',
                    text: data.mensaje || 'No se pudieron extraer fincas o litros legibles de la foto. Asegúrate de enfocar bien la planilla con buena luz o agrega las fincas manualmente.',
                    background: '#1e293b',
                    color: '#fff'
                });
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || 'Error al procesar la imagen con IA.', 'error');
        }
    } catch (err) {
        if (loadingSt) loadingSt.style.display = 'none';
        if (initialSt) initialSt.style.display = 'block';
        showToast(err.message || 'Error al leer la foto.', 'error');
    }
}
window.enviarBase64AOcr = enviarBase64AOcr;
window.procesarArchivoImagenOcr = enviarBase64AOcr;

async function guardarRutasMasivoSubmit() {
    if (state.user && state.user.rol === 'CHOFER' && stateViajes.viajeActivo && stateViajes.viajeActivo.procesoActualId > 1) {
        Swal.fire({
            icon: 'warning',
            title: 'Acción No Permitida',
            text: 'Tu ticket ya se encuentra en estado RECIBIDO o superior. No puedes registrar más recolecciones.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    const inputFecha = document.getElementById('inputMasivoFecha');
    const selectConductorHidden = document.getElementById('selectMasivoConductor');
    const searchConductorInput = document.getElementById('searchMasivoConductorInput');
    const btnGuardar = document.getElementById('btnGuardarMasivoRutas');

    let fecha = inputFecha ? inputFecha.value : null;
    if (!fecha) {
        fecha = state.rutasFechaFiltro || document.getElementById('filtroFechaGlobalRutas')?.value || document.getElementById('filtroFechaRutas')?.value || new Date().toISOString().split('T')[0];
        if (inputFecha) inputFecha.value = fecha;
    }

    let conductorId = selectConductorHidden ? parseInt(selectConductorHidden.value) : 0;
    if (isNaN(conductorId)) conductorId = 0;

    // Resolver conductor de múltiples fuentes si no está en el hidden
    if (conductorId <= 0 && state.ticketAsignadoActivo) {
        const viaje = (state.viajesDelDia || state.todosLosViajesReceptoria || state.cacheTicketsViajes?.todos || []).find(v => (v.id || v.Id) == state.ticketAsignadoActivo) ||
                      (state.rutas || []).find(r => (r.controlRutaId || r.ControlRutaId) == state.ticketAsignadoActivo);
        if (viaje) {
            conductorId = viaje.usuarioId || viaje.conductorId || 0;
        }
    }

    if (conductorId <= 0 && state.user && state.user.rol === 'CHOFER') {
        conductorId = state.user.id;
    }

    if (conductorId <= 0 && searchConductorInput && searchConductorInput.value.trim().length > 0) {
        const textCond = searchConductorInput.value.trim().toLowerCase();
        const matchedCond = (state.choferes || []).find(c => {
            const nombre = (c.nombreCompleto || c.NombreCompleto || c.username || c.Username || '').toLowerCase();
            return nombre.includes(textCond) || textCond.includes(nombre);
        });
        if (matchedCond) {
            conductorId = matchedCond.id || matchedCond.Id;
        }
    }

    if (conductorId > 0 && selectConductorHidden) {
        selectConductorHidden.value = conductorId;
    }

    if (inputFecha) inputFecha.style.border = '';
    if (searchConductorInput) searchConductorInput.style.border = '';

    if (!fecha) {
        if (inputFecha) inputFecha.style.border = '2px solid #ef4444';
        Swal.fire({ icon: 'warning', title: 'Fecha Requerida', text: 'Por favor selecciona la fecha de recolección.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (!conductorId || conductorId <= 0) {
        if (searchConductorInput) {
            searchConductorInput.style.border = '2px solid #ef4444';
            searchConductorInput.focus();
        }
        Swal.fire({ icon: 'warning', title: 'Conductor Requerido', text: 'Por favor selecciona el conductor a cargo.', background: '#1e293b', color: '#fff' });
        return;
    }

    const rows = document.querySelectorAll('#tbodyRutasMasivo tr');
    const items = [];
    let hayErroresLitros = false;
    let hayErroresFincaVacia = false;
    const fincasNuevasDetectadas = [];

    rows.forEach(tr => {
        const inputFincaHidden = tr.querySelector('.masivo-finca-hidden');
        const inputFincaSearch = tr.querySelector('.masivo-finca-search');
        const inputLitros = tr.querySelector('.masivo-litros-input');
        const checkAcida = tr.querySelector('.masivo-acida-check');
        const tipoSelect = tr.querySelector('.masivo-tipo-select');
        const inputObs = tr.querySelector('.masivo-obs-input');

        const rawFincaId = inputFincaHidden ? parseInt(inputFincaHidden.value) : 0;
        let fincaId = isNaN(rawFincaId) ? 0 : rawFincaId;
        const nombreFincaSearch = inputFincaSearch ? inputFincaSearch.value.trim() : '';
        const rawLitros = inputLitros ? parseInt(inputLitros.value) : 0;
        const litros = isNaN(rawLitros) ? 0 : rawLitros;
        const esAcida = checkAcida ? checkAcida.checked : false;
        const tipoLeche = tipoSelect ? tipoSelect.value : 'VACA';
        let observacion = inputObs ? inputObs.value.replace(/\[BUFALA\]/gi, '').replace(/\[VACA\]/gi, '').trim() : '';

        if (fincaId > 0 || nombreFincaSearch.length > 0 || litros !== 0) {
            if (litros === 0) {
                hayErroresLitros = true;
            }

            if (fincaId <= 0 && nombreFincaSearch.length > 0) {
                const matchedFinca = (state.fincas || []).find(f => {
                    const fNombre = (f.nombre || f.Nombre || '').toLowerCase().trim();
                    const fProp = (f.propietario || f.Propietario || '').toLowerCase().trim();
                    const q = nombreFincaSearch.toLowerCase().trim();
                    return fNombre.includes(q) || q.includes(fNombre) || (fProp && fProp.includes(q));
                });

                if (matchedFinca) {
                    fincaId = matchedFinca.id || matchedFinca.Id;
                    if (inputFincaHidden) inputFincaHidden.value = fincaId;
                }
            }

            if (fincaId <= 0 && nombreFincaSearch.length === 0) {
                hayErroresFincaVacia = true;
            }

            let nombreFincaNuevo = null;
            if (fincaId <= 0 && nombreFincaSearch.length > 0) {
                nombreFincaNuevo = nombreFincaSearch;
                if (!fincasNuevasDetectadas.includes(nombreFincaSearch)) {
                    fincasNuevasDetectadas.push(nombreFincaSearch);
                }
            }

            items.push({
                fincaId: fincaId > 0 ? fincaId : 0,
                nombreFincaNuevo: nombreFincaNuevo,
                litros: litros,
                esAcida: esAcida,
                tipoLeche: tipoLeche,
                observacion: observacion
            });
        }
    });

    if (items.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin Registros', text: 'Debes completar al menos una finca con sus litros recolectados.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (hayErroresFincaVacia) {
        Swal.fire({ icon: 'warning', title: 'Finca Faltante', text: 'Hay filas con litros indicados pero sin finca seleccionada ni escrita.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (hayErroresLitros) {
        Swal.fire({ icon: 'warning', title: 'Litros Requeridos', text: 'Todas las fincas agregadas deben tener una cantidad de litros diferente de 0.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (fincasNuevasDetectadas.length > 0) {
        const listaNombres = fincasNuevasDetectadas.map(n => `• <b>${n}</b>`).join('<br>');
        const confirmRes = await Swal.fire({
            title: '¿Registrar Nuevas Fincas?',
            html: `Se detectaron las siguientes fincas no registradas en el catálogo:<br><br>${listaNombres}<br><br>¿Deseas dar de alta automáticamente estas fincas en la base de datos (tabla <b>TB_FINCAS</b>) y guardar sus registros en <b>TB_RUTAS_RECOLECCION</b>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar y guardar',
            cancelButtonText: 'Cancelar',
            background: '#1e293b',
            color: '#fff',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b'
        });

        if (!confirmRes.isConfirmed) {
            return;
        }
    }

    const originalHtml = btnGuardar ? btnGuardar.innerHTML : '';
    if (btnGuardar) {
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando Registros...';
        btnGuardar.disabled = true;
    }

    try {
        const payload = {
            fecha: fecha,
            conductorId: conductorId,
            controlRutaId: state.ticketAsignadoActivo || null,
            items: items
        };

        const res = await fetch(`${API_BASE}/rutas/masivo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            cerrarModalCustom('modalRutasMasivo');
            showToast(data.message || `Se guardaron ${items.length} recolecciones correctamente.`, 'success');

            if (typeof cargarCatalogos === 'function') {
                await cargarCatalogos();
            }
            await cargarRutasHoy(fecha);
            if (typeof cargarViajesRutasDelDia === 'function') {
                await cargarViajesRutasDelDia(fecha);
            }
            if (typeof refrescarVistasGlobales === 'function') {
                await refrescarVistasGlobales();
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al guardar el lote de recolecciones.');
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btnGuardar) {
            btnGuardar.innerHTML = originalHtml;
            btnGuardar.disabled = false;
        }
    }
}
window.guardarRutasMasivoSubmit = guardarRutasMasivoSubmit;

// --------------------------------------------------------------------------
// MÓDULO RECEPTORÍA: CONTROL DE ENTREGAS EN COMPAÑÍAS / PLANTAS
// --------------------------------------------------------------------------



async function cargarEntregasHoy() {
    initEntregasFormComboboxes();
    const inputFecha = document.getElementById('filtroFechaEntregas');
    const inputFechaRegistro = document.getElementById('inputFechaEntrega');
    const hoyStr = new Date().toISOString().split('T')[0];

    if (inputFecha && !inputFecha.value) {
        inputFecha.value = hoyStr;
    }
    if (inputFechaRegistro && !inputFechaRegistro.value) {
        inputFechaRegistro.value = hoyStr;
    }

    const fechaConsulta = inputFecha ? (inputFecha.value || hoyStr) : hoyStr;

    // Adaptar formulario según rol
    const formGroupChofer = document.getElementById('formGroupEntregaConductor');
    const searchChoferInput = document.getElementById('searchEntregaConductorInput');
    const selectChofer = document.getElementById('selectEntregaConductor');
    if (state.user && state.user.rol === 'CHOFER') {
        if (formGroupChofer) formGroupChofer.style.display = 'none';
        if (selectChofer) selectChofer.value = state.user.id;
        if (searchChoferInput) {
            searchChoferInput.value = state.user.nombreCompleto || state.user.username;
            searchChoferInput.disabled = true;
        }
    } else {
        if (formGroupChofer) formGroupChofer.style.display = 'block';
    }

    try {
        const [resEntregas, resRutas] = await Promise.all([
            fetch(`${API_BASE}/receptoria/hoy?fecha=${fechaConsulta}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            }),
            fetch(`${API_BASE}/rutas/hoy?fecha=${fechaConsulta}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            })
        ]);

        if (resEntregas.ok) {
            state.entregas = await resEntregas.json();
        }
        if (resRutas.ok) {
            state.rutas = await resRutas.json();
        }
        renderTablaEntregas();
    } catch (err) {
        console.warn('Error al cargar entregas/rutas de receptoría:', err);
    }
}
function onCambiarFechaFiltroEntregas() {
    const inputFecha = document.getElementById('filtroFechaEntregas');
    if (inputFecha && inputFecha.value) {
        cargarEntregasHoy();
    }
}
window.onCambiarFechaFiltroEntregas = onCambiarFechaFiltroEntregas;

function initFiltrosEntregasComboboxes() {
    if (!comboboxFiltroEntregaChoferInstance && document.getElementById('comboboxFiltroEntregaChofer')) {
        comboboxFiltroEntregaChoferInstance = setupCombobox({
            containerId: 'comboboxFiltroEntregaChofer',
            inputSearchId: 'searchFiltroEntregaChoferInput',
            inputHiddenId: 'filterEntregaChoferVal',
            dropdownId: 'dropdownFiltroEntregaChoferList',
            placeholder: 'TODOS LOS CHOFERES',
            getItemsFn: () => {
                const list = [{ value: '', label: 'TODOS LOS CHOFERES', sub: '' }];
                const rawEntregas = state.entregas || [];
                const choferesMap = new Map();

                rawEntregas.forEach(e => {
                    const cNombre = (e.conductorNombre || '').trim();
                    if (cNombre && !choferesMap.has(cNombre.toLowerCase())) {
                        choferesMap.set(cNombre.toLowerCase(), {
                            value: cNombre,
                            label: capitalizarTexto(cNombre),
                            sub: ''
                        });
                    }
                });

                return list.concat(Array.from(choferesMap.values()).sort((a, b) => a.label.localeCompare(b.label)));
            },
            onSelect: () => {
                if (state.datatableEntregas) state.datatableEntregas.currentPage = 1;
                renderTablaEntregas();
            }
        });
    }

    if (!comboboxFiltroEntregaCompaniaInstance && document.getElementById('comboboxFiltroEntregaCompania')) {
        comboboxFiltroEntregaCompaniaInstance = setupCombobox({
            containerId: 'comboboxFiltroEntregaCompania',
            inputSearchId: 'searchFiltroEntregaCompaniaInput',
            inputHiddenId: 'filterEntregaCompaniaVal',
            dropdownId: 'dropdownFiltroEntregaCompaniaList',
            placeholder: 'TODAS LAS COMPAÑÍAS',
            getItemsFn: () => {
                const list = [{ value: '', label: 'TODAS LAS COMPAÑÍAS', sub: '' }];
                const rawEntregas = state.entregas || [];
                const compMap = new Map();

                rawEntregas.forEach(e => {
                    const cpNombre = (e.companiaNombre || '').trim();
                    if (cpNombre && !compMap.has(cpNombre.toLowerCase())) {
                        compMap.set(cpNombre.toLowerCase(), {
                            value: cpNombre,
                            label: capitalizarTexto(cpNombre),
                            sub: e.encargado ? `Planta: ${capitalizarTexto(e.encargado)}` : ''
                        });
                    }
                });

                return list.concat(Array.from(compMap.values()).sort((a, b) => a.label.localeCompare(b.label)));
            },
            onSelect: () => {
                if (state.datatableEntregas) state.datatableEntregas.currentPage = 1;
                renderTablaEntregas();
            }
        });
    }
}
window.initFiltrosEntregasComboboxes = initFiltrosEntregasComboboxes;

function limpiarFiltrosEntregas() {
    if (comboboxFiltroEntregaChoferInstance) comboboxFiltroEntregaChoferInstance.selectItem('', '');
    if (comboboxFiltroEntregaCompaniaInstance) comboboxFiltroEntregaCompaniaInstance.selectItem('', '');
    const inChofer = document.getElementById('searchFiltroEntregaChoferInput');
    const inComp = document.getElementById('searchFiltroEntregaCompaniaInput');
    if (inChofer) inChofer.value = '';
    if (inComp) inComp.value = '';
    const hidChofer = document.getElementById('filterEntregaChoferVal');
    const hidComp = document.getElementById('filterEntregaCompaniaVal');
    if (hidChofer) hidChofer.value = '';
    if (hidComp) hidComp.value = '';

    const inSearch = document.getElementById('buscarEnTablaEntregas');
    if (inSearch) inSearch.value = '';
    if (state.datatableEntregas) {
        state.datatableEntregas.search = '';
        state.datatableEntregas.currentPage = 1;
    }
    renderTablaEntregas();
}
window.limpiarFiltrosEntregas = limpiarFiltrosEntregas;

function onPageSizeChangeEntregas(val) {
    if (!state.datatableEntregas) state.datatableEntregas = { search: '', currentPage: 1, pageSize: 10, sortColumn: 'fecha', sortDirection: 'desc' };
    state.datatableEntregas.pageSize = parseInt(val) || 10;
    state.datatableEntregas.currentPage = 1;
    renderTablaEntregas();
}
window.onPageSizeChangeEntregas = onPageSizeChangeEntregas;

function onSearchTableEntregas(val) {
    if (!state.datatableEntregas) state.datatableEntregas = { search: '', currentPage: 1, pageSize: 10, sortColumn: 'fecha', sortDirection: 'desc' };
    state.datatableEntregas.search = (val || '').toLowerCase().trim();
    state.datatableEntregas.currentPage = 1;
    renderTablaEntregas();
}
window.onSearchTableEntregas = onSearchTableEntregas;

function sortTableEntregas(col) {
    if (!state.datatableEntregas) state.datatableEntregas = { search: '', currentPage: 1, pageSize: 10, sortColumn: 'fecha', sortDirection: 'desc' };
    if (state.datatableEntregas.sortColumn === col) {
        state.datatableEntregas.sortDirection = state.datatableEntregas.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.datatableEntregas.sortColumn = col;
        state.datatableEntregas.sortDirection = 'asc';
    }
    renderTablaEntregas();
}
window.sortTableEntregas = sortTableEntregas;

function normalizarFechaYYYYMMDD(fechaStr) {
    if (!fechaStr) return '';
    let str = fechaStr.toString().trim();
    if (str.includes('T')) str = str.split('T')[0];
    if (str.includes(' ')) str = str.split(' ')[0];
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            const p0 = parts[0].padStart(2, '0');
            const p1 = parts[1].padStart(2, '0');
            const p2 = parts[2];
            if (p2.length === 4) return `${p2}-${p1}-${p0}`;
            if (p0.length === 4) return `${p0}-${p1}-${p2}`;
        }
    }
    return str;
}

async function actualizarBalanceReceptoria() {
    const elFecha = document.getElementById('filtroFechaEntregas');
    const fechaVal = elFecha ? elFecha.value : null;
    const normFechaVal = normalizarFechaYYYYMMDD(fechaVal);

    if (!state.rutas || state.rutas.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/rutas`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) {
                state.rutas = await res.json();
            }
        } catch (e) { console.warn('Error al cargar rutas para balance:', e); }
    }

    const rawChofer = (document.getElementById('filterEntregaChoferVal')?.value || document.getElementById('searchFiltroEntregaChoferInput')?.value || '').toLowerCase().trim();
    const filterChofer = (rawChofer === 'todos los choferes') ? '' : rawChofer;

    const rawComp = (document.getElementById('filterEntregaCompaniaVal')?.value || document.getElementById('searchFiltroEntregaCompaniaInput')?.value || '').toLowerCase().trim();
    const filterComp = (rawComp === 'todas las compañías' || rawComp === 'todas las companias') ? '' : rawComp;

    // Filtrar rutas por fecha normalizada y chofer
    let rutasDia = (state.rutas || []);
    if (normFechaVal) {
        rutasDia = rutasDia.filter(r => {
            const rFecha = normalizarFechaYYYYMMDD(r.fecha || r.Fecha);
            return rFecha === normFechaVal;
        });
    }
    if (filterChofer) {
        rutasDia = rutasDia.filter(r => (r.conductorNombre || r.conductor || '').toLowerCase().includes(filterChofer));
    }

    let totalLitrosRuta = 0;
    rutasDia.forEach(r => { totalLitrosRuta += Number(r.litros || r.Litros || 0); });

    // Filtrar entregas por fecha normalizada, chofer y compania
    let entregasDia = (state.entregas || []);
    if (normFechaVal) {
        entregasDia = entregasDia.filter(e => {
            const eFecha = normalizarFechaYYYYMMDD(e.fecha || e.Fecha);
            return eFecha === normFechaVal;
        });
    }
    if (filterChofer) {
        entregasDia = entregasDia.filter(e => (e.conductorNombre || '').toLowerCase().includes(filterChofer));
    }
    if (filterComp) {
        entregasDia = entregasDia.filter(e => (e.companiaNombre || '').toLowerCase().includes(filterComp));
    }

    let totalLitrosReceptoria = 0;
    entregasDia.forEach(e => { totalLitrosReceptoria += Number(e.litros || e.Litros || 0); });

    const diferencia = totalLitrosReceptoria - totalLitrosRuta;
    const falla = -diferencia;
    const pctMermaTotal = totalLitrosRuta > 0 ? (Math.abs(diferencia) / totalLitrosRuta) * 100 : 0;
    const semaforoBalanceBadge = typeof renderSemaforoMerma === 'function'
        ? renderSemaforoMerma(pctMermaTotal, falla)
        : '';

    // Actualizar indicador de Diferencia en el encabezado superior con semáforo
    const kpiHeaderDif = document.getElementById('kpiDiferenciaReceptoriaHeader');
    const kpiSemaforoEl = document.getElementById('kpiSemaforoReceptoriaHeader');
    if (kpiHeaderDif) {
        const parentSpan = kpiHeaderDif.parentElement;
        if (diferencia === 0) {
            if (parentSpan) parentSpan.style.display = 'inline-flex';
            kpiHeaderDif.innerText = '0 Lts';
            kpiHeaderDif.style.color = '#34d399';
            if (kpiSemaforoEl) kpiSemaforoEl.innerHTML = semaforoBalanceBadge;
        } else {
            if (parentSpan) parentSpan.style.display = 'inline-flex';
            kpiHeaderDif.innerText = `${diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-VE')} Lts`;
            kpiHeaderDif.style.color = diferencia < 0 ? '#f87171' : '#60a5fa';
            if (kpiSemaforoEl) kpiSemaforoEl.innerHTML = semaforoBalanceBadge;
        }
    }

    const lblRuta = document.getElementById('lblBalanceLitrosRuta');
    const lblRec = document.getElementById('lblBalanceLitrosReceptoria');
    const lblDif = document.getElementById('lblBalanceDiferenciaLitros');
    const badgeDiag = document.getElementById('badgeDiagnosticoBalance');

    if (lblRuta) lblRuta.innerText = `${totalLitrosRuta.toLocaleString('es-VE')} Lts`;
    if (lblRec) lblRec.innerText = `${totalLitrosReceptoria.toLocaleString('es-VE')} Lts`;
    if (lblDif) {
        lblDif.innerText = `${diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-VE')} Lts`;
        lblDif.style.color = diferencia < 0 ? '#f87171' : (diferencia > 0 ? '#60a5fa' : '#34d399');
    }

    if (badgeDiag) {
        if (diferencia === 0) {
            badgeDiag.style.background = 'rgba(16, 185, 129, 0.15)';
            badgeDiag.style.borderColor = '#10b981';
            badgeDiag.style.color = '#34d399';
            badgeDiag.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size: 15px;"></i> <span id="lblDiagnosticoTexto">CUADRE PERFECTO</span> ${semaforoBalanceBadge}`;
        } else if (diferencia < 0) {
            badgeDiag.style.background = 'rgba(239, 68, 68, 0.2)';
            badgeDiag.style.borderColor = '#ef4444';
            badgeDiag.style.color = '#f87171';
            badgeDiag.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 15px;"></i> <span id="lblDiagnosticoTexto">FALLA / FALTANTE: ${diferencia.toLocaleString('es-VE')} Lts</span> ${semaforoBalanceBadge}`;
        } else {
            badgeDiag.style.background = 'rgba(59, 130, 246, 0.2)';
            badgeDiag.style.borderColor = '#3b82f6';
            badgeDiag.style.color = '#60a5fa';
            badgeDiag.innerHTML = `<i class="fa-solid fa-circle-plus" style="font-size: 15px;"></i> <span id="lblDiagnosticoTexto">SOBRA / EXCEDENTE: +${diferencia.toLocaleString('es-VE')} Lts</span> ${semaforoBalanceBadge}`;
        }
    }
}
window.actualizarBalanceReceptoria = actualizarBalanceReceptoria;

function obtenerTipoRegistroEntrega(e) {
    if (!e) return {};
    const compNom = (e.companiaNombre || '').toUpperCase();
    const obs = (e.observacion || '').toUpperCase();
    const tipoDest = (e.tipoDestino || '').toUpperCase();
    const numLitros = Number(e.litros || e.Litros || 0);

    let ticketId = e.controlRutaId || e.ControlRutaId || null;
    let ctrlCompId = null;

    // Detectar si el texto de observación tiene el número de ticket o viaje
    if (!ticketId && e.observacion) {
        const matchViaje = e.observacion.match(/Viaje\s*#?(\d+)/i) || e.observacion.match(/Ticket\s*#?(\d+)/i);
        if (matchViaje) {
            ticketId = parseInt(matchViaje[1], 10);
        }
    }

    if (e.observacion) {
        const matchCtrl = e.observacion.match(/Control\s*Compañ[íi]as\s*#?(\d+)/i) || e.observacion.match(/Ctrl\s*#?(\d+)/i);
        if (matchCtrl) {
            ctrlCompId = parseInt(matchCtrl[1], 10);
        }
    }

    const ltsTraspaso = Number(e.litrosCargadosAdicional || e.LitrosCargadosAdicional || 0);
    const esTraspaso = ltsTraspaso > 0 || obs.includes('TRASPASO');

    // 1. Salida de Receptoría (Descarga / Salida de Tanque / Faltante)
    if (((compNom.includes('RECEPTORIA') || compNom.includes('RECEPTORÍA')) && numLitros < 0) || obs.includes('SALIDA DESDE RECEPTORÍA') || obs.includes('SALIDA DESDE RECEPTORIA')) {
        return {
            tipo: 'SALIDA_RECEPTORIA',
            label: 'Salida Receptoría',
            subLabel: 'Descarga de Tanque',
            icono: 'fa-solid fa-arrow-up-from-bracket',
            badgeBg: '#fff7ed',
            badgeColor: '#c2410c',
            badgeBorder: '#fed7aa',
            rowBg: 'rgba(255, 247, 237, 0.65)',
            borderLeft: '#ea580c',
            titleColor: '#c2410c',
            litrosColor: '#dc2626',
            ticketId,
            ctrlCompId,
            ltsTraspaso,
            esTraspaso,
            ordenProceso: 5
        };
    }

    // 2. Ingreso / Entrada de Leche a Receptoría (Recepción de Ruta de Campo)
    if ((compNom.includes('RECEPTORIA') || compNom.includes('RECEPTORÍA')) && numLitros >= 0) {
        return {
            tipo: 'INGRESO_RECEPTORIA',
            label: 'Ingreso Receptoría',
            subLabel: 'Recepción en Tanque',
            icono: 'fa-solid fa-warehouse',
            badgeBg: '#f0f9ff',
            badgeColor: '#0284c7',
            badgeBorder: '#bae6fd',
            rowBg: 'rgba(240, 249, 255, 0.65)',
            borderLeft: '#0284c7',
            titleColor: '#0369a1',
            litrosColor: '#0284c7',
            ticketId,
            ctrlCompId,
            ltsTraspaso,
            esTraspaso,
            ordenProceso: 1
        };
    }

    // 3. Proceso Mixto / Escala: Finca ➔ Receptoría ➔ Compañía (Tránsito y Recarga de Tanques)
    const matchDesglose = (e.observacion || '').match(/([\d.,]+)\s*Lts\s*Finca\s*\+\s*([\d.,]+)\s*Lts\s*Receptor/i);
    const esProcesoMixto = Boolean(
        matchDesglose ||
        tipoDest.includes('RECEPTORIA_Y_COMPANIA') ||
        (obs.includes('FINCA') && (obs.includes('RECEPTOR') || obs.includes('TANQUE'))) ||
        (e.totalLitrosOrigen && numLitros > e.totalLitrosOrigen && !compNom.includes('RECEPTORIA'))
    );

    if (esProcesoMixto && !compNom.includes('RECEPTORIA')) {
        let ltsFincaEntrada = Number(e.totalLitrosOrigen || 0);
        let ltsRecargaTanque = 0;

        if (matchDesglose) {
            ltsFincaEntrada = parseFloat(matchDesglose[1].replace(/\./g, '').replace(',', '.')) || ltsFincaEntrada;
            ltsRecargaTanque = parseFloat(matchDesglose[2].replace(/\./g, '').replace(',', '.')) || 0;
        } else if (e.totalLitrosOrigen && numLitros > e.totalLitrosOrigen) {
            ltsRecargaTanque = numLitros - e.totalLitrosOrigen;
        }

        return {
            tipo: 'FINCA_RECEPTORIA_COMPANIA',
            label: 'Finca ➔ Receptoría ➔ Planta',
            subLabel: 'Tránsito Tanques Receptoría',
            icono: 'fa-solid fa-arrows-split-up-and-left',
            badgeBg: '#fdf4ff',
            badgeColor: '#a21caf',
            badgeBorder: '#f0abfc',
            rowBg: 'rgba(253, 244, 255, 0.7)',
            borderLeft: '#d946ef',
            titleColor: '#86198f',
            litrosColor: '#9333ea',
            ticketId,
            ctrlCompId,
            esMixto: true,
            ltsFincaEntrada,
            ltsRecargaTanque,
            ltsTotalEntrega: numLitros,
            ltsTraspaso,
            esTraspaso,
            ordenProceso: 3
        };
    }

    // 4. Directo de Finca a Compañías (Ruta de Campo Directa a Planta)
    const esDirecto = tipoDest.includes('COMPANIA_DIRECTA') || 
                      obs.includes('DIRECTO') || 
                      obs.includes('RUTA DE CAMPO') || 
                      obs.includes('ENTREGA EN PLANTA DESDE VIAJE') ||
                      (e.controlRutaId != null && !obs.includes('CONTROL COMPAÑÍAS') && !obs.includes('CONTROL COMPANIAS') && !obs.includes('DESPACHADO DESDE RECEPTOR'));

    if (esDirecto) {
        return {
            tipo: 'DIRECTO_FINCA_COMPANIA',
            label: 'Directo Finca ➔ Planta',
            subLabel: 'Ruta Directa',
            icono: 'fa-solid fa-route',
            badgeBg: '#ecfdf5',
            badgeColor: '#059669',
            badgeBorder: '#a7f3d0',
            rowBg: 'rgba(236, 253, 245, 0.65)',
            borderLeft: '#10b981',
            titleColor: '#047857',
            litrosColor: '#059669',
            ticketId,
            ctrlCompId,
            ltsTraspaso,
            esTraspaso,
            ordenProceso: 2
        };
    }

    // 5. Llegada / Entrega a Compañía (Despachado desde Receptoría a Planta)
    return {
        tipo: 'LLEGADA_COMPANIA',
        label: 'Llegada a Planta',
        subLabel: 'Recepción en Compañía',
        icono: 'fa-solid fa-building-circle-check',
        badgeBg: '#faf5ff',
        badgeColor: '#7c3aed',
        badgeBorder: '#ddd6fe',
        rowBg: 'rgba(250, 245, 255, 0.65)',
        borderLeft: '#9333ea',
        titleColor: '#6d28d9',
        litrosColor: '#7c3aed',
        ticketId,
        ctrlCompId,
        ltsTraspaso,
        esTraspaso,
        ordenProceso: 4
    };
}
window.obtenerTipoRegistroEntrega = obtenerTipoRegistroEntrega;

function obtenerOrdenProcesoDestino(e) {
    const meta = obtenerTipoRegistroEntrega(e);
    return (meta && meta.ordenProceso) ? meta.ordenProceso : 99;
}
window.obtenerOrdenProcesoDestino = obtenerOrdenProcesoDestino;

function renderTablaEntregas() {
    initFiltrosEntregasComboboxes();
    actualizarBalanceReceptoria();
    const tbody = document.getElementById('tbodyEntregasHoy') || document.getElementById('tbodyReceptoria');
    if (!tbody) return;

    let rawItems = state.entregas || [];

    // Calcular total del día completo
    let totalDiaLts = 0;
    rawItems.forEach(e => { totalDiaLts += Number(e.litros || e.Litros || 0); });
    const kpiHeader = document.getElementById('kpiLitrosEntregasHeader');
    if (kpiHeader) {
        kpiHeader.innerText = totalDiaLts.toLocaleString('es-VE');
        kpiHeader.style.color = totalDiaLts < 0 ? '#fca5a5' : '#fde047';
        kpiHeader.style.fontWeight = '800';
        kpiHeader.style.fontSize = '15px';
    }

    let items = rawItems.slice();

    // Filtro por Chofer
    const rawChofer = (document.getElementById('filterEntregaChoferVal')?.value || document.getElementById('searchFiltroEntregaChoferInput')?.value || '').toLowerCase().trim();
    const filterChofer = (rawChofer === 'todos los choferes') ? '' : rawChofer;
    if (filterChofer) {
        items = items.filter(e => (e.conductorNombre || '').toLowerCase().includes(filterChofer));
    }

    // Filtro por Compañía
    const rawComp = (document.getElementById('filterEntregaCompaniaVal')?.value || document.getElementById('searchFiltroEntregaCompaniaInput')?.value || '').toLowerCase().trim();
    const filterComp = (rawComp === 'todas las compañías' || rawComp === 'todas las companias') ? '' : rawComp;
    if (filterComp) {
        items = items.filter(e => (e.companiaNombre || '').toLowerCase().includes(filterComp));
    }

    // Filtro de Búsqueda de Texto
    const dt = state.datatableEntregas || { search: '', currentPage: 1, pageSize: 10, sortColumn: 'fecha', sortDirection: 'desc' };
    const searchVal = dt.search || (document.getElementById('buscarEnTablaEntregas')?.value || '').toLowerCase().trim();
    if (searchVal) {
        items = items.filter(e => 
            (e.companiaNombre || '').toLowerCase().includes(searchVal) ||
            (e.encargado || '').toLowerCase().includes(searchVal) ||
            (e.conductorNombre || '').toLowerCase().includes(searchVal) ||
            (e.observacion || '').toLowerCase().includes(searchVal) ||
            (e.controlRutaId?.toString() || '').includes(searchVal) ||
            (e.litros?.toString() || '').includes(searchVal) ||
            (e.fecha || '').includes(searchVal)
        );
    }

    // Calcular total filtrado
    let totalFiltradoLts = 0;
    items.forEach(e => { totalFiltradoLts += Number(e.litros || e.Litros || 0); });

    const badgeTotalFiltrado = document.getElementById('badgeTotalFiltradoEntregas');
    const lblTotalFiltrado = document.getElementById('lblTotalLitrosFiltradoEntregas');
    if (badgeTotalFiltrado && lblTotalFiltrado) {
        if (filterChofer || filterComp || searchVal) {
            badgeTotalFiltrado.style.display = 'inline-block';
            lblTotalFiltrado.innerText = `${totalFiltradoLts.toLocaleString('es-VE')}`;
        } else {
            badgeTotalFiltrado.style.display = 'none';
        }
    }

    const lblConteo = document.getElementById('lblConteoEntregasTabla');
    if (lblConteo) {
        lblConteo.innerText = `${items.length} ${items.length === 1 ? 'entrega encontrada' : 'entregas encontradas'}`;
    }

    const btnLimpiar = document.getElementById('btnLimpiarFiltrosEntregas');
    if (btnLimpiar) {
        btnLimpiar.style.display = (filterChofer || filterComp || searchVal) ? 'inline-flex' : 'none';
    }

    // Ordenamiento estructurado por PROCESO OPERATIVO (Finca -> Receptoría -> Compañía)
    items.sort((a, b) => {
        const col = dt.sortColumn || 'fecha';
        const asc = dt.sortDirection === 'asc';

        if (col === 'compania' || col === 'destino' || col === 'proceso') {
            const ordenA = obtenerOrdenProcesoDestino(a);
            const ordenB = obtenerOrdenProcesoDestino(b);
            if (ordenA !== ordenB) {
                return asc ? (ordenA - ordenB) : (ordenB - ordenA);
            }
            const nomA = (a.companiaNombre || '').toLowerCase();
            const nomB = (b.companiaNombre || '').toLowerCase();
            if (nomA !== nomB) return asc ? nomA.localeCompare(nomB) : nomB.localeCompare(nomA);
            const tA = a.controlRutaId || a.id || 0;
            const tB = b.controlRutaId || b.id || 0;
            return tA - tB;
        }

        if (col === 'litros') {
            const valA = Number(a.litros || a.Litros) || 0;
            const valB = Number(b.litros || b.Litros) || 0;
            if (valA !== valB) return asc ? (valA - valB) : (valB - valA);
        } else if (col === 'origen') {
            const valA = Number(a.totalLitrosOrigen || a.litros || 0);
            const valB = Number(b.totalLitrosOrigen || b.litros || 0);
            if (valA !== valB) return asc ? (valA - valB) : (valB - valA);
        } else if (col === 'diferencia') {
            const valA = Number(a.diferenciaLitros != null ? a.diferenciaLitros : 0);
            const valB = Number(b.diferenciaLitros != null ? b.diferenciaLitros : 0);
            if (valA !== valB) return asc ? (valA - valB) : (valB - valA);
        } else if (col === 'conductor') {
            const valA = (a.conductorNombre || '').toLowerCase();
            const valB = (b.conductorNombre || '').toLowerCase();
            if (valA !== valB) return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            // Orden por Fecha
            const fA = a.fecha || '';
            const fB = b.fecha || '';
            if (fA !== fB) {
                if (fA < fB) return asc ? -1 : 1;
                if (fA > fB) return asc ? 1 : -1;
            }
        }

        // CRITERIO DETERMINÍSTICO POR PROCESO OPERATIVO:
        // 1. Finca ➔ Receptoría (Ingreso Tanque)
        // 2. Directo Finca ➔ Planta (Ruta de Campo Directa)
        // 3. Finca ➔ Receptoría ➔ Planta (Paso / Recarga por Tanques)
        // 4. Receptoría ➔ Planta / Compañía (Llegada a Planta)
        // 5. Salida Receptoría
        const procA = obtenerOrdenProcesoDestino(a);
        const procB = obtenerOrdenProcesoDestino(b);
        if (procA !== procB) {
            return procA - procB;
        }

        // Criterio secundario: Ticket ID
        const tickA = a.controlRutaId || a.id || 0;
        const tickB = b.controlRutaId || b.id || 0;
        if (tickA !== tickB) return tickA - tickB;

        // Criterio terciario: Nombre de Compañía
        const cA = (a.companiaNombre || '').toLowerCase();
        const cB = (b.companiaNombre || '').toLowerCase();
        return cA.localeCompare(cB);
    });

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 30px;"><i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No hay entregas registradas para los filtros seleccionados</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(e => {
        const puedeEditar = Boolean(e.puedeModificar);
        const meta = obtenerTipoRegistroEntrega(e);
        const numLitros = Number(e.litros || e.Litros || 0);
        const numOrigen = Number(e.totalLitrosOrigen != null ? e.totalLitrosOrigen : (e.litros || e.Litros || 0));
        const difLitros = (e.diferenciaLitros != null) ? Number(e.diferenciaLitros) : null;
        let pctMerma = (e.porcentajeMerma != null && Number(e.porcentajeMerma) !== 0)
            ? Math.abs(Number(e.porcentajeMerma))
            : (difLitros && numOrigen > 0 ? (Math.abs(difLitros) * 100.0 / numOrigen) : 0);

        let badgeMermaHtml = `<span style="color: #94a3b8; font-size: 11px; font-weight: 600;">-</span>`;
        if (difLitros !== null) {
            const semaforoBadge = typeof renderSemaforoMerma === 'function'
                ? renderSemaforoMerma(pctMerma, difLitros)
                : `<span class="badge">${pctMerma.toFixed(2)}%</span>`;

            let difTexto = '0 L';
            let difColor = '#166534';
            if (difLitros > 0) {
                difTexto = `-${difLitros.toLocaleString('es-VE')} L`;
                const tol = typeof obtenerToleranciaMerma === 'function' ? obtenerToleranciaMerma() : 3.0;
                difColor = pctMerma <= tol ? '#b45309' : '#b91c1c';
            } else if (difLitros < 0) {
                difTexto = `+${Math.abs(difLitros).toLocaleString('es-VE')} L`;
                difColor = '#047857';
            }

            badgeMermaHtml = `
                <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 3px;">
                    <span style="font-weight: 800; font-size: 12px; color: ${difColor};">
                        ${difTexto}
                    </span>
                    ${semaforoBadge}
                </div>
            `;
        }

        return `
            <tr style="background: ${meta.rowBg}; border-left: 4px solid ${meta.borderLeft}; transition: background 0.15s ease;">
                <td style="white-space: nowrap;">
                    <strong style="color: #0f172a; font-size: 13px; font-weight: 700;">${e.fecha ? e.fecha.split('T')[0] : ''}</strong>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
                        <span class="badge" style="background: ${meta.badgeBg}; color: ${meta.badgeColor}; border: 1px solid ${meta.badgeBorder}; font-weight: 700; font-size: 10.5px; padding: 2px 7px; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="${meta.icono}"></i> ${meta.label}
                        </span>
                        ${meta.ticketId ? `
                            <span class="badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="verTrazabilidadViaje(${meta.ticketId})" title="Ver Trazabilidad y Detalle del Ticket #${meta.ticketId}">
                                <i class="fa-solid fa-ticket"></i> Ticket #${meta.ticketId}
                            </span>
                        ` : ''}
                        ${meta.ctrlCompId ? `
                            <span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1px solid #d8b4fe; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;" title="Control de Compañías #${meta.ctrlCompId}">
                                <i class="fa-solid fa-file-invoice"></i> Ctrl #${meta.ctrlCompId}
                            </span>
                        ` : ''}
                        ${meta.esTraspaso ? `
                            <span class="badge" style="background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; font-weight: 800; font-size: 10.5px; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;" title="Recibió Traspaso (+${meta.ltsTraspaso ? meta.ltsTraspaso.toLocaleString('es-VE') : '1.070'} L)">
                                <i class="fa-solid fa-right-left"></i> Traspaso +${meta.ltsTraspaso ? meta.ltsTraspaso.toLocaleString('es-VE') : '1.070'} L
                            </span>
                        ` : ''}
                    </div>
                    <div style="font-weight: 800; color: ${meta.titleColor}; font-size: 13.5px;">${e.companiaNombre || 'Compañía #' + e.companiaId}</div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <small style="color: #475569; font-weight: 600;">${e.encargado || meta.subLabel}</small>
                        ${meta.esMixto ? `<span class="badge" style="background: #fdf4ff; color: #a21caf; border: 1px solid #f5d0fe; font-size: 9.5px; font-weight: 800; padding: 1px 5px;"><i class="fa-solid fa-warehouse"></i> Paso por Tanques</span>` : ''}
                    </div>
                </td>
                <td>
                    <div style="color: #1e293b; font-weight: 700; font-size: 13px;"><i class="fa-solid fa-user-tie" style="color: #64748b; margin-right: 4px;"></i>${e.conductorNombre || 'Chofer'}</div>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    ${meta.esMixto ? `
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                            <span style="font-weight: 800; font-size: 13px; color: #0284c7;" title="Entró a Tanques Receptoría desde Fincas">
                                <i class="fa-solid fa-arrow-down-to-bracket" style="font-size: 10px; margin-right: 3px;"></i>${meta.ltsFincaEntrada.toLocaleString('es-VE')} <small style="font-size: 10px; color: #64748b; font-weight: 700;">L Entró</small>
                            </span>
                            <span style="font-size: 11px; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 4px;" title="Salida de Tanques Receptoría (Recarga)">
                                <i class="fa-solid fa-arrow-up-from-bracket" style="font-size: 10px; margin-right: 2px;"></i>+${meta.ltsRecargaTanque.toLocaleString('es-VE')} <small style="font-size: 9.5px;">L Salida Tanque</small>
                            </span>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px;">
                            <span style="font-weight: 700; font-size: 13.5px; color: #475569;">
                                ${numOrigen > 0 ? numOrigen.toLocaleString('es-VE') : '-'} <small style="font-size: 10.5px; color: #94a3b8;">Lts</small>
                            </span>
                            ${meta.esTraspaso && e.litrosFinca ? `
                                <small style="font-size: 10px; color: #0d9488; font-weight: 700;" title="Ruta: ${Number(e.litrosFinca).toLocaleString('es-VE')} L + Traspaso: +${meta.ltsTraspaso ? meta.ltsTraspaso.toLocaleString('es-VE') : '1.070'} L">
                                    Ruta + Traspaso
                                </small>
                            ` : ''}
                        </div>
                    `}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    ${meta.esMixto ? `
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                            <span style="font-weight: 900; font-size: 15px; color: #7e22ce;">
                                +${Math.abs(numLitros).toLocaleString('es-VE')} <small style="font-size: 11px; color: #475569; font-weight: 700;">Lts</small>
                            </span>
                            <span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 9.5px; font-weight: 800; padding: 1px 5px;">
                                <i class="fa-solid fa-check-double"></i> Total Entregado
                            </span>
                        </div>
                    ` : `
                        <span style="font-weight: 800; font-size: 14.5px; color: ${meta.litrosColor};">
                            ${numLitros < 0 ? '-' : (numLitros > 0 ? '+' : '')}${Math.abs(numLitros).toLocaleString('es-VE')} <small style="font-size: 11px; color: #475569; font-weight: 600;">Lts</small>
                        </span>
                    `}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    ${badgeMermaHtml}
                </td>
                <td>
                    ${meta.esMixto ? `
                        <div style="background: #ffffff; border: 1px solid #f0abfc; border-left: 3px solid #d946ef; border-radius: 8px; padding: 6px 9px; font-size: 11.5px; line-height: 1.4; color: #334155; box-shadow: 0 1px 4px rgba(217,70,239,0.06);">
                            <div style="color: #0369a1; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 4px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 2px; margin-bottom: 3px;">
                                <span><i class="fa-solid fa-warehouse" style="color: #0284c7;"></i> Entró a Tanques:</span>
                                <strong style="color: #0284c7;">${meta.ltsFincaEntrada.toLocaleString('es-VE')} L</strong>
                            </div>
                            <div style="color: #b45309; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 4px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 2px; margin-bottom: 3px;">
                                <span><i class="fa-solid fa-gas-pump" style="color: #d97706;"></i> Salida Tanques (Recarga):</span>
                                <strong style="color: #d97706;">+${meta.ltsRecargaTanque.toLocaleString('es-VE')} L</strong>
                            </div>
                            <div style="color: #7e22ce; font-weight: 800; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                                <span><i class="fa-solid fa-building-circle-check" style="color: #9333ea;"></i> Entregado a ${sanitizarTexto(e.companiaNombre || 'Planta')}:</span>
                                <strong style="color: #7e22ce; font-size: 12px;">${Math.abs(numLitros).toLocaleString('es-VE')} L</strong>
                            </div>
                        </div>
                    ` : `
                        <span style="color: #475569; font-size: 12px; font-weight: 500; line-height: 1.4; display: block; max-width: 280px;">${(e.observacion || '-').replace(/ReceptorÃa/g, 'Receptoría').replace(/compaÃ±/g, 'compañ')}</span>
                    `}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    ${(() => {
                        const esAdmin = state.user && (state.user.rol === 'ADMIN' || state.user.rol === 'SUPERADMIN');
                        if (esAdmin) {
                            if (meta.ctrlCompId) {
                                return `
                                    <div style="display: flex; gap: 6px; justify-content: center;">
                                        <button type="button" class="btn-icon" style="color: #7c3aed; background: #faf5ff; border: 1.5px solid #d8b4fe; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="abrirModalEditarTicket('RECEPTORIA', ${meta.ctrlCompId})" title="Editar Despacho Ctrl #${meta.ctrlCompId} (Admin)"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button type="button" class="btn-icon" style="color: #e11d48; background: #fff1f2; border: 1.5px solid #fecdd3; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="eliminarTicketAdmin('RECEPTORIA', ${meta.ctrlCompId})" title="Eliminar Despacho Ctrl #${meta.ctrlCompId} (Admin)"><i class="fa-solid fa-trash-can"></i></button>
                                    </div>
                                `;
                            } else if (meta.ticketId) {
                                return `
                                    <div style="display: flex; gap: 6px; justify-content: center;">
                                        <button type="button" class="btn-icon" style="color: #0284c7; background: #f0f9ff; border: 1.5px solid #bae6fd; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="abrirModalEditarTicket('RUTA', ${meta.ticketId})" title="Editar Ticket #${meta.ticketId} (Admin)"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button type="button" class="btn-icon" style="color: #e11d48; background: #fff1f2; border: 1.5px solid #fecdd3; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="eliminarTicketAdmin('RUTA', ${meta.ticketId})" title="Eliminar Ticket #${meta.ticketId} (Admin)"><i class="fa-solid fa-trash-can"></i></button>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div style="display: flex; gap: 6px; justify-content: center;">
                                        <button type="button" class="btn-icon" style="color: #2563eb; background: #eff6ff; border: 1.5px solid #93c5fd; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="abrirModalEditarEntrega(${e.id || e.Id})" title="Editar Entrega #${e.id || e.Id}"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button type="button" class="btn-icon" style="color: #e11d48; background: #fff1f2; border: 1.5px solid #fecdd3; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="eliminarEntrega(${e.id || e.Id})" title="Eliminar Entrega #${e.id || e.Id}"><i class="fa-solid fa-trash-can"></i></button>
                                    </div>
                                `;
                            }
                        } else if (puedeEditar) {
                            return `
                                <div style="display: flex; gap: 6px; justify-content: center;">
                                    <button type="button" class="btn-icon" style="color: #2563eb; background: #eff6ff; border: 1px solid #93c5fd; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="abrirModalEditarEntrega(${e.id || e.Id})" title="Editar entrega"><i class="fa-solid fa-pen-to-square"></i></button>
                                    <button type="button" class="btn-icon" style="color: #e11d48; background: #fff1f2; border: 1px solid #fecdd3; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" onclick="eliminarEntrega(${e.id || e.Id})" title="Eliminar entrega"><i class="fa-solid fa-trash-can"></i></button>
                                </div>
                            `;
                        } else {
                            return '<span style="color: #64748b; font-size: 11.5px; font-weight: 600;"><i class="fa-solid fa-lock" style="color: #94a3b8;"></i> Finalizado</span>';
                        }
                    })()}
                </td>
            </tr>
        `;
    }).join('');
}
window.renderTablaEntregas = renderTablaEntregas;

async function guardarEntrega(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (state.user && state.user.rol === 'CHOFER' && stateViajes.viajeActivo && stateViajes.viajeActivo.procesoActualId > 1) {
        Swal.fire({
            icon: 'warning',
            title: 'Acción No Permitida',
            text: 'Tu ticket ya se encuentra en estado RECIBIDO o superior. No puedes registrar entregas.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    const btnGuardar = document.getElementById('btnGuardarEntrega') || document.getElementById('btnRegistrarEntrega');
    const originalHtml = btnGuardar ? btnGuardar.innerHTML : '';
    if (btnGuardar) {
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btnGuardar.disabled = true;
    }

    const fecha = document.getElementById('inputFechaEntrega')?.value || new Date().toISOString().split('T')[0];
    const companiaId = parseInt(document.getElementById('selectEntregaCompania')?.value);
    const litros = parseInt(document.getElementById('inputLitrosEntrega')?.value);
    const observacion = document.getElementById('inputObservacionEntrega')?.value || '';

    let conductorId = null;
    if (state.user && state.user.rol === 'CHOFER') {
        conductorId = state.user?.id || null;
    } else {
        conductorId = parseInt(document.getElementById('selectEntregaConductor')?.value) || null;
    }

    if (!conductorId || conductorId <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Conductor Requerido',
            text: 'Debe seleccionar el conductor asignado para registrar el ticket en receptoría.',
            background: '#1e293b',
            color: '#fff'
        });
        if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
        return;
    }

    if (state.user && state.user.rol !== 'CHOFER') {
        const choferObj = (state.choferes || []).find(c => (c.id || c.Id) == conductorId);
        if (!choferObj) {
            Swal.fire({
                icon: 'warning',
                title: 'Conductor Inválido',
                text: 'El usuario seleccionado no pertenece al listado de conductores autorizados.',
                background: '#1e293b',
                color: '#fff'
            });
            if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
            return;
        }
    }

    if (!companiaId || companiaId <= 0) {
        Swal.fire({ icon: 'warning', title: 'Compañía requerida', text: 'Por favor selecciona una compañía o planta receptora.', background: '#1e293b', color: '#fff' });
        if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
        return;
    }

    if (isNaN(litros) || litros === 0) {
        Swal.fire({ icon: 'warning', title: 'Litros inválidos', text: 'Por favor ingresa una cantidad válida de litros distinta de 0.', background: '#1e293b', color: '#fff' });
        if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
        return;
    }

    // Validación previa en frontend anti-duplicados
    const yaExiste = (state.entregas || []).some(ent => {
        const entFecha = (ent.fecha || ent.Fecha || '').split('T')[0];
        const entChoferId = ent.conductorId || ent.ConductorId || ent.usuarioId || ent.UsuarioId;
        const entCompId = ent.companiaId || ent.CompaniaId;
        const entLitros = ent.litros || ent.Litros;
        return entFecha === fecha && entChoferId == conductorId && entCompId == companiaId && entLitros == litros;
    });

    if (yaExiste) {
        const confirmDup = await Swal.fire({
            icon: 'warning',
            title: 'Posible Entrega Duplicada',
            html: `Ya existe un registro el <b>${fecha}</b> para esta compañía por <b>${litros.toLocaleString()} Lts</b> con el mismo conductor.<br><br><b>¿Estás seguro de que deseas registrarlo nuevamente?</b>`,
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar de todos modos',
            cancelButtonText: 'No, cancelar',
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            background: '#1e293b',
            color: '#fff'
        });

        if (!confirmDup.isConfirmed) {
            if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
            return;
        }
    }

    try {
        const res = await fetch(`${API_BASE}/receptoria`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha,
                companiaId,
                conductorId,
                litros,
                observacion
            })
        });

        if (res.ok) {
            const compObj = (state.companias || []).find(c => Number(c.id || c.Id) === Number(companiaId));
            const compNombre = compObj ? (compObj.nombre || compObj.Nombre) : 'Compañía';
            showToast(`Entrega registrada: ${litros.toLocaleString('es-VE')} Lts en ${compNombre}`);

            // Flujo continuo rápido
            document.getElementById('inputLitrosEntrega').value = '';
            const obsEl = document.getElementById('inputObservacionEntrega');
            if (obsEl) obsEl.value = '';

            const selectCompHidden = document.getElementById('selectEntregaCompania');
            const searchCompInput = document.getElementById('searchEntregaCompaniaInput');
            if (selectCompHidden) selectCompHidden.value = '';
            if (searchCompInput) searchCompInput.value = '';

            if (comboboxEntregaCompaniaInstance && typeof comboboxEntregaCompaniaInstance.reset === 'function') {
                comboboxEntregaCompaniaInstance.reset();
            }

            if (searchCompInput) {
                setTimeout(() => searchCompInput.focus(), 50);
            }

            await cargarEntregasHoy();
            if (typeof cargarDashboard === 'function') {
                cargarDashboard();
            }

            // Consultar si desea cambiar el estado del viaje del conductor a RECIBIDO
            try {
                const resViajes = await fetch(`${API_BASE}/control-rutas?fecha=${fecha}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
                if (resViajes.ok) {
                    const listaV = await resViajes.json();
                    const viajeChofer = (listaV || []).find(v => v.usuarioId === conductorId && v.estado !== 'RECIBIDO');
                    if (viajeChofer) {
                        const pregs = await Swal.fire({
                            title: '¿Cambiar estado a RECIBIDO?',
                            html: `Se registró la entrega de <strong>${litros.toLocaleString('es-VE')} Lts</strong>.<br><br>¿Desea cambiar el estado del <strong>Ticket #${viajeChofer.id}</strong> (${viajeChofer.nombreConductor || 'Conductor'}) a <strong>RECIBIDO</strong>?`,
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonText: '<i class="fa-solid fa-check"></i> Sí, cambiar a RECIBIDO',
                            cancelButtonText: 'No, mantener actual',
                            confirmButtonColor: '#0284c7',
                            cancelButtonColor: '#64748b'
                        });
                        if (pregs.isConfirmed) {
                            await fetch(`${API_BASE}/control-rutas/${viajeChofer.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
                                body: JSON.stringify({ estado: 'RECIBIDO' })
                            });
                            showToast(`Estado del Ticket #${viajeChofer.id} actualizado a RECIBIDO`);
                            if (typeof cargarBandejaReceptoria === 'function') {
                                cargarBandejaReceptoria();
                            }
                        }
                    }
                }
            } catch(errViaje) {
                console.warn('Error al verificar viaje para cambiar estado:', errViaje);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al guardar la entrega.');
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btnGuardar) {
            btnGuardar.innerHTML = originalHtml;
            btnGuardar.disabled = false;
        }
    }
}
window.guardarEntrega = guardarEntrega;

function abrirModalEditarEntrega(id) {
    const entrega = (state.entregas || []).find(e => (e.id || e.Id) == id);
    if (!entrega) return;

    if (state.user && state.user.rol === 'CHOFER' && (entrega.puedeModificar === false || entrega.puedeModificar === 0)) {
        Swal.fire({
            icon: 'warning',
            title: 'Edición No Permitida',
            text: 'Esta entrega pertenece a un viaje en estado RECIBIDO o finalizado y no puede ser modificada.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    const elId = document.getElementById('editEntregaId');
    const elFecha = document.getElementById('editEntregaFecha');
    const elLitros = document.getElementById('editEntregaLitros');
    const elObs = document.getElementById('editEntregaObservacion');

    if (elId) elId.value = entrega.id || entrega.Id;
    if (elFecha) elFecha.value = (entrega.fecha || entrega.Fecha) ? (entrega.fecha || entrega.Fecha).split('T')[0] : '';
    if (elLitros) {
        elLitros.value = (entrega.litros !== undefined && entrega.litros !== null) ? entrega.litros : (entrega.Litros ?? '');
        elLitros.dispatchEvent(new Event('input'));
    }
    if (elObs) elObs.value = entrega.observacion || entrega.Observacion || '';

    // Llenar selector buscable de Compañías
    if (!comboboxEditEntregaCompaniaInstance && document.getElementById('comboboxEditEntregaCompania')) {
        comboboxEditEntregaCompaniaInstance = setupCombobox({
            containerId: 'comboboxEditEntregaCompania',
            inputSearchId: 'inputEditEntregaCompaniaSearch',
            inputHiddenId: 'editEntregaCompaniaSelect',
            dropdownId: 'dropdownEditEntregaCompaniaList',
            placeholder: 'SELECCIONE COMPAÑÍA / PLANTA',
            getItemsFn: () => (state.companias || [])
                .filter(cp => cp.activo !== false && cp.Activo !== false)
                .map(cp => ({
                    value: cp.id || cp.Id,
                    label: capitalizarTexto(cp.nombre || cp.Nombre),
                    sub: cp.encargado ? `Encargado: ${capitalizarTexto(cp.encargado)}` : ''
                }))
        });
        window.comboboxEditEntregaCompaniaInstance = comboboxEditEntregaCompaniaInstance;
    }

    if (comboboxEditEntregaCompaniaInstance) {
        const compId = entrega.companiaId || entrega.CompaniaId;
        const matchedComp = (state.companias || []).find(c => Number(c.id || c.Id) === Number(compId));
        if (matchedComp) {
            comboboxEditEntregaCompaniaInstance.selectItem(matchedComp.id || matchedComp.Id, capitalizarTexto(matchedComp.nombre || matchedComp.Nombre));
        } else {
            comboboxEditEntregaCompaniaInstance.reset();
        }
    }

    // Llenar select de Choferes
    const groupChofer = document.getElementById('groupEditEntregaConductor');
    if (state.user && state.user.rol === 'ADMIN') {
        if (groupChofer) groupChofer.style.display = 'block';
        if (!comboboxEditEntregaConductorInstance && document.getElementById('comboboxEditEntregaConductor')) {
            comboboxEditEntregaConductorInstance = setupCombobox({
                containerId: 'comboboxEditEntregaConductor',
                inputSearchId: 'inputEditEntregaConductorSearch',
                inputHiddenId: 'editEntregaConductorSelect',
                dropdownId: 'dropdownEditEntregaConductor',
                placeholder: 'SELECCIONE CONDUCTOR...',
                getItemsFn: () => (state.choferes || []).map(c => ({
                    value: c.id || c.Id,
                    label: `${capitalizarTexto(c.nombreCompleto || c.username || '')} ${c.cedula ? `(${c.cedula})` : ''}`.trim(),
                    sub: c.cedula || 'Chofer'
                }))
            });
            window.comboboxEditEntregaConductorInstance = comboboxEditEntregaConductorInstance;
        }

        if (comboboxEditEntregaConductorInstance) {
            const condId = entrega.conductorId || entrega.usuarioId;
            const matched = (state.choferes || []).find(c => Number(c.id || c.Id) === Number(condId));
            if (matched) {
                const label = `${(matched.nombreCompleto || matched.username || '').toUpperCase()} ${matched.cedula ? `(${matched.cedula})` : ''}`.trim();
                comboboxEditEntregaConductorInstance.selectItem(matched.id || matched.Id, label);
            } else {
                comboboxEditEntregaConductorInstance.reset();
            }
        }
    } else {
        if (groupChofer) groupChofer.style.display = 'none';
    }

    abrirModalCustom('modalEditarEntregaCustom');
}
window.abrirModalEditarEntrega = abrirModalEditarEntrega;

async function guardarEdicionEntrega(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const id = parseInt(document.getElementById('editEntregaId')?.value || '0');
    const fecha = document.getElementById('editEntregaFecha')?.value;
    const rawLitros = parseInt(document.getElementById('editEntregaLitros')?.value || '0');
    const litros = isNaN(rawLitros) ? 0 : rawLitros;
    const companiaId = parseInt(document.getElementById('editEntregaCompaniaSelect')?.value || '0');
    const observacion = (document.getElementById('editEntregaObservacion')?.value || '').trim();

    let conductorId = null;
    if (state.user && state.user.rol === 'ADMIN') {
        const selectChofer = document.getElementById('editEntregaConductorSelect');
        if (selectChofer && selectChofer.value) {
            conductorId = parseInt(selectChofer.value) || null;
        }
    }

    if (!id || !fecha || litros === 0 || !companiaId) {
        Swal.fire({ icon: 'warning', title: 'Campos Inválidos', text: 'Por favor completa fecha, litros (distintos de 0) y compañía.', background: '#1e293b', color: '#fff' });
        return;
    }

    const btnSubmit = document.getElementById('btnGuardarEditEntregaSubmit');
    const oldHtml = btnSubmit ? btnSubmit.innerHTML : 'Guardar';
    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btnSubmit.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/receptoria/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha,
                litros,
                companiaId,
                conductorId,
                observacion
            })
        });

        if (res.ok) {
            cerrarModalCustom('modalEditarEntregaCustom');
            showToast('Entrega en receptoría actualizada exitosamente.');
            await cargarEntregasHoy();
            if (typeof cargarDashboard === 'function') {
                cargarDashboard();
            }
            if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
            if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
            if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
            if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
            if (window.currentTrazabilidadData?.ticket?.id) {
                verTrazabilidadViaje(window.currentTrazabilidadData.ticket.id);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al actualizar entrega.');
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btnSubmit) {
            btnSubmit.innerHTML = oldHtml;
            btnSubmit.disabled = false;
        }
    }
}
window.guardarEdicionEntrega = guardarEdicionEntrega;

async function eliminarEntrega(id) {
    const entrega = (state.entregas || []).find(e => (e.id || e.Id) == id);
    if (state.user && state.user.rol === 'CHOFER' && entrega && (entrega.puedeModificar === false || entrega.puedeModificar === 0)) {
        Swal.fire({
            icon: 'warning',
            title: 'Eliminación No Permitida',
            text: 'Esta entrega pertenece a un viaje en estado RECIBIDO o finalizado y no puede ser eliminada por el chofer.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }
    const result = await Swal.fire({
        title: '¿Eliminar Entrega?',
        text: 'Esta acción borrará la entrega y recalculará la merma del día.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE}/receptoria/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (res.ok) {
                showToast('Entrega eliminada exitosamente.');
                await cargarEntregasHoy();
                if (typeof cargarDashboard === 'function') {
                    cargarDashboard();
                }
                if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
                if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
                if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
                if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
                if (window.currentTrazabilidadData?.ticket?.id) {
                    verTrazabilidadViaje(window.currentTrazabilidadData.ticket.id);
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Error al eliminar entrega.');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
        }
    }
}
window.eliminarEntrega = eliminarEntrega;
window.eliminarEntrega = eliminarEntrega;


if (!state.dashboardMode) {
    state.dashboardMode = 'dia'; // 'dia' o 'semana'
}



async function cambiarModoDashboard(modo) {
    state.dashboardMode = modo;

    const btnDia = document.getElementById('btnModoDashboardDia');
    const btnSemana = document.getElementById('btnModoDashboardSemana');
    const contDia = document.getElementById('contenedorFiltroDia');
    const contSemana = document.getElementById('contenedorFiltroSemana');
    const badgeSub = document.getElementById('badgeDashboardSubtitulo');

    const kpiTitRutas = document.getElementById('kpiTituloRutas');
    const kpiTitRecep = document.getElementById('kpiTituloReceptoria');
    const kpiTitMerma = document.getElementById('kpiTituloMerma');

    if (modo === 'semana') {
        if (btnDia) { btnDia.style.background = 'transparent'; btnDia.style.color = '#64748b'; btnDia.classList.remove('active'); }
        if (btnSemana) { btnSemana.style.background = '#ffffff'; btnSemana.style.color = '#4338ca'; btnSemana.classList.add('active'); }
        if (contDia) contDia.style.display = 'none';
        if (contSemana) contSemana.style.display = 'flex';
        if (badgeSub) badgeSub.innerHTML = '<i class="fa-solid fa-chart-line" style="color: #4f46e5; margin-right: 6px;"></i> M&eacute;tricas y Balance Acumulado de la Semana';

        if (kpiTitRutas) kpiTitRutas.innerHTML = 'Litros en Rutas (Semana)';
        if (kpiTitRecep) kpiTitRecep.innerHTML = 'Litros en Receptor&iacute;a (Semana)';
        if (kpiTitMerma) kpiTitMerma.innerHTML = 'Merma / Diferencia Semanal';

        await cargarSemanasDashboardSelect();
    } else {
        if (btnDia) { btnDia.style.background = '#ffffff'; btnDia.style.color = '#4338ca'; btnDia.classList.add('active'); }
        if (btnSemana) { btnSemana.style.background = 'transparent'; btnSemana.style.color = '#64748b'; btnSemana.classList.remove('active'); }
        if (contDia) contDia.style.display = 'flex';
        if (contSemana) contSemana.style.display = 'none';
        if (badgeSub) badgeSub.innerHTML = '<i class="fa-solid fa-chart-simple" style="color: #4f46e5; margin-right: 6px;"></i> M&eacute;tricas y Balance del D&iacute;a Seleccionado';

        if (kpiTitRutas) kpiTitRutas.innerHTML = 'Litros en Rutas Hoy';
        if (kpiTitRecep) kpiTitRecep.innerHTML = 'Litros en Receptor&iacute;a Hoy';
        if (kpiTitMerma) kpiTitMerma.innerHTML = 'Merma / Diferencia Diaria';
    }

    cargarDashboard();
}
window.cambiarModoDashboard = cambiarModoDashboard;

async function cargarSemanasDashboardSelect() {
    const select = document.getElementById('selectSemanaDashboard');
    if (!select) return;

    try {
        if (!state.semanas || state.semanas.length === 0) {
            const res = await fetch(`${API_BASE}/ciclos`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) {
                state.semanas = await res.json();
            }
        }

        const todasSemanas = state.semanas || [];
        const hoy = new Date();
        const hoyIso = hoy.toISOString().split('T')[0];

        // Filtrar ÚNICAMENTE semanas transcurridas (CERRADAS) o la semana actual en curso (ABIERTA)
        const semanasFiltradas = todasSemanas.filter(s => {
            const estado = (s.estado || '').toUpperCase();
            if (estado === 'ABIERTO') return true;
            if (estado === 'CERRADO') return true;
            
            const fIni = s.fechaInicio ? s.fechaInicio.split('T')[0] : '';
            return fIni && fIni <= hoyIso;
        });

        // Ordenar: Semana activa primero, luego por fecha de inicio descendente (de la más reciente a la más antigua)
        semanasFiltradas.sort((a, b) => {
            const isAbiertoA = (a.estado || '').toUpperCase() === 'ABIERTO' ? 1 : 0;
            const isAbiertoB = (b.estado || '').toUpperCase() === 'ABIERTO' ? 1 : 0;
            if (isAbiertoA !== isAbiertoB) return isAbiertoB - isAbiertoA;

            const fA = a.fechaInicio ? a.fechaInicio.split('T')[0] : '';
            const fB = b.fechaInicio ? b.fechaInicio.split('T')[0] : '';
            return fB.localeCompare(fA);
        });

        if (semanasFiltradas.length === 0) {
            select.innerHTML = '<option value="">Sin semanas transcurridas registradas</option>';
            return;
        }

        const selectedVal = select.value;
        select.innerHTML = semanasFiltradas.map(s => {
            const fIni = s.fechaInicio ? s.fechaInicio.split('T')[0] : '';
            const fFin = s.fechaFin ? s.fechaFin.split('T')[0] : '';
            const isAbierto = (s.estado || '').toUpperCase() === 'ABIERTO';

            let codigoLimpio = (s.codigo || ('Semana #' + s.id)).split('(')[0].trim();
            const badgeEstado = isAbierto ? '⭐ [ACTIVA]' : (s.estado ? `[${s.estado}]` : '');
            const text = `${codigoLimpio} (${fIni} al ${fFin}) ${badgeEstado}`.trim();

            const isSelected = isAbierto && !selectedVal ? 'selected' : (selectedVal == s.id ? 'selected' : '');
            return `<option value="${s.id}" data-inicio="${fIni}" data-fin="${fFin}" ${isSelected}>${text}</option>`;
        }).join('');

    } catch (e) {
        console.warn('Error cargando selector de semanas en dashboard:', e);
    }
}
window.cargarSemanasDashboardSelect = cargarSemanasDashboardSelect;

function onCambiarFechaDashboard() {
    cargarDashboard();
}
window.onCambiarFechaDashboard = onCambiarFechaDashboard;

function onCambiarSemanaDashboard() {
    cargarDashboard();
}
window.onCambiarSemanaDashboard = onCambiarSemanaDashboard;

function cambiarFiltroServicioDashboard(filtro) {
    state.dashboardServicioFiltro = filtro;

    const btnTodos = document.getElementById('btnFiltroServicioTodos');
    const btnRuta = document.getElementById('btnFiltroServicioRuta');
    const btnTransp = document.getElementById('btnFiltroServicioTransporte');

    if (btnTodos) btnTodos.classList.toggle('active', filtro === 'todos');
    if (btnRuta) btnRuta.classList.toggle('active', filtro === 'ruta');
    if (btnTransp) btnTransp.classList.toggle('active', filtro === 'transporte');

    const bRuta = document.getElementById('bloqueMetricsRuta');
    const bTransp = document.getElementById('bloqueMetricsTransporte');
    const bConsolidado = document.getElementById('bloqueMetricsConsolidado');

    if (filtro === 'ruta') {
        if (bRuta) bRuta.style.display = 'block';
        if (bTransp) bTransp.style.display = 'none';
        if (bConsolidado) bConsolidado.style.display = 'none';
    } else if (filtro === 'transporte') {
        if (bRuta) bRuta.style.display = 'none';
        if (bTransp) bTransp.style.display = 'block';
        if (bConsolidado) bConsolidado.style.display = 'none';
    } else {
        if (bRuta) bRuta.style.display = 'block';
        if (bTransp) bTransp.style.display = 'block';
        if (bConsolidado) bConsolidado.style.display = 'block';
    }
}
window.cambiarFiltroServicioDashboard = cambiarFiltroServicioDashboard;

async function cargarDashboard() {
    try {
        const modo = state.dashboardMode || 'dia';
        let queryParamsRutas = '';
        let queryParamsEntregas = '';
        let labelPeriodo = '';

        if (modo === 'semana') {
            const selectSem = document.getElementById('selectSemanaDashboard');
            if (selectSem && selectSem.options.length > 0 && selectSem.selectedIndex >= 0) {
                const opt = selectSem.options[selectSem.selectedIndex];
                const cicloId = opt.value;
                const fIni = opt.getAttribute('data-inicio');
                const fFin = opt.getAttribute('data-fin');
                if (cicloId || (fIni && fFin)) {
                    queryParamsRutas = `cicloId=${cicloId || ''}&fechaInicio=${fIni || ''}&fechaFin=${fFin || ''}`;
                    queryParamsEntregas = `cicloId=${cicloId || ''}&fechaInicio=${fIni || ''}&fechaFin=${fFin || ''}`;
                    labelPeriodo = opt.text;
                }
            }
            if (!queryParamsRutas) {
                const hoyStr = new Date().toISOString().split('T')[0];
                queryParamsRutas = `fecha=${hoyStr}`;
                queryParamsEntregas = `fecha=${hoyStr}`;
            }
        } else {
            const inputFecha = document.getElementById('filtroFechaDashboard');
            const hoyStr = new Date().toISOString().split('T')[0];
            let fechaDashboard = (inputFecha && inputFecha.value) ? inputFecha.value : hoyStr;
            if (inputFecha && !inputFecha.value) {
                inputFecha.value = hoyStr;
                fechaDashboard = hoyStr;
            }
            queryParamsRutas = `fecha=${fechaDashboard}`;
            queryParamsEntregas = `fecha=${fechaDashboard}`;
            labelPeriodo = fechaDashboard;
        }

        // Consultar rutas, entregas, despachos a compañías y control de rutas en paralelo
        let rutas = [];
        let entregas = [];
        let despachos = [];
        let controlRutas = [];
        let balanceVol = null;

        try {
            const [resRutas, resEntregas, resDespachos, resControlRutas, resBalance] = await Promise.all([
                fetch(`${API_BASE}/rutas/hoy?${queryParamsRutas}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                }),
                fetch(`${API_BASE}/receptoria/hoy?${queryParamsEntregas}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                }),
                fetch(`${API_BASE}/control-companias?${queryParamsEntregas}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                }),
                fetch(`${API_BASE}/control-rutas/hoy?${queryParamsRutas}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                }),
                fetch(`${API_BASE}/receptoria/balance-volumetrico?${queryParamsEntregas}`, {
                    headers: { 'Authorization': `Bearer ${state.token}` }
                }).catch(() => ({ ok: false }))
            ]);

            if (resBalance && resBalance.ok) {
                try {
                    balanceVol = await resBalance.json();
                    state.balanceReceptoria = balanceVol;
                } catch (errB) {
                    console.warn('Error al parsear balance volumétrico en dashboard:', errB);
                }
            }

            if (resRutas.ok) {
                rutas = await resRutas.json();
                if (state.user && state.user.rol === 'CHOFER') {
                    const uid = state.user.id;
                    rutas = (rutas || []).filter(r => (r.conductorId || r.usuarioId) == uid);
                }
                state.rutas = rutas;
            }
            if (resEntregas.ok) {
                entregas = await resEntregas.json();
                if (state.user && state.user.rol === 'CHOFER') {
                    const uid = state.user.id;
                    entregas = (entregas || []).filter(e => (e.conductorId || e.usuarioId) == uid);
                }
                state.entregas = entregas;
            }
            if (resDespachos.ok) {
                despachos = await resDespachos.json();
                if (state.user && state.user.rol === 'CHOFER') {
                    const uid = state.user.id;
                    despachos = (despachos || []).filter(d => (d.conductorId || d.usuarioId) == uid);
                }
                state.despachosCompania = despachos;
            }
            if (resControlRutas.ok) {
                controlRutas = await resControlRutas.json();
                if (state.user && state.user.rol === 'CHOFER') {
                    const uid = state.user.id;
                    controlRutas = (controlRutas || []).filter(c => (c.conductorId || c.usuarioId) == uid);
                }
            }
        } catch (e) {
            console.warn('Error al obtener datos en dashboard:', e);
        }

        // 1. Clasificación por Servicio (RUTA = 1 / TRANSPORTE = 2)
        let ltsRutaFincas = 0;
        let fincasRutaSet = new Set();
        let ltsRutaReceptoria = 0;
        let plantasRutaSet = new Set();

        let ltsTranspFincas = 0;
        let fincasTranspSet = new Set();
        let ltsTranspReceptoria = 0;
        let plantasTranspSet = new Set();

        let choferesRutasMap = {};
        let companiasReceptoriaMap = {};

        // Mapeo por Ticket para calcular la proporción por Tipo de Servicio
        let ticketLitrosFincaMap = {};
        let ticketLitrosRutaMap = {};
        let ticketLitrosTranspMap = {};

        // Recolecciones en Fincas (RUTA & TRANSPORTE)
        (rutas || []).forEach(r => {
            const lts = Number(r.litros || r.Litros || 0);
            const fNom = (r.fincaNombre || (r.fincaId ? `Finca #${r.fincaId}` : 'Finca')).trim();
            const fId = Number(r.fincaId || r.FincaId || 0);
            const tipoServ = Number(r.tipoServicioId || r.TipoServicioId || 1);
            const ticketId = r.controlRutaId || r.ControlRutaId;

            // Excluir finca CHOFER / Merma (FincaId 68)
            const esFincaMerma = fId === 68 || fNom.toUpperCase().includes('CHOFER') || fNom.toUpperCase().includes('DESCUENTO');
            if (esFincaMerma) return;

            if (tipoServ === 2) {
                ltsTranspFincas += lts;
                fincasTranspSet.add(fNom);
            } else {
                ltsRutaFincas += lts;
                fincasRutaSet.add(fNom);
            }

            if (ticketId) {
                ticketLitrosFincaMap[ticketId] = (ticketLitrosFincaMap[ticketId] || 0) + lts;
                if (tipoServ === 2) {
                    ticketLitrosTranspMap[ticketId] = (ticketLitrosTranspMap[ticketId] || 0) + lts;
                } else {
                    ticketLitrosRutaMap[ticketId] = (ticketLitrosRutaMap[ticketId] || 0) + lts;
                }
            }

            const cNom = (r.conductorNombre || (r.conductorId ? `Chofer #${r.conductorId}` : 'Sin Asignar')).trim();
            choferesRutasMap[cNom] = (choferesRutasMap[cNom] || 0) + lts;
        });

        // Litros Verificados y Clasificación de Destinos (Silos vs Despacho Directo en Ruta)
        let ltsRutaSilos = 0;              // Leche que entró físicamente a Silos de la Receptoría
        let ltsRutaDirectos = 0;           // Leche despachada directa a queseras desde el camión de ruta
        let cantViajesRutaSilos = 0;
        let cantViajesRutaDirectos = 0;
        let ltsRutaFincasSilos = 0;        // Volumen en finca de los viajes a silos
        let ltsRutaFincasDirectos = 0;     // Volumen en finca de los viajes directos

        let ltsTranspEntregados = 0;       // Leche entregada en planta de clientes
        let ltsTranspFincasVerificadas = 0;// Volumen en finca de viajes entregados
        let cantViajesTranspEntregados = 0;

        (controlRutas || []).forEach(cr => {
            const procesoId = Number(cr.procesoActualId || 1);
            const ticketId = cr.id || cr.Id;
            const tipoDestino = (cr.tipoDestino || '').toUpperCase();
            
            const rawRec = Number(cr.totalLitrosReceptoria || cr.litrosRecibidosReceptoria || 0);
            const rawEntrComp = Number(cr.litrosEntregadosCompania || 0);
            const cargadosAdic = Number(cr.litrosCargadosAdicional || 0);
            
            const esDirecto = tipoDestino.includes('COMPANIA') || rawEntrComp > 0;
            let ltsVerif = 0;
            if (esDirecto) {
                ltsVerif = rawEntrComp > 0 ? rawEntrComp : rawRec;
            } else {
                ltsVerif = Math.max(0, rawRec - cargadosAdic);
            }

            if (procesoId >= 2 && ltsVerif > 0 && ticketId) {
                const totalTicketFincas = ticketLitrosFincaMap[ticketId] || Number(cr.totalLitrosFinca || 0);
                const ltsRutaEnTicket = ticketLitrosRutaMap[ticketId] || 0;
                const ltsTranspEnTicket = ticketLitrosTranspMap[ticketId] || 0;

                if (totalTicketFincas > 0) {
                    if (ltsRutaEnTicket > 0) {
                        const prop = ltsRutaEnTicket / totalTicketFincas;
                        const ltsPond = prop * ltsVerif;
                        if (esDirecto) {
                            ltsRutaDirectos += ltsPond;
                            ltsRutaFincasDirectos += ltsRutaEnTicket;
                            cantViajesRutaDirectos++;
                        } else {
                            ltsRutaSilos += ltsPond;
                            ltsRutaFincasSilos += ltsRutaEnTicket;
                            cantViajesRutaSilos++;
                            plantasRutaSet.add(cr.nombreCompania || cr.companiaDestinoNombre || 'Receptoría Central');
                        }
                    }
                    if (ltsTranspEnTicket > 0) {
                        const prop = ltsTranspEnTicket / totalTicketFincas;
                        const ltsPond = prop * ltsVerif;
                        ltsTranspFincasVerificadas += ltsTranspEnTicket;
                        ltsTranspEntregados += ltsPond;
                        cantViajesTranspEntregados++;
                        plantasTranspSet.add(cr.nombreCompania || cr.companiaDestinoNombre || 'Planta Cliente');
                    }
                } else {
                    if (esDirecto) {
                        ltsRutaDirectos += ltsVerif;
                        ltsRutaFincasDirectos += ltsVerif;
                        cantViajesRutaDirectos++;
                    } else {
                        ltsRutaSilos += ltsVerif;
                        ltsRutaFincasSilos += ltsVerif;
                        cantViajesRutaSilos++;
                        plantasRutaSet.add('Receptoría Central');
                    }
                }
            }
        });

        // Entregas y Salidas a Compañías / Queseras separadas por Servicio
        let ltsSalidasRutaTotal = 0;
        let ltsRecibidosRutaTotal = 0;
        let cantDespachosRuta = 0;

        let ltsSalidasTranspTotal = 0;
        let ltsRecibidosTranspTotal = 0;
        let cantDespachosTransp = 0;

        let queserasSalidaSet = new Set();

        // Si existen registros en TB_CONTROL_COMPANIAS (Despachos), esta es la fuente principal
        if (despachos && despachos.length > 0) {
            despachos.forEach(d => {
                const ltsDesp = Number(d.litrosDespachados || 0);
                const ltsRec = Number(d.litrosRecibidosCompania != null ? d.litrosRecibidosCompania : ltsDesp);
                const cpNom = (d.nombreCompania || d.companiaNombre || (d.companiaId ? `Compañía #${d.companiaId}` : 'Quesera')).trim();

                if (ltsDesp > 0 && cpNom && !cpNom.toUpperCase().includes('RECEPTORIA')) {
                    queserasSalidaSet.add(cpNom);
                    companiasReceptoriaMap[cpNom] = (companiasReceptoriaMap[cpNom] || 0) + ltsDesp;

                    const compObj = (state.companias || []).find(c => (c.id || c.Id) === d.companiaId || (c.nombre || c.Nombre || '').trim().toUpperCase() === cpNom.toUpperCase());
                    const esTransp = compObj ? (compObj.tipoServicioId === 2 || compObj.tipoServicio === 2 || (compObj.nombre || '').toUpperCase().includes('COLONA')) : cpNom.toUpperCase().includes('COLONA');

                    if (esTransp) {
                        ltsSalidasTranspTotal += ltsDesp;
                        ltsRecibidosTranspTotal += ltsRec;
                        cantDespachosTransp++;
                    } else {
                        ltsSalidasRutaTotal += ltsDesp;
                        ltsRecibidosRutaTotal += ltsRec;
                        cantDespachosRuta++;
                    }
                }
            });
        } else if (entregas && entregas.length > 0) {
            entregas.forEach(e => {
                const lts = Number(e.litros || e.Litros || 0);
                if (lts <= 0) return;

                const cpNom = (e.companiaNombre || (e.companiaId ? `Compañía #${e.companiaId}` : '')).trim();
                if (!cpNom || cpNom.toUpperCase().includes('RECEPTORIA')) return;

                queserasSalidaSet.add(cpNom);
                companiasReceptoriaMap[cpNom] = (companiasReceptoriaMap[cpNom] || 0) + lts;

                const compObj = (state.companias || []).find(c => (c.id || c.Id) === e.companiaId || (c.nombre || c.Nombre || '').trim().toUpperCase() === cpNom.toUpperCase());
                const esTransp = compObj ? (compObj.tipoServicioId === 2 || compObj.tipoServicio === 2 || (compObj.nombre || '').toUpperCase().includes('COLONA')) : cpNom.toUpperCase().includes('COLONA');

                if (esTransp) {
                    ltsSalidasTranspTotal += lts;
                    ltsRecibidosTranspTotal += lts;
                    cantDespachosTransp++;
                } else {
                    ltsSalidasRutaTotal += lts;
                    ltsRecibidosRutaTotal += lts;
                    cantDespachosRuta++;
                }
            });
        }

        // Redondeo exacto
        ltsRutaFincas = Math.round(ltsRutaFincas);
        ltsRutaSilos = Math.round(ltsRutaSilos);
        ltsRutaDirectos = Math.round(ltsRutaDirectos);
        const ltsRutaFincasVerificadas = Math.round(ltsRutaFincasSilos + ltsRutaFincasDirectos);
        const ltsRutaVerificadosTotal = Math.round(ltsRutaSilos + ltsRutaDirectos);

        let ltsDespachosRutaTotal = Math.round(ltsSalidasRutaTotal);
        if (ltsDespachosRutaTotal === 0 && ltsRutaDirectos > 0) {
            ltsDespachosRutaTotal = Math.round(ltsRutaDirectos);
        }

        // Salidas desde silos
        const ltsSalidasDesdeSilosRuta = Math.max(0, Math.round(ltsDespachosRutaTotal - ltsRutaDirectos));
        
        // Stock en silos RUTA
        let ltsEnTanqueRuta = 0;
        if (balanceVol && balanceVol.stockActualTanque !== undefined && balanceVol.stockActualTanque !== null) {
            ltsEnTanqueRuta = Math.round(balanceVol.stockActualTanque);
        } else {
            ltsEnTanqueRuta = Math.max(0, Math.round(ltsRutaSilos - ltsSalidasDesdeSilosRuta));
        }
        const pctEnTanqueRuta = ltsRutaSilos > 0 ? ((ltsEnTanqueRuta / ltsRutaSilos) * 100).toFixed(1) : '0.0';

        // Merma RUTA
        const mermaTotalConsolidadaRuta = ltsRutaFincasVerificadas > 0 ? Math.round(ltsRutaFincasVerificadas - ltsRutaVerificadosTotal) : 0;
        const baseLitrosRuta = ltsRutaFincasVerificadas > 0 ? ltsRutaFincasVerificadas : ltsRutaVerificadosTotal;
        const mermaRutaPct = baseLitrosRuta > 0 ? ((Math.abs(mermaTotalConsolidadaRuta) / baseLitrosRuta) * 100).toFixed(2) : '0.00';
        const ltsRutaPendientes = Math.max(0, Math.round(ltsRutaFincas - ltsRutaFincasVerificadas));

        // SERVICIO DE TRANSPORTE
        ltsTranspFincas = Math.round(ltsTranspFincas);
        const ltsTranspVerificadosTotal = Math.round(ltsTranspEntregados);
        let ltsDespachosTranspTotal = Math.round(ltsSalidasTranspTotal);
        if (ltsDespachosTranspTotal === 0 && ltsTranspEntregados > 0) {
            ltsDespachosTranspTotal = Math.round(ltsTranspEntregados);
        }
        const ltsTranspPendientes = Math.max(0, Math.round(ltsTranspFincas - ltsTranspFincasVerificadas));
        const mermaTranspLitros = ltsTranspFincasVerificadas > 0 ? Math.round(ltsTranspFincasVerificadas - ltsTranspVerificadosTotal) : 0;
        const baseLitrosTransp = ltsTranspFincasVerificadas > 0 ? ltsTranspFincasVerificadas : ltsTranspVerificadosTotal;
        const mermaTranspPct = baseLitrosTransp > 0 ? ((Math.abs(mermaTranspLitros) / baseLitrosTransp) * 100).toFixed(2) : '0.00';

        // TOTALES GLOBALES CONSOLIDADOS
        const totalLitrosGlobal = Math.round(ltsRutaFincas + ltsTranspFincas);
        const totalEntradaSilosGlobal = Math.round(ltsRutaSilos);
        const totalEnTanqueGlobal = Math.round(ltsEnTanqueRuta);
        const totalDespachadoGlobal = Math.round(ltsDespachosRutaTotal + ltsDespachosTranspTotal);
        const ltsGlobalPendientes = Math.round(ltsRutaPendientes + ltsTranspPendientes);
        const mermaGlobalLitros = Math.round(mermaTotalConsolidadaRuta + mermaTranspLitros);
        const baseLitrosGlobalVerificados = Math.round(ltsRutaFincasVerificadas + ltsTranspFincasVerificadas);
        const baseLitrosGlobal = baseLitrosGlobalVerificados > 0 ? baseLitrosGlobalVerificados : (totalEntradaSilosGlobal + totalDespachadoGlobal);
        const mermaGlobalPct = baseLitrosGlobal > 0 ? ((Math.abs(mermaGlobalLitros) / baseLitrosGlobal) * 100).toFixed(2) : '0.00';
        const pctInventario = totalEntradaSilosGlobal > 0 ? ((totalEnTanqueGlobal / totalEntradaSilosGlobal) * 100).toFixed(1) : '0.0';

        const ltsSalidasCompaniasTotal = Math.round(ltsDespachosRutaTotal + ltsDespachosTranspTotal);
        const ltsRecibidosCompaniasTotal = Math.round(ltsRecibidosRutaTotal + ltsRecibidosTranspTotal);
        const variacionCompaniasLitros = ltsSalidasCompaniasTotal > 0 ? Math.round(ltsSalidasCompaniasTotal - ltsRecibidosCompaniasTotal) : 0;
        const variacionCompaniasPct = ltsSalidasCompaniasTotal > 0 ? ((Math.abs(variacionCompaniasLitros) / ltsSalidasCompaniasTotal) * 100).toFixed(2) : '0.00';

        // --------------------------------------------------------------------------
        // ACTUALIZAR KPIS - BLOQUE 1: SERVICIO DE RUTA (5 CUADROS + BANNER)
        // --------------------------------------------------------------------------
        const elKpiRutaFincas = document.getElementById('kpiRutaLitrosFincas');
        if (elKpiRutaFincas) elKpiRutaFincas.innerHTML = `${Math.round(ltsRutaFincas).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiRutaFincasCount = document.getElementById('kpiRutaFincasCount');
        if (elKpiRutaFincasCount) {
            const txtPend = ltsRutaPendientes > 0 ? ` (${ltsRutaPendientes.toLocaleString('es-VE')} L en tránsito)` : '';
            elKpiRutaFincasCount.textContent = `${fincasRutaSet.size} Fincas | ${ltsRutaFincasVerificadas.toLocaleString('es-VE')} L procesados${txtPend}`;
        }

        const elKpiRutaReceptoria = document.getElementById('kpiRutaLitrosReceptoria');
        if (elKpiRutaReceptoria) elKpiRutaReceptoria.innerHTML = `${Math.round(ltsRutaSilos).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiRutaPlantasCount = document.getElementById('kpiRutaPlantasCount');
        if (elKpiRutaPlantasCount) elKpiRutaPlantasCount.textContent = `${cantViajesRutaSilos} ${cantViajesRutaSilos === 1 ? 'Descarga en Silos' : 'Descargas en Silos'}`;

        const elKpiRutaEnTanque = document.getElementById('kpiRutaLitrosEnTanque');
        if (elKpiRutaEnTanque) elKpiRutaEnTanque.innerHTML = `${ltsEnTanqueRuta.toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiRutaEnTanqueFoot = document.getElementById('kpiRutaEnTanqueFoot');
        if (elKpiRutaEnTanqueFoot) elKpiRutaEnTanqueFoot.textContent = `${pctEnTanqueRuta}% disponible en silos`;

        const elKpiRutaDesp = document.getElementById('kpiRutaLitrosDespachados');
        if (elKpiRutaDesp) elKpiRutaDesp.innerHTML = `${ltsDespachosRutaTotal.toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiRutaDespCount = document.getElementById('kpiRutaDespachadosCount');
        if (elKpiRutaDespCount) elKpiRutaDespCount.textContent = `${cantDespachosRuta > 0 ? cantDespachosRuta : cantViajesRutaDirectos} Despacho(s) a queseras`;

        const elKpiRutaMerma = document.getElementById('kpiRutaMermaLitros');
        if (elKpiRutaMerma) {
            const signo = mermaTotalConsolidadaRuta > 0 ? '-' : (mermaTotalConsolidadaRuta < 0 ? '+' : '');
            elKpiRutaMerma.innerHTML = `${signo}${Math.abs(mermaTotalConsolidadaRuta).toLocaleString('es-VE')} <small>Lts</small>`;
            elKpiRutaMerma.style.color = mermaTotalConsolidadaRuta > 0 ? '#e11d48' : (mermaTotalConsolidadaRuta < 0 ? '#16a34a' : '#ca8a04');
        }

        const elKpiRutaMermaPct = document.getElementById('kpiRutaMermaPct');
        if (elKpiRutaMermaPct) {
            const estado = mermaTotalConsolidadaRuta === 0 ? 'Exacto (0.00%)' : (mermaTotalConsolidadaRuta > 0 ? 'Faltante en recepción' : 'Excedente a favor');
            const txtPend = ltsRutaPendientes > 0 ? ` | ${ltsRutaPendientes.toLocaleString('es-VE')} Lts en tránsito` : '';
            elKpiRutaMermaPct.textContent = `${mermaRutaPct}% | ${estado}${txtPend}`;
            elKpiRutaMermaPct.style.color = mermaTotalConsolidadaRuta > 0 ? '#e11d48' : (mermaTotalConsolidadaRuta < 0 ? '#16a34a' : '#ca8a04');
        }

        // Actualizar Banner de Balance RUTA
        const elBannerRutaText = document.getElementById('kpiRutaBalanceText');
        const elBannerRutaBadge = document.getElementById('kpiRutaBalanceBadge');
        if (elBannerRutaText) {
            const balanceCalc = ltsEnTanqueRuta + ltsDespachosRutaTotal + ltsRutaPendientes + mermaTotalConsolidadaRuta;
            const balanceExacto = Math.abs(balanceCalc - ltsRutaFincas) <= 2;
            elBannerRutaText.innerHTML = `<i class="fa-solid fa-scale-balanced" style="color: #3b82f6;"></i> <strong>Cuadre de Balance RUTA:</strong> Recolección (${Math.round(ltsRutaFincas).toLocaleString('es-VE')} L) = En Silos (${Math.round(ltsEnTanqueRuta).toLocaleString('es-VE')} L) + Despachado (${Math.round(ltsDespachosRutaTotal).toLocaleString('es-VE')} L) + En Tránsito (${Math.round(ltsRutaPendientes).toLocaleString('es-VE')} L) + Merma (${Math.round(mermaTotalConsolidadaRuta).toLocaleString('es-VE')} L)`;
            if (elBannerRutaBadge) {
                elBannerRutaBadge.textContent = balanceExacto ? '100% Cuadrado' : `Dif: ${Math.round(ltsRutaFincas - balanceCalc)} L`;
                elBannerRutaBadge.style.background = balanceExacto ? '#10b981' : '#f59e0b';
            }
        }

        // --------------------------------------------------------------------------
        // ACTUALIZAR KPIS - BLOQUE 2: SERVICIO DE TRANSPORTE (5 CUADROS + BANNER)
        // --------------------------------------------------------------------------
        const elKpiTranspFincas = document.getElementById('kpiTranspLitrosFincas');
        if (elKpiTranspFincas) elKpiTranspFincas.innerHTML = `${Math.round(ltsTranspFincas).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiTranspFincasCount = document.getElementById('kpiTranspFincasCount');
        if (elKpiTranspFincasCount) {
            const txtPend = ltsTranspPendientes > 0 ? ` (${ltsTranspPendientes.toLocaleString('es-VE')} L en tránsito)` : '';
            elKpiTranspFincasCount.textContent = `${fincasTranspSet.size} Fincas | ${ltsTranspFincasVerificadas.toLocaleString('es-VE')} L procesados${txtPend}`;
        }

        const elKpiTranspReceptoria = document.getElementById('kpiTranspLitrosReceptoria');
        if (elKpiTranspReceptoria) elKpiTranspReceptoria.innerHTML = `${Math.round(ltsTranspVerificadosTotal).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiTranspPlantasCount = document.getElementById('kpiTranspPlantasCount');
        if (elKpiTranspPlantasCount) elKpiTranspPlantasCount.textContent = `${plantasTranspSet.size} ${plantasTranspSet.size === 1 ? 'Planta recibida' : 'Plantas recibidas'}`;

        const elKpiTranspEnTanque = document.getElementById('kpiTranspLitrosEnTanque');
        if (elKpiTranspEnTanque) elKpiTranspEnTanque.innerHTML = `${ltsTranspPendientes.toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiTranspEnTanqueFoot = document.getElementById('kpiTranspEnTanqueFoot');
        if (elKpiTranspEnTanqueFoot) elKpiTranspEnTanqueFoot.textContent = ltsTranspPendientes > 0 ? 'En viaje a planta cliente' : 'Sin viajes pendientes';

        const elKpiTranspDesp = document.getElementById('kpiTranspLitrosDespachados');
        if (elKpiTranspDesp) elKpiTranspDesp.innerHTML = `${ltsDespachosTranspTotal.toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiTranspDespCount = document.getElementById('kpiTranspDespachadosCount');
        if (elKpiTranspDespCount) elKpiTranspDespCount.textContent = `${cantDespachosTransp > 0 ? cantDespachosTransp : cantViajesTranspEntregados} Entrega(s) realizadas`;

        const elKpiTranspMerma = document.getElementById('kpiTranspMermaLitros');
        if (elKpiTranspMerma) {
            const signo = mermaTranspLitros > 0 ? '-' : (mermaTranspLitros < 0 ? '+' : '');
            elKpiTranspMerma.innerHTML = `${signo}${Math.abs(mermaTranspLitros).toLocaleString('es-VE')} <small>Lts</small>`;
            elKpiTranspMerma.style.color = mermaTranspLitros > 0 ? '#e11d48' : (mermaTranspLitros < 0 ? '#16a34a' : '#ca8a04');
        }

        const elKpiTranspMermaPct = document.getElementById('kpiTranspMermaPct');
        if (elKpiTranspMermaPct) {
            const estado = mermaTranspLitros === 0 ? 'Exacto (0.00%)' : (mermaTranspLitros > 0 ? 'Faltante en entrega' : 'Excedente a favor');
            const txtPend = ltsTranspPendientes > 0 ? ` | ${ltsTranspPendientes.toLocaleString('es-VE')} Lts en tránsito` : '';
            elKpiTranspMermaPct.textContent = `${mermaTranspPct}% | ${estado}${txtPend}`;
            elKpiTranspMermaPct.style.color = mermaTranspLitros > 0 ? '#e11d48' : (mermaTranspLitros < 0 ? '#16a34a' : '#ca8a04');
        }

        // Actualizar Banner de Balance TRANSPORTE
        const elBannerTranspText = document.getElementById('kpiTranspBalanceText');
        const elBannerTranspBadge = document.getElementById('kpiTranspBalanceBadge');
        if (elBannerTranspText) {
            const balanceTranspCalc = ltsDespachosTranspTotal + ltsTranspPendientes + mermaTranspLitros;
            const balanceTranspExacto = Math.abs(balanceTranspCalc - ltsTranspFincas) <= 2;
            elBannerTranspText.innerHTML = `<i class="fa-solid fa-scale-balanced" style="color: #8b5cf6;"></i> <strong>Cuadre de Balance TRANSPORTE:</strong> Recolección (${Math.round(ltsTranspFincas).toLocaleString('es-VE')} L) = Despachado (${Math.round(ltsDespachosTranspTotal).toLocaleString('es-VE')} L) + En Tránsito (${Math.round(ltsTranspPendientes).toLocaleString('es-VE')} L) + Merma (${Math.round(mermaTranspLitros).toLocaleString('es-VE')} L)`;
            if (elBannerTranspBadge) {
                elBannerTranspBadge.textContent = balanceTranspExacto ? '100% Cuadrado' : `Dif: ${Math.round(ltsTranspFincas - balanceTranspCalc)} L`;
                elBannerTranspBadge.style.background = balanceTranspExacto ? '#10b981' : '#f59e0b';
            }
        }

        // --------------------------------------------------------------------------
        // ACTUALIZAR KPIS - BLOQUE 3: CONSOLIDADO GENERAL (5 CUADROS + BANNER)
        // --------------------------------------------------------------------------
        const elKpiTotalGlobal = document.getElementById('kpiTotalLitrosGlobal');
        if (elKpiTotalGlobal) elKpiTotalGlobal.innerHTML = `${Math.round(totalLitrosGlobal).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiFincasGlobal = document.getElementById('kpiTotalFincasGlobal');
        if (elKpiFincasGlobal) {
            const txtPend = ltsGlobalPendientes > 0 ? ` (${ltsGlobalPendientes.toLocaleString('es-VE')} L en tránsito)` : '';
            elKpiFincasGlobal.textContent = `${fincasRutaSet.size + fincasTranspSet.size} Fincas | ${(ltsRutaFincasVerificadas + ltsTranspFincasVerificadas).toLocaleString('es-VE')} L procesados${txtPend}`;
        }

        const elKpiReceptoriaGlobal = document.getElementById('kpiTotalReceptoriaGlobal');
        if (elKpiReceptoriaGlobal) elKpiReceptoriaGlobal.innerHTML = `${Math.round(totalEntradaSilosGlobal).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiPlantasGlobal = document.getElementById('kpiTotalPlantasGlobal');
        if (elKpiPlantasGlobal) elKpiPlantasGlobal.textContent = `${new Set([...plantasRutaSet, ...plantasTranspSet]).size} Plantas / Receptorías`;

        const elKpiInventario = document.getElementById('kpiInventarioTanqueLitros');
        if (elKpiInventario) elKpiInventario.innerHTML = `${totalEnTanqueGlobal.toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiInventarioFoot = document.getElementById('kpiInventarioTanqueFoot');
        if (elKpiInventarioFoot) elKpiInventarioFoot.textContent = `${pctInventario}% stock en silos`;

        const elKpiCompDesp = document.getElementById('kpiCompLitrosDespachados');
        const cantDespachos = (despachos && despachos.length > 0) ? despachos.length : (entregas && entregas.length > 0 ? entregas.length : 0);
        if (elKpiCompDesp) elKpiCompDesp.innerHTML = `${Math.round(totalDespachadoGlobal).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiCompDespCount = document.getElementById('kpiCompDespachadosCount');
        if (elKpiCompDespCount) elKpiCompDespCount.textContent = `${cantDespachos} Despachos realizados`;

        const elKpiCompDesp2 = document.getElementById('kpiCompLitrosDespachados2');
        if (elKpiCompDesp2) elKpiCompDesp2.innerHTML = `${Math.round(totalDespachadoGlobal).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiCompDespCount2 = document.getElementById('kpiCompDespachadosCount2');
        if (elKpiCompDespCount2) elKpiCompDespCount2.textContent = `${cantDespachos} Despachos realizados`;

        const elKpiMermaGlobal = document.getElementById('kpiTotalMermaGlobalLitros') || document.getElementById('kpiMermaLitrosGlobal');
        if (elKpiMermaGlobal) {
            const signo = mermaGlobalLitros > 0 ? '-' : (mermaGlobalLitros < 0 ? '+' : '');
            elKpiMermaGlobal.innerHTML = `${signo}${Math.abs(mermaGlobalLitros).toLocaleString('es-VE')} <small>Lts</small>`;
            elKpiMermaGlobal.style.color = mermaGlobalLitros > 0 ? '#e11d48' : (mermaGlobalLitros < 0 ? '#16a34a' : '#ca8a04');
        }

        const elKpiMermaPctGlobal = document.getElementById('kpiTotalMermaGlobalPct') || document.getElementById('kpiMermaPctGlobal');
        if (elKpiMermaPctGlobal) {
            const estado = mermaGlobalLitros === 0 ? 'Exacto (0.00%)' : (mermaGlobalLitros > 0 ? 'Faltante en recepción' : 'Excedente a favor');
            const txtPend = ltsGlobalPendientes > 0 ? ` | ${ltsGlobalPendientes.toLocaleString('es-VE')} Lts en tránsito` : '';
            elKpiMermaPctGlobal.textContent = `${mermaGlobalPct}% | ${estado}${txtPend}`;
            elKpiMermaPctGlobal.style.color = mermaGlobalLitros > 0 ? '#e11d48' : (mermaGlobalLitros < 0 ? '#16a34a' : '#ca8a04');
        }

        // Actualizar Banner de Balance GLOBAL
        const elBannerGlobalText = document.getElementById('kpiGlobalBalanceText');
        const elBannerGlobalBadge = document.getElementById('kpiGlobalBalanceBadge');
        if (elBannerGlobalText) {
            const balanceGlobalCalc = totalEnTanqueGlobal + totalDespachadoGlobal + ltsGlobalPendientes + mermaGlobalLitros;
            const balanceGlobalExacto = Math.abs(balanceGlobalCalc - totalLitrosGlobal) <= 2;
            elBannerGlobalText.innerHTML = `<i class="fa-solid fa-scale-balanced" style="color: #059669;"></i> <strong>Balance Operativo Global:</strong> Total Campo (${Math.round(totalLitrosGlobal).toLocaleString('es-VE')} L) = Stock en Silos (${Math.round(totalEnTanqueGlobal).toLocaleString('es-VE')} L) + Despachos (${Math.round(totalDespachadoGlobal).toLocaleString('es-VE')} L) + En Tránsito (${Math.round(ltsGlobalPendientes).toLocaleString('es-VE')} L) + Merma (${Math.round(mermaGlobalLitros).toLocaleString('es-VE')} L)`;
            if (elBannerGlobalBadge) {
                elBannerGlobalBadge.textContent = balanceGlobalExacto ? '100% Conciliado' : `Dif: ${Math.round(totalLitrosGlobal - balanceGlobalCalc)} L`;
                elBannerGlobalBadge.style.background = balanceGlobalExacto ? '#059669' : '#f59e0b';
            }
        }

        // ACTUALIZAR KPIS - BLOQUE 4: DESPACHOS Y BALANCE EN QUESERAS
        const elKpiCompRec = document.getElementById('kpiCompLitrosRecibidos');
        if (elKpiCompRec) elKpiCompRec.innerHTML = `${Math.round(ltsRecibidosCompaniasTotal).toLocaleString('es-VE')} <small>Lts</small>`;

        const elKpiCompQueserasCount = document.getElementById('kpiCompQueserasCount');
        if (elKpiCompQueserasCount) elKpiCompQueserasCount.textContent = `${queserasSalidaSet.size} ${queserasSalidaSet.size === 1 ? 'Quesera / Planta' : 'Queseras / Plantas'}`;

        const elKpiCompVariacion = document.getElementById('kpiCompVariacionLitros');
        const elKpiCompVariacionPct = document.getElementById('kpiCompVariacionPct');
        const cardVarComp = document.getElementById('cardVariacionCompanias');
        const iconWrapVarComp = document.getElementById('iconWrapVariacionCompanias');

        if (elKpiCompVariacion) {
            const signoComp = variacionCompaniasLitros < 0 ? '+' : (variacionCompaniasLitros > 0 ? '-' : '');
            elKpiCompVariacion.innerHTML = `${signoComp}${Math.abs(variacionCompaniasLitros).toLocaleString('es-VE')} <small>Lts</small>`;

            if (variacionCompaniasLitros < 0) {
                elKpiCompVariacion.style.color = '#16a34a';
                if (elKpiCompVariacionPct) {
                    elKpiCompVariacionPct.textContent = `+${variacionCompaniasPct}% | Excedente / Ganancia a favor en queseras`;
                    elKpiCompVariacionPct.style.color = '#16a34a';
                }
                if (iconWrapVarComp) {
                    iconWrapVarComp.style.background = 'rgba(22, 163, 74, 0.15)';
                    iconWrapVarComp.style.color = '#16a34a';
                }
            } else if (variacionCompaniasLitros > 0) {
                elKpiCompVariacion.style.color = '#e11d48';
                if (elKpiCompVariacionPct) {
                    elKpiCompVariacionPct.textContent = `-${variacionCompaniasPct}% | Faltante en queseras`;
                    elKpiCompVariacionPct.style.color = '#e11d48';
                }
                if (iconWrapVarComp) {
                    iconWrapVarComp.style.background = 'rgba(225, 29, 72, 0.15)';
                    iconWrapVarComp.style.color = '#e11d48';
                }
            } else {
                elKpiCompVariacion.style.color = '#0284c7';
                if (elKpiCompVariacionPct) {
                    elKpiCompVariacionPct.textContent = `0.00% | Exacto`;
                    elKpiCompVariacionPct.style.color = '#0284c7';
                }
            }
        }

        const elKpiTasa = document.getElementById('kpiTasaBcv');
        if (elKpiTasa && state.tasaBcv) {
            elKpiTasa.innerHTML = `${Number(state.tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <small>Bs/$</small>`;
        }

        // Cargar y Renderizar los 5 Gráficos Avanzados
        state.ltsRutaFincasGlobal = ltsRutaFincas;
        state.ltsTranspFincasGlobal = ltsTranspFincas;
        renderChart3DistribucionServicios(ltsRutaFincas, ltsTranspFincas);
        cargarGraficosAvanzadosDashboard();

    } catch (err) {
        console.warn('Error al procesar el dashboard:', err);
    }
}
window.cargarDashboard = cargarDashboard;

async function cargarGraficosAvanzadosDashboard(semanas) {
    if (!semanas) {
        const select = document.getElementById('selectSemanasDashboard');
        semanas = select ? (parseInt(select.value) || 8) : 8;
    }

    const lbl = document.getElementById('lblCantSemanas');
    if (lbl) lbl.textContent = semanas;

    try {
        const res = await fetch(`${API_BASE}/reportes/dashboard-avanzado?semanas=${semanas}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) return;
        const data = await res.json();

        renderChart1Tendencia8Semanas(data.tendenciaSemanas || []);
        renderChart2DesempenoConductores(data.desempenoConductores || []);
        renderChart3DistribucionServicios(state.ltsRutaFincasGlobal || 0, state.ltsTranspFincasGlobal || 0);
        renderChart4DistribucionPlantas(data.entregasPlantas || []);
        renderChart5LecheAcidaFincas(data.lecheAcidaFincas || []);
    } catch (e) {
        console.warn('Error al cargar gráficos avanzados del dashboard:', e);
    }
}
window.cargarGraficosAvanzadosDashboard = cargarGraficosAvanzadosDashboard;

window.cambiarSemanasDashboard = function(val) {
    const sem = parseInt(val) || 8;
    cargarGraficosAvanzadosDashboard(sem);
};

function renderChart1Tendencia8Semanas(data) {
    const canvas = document.getElementById('chartTendencia8Semanas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartTendencia8SemanasInstance) {
        window.chartTendencia8SemanasInstance.destroy();
    }

    const labels = data.map(d => d.semana);
    const recolectados = data.map(d => d.recolectado);
    const entregados = data.map(d => d.entregado);

    window.chartTendencia8SemanasInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Litros Recolectados en Finca',
                    data: recolectados,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7
                },
                {
                    label: 'Litros Entregados en Planta',
                    data: entregados,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1', font: { family: 'Inter', weight: '600' } } },
                tooltip: {
                    callbacks: {
                        afterBody: function(items) {
                            const idx = items[0].dataIndex;
                            const rec = recolectados[idx] || 0;
                            const ent = entregados[idx] || 0;
                            const diff = rec - ent;
                            const pct = rec > 0 ? ((Math.abs(diff) / rec) * 100).toFixed(2) : '0.00';
                            return `Merma / Pérdida: ${diff > 0 ? '-' : (diff < 0 ? '+' : '')}${Math.abs(diff).toLocaleString('es-VE')} Lts (${pct}%)`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function renderChart2DesempenoConductores(data) {
    const canvas = document.getElementById('chartDesempenoConductores');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartDesempenoConductoresInstance) {
        window.chartDesempenoConductoresInstance.destroy();
    }

    const labels = data.map(d => d.conductor);
    const litros = data.map(d => d.litros);
    const viajes = data.map(d => d.viajes);

    window.chartDesempenoConductoresInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Litros Recolectados',
                    data: litros,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Número de Viajes',
                    data: viajes,
                    backgroundColor: 'rgba(168, 85, 247, 0.8)',
                    borderColor: '#a855f7',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1', font: { family: 'Inter', weight: '600' } } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: {
                    type: 'linear',
                    position: 'left',
                    ticks: { color: '#60a5fa' },
                    title: { display: true, text: 'Litros', color: '#60a5fa' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    ticks: { color: '#c084fc' },
                    title: { display: true, text: 'Viajes', color: '#c084fc' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function renderChart3DistribucionServicios(ltsRuta, ltsTransp) {
    const canvas = document.getElementById('chartDistribucionServicios');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartDistribucionServiciosInstance) {
        window.chartDistribucionServiciosInstance.destroy();
    }

    const rLts = Math.round(ltsRuta || 0);
    const tLts = Math.round(ltsTransp || 0);
    const total = rLts + tLts;

    const pctRuta = total > 0 ? ((rLts / total) * 100).toFixed(1) : '0.0';
    const pctTransp = total > 0 ? ((tLts / total) * 100).toFixed(1) : '0.0';

    const labels = [
        `Servicio de Ruta: ${rLts.toLocaleString('es-VE')} Lts (${pctRuta}%)`,
        `Servicio de Transporte: ${tLts.toLocaleString('es-VE')} Lts (${pctTransp}%)`
    ];

    window.chartDistribucionServiciosInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: [rLts, tLts],
                backgroundColor: ['#60a5fa', '#a78bfa'],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#cbd5e1', font: { family: 'Inter', weight: '600', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
                            return ` ${Math.round(val).toLocaleString('es-VE')} Lts (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
window.renderChart3DistribucionServicios = renderChart3DistribucionServicios;

function renderChart5LecheAcidaFincas(data) {
    const canvas = document.getElementById('chartLecheAcidaFincas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartLecheAcidaFincasInstance) {
        window.chartLecheAcidaFincasInstance.destroy();
    }

    const labels = data.map(d => d.finca);
    const litrosAcidos = data.map(d => Math.round(d.litrosAcidos || 0));

    window.chartLecheAcidaFincasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Sin Leche Ácida'],
            datasets: [{
                label: 'Litros de Leche Ácida',
                data: litrosAcidos.length ? litrosAcidos : [0],
                backgroundColor: 'rgba(244, 63, 94, 0.8)',
                borderColor: '#f43f5e',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1', font: { family: 'Inter', weight: '600' } } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}
window.renderChart5LecheAcidaFincas = renderChart5LecheAcidaFincas;

function renderChart4DistribucionPlantas(data) {
    const canvas = document.getElementById('chartDistribucionPlantas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartDistribucionPlantasInstance) {
        window.chartDistribucionPlantasInstance.destroy();
    }

    const labels = data.map(d => d.planta);
    const litros = data.map(d => Math.round(d.litros || 0));
    const totalLitros = litros.reduce((a, b) => a + b, 0);
    const colores = [
        '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', 
        '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#e11d48'
    ];

    window.chartDistribucionPlantasInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['Sin Despachos a Plantas'],
            datasets: [{
                data: litros.length ? litros : [0],
                backgroundColor: labels.length ? colores.slice(0, labels.length) : ['rgba(148, 163, 184, 0.2)'],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'right', 
                    labels: { color: '#cbd5e1', font: { family: 'Inter', weight: '600', size: 11 } } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const pct = totalLitros > 0 ? ((val / totalLitros) * 100).toFixed(1) : '0.0';
                            return ` ${context.label}: ${Math.round(val).toLocaleString('es-VE')} Lts (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderChart5AdelantosRiesgo(data) {
    if (state.user && state.user.rol === 'CHOFER') return;
    const canvas = document.getElementById('chartAdelantosRiesgo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartAdelantosRiesgoInstance) {
        window.chartAdelantosRiesgoInstance.destroy();
    }

    const labels = data.map(d => d.beneficiario);
    const montosUSD = data.map(d => d.montoPendienteUSD);

    window.chartAdelantosRiesgoInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monto Pendiente ($ USD)',
                data: montosUSD,
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1', font: { family: 'Inter', weight: '600' } } },
                tooltip: {
                    callbacks: {
                        label: function(item) {
                            return `Pendiente: $${Number(item.raw).toLocaleString('es-VE', { minimumFractionDigits: 2 })} USD`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}


function renderChartServiciosDashboard(ltsRuta, ltsTransp) {
    const canvas = document.getElementById('chartChoferesDashboard');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const total = ltsRuta + ltsTransp;
    const badge = document.getElementById('badgeTotalChoferesDash');
    if (badge) badge.textContent = `${total.toLocaleString('es-VE')} Lts Totales`;

    if (chartChoferesInstance) chartChoferesInstance.destroy();

    if (total === 0) {
        chartChoferesInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sin Datos'],
                datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.05)'], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
        return;
    }

    chartChoferesInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Servicio RUTA', 'Servicio TRANSPORTE'],
            datasets: [{
                data: [ltsRuta, ltsTransp],
                backgroundColor: ['#3b82f6', '#8b5cf6'],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#475569', font: { size: 12.5, weight: 'bold' }, padding: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => ` ${item.label}: ${item.raw.toLocaleString('es-VE')} Lts (${total > 0 ? ((item.raw / total) * 100).toFixed(1) : 0}%)`
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function renderChartTopCompaniasDashboard(companiasMap, totalLitros) {
    const canvas = document.getElementById('chartTopFincasDashboard');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = Object.keys(companiasMap);
    const data = Object.values(companiasMap);

    const badge = document.getElementById('badgeTopCompaniasDash');
    if (badge) badge.textContent = `${totalLitros.toLocaleString('es-VE')} Lts Receptoría`;

    if (chartTopFincasInstance) chartTopFincasInstance.destroy();

    if (labels.length === 0) {
        chartTopFincasInstance = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: ['Sin Entregas Registradas'], 
                datasets: [{ 
                    label: 'Litros Receptoría', 
                    data: [0], 
                    backgroundColor: 'rgba(0,0,0,0.05)' 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } } 
            }
        });
        return;
    }

    chartTopFincasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Litros Entregados',
                data: data,
                backgroundColor: 'rgba(5, 150, 105, 0.85)',
                borderColor: '#059669',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) => ` Entregado: ${item.raw.toLocaleString('es-VE')} Lts`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#0f172a', font: { size: 11, weight: 'bold' } }
                }
            }
        }
    });
}

function renderChartBalanceServiciosDashboard(ltsRutaFincas, ltsRutaRec, mermaRuta, ltsTranspFincas, ltsTranspRec, mermaTransp) {
    const canvas = document.getElementById('chartBalanceDashboard');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const badge = document.getElementById('badgeEfectividadDash');
    if (badge) badge.textContent = 'Ruta vs Transporte';

    if (chartBalanceInstance) chartBalanceInstance.destroy();

    chartBalanceInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Recolección (Fincas)', 'Receptoría (Plantas)', 'Merma / Diferencia'],
            datasets: [
                {
                    label: 'Servicio RUTA',
                    data: [ltsRutaFincas, ltsRutaRec, Math.abs(mermaRuta)],
                    backgroundColor: 'rgba(59, 130, 246, 0.85)',
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    borderRadius: 6
                },
                {
                    label: 'Servicio TRANSPORTE',
                    data: [ltsTranspFincas, ltsTranspRec, Math.abs(mermaTransp)],
                    backgroundColor: 'rgba(139, 92, 246, 0.85)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1.5,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#475569', font: { size: 11, weight: 'bold' } }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => ` ${item.dataset.label} - ${item.label}: ${item.raw.toLocaleString('es-VE')} Lts`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#0f172a', font: { size: 11, weight: 'bold' } }
                }
            }
        }
    });
}

function renderChartTendenciaDashboard(rutas, entregas, modo) {
    const canvas = document.getElementById('chartTendenciaDashboard');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const badge = document.getElementById('badgeSemanaDash');
    if (badge) {
        badge.textContent = modo === 'semana' ? 'Días de la Semana Operativa' : 'Comparativa de Recolección';
    }

    if (chartTendenciaInstance) chartTendenciaInstance.destroy();

    // Agrupar por fecha
    const fechasMap = {};
    (rutas || []).forEach(r => {
        const f = (r.fecha || '').split('T')[0];
        if (!f) return;
        if (!fechasMap[f]) fechasMap[f] = { rutas: 0, receptoria: 0 };
        fechasMap[f].rutas += Number(r.litros || 0);
    });

    (entregas || []).forEach(e => {
        const f = (e.fecha || '').split('T')[0];
        if (!f) return;
        if (!fechasMap[f]) fechasMap[f] = { rutas: 0, receptoria: 0 };
        fechasMap[f].receptoria += Number(e.litros || 0);
    });

    let labels = Object.keys(fechasMap).sort();
    if (labels.length === 0) {
        labels = ['Sin Registros'];
        fechasMap['Sin Registros'] = { rutas: 0, receptoria: 0 };
    }

    const dataRutas = labels.map(f => fechasMap[f]?.rutas || 0);
    const dataReceptoria = labels.map(f => fechasMap[f]?.receptoria || 0);

    chartTendenciaInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => {
                if (l === 'Sin Registros') return l;
                const parts = l.split('-');
                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : l;
            }),
            datasets: [
                {
                    label: 'Rutas (Lts)',
                    data: dataRutas,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Receptoría (Lts)',
                    data: dataReceptoria,
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#475569', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => ` ${item.dataset.label}: ${item.raw.toLocaleString('es-VE')} Lts`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#475569', font: { size: 11 } }
                }
            }
        }
    });
}

// --------------------------------------------------------------------------
// SINCRONIZACIÓN INTELIGENTE DE TASA BCV
// --------------------------------------------------------------------------
async function sincronizarTasaBcvDesdeApi(triggerBtn = null) {
    let originalHtml = '';
    if (triggerBtn) {
        originalHtml = triggerBtn.innerHTML;
        triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        triggerBtn.disabled = true;
    }

    try {
        let resApi = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!resApi.ok) {
            resApi = await fetch('https://ve.dolarapi.com/v1/dolares');
        }

        const dataApi = await resApi.json();
        let valorTasa = 0;

        if (Array.isArray(dataApi)) {
            const oficial = dataApi.find(d => d.fuente === 'oficial' || (d.nombre && d.nombre.toLowerCase().includes('oficial')) || (d.nombre && d.nombre.toLowerCase().includes('dolar'))) || dataApi[0];
            valorTasa = Number(oficial.promedio || oficial.valor || 0);
        } else {
            valorTasa = Number(dataApi.promedio || dataApi.valor || 0);
        }

        if (!valorTasa || valorTasa <= 0) {
            throw new Error('No se pudo extraer el valor promedio de la tasa desde DolarAPI.');
        }

        const tasaActual = Number(state.tasaBcv || 0);

        // Validación: Consultar si el monto anterior y el nuevo son iguales
        if (tasaActual > 0 && Math.abs(valorTasa - tasaActual) < 0.0001) {
            Swal.fire({
                icon: 'info',
                title: 'Tasa BCV al Día',
                html: `La tasa oficial actual ya coincide exactamente con el valor reportado: <br><strong style="font-size: 22px; color: #fbbf24; display: block; margin: 12px 0;">Bs. ${valorTasa.toFixed(4)}</strong> No requiere actualización.`,
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        // Si son distintos (o no había tasa), registrar el nuevo monto
        const hoyStr = new Date().toISOString().split('T')[0];
        const resGuardar = await fetch(`${API_BASE}/bcv`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha: hoyStr,
                tasaDolarBs: valorTasa,
                fuente: 'DolarAPI Oficial (BCV)',
                observacion: `Sincronización automática (${new Date().toLocaleTimeString('es-VE')})`
            })
        });

        if (!resGuardar.ok) {
            const errData = await resGuardar.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al guardar la tasa en el servidor.');
        }

        state.tasaBcv = valorTasa;
        await cargarTasaBcv();
        if (typeof cargarDashboard === 'function') cargarDashboard();

        Swal.fire({
            icon: 'success',
            title: 'Tasa BCV Sincronizada',
            html: `Tasa actualizada correctamente:<br><div style="margin: 12px 0; font-size: 15px;">Anterior: <span style="color: #94a3b8;">Bs. ${(tasaActual || 0).toFixed(4)}</span> &rarr; <strong style="color: #34d399;">Nueva: Bs. ${valorTasa.toFixed(4)}</strong></div>`,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#3b82f6',
            timer: 2500
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Sincronización Fallida',
            text: err.message || 'No se pudo obtener la tasa desde el servicio en línea.',
            background: '#1e293b',
            color: '#f8fafc'
        });
    } finally {
        if (triggerBtn) {
            triggerBtn.innerHTML = originalHtml;
            triggerBtn.disabled = false;
        }
    }
}
window.sincronizarTasaBcvDesdeApi = sincronizarTasaBcvDesdeApi;


function initFiltrosComboboxes() {
    if (!comboboxFiltroChoferInstance && document.getElementById('comboboxFiltroChofer')) {
        comboboxFiltroChoferInstance = setupCombobox({
            containerId: 'comboboxFiltroChofer',
            inputSearchId: 'searchFiltroChoferInput',
            inputHiddenId: 'filterChoferVal',
            dropdownId: 'dropdownFiltroChoferList',
            placeholder: 'TODOS LOS CHOFERES',
            getItemsFn: () => {
                const list = [{ value: '', label: 'TODOS LOS CHOFERES', sub: '' }];
                const choferesMap = new Map();

                // 1. Incluir todo el catálogo de conductores/choferes
                const allChoferes = (state.conductores && state.conductores.length) ? state.conductores : (state.choferes || []);
                allChoferes.forEach(c => {
                    const id = c.id || c.Id;
                    const nombre = (c.nombreCompleto || c.NombreCompleto || c.nombre || c.username || `Chofer #${id}`).trim();
                    const cedula = c.cedula || c.Cedula;
                    if (nombre && !choferesMap.has(nombre.toLowerCase())) {
                        choferesMap.set(nombre.toLowerCase(), {
                            value: nombre,
                            label: capitalizarTexto(nombre),
                            sub: cedula ? `C.I: ${cedula}` : ''
                        });
                    }
                });

                // 2. Incluir también cualquier chofer presente en las rutas cargadas
                const rawRutas = state.rutas || [];
                rawRutas.forEach(r => {
                    const cNombre = (r.conductorNombre || '').trim();
                    if (cNombre && !choferesMap.has(cNombre.toLowerCase())) {
                        choferesMap.set(cNombre.toLowerCase(), {
                            value: cNombre,
                            label: capitalizarTexto(cNombre),
                            sub: ''
                        });
                    }
                });

                const ordenados = Array.from(choferesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
                return list.concat(ordenados);
            },
            onSelect: () => {
                state.rutasPage = 1;
                renderTablaRutas();
            }
        });
    }

    if (!comboboxFiltroFincaInstance && document.getElementById('comboboxFiltroFinca')) {
        comboboxFiltroFincaInstance = setupCombobox({
            containerId: 'comboboxFiltroFinca',
            inputSearchId: 'searchFiltroFincaInput',
            inputHiddenId: 'filterFincaVal',
            dropdownId: 'dropdownFiltroFincaList',
            placeholder: 'TODAS LAS FINCAS',
            getItemsFn: () => {
                const isAdmin = state.user?.rol === 'ADMIN';
                const list = [{ value: '', label: 'TODAS LAS FINCAS', sub: '' }];
                const fincasMap = new Map();

                // 1. Incluir todo el catálogo de fincas
                const allFincas = (state.fincas && state.fincas.length) ? state.fincas : [];
                allFincas.forEach(f => {
                    const id = f.id || f.Id;
                    const fNombre = (f.nombre || f.Nombre || '').trim();
                    const prop = capitalizarTexto(f.propietario || f.Propietario || '');
                    const fNomCap = capitalizarTexto(fNombre);
                    const label = (isAdmin && prop) ? `${fNomCap} (${prop})` : fNomCap;
                    if (fNombre && !fincasMap.has(fNombre.toLowerCase())) {
                        fincasMap.set(fNombre.toLowerCase(), {
                            value: fNombre,
                            label: label,
                            sub: ''
                        });
                    }
                });

                // 2. Incluir fincas presentes en las rutas
                const rawRutas = state.rutas || [];
                rawRutas.forEach(r => {
                    const fNombre = (r.fincaNombre || '').trim();
                    if (fNombre && !fincasMap.has(fNombre.toLowerCase())) {
                        const fNomCap = capitalizarTexto(fNombre);
                        fincasMap.set(fNombre.toLowerCase(), {
                            value: fNombre,
                            label: fNomCap,
                            sub: ''
                        });
                    }
                });

                const ordenadas = Array.from(fincasMap.values()).sort((a, b) => a.label.localeCompare(b.label));
                return list.concat(ordenadas);
            },
            onSelect: () => {
                state.rutasPage = 1;
                renderTablaRutas();
            }
        });
    }
}

function initEditModalComboboxes() {
    if (!comboboxEditConductorInstance && document.getElementById('comboboxEditConductor')) {
        comboboxEditConductorInstance = setupCombobox({
            containerId: 'comboboxEditConductor',
            inputSearchId: 'searchEditConductorInput',
            inputHiddenId: 'editRutaConductor',
            dropdownId: 'dropdownEditConductorList',
            placeholder: 'BUSCAR CONDUCTOR / CHOFER...',
            getItemsFn: () => (state.choferes || []).map(c => {
                const id = c.id || c.Id;
                const nombre = c.nombreCompleto || c.NombreCompleto || c.username || c.Username || `Chofer #${id}`;
                const cedula = c.cedula || c.Cedula;
                return {
                    value: id,
                    label: capitalizarTexto(nombre),
                    sub: cedula ? `C.I: ${cedula}` : ''
                };
            })
        });
    }

    if (!comboboxEditFincaInstance && document.getElementById('comboboxEditFinca')) {
        comboboxEditFincaInstance = setupCombobox({
            containerId: 'comboboxEditFinca',
            inputSearchId: 'searchEditFincaInput',
            inputHiddenId: 'editRutaFinca',
            dropdownId: 'dropdownEditFincaList',
            placeholder: 'BUSCAR FINCA / GANADERO...',
            getItemsFn: () => (state.fincas || [])
                .filter(f => f.activo !== false && f.Activo !== false)
                .map(f => {
                    const isAdmin = state.user?.rol === 'ADMIN';
                    const id = f.id || f.Id;
                    const nombre = capitalizarTexto(f.nombre || f.Nombre);
                    const prop = capitalizarTexto(f.propietario || f.Propietario);
                    const label = (isAdmin && prop) ? `${nombre} (${prop})` : nombre;
                    return {
                        value: id,
                        label: label,
                        sub: ''
                    };
                }),
            onSelect: (item) => {
                const groupTipo = document.getElementById('groupEditRutaTipoLeche');
                const elTipo = document.getElementById('editRutaTipoLeche');
                if (item) {
                    const matched = (state.fincas || []).find(f => (f.id || f.Id) == item.value);
                    const esDual = !!(matched?.tieneDosTiposLeche || matched?.TieneDosTiposLeche);
                    if (groupTipo) groupTipo.style.display = esDual ? 'block' : 'none';
                    if (elTipo && !esDual) elTipo.value = 'VACA';
                }
            }
        });
    }
}

function onBuscarRutasTablaInput(val) {
    state.rutasSearch = (val || '').trim().toLowerCase();
    state.rutasPage = 1;
    renderTablaRutas();
}

function onChangePageSizeRutas() {
    const sel = document.getElementById('selectPageSizeRutas');
    state.rutasPageSize = parseInt(sel?.value) || 10;
    state.rutasPage = 1;
    renderTablaRutas();
}

function cambiarPaginaRutas(nuevaPag) {
    state.rutasPage = nuevaPag;
    renderTablaRutas();
}

function ordenarTablaRutas(columna) {
    if (state.rutasSortCol === columna) {
        state.rutasSortAsc = !state.rutasSortAsc;
    } else {
        state.rutasSortCol = columna;
        state.rutasSortAsc = true;
    }
    renderTablaRutas();
}

function limpiarFiltrosRutas() {
    if (comboboxFiltroChoferInstance) comboboxFiltroChoferInstance.selectItem('', '');
    if (comboboxFiltroFincaInstance) comboboxFiltroFincaInstance.selectItem('', '');
    const inChofer = document.getElementById('searchFiltroChoferInput');
    const inFinca = document.getElementById('searchFiltroFincaInput');
    if (inChofer) inChofer.value = '';
    if (inFinca) inFinca.value = '';
    const hidChofer = document.getElementById('filterChoferVal');
    const hidFinca = document.getElementById('filterFincaVal');
    if (hidChofer) hidChofer.value = '';
    if (hidFinca) hidFinca.value = '';

    const inputBuscar = document.getElementById('inputBuscarRutasTabla');
    if (inputBuscar) inputBuscar.value = '';
    state.rutasSearch = '';
    state.rutasPage = 1;
    renderTablaRutas();
}

function onCambiarFechaFiltroRutas() {
    const inputFecha = document.getElementById('filtroFechaRutas');
    if (inputFecha && inputFecha.value) {
        state.rutasPage = 1;
        onCambiarFechaGlobalRutas(inputFecha.value);
    }
}

function onCambiarFechaDashboard() {
    const inputFecha = document.getElementById('filtroFechaDashboard');
    if (inputFecha && inputFecha.value) {
        state.rutasPage = 1;
        onCambiarFechaGlobalRutas(inputFecha.value);
    }
}

function actualizarPaginacionRutas(start, end, total, page, totalPages) {
    const lbl = document.getElementById('lblResumenPaginacionRutas');
    if (lbl) {
        lbl.innerText = total > 0 ? `Mostrando ${start} a ${end} de ${total} registros` : 'Mostrando 0 a 0 de 0 registros';
    }

    const container = document.getElementById('paginacionRutasControls');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button type="button" class="btn-page" ${page === 1 ? 'disabled' : ''} onclick="cambiarPaginaRutas(${page - 1})">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
            html += `
                <button type="button" class="btn-page ${p === page ? 'active' : ''}" onclick="cambiarPaginaRutas(${p})">
                    ${p}
                </button>
            `;
        } else if (p === page - 2 || p === page + 2) {
            html += `<span style="color: #64748b; padding: 0 4px;">...</span>`;
        }
    }

    html += `
        <button type="button" class="btn-page" ${page === totalPages ? 'disabled' : ''} onclick="cambiarPaginaRutas(${page + 1})">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = html;
}

function actualizarIconosOrdenRutas() {
    const cols = ['fecha', 'finca', 'litros', 'conductor'];
    cols.forEach(col => {
        const idCol = col.charAt(0).toUpperCase() + col.slice(1);
        const icon = document.getElementById('sortIconRutas' + idCol);
        if (icon) {
            if (state.rutasSortCol === col) {
                icon.className = state.rutasSortAsc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                icon.style.color = '#38bdf8';
            } else {
                icon.className = 'fa-solid fa-sort';
                icon.style.color = '#64748b';
            }
        }
    });
}

function renderTablaRutas() {
    initFiltrosComboboxes();
    const rawList = state.rutas || [];
    
    // 1. Total de Litros del DÍA COMPLETO
    let totalDiaLitros = 0;
    let fincasSet = new Set();
    rawList.forEach(r => {
        totalDiaLitros += (Number(r.litros) || 0);
        if (r.fincaId) fincasSet.add(r.fincaId);
    });

    // 2. Filtros de búsqueda (Chofer, Finca y Buscador General DataTable)
    const rawChofer = (document.getElementById('filterChoferVal')?.value || document.getElementById('searchFiltroChoferInput')?.value || '').toLowerCase().trim();
    const rawFinca = (document.getElementById('filterFincaVal')?.value || document.getElementById('searchFiltroFincaInput')?.value || '').toLowerCase().trim();

    const filterChofer = (rawChofer === 'todos los choferes') ? '' : rawChofer;
    const filterFinca = (rawFinca === 'todas las fincas') ? '' : rawFinca;

    let list = rawList.slice();
    if (state.filtroTicketId) {
        list = list.filter(r => (r.controlRutaId || r.ControlRutaId) == state.filtroTicketId);
    }
    if (filterChofer) {
        list = list.filter(r => (r.conductorNombre || '').toLowerCase().includes(filterChofer));
    }
    if (filterFinca) {
        list = list.filter(r => (r.fincaNombre || '').toLowerCase().includes(filterFinca));
    }
    if (state.rutasSearch) {
        const q = state.rutasSearch;
        list = list.filter(r => {
            const fecha = (r.fecha || '').toLowerCase();
            const finca = (r.fincaNombre || '').toLowerCase();
            const conductor = (r.conductorNombre || '').toLowerCase();
            const obs = (r.observacion || '').toLowerCase();
            const litros = String(r.litros || '');
            return fecha.includes(q) || finca.includes(q) || conductor.includes(q) || obs.includes(q) || litros.includes(q);
        });
    }

    // 3. Total de Litros del FILTRO ACTUAL
    let totalFiltradoLitros = 0;
    list.forEach(r => {
        totalFiltradoLitros += (Number(r.litros) || 0);
    });

    // Control del Banner de Filtro por Ticket
    const bannerTicket = document.getElementById('bannerFiltroTicketRutas');
    if (bannerTicket) {
        if (state.filtroTicketId) {
            bannerTicket.style.display = 'flex';
            const lblNum = document.getElementById('lblFiltroTicketNumero');
            if (lblNum) lblNum.innerText = state.filtroTicketId;
            const lblCnt = document.getElementById('lblFiltroTicketFincasCount');
            if (lblCnt) lblCnt.innerText = list.length;
            const lblLts = document.getElementById('lblFiltroTicketTotalLitros');
            if (lblLts) lblLts.innerText = totalFiltradoLitros.toLocaleString('es-VE');
            const condName = list[0]?.conductorNombre || '';
            const badgeCond = document.getElementById('badgeFiltroTicketConductor');
            if (badgeCond) badgeCond.innerText = condName ? `Chofer: ${condName}` : '';
        } else {
            bannerTicket.style.display = 'none';
        }
    }

    // 4. Actualizar Badges y Resúmenes Dinámicos
    const kpiHeader = document.getElementById('kpiLitrosRutasHeader');
    if (kpiHeader) {
        kpiHeader.innerText = totalDiaLitros.toLocaleString('es-VE');
        kpiHeader.style.color = totalDiaLitros < 0 ? '#fca5a5' : '#4ade80';
        kpiHeader.style.fontWeight = '800';
        kpiHeader.style.fontSize = '15px';
    }

    const badgeFiltrado = document.getElementById('badgeTotalFiltrado');
    const lblTotalFiltrado = document.getElementById('lblTotalLitrosFiltrado');
    const badgeChofer = document.getElementById('resumenFiltroChoferBadge');
    const lblChoferNombre = document.getElementById('lblChoferFiltradoNombre');
    const lblChoferLitros = document.getElementById('lblChoferTotalLitros');
    const badgeFinca = document.getElementById('resumenFiltroFincaBadge');
    const lblFincaNombre = document.getElementById('lblFincaFiltradaNombre');
    const lblFincaLitros = document.getElementById('lblFincaTotalLitros');

    const hayFiltro = filterChofer || filterFinca || state.rutasSearch;
    if (badgeFiltrado) badgeFiltrado.style.display = hayFiltro ? 'inline-block' : 'none';
    if (lblTotalFiltrado) lblTotalFiltrado.innerText = totalFiltradoLitros.toLocaleString();

    if (badgeChofer && lblChoferNombre && lblChoferLitros) {
        if (filterChofer) {
            badgeChofer.style.display = 'inline-block';
            lblChoferNombre.innerText = filterChofer.toUpperCase();
            lblChoferLitros.innerText = totalFiltradoLitros.toLocaleString() + ' Lts';
        } else {
            badgeChofer.style.display = 'none';
        }
    }

    if (badgeFinca && lblFincaNombre && lblFincaLitros) {
        if (filterFinca) {
            badgeFinca.style.display = 'inline-block';
            lblFincaNombre.innerText = filterFinca.toUpperCase();
            lblFincaLitros.innerText = totalFiltradoLitros.toLocaleString() + ' Lts';
        } else {
            badgeFinca.style.display = 'none';
        }
    }

    const lblConteo = document.getElementById('lblConteoRutasTabla');
    if (lblConteo) {
        lblConteo.innerText = `${list.length} ${list.length === 1 ? 'registro encontrado' : 'registros encontrados'}`;
    }

    // 5. Ordenamiento de Columnas (Sorting)
    if (state.rutasSortCol) {
        const col = state.rutasSortCol;
        const asc = state.rutasSortAsc;
        list.sort((a, b) => {
            let valA, valB;
            if (col === 'litros') {
                valA = Number(a.litros) || 0;
                valB = Number(b.litros) || 0;
            } else if (col === 'finca') {
                valA = (a.fincaNombre || '').toLowerCase();
                valB = (b.fincaNombre || '').toLowerCase();
            } else if (col === 'conductor') {
                valA = (a.conductorNombre || '').toLowerCase();
                valB = (b.conductorNombre || '').toLowerCase();
            } else if (col === 'ticket') {
                valA = Number(a.controlRutaId || a.ControlRutaId || 0);
                valB = Number(b.controlRutaId || b.ControlRutaId || 0);
            } else if (col === 'fecha') {
                valA = a.fecha || '';
                valB = b.fecha || '';
            } else {
                valA = Number(a.id || a.Id || 0);
                valB = Number(b.id || b.Id || 0);
            }

            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
    } else {
        // Orden por defecto: Tickets ASC y ID del Registro ASC (primer ingreso arriba, siguientes debajo)
        list.sort((a, b) => {
            const tA = Number(a.controlRutaId || a.ControlRutaId || 0);
            const tB = Number(b.controlRutaId || b.ControlRutaId || 0);
            if (tA !== tB) return tA - tB;
            return (Number(a.id || a.Id || 0)) - (Number(b.id || b.Id || 0));
        });
    }

    actualizarIconosOrdenRutas();

    // 6. Render Tabla Dashboard (si existe)
    const tbodyDashboard = document.getElementById('tbodyRutasDashboard');
    if (tbodyDashboard) {
        if (rawList.length === 0) {
            tbodyDashboard.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 24px; color: #9ca3af;">No se encontraron recolecciones.</td></tr>';
        } else {
            tbodyDashboard.innerHTML = rawList.slice(0, 10).map(r => {
                const fechaStr = r.fecha ? r.fecha.split('T')[0] : '-';
                const colorLitros = r.litros < 0 ? '#ef4444' : '#34d399';
                const fObj = (state.fincas || []).find(f => Number(f.id || f.Id) === Number(r.fincaId || r.FincaId));
                const esFincaDual = Boolean(r.tieneDosTiposLeche || r.TieneDosTiposLeche || fObj?.tieneDosTiposLeche || fObj?.TieneDosTiposLeche);
                let tipoBadge = '';
                if (esFincaDual) {
                    const rawTipo = (r.tipoLeche || r.TipoLeche || 'VACA').toUpperCase();
                    const esBufala = rawTipo.includes('BUFAL');
                    tipoBadge = esBufala
                        ? `<span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 800;"><i class="fa-solid fa-leaf"></i> 🐃 BÚFALA</span>`
                        : `<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 800;"><i class="fa-solid fa-cow"></i> 🐄 VACA</span>`;
                }
                return `
                    <tr>
                        <td><span style="color: #cbd5e1; font-weight: 600;">${fechaStr}</span></td>
                        <td><strong>${capitalizarTexto(r.fincaNombre)}</strong> ${tipoBadge}</td>
                        <td><span style="color: #60a5fa; font-weight: 600;">${capitalizarTexto(r.conductorNombre)}</span></td>
                        <td><strong style="color: ${colorLitros};">${r.litros.toLocaleString('es-VE')} Lts</strong></td>
                        <td style="text-align: center;">
                            ${r.puedeModificar ? `
                                <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; margin-right: 6px;" onclick="abrirModalEditarRutaCompleta(${r.id || r.Id})">
                                    <i class="fa-solid fa-pen-to-square"></i> Editar
                                </button>
                                <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" onclick="eliminarRutaRegistro(${r.id || r.Id})">
                                    <i class="fa-solid fa-trash"></i> Eliminar
                                </button>
                            ` : '<span style="color: #64748b; font-size: 12px;">Cerrado</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 7. Render Tabla Rutas Hoy con Paginación DataTable
    const tbodyRutas = document.getElementById('tbodyRutasHoy');
    const totalRegistros = list.length;
    const pageSize = state.rutasPageSize || 10;
    const totalPages = Math.ceil(totalRegistros / pageSize) || 1;

    if (state.rutasPage > totalPages) state.rutasPage = totalPages;
    if (state.rutasPage < 1) state.rutasPage = 1;

    const startIdx = (state.rutasPage - 1) * pageSize;
    const pageItems = list.slice(startIdx, startIdx + pageSize);

    if (tbodyRutas) {
        if (totalRegistros === 0) {
            tbodyRutas.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 24px; color: #94a3af;">No se encontraron recolecciones registradas.</td></tr>';
            actualizarPaginacionRutas(0, 0, 0, 1, 1);
        } else {
            tbodyRutas.innerHTML = pageItems.map(r => {
                const fechaStr = r.fecha ? r.fecha.split('T')[0] : '-';
                const colorLitros = r.litros < 0 ? '#dc2626' : '#047857';
                const esAcidaFlag = r.esAcida || r.EsAcida;
                const precioAplicado = r.precioLitroUSD || r.PrecioLitroUSD || 0;
                const esChofer = state.user && state.user.rol === 'CHOFER';
                const acidaBadge = esAcidaFlag 
                    ? `<span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;"><i class="fa-solid fa-flask" style="color: #d97706;"></i> ÁCIDA${esChofer ? '' : ` ($${precioAplicado.toFixed(4)})`}</span>` 
                    : '';
                const fObj = (state.fincas || []).find(f => Number(f.id || f.Id) === Number(r.fincaId || r.FincaId));
                const esFincaDual = Boolean(r.tieneDosTiposLeche || r.TieneDosTiposLeche || fObj?.tieneDosTiposLeche || fObj?.TieneDosTiposLeche);
                let tipoBadge = '';
                if (esFincaDual) {
                    const rawTipo = (r.tipoLeche || r.TipoLeche || 'VACA').toUpperCase();
                    const esBufala = rawTipo.includes('BUFAL');
                    tipoBadge = esBufala
                        ? `<span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 800;"><i class="fa-solid fa-leaf"></i> 🐃 BÚFALA</span>`
                        : `<span class="badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 800;"><i class="fa-solid fa-cow"></i> 🐄 VACA</span>`;
                }
                const ticketIdVal = r.controlRutaId || r.ControlRutaId;
                const ticketBadge = ticketIdVal 
                    ? `<span class="badge" style="background: rgba(37,99,235,0.15); color: #2563eb; border: 1.5px solid #93c5fd; font-weight: 800; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="filtrarRutasPorTicket(${ticketIdVal})" title="Filtrar por Ticket #${ticketIdVal}"><i class="fa-solid fa-ticket"></i> #${ticketIdVal}</span>` 
                    : `<span style="color: #94a3b8; font-size: 11.5px; font-style: italic;">Sin Ticket</span>`;
                const obsLimpia = (r.observacion || '').replace(/\[BUFALA\]/gi, '').replace(/\[VACA\]/gi, '').trim();

                const esDiferido = Boolean(r.esDiferido || r.EsDiferido);
                const litrosOrig = r.litrosOriginales || r.LitrosOriginales;
                const cicloLiqId = r.cicloLiquidacionId || r.CicloLiquidacionId;

                let badgeDiferido = '';
                if (esDiferido) {
                    badgeDiferido = `<br><span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; font-size: 10px; padding: 1.5px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; margin-top: 3px;" title="Se liquida en Semana ${cicloLiqId}"><i class="fa-solid fa-clock-rotate-left"></i> Pasa a Sem. ${cicloLiqId}</span>`;
                } else if (litrosOrig && litrosOrig > r.litros) {
                    badgeDiferido = `<br><span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 10px; padding: 1.5px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; margin-top: 3px;" title="Recolección física original: ${litrosOrig} Lts"><i class="fa-solid fa-code-fork"></i> Rec. Física: ${litrosOrig} L</span>`;
                }

                let btnDiferirHtml = '';
                if (esDiferido) {
                    btnDiferirHtml = `
                        <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; border-color: #fca5a5; color: #dc2626; background: #fef2f2; font-weight: 700; margin-left: 3px;" onclick="revertirDiferimientoRuta(${r.id || r.Id})" title="Revertir diferimiento y reintegrar a la recolección original">
                            <i class="fa-solid fa-rotate-left"></i> Revertir
                        </button>
                    `;
                } else if ((r.puedeModificar || (state.user && state.user.rol === 'ADMIN')) && r.litros > 1) {
                    btnDiferirHtml = `
                        <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; border-color: #fdba74; color: #c2410c; background: #fff7ed; font-weight: 700; margin-left: 3px;" onclick="abrirModalDiferirLitros(${r.id || r.Id})" title="Diferir parte de estos litros para la siguiente semana operativa">
                            <i class="fa-solid fa-clock-rotate-left"></i> Diferir
                        </button>
                    `;
                }

                return `
                    <tr>
                        <td><span style="color: #334155; font-weight: 600; font-size: 13.5px;">${fechaStr}</span></td>
                        <td style="text-align: center;">${ticketBadge}</td>
                        <td><strong style="color: #0f172a; font-size: 14px; font-weight: 700;">${capitalizarTexto(r.fincaNombre)}</strong>${tipoBadge}${acidaBadge}</td>
                        <td><strong style="color: ${colorLitros}; font-size: 14px; font-weight: 800;">${r.litros.toLocaleString('es-VE')} Lts</strong>${badgeDiferido}</td>
                        <td style="color: #475569; font-size: 13px;">${obsLimpia || '-'}</td>
                        <td><span style="color: #2563eb; font-weight: 700; font-size: 13.5px;">${capitalizarTexto(r.conductorNombre)}</span></td>
                        <td style="text-align: center; white-space: nowrap;">
                            ${r.puedeModificar ? `
                                <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11.5px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;" onclick="abrirModalEditarRutaCompleta(${r.id || r.Id})">
                                    <i class="fa-solid fa-pen-to-square"></i> Editar
                                </button>
                                ${btnDiferirHtml}
                            ` : (btnDiferirHtml || '<span style="color: #94a3b8; font-size: 12px;">-</span>')}
                        </td>
                        <td style="text-align: center;">
                            ${r.puedeModificar ? `
                                <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 12px; color: #e11d48; border-color: #fecdd3; background: #fff1f2;" onclick="eliminarRutaRegistro(${r.id || r.Id})">
                                    <i class="fa-solid fa-trash"></i> Eliminar
                                </button>
                            ` : '<span style="color: #94a3b8; font-size: 12px;">-</span>'}
                        </td>
                    </tr>
                `;
            }).join('');

            actualizarPaginacionRutas(startIdx + 1, Math.min(startIdx + pageSize, totalRegistros), totalRegistros, state.rutasPage, totalPages);
        }
    }
}

async function abrirModalEditarRutaCompleta(rutaId) {
    if (!rutaId) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'ID de recolección inválido.', background: '#1e293b', color: '#fff' });
        return;
    }

    let ruta = (state.rutas || []).find(r => (r.id == rutaId || r.Id == rutaId || String(r.id) === String(rutaId) || String(r.Id) === String(rutaId)));

    if (!ruta) {
        const otras = [
            ...(state.todasLasRutas || []),
            ...(state.recolecciones || []),
            ...(state.rutasDelDia || []),
            ...(state.fincasViajeActivo || [])
        ];
        ruta = otras.find(r => (r.id == rutaId || r.Id == rutaId || String(r.id) === String(rutaId) || String(r.Id) === String(rutaId)));
    }

    if (!ruta) {
        try {
            const fechaConsulta = document.getElementById('filtroFechaRutas')?.value || document.getElementById('filtroFechaGlobalRutas')?.value || state.rutasFechaFiltro || '';
            const url = fechaConsulta ? `${API_BASE}/rutas/hoy?fecha=${fechaConsulta}` : `${API_BASE}/rutas/hoy`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length) {
                    state.rutas = data;
                    ruta = data.find(r => (r.id == rutaId || r.Id == rutaId || String(r.id) === String(rutaId) || String(r.Id) === String(rutaId)));
                }
            }
        } catch (e) {
            console.error('Error al consultar rutas:', e);
        }
    }

    if (!ruta) {
        Swal.fire({ icon: 'error', title: 'No encontrada', text: 'No se encontró la recolección seleccionada.', background: '#1e293b', color: '#fff' });
        return;
    }

    if (state.user && state.user.rol === 'CHOFER' && (ruta.puedeModificar === false || ruta.puedeModificar === 0)) {
        Swal.fire({
            icon: 'warning',
            title: 'Edición No Permitida',
            text: 'Esta recolección pertenece a un viaje en estado RECIBIDO o finalizado y no puede ser modificada.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }

    initEditModalComboboxes();

    const fincaId = ruta.fincaId || ruta.FincaId;
    const conductorId = ruta.conductorId || ruta.ConductorId || ruta.usuarioId || ruta.UsuarioId;
    const litros = ruta.litros ?? ruta.Litros ?? '';
    const fecha = (ruta.fecha || ruta.Fecha || '').split('T')[0] || new Date().toISOString().split('T')[0];
    const observacion = ruta.observacion || ruta.Observacion || '';

    const elId = document.getElementById('editRutaId');
    const elFecha = document.getElementById('editRutaFecha');
    const elLitros = document.getElementById('editRutaLitros');
    const elObs = document.getElementById('editRutaObs');
    const elAcida = document.getElementById('editRutaEsAcida');

    if (elId) elId.value = ruta.id || ruta.Id;
    if (elFecha) elFecha.value = fecha;
    if (elLitros) elLitros.value = litros;
    if (elObs) elObs.value = (observacion || '').replace(/\[BUFALA\]/gi, '').replace(/\[VACA\]/gi, '').trim();
    if (elAcida) elAcida.checked = !!(ruta.esAcida || ruta.EsAcida);

    const elTipoLeche = document.getElementById('editRutaTipoLeche');
    const groupEditTipoLeche = document.getElementById('groupEditRutaTipoLeche');
    const rawTipo = (ruta.tipoLeche || ruta.TipoLeche || 'VACA').toUpperCase();

    // Preseleccionar Finca en Combobox Buscable
    const isAdmin = state.user?.rol === 'ADMIN';
    const finca = (state.fincas || []).find(f => (f.id || f.Id) == fincaId);
    const esDual = !!(finca?.tieneDosTiposLeche || finca?.TieneDosTiposLeche);

    if (groupEditTipoLeche) {
        groupEditTipoLeche.style.display = esDual ? 'block' : 'none';
    }
    if (elTipoLeche) {
        elTipoLeche.value = esDual ? (rawTipo.includes('BUFAL') ? 'BUFALA' : 'VACA') : 'VACA';
    }

    const nombreFinca = finca ? (finca.nombre || finca.Nombre) : (ruta.fincaNombre || '');
    const propFinca = finca ? (finca.propietario || finca.Propietario) : (ruta.propietario || '');
    const fincaLabel = (isAdmin && propFinca) ? `${nombreFinca} (${propFinca})` : nombreFinca;
    if (comboboxEditFincaInstance) {
        comboboxEditFincaInstance.selectItem(fincaId, fincaLabel);
    }

    // Preseleccionar Conductor en Combobox Buscable
    const chofer = (state.choferes || []).find(c => (c.id || c.Id) == conductorId);
    const choferLabel = chofer ? (chofer.nombreCompleto || chofer.NombreCompleto || chofer.username || chofer.Username) : (ruta.conductorNombre || '');
    if (comboboxEditConductorInstance) {
        comboboxEditConductorInstance.selectItem(conductorId, choferLabel);
    }

    const searchCondInput = document.getElementById('searchEditConductorInput');
    if (searchCondInput) {
        if (state.user?.rol === 'CHOFER') {
            searchCondInput.disabled = true;
        } else {
            searchCondInput.disabled = false;
        }
    }

    abrirModalCustom('modalEditarRutaCompletaCustom');
}
window.abrirModalEditarRutaCompleta = abrirModalEditarRutaCompleta;

async function guardarEdicionRutaCompleta(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const id = document.getElementById('editRutaId')?.value;
    const fecha = document.getElementById('editRutaFecha')?.value;
    
    const inputFincaHidden = document.getElementById('editRutaFinca');
    const inputFincaSearch = document.getElementById('searchEditFincaInput');
    const inputCondHidden = document.getElementById('editRutaConductor');
    const inputCondSearch = document.getElementById('searchEditConductorInput');

    let fincaId = inputFincaHidden ? parseInt(inputFincaHidden.value) : 0;
    if (isNaN(fincaId)) fincaId = 0;

    let conductorId = inputCondHidden ? parseInt(inputCondHidden.value) : 0;
    if (isNaN(conductorId)) conductorId = 0;

    if (fincaId <= 0 && inputFincaSearch && inputFincaSearch.value.trim().length > 0) {
        const textFinca = inputFincaSearch.value.trim().toLowerCase();
        const matchedFinca = (state.fincas || []).find(f => {
            const nombre = (f.nombre || f.Nombre || '').toLowerCase();
            const prop = (f.propietario || f.Propietario || '').toLowerCase();
            return nombre.includes(textFinca) || textFinca.includes(nombre) || (prop && prop.includes(textFinca));
        });
        if (matchedFinca) {
            fincaId = matchedFinca.id || matchedFinca.Id;
            if (inputFincaHidden) inputFincaHidden.value = fincaId;
        }
    }

    if (conductorId <= 0 && inputCondSearch && inputCondSearch.value.trim().length > 0) {
        const textCond = inputCondSearch.value.trim().toLowerCase();
        const matchedCond = (state.choferes || []).find(c => {
            const nombre = (c.nombreCompleto || c.NombreCompleto || c.username || c.Username || '').toLowerCase();
            return nombre.includes(textCond) || textCond.includes(nombre);
        });
        if (matchedCond) {
            conductorId = matchedCond.id || matchedCond.Id;
            if (inputCondHidden) inputCondHidden.value = conductorId;
        }
    }

    const rawLitros = parseInt(document.getElementById('editRutaLitros')?.value);
    const litros = isNaN(rawLitros) ? 0 : rawLitros;
    const observacion = (document.getElementById('editRutaObs')?.value || '').replace(/\[BUFALA\]/gi, '').replace(/\[VACA\]/gi, '').trim();
    const esAcida = !!document.getElementById('editRutaEsAcida')?.checked;
    const tipoLeche = document.getElementById('editRutaTipoLeche')?.value || 'VACA';

    if (!id || !fecha || isNaN(litros) || litros === 0 || fincaId <= 0 || conductorId <= 0) {
        Swal.fire({ icon: 'warning', title: 'Campos Inválidos', text: 'Por favor selecciona fecha, finca, conductor y una cantidad válida de litros distinta de 0.', background: '#1e293b', color: '#fff' });
        return;
    }

    const btn = document.getElementById('btnGuardarEditRutaSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Guardar';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/rutas/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha,
                litros,
                fincaId,
                conductorId,
                observacion,
                tipoLeche,
                esAcida
            })
        });

        const data = await res.json();
        if (res.ok) {
            cerrarModalCustom('modalEditarRutaCompletaCustom');
            showToast('Recolección actualizada exitosamente.');
            
            if (state.filtroTicketId) {
                await filtrarRutasPorTicket(state.filtroTicketId);
            } else {
                await cargarRutasHoy();
            }

            if (typeof cargarDashboard === 'function') {
                cargarDashboard();
            }

            const fechaConsulta = document.getElementById('filtroFechaRutas')?.value || fecha;
            if (typeof cargarViajesRutasDelDia === 'function') {
                cargarViajesRutasDelDia(fechaConsulta);
            }
            if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
            if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
            if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
            if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
            if (window.currentTrazabilidadData?.ticket?.id) {
                verTrazabilidadViaje(window.currentTrazabilidadData.ticket.id);
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo actualizar la recolección.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}
window.guardarEdicionRutaCompleta = guardarEdicionRutaCompleta;

async function eliminarRutaRegistro(id) {
    const ruta = (state.rutas || []).find(r => (r.id || r.Id) == id);
    if (state.user && state.user.rol === 'CHOFER' && ruta && (ruta.puedeModificar === false || ruta.puedeModificar === 0)) {
        Swal.fire({
            icon: 'warning',
            title: 'Eliminación No Permitida',
            text: 'Esta recolección pertenece a un viaje en estado RECIBIDO o finalizado y no puede ser eliminada por el chofer.',
            background: '#1e293b',
            color: '#fff'
        });
        return;
    }
    const confirm = await Swal.fire({
        title: '¿Eliminar Recolección?',
        text: 'Esta acción borrará la recolección seleccionada y no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE}/rutas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (res.ok) {
                showToast('Recolección eliminada exitosamente.');
                
                if (state.filtroTicketId) {
                    await filtrarRutasPorTicket(state.filtroTicketId);
                } else {
                    await cargarRutasHoy();
                }

                if (typeof cargarDashboard === 'function') {
                    cargarDashboard();
                }

                const fechaConsulta = document.getElementById('filtroFechaRutas')?.value || new Date().toISOString().split('T')[0];
                if (typeof cargarViajesRutasDelDia === 'function') {
                    cargarViajesRutasDelDia(fechaConsulta);
                }
                if (typeof cargarBandejaReceptoria === 'function') cargarBandejaReceptoria();
                if (typeof cargarViajesPendientesReceptoria === 'function') cargarViajesPendientesReceptoria();
                if (typeof cargarControlViajesTickets === 'function') cargarControlViajesTickets();
                if (typeof actualizarBalanceReceptoria === 'function') actualizarBalanceReceptoria();
                if (window.currentTrazabilidadData?.ticket?.id) {
                    verTrazabilidadViaje(window.currentTrazabilidadData.ticket.id);
                }
            } else {
                const data = await res.json();
                Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo eliminar.', background: '#1e293b', color: '#fff' });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
        }
    }
}
window.eliminarRutaRegistro = eliminarRutaRegistro;
window.eliminarRuta = eliminarRutaRegistro;

// =========================================================================
// DIFERIMIENTO DE LITROS PARA SIGUIENTE SEMANA OPERATIVA (FÍSICO INTACTO)
// =========================================================================
async function abrirModalDiferirLitros(rutaId) {
    if (!rutaId) return;

    let ruta = (state.rutas || []).find(r => Number(r.id || r.Id) === Number(rutaId));
    if (!ruta) {
        try {
            const res = await fetch(`${API_BASE}/rutas/${rutaId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) ruta = await res.json();
        } catch (e) { }
    }

    if (!ruta) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la información de la recolección.', background: '#1e293b', color: '#fff' });
        return;
    }

    const fincaNombre = ruta.fincaNombre || ruta.FincaNombre || 'Finca';
    const litrosActuales = Number(ruta.litros || ruta.Litros || 0);
    const cicloActualId = Number(ruta.cicloId || ruta.CicloId || state.cicloActivo?.id || 0);

    // Determinar siguiente ciclo disponible
    const semanas = state.semanas || [];
    const ciclosSiguientes = semanas.filter(s => Number(s.id || s.Id) > cicloActualId)
        .sort((a, b) => Number(a.id || a.Id) - Number(b.id || b.Id));
    const sigCiclo = ciclosSiguientes[0] || null;
    const sigCicloId = sigCiclo ? Number(sigCiclo.id || sigCiclo.Id) : (cicloActualId + 1);

    const opcionesCiclosHtml = semanas.map(s => {
        const sId = Number(s.id || s.Id);
        const sel = sId === sigCicloId ? 'selected' : '';
        return `<option value="${sId}" ${sel}>${s.codigo || `Semana ${sId}`}</option>`;
    }).join('');

    const sugeridoDiferir = Math.min(100, Math.max(1, litrosActuales - 1));

    const { value: formValues } = await Swal.fire({
        title: `<i class="fa-solid fa-clock-rotate-left" style="color: #f97316;"></i> Diferir Litros para Siguiente Semana`,
        html: `
            <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                <div style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #334155; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="color: #94a3b8; font-size: 12px;">Finca:</span>
                        <strong style="color: #38bdf8; font-size: 14px;">${fincaNombre}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="color: #94a3b8; font-size: 12px;">Fecha de Recolección:</span>
                        <strong style="color: #f1f5f9;">${(ruta.fecha || '').split('T')[0]}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #94a3b8; font-size: 12px;">Litros Físicos Recolectados:</span>
                        <strong style="color: #10b981; font-size: 16px;">${litrosActuales.toLocaleString('es-VE')} Lts</strong>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <label for="swalLitrosDiferir" style="display: block; font-weight: 800; color: #f8fafc; font-size: 13px; margin-bottom: 6px;">
                        Litros a pasar para la Siguiente Semana (Diferir):
                    </label>
                    <input id="swalLitrosDiferir" type="number" min="1" max="${litrosActuales - 1}" value="${sugeridoDiferir}" class="swal2-input" 
                        style="width: 100%; box-sizing: border-box; margin: 0; height: 44px; font-size: 16px; font-weight: 800; color: #ea580c; background: #ffffff; border: 2px solid #fdba74; border-radius: 8px; text-align: center;"
                        oninput="actualizarPreviewDiferir(${litrosActuales})" />
                    <small style="display: block; color: #94a3b8; font-size: 11px; margin-top: 4px;">
                        * Debe ser entre 1 y ${litrosActuales - 1} Lts.
                    </small>
                </div>

                <!-- PREVISUALIZACIÓN EN TIEMPO REAL -->
                <div style="background: rgba(249, 115, 22, 0.1); border: 1.5px solid rgba(249, 115, 22, 0.4); border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; font-size: 12.5px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #cbd5e1;">Se liquida en esta semana (Sem. ${cicloActualId}):</span>
                        <strong id="spanPrevLiquidarSemana" style="color: #10b981; font-size: 13.5px;">- Lts</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #cbd5e1;">Pasa para liquidar en semana entrante:</span>
                        <strong id="spanPrevDiferirSemana" style="color: #f97316; font-size: 13.5px;">- Lts</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(249, 115, 22, 0.3); padding-top: 4px;">
                        <span style="color: #94a3b8; font-size: 11.5px;"><i class="fa-solid fa-truck"></i> Camión y Tanque Operativo:</span>
                        <strong style="color: #38bdf8; font-size: 12px;">${litrosActuales.toLocaleString('es-VE')} Lts (Físico Intacto)</strong>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <label for="swalCicloDestino" style="display: block; font-weight: 800; color: #f8fafc; font-size: 12.5px; margin-bottom: 4px;">
                        Semana Operativa Destino para Liquidación:
                    </label>
                    <select id="swalCicloDestino" class="swal2-select" style="width: 100%; box-sizing: border-box; margin: 0; height: 40px; font-size: 13px; font-weight: 700; background: #ffffff; color: #0f172a; border-radius: 8px;">
                        ${opcionesCiclosHtml}
                    </select>
                </div>

                <div>
                    <label for="swalMotivoDiferir" style="display: block; font-weight: 800; color: #f8fafc; font-size: 12.5px; margin-bottom: 4px;">
                        Motivo / Observación:
                    </label>
                    <input id="swalMotivoDiferir" type="text" value="Solicitud del propietario" class="swal2-input" 
                        style="width: 100%; box-sizing: border-box; margin: 0; height: 38px; font-size: 13px; font-weight: 600; color: #0f172a; background: #ffffff; border-radius: 8px;" />
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check"></i> Confirmar y Diferir Litros',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#64748b',
        background: '#0f172a',
        color: '#fff',
        didOpen: () => {
            if (typeof actualizarPreviewDiferir === 'function') {
                actualizarPreviewDiferir(litrosActuales);
            }
        },
        preConfirm: () => {
            const inputVal = parseInt(document.getElementById('swalLitrosDiferir').value, 10);
            const cicloDestino = parseInt(document.getElementById('swalCicloDestino').value, 10);
            const motivo = document.getElementById('swalMotivoDiferir').value.trim();

            if (isNaN(inputVal) || inputVal <= 0 || inputVal >= litrosActuales) {
                Swal.showValidationMessage(`Ingresa un valor válido entre 1 y ${litrosActuales - 1} litros.`);
                return false;
            }
            if (isNaN(cicloDestino) || cicloDestino <= 0) {
                Swal.showValidationMessage('Selecciona la semana operativa de destino.');
                return false;
            }

            return {
                litrosDiferir: inputVal,
                cicloDestinoId: cicloDestino,
                motivo: motivo || 'Solicitud del propietario'
            };
        }
    });

    if (!formValues) return;

    try {
        const res = await fetch(`${API_BASE}/rutas/${rutaId}/diferir-litros`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(formValues)
        });

        const data = await res.json();
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Litros Diferidos con Éxito',
                text: `Se pasaron ${formValues.litrosDiferir} Lts para liquidar en la siguiente semana. El balance físico de recolección en tanques y camión permanece en ${litrosActuales} Lts.`,
                background: '#1e293b',
                color: '#fff'
            });
            if (typeof cargarRutasHoy === 'function') await cargarRutasHoy();
            if (typeof cargarPreLiquidacion === 'function') await cargarPreLiquidacion(false);
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo diferir los litros.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.abrirModalDiferirLitros = abrirModalDiferirLitros;

function actualizarPreviewDiferir(totalLitros) {
    const input = document.getElementById('swalLitrosDiferir');
    const spanLiq = document.getElementById('spanPrevLiquidarSemana');
    const spanDif = document.getElementById('spanPrevDiferirSemana');
    if (!input || !spanLiq || !spanDif) return;

    const val = parseInt(input.value, 10) || 0;
    const restante = Math.max(0, totalLitros - val);

    spanLiq.textContent = `${restante.toLocaleString('es-VE')} Lts`;
    spanDif.textContent = `${val.toLocaleString('es-VE')} Lts`;
}
window.actualizarPreviewDiferir = actualizarPreviewDiferir;

async function revertirDiferimientoRuta(rutaId) {
    if (!rutaId) return;

    const { isConfirmed } = await Swal.fire({
        title: '¿Revertir Diferimiento?',
        text: 'Los litros diferidos se reintegrarán a la recolección original en esta semana.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-rotate-left"></i> Revertir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/rutas/${rutaId}/revertir-diferimiento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            }
        });

        const data = await res.json();
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Diferimiento Revertido',
                text: 'La recolección original ha sido restaurada con su volumen completo.',
                background: '#1e293b',
                color: '#fff'
            });
            if (typeof cargarRutasHoy === 'function') await cargarRutasHoy();
            if (typeof cargarPreLiquidacion === 'function') await cargarPreLiquidacion(false);
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo revertir.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}
window.revertirDiferimientoRuta = revertirDiferimientoRuta;

function initSemanasModule() {
    const btnModalCrear = document.getElementById('btnModalCrearSemana');
    if (btnModalCrear) {
        btnModalCrear.addEventListener('click', abrirModalCrearSemanaCustom);
    }

    const formCrear = document.getElementById('formCrearSemanaCustom');
    if (formCrear) {
        formCrear.addEventListener('submit', guardarSemanaIndividual);
    }

    const btnModalGen52 = document.getElementById('btnModalGenerar52');
    if (btnModalGen52) {
        btnModalGen52.addEventListener('click', abrirModalGenerar52Custom);
    }

    const formGen52 = document.getElementById('formGenerar52Custom');
    if (formGen52) {
        formGen52.addEventListener('submit', ejecutarGeneracion52Semanas);
    }

    const inputGenAnio = document.getElementById('selectAnio52') || document.getElementById('gen52Anio');
    if (inputGenAnio) {
        inputGenAnio.addEventListener('change', actualizarPreview52Semanas);
    }
    const selectGenDiaIni = document.getElementById('selectDiaInicio52') || document.getElementById('gen52DiaInicio');
    if (selectGenDiaIni) {
        selectGenDiaIni.addEventListener('change', actualizarPreview52Semanas);
    }
    const selectGenDiaFin = document.getElementById('selectDiaFin52') || document.getElementById('gen52DiaFin');
    if (selectGenDiaFin) {
        selectGenDiaFin.addEventListener('change', actualizarPreview52Semanas);
    }

    const formEditSemana = document.getElementById('formEditarSemanaCustom');
    if (formEditSemana) {
        formEditSemana.addEventListener('submit', guardarEdicionSemana);
    }
}

async function cargarSemanas() {
    try {
        const res = await fetch(`${API_BASE}/ciclos`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) return;

        const semanas = await res.json();
        state.semanas = semanas;
        
        const activa = semanas.find(s => s.estado === 'ABIERTO') || semanas[0];
        if (activa) {
            const elNom = document.getElementById('semanaActivaNombre');
            if (elNom) elNom.innerText = activa.codigo;

            const elRango = document.getElementById('semanaActivaRango');
            const fIni = activa.fechaInicio ? activa.fechaInicio.split('T')[0] : '';
            const fFin = activa.fechaFin ? activa.fechaFin.split('T')[0] : '';
            if (elRango) elRango.innerText = `${fIni}  al  ${fFin}`;

            const elLitros = document.getElementById('semanaActivaLitros');
            if (elLitros) elLitros.innerText = `${(activa.totalLitros || 0).toLocaleString()} Lts`;

            const elFincas = document.getElementById('semanaActivaFincas');
            if (elFincas) elFincas.innerText = `${activa.totalFincasParticipantes || 0} Fincas`;

            const elComp = document.getElementById('semanaActivaCompanias');
            if (elComp) elComp.innerText = `${activa.totalCompaniasParticipantes || 0} Plantas`;

            const elBadge = document.getElementById('badgeSemanaEstado');
            if (elBadge) elBadge.innerText = activa.estado === 'ABIERTO' ? 'ACTIVA (EN CURSO)' : activa.estado;
        }

        renderTablaSemanas();
    } catch (err) {
        console.error('Error al cargar semanas:', err);
    }
}

function filtrarPillSemanas(filtro, btn) {
    state.semanasFilter = filtro;
    state.semanasPage = 1;
    
    document.querySelectorAll('#filtroPillsSemanas .filter-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    renderTablaSemanas();
}

function onBuscarSemanas() {
    const input = document.getElementById('inputBuscarSemana');
    state.semanasSearch = (input?.value || '').toLowerCase().trim();
    state.semanasPage = 1;
    renderTablaSemanas();
}

function onChangePageSizeSemanas() {
    const sel = document.getElementById('selectPageSizeSemanas');
    state.semanasPageSize = parseInt(sel?.value) || 10;
    state.semanasPage = 1;
    renderTablaSemanas();
}

function cambiarPaginaSemanas(nuevaPag) {
    state.semanasPage = nuevaPag;
    renderTablaSemanas();
}

function renderTablaSemanas() {
    const tbody = document.getElementById('tbodySemanasHistorial');
    if (!tbody) return;

    let list = (state.semanas || []).slice();

    list.sort((a, b) => {
        if (a.estado === 'ABIERTO' && b.estado !== 'ABIERTO') return -1;
        if (a.estado !== 'ABIERTO' && b.estado === 'ABIERTO') return 1;
        return new Date(a.fechaInicio) - new Date(b.fechaInicio);
    });

    if (state.semanasFilter === 'ACTIVA') {
        list = list.filter(s => s.estado === 'ABIERTO');
    } else if (state.semanasFilter === 'PROGRAMADO') {
        list = list.filter(s => s.estado === 'PROGRAMADO');
    } else if (state.semanasFilter === 'CERRADO') {
        list = list.filter(s => s.estado === 'CERRADO');
    }

    if (state.semanasSearch) {
        list = list.filter(s => 
            (s.codigo && s.codigo.toLowerCase().includes(state.semanasSearch)) ||
            (s.fechaInicio && s.fechaInicio.includes(state.semanasSearch)) ||
            (s.fechaFin && s.fechaFin.includes(state.semanasSearch)) ||
            (s.estado && s.estado.toLowerCase().includes(state.semanasSearch)) ||
            (s.observaciones && s.observaciones.toLowerCase().includes(state.semanasSearch))
        );
    }

    const totalRegistros = list.length;
    const badgeCount = document.getElementById('badgeContadorSemanas');
    if (badgeCount) badgeCount.innerText = `${totalRegistros} Registro${totalRegistros === 1 ? '' : 's'}`;

    if (totalRegistros === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center" style="padding: 28px; color: #9ca3af;">
                    <i class="fa-solid fa-inbox" style="font-size: 26px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No se encontraron semanas en esta secci    
                </td>
            </tr>`;
        actualizarPaginacionSemanas(0, 0, 0, 1, 1);
        return;
    }

    const pageSize = state.semanasPageSize;
    const totalPages = Math.ceil(totalRegistros / pageSize) || 1;
    if (state.semanasPage > totalPages) state.semanasPage = totalPages;
    if (state.semanasPage < 1) state.semanasPage = 1;

    const startIdx = (state.semanasPage - 1) * pageSize;
    const pageItems = list.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = pageItems.map(s => {
        const esCerrada = s.estado === 'CERRADO';
        const esActiva = s.estado === 'ABIERTO';
        const fIni = s.fechaInicio ? s.fechaInicio.split('T')[0] : '-';
        const fFin = s.fechaFin ? s.fechaFin.split('T')[0] : '-';

        return `
            <tr style="${esActiva ? 'background: rgba(59, 130, 246, 0.08); border-left: 3px solid #2563eb;' : ''}">
                <td>
                    <div style="font-weight: 800; color: ${esActiva ? '#2563eb' : '#0f172a'}; display: flex; align-items: center; gap: 6px; font-size: 13.5px;">
                        ${esActiva ? '<i class="fa-solid fa-play" style="color: #059669; font-size: 11px;"></i>' : ''}
                        ${s.codigo}
                    </div>
                </td>
                <td><span style="color: #334155; font-weight: 600; font-size: 13px;">${fIni}</span></td>
                <td><span style="color: #334155; font-weight: 600; font-size: 13px;">${fFin}</span></td>
                <td><strong style="color: #047857; font-size: 14px; font-weight: 800;">${(s.totalLitros || 0).toLocaleString()} Lts</strong></td>
                <td><span style="color: #2563eb; font-weight: 700; font-size: 13.5px;">$${(s.totalMontoUSD || 0).toFixed(2)}</span></td>
                <td><strong style="color: #0f172a; font-weight: 700; font-size: 13px;">Bs. ${(s.totalBrutoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></td>
                <td><span class="badge badge-secondary" style="font-size: 11.5px; font-weight: 700; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">${s.totalFincasParticipantes || 0} Fincas</span></td>
                <td><span class="badge badge-secondary" style="font-size: 11.5px; font-weight: 700; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">${s.totalCompaniasParticipantes || 0} Plantas</span></td>
                <td>
                    <span class="badge ${esActiva ? 'badge-success' : (esCerrada ? 'badge-danger' : 'badge-info')}" style="font-size: 11.5px;">
                        ${esActiva ? 'ACTIVA' : (esCerrada ? 'CERRADA' : 'PROGRAMADA')}
                    </span>
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: center; flex-wrap: wrap;">
                        ${!esCerrada ? `
                            <button type="button" class="btn btn-outline" onclick="abrirModalEditarSemana(${s.id})" title="Modificar Fechas" style="padding: 5px 10px; font-size: 12px; font-weight: 700; color: #2563eb; border-color: #93c5fd; background: #eff6ff; border-radius: 6px;">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                        ` : ''}

                        ${!esActiva && !esCerrada ? `
                            <button type="button" class="btn btn-outline" onclick="activarSemana(${s.id})" title="Establecer como Activa (En Curso)" style="padding: 5px 10px; font-size: 12px; font-weight: 700; color: #047857; border-color: #6ee7b7; background: #ecfdf5; border-radius: 6px;">
                                <i class="fa-solid fa-play"></i> Activar
                            </button>
                        ` : ''}

                        ${esActiva ? `
                            <button type="button" class="btn btn-outline" onclick="cerrarSemana(${s.id})" title="Cerrar Ciclo Operativo" style="padding: 5px 12px; font-size: 12px; font-weight: 800; color: #dc2626; border-color: #fca5a5; background: #fef2f2; border-radius: 6px; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.15);">
                                <i class="fa-solid fa-lock"></i> Cerrar Semana
                            </button>
                        ` : ''}

                        ${esCerrada ? `
                            <button type="button" class="btn btn-outline" onclick="reabrirSemana(${s.id}, '${escaparHTML(s.codigo)}')" title="Reabrir Ciclo Operativo para registrar o corregir tickets" style="padding: 5px 12px; font-size: 12px; font-weight: 800; color: #d97706; border-color: #fcd34d; background: #fffbeb; border-radius: 6px; box-shadow: 0 2px 6px rgba(217, 119, 6, 0.15);">
                                <i class="fa-solid fa-lock-open"></i> Reabrir Semana
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    actualizarPaginacionSemanas(startIdx + 1, Math.min(startIdx + pageSize, totalRegistros), totalRegistros, state.semanasPage, totalPages);
}

function actualizarPaginacionSemanas(start, end, total, page, totalPages) {
    const lbl = document.getElementById('lblResumenPaginacionSemanas');
    if (lbl) {
        lbl.innerText = total > 0 ? `Mostrando ${start} a ${end} de ${total} semanas` : 'Mostrando 0 semanas';
    }

    const container = document.getElementById('paginacionSemanasControls');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let buttons = `
        <button type="button" class="btn-page" ${page === 1 ? 'disabled' : ''} onclick="cambiarPaginaSemanas(${page - 1})">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
            buttons += `
                <button type="button" class="btn-page ${p === page ? 'active' : ''}" onclick="cambiarPaginaSemanas(${p})">
                    ${p}
                </button>
            `;
        } else if (p === page - 2 || p === page + 2) {
            buttons += `<span style="color: #6b7280; padding: 0 4px;">...</span>`;
        }
    }

    buttons += `
        <button type="button" class="btn-page ${page === totalPages ? 'disabled' : ''} onclick="cambiarPaginaSemanas(${page + 1})">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = buttons;
}

// --------------------------------------------------------------------------
// MODALES APERTURA Y EDICION DE SEMANAS
// --------------------------------------------------------------------------
function abrirModalCrearSemanaCustom() {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diffMartes = (2 - diaSemana + 7) % 7;
    const martes = new Date(hoy);
    martes.setDate(hoy.getDate() + diffMartes);

    const lunes = new Date(martes);
    lunes.setDate(martes.getDate() + 6);

    const fInicioStr = martes.toISOString().split('T')[0];
    const fFinStr = lunes.toISOString().split('T')[0];

    const elNombre = document.getElementById('inputSemanaNombre');
    if (elNombre) elNombre.value = `Semana (${fInicioStr} al ${fFinStr})`;

    const elIni = document.getElementById('inputSemanaFechaInicio');
    if (elIni) elIni.value = fInicioStr;

    const elFin = document.getElementById('inputSemanaFechaFin');
    if (elFin) elFin.value = fFinStr;

    const elObs = document.getElementById('inputSemanaObservación');
    if (elObs) elObs.value = '';

    abrirModalCustom('modalCrearSemanaCustom');
}

async function guardarSemanaIndividual(e) {
    e.preventDefault();
    const codigo = document.getElementById('inputSemanaNombre')?.value.trim();
    const fechaInicio = document.getElementById('inputSemanaFechaInicio')?.value;
    const fechaFin = document.getElementById('inputSemanaFechaFin')?.value;
    const observaciones = (document.getElementById('inputSemanaObservación')?.value || '').trim();

    if (!codigo || !fechaInicio || !fechaFin) {
        Swal.fire({ icon: 'warning', title: 'Campos Requeridos', text: 'Ingresa el nombre y las fechas de inicio y cierre.' });
        return;
    }

    const btn = document.getElementById('btnGuardarSemanaSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Guardar';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/ciclos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ codigo, fechaInicio, fechaFin, observaciones })
        });

        const data = await res.json();
        if (res.ok) {
            cerrarModalCustom('modalCrearSemanaCustom');
            showToast('Semana operativa creada exitosamente.');
            await cargarSemanas();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo crear la semana.' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}

function abrirModalEditarSemana(id) {
    const semana = (state.semanas || []).find(s => s.id === id);
    if (!semana) {
        Swal.fire({ icon: 'error', title: 'No encontrada', text: 'No se encontr     la semana seleccionada.' });
        return;
    }

    if (semana.estado === 'CERRADO') {
        Swal.fire({ icon: 'warning', title: 'Semana Cerrada', text: 'Esta semana ya ha sido cerrada y no permite modificaciones en sus fechas.' });
        return;
    }

    const elId = document.getElementById('inputEditSemanaId');
    if (elId) elId.value = semana.id;

    const elNom = document.getElementById('inputEditSemanaNombre');
    if (elNom) elNom.value = semana.codigo;

    const elIni = document.getElementById('inputEditSemanaFechaInicio');
    if (elIni) elIni.value = semana.fechaInicio ? semana.fechaInicio.split('T')[0] : '';

    const elFin = document.getElementById('inputEditSemanaFechaFin');
    if (elFin) elFin.value = semana.fechaFin ? semana.fechaFin.split('T')[0] : '';

    const elObs = document.getElementById('inputEditSemanaObservación');
    if (elObs) elObs.value = semana.observaciones || '';

    abrirModalCustom('modalEditarSemanaCustom');
}

async function guardarEdicionSemana(e) {
    e.preventDefault();
    const id = document.getElementById('inputEditSemanaId')?.value;
    const codigo = document.getElementById('inputEditSemanaNombre')?.value.trim();
    const fechaInicio = document.getElementById('inputEditSemanaFechaInicio')?.value;
    const fechaFin = document.getElementById('inputEditSemanaFechaFin')?.value;
    const observaciones = (document.getElementById('inputEditSemanaObservación')?.value || '').trim();

    if (!id || !codigo || !fechaInicio || !fechaFin) {
        Swal.fire({ icon: 'warning', title: 'Campos Incompletos', text: 'Por favor completa el c     y las fechas.' });
        return;
    }

    const btn = document.getElementById('btnGuardarEditSemanaSubmit');
    const oldHtml = btn ? btn.innerHTML : 'Guardar';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/ciclos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ codigo, fechaInicio, fechaFin, observaciones })
        });

        const data = await res.json();
        if (res.ok) {
            cerrarModalCustom('modalEditarSemanaCustom');
            showToast('Fechas de semana actualizadas correctamente.');
            await cargarSemanas();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Error al modificar semana.' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}

function abrirModalGenerar52Custom() {
    const currentYear = new Date().getFullYear();
    const elAnio = document.getElementById('selectAnio52') || document.getElementById('gen52Anio');
    if (elAnio) elAnio.value = currentYear;

    const elDiaIni = document.getElementById('selectDiaInicio52') || document.getElementById('gen52DiaInicio');
    if (elDiaIni) elDiaIni.value = '2'; // Martes

    const elDiaFin = document.getElementById('selectDiaFin52') || document.getElementById('gen52DiaFin');
    if (elDiaFin) elDiaFin.value = '1'; // Lunes

    actualizarPreview52Semanas();
    abrirModalCustom('modalGenerar52Custom');
}

function actualizarPreview52Semanas() {
    const elAnio = document.getElementById('selectAnio52') || document.getElementById('gen52Anio');
    const elDiaIni = document.getElementById('selectDiaInicio52') || document.getElementById('gen52DiaInicio');

    const anio = parseInt(elAnio?.value) || new Date().getFullYear();
    const diaInicio = parseInt(elDiaIni?.value || 2);
    
    let cursor = new Date(anio, 0, 1);
    const diff = (diaInicio - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    let html = '';
    for (let sem = 1; sem <= 52; sem++) {
        const fIni = new Date(cursor);
        const fFin = new Date(cursor);
        fFin.setDate(cursor.getDate() + 6);

        const fIniStr = fIni.toISOString().split('T')[0];
        const fFinStr = fFin.toISOString().split('T')[0];

        html += `
            <div class="preview-52-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px;">
                <span style="font-weight: 700; color: #60a5fa;">Semana ${String(sem).padStart(2, '0')}</span>
                <span style="color: #e2e8f0;">${fIniStr} al ${fFinStr}</span>
                <span style="font-size: 11px; color: #94a3b8;">(7 d    </span>
            </div>
        `;

        cursor.setDate(cursor.getDate() + 7);
    }

    const box = document.getElementById('boxPreview52') || document.getElementById('preview52Container');
    if (box) box.innerHTML = html;

    const badge = document.getElementById('badgeTotalPrevisualizadas');
    if (badge) badge.innerText = '52 Semanas';
}

async function ejecutarGeneracion52Semanas(e) {
    e.preventDefault();
    const anio = parseInt(document.getElementById('selectAnio52')?.value || document.getElementById('gen52Anio')?.value);
    const diaInicio = parseInt(document.getElementById('selectDiaInicio52')?.value || document.getElementById('gen52DiaInicio')?.value);
    const diaFin = parseInt(document.getElementById('selectDiaFin52')?.value || document.getElementById('gen52DiaFin')?.value);

    const btn = document.getElementById('btnSubmitGenerar52');
    const oldHtml = btn ? btn.innerHTML : 'Generar Planificación';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Planificando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE}/ciclos/generar-52`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ anio, diaInicio, diaFin })
        });

        const data = await res.json();
        if (res.ok) {
            cerrarModalCustom('modalGenerar52Custom');
            Swal.fire({
                icon: 'success',
                title: '¡Generación Exitosa!',
                text: data.message || 'Se han planificado las 52 semanas del año.',
                background: '#1e293b',
                color: '#fff'
            });
            await cargarSemanas();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudieron generar las semanas.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}

async function activarSemana(id) {
    let validacion = null;
    try {
        const resVal = await fetch(`${API_BASE}/ciclos/${id}/validar-activacion`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resVal.ok) {
            validacion = await resVal.json();
        }
    } catch (e) {
        console.warn('Error validando secuencia de activación:', e);
    }

    const cicloObj = (state.semanas || []).find(s => s.id === id) || {};
    const codigoCiclo = validacion?.cicloAActivarCodigo || cicloObj.codigo || `Ciclo #${id}`;
    const stockPrevio = validacion ? Number(validacion.ultimoCicloCerradoStockFinal || 0) : 0;
    const esSecuenciaCorrecta = validacion ? validacion.esSecuenciaCorrecta : true;

    if (!esSecuenciaCorrecta && validacion) {
        // Advertencia de salto de secuencia (Ej: se cerró ciclo 35 y se intenta activar ciclo 37)
        const result = await Swal.fire({
            title: '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> ¡Advertencia de Secuencia de Ciclos!',
            html: `
                <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                    <div style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                        <div style="color: #fbbf24; font-weight: 800; font-size: 13.5px; margin-bottom: 6px;">
                            <i class="fa-solid fa-shuffle"></i> Salto de Ciclo Detectado
                        </div>
                        <p style="margin: 0 0 6px 0; color: #f8fafc;">
                            El último ciclo cerrado fue: <strong style="color: #93c5fd;">${validacion.ultimoCicloCerradoCodigo || 'N/A'}</strong> 
                            con <strong style="color: #38bdf8;">${stockPrevio.toLocaleString('es-VE')} Lts</strong> en tanque.
                        </p>
                        <p style="margin: 0 0 6px 0; color: #f8fafc;">
                            El ciclo correlativo que corresponde activar es: <strong style="color: #4ade80;">${validacion.cicloSiguienteEsperadoCodigo || 'N/A'}</strong>.
                        </p>
                        <p style="margin: 0; color: #fca5a5;">
                            Estás a punto de activar: <strong style="color: #ef4444; font-size: 14px;">${codigoCiclo}</strong>.
                        </p>
                    </div>

                    <p style="color: #f1f5f9; margin-bottom: 10px;">
                        ¿Deseas transferir los <strong>${stockPrevio.toLocaleString('es-VE')} Lts</strong> de stock inicial a este ciclo (<strong>${codigoCiclo}</strong>) o prefieres cancelar para activar la semana correlativa correcta?
                    </p>

                    <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid #475569; border-radius: 8px; padding: 10px;">
                        <label for="swalStockTransferir" style="display: block; font-weight: 700; color: #f8fafc; font-size: 12.5px; margin-bottom: 4px;">
                            Stock Inicial a asignar a ${codigoCiclo} (Lts):
                        </label>
                        <input id="swalStockTransferir" type="number" step="1" min="0" value="${stockPrevio}" class="swal2-input" 
                            style="width: 100%; box-sizing: border-box; margin: 0; height: 40px; font-size: 15px; font-weight: 800; color: #0284c7; background: #ffffff; border: 2px solid #38bdf8; border-radius: 6px; text-align: center;" />
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: `<i class="fa-solid fa-arrow-right-arrow-left"></i> Transferir Stock y Activar`,
            cancelButtonText: 'Cancelar y Revisar',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b',
            background: '#0f172a',
            color: '#fff',
            focusConfirm: false,
            preConfirm: () => {
                const stockVal = parseFloat(document.getElementById('swalStockTransferir')?.value || '0');
                return { stockPersonalizado: isNaN(stockVal) ? 0 : stockVal };
            }
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`${API_BASE}/ciclos/${id}/activar`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}` 
                },
                body: JSON.stringify({ stockInicialPersonalizado: result.value.stockPersonalizado })
            });
            const data = await res.json();
            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Ciclo Activado',
                    text: `El ciclo '${codigoCiclo}' fue activado con ${result.value.stockPersonalizado.toLocaleString('es-VE')} Lts de stock inicial.`,
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
        return;
    }

    // Secuencia normal correcta
    const confirm = await Swal.fire({
        title: `¿Activar ${codigoCiclo}?`,
        html: `
            <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                <p style="margin-bottom: 10px; color: #f1f5f9;">
                    Este ciclo se convertirá en el <strong>ciclo ACTIVO</strong> para el registro de recolecciones y despachos.
                </p>
                ${stockPrevio > 0 ? `
                <div style="background: rgba(16, 185, 129, 0.12); border: 1.5px solid #10b981; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                    <div style="color: #34d399; font-weight: 700; font-size: 12.5px;">
                        <i class="fa-solid fa-oil-well"></i> Traspaso de Stock Automático:
                    </div>
                    <span style="color: #f8fafc; font-size: 13px;">
                        Heredará <strong>${stockPrevio.toLocaleString('es-VE')} Lts</strong> de stock en tanque del ciclo anterior.
                    </span>
                </div>
                ` : ''}
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-play"></i> Sí, Activar Ciclo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/ciclos/${id}/activar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}` 
            },
            body: JSON.stringify({})
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Semana activada como ciclo corriente.');
            await cargarSemanas();
            await cargarCicloActivo();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message, background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' });
    }
}

// =========================================================================
// PANEL VISUAL DE RECOLECCIÓN EN RUTA EN VIVO (TICKETS & CHOFER)
// =========================================================================

let stateRecoleccionVisual = {
    ticketId: null,
    viaje: null,
    fincasAsignadas: [],
    recoleccionesDelTicket: [],
    todasLasFincasVisual: [],
    filtroTab: 'todas',
    busquedaTexto: ''
};
let comboboxFincaExtraInstance = null;

async function cargarPanelRecoleccionVisual(ticketId) {
    if (!ticketId) return;
    stateRecoleccionVisual.ticketId = ticketId;
    state.filtroTicketId = ticketId;
    state.ticketAsignadoActivo = ticketId;

    const panel = document.getElementById('panelRecoleccionVisualRuta');
    if (panel) panel.style.display = 'block';

    // Obtener información del Viaje / Ticket
    let viaje = (state.viajesDelDia || state.todosLosViajesReceptoria || state.cacheTicketsViajes?.todos || []).find(v => (v.id || v.Id) == ticketId);
    if (!viaje) {
        try {
            const resV = await fetch(`${API_BASE}/control-rutas/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (resV.ok) viaje = await resV.json();
        } catch (e) {
            console.warn('Error al cargar ticket:', e);
        }
    }
    stateRecoleccionVisual.viaje = viaje;

    // Actualizar Encabezado
    const lblTicketId = document.getElementById('lblVisualTicketId');
    if (lblTicketId) lblTicketId.textContent = ticketId;

    const lblRutaNombre = document.getElementById('lblVisualRutaNombre');
    const badgeRuta = document.getElementById('badgeVisualRutaNombre');
    const rutaNombre = viaje?.nombreRutaLogistica || viaje?.rutaNombre || viaje?.rutaLogisticaNombre || 'Sin Ruta Asignada';
    if (lblRutaNombre) lblRutaNombre.textContent = rutaNombre;
    if (badgeRuta && viaje?.colorRutaLogistica) {
        badgeRuta.style.borderColor = viaje.colorRutaLogistica;
    }

    const lblChofer = document.getElementById('lblVisualChoferNombre');
    if (lblChofer) lblChofer.textContent = capitalizarTexto(viaje?.nombreConductor || viaje?.conductorNombre || state.user?.nombreCompleto || 'Chofer');

    const lblFecha = document.getElementById('lblVisualFecha');
    const fechaTicket = viaje?.fecha ? viaje.fecha.split('T')[0] : (state.rutasFechaFiltro || new Date().toISOString().split('T')[0]);
    if (lblFecha) lblFecha.textContent = fechaTicket;

    // 1. Cargar recolecciones YA registradas en este ticket
    let recsTicket = [];
    try {
        const resRecs = await fetch(`${API_BASE}/control-rutas/${ticketId}/fincas`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (resRecs.ok) {
            recsTicket = await resRecs.json();
        }
    } catch (e) {
        console.warn('Error al cargar fincas del ticket:', e);
    }
    stateRecoleccionVisual.recoleccionesDelTicket = recsTicket || [];

    // 2. Cargar fincas asignadas a la ruta del ticket
    let fincasRuta = [];
    const rutaId = viaje?.rutaLogisticaId || viaje?.RutaLogisticaId;
    if (rutaId) {
        try {
            const resFincasRuta = await fetch(`${API_BASE}/rutas-logistica/${rutaId}/fincas`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (resFincasRuta.ok) {
                const todas = await resFincasRuta.json();
                fincasRuta = (todas || []).filter(f => Number(f.asignada || f.Asignada || 0) === 1);
            }
        } catch (e) {
            console.warn('Error al cargar fincas de ruta logística:', e);
        }
    }

    // Si la ruta logística no trajo o el ticket no tenía ruta específica, buscar en state.fincas
    if (fincasRuta.length === 0 && rutaId && Array.isArray(state.fincas)) {
        fincasRuta = state.fincas.filter(f => (f.rutaId || f.RutaId) == rutaId);
    }
    stateRecoleccionVisual.fincasAsignadas = fincasRuta;

    // 3. Cruzar fincas asignadas con recolecciones registradas
    const mapRecogidasPorFinca = new Map();
    (stateRecoleccionVisual.recoleccionesDelTicket || []).forEach(r => {
        const fid = Number(r.fincaId || r.FincaId);
        mapRecogidasPorFinca.set(fid, r);
    });

    const listaVisual = [];
    const idsFincasProcesadas = new Set();

    // Agregar fincas de la ruta
    fincasRuta.forEach(f => {
        const fid = Number(f.id || f.Id);
        idsFincasProcesadas.add(fid);
        const recogida = mapRecogidasPorFinca.get(fid);
        if (recogida) {
            listaVisual.push({
                fincaId: fid,
                nombre: f.nombre || f.Nombre,
                propietario: f.propietario || f.Propietario || '',
                codigo: f.codigo || f.Codigo || '',
                estado: 'RECOGIDA',
                litros: Number(recogida.litros || recogida.Litros || 0),
                esAcida: Boolean(recogida.esAcida || recogida.EsAcida),
                tipoLeche: recogida.tipoLeche || recogida.TipoLeche || 'VACA',
                tieneDosTiposLeche: Boolean(f.tieneDosTiposLeche || f.TieneDosTiposLeche || recogida.tieneDosTiposLeche),
                recoleccionId: recogida.id || recogida.Id,
                observacion: recogida.observacion || recogida.Observacion || '',
                esFueraDeRuta: false
            });
        } else {
            listaVisual.push({
                fincaId: fid,
                nombre: f.nombre || f.Nombre,
                propietario: f.propietario || f.Propietario || '',
                codigo: f.codigo || f.Codigo || '',
                estado: 'PENDIENTE',
                litros: 0,
                esAcida: false,
                tipoLeche: 'VACA',
                tieneDosTiposLeche: Boolean(f.tieneDosTiposLeche || f.TieneDosTiposLeche),
                recoleccionId: null,
                observacion: '',
                esFueraDeRuta: false
            });
        }
    });

    // Agregar fincas recogidas que estaban FUERA de la ruta asignada
    (stateRecoleccionVisual.recoleccionesDelTicket || []).forEach(r => {
        const fid = Number(r.fincaId || r.FincaId);
        if (!idsFincasProcesadas.has(fid)) {
            listaVisual.push({
                fincaId: fid,
                nombre: r.fincaNombre || r.FincaNombre || 'Finca Fuera de Ruta',
                propietario: r.propietario || r.Propietario || '',
                codigo: '',
                estado: 'RECOGIDA',
                litros: Number(r.litros || r.Litros || 0),
                esAcida: Boolean(r.esAcida || r.EsAcida),
                tipoLeche: r.tipoLeche || r.TipoLeche || 'VACA',
                tieneDosTiposLeche: Boolean(r.tieneDosTiposLeche),
                recoleccionId: r.id || r.Id,
                observacion: r.observacion || r.Observacion || '',
                esFueraDeRuta: true
            });
        }
    });

    stateRecoleccionVisual.todasLasFincasVisual = listaVisual;

    // Calcular Métricas
    const totalLitros = (stateRecoleccionVisual.recoleccionesDelTicket || []).reduce((acc, r) => acc + Number(r.litros || r.Litros || 0), 0);
    const totalAsignadas = fincasRuta.length;
    const totalRecogidas = listaVisual.filter(f => f.estado === 'RECOGIDA').length;
    const porcentaje = totalAsignadas > 0 ? Math.min(100, Math.round((totalRecogidas / totalAsignadas) * 100)) : (totalRecogidas > 0 ? 100 : 0);

    const kpiLitros = document.getElementById('kpiVisualLitrosTanque');
    if (kpiLitros) kpiLitros.textContent = totalLitros.toLocaleString('es-VE');

    const kpiConteo = document.getElementById('kpiVisualFincasConteo');
    if (kpiConteo) kpiConteo.textContent = `${totalRecogidas} / ${totalAsignadas}`;

    const lblPct = document.getElementById('lblVisualPorcentajeAvance');
    if (lblPct) lblPct.textContent = `${porcentaje}%`;

    const barProgreso = document.getElementById('barVisualProgresoRuta');
    if (barProgreso) barProgreso.style.width = `${porcentaje}%`;

    // Actualizar badges de pestañas
    const cntTodas = document.getElementById('cntVisualTab_todas');
    if (cntTodas) cntTodas.textContent = listaVisual.length;

    const cntPendientes = document.getElementById('cntVisualTab_pendientes');
    const pendientesCount = listaVisual.filter(f => f.estado === 'PENDIENTE').length;
    if (cntPendientes) cntPendientes.textContent = pendientesCount;

    const cntRecogidas = document.getElementById('cntVisualTab_recogidas');
    if (cntRecogidas) cntRecogidas.textContent = totalRecogidas;

    renderVisualFincasCards();
    renderHistorialEnVivoTicket();
}
window.cargarPanelRecoleccionVisual = cargarPanelRecoleccionVisual;

function filtrarVisualFincasTab(tab) {
    stateRecoleccionVisual.filtroTab = tab;
    document.querySelectorAll('.btn-visual-tab').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#475569';
        b.style.fontWeight = '600';
    });
    const btnActivo = document.getElementById(`tabVisualFincas_${tab}`);
    if (btnActivo) {
        btnActivo.classList.add('active');
        btnActivo.style.background = tab === 'recogidas' ? '#16a34a' : '#2563eb';
        btnActivo.style.color = '#ffffff';
        btnActivo.style.fontWeight = '700';
    }
    renderVisualFincasCards();
}
window.filtrarVisualFincasTab = filtrarVisualFincasTab;

function onFiltrarVisualFincasInput(val) {
    stateRecoleccionVisual.busquedaTexto = (val || '').toLowerCase().trim();
    renderVisualFincasCards();
}
window.onFiltrarVisualFincasInput = onFiltrarVisualFincasInput;

function renderVisualFincasCards() {
    const container = document.getElementById('gridVisualFincasAsignadas');
    if (!container) return;

    let items = stateRecoleccionVisual.todasLasFincasVisual || [];

    // Filtro por pestaña
    if (stateRecoleccionVisual.filtroTab === 'pendientes') {
        items = items.filter(f => f.estado === 'PENDIENTE');
    } else if (stateRecoleccionVisual.filtroTab === 'recogidas') {
        items = items.filter(f => f.estado === 'RECOGIDA');
    }

    // Filtro por búsqueda
    if (stateRecoleccionVisual.busquedaTexto) {
        const q = stateRecoleccionVisual.busquedaTexto;
        items = items.filter(f => 
            (f.nombre || '').toLowerCase().includes(q) ||
            (f.propietario || '').toLowerCase().includes(q) ||
            (f.codigo || '').toLowerCase().includes(q)
        );
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #94a3b8; background: #ffffff; border-radius: 12px; border: 1.5px dashed #cbd5e1;">
                <i class="fa-solid fa-cow" style="font-size: 32px; color: #cbd5e1; margin-bottom: 10px; display: block;"></i>
                <div style="font-size: 15px; font-weight: 700; color: #475569; margin-bottom: 4px;">No se encontraron fincas en esta vista</div>
                <div style="font-size: 12.5px; color: #64748b;">
                    ${stateRecoleccionVisual.busquedaTexto ? 'Prueba con otro término de búsqueda o limpia el buscador.' : 'No hay fincas con el filtro seleccionado.'}
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(f => {
        const nombreEscapado = (f.nombre || '').replace(/'/g, "\\'");
        const propEscapado = (f.propietario || '').replace(/'/g, "\\'");

        if (f.estado === 'RECOGIDA') {
            return `
                <div class="finca-card-visual" style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 2px 6px rgba(16,185,129,0.08); transition: transform 0.15s ease, box-shadow 0.15s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
                        <div style="font-weight: 800; font-size: 14px; color: #166534; line-height: 1.25;">
                            <i class="fa-solid fa-cow" style="color: #10b981; margin-right: 4px;"></i> ${f.nombre}
                            ${f.esFueraDeRuta ? '<span class="badge" style="background: #fef3c7; color: #b45309; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">📍 Fuera Zona</span>' : ''}
                        </div>
                        <span class="badge" style="background: #10b981; color: #ffffff; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
                            ✓ RECOGIDA
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #475569;">
                        ${f.propietario ? `<i class="fa-solid fa-user" style="font-size: 10.5px; color: #64748b; margin-right: 3px;"></i> ${f.propietario}` : ''}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1px solid #bbf7d0;">
                        <div>
                            <span style="font-size: 22px; font-weight: 900; color: #15803d; line-height: 1;">
                                ${f.litros.toLocaleString('es-VE')}
                            </span>
                            <span style="font-size: 13px; font-weight: 700; color: #166534; margin-left: 2px;">Lts</span>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            ${f.esAcida ? '<span class="badge" style="background: #fee2e2; color: #dc2626; font-size: 10.5px; font-weight: 800; padding: 2px 6px;">⚠️ ÁCIDA</span>' : ''}
                            <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; padding: 2px 6px;">${f.tipoLeche}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 2px;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalEditarRutaCompleta(${f.recoleccionId})"
                            style="flex: 1; height: 30px; font-size: 12px; border-color: #86efac; color: #166534; font-weight: 700; background: #ffffff; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border-radius: 6px; cursor: pointer;">
                            <i class="fa-solid fa-pen-to-square"></i> Editar Litros
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="eliminarRutaRegistro(${f.recoleccionId})"
                            style="height: 30px; width: 34px; padding: 0; font-size: 12px; border-color: #fca5a5; color: #dc2626; background: #ffffff; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer;" title="Eliminar recolección">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="finca-card-visual" onclick="abrirModalQuickRecoleccion(${f.fincaId}, '${nombreEscapado}', '${propEscapado}', ${f.tieneDosTiposLeche})"
                    style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); transition: all 0.2s ease;"
                    onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 4px 14px rgba(59,130,246,0.12)'; this.style.transform='translateY(-2px)';"
                    onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.03)'; this.style.transform='none';">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
                        <div style="font-weight: 800; font-size: 14px; color: #0f172a; line-height: 1.25;">
                            <i class="fa-solid fa-cow" style="color: #64748b; margin-right: 4px;"></i> ${f.nombre}
                        </div>
                        <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 6px;">
                            ⏳ PENDIENTE
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                        ${f.propietario ? `<i class="fa-solid fa-user" style="font-size: 10.5px; margin-right: 3px;"></i> ${f.propietario}` : '<span style="font-style: italic;">Sin propietario</span>'}
                    </div>
                    <button type="button" class="btn btn-sm"
                        style="width: 100%; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-weight: 700; font-size: 12.5px; border-radius: 8px; padding: 7px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s ease;">
                        <i class="fa-solid fa-plus-circle" style="color: #2563eb;"></i> Registrar Litros
                    </button>
                </div>
            `;
        }
    }).join('');
}
window.renderVisualFincasCards = renderVisualFincasCards;

function renderHistorialEnVivoTicket() {
    const tbody = document.getElementById('tbodyHistorialEnVivoTicket');
    const tfoot = document.getElementById('tfootHistorialEnVivoTicket');
    const badgeHistorial = document.getElementById('badgeTotalRecoleccionesHistorial');
    const lblTotal = document.getElementById('lblHistorialTotalLitros');
    if (!tbody) return;

    const items = stateRecoleccionVisual.recoleccionesDelTicket || [];
    if (badgeHistorial) badgeHistorial.textContent = items.length;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 28px; color: #94a3b8; font-size: 13.5px;">
                    <i class="fa-solid fa-clipboard-list" style="font-size: 26px; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
                    A&uacute;n no se han registrado recolecciones en este viaje. Selecciona una finca asignada arriba para comenzar.
                </td>
            </tr>
        `;
        if (tfoot) tfoot.style.display = 'none';
        return;
    }

    let sumaTotal = 0;
    tbody.innerHTML = items.map((r, idx) => {
        const litros = Number(r.litros || r.Litros || 0);
        sumaTotal += litros;
        const rid = r.id || r.Id;
        const fNom = r.fincaNombre || r.FincaNombre || 'Finca';
        const prop = r.propietario || r.Propietario || '';
        const esAcida = Boolean(r.esAcida || r.EsAcida);
        const tipoLeche = r.tipoLeche || r.TipoLeche || 'VACA';
        const obs = r.observacion || r.Observacion || '';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="text-align: center; font-weight: 800; color: #64748b; font-size: 12px;">#${idx + 1}</td>
                <td>
                    <div style="font-weight: 800; font-size: 13.5px; color: #0f172a;">${fNom}</div>
                    ${prop ? `<div style="font-size: 11.5px; color: #64748b;">${prop}</div>` : ''}
                </td>
                <td style="text-align: right;">
                    <span style="font-size: 15px; font-weight: 900; color: #15803d;">
                        ${litros.toLocaleString('es-VE')} <span style="font-size: 11.5px; font-weight: 700;">Lts</span>
                    </span>
                </td>
                <td style="text-align: center;">
                    <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                        <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 10.5px; padding: 2px 6px;">${tipoLeche}</span>
                        ${esAcida ? '<span class="badge" style="background: #fee2e2; color: #dc2626; font-weight: 800; font-size: 10px; padding: 2px 6px;">ÁCIDA</span>' : ''}
                    </div>
                </td>
                <td style="font-size: 12px; color: #64748b; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${obs || '<span style="color: #cbd5e1;">-</span>'}
                </td>
                <td style="text-align: center;">
                    <div style="display: inline-flex; gap: 4px;">
                        <button type="button" class="btn btn-sm btn-outline" onclick="abrirModalEditarRutaCompleta(${rid})"
                            style="height: 28px; width: 28px; padding: 0; font-size: 11.5px; border-color: #cbd5e1; color: #2563eb; background: #fff; cursor: pointer;" title="Editar Litros">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="eliminarRutaRegistro(${rid})"
                            style="height: 28px; width: 28px; padding: 0; font-size: 11.5px; border-color: #fca5a5; color: #dc2626; background: #fff; cursor: pointer;" title="Eliminar Recolección">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (tfoot) {
        tfoot.style.display = 'table-footer-group';
        if (lblTotal) lblTotal.textContent = `${sumaTotal.toLocaleString('es-VE')} Lts`;
    }
}
window.renderHistorialEnVivoTicket = renderHistorialEnVivoTicket;

function abrirModalQuickRecoleccion(fincaId, nombre, propietario, tieneDosTiposLeche) {
    const hid = document.getElementById('quickRecoleccionFincaId');
    if (hid) hid.value = fincaId;

    const tit = document.getElementById('modalQuickFincaTitulo');
    if (tit) tit.textContent = nombre;

    const sub = document.getElementById('modalQuickFincaSubtitulo');
    if (sub) sub.textContent = propietario ? `Ganadero: ${propietario}` : 'Ganadero';

    const groupTipo = document.getElementById('groupQuickTipoLeche');
    if (groupTipo) {
        groupTipo.style.display = tieneDosTiposLeche ? 'block' : 'none';
    }

    const inpLitros = document.getElementById('quickRecoleccionLitros');
    if (inpLitros) {
        inpLitros.value = '';
    }

    const chkAcida = document.getElementById('quickRecoleccionEsAcida');
    if (chkAcida) chkAcida.checked = false;

    const inpObs = document.getElementById('quickRecoleccionObservacion');
    if (inpObs) inpObs.value = '';

    abrirModalCustom('modalQuickRecoleccion');
    if (inpLitros) {
        setTimeout(() => inpLitros.focus(), 100);
    }
}
window.abrirModalQuickRecoleccion = abrirModalQuickRecoleccion;

async function guardarQuickRecoleccion(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const btn = document.getElementById('btnGuardarQuickRecoleccion');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    const fincaId = parseInt(document.getElementById('quickRecoleccionFincaId')?.value);
    const litros = parseInt(document.getElementById('quickRecoleccionLitros')?.value);
    const esAcida = document.getElementById('quickRecoleccionEsAcida')?.checked || false;
    const tipoLeche = document.getElementById('quickRecoleccionTipoLeche')?.value || 'VACA';
    const observacion = (document.getElementById('quickRecoleccionObservacion')?.value || '').trim();

    const currentTicket = stateRecoleccionVisual.ticketId || state.filtroTicketId || state.ticketAsignadoActivo;
    const viaje = stateRecoleccionVisual.viaje;
    const fecha = viaje?.fecha ? viaje.fecha.split('T')[0] : (state.rutasFechaFiltro || new Date().toISOString().split('T')[0]);
    const conductorId = viaje?.usuarioId || viaje?.conductorId || state.user?.id;

    if (!fincaId || isNaN(fincaId) || isNaN(litros) || litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Datos Inválidos', text: 'Por favor ingresa los litros recolectados.', background: '#1e293b', color: '#fff' });
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/rutas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha,
                fincaId,
                conductorId,
                litros,
                tipoLeche,
                esAcida,
                observacion,
                controlRutaId: currentTicket
            })
        });

        if (res.ok) {
            cerrarModalCustom('modalQuickRecoleccion');
            const fObj = stateRecoleccionVisual.todasLasFincasVisual.find(f => f.fincaId === fincaId);
            const fincaNom = fObj ? fObj.nombre : 'Finca';
            showToast(`✓ Recolección registrada: ${litros.toLocaleString('es-VE')} Lts en ${fincaNom}`);

            await cargarPanelRecoleccionVisual(currentTicket);

            if (typeof cargarRutasHoy === 'function') {
                cargarRutasHoy(fecha);
            }
            if (typeof cargarViajesRutasDelDia === 'function') {
                cargarViajesRutasDelDia(fecha);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Guardar', text: errData.message || 'No se pudo guardar la recolección.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Red', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}
window.guardarQuickRecoleccion = guardarQuickRecoleccion;

function inicializarComboboxFincaExtra() {
    if (!comboboxFincaExtraInstance && document.getElementById('comboboxFincaExtra')) {
        comboboxFincaExtraInstance = setupCombobox({
            containerId: 'comboboxFincaExtra',
            inputSearchId: 'searchFincaExtraInput',
            inputHiddenId: 'selectFincaExtra',
            dropdownId: 'dropdownFincaExtraList',
            placeholder: 'BUSCAR CUALQUIER FINCA...',
            getItemsFn: () => (state.fincas || [])
                .filter(f => f.activo !== false && f.Activo !== false)
                .map(f => {
                    const id = f.id || f.Id;
                    const nombre = capitalizarTexto(f.nombre || f.Nombre);
                    const prop = capitalizarTexto(f.propietario || f.Propietario);
                    return {
                        value: id,
                        label: prop ? `${nombre} (${prop})` : nombre,
                        sub: f.codigo || ''
                    };
                }),
            onSelect: async (item) => {
                if (item && item.value) {
                    const fid = Number(item.value);
                    const fechaHoy = stateRecoleccionVisual.viaje?.fecha ? stateRecoleccionVisual.viaje.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
                    const uid = state.user?.id || stateRecoleccionVisual.viaje?.usuarioId;
                    const previa = (state.rutas || []).find(r => 
                        Number(r.fincaId || r.FincaId) === fid && 
                        (r.fecha || '').startsWith(fechaHoy) && 
                        Number(r.conductorId || r.ConductorId || r.usuarioId || r.UsuarioId) !== Number(uid)
                    );
                    if (previa) {
                        const otroChofer = previa.conductorNombre || previa.nombreConductor || 'Otro Chofer';
                        const litrosPrevios = previa.litros || previa.Litros || 0;
                        const conf = await Swal.fire({
                            title: '¡Finca ya recogida hoy!',
                            html: `
                                <div style="text-align: left; font-size: 13.5px; line-height: 1.5; color: #f8fafc;">
                                    <p>El chofer <strong>${otroChofer}</strong> ya registró una recolección de 
                                    <strong style="color: #4ade80;">${litrosPrevios.toLocaleString('es-VE')} Lts</strong> en esta finca hoy.</p>
                                    <p style="margin-top: 8px; color: #fbbf24;">
                                        ¿Deseas registrar una <strong>segunda recolección</strong> (segundo ordeño del día) para este viaje?
                                    </p>
                                </div>
                            `,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: '<i class="fa-solid fa-cow"></i> Sí, es 2do Ordeño',
                            cancelButtonText: 'Cancelar Selección',
                            confirmButtonColor: '#2563eb',
                            cancelButtonColor: '#64748b',
                            background: '#1e293b',
                            color: '#fff'
                        });
                        if (!conf.isConfirmed) {
                            comboboxFincaExtraInstance.reset();
                        }
                    }
                }
            }
        });
    }
}

function abrirModalAgregarFincaExtra() {
    const lblTicket = document.getElementById('lblTicketFincaExtraNum');
    if (lblTicket) lblTicket.textContent = stateRecoleccionVisual.ticketId || '--';

    inicializarComboboxFincaExtra();
    if (comboboxFincaExtraInstance && typeof comboboxFincaExtraInstance.reset === 'function') {
        comboboxFincaExtraInstance.reset();
    }

    const inpLitros = document.getElementById('inputLitrosExtra');
    if (inpLitros) inpLitros.value = '';

    const chkAcida = document.getElementById('checkFincaExtraEsAcida');
    if (chkAcida) chkAcida.checked = false;

    const inpObs = document.getElementById('inputObservacionExtra');
    if (inpObs) inpObs.value = '';

    abrirModalCustom('modalAgregarFincaExtra');
    const inpSearch = document.getElementById('searchFincaExtraInput');
    if (inpSearch) {
        setTimeout(() => inpSearch.focus(), 100);
    }
}
window.abrirModalAgregarFincaExtra = abrirModalAgregarFincaExtra;

async function guardarFincaExtra(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const btn = document.getElementById('btnGuardarFincaExtra');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;
    }

    const fincaId = parseInt(document.getElementById('selectFincaExtra')?.value);
    const litros = parseInt(document.getElementById('inputLitrosExtra')?.value);
    const esAcida = document.getElementById('checkFincaExtraEsAcida')?.checked || false;
    const observacion = (document.getElementById('inputObservacionExtra')?.value || '').trim();

    const currentTicket = stateRecoleccionVisual.ticketId || state.filtroTicketId || state.ticketAsignadoActivo;
    const viaje = stateRecoleccionVisual.viaje;
    const fecha = viaje?.fecha ? viaje.fecha.split('T')[0] : (state.rutasFechaFiltro || new Date().toISOString().split('T')[0]);
    const conductorId = viaje?.usuarioId || viaje?.conductorId || state.user?.id;

    if (!fincaId || isNaN(fincaId) || isNaN(litros) || litros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Datos Incompletos', text: 'Por favor selecciona una finca e ingresa los litros.', background: '#1e293b', color: '#fff' });
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
        return;
    }

    const fObj = (state.fincas || []).find(f => (f.id || f.Id) == fincaId);
    const tipoLeche = (fObj && (fObj.tipoLeche || fObj.TipoLeche)) ? (fObj.tipoLeche || fObj.TipoLeche) : 'VACA';

    try {
        const res = await fetch(`${API_BASE}/rutas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                fecha,
                fincaId,
                conductorId,
                litros,
                tipoLeche,
                esAcida,
                observacion: observacion ? `[FUERA DE RUTA] ${observacion}` : '[FUERA DE RUTA]',
                controlRutaId: currentTicket
            })
        });

        if (res.ok) {
            cerrarModalCustom('modalAgregarFincaExtra');
            const fincaNom = fObj ? (fObj.nombre || fObj.Nombre) : 'Finca';
            showToast(`✓ Finca fuera de ruta agregada: ${litros.toLocaleString('es-VE')} Lts en ${fincaNom}`);

            await cargarPanelRecoleccionVisual(currentTicket);

            if (typeof cargarRutasHoy === 'function') {
                cargarRutasHoy(fecha);
            }
            if (typeof cargarViajesRutasDelDia === 'function') {
                cargarViajesRutasDelDia(fecha);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error al Guardar', text: errData.message || 'No se pudo guardar la recolección.', background: '#1e293b', color: '#fff' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error de Red', text: err.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
}
window.guardarFincaExtra = guardarFincaExtra;

function toggleFormularioManualVisual() {
    const cardForm = document.getElementById('cardFormularioCapturaRutas');
    const btn = document.getElementById('btnToggleFormularioManual');
    if (!cardForm) return;

    const isOculto = cardForm.style.display === 'none' || getComputedStyle(cardForm).display === 'none';
    if (isOculto) {
        cardForm.style.display = 'block';
        cardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Ocultar Formulario Manual';
    } else {
        cardForm.style.display = 'none';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-sliders"></i> Formulario Manual';
    }
}
window.toggleFormularioManualVisual = toggleFormularioManualVisual;
