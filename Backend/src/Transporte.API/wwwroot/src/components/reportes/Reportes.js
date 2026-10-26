// ==========================================================================
// MÓDULO DE REPORTES INTEGRAL (DIARIOS, RECEPTORIAS, FINCAS, BANCOS, CHOFERES)
// ==========================================================================

var datosReporteActual = null;
var tipoReporteActual = 'DIARIOS';
var comboboxReporteTipoInstance = null;
var comboboxReporteFinca1Instance = null;
var comboboxReporteFinca2Instance = null;
var comboboxReporteReceptoriaInstance = null;
var comboboxReporteChoferInstance = null;
var comboboxReporteChoferFincaInstance = null;

function obtenerFechasCicloOperativoActivo() {
    if (state.cicloActivo && state.cicloActivo.fechaInicio && state.cicloActivo.fechaFin) {
        return {
            inicio: state.cicloActivo.fechaInicio.split('T')[0],
            fin: state.cicloActivo.fechaFin.split('T')[0],
            numeroSemana: state.cicloActivo.numeroSemana
        };
    }

    // Cálculo de ciclo operativo: Martes (inicio) a Lunes (fin)
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
    // Días transcurridos desde el último Martes:
    const diffDias = (diaSemana >= 2) ? (diaSemana - 2) : (diaSemana + 5);
    const martes = new Date(hoy);
    martes.setDate(hoy.getDate() - diffDias);
    const lunes = new Date(martes);
    lunes.setDate(martes.getDate() + 6);

    const fFormat = d => d.toISOString().split('T')[0];
    return {
        inicio: fFormat(martes),
        fin: fFormat(lunes),
        numeroSemana: null
    };
}
window.obtenerFechasCicloOperativoActivo = obtenerFechasCicloOperativoActivo;

function onCambiarFechaReporteManual() {
    const inputDesde = document.getElementById('reporteFechaDesde');
    const inputHasta = document.getElementById('reporteFechaHasta');
    const badgeSemana = document.getElementById('badgeSemanaReporteActual');

    const dIni = inputDesde?.value;
    const dFin = inputHasta?.value;

    if (badgeSemana && dIni && dFin) {
        badgeSemana.innerText = `Rango: (${dIni} al ${dFin})`;
    }

    ejecutarBusquedaReporte();
}
window.onCambiarFechaReporteManual = onCambiarFechaReporteManual;

function initReportesComboboxes() {
    if (!comboboxReporteTipoInstance && document.getElementById('comboboxReporteTipo')) {
        comboboxReporteTipoInstance = setupCombobox({
            containerId: 'comboboxReporteTipo',
            inputSearchId: 'searchReporteTipoInput',
            inputHiddenId: 'reporteTipoSelect',
            dropdownId: 'dropdownReporteTipoList',
            placeholder: 'Buscar tipo de reporte...',
            getItemsFn: () => {
                const rol = (state.user?.rol || '').toUpperCase();
                const esAdmin = rol.includes('ADMIN') || rol === 'ADMINISTRADOR GENERAL';
                const soloPropios = !esAdmin && (rol === 'CHOFER' || tienePermiso('REPORTES_SOLO_PROPIOS') || tienePermiso('DASHBOARD_SOLO_PROPIOS'));

                if (soloPropios) {
                    const itemsChofer = [];
                    if (esAdmin || tienePermiso('REPORTES_RELACION_CHOFER') || tienePermiso('REPORTES_VER')) {
                        itemsChofer.push({ value: 'RELACION_CHOFER', label: 'RELACION CHOFER (MIS VIAJES Y ENTREGAS)' });
                    }
                    if (esAdmin || tienePermiso('REPORTES_CHOFERES')) {
                        itemsChofer.push({ value: 'CHOFERES', label: 'BALANCE DE CHOFER (MI SOBRANTE / FALTANTE)' });
                    }
                    return itemsChofer.length > 0 ? itemsChofer : [{ value: 'RELACION_CHOFER', label: 'RELACION CHOFER (MIS VIAJES Y ENTREGAS)' }];
                }

                const catalogoReportes = [
                    { value: 'SELECCIONE', label: 'SELECCIONE' },
                    { value: 'DIARIOS', label: 'DIARIOS', perm: 'REPORTES_DIARIOS' },
                    { value: 'RECEPTORIAS', label: 'RECEPTORIAS', perm: 'REPORTES_RECEPTORIAS' },
                    { value: 'FINCAS', label: 'FINCAS', perm: 'REPORTES_FINCAS' },
                    { value: 'CHOFERES', label: 'CHOFERES', perm: 'REPORTES_CHOFERES' },
                    { value: 'BANCOS', label: 'BANCOS', perm: 'REPORTES_BANCOS' },
                    { value: 'RELACION_PAGOS', label: 'RELACION DE PAGOS A FINCAS', perm: 'REPORTES_PAGOS_FINCAS' },
                    { value: 'RELACION_PAGOS_COMPANIAS', label: 'RELACION DE PAGOS DE COMPAÑIAS', perm: 'REPORTES_PAGOS_COMPANIAS' },
                    { value: 'RELACION_CHOFER', label: 'RELACION CHOFER', perm: 'REPORTES_RELACION_CHOFER' }
                ];

                if (esAdmin) return catalogoReportes;

                return catalogoReportes.filter(r => r.value === 'SELECCIONE' || !r.perm || tienePermiso(r.perm) || tienePermiso('REPORTES_VER'));
            },
            onSelect: (val, label) => {
                onCambiarTipoReporte(true);
            }
        });
    }

    if (!comboboxReporteFinca1Instance && document.getElementById('comboboxReporteFinca1')) {
        comboboxReporteFinca1Instance = setupCombobox({
            containerId: 'comboboxReporteFinca1',
            inputSearchId: 'searchReporteFinca1Input',
            inputHiddenId: 'reporteSubSelectFinca1',
            dropdownId: 'dropdownReporteFinca1List',
            placeholder: 'Escriba para buscar Finca 1...',
            getItemsFn: () => {
                const fincasActivas = (state.fincas || []).filter(f => f.activo !== false && f.Activo !== false);
                const fincasOrdenadas = [...fincasActivas].sort((a, b) => (a.nombre || a.Nombre || '').localeCompare(b.nombre || b.Nombre || ''));
                return fincasOrdenadas.map(f => {
                    const id = f.id || f.Id;
                    const nom = f.nombre || f.Nombre;
                    const prop = f.propietario || f.Propietario;
                    const esDual = !!(f.tieneDosTiposLeche || f.TieneDosTiposLeche);
                    return {
                        value: id,
                        label: prop ? `${nom} (${prop})` : nom,
                        sub: esDual ? `Dual: Vaca y Búfala | Propietario: ${prop || '-'}` : (prop ? `Propietario: ${prop}` : '')
                    };
                });
            },
            onSelect: (item) => {
                const f1Obj = (state.fincas || []).find(f => (f.id || f.Id) == item?.value);
                const esDual = !!(f1Obj?.tieneDosTiposLeche || f1Obj?.TieneDosTiposLeche);
                if (esDual && comboboxReporteFinca2Instance) {
                    comboboxReporteFinca2Instance.clear();
                }
                ejecutarBusquedaReporte();
            }
        });

        const searchInput1 = document.getElementById('searchReporteFinca1Input');
        if (searchInput1) {
            searchInput1.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    const hidden = document.getElementById('reporteSubSelectFinca1');
                    if (hidden && hidden.value) {
                        hidden.value = '';
                        ejecutarBusquedaReporte();
                    }
                }
            });
        }
    }

    if (!comboboxReporteFinca2Instance && document.getElementById('comboboxReporteFinca2')) {
        comboboxReporteFinca2Instance = setupCombobox({
            containerId: 'comboboxReporteFinca2',
            inputSearchId: 'searchReporteFinca2Input',
            inputHiddenId: 'reporteSubSelectFinca2',
            dropdownId: 'dropdownReporteFinca2List',
            placeholder: 'Escriba para buscar Finca 2 (Opcional)...',
            getItemsFn: () => {
                const fincasActivas = (state.fincas || []).filter(f => f.activo !== false && f.Activo !== false);
                const fincasOrdenadas = [...fincasActivas].sort((a, b) => (a.nombre || a.Nombre || '').localeCompare(b.nombre || b.Nombre || ''));
                return fincasOrdenadas.map(f => {
                    const id = f.id || f.Id;
                    const nom = f.nombre || f.Nombre;
                    const prop = f.propietario || f.Propietario;
                    return {
                        value: id,
                        label: prop ? `${nom} (${prop})` : nom,
                        sub: prop ? `Propietario: ${prop}` : ''
                    };
                });
            },
            onSelect: (item) => {
                ejecutarBusquedaReporte();
            }
        });

        const searchInput2 = document.getElementById('searchReporteFinca2Input');
        if (searchInput2) {
            searchInput2.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    const hidden = document.getElementById('reporteSubSelectFinca2');
                    if (hidden && hidden.value) {
                        hidden.value = '';
                        ejecutarBusquedaReporte();
                    }
                }
            });
        }
    }

    if (!comboboxReporteReceptoriaInstance && document.getElementById('comboboxReporteReceptoria')) {
        comboboxReporteReceptoriaInstance = setupCombobox({
            containerId: 'comboboxReporteReceptoria',
            inputSearchId: 'searchReporteReceptoriaInput',
            inputHiddenId: 'reporteSubSelectReceptoria',
            dropdownId: 'dropdownReporteReceptoriaList',
            placeholder: 'Escriba para buscar Receptoría / Planta...',
            getItemsFn: () => (state.companias || []).map(c => {
                const id = c.id || c.Id;
                const nom = c.nombre || c.Nombre;
                const enc = c.encargado || c.Encargado;
                return {
                    value: id,
                    label: nom,
                    sub: enc ? `Encargado: ${enc}` : ''
                };
            }),
            onSelect: () => {
                ejecutarBusquedaReporte();
            }
        });

        const searchInputRec = document.getElementById('searchReporteReceptoriaInput');
        if (searchInputRec) {
            searchInputRec.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    const hidden = document.getElementById('reporteSubSelectReceptoria');
                    if (hidden && hidden.value) {
                        hidden.value = '';
                        ejecutarBusquedaReporte();
                    }
                }
            });
        }
    }

    if (!comboboxReporteChoferInstance && document.getElementById('comboboxReporteChofer')) {
        comboboxReporteChoferInstance = setupCombobox({
            containerId: 'comboboxReporteChofer',
            inputSearchId: 'searchReporteChoferInput',
            inputHiddenId: 'reporteSubSelectChofer',
            dropdownId: 'dropdownReporteChoferList',
            placeholder: 'Todos los choferes o escriba para buscar...',
            getItemsFn: () => [
                { value: '', label: 'TODOS LOS CONDUCTORES', sub: 'Mostrar todos los choferes' },
                ...(state.choferes || []).map(c => {
                    const id = c.id || c.Id;
                    const nom = c.nombreCompleto || c.NombreCompleto || c.username || c.Username;
                    const ced = c.cedula || c.Cedula;
                    return {
                        value: id,
                        label: nom,
                        sub: ced ? `C.I: ${ced}` : ''
                    };
                })
            ],
            onSelect: () => {
                ejecutarBusquedaReporte();
            }
        });

        const searchInputCh = document.getElementById('searchReporteChoferInput');
        if (searchInputCh) {
            searchInputCh.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    const hidden = document.getElementById('reporteSubSelectChofer');
                    if (hidden && hidden.value) {
                        hidden.value = '';
                        ejecutarBusquedaReporte();
                    }
                }
            });
        }
    }

    if (!comboboxReporteChoferFincaInstance && document.getElementById('comboboxReporteChoferFinca')) {
        comboboxReporteChoferFincaInstance = setupCombobox({
            containerId: 'comboboxReporteChoferFinca',
            inputSearchId: 'searchReporteChoferFincaInput',
            inputHiddenId: 'reporteSubSelectChoferFinca',
            dropdownId: 'dropdownReporteChoferFincaList',
            placeholder: 'Todas las fincas o escriba para buscar...',
            getItemsFn: () => {
                const fincasActivas = (state.fincas || []).filter(f => f.activo !== false && f.Activo !== false);
                const fincasOrdenadas = [...fincasActivas].sort((a, b) => (a.nombre || a.Nombre || '').localeCompare(b.nombre || b.Nombre || ''));
                return [
                    { value: '', label: 'TODAS LAS FINCAS', sub: 'Mostrar recolecciones de todas las fincas' },
                    ...fincasOrdenadas.map(f => {
                        const id = f.id || f.Id;
                        const nom = f.nombre || f.Nombre;
                        const prop = f.propietario || f.Propietario;
                        return {
                            value: id,
                            label: prop ? `${nom} (${prop})` : nom,
                            sub: prop ? `Propietario: ${prop}` : ''
                        };
                    })
                ];
            },
            onSelect: () => {
                ejecutarBusquedaReporte();
            }
        });

        const searchInputChFinca = document.getElementById('searchReporteChoferFincaInput');
        if (searchInputChFinca) {
            searchInputChFinca.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    const hidden = document.getElementById('reporteSubSelectChoferFinca');
                    if (hidden && hidden.value) {
                        hidden.value = '';
                        ejecutarBusquedaReporte();
                    }
                }
            });
        }
    }
}
window.initReportesComboboxes = initReportesComboboxes;

function configurarReportesParaRol(rol) {
    if (comboboxReporteTipoInstance) {
        if (rol === 'CHOFER') {
            comboboxReporteTipoInstance.selectItem('RELACION_CHOFER', 'RELACION CHOFER (MIS VIAJES Y ENTREGAS)');
        } else {
            const currentVal = document.getElementById('reporteTipoSelect')?.value;
            if (!currentVal || currentVal === 'SELECCIONE') {
                comboboxReporteTipoInstance.selectItem('DIARIOS', 'DIARIOS');
            }
        }
    }
}
window.configurarReportesParaRol = configurarReportesParaRol;

function poblarSubFiltrosReportes() {
    initReportesComboboxes();

    // Si el usuario es CHOFER, fijar estrictamente su usuario y bloquear el buscador
    if (state.user && state.user.rol === 'CHOFER') {
        const chInputHidden = document.getElementById('reporteSubSelectChofer');
        if (chInputHidden) chInputHidden.value = state.user.id;
        const miNombre = state.user.nombreCompleto || state.user.username;
        if (comboboxReporteChoferInstance) {
            comboboxReporteChoferInstance.selectItem(state.user.id, miNombre);
        }
        const searchInputChofer = document.getElementById('searchReporteChoferInput');
        if (searchInputChofer) {
            searchInputChofer.value = miNombre;
            searchInputChofer.disabled = true;
            searchInputChofer.style.backgroundColor = '#f1f5f9';
            searchInputChofer.style.cursor = 'not-allowed';
        }
    }

    const selectBanco = document.getElementById('reporteSubSelectBanco');
    if (selectBanco) {
        const valActual = selectBanco.value;
        let opts = '<option value="">TODOS LOS BANCOS</option>';
        const bancosSet = new Set();
        (state.fincas || []).forEach(f => {
            const b = f.bancoNombre || f.BancoNombre;
            const bId = f.bancoId || f.BancoId;
            if (b && bId && !bancosSet.has(bId)) {
                bancosSet.add(bId);
                opts += `<option value="${bId}">${b}</option>`;
            }
        });
        selectBanco.innerHTML = opts;
        if (valActual && selectBanco.querySelector(`option[value="${valActual}"]`)) {
            selectBanco.value = valActual;
        }
    }
}
window.poblarSubFiltrosReportes = poblarSubFiltrosReportes;

async function inicializarModuloReportes() {
    const inputDesde = document.getElementById('reporteFechaDesde');
    const inputHasta = document.getElementById('reporteFechaHasta');
    const badgeSemana = document.getElementById('badgeSemanaReporteActual');

    // 1. Cargar catálogos y ciclo activo en paralelo si es necesario
    const promises = [];
    if (!state.cicloActivo) {
        promises.push(
            fetch(`${API_BASE}/ciclos/activo`, { headers: { 'Authorization': `Bearer ${state.token}` } })
                .then(r => r.ok ? r.json() : null)
                .then(c => { if (c) state.cicloActivo = c; })
                .catch(err => console.warn('Error cargando ciclo activo:', err))
        );
    }
    if (!state.fincas || state.fincas.length === 0 || !state.companias || state.companias.length === 0) {
        promises.push(cargarCatalogos());
    }
    if (promises.length > 0) {
        await Promise.all(promises);
    }

    // 2. Establecer fechas por defecto: Martes (Inicio de ciclo) a Lunes (Fin de ciclo)
    const rangoCiclo = obtenerFechasCicloOperativoActivo();
    if (inputDesde) inputDesde.value = rangoCiclo.inicio;
    if (inputHasta) inputHasta.value = rangoCiclo.fin;
    if (badgeSemana) {
        badgeSemana.innerText = rangoCiclo.numeroSemana 
            ? `Semana ${rangoCiclo.numeroSemana}: (${rangoCiclo.inicio} al ${rangoCiclo.fin})`
            : `Semana Operativa: (${rangoCiclo.inicio} al ${rangoCiclo.fin})`;
    }

    // 3. Inicializar comboboxes y subfiltros
    poblarSubFiltrosReportes();
    configurarReportesParaRol(state.user?.rol);

    const inputTasa = document.getElementById('reporteInputTasaBcvManual');
    if (inputTasa && (!inputTasa.value || inputTasa.value === '0')) {
        inputTasa.value = state.tasaBcv || '791.3248';
    }

    onCambiarTipoReporte(true);
}
window.inicializarModuloReportes = inicializarModuloReportes;

function onCambiarTipoReporte(autoEjecutar = true) {
    const tipo = document.getElementById('reporteTipoSelect')?.value || (state.user?.rol === 'CHOFER' ? 'RELACION_CHOFER' : 'DIARIOS');
    tipoReporteActual = tipo;

    const contenedorSub = document.getElementById('contenedorSubFiltrosReporte');
    const subReceptoria = document.getElementById('subFiltroReceptoria');
    const subFincas = document.getElementById('subFiltroFincas');
    const subChofer = document.getElementById('subFiltroChofer');
    const subBancos = document.getElementById('subFiltroBancos');
    const container = document.getElementById('contenedorResultadoReporte');

    datosReporteActual = null;

    if (!contenedorSub) return;

    poblarSubFiltrosReportes();

    // Mostrar u ocultar sub-filtros según el tipo seleccionado
    if (tipo === 'DIARIOS' || tipo === 'SELECCIONE') {
        contenedorSub.style.display = 'none';
        if (subReceptoria) subReceptoria.style.display = 'none';
        if (subFincas) subFincas.style.display = 'none';
        if (subChofer) subChofer.style.display = 'none';
        if (subBancos) subBancos.style.display = 'none';
    } else {
        contenedorSub.style.display = 'block';
        if (subReceptoria) subReceptoria.style.display = (tipo === 'RECEPTORIAS' || tipo === 'RELACION_PAGOS_COMPANIAS') ? 'grid' : 'none';
        const contenedorTipoServicio = document.getElementById('contenedorFiltroTipoServicioReporte');
        if (contenedorTipoServicio) {
            contenedorTipoServicio.style.display = (tipo === 'RELACION_PAGOS_COMPANIAS') ? 'block' : 'none';
        }
        if (subFincas) subFincas.style.display = (tipo === 'FINCAS') ? 'grid' : 'none';
        if (subChofer) subChofer.style.display = (tipo === 'CHOFERES' || tipo === 'RELACION_CHOFER') ? 'grid' : 'none';
        if (subBancos) subBancos.style.display = (tipo === 'BANCOS' || tipo === 'RELACION_PAGOS') ? 'flex' : 'none';
    }

    // Comprobar si se debe guiar al usuario a seleccionar del buscador
    if (tipo === 'FINCAS') {
        const f1 = document.getElementById('reporteSubSelectFinca1')?.value || '';
        const f2 = document.getElementById('reporteSubSelectFinca2')?.value || '';
        if (!f1 && !f2) {
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1; box-shadow: var(--shadow-sm);">
                        <i class="fa-solid fa-cow" style="font-size: 40px; margin-bottom: 12px; color: #4f46e5; display: block;"></i>
                        <h3 style="font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 6px;">Escriba y Filtre una Finca</h3>
                        <p style="color: #64748b; font-size: 13px; margin: 0;">Escriba en el campo <strong>Finca 1</strong> (y opcionalmente <strong>Finca 2</strong> para comparar) para buscar y filtrar la finca que desea consultar.</p>
                    </div>
                `;
            }
            return;
        }
    } else if (tipo === 'RECEPTORIAS') {
        const compId = document.getElementById('reporteSubSelectReceptoria')?.value || '';
        if (!compId) {
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1; box-shadow: var(--shadow-sm);">
                        <i class="fa-solid fa-truck" style="font-size: 40px; margin-bottom: 12px; color: #059669; display: block;"></i>
                        <h3 style="font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 6px;">Escriba y Filtre una Receptor&iacute;a / Planta</h3>
                        <p style="color: #64748b; font-size: 13px; margin: 0;">Escriba en el campo <strong>Receptor&iacute;a o Planta</strong> para buscar y consultar sus entregas.</p>
                    </div>
                `;
            }
            return;
        }
    }

    if (autoEjecutar && tipo !== 'SELECCIONE') {
        ejecutarBusquedaReporte();
    }
}
window.onCambiarTipoReporte = onCambiarTipoReporte;

