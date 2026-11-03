// =========================================================================
// MÓDULO DASHBOARD / PANEL PRINCIPAL (DÍA VS SEMANA & GRÁFICAS REACTIVAS)
// =========================================================================

// --------------------------------------------------------------------------
// MÓDULO CICLO ACTIVO Y CATÁLOGOS BASE
// --------------------------------------------------------------------------

var formatearTextoSemana = window.formatearTextoSemana;

async function cargarCicloActivo() {
    try {
        const res = await fetch(`${API_BASE}/ciclos/activo`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const ciclo = await res.json();
            state.cicloActivo = ciclo;
            const elHeader = document.getElementById('cicloActivoHeader') || document.getElementById('cicloActivoTexto');
            if (elHeader && ciclo) {
                elHeader.innerHTML = `<i class="fa-solid fa-calendar-check" style="color: #38bdf8; margin-right: 6px;"></i> ${formatearTextoSemana(ciclo)}`;
            }
        }
    } catch (e) {
        console.warn('Error cargando ciclo activo:', e);
    }
}
window.cargarCicloActivo = cargarCicloActivo;

async function cargarCatalogos() {
    try {
        const [resFincas, resChoferes, resCompanias, resBancos, resSemanas] = await Promise.all([
            fetch(`${API_BASE}/catalogos/fincas`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/catalogos/conductores`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/catalogos/companias`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/catalogos/bancos`, { headers: { 'Authorization': `Bearer ${state.token}` } }),
            fetch(`${API_BASE}/ciclos/semanas`, { headers: { 'Authorization': `Bearer ${state.token}` } })
        ]);

        if (resFincas.ok) {
            const rawFincas = await resFincas.json();
            state.fincas = (rawFincas || []).map(f => ({
                ...f,
                nombre: capitalizarTexto(f.nombre || f.Nombre),
                propietario: capitalizarTexto(f.propietario || f.Propietario)
            }));
        }
        if (resChoferes.ok) {
            const rawChoferes = await resChoferes.json();
            state.choferes = (rawChoferes || [])
                .filter(c => {
                    const r = (c.rol || c.Rol || '').toUpperCase();
                    const rolId = c.rolId || c.RolId;
                    const id = c.id || c.Id;
                    return r !== 'ADMIN' && r !== 'ADMINISTRADOR' && r !== 'SUPERVISOR' && rolId !== 1 && rolId !== 2 && id !== 2018;
                })
                .map(c => ({
                    ...c,
                    nombreCompleto: capitalizarTexto(c.nombreCompleto || c.NombreCompleto || c.username || c.Username)
                }));
            state.conductores = state.choferes;
        }
        if (resCompanias.ok) {
            const rawComp = await resCompanias.json();
            state.companias = (rawComp || []).map(cp => ({
                ...cp,
                nombre: capitalizarTexto(cp.nombre || cp.Nombre),
                encargado: capitalizarTexto(cp.encargado || cp.Encargado)
            }));
        }
        if (resBancos.ok) {
            const rawBancos = await resBancos.json();
            state.bancos = (rawBancos || []).map(b => ({
                ...b,
                nombre: capitalizarTexto(b.nombre || b.Nombre)
            }));
        }
        if (resSemanas.ok) state.semanas = await resSemanas.json();

        if (typeof poblarSubFiltrosReportes === 'function') {
            poblarSubFiltrosReportes();
        }
    } catch (e) {
        console.warn('Error cargando catálogos:', e);
    }
}
window.cargarCatalogos = cargarCatalogos;

// --------------------------------------------------------------------------
// MÓDULO RUTAS DE RECOLECCIÓN
// --------------------------------------------------------------------------

async function cargarRutasHoy(fecha) {
    initRutasFormComboboxes();
    const inputFecha = document.getElementById('filtroFechaRutas');
    const inputFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
    const hoyStr = new Date().toISOString().split('T')[0];

    const fechaConsulta = fecha 
        || state.rutasFechaFiltro 
        || (inputFechaGlobal && inputFechaGlobal.value ? inputFechaGlobal.value : null)
        || (inputFecha && inputFecha.value ? inputFecha.value : null)
        || hoyStr;

    state.rutasFechaFiltro = fechaConsulta;
    if (inputFecha && inputFecha.value !== fechaConsulta) inputFecha.value = fechaConsulta;
    if (inputFechaGlobal && inputFechaGlobal.value !== fechaConsulta) inputFechaGlobal.value = fechaConsulta;

    // Adaptar formulario según rol
    const formGroupChofer = document.getElementById('formGroupRutaConductor');
    const searchChoferInput = document.getElementById('searchConductorInput');
    const selectChofer = document.getElementById('selectRutaConductor');
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
        const res = await fetch(`${API_BASE}/rutas/hoy?fecha=${fechaConsulta}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (res.ok) {
            let data = await res.json();
            if (state.user && state.user.rol === 'CHOFER') {
                const uid = state.user.id;
                data = (data || []).filter(r => (r.conductorId || r.usuarioId) == uid);
            }
            state.rutas = data;
            renderTablaRutas();
            const badgeFincas = document.getElementById('badgeContadorFincasRutas');
            if (badgeFincas) badgeFincas.textContent = state.rutas ? state.rutas.length : 0;
            const seccionFincas = document.getElementById('seccionFincasDetalleRutas');
            const seccionViajes = document.getElementById('seccionViajesRutasDelDia');
            if (state.vistaRutasModo === 'fincas' && seccionFincas && seccionViajes) {
                seccionFincas.style.display = 'block';
                seccionViajes.style.display = 'none';
            }
            if (typeof cargarViajesRutasDelDia === 'function') {
                cargarViajesRutasDelDia(fechaConsulta);
            }
        }
    } catch (err) {
        console.warn('Error al cargar rutas:', err);
    }
}
window.cargarRutasHoy = cargarRutasHoy;

function onCambiarFechaGlobalRutas(fecha) {
    if (!fecha) return;
    state.rutasFechaFiltro = fecha;

    // Al cambiar de fecha, resetear cualquier filtro de ticket anterior para que se vean todas las fincas de la nueva fecha
    state.filtroTicketId = null;
    state.ticketAsignadoActivo = null;
    const bannerTicket = document.getElementById('bannerFiltroTicketRutas');
    if (bannerTicket) bannerTicket.style.display = 'none';

    const inputFechaRutas = document.getElementById('filtroFechaRutas');
    if (inputFechaRutas && inputFechaRutas.value !== fecha) inputFechaRutas.value = fecha;

    const inputFechaGlobal = document.getElementById('filtroFechaGlobalRutas');
    if (inputFechaGlobal && inputFechaGlobal.value !== fecha) inputFechaGlobal.value = fecha;

    const filtroDashboard = document.getElementById('filtroFechaDashboard');
    if (filtroDashboard && filtroDashboard.value !== fecha) filtroDashboard.value = fecha;

    const modoActual = state.vistaRutasModo || sessionStorage.getItem('rutasModoVista') || 'viajes';
    if (typeof cargarViajesRutasDelDia === 'function') {
        cargarViajesRutasDelDia(fecha);
    }
    if (typeof conmutarVistaRutas === 'function') {
        conmutarVistaRutas(modoActual);
    } else {
        cargarRutasHoy(fecha);
    }
}
window.onCambiarFechaGlobalRutas = onCambiarFechaGlobalRutas;

function toggleFormDiferirLitros(checked) {
    const box = document.getElementById('boxInputDiferirLitrosForm');
    const input = document.getElementById('inputLitrosDiferirForm');
    if (box) box.style.display = checked ? 'block' : 'none';
    if (checked && input) {
        setTimeout(() => input.focus(), 50);
    }
}
window.toggleFormDiferirLitros = toggleFormDiferirLitros;

async function guardarRuta(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const btnGuardar = document.getElementById('btnGuardarRuta') || document.getElementById('btnRegistrarRuta');
    const originalHtml = btnGuardar ? btnGuardar.innerHTML : '';
    if (btnGuardar) {
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btnGuardar.disabled = true;
    }

    const fecha = document.getElementById('inputRutaFecha')?.value || document.getElementById('inputFecha')?.value || document.getElementById('inputFechaRuta')?.value || new Date().toISOString().split('T')[0];
    const fincaId = parseInt(document.getElementById('selectFinca')?.value);
    const litros = parseInt(document.getElementById('inputLitros')?.value || document.getElementById('inputLitrosRuta')?.value);
    const fincaObj = (state.fincas || []).find(f => Number(f.id || f.Id) === Number(fincaId));
    const esFincaDual = fincaObj ? Boolean(fincaObj.tieneDosTiposLeche || fincaObj.TieneDosTiposLeche) : false;
    const tipoLeche = esFincaDual ? (document.getElementById('selectRutaTipoLeche')?.value || 'VACA') : 'VACA';
    const esAcida = document.getElementById('checkRutaEsAcida')?.checked || false;
    let observacion = (document.getElementById('inputObservacion')?.value || document.getElementById('inputObservacionRuta')?.value || '').replace(/\[BUFALA\]/gi, '').replace(/\[VACA\]/gi, '').trim();

    let conductorId = null;
    if (state.user && state.user.rol === 'ADMIN') {
        conductorId = parseInt(document.getElementById('selectRutaConductor')?.value || document.getElementById('selectConductor')?.value) || null;
    } else {
        conductorId = state.user?.id || null;
    }

    // Asegurar que el ticket activo se mantenga
    const currentTicket = state.ticketAsignadoActivo || state.filtroTicketId;
    if (!currentTicket) {
        Swal.fire({
            icon: 'warning',
            title: 'Viaje / Ticket Requerido',
            text: 'Debes iniciar o tener un viaje abierto antes de registrar recolecciones de fincas.',
            confirmButtonText: 'Iniciar Nuevo Viaje',
            confirmButtonColor: '#10b981',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
        }).then(result => {
            if (result.isConfirmed) {
                abrirModalIniciarViaje();
            }
        });
        if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
        return;
    }

    state.ticketAsignadoActivo = currentTicket;
    state.filtroTicketId = currentTicket;

    if (!fincaId || fincaId <= 0) {
        Swal.fire({ icon: 'warning', title: 'Finca requerida', text: 'Por favor selecciona una finca.', background: '#1e293b', color: '#fff' });
        if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
        return;
    }

    if (isNaN(litros) || litros === 0) {
        Swal.fire({ icon: 'warning', title: 'Litros inválidos', text: 'Por favor ingresa una cantidad válida de litros distinta de 0.', background: '#1e293b', color: '#fff' });
        if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
        return;
    }

    const checkDiferirEl = document.getElementById('checkDiferirLitrosForm');
    const inputLitrosDiferirEl = document.getElementById('inputLitrosDiferirForm');
    const diferirActivo = Boolean(checkDiferirEl && checkDiferirEl.checked);
    const litrosDiferir = diferirActivo ? parseInt(inputLitrosDiferirEl?.value || 0) : 0;

    if (diferirActivo) {
        if (isNaN(litrosDiferir) || litrosDiferir <= 0) {
            Swal.fire({ icon: 'warning', title: 'Litros a diferir requeridos', text: 'Por favor indica cuántos litros deseas diferir a la siguiente semana.', background: '#1e293b', color: '#fff' });
            if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
            return;
        }
        if (litrosDiferir >= litros) {
            Swal.fire({ icon: 'warning', title: 'Litros inválidos', text: `Los litros a diferir (${litrosDiferir} L) deben ser menores al total recolectado (${litros} L).`, background: '#1e293b', color: '#fff' });
            if (btnGuardar) { btnGuardar.innerHTML = originalHtml; btnGuardar.disabled = false; }
            return;
        }
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
            const dataRes = await res.json().catch(() => ({}));
            const nuevoId = dataRes.id;
            if (diferirActivo && nuevoId && litrosDiferir > 0) {
                try {
                    await fetch(`${API_BASE}/rutas/${nuevoId}/diferir-litros`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: JSON.stringify({
                            litrosDiferir: litrosDiferir,
                            motivo: 'Diferido al registrar recolección'
                        })
                    });
                } catch (errDif) {
                    console.error('Error al diferir litros:', errDif);
                }
            }

            const fincaObj = (state.fincas || []).find(f => Number(f.id || f.Id) === Number(fincaId));
            const fincaNombre = fincaObj ? (fincaObj.nombre || fincaObj.Nombre) : 'Finca';
            const msgDiferido = (diferirActivo && litrosDiferir > 0) 
                ? ` (${(litros - litrosDiferir).toLocaleString()} L cierre + ${litrosDiferir.toLocaleString()} L diferidos)` 
                : '';
            showToast(`Recolección registrada: ${litros.toLocaleString('es-VE')} Lts de ${fincaNombre}${esAcida ? ' (ÁCIDA)' : ''}${msgDiferido}`);

            // Flujo continuo rápido
            const inputLitrosEl = document.getElementById('inputLitros') || document.getElementById('inputLitrosRuta');
            if (inputLitrosEl) inputLitrosEl.value = '';
            const checkAcidaEl = document.getElementById('checkRutaEsAcida');
            if (checkAcidaEl) checkAcidaEl.checked = false;
            if (checkDiferirEl) checkDiferirEl.checked = false;
            if (inputLitrosDiferirEl) inputLitrosDiferirEl.value = '';
            toggleFormDiferirLitros(false);
            const selectTipoEl = document.getElementById('selectRutaTipoLeche');
            if (selectTipoEl) selectTipoEl.value = 'VACA';
            const obsEl = document.getElementById('inputObservacion') || document.getElementById('inputObservacionRuta');
            if (obsEl) obsEl.value = '';

            const selectFincaHidden = document.getElementById('selectFinca');
            const searchFincaInput = document.getElementById('searchFincaInput');
            if (selectFincaHidden) selectFincaHidden.value = '';
            if (searchFincaInput) searchFincaInput.value = '';

            if (comboboxFincaInstance && typeof comboboxFincaInstance.reset === 'function') {
                comboboxFincaInstance.reset();
            }

            if (searchFincaInput) {
                setTimeout(() => searchFincaInput.focus(), 50);
            }

            // Preservar el ticket activo firmemente para ingresos continuos
            state.ticketAsignadoActivo = currentTicket;
            state.filtroTicketId = currentTicket;

            await cargarRutasHoy(fecha);

            const bannerActivo = document.getElementById('bannerTicketActivoForm');
            if (bannerActivo && currentTicket) {
                bannerActivo.style.display = 'flex';
                const lblNum = document.getElementById('lblTicketActivoNumero');
                if (lblNum) lblNum.innerText = currentTicket;
            }

            if (typeof cargarViajeActivoChofer === 'function' && state.user && state.user.rol === 'CHOFER') {
                await cargarViajeActivoChofer();
            }
            if (typeof cargarDashboard === 'function') {
                cargarDashboard();
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Error al guardar la ruta.');
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
window.guardarRuta = guardarRuta;