async function ejecutarBusquedaReporte() {
    const inputDesde = document.getElementById('reporteFechaDesde');
    const inputHasta = document.getElementById('reporteFechaHasta');
    const selectTipo = document.getElementById('reporteTipoSelect');
    const container = document.getElementById('contenedorResultadoReporte');

    if (!container) return;

    const fechaDesde = inputDesde?.value || datosReporteActual?.fechaDesde || (state.cicloActivo ? formatearFechaLocal(state.cicloActivo.fechaInicio) : '');
    const fechaHasta = inputHasta?.value || datosReporteActual?.fechaHasta || (state.cicloActivo ? formatearFechaLocal(state.cicloActivo.fechaFin) : '');
    const tipo = selectTipo?.value || datosReporteActual?.tipo || 'DIARIOS';
    tipoReporteActual = tipo;

    if (!fechaDesde || !fechaHasta) {
        showToast('Seleccione fecha Desde y Hasta para generar el reporte.', 'warning');
        return;
    }

    // VALIDACIÓN ESTRICTA: Fincas y Receptorías se consultan EXCLUSIVAMENTE por selección en el campo de búsqueda/filtro
    if (tipo === 'FINCAS') {
        const f1 = document.getElementById('reporteSubSelectFinca1')?.value || '';
        const f2 = document.getElementById('reporteSubSelectFinca2')?.value || '';
        if (!f1 && !f2) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1; box-shadow: var(--shadow-sm);">
                    <i class="fa-solid fa-cow" style="font-size: 40px; margin-bottom: 12px; color: #4f46e5; display: block;"></i>
                    <h3 style="font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 6px;">Escriba y Filtre una Finca</h3>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">Escriba en el campo <strong>Finca 1</strong> (y opcionalmente <strong>Finca 2</strong> para comparar) para buscar y filtrar la finca que desea consultar.</p>
                </div>
            `;
            return;
        }
    } else if (tipo === 'RECEPTORIAS') {
        const compId = document.getElementById('reporteSubSelectReceptoria')?.value || '';
        if (!compId) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1; box-shadow: var(--shadow-sm);">
                    <i class="fa-solid fa-truck" style="font-size: 40px; margin-bottom: 12px; color: #059669; display: block;"></i>
                    <h3 style="font-size: 16px; color: #0f172a; font-weight: 700; margin-bottom: 6px;">Escriba y Filtre una Receptor&iacute;a / Planta</h3>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">Escriba en el campo <strong>Receptor&iacute;a o Planta</strong> para buscar y consultar sus entregas.</p>
                </div>
            `;
            return;
        }
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #4f46e5;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
            Generando Reporte <strong>${tipo}</strong> (${fechaDesde} al ${fechaHasta})...
        </div>
    `;

    try {
        const token = state.token;
        const headers = { 'Authorization': `Bearer ${token}` };

        if (tipo === 'DIARIOS') {
            const resp = await fetch(`${API_BASE}/reportes/diarios?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}`, { headers });
            if (!resp.ok) throw new Error('Error al consultar reporte de diarios.');
            const data = await resp.json();
            datosReporteActual = { tipo: 'DIARIOS', data, fechaDesde, fechaHasta };
            renderReporteDiarios(data, fechaDesde, fechaHasta);
        } 
        else if (tipo === 'RECEPTORIAS') {
            const compId = document.getElementById('reporteSubSelectReceptoria')?.value || '';
            const url = `${API_BASE}/reportes/receptorias?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}&companiaId=${compId}`;
            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error('Error al consultar reporte de receptorías.');
            const data = await resp.json();
            datosReporteActual = { tipo: 'RECEPTORIAS', data, fechaDesde, fechaHasta };
            renderReporteReceptorias(data, fechaDesde, fechaHasta);
        }
        else if (tipo === 'FINCAS') {
            const f1 = document.getElementById('reporteSubSelectFinca1')?.value || '';
            const f2 = document.getElementById('reporteSubSelectFinca2')?.value || '';
            const ids = [f1, f2].filter(Boolean);
            const idsParam = `&fincaIds=${ids.join(',')}`;

            const url = `${API_BASE}/reportes/fincas?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}${idsParam}`;
            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error('Error al consultar reporte de fincas.');
            let data = await resp.json();

            // Garantizar ordenamiento estricto: Finca 1 siempre en posición 0 (izquierda), Finca 2 en posición 1 (derecha)
            if (Array.isArray(data) && ids.length > 0) {
                const mapPos = {};
                ids.forEach((idVal, index) => { mapPos[String(idVal)] = index; });
                data.sort((a, b) => {
                    const posA = mapPos[String(a.id ?? a.Id)] ?? 999;
                    const posB = mapPos[String(b.id ?? b.Id)] ?? 999;
                    return posA - posB;
                });
            }

            datosReporteActual = { tipo: 'FINCAS', data, fechaDesde, fechaHasta };
            renderReporteFincas(data, fechaDesde, fechaHasta);
        }
        else if (tipo === 'CHOFERES') {
            const chId = (state.user && state.user.rol === 'CHOFER') ? state.user.id : (document.getElementById('reporteSubSelectChofer')?.value || '');
            const fId = document.getElementById('reporteSubSelectChoferFinca')?.value || '';
            const url = `${API_BASE}/reportes/choferes?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}&choferId=${chId}`;
            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error('Error al consultar reporte de choferes.');
            let data = await resp.json();
            if (chId) {
                data = (data || []).filter(c => (c.id || c.Id || c.usuarioId) == chId || (c.nombre || '').toLowerCase().includes(chId.toString().toLowerCase()));
            }
            datosReporteActual = { tipo: 'CHOFERES', data, fechaDesde, fechaHasta };
            renderReporteChoferes(data, fechaDesde, fechaHasta);
        }
        else if (tipo === 'RELACION_CHOFER') {
            const chId = (state.user && state.user.rol === 'CHOFER') ? state.user.id : (document.getElementById('reporteSubSelectChofer')?.value || '');
            const fId = document.getElementById('reporteSubSelectChoferFinca')?.value || '';
            const url = `${API_BASE}/reportes/relacion-choferes?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}`;
            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error('Error al consultar relación de choferes.');
            let data = await resp.json();
            if (state.user && state.user.rol === 'CHOFER') {
                const miNom = (state.user.nombreCompleto || state.user.username || '').toLowerCase();
                data = (data || []).filter(r => (r.usuarioId && r.usuarioId == state.user.id) || (r.chofer && r.chofer.toLowerCase().includes(miNom)));
            }
            if (chId) {
                data = (data || []).filter(r => (r.usuarioId && r.usuarioId == chId));
            }
            if (fId) {
                data = (data || []).map(r => {
                    const filteredFincas = (r.detalleFincas || r.DetalleFincas || []).filter(f => (f.fincaId || f.FincaId) == fId);
                    if (filteredFincas.length === 0) return null;
                    const rCopy = { ...r };
                    rCopy.detalleFincas = filteredFincas;
                    rCopy.DetalleFincas = filteredFincas;
                    return rCopy;
                }).filter(Boolean);
            }
            datosReporteActual = { tipo: 'RELACION_CHOFER', data, fechaDesde, fechaHasta };
            renderReporteRelacionChoferes(data, fechaDesde, fechaHasta);
        }
        else if (tipo === 'BANCOS' || tipo === 'RELACION_PAGOS') {
            const bId = document.getElementById('reporteSubSelectBanco')?.value || '';
            const tasaMan = document.getElementById('reporteInputTasaBcvManual')?.value || '';
            const cicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : '';
            
            let url = `${API_BASE}/reportes/bancos?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}`;
            if (bId) url += `&bancoId=${bId}`;
            if (cicloId) url += `&cicloId=${cicloId}`;
            if (tasaMan) url += `&tasaBcv=${tasaMan}`;

            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error('Error al consultar reporte por bancos.');
            const data = await resp.json();
            datosReporteActual = { tipo: 'BANCOS', data, fechaDesde, fechaHasta, tasaBcv: tasaMan || state.tasaBcv };
            renderReporteBancos(data, fechaDesde, fechaHasta);
        }
        else if (tipo === 'RELACION_PAGOS_COMPANIAS') {
            const compId = document.getElementById('reporteSubSelectReceptoria')?.value || '';
            const tasaMan = document.getElementById('reporteInputTasaBcvManual')?.value || '';
            const cicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : '';
            
            let url = `${API_BASE}/reportes/relacion-companias?fechaInicio=${fechaDesde}&fechaFin=${fechaHasta}`;
            if (compId) url += `&companiaId=${compId}`;
            if (cicloId) url += `&cicloId=${cicloId}`;
            if (tasaMan) url += `&tasaBcv=${tasaMan}`;

            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error('Error al consultar reporte de relación de compañías.');
            const data = await resp.json();
            datosReporteActual = { tipo: 'RELACION_PAGOS_COMPANIAS', data, fechaDesde, fechaHasta, tasaBcv: tasaMan || state.tasaBcv };
            renderReporteRelacionCompanias(data, fechaDesde, fechaHasta);
        }
        else {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94a3b8;">
                    Seleccione un tipo de reporte válido.
                </div>
            `;
        }
    } catch (err) {
        console.error('Error al generar reporte:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #ef4444;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                Error al generar reporte: ${err.message}
            </div>
        `;
    }
}
window.ejecutarBusquedaReporte = ejecutarBusquedaReporte;

// --------------------------------------------------------------------------
// RENDERIZADORES ESPECÍFICOS DE REPORTES (DISEÑO EXACTO IMAGEN 2)
// --------------------------------------------------------------------------

var formatearFechaLocal = window.formatearFechaLocal;
var formatearNumero = window.formatearNumero;

function renderReporteDiarios(data, fechaDesde, fechaHasta) {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    function renderTablaCard(titulo, items, total) {
        let rowsHtml = '';
        if (!items || items.length === 0) {
            rowsHtml = `<tr><td colspan="2" style="text-align: center; color: #94a3b8; padding: 14px; font-weight: 500;">Sin registros en este período</td></tr>`;
        } else {
            items.forEach((it, idx) => {
                const altClass = idx % 2 === 1 ? 'class="excel-td-alt"' : '';
                rowsHtml += `
                    <tr ${altClass}>
                        <td style="font-weight: 600; color: #334155;">${formatearFechaLocal(it.fecha)}</td>
                        <td style="font-weight: 800; color: #0f172a;">${formatearNumero(it.litros)}</td>
                    </tr>
                `;
            });
        }

        return `
            <div class="report-card-demarcada">
                <div class="report-card-title">${titulo}</div>
                <div class="table-responsive" style="margin: 0; border: none; flex-grow: 1;">
                    <table class="table-reporte-demarcada">
                        <thead>
                            <tr>
                                <th style="width: 50%;">FECHA</th>
                                <th style="width: 50%;">LITROS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>TOTAL</td>
                                <td style="font-size: 14px;">${formatearNumero(total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div style="margin-top: 14px;">
                    <button type="button" class="btn-exportar-card" onclick="exportarSeccionExcel('${titulo}')" title="Exportar ${titulo} a Excel">
                        <i class="fa-solid fa-file-excel"></i> Exportar
                    </button>
                </div>
            </div>
        `;
    }

    const cardRutas = renderTablaCard('DIARIO RUTAS', data.diarioRutas || [], data.totalDiarioRutas || 0);
    const cardReceptorias = renderTablaCard('DIARIO RECEPTORIAS', data.diarioReceptorias || [], data.totalDiarioReceptorias || 0);
    const cardTranspRutas = renderTablaCard('DIARIO TRANSPORTE RUTAS', data.diarioTransporteRutas || [], data.totalDiarioTransporteRutas || 0);
    const cardTranspRecep = renderTablaCard('DIARIO TRANSPORTE RECEPTORIAS', data.diarioTransporteReceptorias || [], data.totalDiarioTransporteReceptorias || 0);

    container.innerHTML = `
        <div class="report-grid-cards">
            ${cardRutas}
            ${cardReceptorias}
            ${cardTranspRutas}
            ${cardTranspRecep}
        </div>
    `;
}

function renderReporteReceptorias(data, fechaDesde, fechaHasta) {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-inbox" style="font-size: 32px; margin-bottom: 10px; display: block; color: #94a3b8;"></i>
                No se encontraron registros de entregas para la receptoría en el rango seleccionado (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}).
            </div>
        `;
        return;
    }

    let cardsHtml = '';
    data.forEach(item => {
        let totalLitrosBuena = 0;
        let totalLitrosAcida = 0;
        let rowsHtml = '';

        const detalle = item.detalle || [];
        detalle.forEach((d, idx) => {
            const tLeche = (d.tipoLeche || '').toUpperCase();
            const obs = (d.observacion || '').toUpperCase();
            const esBufala = tLeche.includes('BUFAL') || obs.includes('BUFAL');
            const esAcida = Boolean(d.esAcida) || tLeche.includes('ACID') || obs.includes('ACID') || obs.includes('MALA');

            let tipoBadge = '';
            let trStyle = 'border-bottom: 1px solid #e2e8f0;';

            if (esAcida) {
                totalLitrosAcida += d.litros;
                trStyle = 'border-bottom: 1px solid #fecaca; background: #fff1f2;';
                tipoBadge = `<span class="badge" style="background: #fee2e2; color: #dc2626; border: 1px solid #f87171; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> ÁCIDA</span>`;
            } else if (esBufala) {
                totalLitrosBuena += d.litros;
                if (idx % 2 === 1) trStyle = 'border-bottom: 1px solid #e2e8f0; background: #f8fafc;';
                tipoBadge = `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px;"><i class="fa-solid fa-cow"></i> BÚFALA</span>`;
            } else {
                totalLitrosBuena += d.litros;
                if (idx % 2 === 1) trStyle = 'border-bottom: 1px solid #e2e8f0; background: #f8fafc;';
                tipoBadge = `<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px;"><i class="fa-solid fa-mug-saucer"></i> VACA</span>`;
            }

            // Limpieza de observación para no repetir redundancias
            let obsDisplay = d.observacion || '';
            if (d.choferNombre && d.choferNombre !== 'OTROS' && !obsDisplay.includes(d.choferNombre)) {
                obsDisplay = obsDisplay ? `[${d.choferNombre}] ${obsDisplay}` : `Chofer: ${d.choferNombre}`;
            }

            const colorLitros = esAcida ? '#dc2626' : '#0f172a';

            rowsHtml += `
                <tr style="${trStyle}">
                    <td style="font-weight: 700; color: #334155; text-align: center; padding: 9px 10px; font-size: 12.5px;">${formatearFechaLocal(d.fecha)}</td>
                    <td style="text-align: center; padding: 9px 10px;">${tipoBadge}</td>
                    <td style="font-weight: 900; color: ${colorLitros}; text-align: right; padding: 9px 14px; font-family: 'Consolas', monospace; font-size: 14px;">${formatearNumero(d.litros)}</td>
                    <td class="text-left" style="color: ${esAcida ? '#991b1b' : '#475569'}; font-weight: ${esAcida ? '700' : '500'}; padding: 9px 12px; font-size: 12px;">${obsDisplay}</td>
                </tr>
            `;
        });

        const pBuena = item.precioLitroUSD || 0;
        const pAcida = item.precioLitroAcidaUSD || 0;

        const precioFormatted = formatearNumero(pBuena, 4);
        const precioAcidaFormatted = formatearNumero(pAcida, 4);
        const tasaFormatted = formatearNumero(item.tasaBcv || state.tasaBcv || 801.1752, 4);

        const esBufalaCard = (item.nombre || '').toUpperCase().includes('BUFAL') || Boolean(item.tieneBufala);
        let badgeCabecera = '';
        if (esBufalaCard) {
            badgeCabecera = `<span style="background: rgba(255,255,255,0.22); color: #ffffff; font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.45); margin-left: 8px; vertical-align: middle;"><i class="fa-solid fa-cow"></i> BÚFALA</span>`;
        } else {
            badgeCabecera = `<span style="background: rgba(255,255,255,0.22); color: #ffffff; font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.45); margin-left: 8px; vertical-align: middle;"><i class="fa-solid fa-mug-saucer"></i> VACA</span>`;
        }

        const headerGradient = esBufalaCard
            ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)'
            : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)';

        let footerRows = '';
        if (totalLitrosAcida > 0) {
            footerRows = `
                <tr style="background: #f8fafc; font-weight: 800; color: #0f172a; border-top: 2px solid #cbd5e1;">
                    <td colspan="2" style="text-align: left; padding: 8px 12px; font-size: 13px;"><i class="fa-solid fa-circle-check" style="color: #16a34a;"></i> TOTAL BUENA</td>
                    <td style="text-align: right; padding: 8px 14px; font-family: 'Consolas', monospace; font-size: 14px; font-weight: 900; color: #0f172a;">${formatearNumero(totalLitrosBuena)} Lts</td>
                    <td style="text-align: left; padding: 8px 12px; font-weight: 800; color: #475569; font-size: 12.5px;">${pBuena > 0 ? `$ ${precioFormatted}` : ''}</td>
                </tr>
                <tr style="background: #fff1f2; font-weight: 800; color: #991b1b; border-top: 1px solid #fecaca;">
                    <td colspan="2" style="text-align: left; padding: 8px 12px; font-size: 13px;"><i class="fa-solid fa-triangle-exclamation" style="color: #dc2626;"></i> TOTAL MALA / ÁCIDA</td>
                    <td style="text-align: right; padding: 8px 14px; font-family: 'Consolas', monospace; font-size: 14px; font-weight: 900; color: #dc2626;">${formatearNumero(totalLitrosAcida)} Lts</td>
                    <td style="text-align: left; padding: 8px 12px; font-weight: 800; color: #dc2626; font-size: 12.5px;">${pAcida > 0 ? `$ ${precioAcidaFormatted}` : '$ 0.0000'}</td>
                </tr>
                <tr style="background: #f1f5f9; font-weight: 900; color: #0f172a; border-top: 2px solid #cbd5e1;">
                    <td colspan="2" style="text-align: left; padding: 9px 12px; font-size: 13.5px;">TOTAL GENERAL</td>
                    <td style="text-align: right; padding: 9px 14px; font-family: 'Consolas', monospace; font-size: 15px; color: #0284c7; font-weight: 900;">${formatearNumero(item.totalLitros)} Lts</td>
                    <td style="padding: 9px 12px;">&nbsp;</td>
                </tr>
                ${(item.totalUSD > 0 || pBuena > 0) ? `
                <tr style="background: #ffffff; color: #0f172a; border-top: 1px solid #e2e8f0;">
                    <td colspan="2" style="text-align: left; font-weight: 800; color: #1e293b; padding: 9px 12px; font-size: 13px;">Valor Dólar</td>
                    <td style="text-align: right; font-size: 15px; font-weight: 900; color: #15803d; font-family: 'Consolas', monospace; padding: 9px 14px;">$ ${formatearNumero(item.totalUSD, 2)}</td>
                    <td style="padding: 9px 12px;">&nbsp;</td>
                </tr>
                <tr style="background: #ffffff; color: #0f172a; border-top: 1px solid #e2e8f0;">
                    <td colspan="2" style="text-align: left; font-weight: 800; color: #1e293b; padding: 9px 12px; font-size: 13px;">Valor Bs</td>
                    <td style="text-align: right; font-size: 15px; font-weight: 900; color: #1d4ed8; font-family: 'Consolas', monospace; padding: 9px 14px;">Bs ${formatearNumero(item.totalBs, 2)}</td>
                    <td style="font-weight: 800; color: #475569; font-size: 12px; padding: 9px 12px; text-align: left;">Tasa BCV: ${tasaFormatted}</td>
                </tr>` : ''}
            `;
        } else {
            footerRows = `
                <tr style="background: #f8fafc; font-weight: 900; color: #0f172a; border-top: 2px solid #cbd5e1;">
                    <td colspan="2" style="text-align: left; padding: 9px 12px; font-size: 13.5px;">TOTAL GENERAL</td>
                    <td style="text-align: right; padding: 9px 14px; font-family: 'Consolas', monospace; font-size: 15px; color: #0284c7; font-weight: 900;">${formatearNumero(item.totalLitros)} Lts</td>
                    <td style="text-align: left; padding: 9px 12px; font-weight: 800; color: #475569; font-size: 12.5px;">${pBuena > 0 ? `$ ${precioFormatted}` : ''}</td>
                </tr>
                ${(item.totalUSD > 0 || pBuena > 0) ? `
                <tr style="background: #ffffff; color: #0f172a; border-top: 1px solid #e2e8f0;">
                    <td colspan="2" style="text-align: left; font-weight: 800; color: #1e293b; padding: 9px 12px; font-size: 13px;">Valor Dólar</td>
                    <td style="text-align: right; font-size: 15px; font-weight: 900; color: #15803d; font-family: 'Consolas', monospace; padding: 9px 14px;">$ ${formatearNumero(item.totalUSD, 2)}</td>
                    <td style="padding: 9px 12px;">&nbsp;</td>
                </tr>
                <tr style="background: #ffffff; color: #0f172a; border-top: 1px solid #e2e8f0;">
                    <td colspan="2" style="text-align: left; font-weight: 800; color: #1e293b; padding: 9px 12px; font-size: 13px;">Valor Bs</td>
                    <td style="text-align: right; font-size: 15px; font-weight: 900; color: #1d4ed8; font-family: 'Consolas', monospace; padding: 9px 14px;">Bs ${formatearNumero(item.totalBs, 2)}</td>
                    <td style="font-weight: 800; color: #475569; font-size: 12px; padding: 9px 12px; text-align: left;">Tasa BCV: ${tasaFormatted}</td>
                </tr>` : ''}
            `;
        }

        cardsHtml += `
            <div class="report-card-demarcada" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); margin-bottom: 24px; overflow: hidden;">
                <div class="table-responsive" style="margin: 0; border: none; flex-grow: 1;">
                    <table class="table-reporte-demarcada" style="width: 100%; margin-bottom: 0; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th colspan="4" style="background: ${headerGradient}; color: #ffffff; font-size: 15px; font-weight: 900; text-align: center; padding: 12px 14px; border-bottom: 2px solid rgba(0,0,0,0.1); letter-spacing: 0.03em;">
                                    ${item.nombre.toUpperCase()} ${badgeCabecera}
                                </th>
                            </tr>
                            <tr style="background: #f1f5f9; color: #1e293b; font-weight: 800; font-size: 12px; text-transform: uppercase;">
                                <th style="width: 18%; text-align: center; padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">FECHA</th>
                                <th style="width: 18%; text-align: center; padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">TIPO LECHE</th>
                                <th style="width: 22%; text-align: right; padding: 8px 14px; border-bottom: 2px solid #cbd5e1;">LITROS</th>
                                <th style="width: 42%; text-align: left; padding: 8px 12px; border-bottom: 2px solid #cbd5e1;">DETALLE / OBSERVACIÓN</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            ${footerRows}
                        </tfoot>
                    </table>
                </div>
                <div style="padding: 12px 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                    <button type="button" class="btn-exportar-card" onclick="exportarSeccionExcel('${item.nombre}')" title="Exportar ${item.nombre} a Excel" style="background: #059669; border: none; color: #ffffff; font-weight: 700; padding: 7px 15px; border-radius: 6px; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(5,150,105,0.25);">
                        <i class="fa-solid fa-file-excel"></i> Exportar
                    </button>
                    <button type="button" class="btn-captura-card" onclick="capturarCardImagen(this, '${item.nombre}')" title="Capturar imagen de la tabla ${item.nombre}" style="background: linear-gradient(135deg, #0284c7, #2563eb); border: none; color: #ffffff; font-weight: 700; padding: 7px 15px; border-radius: 6px; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                        <i class="fa-solid fa-camera"></i> Capturar Imagen
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="report-grid-cards">
            ${cardsHtml}
        </div>
    `;
}

function renderReporteFincas(data, fechaDesde, fechaHasta) {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    window.ultimosDatosReporteFincas = { data, fechaDesde, fechaHasta };
    const mostrarAdelanto = !!state.mostrarAdelantoReporteFincas;

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-cow" style="font-size: 32px; margin-bottom: 10px; display: block; color: #94a3b8;"></i>
                No se encontraron registros de recolección en fincas en el rango seleccionado (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}).
            </div>
        `;
        return;
    }

    const f1 = document.getElementById('reporteSubSelectFinca1')?.value || '';
    const f2 = document.getElementById('reporteSubSelectFinca2')?.value || '';

    let grandTotalLitrosBuena = 0;
    let grandTotalLitrosMala = 0;
    let grandTotalUSD = 0;
    let grandTotalBs = 0;
    let grandTotalAdelantosUSD = 0;
    let grandTotalAdelantosBs = 0;
    let grandTotalNetoUSD = 0;
    let grandTotalNetoBs = 0;
    let tasaGlobalBCV = state.tasaBcv || 801.1752;

    const cardsArray = [];

    data.forEach(finca => {
        let rowsHtml = '';
        let totalLitrosBuena = 0;
        let totalLitrosMala = 0;

        (finca.detalle || []).forEach((d, idx) => {
            const altClass = idx % 2 === 1 ? 'class="excel-td-alt"' : '';
            const obs = (d.observacion || '').toUpperCase();
            const isAcida = Boolean(d.esAcida) || obs.includes('ACID') || obs.includes('MALA');

            if (isAcida) {
                totalLitrosMala += d.litros;
            } else {
                totalLitrosBuena += d.litros;
            }

            // Quitar mención redundante a búfala en la columna de observación
            let obsLimpia = (d.observacion || '')
                .replace(/\[\s*BUFAL[AO]\s*\]/gi, '')
                .replace(/\bBUFAL[AO]\b/gi, '')
                .trim();

            // Si es ácida, mostrar claramente ÁCIDA en la columna de observación
            let obsDisplay = obsLimpia;
            if (isAcida) {
                if (!obsLimpia.toUpperCase().includes('ACID') && !obsLimpia.toUpperCase().includes('MALA')) {
                    obsDisplay = obsLimpia ? `ÁCIDA - ${obsLimpia}` : 'ÁCIDA';
                }
            }

            rowsHtml += `
                <tr ${altClass} style="border-bottom: 1px solid #000000;">
                    <td style="font-weight: 700; color: #000000; text-align: center; border: 1px solid #000000 !important; padding: 8px 10px;">${formatearFechaLocal(d.fecha)}</td>
                    <td style="font-weight: 900; color: #000000; text-align: center; border: 1px solid #000000 !important; padding: 8px 10px;">${formatearNumero(d.litros)}</td>
                    <td class="text-left" style="color: ${isAcida ? '#dc2626' : '#000000'}; font-weight: ${isAcida ? '900' : '700'}; border: 1px solid #000000 !important; padding: 8px 10px;">${obsDisplay}</td>
                </tr>
            `;
        });

        const soloNombreFinca = (finca.nombre || '').split(' - ')[0].split(' (')[0].trim().toUpperCase();
        const precioBuena = finca.precioLitroUSD || 0.82;
        const tienePrecioAcida = finca.precioLitroAcidaUSD && finca.precioLitroAcidaUSD > 0;
        const precioMala = tienePrecioAcida ? finca.precioLitroAcidaUSD : 0.65;
        const tasaBCV = finca.tasaBcv || state.tasaBcv || 801.1752;
        tasaGlobalBCV = tasaBCV;

        const usdBuena = totalLitrosBuena * precioBuena;
        const usdMala = totalLitrosMala * (tienePrecioAcida ? precioMala : 0);
        const fincaTotalUSD = usdBuena + usdMala;
        const fincaTotalBs = fincaTotalUSD * tasaBCV;

        // Cálculo de Adelantos (Automático de BD o Manual Ajustado)
        const adelantoManual = (window.adelantosManualesFincasReporte && window.adelantosManualesFincasReporte[finca.id] !== undefined)
            ? window.adelantosManualesFincasReporte[finca.id]
            : (finca.totalAdelantosUSD || 0);

        const adelantoUSD = adelantoManual;
        const adelantoBs = (finca.totalAdelantosBs && !window.adelantosManualesFincasReporte?.[finca.id])
            ? finca.totalAdelantosBs
            : (adelantoUSD * tasaBCV);

        const fincaNetoUSD = Math.max(0, fincaTotalUSD - adelantoUSD);
        const fincaNetoBs = Math.max(0, fincaTotalBs - adelantoBs);

        grandTotalLitrosBuena += totalLitrosBuena;
        grandTotalLitrosMala += totalLitrosMala;
        grandTotalUSD += fincaTotalUSD;
        grandTotalBs += fincaTotalBs;
        grandTotalAdelantosUSD += adelantoUSD;
        grandTotalAdelantosBs += adelantoBs;
        grandTotalNetoUSD += fincaNetoUSD;
        grandTotalNetoBs += fincaNetoBs;

        const tieneLecheMala = totalLitrosMala > 0;

        const precioAcidaCellHtml = tienePrecioAcida
            ? `${formatearNumero(precioMala, 2)}`
            : `<button type="button" onclick="abrirModalAjustarPrecioAcida(${finca.id}, '${soloNombreFinca}')" style="background: #f59e0b; color: #ffffff; border: none; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(245,158,11,0.3);" title="Agregar precio de leche ácida en Ajustes de Liquidación">
                <i class="fa-solid fa-plus-circle"></i> Agregar Precio
               </button>`;

        let tfootHtml = '';

        if (!mostrarAdelanto) {
            // FORMATO ORIGINAL (SIN ADELANTOS)
            tfootHtml = tieneLecheMala ? `
                <tfoot style="background: #047857; color: #ffffff; font-weight: 800;">
                    <tr style="border-top: 1.5px solid #000000;">
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">TOTAL BUENA</td>
                        <td style="font-size: 14px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(totalLitrosBuena)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(precioBuena, 2)}</td>
                    </tr>
                    <tr style="background: rgba(0,0,0,0.12);">
                        <td style="color: #fef08a; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">TOTAL MALA/ACIDA</td>
                        <td style="font-size: 14px; font-weight: 800; color: #fef08a; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(totalLitrosMala)}</td>
                        <td style="font-weight: 800; color: #fef08a; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${precioAcidaCellHtml}</td>
                    </tr>
                    <tr>
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">Valor Dolar</td>
                        <td style="font-size: 14px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalUSD, 2)}</td>
                        <td style="border: 1px solid #000000 !important;">&nbsp;</td>
                    </tr>
                    <tr style="border-bottom: 1.5px solid #000000;">
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">Valor Bs</td>
                        <td style="font-size: 14px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalBs, 2)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(tasaBCV, 4)}</td>
                    </tr>
                </tfoot>
            ` : `
                <tfoot style="background: #047857; color: #ffffff; font-weight: 800;">
                    <tr style="border-top: 1.5px solid #000000;">
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">TOTAL</td>
                        <td style="font-size: 14px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(totalLitrosBuena)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(precioBuena, 2)}</td>
                    </tr>
                    <tr>
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">Valor Dolar</td>
                        <td style="font-size: 14px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalUSD, 2)}</td>
                        <td style="border: 1px solid #000000 !important;">&nbsp;</td>
                    </tr>
                    <tr style="border-bottom: 1.5px solid #000000;">
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">Valor Bs</td>
                        <td style="font-size: 14px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalBs, 2)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(tasaBCV, 4)}</td>
                    </tr>
                </tfoot>
            `;
        } else {
            // FORMATO CON ADELANTOS / DEDUCCIONES APLICADAS
            const btnEditarAdelanto = `
                <button type="button" onclick="abrirModalTicketAdelantoFinca(${finca.id}, '${soloNombreFinca}', ${adelantoUSD})" style="background: #ffffff; border: 1px solid #fca5a5; color: #dc2626; font-size: 10px; font-weight: 800; border-radius: 4px; padding: 2px 6px; margin-left: 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" title="Ver Ticket / Detalle de Adelanto y Descuento Parcial">
                    <i class="fa-solid fa-pen"></i>
                </button>
            `;

            const tieneAdelantoEstaFinca = adelantoUSD > 0;

            tfootHtml = tieneLecheMala ? `
                <tfoot style="background: #047857; color: #ffffff; font-weight: 800;">
                    <tr style="border-top: 1.5px solid #000000;">
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">TOTAL BUENA</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(totalLitrosBuena)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(precioBuena, 2)}</td>
                    </tr>
                    <tr style="background: rgba(0,0,0,0.12);">
                        <td style="color: #fef08a; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">TOTAL MALA/ACIDA</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #fef08a; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(totalLitrosMala)}</td>
                        <td style="font-weight: 800; color: #fef08a; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${precioAcidaCellHtml}</td>
                    </tr>
                    <tr>
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">${tieneAdelantoEstaFinca ? 'Valor Dólar Bruto' : 'Valor Dólar'}</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalUSD, 2)}</td>
                        <td style="border: 1px solid #000000 !important;">&nbsp;</td>
                    </tr>
                    ${tieneAdelantoEstaFinca ? `
                    <tr style="background: rgba(220, 38, 38, 0.28); border-top: 1px solid #000000; border-bottom: 1px solid #000000;">
                        <td style="color: #fee2e2; font-weight: 900; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">
                            <i class="fa-solid fa-circle-minus" style="color: #f87171; margin-right: 3px;"></i> (-) Adelanto USD ${btnEditarAdelanto}
                        </td>
                        <td style="text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">
                            <span style="background: #ffffff; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 13.5px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); display: inline-block;">
                                -${formatearNumero(adelantoUSD, 2)}
                            </span>
                        </td>
                        <td style="font-size: 11.5px; font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">Neto: $${formatearNumero(fincaNetoUSD, 2)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">${tieneAdelantoEstaFinca ? 'Valor Bs Bruto' : 'Valor Bs'}</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalBs, 2)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(tasaBCV, 4)}</td>
                    </tr>
                    <tr style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; background: rgba(0,0,0,0.32);">
                        <td style="color: #6ee7b7; font-weight: 900; text-align: left; padding: 8px 10px; font-size: 13.5px; border: 1px solid #000000 !important;">TOTAL NETO BS</td>
                        <td style="font-size: 15px; font-weight: 900; color: #6ee7b7; text-align: center; padding: 8px 10px; border: 1px solid #000000 !important;">${formatearNumero(tieneAdelantoEstaFinca ? fincaNetoBs : fincaTotalBs, 2)}</td>
                        ${tieneAdelantoEstaFinca ? `
                        <td style="text-align: right; padding: 8px 10px; border: 1px solid #000000 !important;">
                            <span style="background: #ffffff; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); display: inline-block;">
                                (-) ${formatearNumero(adelantoBs, 2)} Bs
                            </span>
                        </td>
                        ` : '<td style="border: 1px solid #000000 !important;">&nbsp;</td>'}
                    </tr>
                </tfoot>
            ` : `
                <tfoot style="background: #047857; color: #ffffff; font-weight: 800;">
                    <tr style="border-top: 1.5px solid #000000;">
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">TOTAL</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(totalLitrosBuena)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(precioBuena, 2)}</td>
                    </tr>
                    <tr>
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">${tieneAdelantoEstaFinca ? 'Valor Dólar Bruto' : 'Valor Dólar'}</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalUSD, 2)}</td>
                        <td style="border: 1px solid #000000 !important;">&nbsp;</td>
                    </tr>
                    ${tieneAdelantoEstaFinca ? `
                    <tr style="background: rgba(220, 38, 38, 0.28); border-top: 1px solid #000000; border-bottom: 1px solid #000000;">
                        <td style="color: #fee2e2; font-weight: 900; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">
                            <i class="fa-solid fa-circle-minus" style="color: #f87171; margin-right: 3px;"></i> (-) Adelanto USD ${btnEditarAdelanto}
                        </td>
                        <td style="text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">
                            <span style="background: #ffffff; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 13.5px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); display: inline-block;">
                                -${formatearNumero(adelantoUSD, 2)}
                            </span>
                        </td>
                        <td style="font-size: 11.5px; font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">Neto: $${formatearNumero(fincaNetoUSD, 2)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="color: #ffffff; font-weight: 800; text-align: left; padding: 7px 10px; border: 1px solid #000000 !important;">${tieneAdelantoEstaFinca ? 'Valor Bs Bruto' : 'Valor Bs'}</td>
                        <td style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(fincaTotalBs, 2)}</td>
                        <td style="font-weight: 800; color: #ffffff; text-align: right; padding: 7px 10px; border: 1px solid #000000 !important;">${formatearNumero(tasaBCV, 4)}</td>
                    </tr>
                    <tr style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; background: rgba(0,0,0,0.32);">
                        <td style="color: #6ee7b7; font-weight: 900; text-align: left; padding: 8px 10px; font-size: 13.5px; border: 1px solid #000000 !important;">TOTAL NETO BS</td>
                        <td style="font-size: 15px; font-weight: 900; color: #6ee7b7; text-align: center; padding: 8px 10px; border: 1px solid #000000 !important;">${formatearNumero(tieneAdelantoEstaFinca ? fincaNetoBs : fincaTotalBs, 2)}</td>
                        ${tieneAdelantoEstaFinca ? `
                        <td style="text-align: right; padding: 8px 10px; border: 1px solid #000000 !important;">
                            <span style="background: #ffffff; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); display: inline-block;">
                                (-) ${formatearNumero(adelantoBs, 2)} Bs
                            </span>
                        </td>
                        ` : '<td style="border: 1px solid #000000 !important;">&nbsp;</td>'}
                    </tr>
                </tfoot>
            `;
        }

        const nombreOriginal = (finca.nombre || '').trim();
        const nombreNorm = nombreOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

        // Determinar si la finca corresponde a BÚFALA o VACA:
        // 1. Si el nombre ya viene etiquetado explícitamente desde el backend (ej: "Tarita (Búfala)")
        // 2. Si el nombre de la finca contiene "BUFAL"
        // 3. Si en su configuración tiene precio normal en 0 y precio búfala > 0
        let esBufala = false;
        if (nombreOriginal.toUpperCase().includes('(BÚFALA)') || nombreOriginal.toUpperCase().includes('(BUFALA)')) {
            esBufala = true;
        } else if (nombreOriginal.toUpperCase().includes('(VACA)')) {
            esBufala = false;
        } else if (nombreNorm.includes('BUFAL')) {
            esBufala = true;
        } else if (nombreNorm.includes('TARITA')) {
            esBufala = true;
        } else if ((Number(finca.precioLitroUSD) === 0 || !finca.precioLitroUSD) && (Number(finca.precioBufalaLitroUSD) > 0)) {
            esBufala = true;
        } else {
            // Por defecto en fincas estándar sin check de dos tipos y con Precio Normal ($/Lt), es VACA
            esBufala = false;
        }

        // Limpiar sufijos previos para evitar redundancias (ej: "3 DE MAYO (VACA)")
        let nombreLimpio = nombreOriginal
            .replace(/\s*\(\s*VACA\s*\)/gi, '')
            .replace(/\s*\(\s*BUFALA\s*\)/gi, '')
            .replace(/\s*\(\s*BÚFALA\s*\)/gi, '')
            .trim()
            .toUpperCase();

        const textoTipo = esBufala ? 'BÚFALA' : 'VACA';
        const iconoTipo = esBufala 
            ? '<i class="fa-solid fa-leaf" style="font-size: 13px; margin-right: 4px; vertical-align: middle;"></i>' 
            : '<i class="fa-solid fa-cow" style="font-size: 13px; margin-right: 4px; vertical-align: middle;"></i>';

        const nombreDisplay = `${nombreLimpio} (${textoTipo})`;

        const cardHeaderBg = esBufala 
            ? 'linear-gradient(135deg, #059669, #047857)' 
            : 'linear-gradient(135deg, #0284c7, #2563eb)';

        const cardHtml = `
            <div class="report-card-demarcada" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.05); padding: 14px;">
                <div class="table-responsive" style="margin: 0; border: none; flex-grow: 1;">
                    <table class="table-reporte-demarcada" style="width: 100%; border-collapse: collapse; border: 2px solid #000000 !important;">
                        <thead>
                            <tr>
                                <th colspan="3" class="${esBufala ? 'th-header-bufala' : 'th-header-vaca'}" style="background: ${cardHeaderBg} !important; color: #ffffff !important; font-size: 15px !important; font-weight: 900 !important; text-align: center !important; padding: 12px 14px !important; letter-spacing: 0.03em; border: 2px solid #000000 !important;">
                                    <span class="titulo-nombre-finca" style="color: #ffffff !important; font-weight: 900 !important; font-size: 15px; text-shadow: 0 1px 3px rgba(0,0,0,0.4); display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                                        ${nombreLimpio} (${iconoTipo}${textoTipo})
                                    </span>
                                </th>
                            </tr>
                            <tr style="background: #e2e8f0; color: #000000; font-weight: 900; font-size: 12px;">
                                <th style="width: 33%; text-align: center; padding: 9px 8px; background: #e2e8f0; color: #000000 !important; font-weight: 900 !important; border: 1.5px solid #000000 !important;">FECHA</th>
                                <th style="width: 33%; text-align: center; padding: 9px 8px; background: #e2e8f0; color: #000000 !important; font-weight: 900 !important; border: 1.5px solid #000000 !important;">LITROS</th>
                                <th style="width: 34%; text-align: center; padding: 9px 8px; background: #e2e8f0; color: #000000 !important; font-weight: 900 !important; border: 1.5px solid #000000 !important;">OBSERVACION</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        ${tfootHtml}
                    </table>
                </div>
                <div class="card-actions-footer" style="padding: 12px 0 0 0; background: transparent; border-top: none; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn-exportar-card" onclick="exportarSeccionExcel('${nombreDisplay}')" title="Exportar ${nombreDisplay} a Excel">
                        <i class="fa-solid fa-file-excel"></i> Exportar
                    </button>
                    <button type="button" class="btn-captura-card" onclick="capturarCardImagen(this, '${nombreDisplay}')" title="Capturar imagen de la tabla ${nombreDisplay}" style="background: linear-gradient(135deg, #0284c7, #2563eb); border: none; color: #ffffff; font-weight: 700; padding: 6px 14px; border-radius: 6px; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                        <i class="fa-solid fa-camera"></i> Capturar Imagen
                    </button>
                    ${(mostrarAdelanto && adelantoUSD > 0) ? `
                        <button type="button" class="btn" onclick="abrirModalTicketAdelantoFinca(${finca.id}, '${nombreDisplay}', ${adelantoUSD})" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-weight: 800; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Ver Ticket / Detalle de Adelanto">
                            <i class="fa-solid fa-receipt"></i> Adelanto: $${formatearNumero(adelantoUSD, 2)}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        cardsArray.push({
            id: String(finca.id ?? finca.Id ?? ''),
            nombre: nombreDisplay,
            propietario: (finca.propietario || finca.Propietario || '').trim().toUpperCase(),
            esBufala: esBufala,
            totalLitrosBuena: totalLitrosBuena,
            totalLitrosMala: totalLitrosMala,
            totalLitros: totalLitrosBuena + totalLitrosMala,
            fincaTotalUSD: fincaTotalUSD,
            fincaTotalBs: fincaTotalBs,
            adelantoUSD: adelantoUSD,
            adelantoBs: adelantoBs,
            html: cardHtml
        });
    });

    let cardObj1 = null;
    let cardObj2 = null;

    if (cardsArray.length === 2 && (!f2 || f1 === f2 || cardsArray[0].id === cardsArray[1].id)) {
        cardObj1 = cardsArray[0];
        cardObj2 = cardsArray[1];
    } else if (f1 && f2 && f1 !== f2) {
        cardObj1 = cardsArray.find(item => item.id === String(f1)) || cardsArray[0] || null;
        cardObj2 = cardsArray.find(item => item.id === String(f2) && item !== cardObj1) || cardsArray[1] || null;
    } else {
        if (cardsArray.length > 0) cardObj1 = cardsArray[0];
        if (cardsArray.length > 1) cardObj2 = cardsArray[1];
    }

    const slot1 = cardObj1 ? cardObj1.html : '';
    const slot2 = cardObj2 ? cardObj2.html : '';
    const tieneDosTablas = slot1 && slot2;

    const prop1 = cardObj1 ? cardObj1.propietario : '';
    const prop2 = cardObj2 ? cardObj2.propietario : '';
    const cleanNom1 = (cardObj1?.nombre || '').replace(/BUFALA|BUFALO/g, '').trim();
    const cleanNom2 = (cardObj2?.nombre || '').replace(/BUFALA|BUFALO/g, '').trim();
    const sonMismoPropietario = tieneDosTablas && (
        (prop1 !== '' && prop1 === prop2) ||
        (cleanNom1.length > 3 && cleanNom1 === cleanNom2)
    );

    let objVaca = null;
    let objBufala = null;
    if (cardObj1?.esBufala && !cardObj2?.esBufala) {
        objBufala = cardObj1;
        objVaca = cardObj2;
    } else if (cardObj2?.esBufala && !cardObj1?.esBufala) {
        objBufala = cardObj2;
        objVaca = cardObj1;
    }

    const esCasoVacaBufala = Boolean(objVaca && objBufala);

    const actionHeaderHtml = `
        <div class="report-action-header" style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1.5px solid #cbd5e1; padding: 14px 20px; border-radius: 12px; margin-bottom: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="font-weight: 800; font-size: 15px; color: #0f172a; display: flex; align-items: center; gap: 10px;">
                <div style="background: #eff6ff; color: #2563eb; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                    <i class="fa-solid fa-cow"></i>
                </div>
                <div>
                    <div style="font-size: 15px; font-weight: 900; color: #0f172a;">Reporte de Fincas (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)})</div>
                    <small style="color: ${sonMismoPropietario ? '#047857' : '#64748b'}; font-size: 12px; font-weight: 700;">
                        ${tieneDosTablas 
                            ? (sonMismoPropietario 
                                ? `<i class="fa-solid fa-circle-check"></i> ${esCasoVacaBufala ? 'Reporte Separado de Leche (VACA + BÚFALA)' : 'Fincas del Mismo Propietario'} (${cardObj1.propietario || cleanNom1})` 
                                : 'Comparativa de 2 Fincas (Propietarios Distintos)')
                            : 'Vista de Recolección Individual'}
                    </small>
                </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <button type="button" class="btn" id="btnToggleAdelantoFincas" onclick="toggleAdelantoReporteFincas()" style="background: ${mostrarAdelanto ? 'linear-gradient(135deg, #d97706, #b45309)' : 'linear-gradient(135deg, #475569, #334155)'}; color: #ffffff; font-weight: 800; padding: 9px 18px; border-radius: 8px; display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15);" title="Activar / Desactivar cálculo de adelantos en el reporte">
                    <i class="fa-solid fa-hand-holding-dollar"></i> ${mostrarAdelanto ? 'Adelanto: ACTIVADO' : 'Mostrar Adelanto (Opcional)'}
                </button>
                ${tieneDosTablas ? `
                    ${!sonMismoPropietario ? `
                        <button type="button" class="btn" id="btnSumarTotalesOpcional" onclick="toggleConsolidadoOpcional()" style="background: linear-gradient(135deg, #047857, #065f46); color: #ffffff; font-weight: 800; padding: 9px 18px; border-radius: 8px; display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(4,120,87,0.3);">
                            <i class="fa-solid fa-calculator"></i> Sumar Totales (Opcional)
                        </button>
                    ` : ''}
                    <button type="button" class="btn" onclick="imprimirAmbasTablasFincas()" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; font-weight: 800; padding: 9px 18px; border-radius: 8px; display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(15,23,42,0.3);">
                        <i class="fa-solid fa-print"></i> Imprimir Ambas Tablas
                    </button>
                    <button type="button" class="btn" onclick="capturarAmbasTablasFincas()" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; font-weight: 800; padding: 9px 18px; border-radius: 8px; display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                        <i class="fa-solid fa-camera"></i> Capturar Imagen Ambas
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    const tieneGrandTotalMala = grandTotalLitrosMala > 0;

    // Consolidación de Ambas Fincas (o fincas del mismo propietario):
    // La deducción del adelanto se aplica a la suma de ambas fincas: Total Bruto - Total Adelantos
    const consolidadoNetoUSD = Math.max(0, grandTotalUSD - grandTotalAdelantosUSD);
    const consolidadoNetoBs = Math.max(0, grandTotalBs - grandTotalAdelantosBs);

    const saldoDeudaUSD = grandTotalAdelantosUSD > grandTotalUSD ? (grandTotalAdelantosUSD - grandTotalUSD) : 0;
    const saldoDeudaBs = grandTotalAdelantosBs > grandTotalBs ? (grandTotalAdelantosBs - grandTotalBs) : 0;
    const tieneSaldoDeudor = saldoDeudaUSD > 0.001 || saldoDeudaBs > 0.01;

    const consolidadoTitulo = esCasoVacaBufala
        ? `LIQUIDACIÓN CONSOLIDADA (VACA + BÚFALA) &bull; ${cardObj1.propietario || cleanNom1}`
        : (sonMismoPropietario 
            ? `SUMA TOTAL CONSOLIDADA EN BS &bull; ${cardObj1.propietario || cleanNom1}`
            : 'SUMA TOTAL CONSOLIDADA EN BS (AMBAS FINCAS)');

    const consolidadoCardHtml = tieneDosTablas ? `
        <div id="cardConsolidadoAmbasFincas" style="display: ${sonMismoPropietario ? 'block' : 'none'}; background: linear-gradient(135deg, #065f46 0%, #047857 100%); border: 2px solid #047857; color: #ffffff; padding: 20px 24px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 14px rgba(4,120,87,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.25); padding-bottom: 10px;">
                <h3 style="color: #ffffff; font-size: 16.5px; margin: 0; font-weight: 900; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-calculator" style="color: #a7f3d0;"></i> ${consolidadoTitulo}
                </h3>
                <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; font-weight: 800; font-size: 12.5px; padding: 5px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3);">
                    Tasa BCV: ${formatearNumero(tasaGlobalBCV, 4)} Bs/USD
                </span>
            </div>
            <div style="display: grid; grid-template-columns: ${esCasoVacaBufala ? (mostrarAdelanto ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)') : (mostrarAdelanto ? (tieneGrandTotalMala ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)') : (tieneGrandTotalMala ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)'))}; gap: 14px; text-align: center;">
                ${esCasoVacaBufala ? `
                    <div style="background: rgba(30,64,175,0.25); padding: 12px; border-radius: 8px; border: 1.5px solid rgba(147,197,253,0.4);">
                        <small style="color: #bfdbfe; font-size: 11px; font-weight: 800; text-transform: uppercase;"><i class="fa-solid fa-cow"></i> Litros VACA</small>
                        <div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-top: 4px;">${formatearNumero(objVaca.totalLitros)} Lts</div>
                        <small style="font-size: 10.5px; color: #bfdbfe; font-weight: 700;">$${formatearNumero(objVaca.fincaTotalUSD, 2)}</small>
                    </div>
                    <div style="background: rgba(6,95,70,0.3); padding: 12px; border-radius: 8px; border: 1.5px solid rgba(167,243,208,0.4);">
                        <small style="color: #a7f3d0; font-size: 11px; font-weight: 800; text-transform: uppercase;"><i class="fa-solid fa-leaf"></i> Litros BÚFALA</small>
                        <div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-top: 4px;">${formatearNumero(objBufala.totalLitros)} Lts</div>
                        <small style="font-size: 10.5px; color: #a7f3d0; font-weight: 700;">$${formatearNumero(objBufala.fincaTotalUSD, 2)}</small>
                    </div>
                ` : `
                    <div style="background: rgba(255,255,255,0.12); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
                        <small style="color: #a7f3d0; font-size: 11.5px; font-weight: 800; text-transform: uppercase;">${tieneGrandTotalMala ? 'Total Litros Buena' : 'Total Litros'}</small>
                        <div style="font-size: 19px; font-weight: 900; color: #ffffff; margin-top: 4px;">${formatearNumero(grandTotalLitrosBuena)} Lts</div>
                    </div>
                    ${tieneGrandTotalMala ? `
                        <div style="background: rgba(255,255,255,0.12); padding: 12px; border-radius: 8px; border: 1.5px solid rgba(255,255,255,0.15);">
                            <small style="color: #fca5a5; font-size: 11.5px; font-weight: 800; text-transform: uppercase;">Total Litros Mala / Ácida</small>
                            <div style="font-size: 19px; font-weight: 900; color: #ffffff; margin-top: 4px;">${formatearNumero(grandTotalLitrosMala)} Lts</div>
                        </div>
                    ` : ''}
                `}
                <div style="background: rgba(255,255,255,0.12); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
                    <small style="color: #93c5fd; font-size: 11.5px; font-weight: 800; text-transform: uppercase;">${mostrarAdelanto ? 'Total Bruto USD' : 'Total Consolidado USD'}</small>
                    <div style="font-size: 19px; font-weight: 900; color: #ffffff; margin-top: 4px;">$${formatearNumero(grandTotalUSD, 2)}</div>
                    <small style="font-size: 10.5px; color: #bfdbfe; font-weight: 700;">Bs. ${formatearNumero(grandTotalBs, 2)}</small>
                </div>
                ${mostrarAdelanto ? `
                    <div style="background: rgba(239,68,68,0.22); padding: 12px; border-radius: 8px; border: 1.5px solid rgba(248,113,113,0.35);">
                        <small style="color: #fecaca; font-size: 11.5px; font-weight: 800; text-transform: uppercase;">(-) Total Adelantos</small>
                        <div style="font-size: 17px; font-weight: 900; color: #ffffff; margin-top: 4px;">-$${formatearNumero(grandTotalAdelantosUSD, 2)}</div>
                        <small style="font-size: 10.5px; color: #fecaca; font-weight: 700;">-Bs. ${formatearNumero(grandTotalAdelantosBs, 2)}</small>
                        ${tieneSaldoDeudor ? `
                            <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed rgba(254,202,202,0.4); font-size: 11px; color: #fef08a; font-weight: 800;">
                                Deuda Restante: -$${formatearNumero(saldoDeudaUSD, 2)}<br>
                                <span style="font-size: 10px; color: #fca5a5;">(-Bs. ${formatearNumero(saldoDeudaBs, 2)})</span>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                <div style="background: ${tieneSaldoDeudor ? 'rgba(220,38,38,0.35)' : (mostrarAdelanto ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.28)')}; padding: 12px; border-radius: 8px; border: 2px solid ${tieneSaldoDeudor ? '#fca5a5' : '#ffffff'};">
                    <small style="color: #fef08a; font-size: 11.5px; font-weight: 900; text-transform: uppercase;">${mostrarAdelanto ? 'TOTAL NETO A PAGAR BS' : 'TOTAL MONTO BS'}</small>
                    <div style="font-size: 21px; font-weight: 900; color: #ffffff; margin-top: 4px;">Bs. ${formatearNumero(mostrarAdelanto ? consolidadoNetoBs : grandTotalBs, 2)}</div>
                    ${mostrarAdelanto ? (
                        tieneSaldoDeudor
                            ? `<div style="font-size: 11px; color: #fee2e2; font-weight: 800; margin-top: 3px;">
                                 <i class="fa-solid fa-triangle-exclamation"></i> SALDO DEUDOR (-Bs. ${formatearNumero(saldoDeudaBs, 2)})
                               </div>
                               <small style="font-size: 10.5px; color: #a7f3d0; font-weight: 700;">(Bruto Total: Bs. ${formatearNumero(grandTotalBs, 2)})</small>`
                            : `<small style="font-size: 11px; color: #a7f3d0; font-weight: 800;">(Bruto Total: Bs. ${formatearNumero(grandTotalBs, 2)})</small>`
                    ) : ''}
                </div>
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        ${actionHeaderHtml}
        <div class="report-grid-cards">
            <div>${slot1}</div>
            <div>${slot2}</div>
        </div>
        ${consolidadoCardHtml}
    `;
}

function toggleAdelantoReporteFincas() {
    state.mostrarAdelantoReporteFincas = !state.mostrarAdelantoReporteFincas;
    if (window.ultimosDatosReporteFincas) {
        renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
    }
}
window.toggleAdelantoReporteFincas = toggleAdelantoReporteFincas;

async function ajustarAdelantoManualFinca(fincaId, nombreFinca, valorActualUSD) {
    const { value: nuevoAdelanto } = await Swal.fire({
        title: `Adelanto / Deducción`,
        html: `
            <div style="font-size: 14px; color: #cbd5e1; margin-bottom: 12px;">
                Finca: <strong style="color: #38bdf8;">${nombreFinca}</strong>
            </div>
            <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 6px; text-align: left;">Monto del Adelanto en USD ($):</label>
        `,
        input: 'number',
        inputValue: valorActualUSD || 0,
        inputAttributes: { min: '0', step: '0.01' },
        showCancelButton: true,
        confirmButtonText: 'Aplicar al Reporte',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (nuevoAdelanto !== undefined && nuevoAdelanto !== null) {
        const valUSD = parseFloat(nuevoAdelanto) || 0;
        if (!window.adelantosManualesFincasReporte) window.adelantosManualesFincasReporte = {};
        window.adelantosManualesFincasReporte[fincaId] = valUSD;
        state.mostrarAdelantoReporteFincas = true;
        if (window.ultimosDatosReporteFincas) {
            renderReporteFincas(window.ultimosDatosReporteFincas.data, window.ultimosDatosReporteFincas.fechaDesde, window.ultimosDatosReporteFincas.fechaHasta);
        }
    }
}
window.ajustarAdelantoManualFinca = ajustarAdelantoManualFinca;

function toggleConsolidadoOpcional() {
    const card = document.getElementById('cardConsolidadoAmbasFincas');
    const btn = document.getElementById('btnSumarTotalesOpcional');
    if (!card) return;
    if (card.style.display === 'none' || !card.style.display) {
        card.style.display = 'block';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Ocultar Suma';
    } else {
        card.style.display = 'none';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-calculator"></i> Sumar Totales (Opcional)';
    }
}
window.toggleConsolidadoOpcional = toggleConsolidadoOpcional;

async function abrirModalAjustarPrecioAcida(fincaId, fincaNombre) {
    const { value: precioInput } = await Swal.fire({
        title: `Ajuste de Liquidación`,
        html: `
            <div style="text-align: left; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 10px;">
                <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px;">Finca: <span style="color: #2563eb; font-weight: 800;">${fincaNombre}</span></div>
                <p style="font-size: 12px; color: #64748b; margin: 0 0 10px 0;">Ingrese el precio en USD por litro para la leche marcada como <strong>MALA / ÁCIDA</strong>:</p>
            </div>
        `,
        input: 'text',
        inputAttributes: { inputmode: 'decimal', placeholder: 'Ej: 0.65' },
        inputValue: '0.65',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar Precio Ácida',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        inputValidator: (val) => {
            const raw = (val || '').trim().replace(',', '.');
            const parsed = parseFloat(raw);
            if (!val || isNaN(parsed) || parsed <= 0) {
                return 'Por favor ingrese un precio válido mayor a 0.';
            }
        }
    });

    if (precioInput) {
        const precioAcidaVal = parseFloat((precioInput || '').trim().replace(',', '.'));
        try {
            const payload = {
                fincaId: fincaId,
                precioLitroUSD: 0,
                precioLitroAcidaUSD: precioAcidaVal
            };

            const res = await fetch(`${API_BASE}/catalogos/pre-liquidacion/ajustar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Error en respuesta del servidor');

            Swal.fire({
                icon: 'success',
                title: 'Precio Ácida Guardado',
                text: `Se guardó $${precioAcidaVal.toFixed(4)} para la leche ácida de ${fincaNombre}.`,
                timer: 1500,
                showConfirmButton: false
            });

            if (state.fincas) {
                const fObj = state.fincas.find(x => x.id === fincaId);
                if (fObj) fObj.precioLitroAcidaUSD = precioAcidaVal;
            }

            if (typeof ejecutarBusquedaReporte === 'function') {
                await ejecutarBusquedaReporte();
            }
        } catch(err) {
            console.error('Error al actualizar precio acida:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el precio. Intente nuevamente.' });
        }
    }
}
window.abrirModalAjustarPrecioAcida = abrirModalAjustarPrecioAcida;

function imprimirAmbasTablasFincas() {
    window.print();
}
window.imprimirAmbasTablasFincas = imprimirAmbasTablasFincas;

async function capturarAmbasTablasFincas() {
    const elem = document.getElementById('contenedorResultadoReporte');
    if (!elem) return;

    if (typeof html2canvas === 'undefined') {
        if (typeof showToast === 'function') showToast('Error: Librería no disponible', 'error');
        return;
    }

    await ejecutarCapturaReporte(elem, 'Reporte_Consolidado_Fincas', '#f8fafc');
}
window.capturarAmbasTablasFincas = capturarAmbasTablasFincas;


function renderReporteBancos(data, fechaDesde, fechaHasta) {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-building-columns" style="font-size: 32px; margin-bottom: 10px; display: block; color: #94a3b8;"></i>
                No se encontraron registros de liquidación bancaria en el rango seleccionado (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}).
            </div>
        `;
        return;
    }

    const bancosMap = new Map();
    data.forEach(item => {
        const banco = item.bancoNombre || item.BancoNombre || 'SIN BANCO ASIGNADO';
        if (!bancosMap.has(banco)) bancosMap.set(banco, []);
        bancosMap.get(banco).push(item);
    });

    let grandTotalLitros = 0;
    let grandTotalUSD = 0;
    let grandTotalAdelBs = 0;
    let grandTotalNetoBs = 0;

    let cardsHtml = '';

    bancosMap.forEach((fincas, bancoNombre) => {
        let subLitros = 0;
        let subUSD = 0;
        let subAdelBs = 0;
        let subNetoBs = 0;

        let rowsHtml = '';
        fincas.forEach((f, idx) => {
            const fId = f.fincaId || f.FincaId;
            const fNombre = f.fincaNombre || f.FincaNombre || '';
            const fProp = f.propietario || f.Propietario || '';

            if (fNombre.toUpperCase().includes('CHOFER') || fProp.toUpperCase().includes('CHOFER') || fId === 68) return;

            const fRif = f.cedulaRIF || f.CedulaRIF || '-';
            const fCuenta = f.numeroCuenta || f.NumeroCuenta || '-';
            const fLitros = f.totalLitros || f.TotalLitros || 0;
            const fPrecio = f.precioLitroUSD || f.PrecioLitroUSD || 0;
            const fUSD = f.totalUSD || f.TotalUSD || 0;
            const fAdelBs = f.totalAdelantosBs || f.TotalAdelantosBs || 0;
            const fNetoBs = f.totalNetoBs || f.TotalNetoBs || 0;
            const fPagoId = f.pagoId || f.PagoId;

            subLitros += fLitros;
            subUSD += fUSD;
            subAdelBs += fAdelBs;
            subNetoBs += fNetoBs;

            grandTotalLitros += fLitros;
            grandTotalUSD += fUSD;
            grandTotalAdelBs += fAdelBs;
            grandTotalNetoBs += fNetoBs;

            const esPagadoFlag = !!(f.esPagado || f.EsPagado);
            const esDeudor = fNetoBs < 0;

            let badgeEstado = '';
            if (esPagadoFlag) {
                badgeEstado = `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> PAGADO</span>`;
            } else if (esDeudor) {
                badgeEstado = `<span class="badge" style="background: #fef2f2; color: #dc2626; border: 1.5px solid #fecdd3; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 800;" title="Adelantos superan el pago bruto"><i class="fa-solid fa-triangle-exclamation"></i> SALDO DEUDOR</span>`;
            } else {
                badgeEstado = `<span class="badge" style="background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700;"><i class="fa-solid fa-clock"></i> PENDIENTE</span>`;
            }

            const switchPago = `
                <div style="display: flex; justify-content: center; align-items: center;">
                    <input type="checkbox" ${esPagadoFlag ? 'checked' : ''} onchange="togglePagoLiquidacion(${fId}, this.checked)" style="width: 20px; height: 20px; cursor: pointer; accent-color: #10b981;" title="${esPagadoFlag ? 'Marcar como Pendiente (Revertir)' : 'Marcar como Pagado'}">
                </div>
            `;

            const btnRecibo = (esPagadoFlag && fPagoId)
                ? `<button type="button" class="btn btn-outline" onclick="verReciboPagoLiquidacionModal(${fPagoId})" title="Ver Recibo Oficial" style="padding: 3px 8px; font-size: 11px; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px;"><i class="fa-solid fa-file-invoice"></i> Recibo</button>`
                : '<span style="color: #94a3b8; font-size: 11px;">-</span>';

            const netoDisplay = esDeudor
                ? `<span style="color: #dc2626; font-weight: 800; font-size: 13.5px;">- Bs. ${formatearNumero(Math.abs(fNetoBs), 2)}</span><br><small style="color: #ef4444; font-weight: 800; font-size: 10px;">(SALDO DEUDOR)</small>`
                : `Bs. ${formatearNumero(fNetoBs, 2)}`;

            const altClass = idx % 2 === 1 ? 'class="excel-td-alt"' : '';
            rowsHtml += `
                <tr ${altClass} style="${esPagadoFlag ? 'background-color: #f0fdf4;' : (esDeudor ? 'background-color: #fff5f5;' : '')}">
                    <td class="text-left"><strong>${fNombre}</strong></td>
                    <td class="text-left" style="color: #475569;">${fProp}</td>
                    <td style="font-family: monospace; font-size: 11.5px;">${fRif}</td>
                    <td style="font-family: monospace; font-size: 11.5px; color: #2563eb; font-weight: 600;">${fCuenta}</td>
                    <td style="text-align: right; font-weight: 700;">${formatearNumero(fLitros)} L</td>
                    <td style="text-align: right; color: #2563eb; font-weight: 600;">$${formatearNumero(fPrecio, 4)}</td>
                    <td style="text-align: right; color: #2563eb; font-weight: 700;">$${formatearNumero(fUSD, 2)}</td>
                    <td style="text-align: right; color: ${fAdelBs > 0 ? '#ef4444' : '#94a3b8'}; font-weight: 700;">${fAdelBs > 0 ? `- Bs. ${formatearNumero(fAdelBs, 2)}` : '-'}</td>
                    <td style="text-align: right; font-weight: 800; color: ${esDeudor ? '#dc2626' : '#047857'}; font-size: 13.5px;">${netoDisplay}</td>
                    <td style="text-align: center;">${badgeEstado}</td>
                    <td style="text-align: center;">${switchPago}</td>
                    <td style="text-align: center;">${btnRecibo}</td>
                </tr>
            `;
        });

        cardsHtml += `
            <div class="report-card-demarcada" style="margin-bottom: 24px;">
                <div class="table-responsive" style="margin: 0; border: none;">
                    <table class="table-reporte-demarcada" style="font-size: 12px; width: 100%;">
                        <thead>
                            <tr>
                                <th colspan="12" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; font-size: 14px; font-weight: 800; text-align: left; padding: 11px 14px; letter-spacing: 0.03em;">
                                    <i class="fa-solid fa-building-columns" style="color: #bae6fd; margin-right: 8px;"></i> BANCO: ${bancoNombre.toUpperCase()}
                                </th>
                            </tr>
                            <tr style="background: #f1f5f9; color: #334155; font-weight: 800;">
                                <th style="text-align: left;">FINCA</th>
                                <th style="text-align: left;">PROPIETARIO</th>
                                <th>C.I. / RIF</th>
                                <th>N° DE CUENTA</th>
                                <th style="text-align: right;">LITROS</th>
                                <th style="text-align: right;">PRECIO</th>
                                <th style="text-align: right;">TOTAL ($)</th>
                                <th style="text-align: right;">ADELANTO (BS)</th>
                                <th style="text-align: right;">NETO A PAGAR (BS)</th>
                                <th style="text-align: center;">ESTADO</th>
                                <th style="text-align: center;">¿PAGADO?</th>
                                <th style="text-align: center;">RECIBO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: 800; color: #0f172a;">
                                <td colspan="4" class="text-left">SUBTOTAL ${bancoNombre.toUpperCase()}</td>
                                <td style="text-align: right;">${formatearNumero(subLitros)} L</td>
                                <td>&nbsp;</td>
                                <td style="text-align: right; color: #2563eb;">$${formatearNumero(subUSD, 2)}</td>
                                <td style="text-align: right; color: #ef4444;">- Bs. ${formatearNumero(subAdelBs, 2)}</td>
                                <td style="text-align: right; color: #047857; font-size: 14px;">Bs. ${formatearNumero(subNetoBs, 2)}</td>
                                <td colspan="3">&nbsp;</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="margin-bottom: 16px; background: #0f172a; color: #fff; padding: 14px 20px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #38bdf8;"><i class="fa-solid fa-money-check-dollar"></i> RELACIÓN DE PAGOS A FINCAS / LIQUIDACIÓN BANCARIA</h3>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #94a3b8;">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)} | Tasa BCV: Bs. ${formatearNumero(state.tasaBcv || 798.3260, 4)}</p>
            </div>
            <div style="display: flex; gap: 16px; align-items: center;">
                <div style="text-align: right;">
                    <span style="font-size: 11px; color: #94a3b8; display: block;">GRAN TOTAL LITROS:</span>
                    <strong style="font-size: 15px; color: #38bdf8;">${formatearNumero(grandTotalLitros)} Lts</strong>
                </div>
                <div style="text-align: right; border-left: 1px solid #334155; padding-left: 16px;">
                    <span style="font-size: 11px; color: #94a3b8; display: block;">GRAN TOTAL A PAGAR (BS):</span>
                    <strong style="font-size: 17px; color: #4ade80;">Bs. ${formatearNumero(grandTotalNetoBs, 2)}</strong>
                </div>
            </div>
        </div>
        ${cardsHtml}
    `;
}
window.renderReporteBancos = renderReporteBancos;

function renderReporteRelacionCompanias(data, fechaDesde, fechaHasta) {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    // Excluir Receptoría (no es una compañía compradora)
    const companiasValidas = (data || []).filter(comp => {
        const cNom = (comp.companiaNombre || comp.CompaniaNombre || '').toUpperCase();
        return !cNom.includes('RECEPTORIA') && !cNom.includes('RECEPTORÍA');
    });

    if (!companiasValidas || companiasValidas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-building" style="font-size: 32px; margin-bottom: 10px; display: block; color: #94a3b8;"></i>
                No se encontraron entregas ni relaciones de pago de compañías en el rango seleccionado (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}).
            </div>
        `;
        return;
    }

    // Clasificar compañías por Tipo de Servicio: TRANSPORTE vs RUTA
    const esCompaniaTransporte = (comp) => {
        const tsId = Number(comp.tipoServicioId || comp.TipoServicioId || 1);
        const tsNom = (comp.tipoServicioNombre || comp.TipoServicioNombre || '').toUpperCase();
        const cNom = (comp.companiaNombre || comp.CompaniaNombre || '').toUpperCase();
        return tsId === 2 || tsNom.includes('TRANSPORTE') || cNom.includes('COLONA') || cNom.includes('TRANSPORTE');
    };

    const companiasTransporte = companiasValidas.filter(c => esCompaniaTransporte(c));
    const companiasRuta = companiasValidas.filter(c => !esCompaniaTransporte(c));

    function procesarGrupoCompanias(lista, esTransporteGrupo, claseFila) {
        let totLitros = 0;
        let totBrutoUSD = 0;
        let totBrutoBs = 0;
        let totAbonosUSD = 0;
        let totAbonosBs = 0;
        let totNetoBs = 0;
        let totNetoUSD = 0;
        let totLtsVaca = 0;
        let totValVacaUSD = 0;
        let totLtsBufala = 0;
        let totValBufalaUSD = 0;
        let totLtsAcida = 0;
        let totValAcidaUSD = 0;
        let rowsHtml = '';

        lista.forEach((comp, idx) => {
            const cId = comp.companiaId || comp.CompaniaId;
            const cNom = comp.companiaNombre || comp.CompaniaNombre || 'COMPAÑÍA';
            const enc = comp.encargado || comp.Encargado || '-';
            const tel = comp.telefono || comp.Telefono || '-';
            const litros = comp.totalLitros || comp.TotalLitros || 0;
            const brutoUSD = comp.totalUSD || comp.TotalUSD || 0;
            const brutoBs = comp.totalBrutoBs || comp.TotalBrutoBs || 0;
            const abonosUSD = comp.totalAbonosUSD || comp.TotalAbonosUSD || 0;
            const abonosBs = comp.totalAbonosBs || comp.TotalAbonosBs || 0;
            const netoBs = comp.totalNetoBs || comp.TotalNetoBs || 0;
            const netoUSD = comp.totalNetoUSD || comp.TotalNetoUSD || 0;
            const tasa = comp.tasaBcv || comp.TasaBcv || state.tasaBcv || 791.3248;
            const entregas = comp.entregasDetalle || comp.EntregasDetalle || [];

            totBrutoUSD += brutoUSD;
            totBrutoBs += brutoBs;
            totAbonosUSD += abonosUSD;
            totAbonosBs += abonosBs;
            totNetoBs += netoBs;
            totNetoUSD += netoUSD;

            const compCat = (state.companias || []).find(cat => cat.id === cId) || {};
            const pVaca = Number(comp.precioLitroUSD || comp.PrecioLitroUSD || compCat.precioCompraLitroUSD || (esTransporteGrupo ? 0.1000 : 0));
            const pBufala = Number(comp.precioBufalaLitroUSD || comp.PrecioBufalaLitroUSD || compCat.precioBufalaLitroUSD || (esTransporteGrupo ? 0.1000 : pVaca));
            const pAcida = Number(comp.precioAcidaLitroUSD || comp.PrecioAcidaLitroUSD || compCat.precioAcidaLitroUSD || 0);

            // Desglose por tipo de leche y leche ácida
            let ltsVaca = 0;
            let ltsBufala = 0;
            let ltsAcida = 0;

            entregas.forEach(e => {
                const eLts = Number(e.litros || e.Litros || 0);
                const obs = (e.observacion || e.Observacion || '').toUpperCase();
                const tipo = (e.tipoLeche || e.TipoLeche || '').toUpperCase();
                const esBufala = tipo.includes('BUFAL');
                const esAcida = !esBufala && (tipo.includes('ACID') || tipo.includes('ÁCID') || tipo.includes('MALA') || (tipo !== 'VACA' && (obs.includes('[ACIDA]') || obs.includes('[LECHE ÁCIDA]'))));

                if (esAcida) {
                    ltsAcida += eLts;
                } else if (esBufala) {
                    ltsBufala += eLts;
                } else {
                    ltsVaca += eLts;
                }
            });

            if (entregas.length === 0 && litros > 0) {
                if (cNom.toUpperCase().includes('BUFAL')) {
                    ltsBufala = litros;
                } else {
                    ltsVaca = litros;
                }
            }

            const totalLitrosFisicos = (entregas && entregas.length > 0) ? (ltsVaca + ltsBufala + ltsAcida) : litros;

            const valVacaUSD = ltsVaca * pVaca;
            const valBufalaUSD = ltsBufala * pBufala;
            const valAcidaUSD = ltsAcida * pAcida;

            totLitros += totalLitrosFisicos;
            totLtsVaca += ltsVaca;
            totValVacaUSD += valVacaUSD;
            totLtsBufala += ltsBufala;
            totValBufalaUSD += valBufalaUSD;
            totLtsAcida += ltsAcida;
            totValAcidaUSD += valAcidaUSD;

            let detalleItems = [];
            if (ltsVaca > 0) {
                detalleItems.push(`
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2px 0;">
                        <span style="color: #166534; font-weight: 700; font-size: 11.5px; white-space: nowrap;">
                            <i class="fa-solid fa-cow" style="color: #16a34a; font-size: 11px;"></i> Vaca: <strong>${formatearNumero(ltsVaca)} L</strong> <span style="color: #64748b; font-weight: 500; font-size: 10px;">($${formatearNumero(pVaca, 4)})</span>
                        </span>
                        <span style="color: ${esTransporteGrupo ? '#7e22ce' : '#0f172a'}; font-weight: 800; font-size: 11.5px; white-space: nowrap;">$${formatearNumero(valVacaUSD, 2)}</span>
                    </div>
                `);
            }
            if (ltsBufala > 0) {
                detalleItems.push(`
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2px 0;">
                        <span style="color: #86198f; font-weight: 700; font-size: 11.5px; white-space: nowrap;">
                            <i class="fa-solid fa-gem" style="color: #c026d3; font-size: 11px;"></i> Búfala: <strong>${formatearNumero(ltsBufala)} L</strong> <span style="color: #64748b; font-weight: 500; font-size: 10px;">($${formatearNumero(pBufala, 4)})</span>
                        </span>
                        <span style="color: ${esTransporteGrupo ? '#7e22ce' : '#0f172a'}; font-weight: 800; font-size: 11.5px; white-space: nowrap;">$${formatearNumero(valBufalaUSD, 2)}</span>
                    </div>
                `);
            } else if (ltsVaca > 0 && pBufala > 0) {
                detalleItems.push(`
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; opacity: 0.7; padding: 1px 0;">
                        <span style="color: #64748b; font-size: 10.5px; white-space: nowrap;">
                            <i class="fa-solid fa-gem" style="font-size: 9.5px; color: #cbd5e1;"></i> Búfala: 0 L <span style="font-size: 9.5px;">($${formatearNumero(pBufala, 4)})</span>
                        </span>
                        <span style="color: #94a3b8; font-size: 10.5px;">$0,00</span>
                    </div>
                `);
            }
            if (ltsAcida > 0) {
                detalleItems.push(`
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 5px; padding: 3px 6px; margin: 1px 0;">
                        <span style="color: #e11d48; font-weight: 800; font-size: 11px; white-space: nowrap;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Ácida: <strong>${formatearNumero(ltsAcida)} L</strong> <span style="color: #881337; font-weight: 500; font-size: 10px;">($${formatearNumero(pAcida, 4)})</span>
                        </span>
                        <span style="color: #e11d48; font-weight: 800; font-size: 11px; white-space: nowrap;">$${formatearNumero(valAcidaUSD, 2)}</span>
                    </div>
                `);
            }

            let detalleHtml = detalleItems.length > 0
                ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; gap: 3px;">
                    ${detalleItems.join('')}
                    <div style="border-top: 1.5px dashed #cbd5e1; margin-top: 4px; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800;">
                        <span style="color: #475569; text-transform: uppercase; font-size: 10px;">${esTransporteGrupo ? 'Total Flete a Cobrar:' : 'Total a Pagar:'}</span>
                        <span style="font-size: 12.5px; font-weight: 800; color: ${esTransporteGrupo ? '#7e22ce' : '#059669'};">$${formatearNumero(netoUSD, 2)}</span>
                    </div>
                   </div>`
                : '<span style="color: #94a3b8; font-size: 11px;">-</span>';

            const btnVerEntregas = entregas.length > 0 
                ? `<button type="button" class="btn btn-outline" onclick="abrirModalDetalleEntregasCompania(${cId})" style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.04);"><i class="fa-solid fa-list-check"></i> ${entregas.length} Entregas</button>`
                : '<span style="color: #94a3b8; font-size: 11px;">Sin entregas</span>';

            const escapedCompNom = (cNom || '').replace(/'/g, "\\'");

            const diaApertura = comp.diaAperturaSemana || comp.DiaAperturaSemana || compCat.diaAperturaSemana || 'Martes';
            const diaCierre = comp.diaCierreSemana || comp.DiaCierreSemana || compCat.diaCierreSemana || 'Lunes';

            rowsHtml += `
                <tr class="${claseFila}">
                    <td class="text-left" style="font-weight: 700; min-width: 175px;">
                        <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${cNom}</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                            ${esTransporteGrupo ? '<span style="background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; font-size: 10px; font-weight: 800; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-truck"></i> TRANSPORTE</span>' : '<span style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 10px; font-weight: 800; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-road"></i> RUTA PROPIA</span>'}
                            <span style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 700; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Ciclo operativo de la compañía">
                                <i class="fa-solid fa-calendar-week" style="color: #64748b; font-size: 9px;"></i> ${diaApertura} a ${diaCierre}
                            </span>
                            <span style="background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; font-size: 10px; font-weight: 800; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Día de Cierre Semanal">
                                <i class="fa-solid fa-flag-checkered" style="color: #e11d48; font-size: 9px;"></i> Cierre: ${diaCierre}
                            </span>
                        </div>
                    </td>
                    <td class="text-left" style="color: #475569; font-size: 12px; min-width: 130px;">
                        <strong style="color: #1e293b; font-size: 12.5px;">${enc}</strong>
                        ${tel !== '-' ? `<br><span style="color:#64748b; font-size: 11px;"><i class="fa-solid fa-phone" style="font-size: 9.5px; color: #94a3b8;"></i> ${tel}</span>` : ''}
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 14px; color: ${esTransporteGrupo ? '#7e22ce' : '#0f172a'}; min-width: 95px;">
                        ${formatearNumero(totalLitrosFisicos)} <small style="color: #64748b; font-weight: 600; font-size: 11px;">L</small>
                        ${ltsAcida > 0 ? `<div style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px;">(${formatearNumero(ltsVaca + ltsBufala)} L Buena + <span style="color:#e11d48; font-weight:700;">${formatearNumero(ltsAcida)} L Ácida</span>)</div>` : ''}
                    </td>
                    <td style="text-align: right; min-width: 175px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">
                            <div style="display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; max-width: 160px; padding: 2.5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;" title="Precio Leche Vaca pactado">
                                <span><i class="fa-solid fa-cow" style="font-size: 10px; color: #16a34a;"></i> Vaca:</span>
                                <strong style="font-size: 11.5px;">$${formatearNumero(pVaca, 4)}</strong>
                            </div>
                            <div style="display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; max-width: 160px; padding: 2.5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff;" title="Precio Leche Búfala pactado">
                                <span><i class="fa-solid fa-gem" style="font-size: 10px; color: #a855f7;"></i> Búfala:</span>
                                <strong style="font-size: 11.5px;">$${formatearNumero(pBufala, 4)}</strong>
                            </div>
                            ${pAcida > 0 ? `
                            <div style="display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; max-width: 160px; padding: 2.5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #fff1f2; color: #be123c; border: 1px solid #fecdd3;" title="Precio Leche Ácida pactado">
                                <span><i class="fa-solid fa-triangle-exclamation" style="font-size: 9.5px; color: #e11d48;"></i> Ácida:</span>
                                <strong style="font-size: 11.5px;">$${formatearNumero(pAcida, 4)}</strong>
                            </div>
                            ` : ''}
                            <button type="button" class="btn btn-xs" 
                                onclick="abrirModalActualizarPrecioCompania(${cId}, '${escapedCompNom}', ${pVaca}, ${pBufala}, ${pAcida}, ${esTransporteGrupo})"
                                title="Modificar tarifas pactadas de ${escapedCompNom}"
                                style="padding: 3px 8px; font-size: 11px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                                <i class="fa-solid fa-pen-to-square"></i> Ajustar
                            </button>
                        </div>
                    </td>
                    <td class="text-left" style="min-width: 240px; padding: 8px 10px;">${detalleHtml}</td>
                    <td style="text-align: right; font-weight: 700; color: ${esTransporteGrupo ? '#7e22ce' : '#0f172a'}; font-size: 13.5px; min-width: 105px;">$${formatearNumero(brutoUSD, 2)}</td>
                    <td style="text-align: right; font-weight: 600; color: #475569; font-size: 12.5px; min-width: 120px;">Bs. ${formatearNumero(brutoBs, 2)}</td>
                    <td style="text-align: right; color: ${abonosUSD > 0 || abonosBs > 0 ? '#ef4444' : '#94a3b8'}; font-weight: 700; min-width: 95px;">
                        ${abonosUSD > 0 ? `<span style="color:#ef4444;">-$${formatearNumero(abonosUSD, 2)}</span><br>` : ''}
                        ${abonosBs > 0 ? `<span style="color:#dc2626;">-Bs. ${formatearNumero(abonosBs, 2)}</span>` : (abonosUSD <= 0 ? '-' : '')}
                    </td>
                    <td style="text-align: right; font-weight: 900; color: ${esTransporteGrupo ? '#7e22ce' : '#15803d'}; font-size: 14px; background: ${esTransporteGrupo ? 'rgba(168, 85, 247, 0.05)' : 'rgba(34, 197, 94, 0.05)'}; min-width: 125px;">Bs. ${formatearNumero(netoBs, 2)}</td>
                    <td style="text-align: right; font-weight: 900; color: ${esTransporteGrupo ? '#7e22ce' : '#047857'}; font-size: 14px; background: ${esTransporteGrupo ? 'rgba(168, 85, 247, 0.05)' : 'rgba(34, 197, 94, 0.05)'}; min-width: 105px;">$${formatearNumero(netoUSD, 2)}</td>
                    <td style="text-align: center; min-width: 110px;">${btnVerEntregas}</td>
                </tr>
            `;
        });

        let detalleFooterHtml = `
            <div style="background: rgba(255,255,255,0.85); border: 1px solid ${esTransporteGrupo ? '#d8b4fe' : '#bbf7d0'}; border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
                ${totLtsVaca > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: ${esTransporteGrupo ? '#7e22ce' : '#166534'}; font-weight: 700;"><i class="fa-solid fa-cow"></i> Vaca: <strong>${formatearNumero(totLtsVaca)} L</strong></span>
                        <strong style="color: #0f172a; font-size: 11.5px;">$${formatearNumero(totValVacaUSD, 2)}</strong>
                    </div>
                ` : ''}
                ${totLtsBufala > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: #86198f; font-weight: 700;"><i class="fa-solid fa-gem"></i> Búfala: <strong>${formatearNumero(totLtsBufala)} L</strong></span>
                        <strong style="color: #0f172a; font-size: 11.5px;">$${formatearNumero(totValBufalaUSD, 2)}</strong>
                    </div>
                ` : ''}
                ${totLtsAcida > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: #e11d48; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Ácida: <strong>${formatearNumero(totLtsAcida)} L</strong></span>
                        <strong style="color: #0f172a; font-size: 11.5px;">$${formatearNumero(totValAcidaUSD, 2)}</strong>
                    </div>
                ` : ''}
                <div style="border-top: 1px dashed ${esTransporteGrupo ? '#d8b4fe' : '#bbf7d0'}; margin-top: 3px; padding-top: 3px; display: flex; justify-content: space-between; align-items: center; font-weight: 800;">
                    <span style="color: #475569; text-transform: uppercase; font-size: 10px;">${esTransporteGrupo ? 'Subtotal Flete:' : 'Subtotal Facturado:'}</span>
                    <span style="font-size: 12px; color: ${esTransporteGrupo ? '#7e22ce' : '#047857'}; font-weight: 900;">$${formatearNumero(totNetoUSD, 2)}</span>
                </div>
            </div>
        `;

        return {
            totLitros,
            totBrutoUSD,
            totBrutoBs,
            totAbonosUSD,
            totAbonosBs,
            totNetoBs,
            totNetoUSD,
            totLtsVaca,
            totValVacaUSD,
            totLtsBufala,
            totValBufalaUSD,
            totLtsAcida,
            totValAcidaUSD,
            rowsHtml,
            detalleFooterHtml,
            cantidad: lista.length
        };
    }

    const grupoTransporte = procesarGrupoCompanias(companiasTransporte, true, 'fila-item-transporte');
    const grupoRuta = procesarGrupoCompanias(companiasRuta, false, 'fila-item-ruta');

    const grandTotalLitros = grupoTransporte.totLitros + grupoRuta.totLitros;
    const grandTotalBrutoUSD = grupoTransporte.totBrutoUSD + grupoRuta.totBrutoUSD;
    const grandTotalBrutoBs = grupoTransporte.totBrutoBs + grupoRuta.totBrutoBs;
    const grandTotalAbonosUSD = grupoTransporte.totAbonosUSD + grupoRuta.totAbonosUSD;
    const grandTotalAbonosBs = grupoTransporte.totAbonosBs + grupoRuta.totAbonosBs;
    const grandTotalNetoBs = grupoTransporte.totNetoBs + grupoRuta.totNetoBs;
    const grandTotalNetoUSD = grupoTransporte.totNetoUSD + grupoRuta.totNetoUSD;
    const grandTotalLtsVaca = grupoTransporte.totLtsVaca + grupoRuta.totLtsVaca;
    const grandTotalValVacaUSD = grupoTransporte.totValVacaUSD + grupoRuta.totValVacaUSD;
    const grandTotalLtsBufala = grupoTransporte.totLtsBufala + grupoRuta.totLtsBufala;
    const grandTotalValBufalaUSD = grupoTransporte.totValBufalaUSD + grupoRuta.totValBufalaUSD;
    const grandTotalLtsAcida = grupoTransporte.totLtsAcida + grupoRuta.totLtsAcida;
    const grandTotalValAcidaUSD = grupoTransporte.totValAcidaUSD + grupoRuta.totValAcidaUSD;

    let granDetalleFooterHtml = `
        <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; font-size: 11.5px;">
            ${grandTotalLtsVaca > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <span style="color: #86efac; font-weight: 700;"><i class="fa-solid fa-cow"></i> Vaca: <strong>${formatearNumero(grandTotalLtsVaca)} L</strong></span>
                    <strong style="color: #ffffff; font-size: 12px;">$${formatearNumero(grandTotalValVacaUSD, 2)}</strong>
                </div>
            ` : ''}
            ${grandTotalLtsBufala > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <span style="color: #f0abfc; font-weight: 700;"><i class="fa-solid fa-gem"></i> Búfala: <strong>${formatearNumero(grandTotalLtsBufala)} L</strong></span>
                    <strong style="color: #ffffff; font-size: 12px;">$${formatearNumero(grandTotalValBufalaUSD, 2)}</strong>
                </div>
            ` : ''}
            ${grandTotalLtsAcida > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <span style="color: #fda4af; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Ácida: <strong>${formatearNumero(grandTotalLtsAcida)} L</strong></span>
                    <strong style="color: #ffffff; font-size: 12px;">$${formatearNumero(grandTotalValAcidaUSD, 2)}</strong>
                </div>
            ` : ''}
            <div style="border-top: 1px dashed rgba(255,255,255,0.25); margin-top: 3px; padding-top: 3px; display: flex; justify-content: space-between; align-items: center; font-weight: 800;">
                <span style="color: #fde047; text-transform: uppercase; font-size: 10.5px;">Total Facturado:</span>
                <span style="font-size: 13.5px; color: #67e8f9; font-weight: 900;">$${formatearNumero(grandTotalNetoUSD, 2)}</span>
            </div>
        </div>
    `;

    // Construir cuerpo de la tabla con bloques separados
    let tbodyHtml = '';

    // 1. BLOQUE TRANSPORTE
    if (grupoTransporte.cantidad > 0) {
        tbodyHtml += `
            <tr class="fila-bloque-transporte" style="background: linear-gradient(90deg, #4c1d95 0%, #6b21a8 50%, #7e22ce 100%); color: #ffffff;">
                <td colspan="11" style="padding: 11px 16px; border: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 13.5px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-truck-fast" style="color: #f0abfc; font-size: 15px;"></i> SERVICIO DE TRANSPORTE (${grupoTransporte.cantidad} ${grupoTransporte.cantidad === 1 ? 'Compañía' : 'Compañías'})
                        </span>
                        <span style="font-size: 11.5px; background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 6px; font-weight: 700; color: #fdf4ff;">
                            <i class="fa-solid fa-receipt"></i> Fletes por traslado de leche a plantas
                        </span>
                    </div>
                </td>
            </tr>
            ${grupoTransporte.rowsHtml}
            <tr class="fila-subtotal-transporte" style="background: #faf5ff; font-weight: 800; border-top: 2px solid #d8b4fe; border-bottom: 2px solid #c084fc;">
                <td colspan="2" class="text-left" style="color: #6b21a8; font-weight: 900; padding: 10px 16px;">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <i class="fa-solid fa-calculator" style="color: #9333ea; font-size: 14px;"></i>
                        <span style="font-size: 13px;">SUBTOTAL TRANSPORTE (${grupoTransporte.cantidad})</span>
                    </div>
                </td>
                <td style="text-align: right; color: #7e22ce; font-weight: 900; font-size: 14.5px;">
                    ${formatearNumero(grupoTransporte.totLitros)} L
                </td>
                <td style="text-align: center; color: #9333ea; font-size: 11px;">
                    <span style="background: rgba(126,34,206,0.12); color: #7e22ce; padding: 3px 8px; border-radius: 5px; font-weight: 800;"><i class="fa-solid fa-tags"></i> Flete Pactado</span>
                </td>
                <td class="text-left" style="padding: 8px 10px;">${grupoTransporte.detalleFooterHtml}</td>
                <td style="text-align: right; color: #7e22ce; font-size: 13.5px; font-weight: 800;">$${formatearNumero(grupoTransporte.totBrutoUSD, 2)}</td>
                <td style="text-align: right; color: #6b21a8; font-size: 12px; font-weight: 700;">Bs. ${formatearNumero(grupoTransporte.totBrutoBs, 2)}</td>
                <td style="text-align: right; color: #ef4444; font-weight: 800;">
                    ${grupoTransporte.totAbonosUSD > 0 ? `-$${formatearNumero(grupoTransporte.totAbonosUSD, 2)}<br>` : ''}
                    ${grupoTransporte.totAbonosBs > 0 ? `-Bs. ${formatearNumero(grupoTransporte.totAbonosBs, 2)}` : (grupoTransporte.totAbonosUSD <= 0 ? '-' : '')}
                </td>
                <td style="text-align: right; font-weight: 900; color: #7e22ce; font-size: 14.5px; background: rgba(168,85,247,0.1);">Bs. ${formatearNumero(grupoTransporte.totNetoBs, 2)}</td>
                <td style="text-align: right; font-weight: 900; color: #7e22ce; font-size: 14.5px; background: rgba(168,85,247,0.1);">$${formatearNumero(grupoTransporte.totNetoUSD, 2)}</td>
                <td style="text-align: center; font-size: 11.5px; color: #7e22ce; font-weight: 800;">${grupoTransporte.cantidad} Cías</td>
            </tr>
        `;
    }

    // 2. BLOQUE RUTA
    if (grupoRuta.cantidad > 0) {
        tbodyHtml += `
            <tr class="fila-bloque-ruta" style="background: linear-gradient(90deg, #064e3b 0%, #047857 50%, #059669 100%); color: #ffffff;">
                <td colspan="11" style="padding: 11px 16px; border: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 13.5px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; color: #ffffff;">
                            <i class="fa-solid fa-road" style="color: #a7f3d0; font-size: 15px;"></i> SERVICIO DE RUTA / VENTA DE LECHE PROPIA (${grupoRuta.cantidad} ${grupoRuta.cantidad === 1 ? 'Compañía' : 'Compañías'})
                        </span>
                        <span style="font-size: 11.5px; background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 6px; font-weight: 700; color: #ecfdf5;">
                            <i class="fa-solid fa-bottle-droplet"></i> Leche recolectada en rutas vendida a plantas
                        </span>
                    </div>
                </td>
            </tr>
            ${grupoRuta.rowsHtml}
            <tr class="fila-subtotal-ruta" style="background: #f0fdf4; font-weight: 800; border-top: 2px solid #86efac; border-bottom: 2px solid #22c55e;">
                <td colspan="2" class="text-left" style="color: #065f46; font-weight: 900; padding: 10px 16px;">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <i class="fa-solid fa-calculator" style="color: #10b981; font-size: 14px;"></i>
                        <span style="font-size: 13px;">SUBTOTAL RUTA (${grupoRuta.cantidad})</span>
                    </div>
                </td>
                <td style="text-align: right; color: #047857; font-weight: 900; font-size: 14.5px;">
                    ${formatearNumero(grupoRuta.totLitros)} L
                </td>
                <td style="text-align: center; color: #059669; font-size: 11px;">
                    <span style="background: rgba(16,185,129,0.12); color: #047857; padding: 3px 8px; border-radius: 5px; font-weight: 800;"><i class="fa-solid fa-tags"></i> Precios Leche</span>
                </td>
                <td class="text-left" style="padding: 8px 10px;">${grupoRuta.detalleFooterHtml}</td>
                <td style="text-align: right; color: #047857; font-size: 13.5px; font-weight: 800;">$${formatearNumero(grupoRuta.totBrutoUSD, 2)}</td>
                <td style="text-align: right; color: #065f46; font-size: 12px; font-weight: 700;">Bs. ${formatearNumero(grupoRuta.totBrutoBs, 2)}</td>
                <td style="text-align: right; color: #ef4444; font-weight: 800;">
                    ${grupoRuta.totAbonosUSD > 0 ? `-$${formatearNumero(grupoRuta.totAbonosUSD, 2)}<br>` : ''}
                    ${grupoRuta.totAbonosBs > 0 ? `-Bs. ${formatearNumero(grupoRuta.totAbonosBs, 2)}` : (grupoRuta.totAbonosUSD <= 0 ? '-' : '')}
                </td>
                <td style="text-align: right; font-weight: 900; color: #047857; font-size: 14.5px; background: rgba(34,197,94,0.1);">Bs. ${formatearNumero(grupoRuta.totNetoBs, 2)}</td>
                <td style="text-align: right; font-weight: 900; color: #047857; font-size: 14.5px; background: rgba(34,197,94,0.1);">$${formatearNumero(grupoRuta.totNetoUSD, 2)}</td>
                <td style="text-align: center; font-size: 11.5px; color: #047857; font-weight: 800;">${grupoRuta.cantidad} Cías</td>
            </tr>
        `;
    }

    container.innerHTML = `
        <!-- HEADER DEL REPORTE -->
        <div style="margin-bottom: 16px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 18px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);">
            <div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-building"></i> RELACIÓN DE PAGOS DE COMPAÑÍAS / PLANTAS
                </h3>
                <p style="margin: 4px 0 0 0; font-size: 12.5px; color: #cbd5e1;">
                    Período: <strong>${formatearFechaLocal(fechaDesde)}</strong> al <strong>${formatearFechaLocal(fechaHasta)}</strong> | Tasa BCV: <strong>Bs. ${formatearNumero(state.tasaBcv || 791.3248, 4)}</strong>
                </p>
                <div style="margin-top: 8px;">
                    <button type="button" class="btn btn-sm" onclick="abrirModalHistorialPrecios()" style="background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                        <i class="fa-solid fa-clock-rotate-left" style="color: #38bdf8;"></i> Ver Historial de Precios (Log)
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                <div style="text-align: right;">
                    <span style="font-size: 11px; color: #94a3b8; display: block; font-weight: 600;">TOTAL LITROS RECIBIDOS:</span>
                    <strong style="font-size: 16px; color: #38bdf8;">${formatearNumero(grandTotalLitros)} Lts</strong>
                </div>
                <div style="text-align: right; border-left: 1px solid #334155; padding-left: 16px;">
                    <span style="font-size: 11px; color: #94a3b8; display: block; font-weight: 600;">TOTAL NETO ($):</span>
                    <strong style="font-size: 16px; color: #2dd4bf;">$ ${formatearNumero(grandTotalNetoUSD, 2)}</strong>
                </div>
                <div style="text-align: right; border-left: 1px solid #334155; padding-left: 16px;">
                    <span style="font-size: 11px; color: #94a3b8; display: block; font-weight: 600;">TOTAL NETO A PAGAR / COBRAR (BS):</span>
                    <strong style="font-size: 18px; color: #4ade80;">Bs. ${formatearNumero(grandTotalNetoBs, 2)}</strong>
                </div>
            </div>
        </div>

        <!-- TARJETAS DE RESUMEN SEPARADO POR TIPO DE SERVICIO (TRANSPORTE Y RUTA) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 16px;">
            <!-- SERVICIO DE TRANSPORTE -->
            <div style="background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%); border: 1.5px solid #d8b4fe; border-radius: 12px; padding: 14px 18px; box-shadow: 0 2px 8px rgba(168,85,247,0.08);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="background: #7e22ce; color: #fff; font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-truck"></i> TRANSPORTE (${grupoTransporte.cantidad})
                    </span>
                    <span style="font-size: 11px; color: #7e22ce; font-weight: 700;">Servicio de Fletes</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <span style="font-size: 11px; color: #6b21a8; font-weight: 600; display: block;">Litros Flete:</span>
                        <strong style="font-size: 16px; color: #581c87; font-weight: 900;">${formatearNumero(grupoTransporte.totLitros)} Lts</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 11px; color: #6b21a8; font-weight: 600; display: block;">Flete Neto ($):</span>
                        <strong style="font-size: 16px; color: #7e22ce; font-weight: 900;">$ ${formatearNumero(grupoTransporte.totNetoUSD, 2)}</strong>
                        <div style="font-size: 11.5px; color: #9333ea; font-weight: 700;">Bs. ${formatearNumero(grupoTransporte.totNetoBs, 2)}</div>
                    </div>
                </div>
            </div>

            <!-- SERVICIO DE RUTA -->
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-radius: 12px; padding: 14px 18px; box-shadow: 0 2px 8px rgba(34,197,94,0.08);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="background: #059669; color: #fff; font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-road"></i> RUTA PROPIA (${grupoRuta.cantidad})
                    </span>
                    <span style="font-size: 11px; color: #047857; font-weight: 700;">Venta de Leche</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <span style="font-size: 11px; color: #065f46; font-weight: 600; display: block;">Litros Vendidos:</span>
                        <strong style="font-size: 16px; color: #064e3b; font-weight: 900;">${formatearNumero(grupoRuta.totLitros)} Lts</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 11px; color: #065f46; font-weight: 600; display: block;">Total Neto ($):</span>
                        <strong style="font-size: 16px; color: #059669; font-weight: 900;">$ ${formatearNumero(grupoRuta.totNetoUSD, 2)}</strong>
                        <div style="font-size: 11.5px; color: #047857; font-weight: 700;">Bs. ${formatearNumero(grupoRuta.totNetoBs, 2)}</div>
                    </div>
                </div>
            </div>

            <!-- TOTAL CONSOLIDADO -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; border-radius: 12px; padding: 14px 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="background: rgba(56,189,248,0.2); color: #38bdf8; border: 1px solid rgba(56,189,248,0.4); font-size: 10.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-calculator"></i> CONSOLIDADO GENERAL
                    </span>
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 700;">${companiasValidas.length} Compañías</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 600; display: block;">Litros Globales:</span>
                        <strong style="font-size: 16px; color: #38bdf8; font-weight: 900;">${formatearNumero(grandTotalLitros)} Lts</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 600; display: block;">Total Global ($):</span>
                        <strong style="font-size: 16px; color: #2dd4bf; font-weight: 900;">$ ${formatearNumero(grandTotalNetoUSD, 2)}</strong>
                        <div style="font-size: 11.5px; color: #4ade80; font-weight: 800;">Bs. ${formatearNumero(grandTotalNetoBs, 2)}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- BARRA DE PESTAÑAS / FILTRO RÁPIDO POR TIPO DE SERVICIO -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <div style="display: inline-flex; background: #e2e8f0; padding: 3px; border-radius: 8px; gap: 3px;">
                <button type="button" id="btnTabServTodos" onclick="filtrarVistaServicioCompania('TODOS')" style="padding: 6px 14px; font-size: 12px; font-weight: 800; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: #0f172a; color: #ffffff;">
                    <i class="fa-solid fa-layer-group"></i> Todos (${companiasValidas.length})
                </button>
                <button type="button" id="btnTabServTransp" onclick="filtrarVistaServicioCompania('TRANSPORTE')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: transparent; color: #475569;">
                    <i class="fa-solid fa-truck" style="color: #7e22ce;"></i> Solo Transporte (${grupoTransporte.cantidad})
                </button>
                <button type="button" id="btnTabServRuta" onclick="filtrarVistaServicioCompania('RUTA')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: transparent; color: #475569;">
                    <i class="fa-solid fa-road" style="color: #059669;"></i> Solo Ruta (${grupoRuta.cantidad})
                </button>
            </div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600;">
                <i class="fa-solid fa-circle-info" style="color: #3b82f6;"></i> Información desglosada y separada por tipo de servicio
            </div>
        </div>

        <!-- TABLA PRINCIPAL DE RELACION DE COMPAÑIAS -->
        <div class="report-card-demarcada" style="margin-bottom: 24px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1;">
            <div class="table-responsive" style="margin: 0; border: none; overflow-x: auto;">
                <table class="table-reporte-demarcada" style="font-size: 12px; width: 100%; border-collapse: separate; border-spacing: 0;">
                    <thead>
                        <tr>
                            <th style="text-align: left; min-width: 170px;">COMPAÑÍA / PLANTA</th>
                            <th style="text-align: left; min-width: 130px;">ENCARGADO</th>
                            <th style="text-align: right; min-width: 95px;">LITROS</th>
                            <th style="text-align: right; min-width: 175px;">PRECIO PACTADO ($/L)</th>
                            <th style="text-align: left; min-width: 240px;">DETALLE DE ENTREGAS</th>
                            <th style="text-align: right; min-width: 105px;">TOTAL BRUTO ($)</th>
                            <th style="text-align: right; min-width: 120px;">TOTAL BRUTO (BS)</th>
                            <th style="text-align: right; min-width: 95px;">ABONOS / DED.</th>
                            <th style="text-align: right; min-width: 125px; background: #e2e8f0;">NETO (BS)</th>
                            <th style="text-align: right; min-width: 105px; background: #e2e8f0;">NETO ($)</th>
                            <th style="text-align: center; min-width: 110px;">ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tbodyHtml}
                    </tbody>
                    <tfoot style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important; color: #ffffff !important; box-shadow: 0 -2px 10px rgba(0,0,0,0.15);">
                        <tr style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;">
                            <td colspan="2" class="text-left" style="background: transparent !important; padding-left: 16px; border: 1px solid #334155 !important;">
                                <div style="color: #ffffff !important; font-weight: 800; font-size: 13.5px; letter-spacing: 0.03em; display: flex; align-items: center; gap: 8px;">
                                    <i class="fa-solid fa-calculator" style="color: #38bdf8; font-size: 15px;"></i> GRAN TOTAL CONSOLIDADO
                                </div>
                            </td>
                            <td style="background: transparent !important; text-align: right; color: #38bdf8 !important; font-size: 15px; font-weight: 900; border: 1px solid #334155 !important;">
                                ${formatearNumero(grandTotalLitros)} L
                            </td>
                            <td style="background: transparent !important; text-align: center; color: #cbd5e1 !important; font-size: 11.5px; border: 1px solid #334155 !important;">
                                <span style="background: rgba(255,255,255,0.12); padding: 4px 9px; border-radius: 6px; font-weight: 700; color: #e2e8f0; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-tags" style="color: #38bdf8;"></i> Tarifas Activas</span>
                            </td>
                            <td class="text-left" style="background: transparent !important; min-width: 240px; padding: 10px; border: 1px solid #334155 !important;">${granDetalleFooterHtml}</td>
                            <td style="background: transparent !important; text-align: right; color: #ffffff !important; font-size: 14px; font-weight: 800; border: 1px solid #334155 !important;">$${formatearNumero(grandTotalBrutoUSD, 2)}</td>
                            <td style="background: transparent !important; text-align: right; color: #cbd5e1 !important; font-size: 12.5px; font-weight: 700; border: 1px solid #334155 !important;">Bs. ${formatearNumero(grandTotalBrutoBs, 2)}</td>
                            <td style="background: transparent !important; text-align: right; color: #fda4af !important; font-weight: 800; font-size: 12.5px; border: 1px solid #334155 !important;">
                                ${grandTotalAbonosUSD > 0 ? `-$${formatearNumero(grandTotalAbonosUSD, 2)}<br>` : ''}
                                ${grandTotalAbonosBs > 0 ? `-Bs. ${formatearNumero(grandTotalAbonosBs, 2)}` : (grandTotalAbonosUSD <= 0 ? '-' : '')}
                            </td>
                            <td style="background: rgba(34, 197, 94, 0.15) !important; text-align: right; color: #4ade80 !important; font-size: 15px; font-weight: 900; border: 1px solid #334155 !important;">Bs. ${formatearNumero(grandTotalNetoBs, 2)}</td>
                            <td style="background: rgba(14, 165, 233, 0.15) !important; text-align: right; color: #38bdf8 !important; font-size: 15px; font-weight: 900; border: 1px solid #334155 !important;">$${formatearNumero(grandTotalNetoUSD, 2)}</td>
                            <td style="background: transparent !important; text-align: center; color: #cbd5e1 !important; font-size: 11.5px; font-weight: 700; border: 1px solid #334155 !important;">${companiasValidas.length} Compañías</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}
window.renderReporteRelacionCompanias = renderReporteRelacionCompanias;

function filtrarVistaServicioCompania(tipo) {
    const filasTransp = document.querySelectorAll('.fila-bloque-transporte, .fila-item-transporte, .fila-subtotal-transporte');
    const filasRuta = document.querySelectorAll('.fila-bloque-ruta, .fila-item-ruta, .fila-subtotal-ruta');
    const btnTodos = document.getElementById('btnTabServTodos');
    const btnTransp = document.getElementById('btnTabServTransp');
    const btnRuta = document.getElementById('btnTabServRuta');

    [btnTodos, btnTransp, btnRuta].forEach(b => {
        if (b) {
            b.style.background = 'transparent';
            b.style.color = '#475569';
            b.style.fontWeight = '700';
        }
    });

    if (tipo === 'TRANSPORTE') {
        filasTransp.forEach(el => el.style.display = '');
        filasRuta.forEach(el => el.style.display = 'none');
        if (btnTransp) {
            btnTransp.style.background = '#7e22ce';
            btnTransp.style.color = '#ffffff';
            btnTransp.style.fontWeight = '800';
        }
    } else if (tipo === 'RUTA') {
        filasTransp.forEach(el => el.style.display = 'none');
        filasRuta.forEach(el => el.style.display = '');
        if (btnRuta) {
            btnRuta.style.background = '#059669';
            btnRuta.style.color = '#ffffff';
            btnRuta.style.fontWeight = '800';
        }
    } else {
        filasTransp.forEach(el => el.style.display = '');
        filasRuta.forEach(el => el.style.display = '');
        if (btnTodos) {
            btnTodos.style.background = '#0f172a';
            btnTodos.style.color = '#ffffff';
            btnTodos.style.fontWeight = '800';
        }
    }
}
window.filtrarVistaServicioCompania = filtrarVistaServicioCompania;

async function abrirModalActualizarPrecioCompania(companiaId, companiaNombre, precioVacaActual, precioBufalaActual, precioAcidaActual = 0, esTransporte = false) {
    const pVaca = Number(precioVacaActual || 0);
    const pBufala = Number(precioBufalaActual !== undefined && precioBufalaActual !== null ? precioBufalaActual : (esTransporte ? 0.1000 : pVaca));
    const pAcida = Number(precioAcidaActual || 0);

    const { value: formValues } = await Swal.fire({
        title: `
            <div style="font-size: 17px; font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid ${esTransporte ? 'fa-truck-ramp-box' : 'fa-tags'}" style="color: ${esTransporte ? '#7e22ce' : '#2563eb'};"></i> 
                ${esTransporte ? 'Actualizar Tarifas de Flete' : 'Actualizar Precios de Leche'}
            </div>
        `,
        html: `
            <div style="text-align: left; margin-top: 10px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Compañía / Planta</span>
                        <span style="font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 5px; background: ${esTransporte ? '#f3e8ff; color: #7e22ce;' : '#e0f2fe; color: #0284c7;'}">
                            ${esTransporte ? 'TRANSPORTE' : 'RUTA PROPIA'}
                        </span>
                    </div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${companiaNombre}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                    <div>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #1e293b; margin-bottom: 5px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #16a34a;"></span>
                            ${esTransporte ? 'Flete Vaca' : 'Precio Vaca'}:
                        </label>
                        <input id="swalNuevoPrecioVaca" type="text" inputmode="decimal" placeholder="0.0000" value="${pVaca.toFixed(4)}"
                            style="width: 100%; box-sizing: border-box; padding: 8px 6px; font-size: 15px; font-weight: 800; color: #047857; text-align: center; border: 1.5px solid #86efac; border-radius: 8px; outline: none; background: #f0fdf4;" />
                    </div>
                    <div>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #1e293b; margin-bottom: 5px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #7e22ce;"></span>
                            ${esTransporte ? 'Flete Búfala' : 'Precio Búfala'}:
                        </label>
                        <input id="swalNuevoPrecioBufala" type="text" inputmode="decimal" placeholder="0.0000" value="${pBufala.toFixed(4)}"
                            style="width: 100%; box-sizing: border-box; padding: 8px 6px; font-size: 15px; font-weight: 800; color: #7e22ce; text-align: center; border: 1.5px solid #d8b4fe; border-radius: 8px; outline: none; background: #faf5ff;" />
                    </div>
                    <div>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #1e293b; margin-bottom: 5px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e11d48;"></span>
                            ${esTransporte ? 'Flete Ácida' : 'Ácida / Mala'}:
                        </label>
                        <input id="swalNuevoPrecioAcida" type="text" inputmode="decimal" placeholder="0.0000" value="${pAcida.toFixed(4)}"
                            style="width: 100%; box-sizing: border-box; padding: 8px 6px; font-size: 15px; font-weight: 800; color: #e11d48; text-align: center; border: 1.5px solid #fecdd3; border-radius: 8px; outline: none; background: #fff1f2;" />
                    </div>
                </div>

                <div style="margin-bottom: 8px;">
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #64748b; margin-bottom: 4px;">
                        <i class="fa-solid fa-comment-dots"></i> Motivo / Observación (Opcional):
                    </label>
                    <input id="swalObsPrecioCompania" type="text" placeholder="Ej. Ajuste semanal de tarifa pactada"
                        style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12.5px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; background: #ffffff;" />
                </div>
                <div style="font-size: 10.5px; color: #94a3b8; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-shield-halved" style="color: #3b82f6;"></i> Todos los precios se registrarán en el catálogo y en el historial de logs.
                </div>
            </div>
        `,
        width: 520,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Guardar Precios',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        background: '#ffffff',
        color: '#0f172a',
        didOpen: () => {
            const input = document.getElementById('swalNuevoPrecioVaca');
            if (input) {
                input.focus();
                input.select();
            }
        },
        preConfirm: () => {
            const rawVaca = (document.getElementById('swalNuevoPrecioVaca')?.value || '').trim().replace(',', '.');
            const rawBufala = (document.getElementById('swalNuevoPrecioBufala')?.value || '').trim().replace(',', '.');
            const rawAcida = (document.getElementById('swalNuevoPrecioAcida')?.value || '0').trim().replace(',', '.');
            
            const valVaca = parseFloat(rawVaca);
            const valBufala = parseFloat(rawBufala);
            const valAcida = parseFloat(rawAcida) || 0;

            if (isNaN(valVaca) || valVaca < 0) {
                Swal.showValidationMessage('Ingresa una tarifa válida para leche de vaca.');
                return false;
            }
            if (isNaN(valBufala) || valBufala < 0) {
                Swal.showValidationMessage('Ingresa una tarifa válida para leche de búfala.');
                return false;
            }

            const obs = document.getElementById('swalObsPrecioCompania')?.value?.trim() || '';
            return { nuevoPrecioUSD: valVaca, nuevoPrecioBufalaUSD: valBufala, nuevoPrecioAcidaUSD: valAcida, observacion: obs };
        }
    });

    if (!formValues) return;

    try {
        const res = await fetch(`${API_BASE}/catalogos/companias/${companiaId}/precio`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(formValues)
        });

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: '¡Precios Actualizados!',
                html: `Se actualizaron las tarifas de <strong>${companiaNombre}</strong>:<br>
                       <span style="color:#047857; font-weight:800;">Vaca: $${formatearNumero(formValues.nuevoPrecioUSD, 4)}</span> | 
                       <span style="color:#7e22ce; font-weight:800;">Búfala: $${formatearNumero(formValues.nuevoPrecioBufalaUSD, 4)}</span> | 
                       <span style="color:#e11d48; font-weight:800;">Ácida: $${formatearNumero(formValues.nuevoPrecioAcidaUSD, 4)}</span><br>
                       <small style="color:#64748b;">El cuadro ha sido recalculado automáticamente.</small>`,
                timer: 2000,
                showConfirmButton: false,
                background: '#ffffff',
                color: '#0f172a'
            });

            // Actualizar catálogo local si existe
            if (state.companias) {
                const compObj = state.companias.find(c => (c.id || c.Id) === companiaId);
                if (compObj) {
                    compObj.precioCompraLitroUSD = formValues.nuevoPrecioUSD;
                    compObj.PrecioCompraLitroUSD = formValues.nuevoPrecioUSD;
                    compObj.precioBufalaLitroUSD = formValues.nuevoPrecioBufalaUSD;
                    compObj.PrecioBufalaLitroUSD = formValues.nuevoPrecioBufalaUSD;
                    compObj.precioAcidaLitroUSD = formValues.nuevoPrecioAcidaUSD;
                    compObj.PrecioAcidaLitroUSD = formValues.nuevoPrecioAcidaUSD;
                }
            }

            if (typeof cargarCompanias === 'function') {
                try { await cargarCompanias(); } catch (err) {}
            }

            // Recalcular / refrescar cuadro automáticamente en la misma vista de RELACION_PAGOS_COMPANIAS
            const fDesde = document.getElementById('reporteFechaDesde')?.value || datosReporteActual?.fechaDesde || (state.cicloActivo ? formatearFechaLocal(state.cicloActivo.fechaInicio) : '');
            const fHasta = document.getElementById('reporteFechaHasta')?.value || datosReporteActual?.fechaHasta || (state.cicloActivo ? formatearFechaLocal(state.cicloActivo.fechaFin) : '');
            const compId = document.getElementById('reporteSubSelectReceptoria')?.value || '';
            const tasaMan = document.getElementById('reporteInputTasaBcvManual')?.value || '';
            const cicloId = state.cicloActivo ? (state.cicloActivo.id || state.cicloActivo.Id) : '';

            let url = `${API_BASE}/reportes/relacion-companias?fechaInicio=${fDesde}&fechaFin=${fHasta}`;
            if (compId) url += `&companiaId=${compId}`;
            if (cicloId) url += `&cicloId=${cicloId}`;
            if (tasaMan) url += `&tasaBcv=${tasaMan}`;

            try {
                const headers = { 'Authorization': `Bearer ${state.token}` };
                const resp = await fetch(url, { headers });
                if (resp.ok) {
                    const data = await resp.json();
                    datosReporteActual = { tipo: 'RELACION_PAGOS_COMPANIAS', data, fechaDesde: fDesde, fechaHasta: fHasta, tasaBcv: tasaMan || state.tasaBcv };
                    renderReporteRelacionCompanias(data, fDesde, fHasta);
                }
            } catch (err) {
                console.error('Error al refrescar tabla de compañías:', err);
                if (typeof ejecutarBusquedaReporte === 'function') {
                    await ejecutarBusquedaReporte();
                }
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errData.message || 'No se pudo actualizar el precio de la compañía.',
                background: '#ffffff',
                color: '#0f172a'
            });
        }
    } catch (e) {
        console.error('Error al actualizar precio de compañía:', e);
        Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: e.message,
            background: '#ffffff',
            color: '#0f172a'
        });
    }
}
window.abrirModalActualizarPrecioCompania = abrirModalActualizarPrecioCompania;

function abrirModalDetalleEntregasCompania(companiaId) {
    if (!datosReporteActual || !datosReporteActual.data) return;
    const comp = (datosReporteActual.data || []).find(c => (c.companiaId || c.CompaniaId) === companiaId);
    if (!comp) return;

    const entregas = comp.entregasDetalle || comp.EntregasDetalle || [];
    let grandTotalLitrosModal = 0;
    let rowsHtml = '';

    entregas.forEach((e, i) => {
        const lts = e.litros || e.Litros || 0;
        grandTotalLitrosModal += lts;
        const chofer = e.conductorNombre || e.choferNombre || e.ConductorNombre || e.ChoferNombre || (e.usuarioNombre || e.UsuarioNombre) || 'OTROS';
        const obs = (e.observacion || e.Observacion || '-').trim();

        // Formatear observación con badges estilizados
        let obsHtml = obs;
        let badgesHtml = '';
        
        const obsUpper = obs.toUpperCase();
        if (obsUpper.includes('BUFALA') || obsUpper.includes('BÚFALA')) {
            badgesHtml += `<span style="background: #fdf4ff; color: #a21caf; border: 1.5px solid #f0abfc; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-gem"></i> BÚFALA</span> `;
        } else if (obsUpper.includes('VACA')) {
            badgesHtml += `<span style="background: #f0fdf4; color: #166534; border: 1.5px solid #bbf7d0; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-cow"></i> VACA</span> `;
        }

        if (obsUpper.includes('ACIDA') || obsUpper.includes('ÁCIDA')) {
            badgesHtml += `<span style="background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> ÁCIDA</span> `;
        }

        if (obsUpper.includes('CONTROL COMPAÑÍAS') || obsUpper.includes('CONTROL COMPANIAS') || obsUpper.includes('DESPACHO DIRECTO')) {
            badgesHtml += `<span style="background: #faf5ff; color: #7c3aed; border: 1.5px solid #ddd6fe; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-receipt"></i> DESPACHO</span> `;
        }

        let textoLimpio = obs
            .replace(/\[BUFALA\]|\[BÚFALA\]|BUFALA|BÚFALA/gi, '')
            .replace(/\[VACA\]|VACA/gi, '')
            .replace(/\[ESTANDAR\]|ESTANDAR/gi, '')
            .replace(/LECHE ACIDA|LECHE ÁCIDA/gi, '')
            .replace(/\s+/g, ' ')
            .trim(' ', '.', '|', '-');

        obsHtml = `<div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">${badgesHtml} ${textoLimpio ? `<span style="color: #475569; font-size: 12px; font-weight: 500;">${textoLimpio}</span>` : ''}</div>`;

        rowsHtml += `
            <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 13px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
                <td style="padding: 12px 14px; white-space: nowrap; width: 135px;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; padding: 5px 10px; border-radius: 7px; border: 1px solid #e2e8f0; font-size: 12.5px; font-weight: 700; color: #334155;">
                        <i class="fa-regular fa-calendar-days" style="color: #64748b;"></i> ${formatearFechaLocal(e.fecha || e.Fecha)}
                    </div>
                </td>
                <td style="text-align: right; padding: 12px 14px; white-space: nowrap; width: 120px;">
                    <span style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); color: #047857; border: 1.5px solid #a7f3d0; padding: 5px 12px; border-radius: 8px; font-size: 13.5px; font-weight: 800; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                        ${formatearNumero(lts)} L
                    </span>
                </td>
                <td style="padding: 12px 14px; white-space: nowrap; width: 210px;">
                    <span style="background: #eff6ff; color: #1e40af; padding: 5px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 700; border: 1px solid #bfdbfe; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;">
                        <i class="fa-solid fa-user-tie" style="color: #2563eb; font-size: 12px;"></i> ${chofer}
                    </span>
                </td>
                <td style="padding: 12px 14px; line-height: 1.4;">${obsHtml}</td>
            </tr>
        `;
    });

    const cantEntregas = entregas.length;
    const promedioLitros = cantEntregas > 0 ? Math.round(grandTotalLitrosModal / cantEntregas) : 0;
    const compNombre = comp.companiaNombre || comp.CompaniaNombre || 'COMPAÑÍA';

    Swal.fire({
        html: `
            <div style="text-align: left; font-family: inherit;">
                <!-- CABECERA UNIFICADA COMPACTA -->
                <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; border-radius: 12px 12px 0 0; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <div style="background: rgba(37, 99, 235, 0.25); border: 1.5px solid rgba(96, 165, 250, 0.5); width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #60a5fa; flex-shrink: 0;">
                            <i class="fa-solid fa-truck-ramp-box" style="font-size: 17px;"></i>
                        </div>
                        <div style="min-width: 0;">
                            <div style="font-size: 16.5px; font-weight: 800; color: #ffffff; line-height: 1.2; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span>Entregas</span>
                                <span style="color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); padding: 1px 8px; border-radius: 6px; font-size: 13.5px; font-weight: 900; letter-spacing: 0.5px;">${compNombre}</span>
                            </div>
                            <div style="font-size: 11.5px; color: #94a3b8; font-weight: 500; margin-top: 2px;">Recepciones y despachos registrados en planta</div>
                        </div>
                    </div>
                    
                    <!-- PILLS DE MÉTRICAS EN LÍNEA -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <div style="background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(52, 211, 153, 0.4); padding: 5px 12px; border-radius: 8px; text-align: right;">
                            <div style="font-size: 9.5px; text-transform: uppercase; color: #6ee7b7; font-weight: 800; letter-spacing: 0.5px; line-height: 1;">Total</div>
                            <div style="font-size: 14.5px; font-weight: 900; color: #34d399; margin-top: 1px;">${formatearNumero(grandTotalLitrosModal)} <span style="font-size: 11px; font-weight: 700;">L</span></div>
                        </div>
                        <div style="background: rgba(59, 130, 246, 0.18); border: 1px solid rgba(96, 165, 250, 0.4); padding: 5px 10px; border-radius: 8px; text-align: right;">
                            <div style="font-size: 9.5px; text-transform: uppercase; color: #93c5fd; font-weight: 800; letter-spacing: 0.5px; line-height: 1;">Viajes</div>
                            <div style="font-size: 14.5px; font-weight: 900; color: #60a5fa; margin-top: 1px;">${cantEntregas}</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); padding: 5px 10px; border-radius: 8px; text-align: right;">
                            <div style="font-size: 9.5px; text-transform: uppercase; color: #cbd5e1; font-weight: 800; letter-spacing: 0.5px; line-height: 1;">Promedio</div>
                            <div style="font-size: 14.5px; font-weight: 800; color: #f8fafc; margin-top: 1px;">${formatearNumero(promedioLitros)} <span style="font-size: 11px; font-weight: 600;">L</span></div>
                        </div>
                        <button onclick="Swal.close()" title="Cerrar" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 6px; transition: all 0.2s ease;">
                            <i class="fa-solid fa-xmark" style="font-size: 14px;"></i>
                        </button>
                    </div>
                </div>

                <!-- CUERPO PRINCIPAL CON TABLA OPTIMIZADA -->
                <div style="padding: 14px 18px 16px 18px; background: #ffffff;">
                    <div style="max-height: 440px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left;">
                            <thead>
                                <tr style="background: #1e293b; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                                    <th style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; width: 125px;">Fecha</th>
                                    <th style="padding: 9px 12px; font-size: 11px; text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; width: 110px;">Litros</th>
                                    <th style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; width: 190px;">Chofer</th>
                                    <th style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800;">Observación / Detalles</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml || '<tr><td colspan="4" style="padding: 30px; color: #94a3b8; text-align: center; font-size: 13px;"><i class="fa-regular fa-folder-open" style="font-size: 24px; display: block; margin-bottom: 8px; color: #cbd5e1;"></i>No hay entregas registradas en este período.</td></tr>'}
                            </tbody>
                            ${cantEntregas > 0 ? `
                            <tfoot>
                                <tr style="background: #f8fafc; font-weight: 800; color: #0f172a; border-top: 2px solid #cbd5e1;">
                                    <td style="padding: 10px 12px; text-transform: uppercase; font-size: 11px; color: #475569;">TOTAL CONSOLIDADO</td>
                                    <td style="padding: 10px 12px; text-align: right; color: #047857; font-size: 14px; font-weight: 900;">${formatearNumero(grandTotalLitrosModal)} L</td>
                                    <td colspan="2" style="padding: 10px 12px; color: #64748b; font-size: 11.5px; font-weight: 600;">${cantEntregas} entregas registradas</td>
                                </tr>
                            </tfoot>` : ''}
                        </table>
                    </div>

                    <!-- FOOTER INFERIOR -->
                    <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                        <button onclick="Swal.close()" style="background: #f1f5f9; hover: #e2e8f0; border: 1px solid #cbd5e1; color: #334155; font-weight: 700; font-size: 12px; padding: 6px 16px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-xmark"></i> Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `,
        padding: 0,
        showConfirmButton: false,
        showCloseButton: false,
        width: 900,
        background: 'transparent'
    });
}
window.abrirModalDetalleEntregasCompania = abrirModalDetalleEntregasCompania;

function renderReporteChoferes(data, fechaDesde, fechaHasta) {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-id-badge" style="font-size: 32px; margin-bottom: 10px; display: block; color: #94a3b8;"></i>
                No se encontraron registros de balance (sobrante / faltante) para choferes en el rango seleccionado (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}).
            </div>
        `;
        return;
    }

    let cardsHtml = '';
    data.forEach(ch => {
        let rowsHtml = '';
        (ch.detalle || []).forEach((d, idx) => {
            const altClass = idx % 2 === 1 ? 'class="excel-td-alt"' : '';
            
            // Falta (Rojo con signo -) / Ganancia (Verde con signo +) / Neutral (0)
            let estiloLitros = 'font-weight: 800; font-size: 14px;';
            let textoLitros = '0';
            if (d.litros < 0) {
                estiloLitros = 'background-color: #ff0000 !important; color: #ffffff !important; font-weight: 800; font-size: 14px;';
                textoLitros = `-${formatearNumero(Math.abs(d.litros))}`;
            } else if (d.litros > 0) {
                estiloLitros = 'background-color: #16a34a !important; color: #ffffff !important; font-weight: 800; font-size: 14px;';
                textoLitros = `+${formatearNumero(d.litros)}`;
            } else {
                estiloLitros = 'color: #64748b; font-weight: 700; font-size: 14px;';
                textoLitros = '0';
            }

            rowsHtml += `
                <tr ${altClass}>
                    <td style="font-weight: 600; color: #334155;">${formatearFechaLocal(d.fecha)}</td>
                    <td style="${estiloLitros}">${textoLitros}</td>
                    <td class="text-left" style="color: #475569;">${d.observacion || ''}</td>
                </tr>
            `;
        });

        // Estilo Total
        let estiloTotal = 'color: #64748b; font-weight: 700; font-size: 14px;';
        let textoTotal = '0';
        if (ch.totalLitros < 0) {
            estiloTotal = 'background-color: #ff0000 !important; color: #ffffff !important; font-weight: 800; font-size: 14px;';
            textoTotal = `-${formatearNumero(Math.abs(ch.totalLitros))}`;
        } else if (ch.totalLitros > 0) {
            estiloTotal = 'background-color: #16a34a !important; color: #ffffff !important; font-weight: 800; font-size: 14px;';
            textoTotal = `+${formatearNumero(ch.totalLitros)}`;
        }

        cardsHtml += `
            <div class="report-card-demarcada">
                <div class="table-responsive" style="margin: 0; border: none; flex-grow: 1;">
                    <table class="table-reporte-demarcada">
                        <thead>
                            <tr>
                                <th colspan="3" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; font-size: 14.5px; font-weight: 800; text-align: center; padding: 11px 12px; border-bottom: 2px solid rgba(0,0,0,0.08); letter-spacing: 0.03em;">
                                    ${ch.nombre.toUpperCase()}
                                </th>
                            </tr>
                            <tr>
                                <th style="width: 30%;">FECHA</th>
                                <th style="width: 35%;">LITROS</th>
                                <th style="width: 35%;">OBSERVACION</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>TOTAL</td>
                                <td style="${estiloTotal}">${textoTotal}</td>
                                <td>&nbsp;</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div style="margin-top: 14px; display: flex; gap: 8px;">
                    <button type="button" class="btn-exportar-card" onclick="exportarSeccionExcel('${ch.nombre}')" title="Exportar ${ch.nombre} a Excel">
                        <i class="fa-solid fa-file-excel"></i> Exportar
                    </button>
                    <button type="button" class="btn-captura-card" onclick="capturarCardImagen(this, '${ch.nombre}')" title="Capturar imagen de la tabla ${ch.nombre}" style="background: linear-gradient(135deg, #0284c7, #2563eb); border: none; color: #ffffff; font-weight: 700; padding: 6px 14px; border-radius: 6px; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                        <i class="fa-solid fa-camera"></i> Capturar Imagen
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="report-grid-cards">
            ${cardsHtml}
        </div>
    `;
}

window.datosRelacionChoferesUltimos = null;

function renderReporteRelacionChoferes(data, fechaDesde, fechaHasta, filtroTermino = '') {
    const container = document.getElementById('contenedorResultadoReporte');
    if (!container) return;

    if (!filtroTermino) {
        window.datosRelacionChoferesUltimos = { rawData: data, fechaDesde, fechaHasta };
    }

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b; background: #ffffff; border-radius: 16px; border: 1.5px dashed #cbd5e1; box-shadow: 0 4px 14px rgba(0,0,0,0.03);">
                <i class="fa-solid fa-truck-ramp-box" style="font-size: 38px; margin-bottom: 12px; display: block; color: #94a3b8;"></i>
                <div style="font-weight: 800; font-size: 16px; color: #1e293b;">No se encontraron viajes o recolecciones</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                    En el rango seleccionado (${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}).
                </div>
            </div>
        `;
        return;
    }

    // Filtrar si hay término de búsqueda activo
    let datosParaRender = data;
    const termClean = (filtroTermino || '').trim().toLowerCase();
    if (termClean) {
        datosParaRender = data.map(r => {
            const chName = (r.chofer || '').toLowerCase();
            const fincas = r.detalleFincas || r.DetalleFincas || [];
            const fincasCoincidentes = fincas.filter(f => {
                const fNom = (f.fincaNombre || f.FincaNombre || '').toLowerCase();
                const fProp = (f.propietario || f.Propietario || '').toLowerCase();
                const fTipo = (f.tipoLeche || f.TipoLeche || '').toLowerCase();
                const fObs = (f.observacion || f.Observacion || '').toLowerCase();
                const fFec = formatearFechaLocal(f.fecha || f.Fecha).toLowerCase();
                return fNom.includes(termClean) || fProp.includes(termClean) || fTipo.includes(termClean) || fObs.includes(termClean) || fFec.includes(termClean);
            });

            if (chName.includes(termClean)) {
                return r; // Mostrar todo el chofer si coincide el chofer
            }
            if (fincasCoincidentes.length > 0) {
                const rCopia = { ...r };
                rCopia.detalleFincas = fincasCoincidentes;
                rCopia.DetalleFincas = fincasCoincidentes;
                return rCopia;
            }
            return null;
        }).filter(Boolean);
    }

    let sumLitrosRuta = 0;
    let sumLitrosQuesera = 0;
    let sumDiferencias = 0;
    let totalFincasCount = 0;

    datosParaRender.forEach(r => {
        sumLitrosRuta += Number(r.litrosRuta || 0);
        sumLitrosQuesera += Number(r.litrosQuesera || 0);
        sumDiferencias += Number(r.diferencias != null ? r.diferencias : ((r.litrosRuta || 0) - (r.litrosQuesera || 0)));
        const fincas = r.detalleFincas || r.DetalleFincas || [];
        totalFincasCount += fincas.length;
    });

    const pctTotalMerma = sumLitrosRuta > 0 ? ((Math.abs(sumDiferencias) / sumLitrosRuta) * 100).toFixed(2) : '0.00';

    // Render cards per driver
    let choferesCardsHtml = '';

    if (datosParaRender.length === 0) {
        choferesCardsHtml = `
            <div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 12px; border: 1.5px dashed #cbd5e1; color: #64748b; font-size: 13.5px; font-weight: 600;">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 24px; margin-bottom: 8px; display: block; color: #94a3b8;"></i>
                No se encontraron fincas o conductores que coincidan con <strong>"${filtroTermino}"</strong>.
            </div>
        `;
    } else {
        datosParaRender.forEach((r, idx) => {
            const lRuta = Number(r.litrosRuta || 0);
            const lQuesera = Number(r.litrosQuesera || 0);
            const diff = Number(r.diferencias != null ? r.diferencias : (lRuta - lQuesera));
            const pctMerma = lRuta > 0 ? ((Math.abs(diff) / lRuta) * 100).toFixed(2) : '0.00';
            const fincas = r.detalleFincas || r.DetalleFincas || [];

            let badgeMermaClass = 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;';
            let badgeText = `${pctMerma}%`;
            let statusIcon = '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i>';
            let statusLabel = 'Normal';

            if (diff > 0 && parseFloat(pctMerma) > 1.0) {
                badgeMermaClass = 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;';
                statusIcon = '<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>';
                statusLabel = 'Merma Alta';
            } else if (diff > 0 && parseFloat(pctMerma) > 0.0) {
                badgeMermaClass = 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;';
                statusIcon = '<i class="fa-solid fa-circle-exclamation" style="color: #f59e0b;"></i>';
                statusLabel = 'Merma Leve';
            }

            // Generate Fincas items (both mobile touch-cards and table rows)
            let fincasMobileCardsHtml = '';
            let fincasTableRowsHtml = '';

            if (fincas.length === 0) {
                fincasMobileCardsHtml = `
                    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px; font-weight: 600; background: #f8fafc; border-radius: 10px; border: 1px dashed #e2e8f0;">
                        <i class="fa-regular fa-clipboard" style="font-size: 20px; display: block; margin-bottom: 6px;"></i>
                        No hay desglose de fincas registradas para este conductor en este período.
                    </div>
                `;
                fincasTableRowsHtml = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 18px; color: #94a3b8; font-style: italic;">
                            Sin fincas registradas en este período
                        </td>
                    </tr>
                `;
            } else {
                fincas.forEach((f, fIdx) => {
                    const fLitros = Number(f.litros || f.Litros || 0);
                    const fFecha = formatearFechaLocal(f.fecha || f.Fecha);
                    const fNombre = (f.fincaNombre || f.FincaNombre || `Finca #${f.fincaId || f.FincaId || ''}`).toUpperCase();
                    const fProp = (f.propietario || f.Propietario || '').trim();
                    const fTipo = (f.tipoLeche || f.TipoLeche || 'VACA').toUpperCase();
                    const fObs = (f.observacion || f.Observacion || '').trim();
                    const fTicket = f.ticketControlId || f.TicketControlId || '';

                    let tipoBadge = '<span style="background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 800; text-transform: uppercase;">🥛 VACA</span>';
                    if (fTipo.includes('BUF') || fTipo.includes('BÚF')) {
                        tipoBadge = '<span style="background: #f3e8ff; color: #7e22ce; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 800; text-transform: uppercase;">🐃 BÚFALA</span>';
                    } else if (fTipo.includes('ACID') || fTipo.includes('ÁCID')) {
                        tipoBadge = '<span style="background: #fef3c7; color: #b45309; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 800; text-transform: uppercase;">🍋 ÁCIDA</span>';
                    }

                    // Mobile Card item
                    fincasMobileCardsHtml += `
                        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.15s ease;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="background: #f1f5f9; color: #334155; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                                        <i class="fa-regular fa-calendar-days" style="color: #2563eb;"></i> ${fFecha}
                                    </span>
                                    ${tipoBadge}
                                </div>
                                <div style="font-size: 14px; font-weight: 900; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 9px; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-bottle-water" style="font-size: 11px;"></i> ${formatearNumero(fLitros)} L
                                </div>
                            </div>
                            <div style="margin-bottom: 6px;">
                                <div style="font-size: 14px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-location-dot" style="color: #2563eb; font-size: 13px;"></i> ${fNombre}
                                </div>
                                ${fProp ? `<div style="font-size: 12px; color: #64748b; font-weight: 600; margin-left: 18px; margin-top: 1px;">Propietario: <span style="color: #334155;">${fProp}</span></div>` : ''}
                            </div>
                            ${fObs ? `
                                <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #f59e0b; border-radius: 8px; padding: 7px 10px; margin-top: 6px; font-size: 12px; color: #92400e; display: flex; align-items: flex-start; gap: 6px;">
                                    <i class="fa-solid fa-comment-dots" style="color: #d97706; margin-top: 2px; flex-shrink: 0;"></i>
                                    <div style="font-weight: 600; line-height: 1.35;">${fObs}</div>
                                </div>
                            ` : `
                                <div style="font-size: 11px; color: #94a3b8; font-style: italic; margin-left: 18px;">
                                    <i class="fa-regular fa-comment" style="margin-right: 3px;"></i> Sin observaciones
                                </div>
                            `}
                        </div>
                    `;

                    // Desktop Table Row
                    const altClass = fIdx % 2 === 1 ? 'class="excel-td-alt"' : '';
                    fincasTableRowsHtml += `
                        <tr ${altClass}>
                            <td style="font-weight: 700; color: #334155; padding: 10px 12px; white-space: nowrap;">
                                <i class="fa-regular fa-calendar-days" style="color: #2563eb; margin-right: 4px;"></i> ${fFecha}
                            </td>
                            <td style="font-weight: 800; color: #0f172a; padding: 10px 12px;">
                                ${fNombre}
                                ${fProp ? `<div style="font-size: 11px; color: #64748b; font-weight: 600;">${fProp}</div>` : ''}
                            </td>
                            <td style="text-align: center; padding: 10px 12px;">
                                ${tipoBadge}
                            </td>
                            <td style="font-weight: 900; color: #059669; padding: 10px 12px; text-align: right; white-space: nowrap;">
                                ${formatearNumero(fLitros)} L
                            </td>
                            <td style="padding: 10px 12px; font-size: 12px; color: ${fObs ? '#92400e' : '#94a3b8'};">
                                ${fObs ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 4px 8px; font-weight: 600;"><i class="fa-solid fa-comment-dots" style="color: #d97706; margin-right: 4px;"></i>${fObs}</div>` : '<span style="font-style: italic;">Sin observaciones</span>'}
                            </td>
                            <td style="text-align: center; padding: 10px 12px; font-size: 11px; color: #64748b; font-weight: 700;">
                                ${fTicket ? `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${fTicket}</span>` : '-'}
                            </td>
                        </tr>
                    `;
                });
            }

            const choferName = (r.chofer || 'OTROS').toUpperCase();

            choferesCardsHtml += `
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); overflow: hidden;">
                    <!-- HEADER CHOFER -->
                    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(37,99,235,0.25); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 18px; color: #60a5fa;">
                                <i class="fa-solid fa-user-gear"></i>
                            </div>
                            <div>
                                <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.02em; color: #ffffff;">${choferName}</div>
                                <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">
                                    ${fincas.length} recolecciones registradas
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="display: inline-block; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 12px; ${badgeMermaClass}">
                                Merma: ${badgeText}
                            </span>
                            <span style="font-size: 12px; font-weight: 700; color: #ffffff; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                                ${statusIcon} ${statusLabel}
                            </span>
                        </div>
                    </div>

                    <!-- RESUMEN EN CIFRAS DEL CHOFER (SIN DOLARES) -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; padding: 12px 16px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; text-align: center;">
                            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Litros Recogidos (Ruta)</div>
                            <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${formatearNumero(lRuta)} L</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; text-align: center;">
                            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Litros Entregados (Destino)</div>
                            <div style="font-size: 16px; font-weight: 900; color: #2563eb; margin-top: 2px;">${formatearNumero(lQuesera)} L</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; text-align: center;">
                            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Diferencia / Merma</div>
                            <div style="font-size: 16px; font-weight: 900; color: ${diff > 0 ? '#b91c1c' : (diff < 0 ? '#047857' : '#475569')}; margin-top: 2px;">
                                ${diff > 0 ? `+${formatearNumero(diff)}` : (diff < 0 ? formatearNumero(diff) : '0')} L
                            </div>
                        </div>
                    </div>

                    <!-- DESGLOSE DE FINCAS RECOGIDAS, FECHAS Y OBSERVACIONES -->
                    <div style="padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                            <div style="font-size: 13px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-list-check" style="color: #2563eb;"></i>
                                FINCAS RECOGIDAS, FECHAS Y OBSERVACIONES
                                <span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 10px; font-weight: 800;">
                                    ${fincas.length}
                                </span>
                            </div>
                        </div>

                        <!-- VISTA MÓVIL (VISIBLE EN PANTALLAS CHICAS / CARDS) -->
                        <div class="chofer-mobile-view-cards" style="display: block;">
                            ${fincasMobileCardsHtml}
                        </div>

                        <!-- VISTA ESCRITORIO (TABLA RESPONSIVA) -->
                        <div class="chofer-desktop-view-table table-responsive" style="margin: 0; border: none; display: none;">
                            <table class="table-reporte-demarcada">
                                <thead>
                                    <tr>
                                        <th style="width: 15%; padding: 9px 12px;">FECHA</th>
                                        <th style="width: 30%; padding: 9px 12px;" class="text-left">FINCA / PROPIETARIO</th>
                                        <th style="width: 15%; padding: 9px 12px; text-align: center;">TIPO LECHE</th>
                                        <th style="width: 15%; padding: 9px 12px; text-align: right;">LITROS</th>
                                        <th style="width: 20%; padding: 9px 12px;" class="text-left">OBSERVACIONES</th>
                                        <th style="width: 5%; padding: 9px 12px; text-align: center;">TICKET</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${fincasTableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = `
        <style>
            @media (min-width: 768px) {
                .chofer-mobile-view-cards { display: none !important; }
                .chofer-desktop-view-table { display: block !important; }
            }
            @media (max-width: 767px) {
                .chofer-mobile-view-cards { display: block !important; }
                .chofer-desktop-view-table { display: none !important; }
            }
        </style>

        <!-- BUSCADOR EN VIVO DE FINCA / CONDUCTOR EN EL REPORTE -->
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 10px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <i class="fa-solid fa-magnifying-glass" style="color: #2563eb; font-size: 16px;"></i>
            <input type="text" id="filtroEnVivoRelacionChoferes" 
                   oninput="filtrarReporteRelacionEnVivo(this.value)" 
                   value="${filtroTermino}"
                   placeholder="Filtrar en vivo por Finca, Propietario, Conductor o Tipo de Leche..." 
                   style="border: none; outline: none; width: 100%; font-size: 13.5px; font-weight: 600; color: #0f172a; background: transparent;" 
                   autocomplete="off" />
            ${filtroTermino ? `
                <button type="button" onclick="limpiarFiltroEnVivoRelacion()" title="Limpiar filtro" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 4px;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            ` : ''}
        </div>

        <!-- KPI RESUMEN SUPERIOR -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Litros Finca</div>
                <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">${formatearNumero(sumLitrosRuta)} L</div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Litros Destino</div>
                <div style="font-size: 18px; font-weight: 900; color: #2563eb; margin-top: 4px;">${formatearNumero(sumLitrosQuesera)} L</div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Merma Total</div>
                <div style="font-size: 18px; font-weight: 900; color: ${sumDiferencias > 0 ? '#b91c1c' : (sumDiferencias < 0 ? '#047857' : '#475569')}; margin-top: 4px;">
                    ${sumDiferencias > 0 ? `+${formatearNumero(sumDiferencias)}` : formatearNumero(sumDiferencias)} L
                </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">% Merma Ponderado</div>
                <div style="font-size: 18px; font-weight: 900; color: ${parseFloat(pctTotalMerma) > 1.0 ? '#b91c1c' : '#047857'}; margin-top: 4px;">
                    ${pctTotalMerma}%
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.02em;">
                <i class="fa-solid fa-truck-moving" style="color: #2563eb; margin-right: 6px;"></i> RELACIÓN DE CONDUCTORES Y VIAJES
            </div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 4px 10px; border-radius: 8px;">
                <i class="fa-regular fa-calendar-check" style="margin-right: 4px;"></i> Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}
            </div>
        </div>

        ${choferesCardsHtml}

        <div style="margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline" onclick="window.print()" style="font-weight: 700; border-radius: 8px; padding: 8px 16px;">
                <i class="fa-solid fa-print"></i> Imprimir Reporte
            </button>
            <button type="button" class="btn btn-success" onclick="exportarReporteActualExcel()" style="font-weight: 700; border-radius: 8px; padding: 8px 18px; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">
                <i class="fa-solid fa-file-excel"></i> Exportar a Excel
            </button>
        </div>
    `;

    // Mantener el foco si el usuario estaba escribiendo
    if (filtroTermino) {
        const inputFiltro = document.getElementById('filtroEnVivoRelacionChoferes');
        if (inputFiltro) {
            inputFiltro.focus();
            inputFiltro.setSelectionRange(inputFiltro.value.length, inputFiltro.value.length);
        }
    }
}

function filtrarReporteRelacionEnVivo(term) {
    if (!window.datosRelacionChoferesUltimos) return;
    const { rawData, fechaDesde, fechaHasta } = window.datosRelacionChoferesUltimos;
    renderReporteRelacionChoferes(rawData, fechaDesde, fechaHasta, term);
}
window.filtrarReporteRelacionEnVivo = filtrarReporteRelacionEnVivo;

function limpiarFiltroEnVivoRelacion() {
    if (!window.datosRelacionChoferesUltimos) return;
    const { rawData, fechaDesde, fechaHasta } = window.datosRelacionChoferesUltimos;
    renderReporteRelacionChoferes(rawData, fechaDesde, fechaHasta, '');
}
window.limpiarFiltroEnVivoRelacion = limpiarFiltroEnVivoRelacion;

if (localStorage.getItem('pagosRealizados_cache')) {
    localStorage.removeItem('pagosRealizados_cache');
}

async function toggleEstadoPagoFinca(fincaId, keyPago, isChecked, bancoNombre, fechaDesde, fechaHasta, tasaVal) {
    if (localStorage.getItem('pagosRealizados_cache')) {
        localStorage.removeItem('pagosRealizados_cache');
    }
    await togglePagoLiquidacion(fincaId, isChecked);
}
window.toggleEstadoPagoFinca = toggleEstadoPagoFinca;

function actualizarContadoresPagosBanco(bancoTarget) {
    const badges = document.querySelectorAll('.badge-pago-banco-counter');
    badges.forEach(b => {
        const banco = b.getAttribute('data-banco');
        if (!bancoTarget || banco === bancoTarget) {
            const chks = document.querySelectorAll(`.chk-pago-banco[data-banco="${banco}"]`);
            const checkedCount = Array.from(chks).filter(c => c.checked).length;
            b.innerText = `${checkedCount} de ${chks.length} Pagados`;
            if (checkedCount === chks.length && chks.length > 0) {
                b.style.background = '#10b981';
                b.style.color = '#ffffff';
            } else {
                b.style.background = 'rgba(255,255,255,0.18)';
                b.style.color = '#ffffff';
            }
        }
    });
}

async function verDetalleAdelantosModal(fincaId, fincaNombre) {
    const title = document.getElementById('modalVerAdelantosTitle');
    const subtitle = document.getElementById('modalVerAdelantosSubtitle');
    const body = document.getElementById('bodyModalVerAdelantosBancos');

    if (title) title.innerText = `Adelantos & Abonos - ${fincaNombre.toUpperCase()}`;
    if (subtitle) subtitle.innerText = `Desglose de préstamos y cuotas por ciclo operativo para ${fincaNombre}`;

    if (body) {
        body.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #2563eb;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                Cargando adelantos de ${fincaNombre}...
            </div>
        `;
    }

    abrirModalCustom('modalVerAdelantosBancosCustom');

    try {
        const res = await fetch(`${API_BASE}/adelantos?tipoEntidad=FINCA&entidadId=${fincaId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) throw new Error('Error consultando servidor.');
        const adelantos = await res.json();

        if (!adelantos || adelantos.length === 0) {
            if (body) {
                body.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #64748b; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
                        <i class="fa-solid fa-hand-holding-dollar" style="font-size: 28px; margin-bottom: 8px; display: block; color: #94a3b8;"></i>
                        Esta finca no tiene registro de adelantos activos en el sistema.
                    </div>
                `;
            }
            return;
        }

        let html = '';
        adelantos.forEach(a => {
            const id = a.id || a.Id;
            const fechaStr = (a.fechaSolicitud || a.FechaSolicitud || '').split('T')[0];
            const totalUsd = a.montoTotalUSD ?? a.MontoTotalUSD ?? 0;
            const pagadoUsd = a.montoPagadoUSD ?? a.MontoPagadoUSD ?? 0;
            const pendienteUsd = a.montoPendienteUSD ?? a.MontoPendienteUSD ?? 0;
            const numCuotas = a.numeroCuotas ?? a.NumeroCuotas ?? 1;
            const obs = a.observacion || a.Observacion || 'Sin observaciones';
            const cuotas = a.cuotas || a.Cuotas || [];

            let cuotasRows = '';
            cuotas.forEach((c, idx) => {
                const cId = c.id || c.Id;
                const numC = c.numeroCuota || c.NumeroCuota || (idx + 1);
                const semNom = c.semanaNombre || c.SemanaNombre || `Ciclo #${c.semanaOperativaId || 'N/A'}`;
                const nomCuotaUsd = c.montoCuotaUSD ?? c.MontoCuotaUSD ?? 0;
                const cobUsd = c.montoCobradoUSD ?? c.MontoCobradoUSD ?? 0;
                const tasaAplic = c.tasaBcvAplicada ?? c.TasaBcvAplicada ?? state.tasaBcv ?? 798.326;
                const cobBs = c.montoCobradoBs ?? c.MontoCobradoBs ?? (cobUsd * tasaAplic);
                const stCuota = (c.estado || c.Estado || 'PENDIENTE').toUpperCase();

                let badgeSt = `<span class="badge" style="background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; font-size: 11px;">PENDIENTE</span>`;
                if (stCuota === 'COBRADO') {
                    badgeSt = `<span class="badge" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 800;">COBRADO</span>`;
                } else if (stCuota === 'POSPUESTO') {
                    badgeSt = `<span class="badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800;">POSPUESTO</span>`;
                }

                cuotasRows += `
                    <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; font-size: 12.5px;">
                        <td style="text-align: center; font-weight: 700; color: #475569;">Cuota ${numC}/${numCuotas}</td>
                        <td style="font-weight: 700; color: #0f172a;">${semNom}</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 700;">$ ${formatearNumero(nomCuotaUsd, 2)}</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 800; color: #047857;">$ ${formatearNumero(cobUsd, 2)}</td>
                        <td style="text-align: right; font-family: monospace; font-size: 12px; color: #b45309;">Bs. ${formatearNumero(tasaAplic, 2)}</td>
                        <td style="text-align: right; font-family: monospace; font-weight: 800; color: #b45309;">Bs. ${formatearNumero(cobBs, 2)}</td>
                        <td style="text-align: center;">${badgeSt}</td>
                    </tr>
                `;
            });

            html += `
                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <div>
                            <span style="font-size: 14px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-file-invoice-dollar" style="color: #2563eb;"></i> Adelanto #${id} (${fechaStr})
                            </span>
                            <span style="font-size: 12px; color: #64748b;">${obs}</span>
                        </div>
                        <div style="display: flex; gap: 10px; font-size: 13px;">
                            <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 800;">
                                Total: $ ${formatearNumero(totalUsd, 2)}
                            </span>
                            <span class="badge" style="background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; font-weight: 800;">
                                Pendiente: $ ${formatearNumero(pendienteUsd, 2)}
                            </span>
                        </div>
                    </div>
                    <table class="table" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin: 0;">
                        <thead>
                            <tr style="background: #f1f5f9; font-size: 11.5px; font-weight: 800; color: #334155;">
                                <th style="text-align: center;">N° CUOTA</th>
                                <th>CICLO OPERATIVO</th>
                                <th style="text-align: right;">PACTADO ($)</th>
                                <th style="text-align: right;">ABONADO ($)</th>
                                <th style="text-align: right;">TASA BCV</th>
                                <th style="text-align: right;">DESCONTADO (BS)</th>
                                <th style="text-align: center;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cuotasRows || '<tr><td colspan="7" class="text-center" style="padding: 10px; color: #94a3b8;">Sin cuotas</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
        });

        if (body) body.innerHTML = html;
    } catch (err) {
        if (body) {
            body.innerHTML = `
                <div style="text-align: center; padding: 24px; color: #ef4444;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; margin-bottom: 6px; display: block;"></i>
                    Error cargando detalle: ${err.message}
                </div>
            `;
        }
    }
}
window.verDetalleAdelantosModal = verDetalleAdelantosModal;

function descargarExcelConDiseno(htmlTablas, nombreArchivo, tituloDocumento = 'Reporte') {
    const excelDocument = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:x="urn:schemas-microsoft-com:office:excel" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <!--[if gte mso 9]>
    <xml>
        <x:ExcelWorkbook>
            <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                    <x:Name>${tituloDocumento.substring(0, 30).replace(/[\\/*?:[\]]/g, '')}</x:Name>
                    <x:WorksheetOptions>
                        <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                </x:ExcelWorksheet>
            </x:ExcelWorksheets>
        </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
        body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a; margin: 15px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 22px; }
        .excel-banner-main {
            background-color: #1e1b4b !important;
            color: #ffffff !important;
            font-size: 14pt !important;
            font-weight: bold !important;
            text-align: center !important;
            padding: 12px !important;
            border: 1.5px solid #1e1b4b !important;
        }
        .excel-banner-sub {
            background-color: #f1f5f9 !important;
            color: #1e293b !important;
            font-size: 10pt !important;
            font-weight: bold !important;
            padding: 8px 12px !important;
            border: 1px solid #cbd5e1 !important;
        }
        .excel-sec-header {
            background-color: #1e3a5f !important;
            color: #ffffff !important;
            font-size: 11pt !important;
            font-weight: bold !important;
            text-align: center !important;
            padding: 9px 12px !important;
            border: 1px solid #0f172a !important;
        }
        .excel-th {
            background-color: #334155 !important;
            color: #ffffff !important;
            font-size: 10pt !important;
            font-weight: bold !important;
            text-align: center !important;
            padding: 8px 10px !important;
            border: 1px solid #475569 !important;
        }
        .excel-td {
            font-size: 10pt !important;
            padding: 6px 10px !important;
            border: 1px solid #cbd5e1 !important;
            text-align: center !important;
            color: #0f172a !important;
            background-color: #ffffff;
        }
        .excel-td-alt {
            background-color: #f8fafc !important;
        }
        .excel-td-left {
            text-align: left !important;
            padding-left: 10px !important;
        }
        .excel-td-bold {
            font-weight: bold !important;
        }
        .excel-td-num {
            text-align: right !important;
            padding-right: 10px !important;
            mso-number-format: '#,##0';
        }
        .excel-td-currency {
            text-align: right !important;
            padding-right: 10px !important;
            mso-number-format: '#,##0.00';
        }
        .excel-td-mono {
            font-family: monospace !important;
            mso-number-format: '\\@' !important;
        }
        .excel-total-row td {
            background-color: #047857 !important;
            color: #ffffff !important;
            font-size: 10.5pt !important;
            font-weight: bold !important;
            text-align: center !important;
            padding: 9px 12px !important;
            border: 1px solid #ffffff !important;
        }
        .excel-grand-total td {
            background-color: #065f46 !important;
            color: #ffffff !important;
            font-size: 11pt !important;
            font-weight: bold !important;
            padding: 10px 14px !important;
            border: 2px solid #047857 !important;
        }
    </style>
</head>
<body>
    ${htmlTablas}
</body>
</html>`;

    const blob = new Blob([excelDocument], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo.endsWith('.xls') ? nombreArchivo : `${nombreArchivo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Reporte exportado a Excel con diseño y colores.`);
}

function generarHtmlTablaDiarioExcel(titulo, items, total) {
    let rowsHtml = '';
    if (!items || items.length === 0) {
        rowsHtml = `<tr><td colspan="2" class="excel-td" style="color: #94a3b8; font-style: italic;">Sin registros en este período</td></tr>`;
    } else {
        items.forEach((it, idx) => {
            const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
            rowsHtml += `
                <tr>
                    <td class="excel-td ${altClass}">${formatearFechaLocal(it.fecha)}</td>
                    <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(it.litros)}</td>
                </tr>
            `;
        });
    }

    return `
        <table>
            <thead>
                <tr>
                    <th colspan="2" class="excel-sec-header">${titulo}</th>
                </tr>
                <tr>
                    <th class="excel-th" style="width: 50%;">FECHA</th>
                    <th class="excel-th" style="width: 50%;">LITROS</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot>
                <tr class="excel-total-row">
                    <td>TOTAL</td>
                    <td>${formatearNumero(total)}</td>
                </tr>
            </tfoot>
        </table>
    `;
}

function exportarReporteActualExcel() {
    if (!datosReporteActual || !datosReporteActual.data) {
        showToast('No hay datos generados para exportar.', 'warning');
        return;
    }

    const { tipo, data, fechaDesde, fechaHasta } = datosReporteActual;
    let tablasHtml = '';

    if (tipo === 'DIARIOS') {
        const headerDoc = `
            <table>
                <tr>
                    <th colspan="2" class="excel-banner-main">REPORTE DIARIO DE OPERACIONES</th>
                </tr>
                <tr>
                    <td class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
                    <td class="excel-banner-sub" style="text-align: right;">Total Litros Rutas: <strong>${formatearNumero(data.totalDiarioRutas)} Lts</strong></td>
                </tr>
            </table>
        `;

        const t1 = generarHtmlTablaDiarioExcel('DIARIO RUTAS', data.diarioRutas || [], data.totalDiarioRutas || 0);
        const t2 = generarHtmlTablaDiarioExcel('DIARIO RECEPTORIAS', data.diarioReceptorias || [], data.totalDiarioReceptorias || 0);
        const t3 = generarHtmlTablaDiarioExcel('DIARIO TRANSPORTE RUTAS', data.diarioTransporteRutas || [], data.totalDiarioTransporteRutas || 0);
        const t4 = generarHtmlTablaDiarioExcel('DIARIO TRANSPORTE RECEPTORIAS', data.diarioTransporteReceptorias || [], data.totalDiarioTransporteReceptorias || 0);

        tablasHtml = headerDoc + t1 + t2 + t3 + t4;
    }
    else if (tipo === 'RECEPTORIAS') {
        tablasHtml += `
            <table>
                <tr>
                    <th colspan="3" class="excel-banner-main">REPORTE DE RECEPTORIAS / PLANTAS</th>
                </tr>
                <tr>
                    <td colspan="3" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
                </tr>
            </table>
        `;

        (data || []).forEach(comp => {
            let rowsHtml = '';
            (comp.detalle || []).forEach((d, idx) => {
                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rowsHtml += `
                    <tr>
                        <td class="excel-td ${altClass}">${formatearFechaLocal(d.fecha)}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(d.litros)}</td>
                        <td class="excel-td excel-td-left ${altClass}">${d.observacion || '-'}</td>
                    </tr>
                `;
            });

            tablasHtml += `
                <table>
                    <thead>
                        <tr>
                            <th colspan="3" class="excel-sec-header">RECEPTORIA: ${comp.nombre.toUpperCase()} ${comp.propietario ? `- ${comp.propietario.toUpperCase()}` : ''}</th>
                        </tr>
                        <tr>
                            <th class="excel-th" style="width: 25%;">FECHA</th>
                            <th class="excel-th" style="width: 25%;">LITROS</th>
                            <th class="excel-th" style="width: 50%;">OBSERVACION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td>${formatearNumero(comp.totalLitros)}</td>
                            <td>$ ${formatearNumero(comp.precioLitroUSD || 0.8, 6)}</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Dolar</td>
                            <td>$ ${formatearNumero(comp.totalUSD, 2)}</td>
                            <td>&nbsp;</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Bs</td>
                            <td>Bs. ${formatearNumero(comp.totalBs, 2)}</td>
                            <td>Tasa: ${formatearNumero(comp.tasaBcv || state.tasaBcv || 791.3248, 4)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        });
    }
    else if (tipo === 'FINCAS') {
        tablasHtml += `
            <table>
                <tr>
                    <th colspan="3" class="excel-banner-main">REPORTE DE RECOLECCIÓN POR FINCA</th>
                </tr>
                <tr>
                    <td colspan="3" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
                </tr>
            </table>
        `;

        (data || []).forEach(finca => {
            let rowsHtml = '';
            (finca.detalle || []).forEach((d, idx) => {
                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rowsHtml += `
                    <tr>
                        <td class="excel-td ${altClass}">${formatearFechaLocal(d.fecha)}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(d.litros)}</td>
                        <td class="excel-td excel-td-left ${altClass}">${d.observacion || '-'}</td>
                    </tr>
                `;
            });

            tablasHtml += `
                <table>
                    <thead>
                        <tr>
                            <th colspan="3" class="excel-sec-header">FINCA: ${finca.nombre.toUpperCase()} ${finca.propietario ? `- ${finca.propietario.toUpperCase()}` : ''}</th>
                        </tr>
                        <tr>
                            <th class="excel-th" style="width: 25%;">FECHA</th>
                            <th class="excel-th" style="width: 25%;">LITROS</th>
                            <th class="excel-th" style="width: 50%;">OBSERVACION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td>${formatearNumero(finca.totalLitros)}</td>
                            <td>$ ${formatearNumero(finca.precioLitroUSD || 0.8, 6)}</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Dolar</td>
                            <td>$ ${formatearNumero(finca.totalUSD, 2)}</td>
                            <td>&nbsp;</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Bs</td>
                            <td>Bs. ${formatearNumero(finca.totalBs, 2)}</td>
                            <td>Tasa: ${formatearNumero(finca.tasaBcv || state.tasaBcv || 791.3248, 4)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        });
    }
    else if (tipo === 'CHOFERES') {
        tablasHtml += `
            <table>
                <tr>
                    <th colspan="3" class="excel-banner-main">REPORTE DE BALANCE DE CHOFERES (SOBRANTE / FALTANTE)</th>
                </tr>
                <tr>
                    <td colspan="3" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
                </tr>
            </table>
        `;

        (data || []).forEach(ch => {
            let rowsHtml = '';
            (ch.detalle || []).forEach((d, idx) => {
                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                let bgStyle = '';
                let txtLitros = formatearNumero(d.litros);
                if (d.litros < 0) {
                    bgStyle = 'background-color: #ff0000 !important; color: #ffffff !important; font-weight: bold;';
                } else if (d.litros > 0) {
                    bgStyle = 'background-color: #16a34a !important; color: #ffffff !important; font-weight: bold;';
                    txtLitros = `+${txtLitros}`;
                }

                rowsHtml += `
                    <tr>
                        <td class="excel-td ${altClass}">${formatearFechaLocal(d.fecha)}</td>
                        <td class="excel-td excel-td-num" style="${bgStyle}">${txtLitros}</td>
                        <td class="excel-td excel-td-left ${altClass}">${d.observacion || ''}</td>
                    </tr>
                `;
            });

            let totalBgStyle = 'background-color: #006000 !important; color: #ffffff !important; font-weight: bold;';
            let txtTotal = formatearNumero(ch.totalLitros);
            if (ch.totalLitros < 0) {
                totalBgStyle = 'background-color: #ff0000 !important; color: #ffffff !important; font-weight: bold;';
            } else if (ch.totalLitros > 0) {
                totalBgStyle = 'background-color: #16a34a !important; color: #ffffff !important; font-weight: bold;';
                txtTotal = `+${txtTotal}`;
            }

            tablasHtml += `
                <table>
                    <thead>
                        <tr>
                            <th colspan="3" class="excel-sec-header">${ch.nombre.toUpperCase()}</th>
                        </tr>
                        <tr>
                            <th class="excel-th" style="width: 30%;">FECHA</th>
                            <th class="excel-th" style="width: 35%;">LITROS</th>
                            <th class="excel-th" style="width: 35%;">OBSERVACION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td style="${totalBgStyle}">${txtTotal}</td>
                            <td>&nbsp;</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        });
    }
    else if (tipo === 'RELACION_CHOFER') {
        let sumLitrosRuta = 0;
        let sumLitrosQuesera = 0;
        let sumDiferencias = 0;

        let rowsHtml = '';
        let fincasDetalleHtml = '';

        (data || []).forEach((r, idx) => {
            const lRuta = Number(r.litrosRuta || 0);
            const lQuesera = Number(r.litrosQuesera || 0);
            const diff = Number(r.diferencias != null ? r.diferencias : (lRuta - lQuesera));
            sumLitrosRuta += lRuta;
            sumLitrosQuesera += lQuesera;
            sumDiferencias += diff;

            const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
            rowsHtml += `
                <tr>
                    <td class="excel-td excel-td-left excel-td-bold ${altClass}">${(r.chofer || 'OTROS').toUpperCase()}</td>
                    <td class="excel-td excel-td-num ${altClass}">${formatearNumero(lRuta)}</td>
                    <td class="excel-td excel-td-num ${altClass}">${formatearNumero(lQuesera)}</td>
                    <td class="excel-td excel-td-num excel-td-bold ${altClass}">${diff > 0 ? `+${formatearNumero(diff)}` : (diff < 0 ? formatearNumero(diff) : '0')}</td>
                </tr>
            `;

            const fincas = r.detalleFincas || r.DetalleFincas || [];
            if (fincas.length > 0) {
                let fRowsHtml = '';
                fincas.forEach((f, fIdx) => {
                    const fAlt = fIdx % 2 === 1 ? 'excel-td-alt' : '';
                    fRowsHtml += `
                        <tr>
                            <td class="excel-td ${fAlt}">${formatearFechaLocal(f.fecha || f.Fecha)}</td>
                            <td class="excel-td excel-td-left excel-td-bold ${fAlt}">${(f.fincaNombre || f.FincaNombre || '').toUpperCase()}</td>
                            <td class="excel-td excel-td-left ${fAlt}">${(f.propietario || f.Propietario || '')}</td>
                            <td class="excel-td ${fAlt}">${(f.tipoLeche || f.TipoLeche || 'VACA').toUpperCase()}</td>
                            <td class="excel-td excel-td-num excel-td-bold ${fAlt}">${formatearNumero(f.litros || f.Litros)}</td>
                            <td class="excel-td excel-td-left ${fAlt}">${f.observacion || f.Observacion || '-'}</td>
                        </tr>
                    `;
                });

                fincasDetalleHtml += `
                    <table>
                        <thead>
                            <tr>
                                <th colspan="6" class="excel-sec-header">DESGLOSE DE FINCAS RECOGIDAS - ${(r.chofer || 'OTROS').toUpperCase()}</th>
                            </tr>
                            <tr>
                                <th class="excel-th" style="width: 15%;">FECHA</th>
                                <th class="excel-th excel-td-left" style="width: 25%;">FINCA</th>
                                <th class="excel-th excel-td-left" style="width: 20%;">PROPIETARIO</th>
                                <th class="excel-th" style="width: 12%;">TIPO LECHE</th>
                                <th class="excel-th" style="width: 13%;">LITROS</th>
                                <th class="excel-th excel-td-left" style="width: 15%;">OBSERVACIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fRowsHtml}
                        </tbody>
                    </table>
                `;
            }
        });

        tablasHtml += `
            <table>
                <tr>
                    <th colspan="4" class="excel-banner-main">RELACIÓN GENERAL DE CONDUCTORES</th>
                </tr>
                <tr>
                    <td colspan="4" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
                </tr>
            </table>
            <table>
                <thead>
                    <tr>
                        <th class="excel-th excel-td-left" style="width: 34%;">CONDUCTOR</th>
                        <th class="excel-th" style="width: 22%;">LITROS RUTA (FINCA)</th>
                        <th class="excel-th" style="width: 22%;">LITROS DESTINO (REC)</th>
                        <th class="excel-th" style="width: 22%;">MERMA / DIFERENCIA</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr class="excel-total-row">
                        <td class="excel-td-left">TOTAL GENERAL</td>
                        <td>${formatearNumero(sumLitrosRuta)}</td>
                        <td>${formatearNumero(sumLitrosQuesera)}</td>
                        <td>${sumDiferencias > 0 ? `+${formatearNumero(sumDiferencias)}` : formatearNumero(sumDiferencias)}</td>
                    </tr>
                </tfoot>
            </table>
            ${fincasDetalleHtml}
        `;
    }
    else if (tipo === 'BANCOS') {
        tablasHtml += `
            <table>
                <tr>
                    <th colspan="10" class="excel-banner-main">REPORTE DE LIQUIDACIÓN BANCARIA</th>
                </tr>
                <tr>
                    <td colspan="10" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
                </tr>
            </table>
        `;

        const bancosMap = new Map();
        data.forEach(item => {
            const banco = item.bancoNombre || 'SIN BANCO ASIGNADO';
            if (!bancosMap.has(banco)) bancosMap.set(banco, []);
            bancosMap.get(banco).push(item);
        });

        let grandTotalLitros = 0;
        let grandTotalUSD = 0;
        let grandTotalAdelUSD = 0;
        let grandTotalAdelBs = 0;
        let grandTotalNetoBs = 0;

        bancosMap.forEach((fincas, bancoNombre) => {
            let subLitros = 0;
            let subUSD = 0;
            let subAdelUSD = 0;
            let subAdelBs = 0;
            let subNetoBs = 0;

            let rowsHtml = '';
            fincas.forEach((f, idx) => {
                subLitros += f.totalLitros;
                subUSD += f.totalUSD;
                subAdelUSD += f.totalAdelantosUSD;
                subAdelBs += f.totalAdelantosBs;
                subNetoBs += f.totalNetoBs;

                grandTotalLitros += f.totalLitros;
                grandTotalUSD += f.totalUSD;
                grandTotalAdelUSD += f.totalAdelantosUSD;
                grandTotalAdelBs += f.totalAdelantosBs;
                grandTotalNetoBs += f.totalNetoBs;

                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rowsHtml += `
                    <tr>
                        <td class="excel-td excel-td-left excel-td-bold ${altClass}">${f.fincaNombre}</td>
                        <td class="excel-td excel-td-left ${altClass}">${f.propietario}</td>
                        <td class="excel-td excel-td-mono ${altClass}">${f.cedulaRIF}</td>
                        <td class="excel-td excel-td-mono ${altClass}" style="color: #1d4ed8;">${f.numeroCuenta}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(f.totalLitros)}</td>
                        <td class="excel-td excel-td-num ${altClass}">$ ${formatearNumero(f.precioLitroUSD, 4)}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}" style="color: #047857;">$ ${formatearNumero(f.totalUSD, 2)}</td>
                        <td class="excel-td excel-td-num ${altClass}" style="color: #e11d48;">${f.totalAdelantosUSD > 0 ? `$ ${formatearNumero(f.totalAdelantosUSD, 2)}` : '-'}</td>
                        <td class="excel-td excel-td-currency ${altClass}" style="color: #e11d48;">${f.totalAdelantosBs > 0 ? `Bs. ${formatearNumero(f.totalAdelantosBs, 2)}` : '-'}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}" style="color: #b45309;">Bs. ${formatearNumero(f.totalNetoBs, 2)}</td>
                        <td class="excel-td ${altClass}">${f.pagado ? 'PAGADO' : 'PENDIENTE'}</td>
                    </tr>
                `;
            });

            tablasHtml += `
                <table>
                    <thead>
                        <tr>
                            <th colspan="11" class="excel-sec-header">BANCO: ${bancoNombre.toUpperCase()}</th>
                        </tr>
                        <tr>
                            <th class="excel-th">FINCA</th>
                            <th class="excel-th">PROPIETARIO</th>
                            <th class="excel-th">C.I. / RIF</th>
                            <th class="excel-th">N° DE CUENTA</th>
                            <th class="excel-th">LITROS</th>
                            <th class="excel-th">PRECIO ($)</th>
                            <th class="excel-th">TOTAL ($)</th>
                            <th class="excel-th">ADEL. ($)</th>
                            <th class="excel-th">ADEL. (BS)</th>
                            <th class="excel-th">NETO (BS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td colspan="4">SUBTOTAL ${bancoNombre}</td>
                            <td>${formatearNumero(subLitros)}</td>
                            <td>&nbsp;</td>
                            <td>$ ${formatearNumero(subUSD, 2)}</td>
                            <td>$ ${formatearNumero(subAdelUSD, 2)}</td>
                            <td>Bs. ${formatearNumero(subAdelBs, 2)}</td>
                            <td>Bs. ${formatearNumero(subNetoBs, 2)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        });

        tablasHtml += `
            <table>
                <tr class="excel-grand-total">
                    <td colspan="4">GRAN TOTAL NÓMINA GENERAL</td>
                    <td>${formatearNumero(grandTotalLitros)} Lts</td>
                    <td>&nbsp;</td>
                    <td>$ ${formatearNumero(grandTotalUSD, 2)}</td>
                    <td>$ ${formatearNumero(grandTotalAdelUSD, 2)}</td>
                    <td>Bs. ${formatearNumero(grandTotalAdelBs, 2)}</td>
                    <td>Bs. ${formatearNumero(grandTotalNetoBs, 2)}</td>
                </tr>
            </table>
        `;
    }
    else if (tipo === 'RELACION_PAGOS_COMPANIAS') {
        tablasHtml += `
            <table>
                <tr>
                    <th colspan="9" class="excel-banner-main">RELACIÓN DE PAGOS DE COMPAÑÍAS / PLANTAS</th>
                </tr>
                <tr>
                    <td colspan="9" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)} | Tasa BCV: Bs. ${formatearNumero(state.tasaBcv || 791.3248, 4)}</td>
                </tr>
            </table>
        `;

        let grandLitros = 0;
        let grandBrutoUSD = 0;
        let grandBrutoBs = 0;
        let grandAbonosUSD = 0;
        let grandAbonosBs = 0;
        let grandNetoBs = 0;
        let grandNetoUSD = 0;

        const companiasValidas = (data || []).filter(c => {
            const lit = c.totalLitros || c.TotalLitros || 0;
            const abUSD = c.totalAbonosUSD || c.TotalAbonosUSD || 0;
            const abBs = c.totalAbonosBs || c.TotalAbonosBs || 0;
            return (lit > 0) || (abUSD > 0) || (abBs > 0);
        });

        const listTransp = companiasValidas.filter(c => {
            const nom = (c.companiaNombre || c.CompaniaNombre || '').toUpperCase();
            const tip = (c.tipoServicio || c.TipoServicio || '').toUpperCase();
            return tip.includes('TRANSP') || nom.includes('TRANSP') || nom.includes('FLETE') || nom.includes('UPACA') || nom.includes('GENICA') || nom.includes('DESAPERCA') || nom.includes('COLONA');
        });

        const listRuta = companiasValidas.filter(c => !listTransp.includes(c));

        function generarSeccionExcelCompania(items, tituloSeccion, bgHeader) {
            if (items.length === 0) return '';
            let sLit = 0, sBUSD = 0, sBBs = 0, sAUSD = 0, sABs = 0, sNBs = 0, sNUSD = 0;
            let rows = '';

            items.forEach((c, idx) => {
                const nom = c.companiaNombre || c.CompaniaNombre || '';
                const enc = c.encargado || c.Encargado || '';
                const tel = c.telefono || c.Telefono || '';
                const lit = c.totalLitros || c.TotalLitros || 0;
                const pre = c.precioLitroUSD || c.PrecioLitroUSD || 0;
                const bUSD = c.totalUSD || c.TotalUSD || 0;
                const bBs = c.totalBrutoBs || c.TotalBrutoBs || 0;
                const aUSD = c.totalAbonosUSD || c.TotalAbonosUSD || 0;
                const aBs = c.totalAbonosBs || c.TotalAbonosBs || 0;
                const nBs = c.totalNetoBs || c.TotalNetoBs || 0;
                const nUSD = c.totalNetoUSD || c.TotalNetoUSD || 0;

                sLit += lit; sBUSD += bUSD; sBBs += bBs; sAUSD += aUSD; sABs += aBs; sNBs += nBs; sNUSD += nUSD;
                grandLitros += lit; grandBrutoUSD += bUSD; grandBrutoBs += bBs; grandAbonosUSD += aUSD; grandAbonosBs += aBs; grandNetoBs += nBs; grandNetoUSD += nUSD;

                const ents = c.entregasDetalle || c.EntregasDetalle || [];
                let lVaca = 0, lBufala = 0, lAcida = 0;
                ents.forEach(e => {
                    const eL = Number(e.litros || e.Litros || 0);
                    const o = (e.observacion || e.Observacion || '').toUpperCase();
                    const t = (e.tipoLeche || e.TipoLeche || '').toUpperCase();
                    if (e.esAcida || o.includes('ACID') || o.includes('ÁCID')) lAcida += eL;
                    if (t.includes('BUFAL') || o.includes('BUFAL')) lBufala += eL;
                    else lVaca += eL;
                });
                if (ents.length === 0 && lit > 0) {
                    if (nom.toUpperCase().includes('BUFAL')) lBufala = lit;
                    else lVaca = lit;
                }
                let detTxtParts = [];
                if (lVaca > 0) detTxtParts.push(`Vaca: ${formatearNumero(lVaca)}L`);
                if (lBufala > 0) detTxtParts.push(`Búfala: ${formatearNumero(lBufala)}L`);
                if (lAcida > 0) detTxtParts.push(`Ácida: ${formatearNumero(lAcida)}L`);
                const detTxt = detTxtParts.join(' | ') || '-';

                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rows += `
                    <tr>
                        <td class="excel-td excel-td-left excel-td-bold ${altClass}">${nom}</td>
                        <td class="excel-td excel-td-left ${altClass}">${enc} ${tel ? `(${tel})` : ''}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(lit)}</td>
                        <td class="excel-td excel-td-num ${altClass}">$ ${formatearNumero(pre, 4)}</td>
                        <td class="excel-td excel-td-left ${altClass}">${detTxt}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}">$ ${formatearNumero(bUSD, 2)}</td>
                        <td class="excel-td excel-td-currency ${altClass}">Bs. ${formatearNumero(bBs, 2)}</td>
                        <td class="excel-td excel-td-num ${altClass}" style="color: #e11d48;">${aUSD > 0 ? `-$${formatearNumero(aUSD, 2)} ` : ''}${aBs > 0 ? `-Bs.${formatearNumero(aBs, 2)}` : (aUSD <= 0 ? '-' : '')}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}" style="color: #047857;">Bs. ${formatearNumero(nBs, 2)}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}" style="color: #0f766e;">$ ${formatearNumero(nUSD, 2)}</td>
                    </tr>
                `;
            });

            return `
                <table>
                    <thead>
                        <tr>
                            <th colspan="10" class="excel-sec-header" style="${bgHeader}">${tituloSeccion} (${items.length})</th>
                        </tr>
                        <tr>
                            <th class="excel-th">COMPAÑÍA / PLANTA</th>
                            <th class="excel-th">ENCARGADO</th>
                            <th class="excel-th">LITROS</th>
                            <th class="excel-th">PRECIO ($/L)</th>
                            <th class="excel-th">DETALLE</th>
                            <th class="excel-th">TOTAL BRUTO ($)</th>
                            <th class="excel-th">TOTAL BRUTO (BS)</th>
                            <th class="excel-th">ABONOS / DED.</th>
                            <th class="excel-th">NETO (BS)</th>
                            <th class="excel-th">NETO ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td colspan="2">SUBTOTAL ${tituloSeccion}</td>
                            <td>${formatearNumero(sLit)} Lts</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>$ ${formatearNumero(sBUSD, 2)}</td>
                            <td>Bs. ${formatearNumero(sBBs, 2)}</td>
                            <td>${sAUSD > 0 ? `-$${formatearNumero(sAUSD, 2)} ` : ''}${sABs > 0 ? `-Bs.${formatearNumero(sABs, 2)}` : ''}</td>
                            <td>Bs. ${formatearNumero(sNBs, 2)}</td>
                            <td>$ ${formatearNumero(sNUSD, 2)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        }

        tablasHtml += generarSeccionExcelCompania(listTransp, 'SERVICIO DE TRANSPORTE (FLETES)', 'background-color: #7e22ce !important; color: #ffffff !important;');
        tablasHtml += generarSeccionExcelCompania(listRuta, 'SERVICIO DE RUTA (VENTA DE LECHE PROPIA)', 'background-color: #059669 !important; color: #ffffff !important;');

        tablasHtml += `
            <table>
                <tfoot>
                    <tr class="excel-grand-total">
                        <td colspan="2">GRAN TOTAL CONSOLIDADO (${companiasValidas.length} Compañías)</td>
                        <td>${formatearNumero(grandLitros)} Lts</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>$ ${formatearNumero(grandBrutoUSD, 2)}</td>
                        <td>Bs. ${formatearNumero(grandBrutoBs, 2)}</td>
                        <td>${grandAbonosUSD > 0 ? `-$${formatearNumero(grandAbonosUSD, 2)} ` : ''}${grandAbonosBs > 0 ? `-Bs.${formatearNumero(grandAbonosBs, 2)}` : ''}</td>
                        <td>Bs. ${formatearNumero(grandNetoBs, 2)}</td>
                        <td>$ ${formatearNumero(grandNetoUSD, 2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    descargarExcelConDiseno(tablasHtml, `Reporte_${tipo}_${fechaDesde}_al_${fechaHasta}`, `Reporte ${tipo}`);
}
window.exportarReporteActualExcel = exportarReporteActualExcel;

function exportarSeccionExcel(tituloSeccion) {
    if (!datosReporteActual || !datosReporteActual.data) {
        showToast('No hay datos generados para exportar.', 'warning');
        return;
    }

    const { tipo, data, fechaDesde, fechaHasta } = datosReporteActual;
    let tablasHtml = `
        <table>
            <tr>
                <th colspan="2" class="excel-banner-main">${tituloSeccion.toUpperCase()}</th>
            </tr>
            <tr>
                <td colspan="2" class="excel-banner-sub">Período: ${formatearFechaLocal(fechaDesde)} al ${formatearFechaLocal(fechaHasta)}</td>
            </tr>
        </table>
    `;

    if (tipo === 'DIARIOS') {
        let items = [];
        let total = 0;
        if (tituloSeccion === 'DIARIO RUTAS') {
            items = data.diarioRutas || [];
            total = data.totalDiarioRutas || 0;
        } else if (tituloSeccion === 'DIARIO RECEPTORIAS') {
            items = data.diarioReceptorias || [];
            total = data.totalDiarioReceptorias || 0;
        } else if (tituloSeccion === 'DIARIO TRANSPORTE RUTAS') {
            items = data.diarioTransporteRutas || [];
            total = data.totalDiarioTransporteRutas || 0;
        } else if (tituloSeccion === 'DIARIO TRANSPORTE RECEPTORIAS') {
            items = data.diarioTransporteReceptorias || [];
            total = data.totalDiarioTransporteReceptorias || 0;
        }
        tablasHtml += generarHtmlTablaDiarioExcel(tituloSeccion, items, total);
        descargarExcelConDiseno(tablasHtml, `${tituloSeccion.replace(/\s+/g, '_')}_${fechaDesde}_al_${fechaHasta}`, tituloSeccion);
        return;
    }

    if (tipo === 'RECEPTORIAS') {
        const item = (data || []).find(c => c.nombre.toUpperCase() === tituloSeccion.toUpperCase() || tituloSeccion.toUpperCase().includes(c.nombre.toUpperCase()));
        if (item) {
            let rowsHtml = '';
            (item.detalle || []).forEach((d, idx) => {
                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rowsHtml += `
                    <tr>
                        <td class="excel-td ${altClass}">${formatearFechaLocal(d.fecha)}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(d.litros)}</td>
                        <td class="excel-td excel-td-left ${altClass}">${d.observacion || '-'}</td>
                    </tr>
                `;
            });
            const tabla = `
                <table>
                    <thead>
                        <tr>
                            <th colspan="3" class="excel-sec-header">RECEPTORIA: ${item.nombre.toUpperCase()}</th>
                        </tr>
                        <tr>
                            <th class="excel-th" style="width: 25%;">FECHA</th>
                            <th class="excel-th" style="width: 25%;">LITROS</th>
                            <th class="excel-th" style="width: 50%;">OBSERVACION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td>${formatearNumero(item.totalLitros)}</td>
                            <td>$ ${formatearNumero(item.precioLitroUSD || 0.8, 6)}</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Dolar</td>
                            <td>$ ${formatearNumero(item.totalUSD, 2)}</td>
                            <td>&nbsp;</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Bs</td>
                            <td>Bs. ${formatearNumero(item.totalBs, 2)}</td>
                            <td>Tasa: ${formatearNumero(item.tasaBcv || state.tasaBcv || 791.3248, 4)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
            descargarExcelConDiseno(tablasHtml + tabla, `Receptoria_${item.nombre.replace(/\s+/g, '_')}_${fechaDesde}_al_${fechaHasta}`, item.nombre);
            return;
        }
    }

    if (tipo === 'FINCAS') {
        const item = (data || []).find(f => f.nombre.toUpperCase() === tituloSeccion.toUpperCase() || tituloSeccion.toUpperCase().includes(f.nombre.toUpperCase()));
        if (item) {
            let rowsHtml = '';
            (item.detalle || []).forEach((d, idx) => {
                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rowsHtml += `
                    <tr>
                        <td class="excel-td ${altClass}">${formatearFechaLocal(d.fecha)}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(d.litros)}</td>
                        <td class="excel-td excel-td-left ${altClass}">${d.observacion || '-'}</td>
                    </tr>
                `;
            });

            const mostrarAdelanto = !!state.mostrarAdelantoReporteFincas;
            const adelantoManual = (window.adelantosManualesFincasReporte && window.adelantosManualesFincasReporte[item.id] !== undefined)
                ? window.adelantosManualesFincasReporte[item.id]
                : (item.totalAdelantosUSD || 0);
            const adelantoUSD = adelantoManual;
            const tasaBCV = item.tasaBcv || state.tasaBcv || 801.1752;
            const adelantoBs = (item.totalAdelantosBs && !window.adelantosManualesFincasReporte?.[item.id])
                ? item.totalAdelantosBs
                : (adelantoUSD * tasaBCV);
            const netoUSD = Math.max(0, item.totalUSD - adelantoUSD);
            const netoBs = Math.max(0, item.totalBs - adelantoBs);

            const tfootExcel = mostrarAdelanto ? `
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td>${formatearNumero(item.totalLitros)}</td>
                            <td>$ ${formatearNumero(item.precioLitroUSD || 0.8, 6)}</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Dólar Bruto</td>
                            <td>$ ${formatearNumero(item.totalUSD, 2)}</td>
                            <td>&nbsp;</td>
                        </tr>
                        <tr class="excel-total-row" style="background-color: #fee2e2;">
                            <td>(-) Adelanto USD</td>
                            <td>-$ ${formatearNumero(adelantoUSD, 2)}</td>
                            <td>Neto: $ ${formatearNumero(netoUSD, 2)}</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Bs Bruto</td>
                            <td>Bs. ${formatearNumero(item.totalBs, 2)}</td>
                            <td>Tasa: ${formatearNumero(tasaBCV, 4)}</td>
                        </tr>
                        <tr class="excel-total-row" style="background-color: #dcfce7; font-weight: bold;">
                            <td>TOTAL NETO BS</td>
                            <td>Bs. ${formatearNumero(netoBs, 2)}</td>
                            <td>(-) Bs. ${formatearNumero(adelantoBs, 2)}</td>
                        </tr>
                    </tfoot>
            ` : `
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td>${formatearNumero(item.totalLitros)}</td>
                            <td>$ ${formatearNumero(item.precioLitroUSD || 0.8, 6)}</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Dolar</td>
                            <td>$ ${formatearNumero(item.totalUSD, 2)}</td>
                            <td>&nbsp;</td>
                        </tr>
                        <tr class="excel-total-row">
                            <td>Valor Bs</td>
                            <td>Bs. ${formatearNumero(item.totalBs, 2)}</td>
                            <td>Tasa: ${formatearNumero(tasaBCV, 4)}</td>
                        </tr>
                    </tfoot>
            `;

            const tabla = `
                <table>
                    <thead>
                        <tr>
                            <th colspan="3" class="excel-sec-header">FINCA: ${item.nombre.toUpperCase()} ${item.propietario ? `- ${item.propietario.toUpperCase()}` : ''}</th>
                        </tr>
                        <tr>
                            <th class="excel-th" style="width: 25%;">FECHA</th>
                            <th class="excel-th" style="width: 25%;">LITROS</th>
                            <th class="excel-th" style="width: 50%;">OBSERVACION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    ${tfootExcel}
                </table>
            `;
            descargarExcelConDiseno(tablasHtml + tabla, `Finca_${item.nombre.replace(/\s+/g, '_')}_${fechaDesde}_al_${fechaHasta}`, item.nombre);
            return;
        }
    }

    if (tipo === 'CHOFERES') {
        const item = (data || []).find(c => c.nombre.toUpperCase() === tituloSeccion.toUpperCase() || tituloSeccion.toUpperCase().includes(c.nombre.toUpperCase()));
        if (item) {
            let rowsHtml = '';
            (item.detalle || []).forEach((d, idx) => {
                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                const textoLitros = d.litros < 0 ? `-${formatearNumero(Math.abs(d.litros))}` : (d.litros > 0 ? `+${formatearNumero(d.litros)}` : '0');
                const colorLitros = d.litros < 0 ? '#ff0000' : (d.litros > 0 ? '#16a34a' : '#000000');
                rowsHtml += `
                    <tr>
                        <td class="excel-td ${altClass}">${formatearFechaLocal(d.fecha)}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}" style="color: ${colorLitros};">${textoLitros}</td>
                        <td class="excel-td excel-td-left ${altClass}">${d.observacion || '-'}</td>
                    </tr>
                `;
            });
            const textoTotal = item.totalLitros < 0 ? `-${formatearNumero(Math.abs(item.totalLitros))}` : (item.totalLitros > 0 ? `+${formatearNumero(item.totalLitros)}` : '0');
            const colorTotal = item.totalLitros < 0 ? '#ff0000' : (item.totalLitros > 0 ? '#16a34a' : '#000000');
            const tabla = `
                <table>
                    <thead>
                        <tr>
                            <th colspan="3" class="excel-sec-header">${item.nombre.toUpperCase()}</th>
                        </tr>
                        <tr>
                            <th class="excel-th" style="width: 30%;">FECHA</th>
                            <th class="excel-th" style="width: 35%;">LITROS</th>
                            <th class="excel-th" style="width: 35%;">OBSERVACION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td>TOTAL</td>
                            <td style="color: ${colorTotal}; font-weight: bold;">${textoTotal}</td>
                            <td>&nbsp;</td>
                        </tr>
                    </tfoot>
                </table>
            `;
            descargarExcelConDiseno(tablasHtml + tabla, `Chofer_${item.nombre.replace(/\s+/g, '_')}_${fechaDesde}_al_${fechaHasta}`, item.nombre);
            return;
        }
    }

    if (tipo === 'BANCOS') {
        const fincas = (data || []).filter(item => (item.bancoNombre || 'SIN BANCO ASIGNADO').toUpperCase() === tituloSeccion.toUpperCase());
        if (fincas.length > 0) {
            let subLitros = 0;
            let subUSD = 0;
            let subAdelUSD = 0;
            let subAdelBs = 0;
            let subNetoBs = 0;

            let rowsHtml = '';
            fincas.forEach((f, idx) => {
                subLitros += f.totalLitros;
                subUSD += f.totalUSD;
                subAdelUSD += f.totalAdelantosUSD;
                subAdelBs += f.totalAdelantosBs;
                subNetoBs += f.totalNetoBs;

                const altClass = idx % 2 === 1 ? 'excel-td-alt' : '';
                rowsHtml += `
                    <tr>
                        <td class="excel-td excel-td-left excel-td-bold ${altClass}">${f.fincaNombre}</td>
                        <td class="excel-td excel-td-left ${altClass}">${f.propietario}</td>
                        <td class="excel-td excel-td-mono ${altClass}">${f.cedulaRIF}</td>
                        <td class="excel-td excel-td-mono ${altClass}" style="color: #1d4ed8;">${f.numeroCuenta}</td>
                        <td class="excel-td excel-td-bold excel-td-num ${altClass}">${formatearNumero(f.totalLitros)}</td>
                        <td class="excel-td excel-td-num ${altClass}">$ ${formatearNumero(f.precioLitroUSD, 4)}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}" style="color: #047857;">$ ${formatearNumero(f.totalUSD, 2)}</td>
                        <td class="excel-td excel-td-num ${altClass}" style="color: #e11d48;">${f.totalAdelantosUSD > 0 ? `$ ${formatearNumero(f.totalAdelantosUSD, 2)}` : '-'}</td>
                        <td class="excel-td excel-td-currency ${altClass}" style="color: #e11d48;">${f.totalAdelantosBs > 0 ? `Bs. ${formatearNumero(f.totalAdelantosBs, 2)}` : '-'}</td>
                        <td class="excel-td excel-td-bold excel-td-currency ${altClass}" style="color: #b45309;">Bs. ${formatearNumero(f.totalNetoBs, 2)}</td>
                    </tr>
                `;
            });

            const tabla = `
                <table>
                    <thead>
                        <tr>
                            <th colspan="10" class="excel-sec-header">BANCO: ${tituloSeccion.toUpperCase()}</th>
                        </tr>
                        <tr>
                            <th class="excel-th">FINCA</th>
                            <th class="excel-th">PROPIETARIO</th>
                            <th class="excel-th">C.I. / RIF</th>
                            <th class="excel-th">N° DE CUENTA</th>
                            <th class="excel-th">LITROS</th>
                            <th class="excel-th">PRECIO ($)</th>
                            <th class="excel-th">TOTAL ($)</th>
                            <th class="excel-th">ADEL. ($)</th>
                            <th class="excel-th">ADEL. (BS)</th>
                            <th class="excel-th">NETO (BS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td colspan="4">SUBTOTAL ${tituloSeccion}</td>
                            <td>${formatearNumero(subLitros)}</td>
                            <td>&nbsp;</td>
                            <td>$ ${formatearNumero(subUSD, 2)}</td>
                            <td>$ ${formatearNumero(subAdelUSD, 2)}</td>
                            <td>Bs. ${formatearNumero(subAdelBs, 2)}</td>
                            <td>Bs. ${formatearNumero(subNetoBs, 2)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
            descargarExcelConDiseno(tablasHtml + tabla, `Banco_${tituloSeccion.replace(/\s+/g, '_')}_${fechaDesde}_al_${fechaHasta}`, tituloSeccion);
            return;
        }
    }

    // Fallback general
    exportarReporteActualExcel();
}
window.exportarSeccionExcel = exportarSeccionExcel;

function imprimirReporteActual() {
    window.print();
}
window.imprimirReporteActual = imprimirReporteActual;

// --------------------------------------------------------------------------
// MÓDULO FINCAS: ACTUALIZACIÓN MASIVA Y LOG DE HISTORIAL DE PRECIOS ($/LT)
// --------------------------------------------------------------------------

function abrirModalPreciosMasivo() {
    const fincasActivas = (state.fincas || []).filter(f => f.activo || f.Activo);
    const countEl = document.getElementById('lblFincasActivasCount');
    if (countEl) countEl.innerText = fincasActivas.length;

    let suma = 0;
    fincasActivas.forEach(f => { suma += Number(f.precioLitroUSD || f.PrecioLitroUSD || 0); });
    const promedio = fincasActivas.length > 0 ? (suma / fincasActivas.length) : 0;

    const promEl = document.getElementById('lblPrecioPromedioActual');
    if (promEl) promEl.innerText = `$${promedio.toFixed(4)}`;

    const inputNuevo = document.getElementById('inputNuevoPrecioMasivo');
    if (inputNuevo) inputNuevo.value = '';

    const inputObs = document.getElementById('inputObservacionPrecioMasivo');
    if (inputObs) inputObs.value = '';

    const boxPreview = document.getElementById('boxPreviewPrecioMasivo');
    if (boxPreview) boxPreview.style.display = 'none';

    abrirModalCustom('modalActualizarPreciosMasivo');
}
window.abrirModalPreciosMasivo = abrirModalPreciosMasivo;

function calcularVistaPreviaPrecioMasivo() {
    const raw = (document.getElementById('inputNuevoPrecioMasivo')?.value || '').trim().replace(',', '.');
    const val = parseFloat(raw) || 0;
    const boxPreview = document.getElementById('boxPreviewPrecioMasivo');
    const lblPreview = document.getElementById('lblPreviewPrecioValor');
    if (val > 0) {
        if (boxPreview) boxPreview.style.display = 'block';
        if (lblPreview) lblPreview.innerText = `$${val.toFixed(4)}`;
    } else {
        if (boxPreview) boxPreview.style.display = 'none';
    }
}
window.calcularVistaPreviaPrecioMasivo = calcularVistaPreviaPrecioMasivo;

async function guardarPreciosMasivoSubmit() {
    const inputNuevo = document.getElementById('inputNuevoPrecioMasivo');
    const raw = (inputNuevo?.value || '').trim().replace(',', '.');
    const val = parseFloat(raw) || 0;
    if (val <= 0 || isNaN(val)) {
        Swal.fire({ icon: 'warning', title: 'Precio Inválido', text: 'Por favor ingresa un precio por litro ($/LT) válido mayor a 0.', background: '#1e293b', color: '#fff' });
        return;
    }

    const fincasActivasCount = (state.fincas || []).filter(f => f.activo || f.Activo).length;

    const confirm = await Swal.fire({
        title: '¿Confirmar Cambio Masivo?',
        html: `¿Estás seguro de actualizar el precio por litro a <strong style="color:#34d399; font-size:18px;">$${val.toFixed(4)} USD</strong> en <strong>${fincasActivasCount} fincas activas</strong>?<br><br><small style="color:#94a3b8;">Se creará un único registro MASIVO en el Log de Historial.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Actualizar Todas',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        background: '#1e293b',
        color: '#fff'
    });

    if (!confirm.isConfirmed) return;

    const btn = document.getElementById('btnGuardarPreciosMasivo');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...'; }

    try {
        const obs = document.getElementById('inputObservacionPrecioMasivo')?.value || '';
        const res = await fetch(`${API_BASE}/catalogos/fincas/precios-masivo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                nuevoPrecioUSD: val,
                soloActivos: true,
                observacion: obs
            })
        });

        if (res.ok) {
            const data = await res.json();
            cerrarModalCustom('modalActualizarPreciosMasivo');
            Swal.fire({
                icon: 'success',
                title: '¡Actualización Exitosa!',
                text: data.message || `Se actualizaron ${data.cantidadAfectadas} fincas correctamente.`,
                background: '#1e293b',
                color: '#fff'
            });
            if (typeof cargarFincasCat === 'function') {
                await cargarFincasCat();
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire({ icon: 'error', title: 'Error', text: errData.message || 'No se pudieron actualizar los precios.', background: '#1e293b', color: '#fff' });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error de Conexión', text: e.message, background: '#1e293b', color: '#fff' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
    }
}
window.guardarPreciosMasivoSubmit = guardarPreciosMasivoSubmit;

async function abrirModalHistorialPrecios() {
    const inputBuscar = document.getElementById('inputBuscarHistorialPrecios');
    if (inputBuscar) inputBuscar.value = '';
    const filtroTipo = document.getElementById('filtroTipoHistorialPrecios');
    if (filtroTipo) filtroTipo.value = 'TODOS';

    abrirModalCustom('modalHistorialPrecios');
    await cargarHistorialPrecios();
}
window.abrirModalHistorialPrecios = abrirModalHistorialPrecios;

async function cargarHistorialPrecios() {
    const tbody = document.getElementById('tbodyHistorialPrecios');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 30px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando log de auditoría...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/catalogos/fincas/historial-precios`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            state.historialPrecios = data || [];

            // Actualizar KPIs del modal
            const total = state.historialPrecios.length;
            const masivos = state.historialPrecios.filter(x => (x.tipoCambio || '').toUpperCase() === 'MASIVO').length;
            const individuales = state.historialPrecios.filter(x => (x.tipoCambio || '').toUpperCase() !== 'MASIVO').length;

            const elTotal = document.getElementById('lblLogPreciosTotalCount') || document.getElementById('kpiTotalCambiosPrecios');
            if (elTotal) elTotal.innerText = total.toLocaleString();
            const elMasivos = document.getElementById('lblLogPreciosMasivosCount') || document.getElementById('kpiCambiosMasivosPrecios');
            if (elMasivos) elMasivos.innerText = masivos.toLocaleString();
            const elInd = document.getElementById('lblLogPreciosIndivCount') || document.getElementById('kpiCambiosIndividualesPrecios');
            if (elInd) elInd.innerText = individuales.toLocaleString();

            filtrarHistorialPrecios();
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #dc2626; padding: 24px;">Error al cargar el historial: ${e.message}</td></tr>`;
    }
}
window.cargarHistorialPrecios = cargarHistorialPrecios;

function filtrarHistorialPrecios() {
    const tbody = document.getElementById('tbodyHistorialPrecios');
    if (!tbody) return;

    const lista = state.historialPrecios || [];
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 30px; color: #64748b; font-weight: 600;"><i class="fa-solid fa-circle-info" style="color: #94a3b8; margin-right: 6px;"></i> No hay registros en el historial de precios.</td></tr>';
        return;
    }

    const q = (document.getElementById('inputBuscarHistorialPrecios')?.value || '').toLowerCase().trim();
    const tipo = (document.getElementById('filtroTipoHistorialPrecios')?.value || 'TODOS').toUpperCase();

    const filtrados = lista.filter(item => {
        const matchesTipo = tipo === 'TODOS' || (item.tipoCambio || '').toUpperCase() === tipo;
        if (!matchesTipo) return false;

        if (!q) return true;
        const nom = (item.fincaNombre || '').toLowerCase();
        const obs = (item.observacion || '').toLowerCase();
        const usr = (item.usuarioNombre || '').toLowerCase();
        return nom.includes(q) || obs.includes(q) || usr.includes(q);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 26px; color: #64748b; font-weight: 600;"><i class="fa-solid fa-magnifying-glass" style="color: #94a3b8; margin-right: 6px;"></i> No se encontraron registros con los filtros seleccionados.</td></tr>';
        return;
    }

    let html = '';
    filtrados.forEach((item, idx) => {
        const fechaStr = item.fechaRegistro ? new Date(item.fechaRegistro).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'medium' }) : 'N/A';
        const tipoUpper = (item.tipoCambio || '').toUpperCase();
        let badgeTipo = '';
        if (tipoUpper === 'MASIVO') {
            badgeTipo = '<span class="badge" style="background: #eff6ff; border: 1.5px solid #bfdbfe; color: #1d4ed8; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-bolt" style="margin-right: 3px;"></i> MASIVO</span>';
        } else if (tipoUpper === 'COMPANIA' || tipoUpper === 'COMPAÑIA') {
            badgeTipo = '<span class="badge" style="background: #faf5ff; border: 1.5px solid #e9d5ff; color: #7e22ce; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-building" style="margin-right: 3px;"></i> COMPAÑÍA</span>';
        } else {
            badgeTipo = '<span class="badge" style="background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #047857; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-cow" style="margin-right: 3px;"></i> FINCA</span>';
        }

        const pAnt = Number(item.precioAnterior || 0);
        const pNue = Number(item.precioNuevo || 0);
        const dif = pNue - pAnt;

        const difHtml = dif > 0 
            ? `<span style="display: inline-block; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11.5px;"><i class="fa-solid fa-arrow-trend-up"></i> +$${dif.toFixed(4)}</span>` 
            : (dif < 0 
                ? `<span style="display: inline-block; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11.5px;"><i class="fa-solid fa-arrow-trend-down"></i> -$${Math.abs(dif).toFixed(4)}</span>` 
                : '<span style="color: #94a3b8; font-weight: 600; font-size: 12px;">$0.0000</span>');

        const fincaDisplay = item.fincaNombre ? `<span style="color: #0f172a; font-weight: 700; font-size: 13px;">${capitalizarTexto(item.fincaNombre)}</span>` : '<span style="color: #2563eb; font-weight: 800; font-size: 12px;"><i class="fa-solid fa-earth-americas" style="margin-right: 4px;"></i> TODAS LAS FINCAS (GLOBAL)</span>';

        const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        html += `
            <tr style="background: ${bgRow}; border-bottom: 1px solid #e2e8f0; transition: background 0.15s ease;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='${bgRow}'">
                <td style="padding: 10px 14px; font-size: 12px; color: #475569; font-weight: 600; white-space: nowrap;">${fechaStr}</td>
                <td style="padding: 10px 14px; text-align: center;">${badgeTipo}</td>
                <td style="padding: 10px 14px;">${fincaDisplay}</td>
                <td style="padding: 10px 14px; text-align: right; color: #64748b; font-weight: 700; font-size: 13px;">$${pAnt.toFixed(4)}</td>
                <td style="padding: 10px 14px; text-align: right;">
                    <span style="display: inline-block; background: #ffffff; border: 1.5px solid #cbd5e1; padding: 2px 8px; border-radius: 6px; color: #0f172a; font-weight: 900; font-size: 13px;">
                        $${pNue.toFixed(4)}
                    </span>
                </td>
                <td style="padding: 10px 14px; text-align: right;">${difHtml}</td>
                <td style="padding: 10px 14px; font-size: 12.5px; color: #334155; font-weight: 600;">${item.usuarioNombre ? capitalizarTexto(item.usuarioNombre) : '<span style="color: #94a3b8;">Sistema</span>'}</td>
                <td style="padding: 10px 14px; font-size: 12px; color: #64748b; max-width: 200px; word-break: break-word;">${item.observacion || '-'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
window.filtrarHistorialPrecios = filtrarHistorialPrecios;

async function ejecutarCapturaReporte(elementoOrigen, tituloArchivo = 'Reporte_Finca', fondo = '#ffffff') {
    if (!elementoOrigen) return;

    if (typeof html2canvas === 'undefined') {
        if (typeof showToast === 'function') showToast('Error: Librería html2canvas no disponible', 'error');
        return;
    }

    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth < 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

    const safeTitle = (tituloArchivo || 'Reporte').replace(/[\s\/\\]+/g, '_');
    const fileName = `Captura_${safeTitle}_${new Date().toISOString().slice(0, 10)}.png`;

    // =========================================================================
    // 🖥️ MODO 1: WEB (DESKTOP / LAPTOP)
    // - Captura directa del elemento
    // - Copiado al portapapeles (Ctrl + V)
    // - NUNCA descarga archivos automáticamente
    // - NUNCA abre modales en Web
    // =========================================================================
    if (!esMovil) {
        try {
            const canvas = await html2canvas(elementoOrigen, {
                scale: 2,
                backgroundColor: fondo,
                useCORS: true,
                logging: false,
                imageTimeout: 0,
                ignoreElements: (el) => {
                    return el.classList && (
                        el.classList.contains('card-actions-footer') || 
                        el.classList.contains('report-action-header') || 
                        el.classList.contains('btn-captura-card') ||
                        el.classList.contains('btn-exportar-card') ||
                        el.tagName === 'BUTTON'
                    );
                }
            });

            if (!canvas) return;

            let copiadoEnMemoria = false;

            // 1. Obtener Blob PNG garantizado
            let blob = null;
            try {
                blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            } catch (blobErr) {
                console.warn('canvas.toBlob falló:', blobErr);
            }

            if (!blob) {
                // Conversión manual DataURL a Blob si canvas.toBlob devolvió null
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    const arr = dataUrl.split(',');
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    blob = new Blob([u8arr], { type: 'image/png' });
                } catch (dataErr) {
                    console.warn('Fallback DataURL a Blob falló:', dataErr);
                }
            }

            // 2. Método Principal: Async Clipboard API nativa (localhost o HTTPS)
            if (blob && navigator.clipboard && window.ClipboardItem) {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    copiadoEnMemoria = true;
                } catch (clipErr) {
                    console.warn('navigator.clipboard.write falló, intentando selección DOM:', clipErr);
                }
            }

            // 3. Método Secundario: Copia nativa de imagen DOM en contentEditable (para HTTP / transportevc)
            if (!copiadoEnMemoria) {
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    const helper = document.createElement('div');
                    helper.contentEditable = 'true';
                    helper.style.position = 'fixed';
                    helper.style.left = '-9999px';
                    helper.style.top = '-9999px';
                    helper.style.opacity = '0';
                    helper.style.pointerEvents = 'none';

                    const img = document.createElement('img');
                    img.src = dataUrl;
                    helper.appendChild(img);
                    document.body.appendChild(helper);

                    const range = document.createRange();
                    range.selectNode(img);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);

                    copiadoEnMemoria = document.execCommand('copy');

                    sel.removeAllRanges();
                    document.body.removeChild(helper);
                } catch (execErr) {
                    console.warn('Copia por selección DOM falló:', execErr);
                }
            }

            mostrarToastPortapapeles('📋 ¡Captura copiada! Puedes pegarla con Ctrl + V');
        } catch (errWeb) {
            console.error('Error al capturar en web:', errWeb);
            if (typeof showToast === 'function') showToast('No se pudo capturar la imagen', 'error');
        }
        return; // FIN EXCLUSIVO MODO WEB
    }

    // =========================================================================
    // 📱 MODO 2: MÓVIL (TELÉFONOS / TABLETS)
    // - Clona elemento fuera de pantalla con ancho mínimo expandido (780px)
    //   para que las columnas de la tabla NUNCA salgan cortadas
    // - NO descarga automáticamente ningún archivo
    // - Abre modal de vista previa con opciones de Compartir WhatsApp / Copiar / Descargar
    // =========================================================================
    let cloneContainer = null;
    try {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Generando captura...',
                text: 'Procesando en alta resolución',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });
        }

        const anchoContenido = Math.max(elementoOrigen.scrollWidth || 0, elementoOrigen.offsetWidth || 0, 780);
        cloneContainer = document.createElement('div');
        cloneContainer.style.position = 'fixed';
        cloneContainer.style.top = '-9999px';
        cloneContainer.style.left = '-9999px';
        cloneContainer.style.width = anchoContenido + 'px';
        cloneContainer.style.maxWidth = anchoContenido + 'px';
        cloneContainer.style.background = fondo;
        cloneContainer.style.padding = '16px';
        cloneContainer.style.zIndex = '-9999';
        cloneContainer.style.boxSizing = 'border-box';
        cloneContainer.style.borderRadius = '12px';

        const clone = elementoOrigen.cloneNode(true);
        clone.querySelectorAll('.card-actions-footer, .report-action-header, button, .btn-exportar-card, .btn-captura-card').forEach(el => el.remove());
        
        clone.querySelectorAll('.table-responsive').forEach(tr => {
            tr.style.overflow = 'visible';
            tr.style.width = '100%';
            tr.style.margin = '0';
        });
        clone.querySelectorAll('table').forEach(tbl => {
            tbl.style.width = '100%';
            tbl.style.minWidth = '100%';
        });
        clone.style.width = '100%';
        clone.style.maxWidth = '100%';
        clone.style.boxShadow = 'none';
        clone.style.margin = '0';

        cloneContainer.appendChild(clone);
        document.body.appendChild(cloneContainer);

        await new Promise(r => setTimeout(r, 80));

        const canvas = await html2canvas(cloneContainer, {
            scale: 2,
            backgroundColor: fondo,
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 0,
            scrollX: 0,
            scrollY: 0,
            windowWidth: anchoContenido + 50
        });

        if (cloneContainer && cloneContainer.parentNode) {
            document.body.removeChild(cloneContainer);
            cloneContainer = null;
        }

        if (typeof Swal !== 'undefined') Swal.close();
        if (!canvas) return;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const dataUrl = canvas.toDataURL('image/png');

        // En móvil: Mostrar modal con la vista previa y acciones
        const modal = document.getElementById('modalPreviewCapturaReporte');
        const img = document.getElementById('imgPreviewCapturaReporte');
        const tituloLbl = document.getElementById('tituloPreviewCapturaModal');
        const btnCompartir = document.getElementById('btnCompartirCapturaModal');
        const btnDescargar = document.getElementById('btnDescargarCapturaModal');
        const btnCopiar = document.getElementById('btnCopiarCapturaModal');

        if (modal && img) {
            img.src = dataUrl;
            if (tituloLbl) tituloLbl.textContent = '📸 ' + (tituloArchivo || 'Reporte de Leche');

            if (btnCopiar) {
                btnCopiar.onclick = async () => {
                    try {
                        if (window.isSecureContext && navigator.clipboard && window.ClipboardItem && blob) {
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                            mostrarToastPortapapeles('📋 ¡Imagen copiada al portapapeles!');
                        } else {
                            mostrarToastPortapapeles('Mantén presionada la imagen para copiarla');
                        }
                    } catch (err) {
                        mostrarToastPortapapeles('Mantén presionada la imagen para copiarla');
                    }
                };
            }

            if (btnCompartir) {
                btnCompartir.onclick = async () => {
                    try {
                        if (navigator.share && blob && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
                            const file = new File([blob], fileName, { type: 'image/png' });
                            await navigator.share({
                                title: tituloArchivo,
                                text: `Reporte: ${tituloArchivo}`,
                                files: [file]
                            });
                        } else if (navigator.share) {
                            await navigator.share({
                                title: tituloArchivo,
                                text: `Reporte: ${tituloArchivo}`
                            });
                        } else {
                            const link = document.createElement('a');
                            link.download = fileName;
                            link.href = dataUrl;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            mostrarToastPortapapeles('¡Imagen descargada! Compártela en WhatsApp');
                        }
                    } catch (shareErr) {
                        if (shareErr.name !== 'AbortError') {
                            console.warn('Error share:', shareErr);
                        }
                    }
                };
            }

            if (btnDescargar) {
                btnDescargar.onclick = () => {
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = dataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    mostrarToastPortapapeles('¡Imagen guardada en descargas!');
                };
            }

            abrirModalCustom('modalPreviewCapturaReporte');
            mostrarToastPortapapeles('📸 ¡Captura lista!');
        } else {
            mostrarToastPortapapeles('📸 Captura generada con éxito');
        }

    } catch (errMovil) {
        if (cloneContainer && cloneContainer.parentNode) {
            document.body.removeChild(cloneContainer);
        }
        if (typeof Swal !== 'undefined') Swal.close();
        console.error('Error al capturar en móvil:', errMovil);
        if (typeof showToast === 'function') showToast('No se pudo generar la captura: ' + (errMovil.message || errMovil), 'error');
    }
}
window.ejecutarCapturaReporte = ejecutarCapturaReporte;

async function capturarCardImagen(btn, nombreFinca) {
    const card = btn.closest('.report-card-demarcada') || btn.closest('.card') || btn.closest('.card-body');
    if (!card) return;
    await ejecutarCapturaReporte(card, nombreFinca || 'Finca', '#ffffff');
}
window.capturarCardImagen = capturarCardImagen;

async function capturarReciboPagoImagen() {
    const el = document.getElementById('reciboImprimibleUsuario') || document.getElementById('areaImpresionReciboPago');
    if (!el) return;
    await ejecutarCapturaReporte(el, 'Recibo_Pago', '#ffffff');
}
window.capturarReciboPagoImagen = capturarReciboPagoImagen;


function mostrarToastPortapapeles(mensaje = '¡Imagen copiada al portapapeles!') {
    let toast = document.getElementById('customClipboardToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customClipboardToast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: #047857;
            border: 1px solid #065f46;
            color: #ffffff;
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 13.5px;
            font-weight: 700;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
            z-index: 999999;
            opacity: 0;
            transition: all 0.25s ease-out;
            pointer-events: none;
        `;
        toast.innerHTML = `
            <i class="fa-solid fa-circle-check" style="font-size: 14px; color: #a7f3d0;"></i>
            <span id="txtClipboardToast" style="color: #ffffff; font-weight: 700;">${mensaje}</span>
        `;
        document.body.appendChild(toast);
    } else {
        const txt = document.getElementById('txtClipboardToast');
        if (txt) txt.innerText = mensaje;
    }

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
    }, 2000);
}
window.mostrarToastPortapapeles = mostrarToastPortapapeles;
