// ==============================================================================
// GESTIÓN DE DATA: IMPORTACIÓN Y EXPORTACIÓN MASIVA CON EXCEL (V2)
// ==============================================================================

var entidadDataActiva = 'FINCAS';
var filasDataPrevisualizadas = [];
var infoPrerequisitosActual = null;

// Configuraciones de Plantillas y Mapeo de Columnas
const CONFIG_ENTIDADES_DATA = {
    FINCAS: {
        titulo: 'Fincas',
        icono: 'fa-cow',
        color: '#2563eb',
        subtitulo: 'Catálogo de fincas lecheras, códigos, precios por litro y asignación de propietario.',
        headersPlantilla: [
            ['CODIGO', 'NOMBRE_FINCA', 'PROPIETARIO', 'CEDULA_RIF', 'TELEFONO', 'BANCO', 'NUMERO_CUENTA', 'COMPANIA_RECEPTORIA', 'PRECIO_LITRO_USD', 'PRECIO_ACIDA_USD', 'TIPO_LECHE', 'TIENE_DOS_TIPOS_LECHE'],
            ['F-101', 'Hacienda La Esperanza', 'Juan Carlos Perez', 'V-12345678', '0414-1234567', 'BANCO DE VENEZUELA', '01020123456789012345', 'RECEPTORIA CENTRAL', 0.4200, 0.0000, 'VACA', 'NO'],
            ['F-102', 'Finca El Porvenir', 'Maria Rodriguez', 'V-87654321', '0412-9876543', 'BANESCO', '01340123456789012345', 'COLONA', 0.4500, 0.0000, 'BUFALA', 'NO'],
            ['F-103', 'Agropecuaria Santa Maria', 'Carlos Gomez', 'J-123456789', '0416-5554321', 'MERCANTIL', '01050123456789012345', 'RECEPTORIA CENTRAL', 0.4200, 0.0000, 'AMBAS', 'SI']
        ],
        mapeoColumnas: {
            codigo: ['CODIGO', 'COD', 'CODIGO_FINCA'],
            nombre: ['NOMBRE_FINCA', 'NOMBRE', 'FINCA', 'NOMBRE FINCA'],
            propietario: ['PROPIETARIO', 'PROPIETARIO_NOMBRE', 'DUEÑO', 'TITULAR', 'NOMBRE PROPIETARIO'],
            cedulaRIF: ['CEDULA_RIF', 'CEDULA', 'RIF', 'DOCUMENTO', 'CEDULA/RIF'],
            telefono: ['TELEFONO', 'TLF', 'CELULAR', 'CONTACTO'],
            bancoNombre: ['BANCO', 'BANCO_NOMBRE', 'NOMBRE BANCO'],
            numeroCuenta: ['NUMERO_CUENTA', 'CUENTA', 'NRO_CUENTA', 'CUENTA_BANCARIA'],
            companiaNombre: ['COMPANIA_RECEPTORIA', 'COMPANIA', 'RECEPTORIA', 'PLANTA', 'DESTINO'],
            precioLitroUSD: ['PRECIO_LITRO_USD', 'PRECIO_USD', 'PRECIO', 'PRECIO LITRO'],
            precioLitroAcidaUSD: ['PRECIO_ACIDA_USD', 'PRECIO_MALA_USD', 'PRECIO ACIDA'],
            tipoLeche: ['TIPO_LECHE', 'TIPO', 'LECHE'],
            tieneDosTiposLeche: ['TIENE_DOS_TIPOS_LECHE', 'DOS_TIPOS', 'DOBLE_TIPO']
        }
    },
    PROPIETARIOS: {
        titulo: 'Propietarios',
        icono: 'fa-user-tie',
        color: '#0284c7',
        subtitulo: 'Titulares y dueños de fincas lecheras, datos de contacto y cuentas bancarias.',
        headersPlantilla: [
            ['NOMBRE_COMPLETO', 'CEDULA_RIF', 'TELEFONO', 'EMAIL', 'BANCO', 'NUMERO_CUENTA', 'OBSERVACION'],
            ['Juan Carlos Perez', 'V-12345678', '0414-1234567', 'juanperez@gmail.com', 'BANCO DE VENEZUELA', '01020123456789012345', 'Titular principal Hacienda La Esperanza'],
            ['Maria Rodriguez', 'V-87654321', '0412-9876543', 'mrodriguez@gmail.com', 'BANESCO', '01340123456789012345', 'Pago Móvil activo al mismo teléfono'],
            ['Carlos Gomez', 'J-123456789', '0416-5554321', 'cgomez@agropecuaria.com', 'MERCANTIL', '01050123456789012345', 'Cuenta jurídica']
        ],
        mapeoColumnas: {
            nombre: ['NOMBRE_COMPLETO', 'NOMBRE', 'PROPIETARIO', 'TITULAR'],
            cedulaRIF: ['CEDULA_RIF', 'CEDULA', 'RIF', 'DOCUMENTO'],
            telefono: ['TELEFONO', 'TLF', 'CELULAR'],
            email: ['EMAIL', 'CORREO', 'CORREO_ELECTRONICO'],
            bancoNombre: ['BANCO', 'BANCO_NOMBRE'],
            numeroCuenta: ['NUMERO_CUENTA', 'CUENTA', 'NRO_CUENTA'],
            observacion: ['OBSERVACION', 'NOTA', 'OBSERVACIONES', 'DETALLES']
        }
    },
    COMPANIAS: {
        titulo: 'Compañías / Receptorías',
        icono: 'fa-truck',
        color: '#059669',
        subtitulo: 'Receptorías, plantas procesadoras y destinos finales donde se entrega la leche.',
        headersPlantilla: [
            ['NOMBRE_COMPANIA', 'ENCARGADO', 'TELEFONO', 'DIRECCION', 'PRECIO_COMPRA_USD', 'PRECIO_BUFALA_USD', 'PRECIO_ACIDA_USD'],
            ['RECEPTORIA CENTRAL', 'Ing. Roberto Silva', '0414-9988776', 'Carretera Nacional Km 12', 0.4800, 0.5200, 0.0000],
            ['COLONA', 'Lic. Carmen Morales', '0412-3344556', 'Zona Industrial Sector B', 0.5000, 0.5500, 0.0000],
            ['PLANTA SAN ANTONIO', 'Dr. Manuel Vargas', '0424-7766554', 'Av. Intercomunal Galpón 4', 0.4900, 0.5300, 0.0000]
        ],
        mapeoColumnas: {
            nombre: ['NOMBRE_COMPANIA', 'NOMBRE', 'COMPANIA', 'RECEPTORIA', 'PLANTA'],
            encargado: ['ENCARGADO', 'RESPONSABLE', 'CONTACTO'],
            telefono: ['TELEFONO', 'TLF', 'CELULAR'],
            direccion: ['DIRECCION', 'UBICACION'],
            precioCompraLitroUSD: ['PRECIO_COMPRA_USD', 'PRECIO_COMPRA', 'PRECIO_USD'],
            precioBufalaLitroUSD: ['PRECIO_BUFALA_USD', 'PRECIO_BUFALA'],
            precioAcidaLitroUSD: ['PRECIO_ACIDA_USD', 'PRECIO_ACIDA']
        }
    },
    BANCOS: {
        titulo: 'Bancos',
        icono: 'fa-building-columns',
        color: '#d97706',
        subtitulo: 'Catálogo de entidades bancarias nacionales y sus códigos de 4 dígitos.',
        headersPlantilla: [
            ['CODIGO_BANCO', 'NOMBRE_BANCO'],
            ['0102', 'BANCO DE VENEZUELA'],
            ['0134', 'BANESCO'],
            ['0105', 'MERCANTIL'],
            ['0108', 'PROVINCIAL BBVA'],
            ['0172', 'BANCAMIGA']
        ],
        mapeoColumnas: {
            codigo: ['CODIGO_BANCO', 'CODIGO', 'COD'],
            nombre: ['NOMBRE_BANCO', 'NOMBRE', 'BANCO']
        }
    }
};

// ==============================================================================
// INICIALIZACIÓN Y CAMBIO DE ENTIDAD
// ==============================================================================

async function inicializarModuloGestionData() {
    seleccionarEntidadData('FINCAS');
    await recargarEstadoPrerequisitosData();
}
window.inicializarModuloGestionData = inicializarModuloGestionData;

function seleccionarEntidadData(entidad) {
    entidadDataActiva = entidad;

    // Actualizar botones de pestaña
    document.querySelectorAll('.btn-tab-entidad').forEach(btn => {
        if (btn.getAttribute('data-entidad') === entidad) {
            btn.style.background = '#2563eb';
            btn.style.color = '#ffffff';
            btn.classList.add('active');
        } else {
            btn.style.background = '#f1f5f9';
            btn.style.color = '#475569';
            btn.classList.remove('active');
        }
    });

    const conf = CONFIG_ENTIDADES_DATA[entidad];
    const lblTitulo = document.getElementById('lblTituloEntidadActiva');
    const lblSub = document.getElementById('lblSubtituloEntidadActiva');
    const checkCont = document.getElementById('contenedorCheckAutoCrearData');

    if (lblTitulo && conf) {
        lblTitulo.innerHTML = `<i class="fa-solid ${conf.icono}" style="color: ${conf.color};"></i> Importación &amp; Exportación de ${conf.titulo}`;
    }
    if (lblSub && conf) {
        lblSub.innerText = conf.subtitulo;
    }
    if (checkCont) {
        checkCont.style.display = (entidad === 'FINCAS') ? 'flex' : 'none';
    }

    // Actualizar enlaces directos de descarga de plantillas oficiales
    const btnXlsx = document.getElementById('btnDescargarPlantillaXlsx');
    const btnCsv = document.getElementById('btnDescargarPlantillaCsv');
    if (btnXlsx) {
        btnXlsx.href = `/api/data/descargar-plantilla/${entidad}?formato=xlsx`;
        btnXlsx.setAttribute('download', `Plantilla_Importacion_${entidad}.xlsx`);
    }
    if (btnCsv) {
        btnCsv.href = `/api/data/descargar-plantilla/${entidad}?formato=csv`;
        btnCsv.setAttribute('download', `Plantilla_Importacion_${entidad}.csv`);
    }

    cancelarPrevisualizacionData();
    recargarEstadoPrerequisitosData();
}
window.seleccionarEntidadData = seleccionarEntidadData;

// ==============================================================================
// GESTIÓN DE PRERREQUISITOS Y DEPENDENCIAS (VALIDACIÓN EN VIVO)
// ==============================================================================

async function recargarEstadoPrerequisitosData() {
    const contenedor = document.getElementById('contenedorAlertaPrerequisitoData');
    if (!contenedor) return;

    try {
        const token = state.token;
        const res = await fetch(`${API_BASE}/data/validar-prerequisitos/${entidadDataActiva}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const info = await res.json();
            infoPrerequisitosActual = info;
            renderizarAlertaPrerequisito(info);
        } else {
            contenedor.innerHTML = '';
        }
    } catch (e) {
        console.warn('No se pudo verificar prerrequisitos:', e);
        contenedor.innerHTML = '';
    }
}
window.recargarEstadoPrerequisitosData = recargarEstadoPrerequisitosData;

function renderizarAlertaPrerequisito(info) {
    const contenedor = document.getElementById('contenedorAlertaPrerequisitoData');
    if (!contenedor) return;

    if (entidadDataActiva === 'FINCAS') {
        const pProp = (info.prerequisitos || []).find(p => p.nombre === 'Propietarios');
        const totalProp = pProp ? pProp.cantidad : 0;
        const tieneProp = totalProp > 0;

        if (tieneProp) {
            contenedor.style.background = '#f0fdf4';
            contenedor.style.borderBottom = '1.5px solid #bbf7d0';
            contenedor.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-circle-check" style="color: #16a34a; font-size: 20px;"></i>
                        <div>
                            <span style="font-weight: 800; color: #166534; font-size: 13.5px;">
                                Orden Correcto: Se detectaron ${totalProp} Propietarios registrados en sistema.
                            </span>
                            <div style="font-size: 12px; color: #15803d; margin-top: 2px;">
                                Al subir el archivo de Fincas, cada finca se asociará automáticamente con su respectivo dueño por nombre o cédula.
                            </div>
                        </div>
                    </div>
                    <span class="badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-size: 12px;">
                        Prerrequisito Cumplido
                    </span>
                </div>
            `;
        } else {
            contenedor.style.background = '#fffbeb';
            contenedor.style.borderBottom = '1.5px solid #fde68a';
            contenedor.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-triangle-exclamation" style="color: #d97706; font-size: 22px;"></i>
                        <div>
                            <span style="font-weight: 900; color: #92400e; font-size: 13.5px;">
                                ⚠️ Aviso Importante de Dependencia: Cargar primero Propietarios
                            </span>
                            <div style="font-size: 12px; color: #b45309; margin-top: 2px;">
                                No hay propietarios registrados en el sistema. Se recomienda cargar primero el catálogo de <strong>Propietarios</strong> antes de las Fincas.
                                <br><em>(Si decides subir las fincas ahora, marca la casilla "Auto-crear Propietarios nuevos" para crearlos automáticamente).</em>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn" onclick="seleccionarEntidadData('PROPIETARIOS')"
                        style="background: #d97706; color: #ffffff; border: none; font-weight: 800; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;">
                        Ir a Cargar Propietarios &rarr;
                    </button>
                </div>
            `;
        }
    } else {
        contenedor.style.background = '#f8fafc';
        contenedor.style.borderBottom = '1.5px solid #e2e8f0';
        contenedor.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; color: #475569; font-size: 12.5px;">
                <i class="fa-solid fa-info-circle" style="color: #2563eb; font-size: 16px;"></i>
                <span>Descarga la plantilla con ejemplos, completa las filas y súbela arrastrándola al recuadro inferior.</span>
            </div>
        `;
    }
}

// ==============================================================================
// DESCARGA Y GUARDADO ROBUSTO DE ARCHIVOS EXCEL (.XLSX) Y CSV
// ==============================================================================

function descargarElementoConNombre(uriOUrl, filename, mimeType) {
    if (uriOUrl && uriOUrl.startsWith('data:')) {
        try {
            const commaIdx = uriOUrl.indexOf(',');
            const base64Data = uriOUrl.substring(commaIdx + 1);

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/data/descargar-archivo';
            form.style.display = 'none';

            const inputBase64 = document.createElement('input');
            inputBase64.type = 'hidden';
            inputBase64.name = 'base64Content';
            inputBase64.value = base64Data;
            form.appendChild(inputBase64);

            const inputNombre = document.createElement('input');
            inputNombre.type = 'hidden';
            inputNombre.name = 'nombreArchivo';
            inputNombre.value = filename;
            form.appendChild(inputNombre);

            const inputType = document.createElement('input');
            inputType.type = 'hidden';
            inputType.name = 'contentType';
            inputType.value = mimeType || (filename.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            form.appendChild(inputType);

            document.body.appendChild(form);
            form.submit();
            setTimeout(() => {
                try { document.body.removeChild(form); } catch (e) {}
            }, 1000);
            return;
        } catch (e) {
            console.warn('Fallback a descarga por enlace:', e);
        }
    }

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = uriOUrl;
    a.download = filename;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        try {
            document.body.removeChild(a);
            if (uriOUrl.startsWith('blob:')) {
                URL.revokeObjectURL(uriOUrl);
            }
        } catch (e) {}
    }, 500);
}

function guardarWorkbookExcel(wb, nombreArchivo) {
    let filename = (nombreArchivo || 'archivo_excel').trim();
    if (!filename.toLowerCase().endsWith('.xlsx')) {
        filename += '.xlsx';
    }

    try {
        const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const dataUri = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64;
        descargarElementoConNombre(dataUri, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) {
        console.error('Error al generar XLSX:', e);
        descargarPlantillaCsvData();
    }
}

function descargarPlantillaCsvData() {
    const conf = CONFIG_ENTIDADES_DATA[entidadDataActiva];
    if (!conf) return;

    try {
        const rows = conf.headersPlantilla;
        const csvContent = rows.map(r => r.map(cell => {
            let val = cell == null ? '' : String(cell);
            if (val.includes(';') || val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        }).join(';')).join('\r\n');

        const filename = `Plantilla_Importacion_${entidadDataActiva}.csv`;
        const base64 = btoa(unescape(encodeURIComponent("\uFEFF" + csvContent)));
        const dataUri = 'data:text/csv;charset=utf-8;base64,' + base64;
        descargarElementoConNombre(dataUri, filename);

        showToast(`Plantilla CSV descargada: ${filename}`, 'success');
    } catch (e) {
        console.error('Error al exportar CSV:', e);
        Swal.fire({
            icon: 'error',
            title: 'Error al generar CSV',
            text: e.message
        });
    }
}
window.descargarPlantillaCsvData = descargarPlantillaCsvData;

function descargarPlantillaExcelData() {
    if (typeof XLSX === 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Librería Excel no cargada',
            text: 'Espere unos segundos o refresque la página para cargar el módulo XLSX.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const conf = CONFIG_ENTIDADES_DATA[entidadDataActiva];
    if (!conf) return;

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(conf.headersPlantilla);

        // Ajustar anchos automáticos de columna
        const colWidths = conf.headersPlantilla[0].map((h, i) => {
            let maxLen = h.length;
            conf.headersPlantilla.forEach(row => {
                if (row[i] != null) {
                    const str = String(row[i]);
                    if (str.length > maxLen) maxLen = str.length;
                }
            });
            return { wch: Math.max(maxLen + 4, 16) };
        });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, `Plantilla_${conf.titulo}`);
        const nombreArchivo = `Plantilla_Importacion_${entidadDataActiva}.xlsx`;
        guardarWorkbookExcel(wb, nombreArchivo);

        showToast(`Plantilla descargada: ${nombreArchivo}`, 'success');
    } catch (e) {
        console.error('Error al generar plantilla Excel:', e);
        Swal.fire({
            icon: 'error',
            title: 'Error al generar plantilla',
            text: e.message
        });
    }
}
window.descargarPlantillaExcelData = descargarPlantillaExcelData;

// ==============================================================================
// EXPORTACIÓN DE DATA ACTUAL A EXCEL (.XLSX)
// ==============================================================================

async function exportarDataActualExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Cargando librería Excel...', 'info');
        return;
    }

    const conf = CONFIG_ENTIDADES_DATA[entidadDataActiva];
    if (!conf) return;

    Swal.fire({
        title: `Exportando ${conf.titulo}...`,
        html: '<i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #0284c7; margin-bottom: 8px;"></i><p>Consultando base de datos...</p>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    try {
        const token = state.token;
        const res = await fetch(`${API_BASE}/data/exportar/${entidadDataActiva}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('No se pudo obtener la data del servidor.');
        const data = await res.json();
        Swal.close();

        if (!Array.isArray(data) || data.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Catálogo Vacío',
                text: `Actualmente no hay registros en la base de datos para ${conf.titulo}.`,
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Autoajustar ancho de columnas
        const colNames = Object.keys(data[0]);
        ws['!cols'] = colNames.map(k => ({ wch: Math.max(k.length + 4, 16) }));

        XLSX.utils.book_append_sheet(wb, ws, conf.titulo);
        const fechaHoy = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Catalogo_${entidadDataActiva}_${fechaHoy}.xlsx`;
        guardarWorkbookExcel(wb, nombreArchivo);

        showToast(`Exportación completada: ${nombreArchivo}`, 'success');
    } catch (e) {
        console.error('Error al exportar data:', e);
        Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: e.message,
            confirmButtonColor: '#2563eb'
        });
    }
}
window.exportarDataActualExcel = exportarDataActualExcel;

// ==============================================================================
// DRAG & DROP Y PROCESAMIENTO DEL ARCHIVO EXCEL
// ==============================================================================

function onDragOverExcel(event) {
    event.preventDefault();
    const dropzone = document.getElementById('dropzoneExcelData');
    if (dropzone) {
        dropzone.style.borderColor = '#2563eb';
        dropzone.style.background = '#eff6ff';
    }
}
window.onDragOverExcel = onDragOverExcel;

function onDragLeaveExcel(event) {
    event.preventDefault();
    const dropzone = document.getElementById('dropzoneExcelData');
    if (dropzone) {
        dropzone.style.borderColor = '#94a3b8';
        dropzone.style.background = '#f8fafc';
    }
}
window.onDragLeaveExcel = onDragLeaveExcel;

function onDropExcel(event) {
    event.preventDefault();
    onDragLeaveExcel(event);
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        procesarArchivoExcel(event.dataTransfer.files[0]);
    }
}
window.onDropExcel = onDropExcel;

function onSeleccionarArchivoExcel(event) {
    if (event.target && event.target.files && event.target.files.length > 0) {
        procesarArchivoExcel(event.target.files[0]);
    }
}
window.onSeleccionarArchivoExcel = onSeleccionarArchivoExcel;

function procesarArchivoExcel(file) {
    if (!file) return;

    const nombre = file.name || '';
    const ext = nombre.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        Swal.fire({
            icon: 'warning',
            title: 'Formato no soportado',
            text: 'Por favor seleccione un archivo con formato .xlsx, .xls o .csv.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const infoElem = document.getElementById('infoArchivoSeleccionadoData');
    const lblElem = document.getElementById('lblNombreArchivoData');
    if (infoElem && lblElem) {
        lblElem.innerText = `${nombre} (${(file.size / 1024).toFixed(1)} KB)`;
        infoElem.style.display = 'block';
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows || jsonRows.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Archivo vacío',
                    text: 'El archivo Excel no contiene filas de datos.',
                    confirmButtonColor: '#2563eb'
                });
                return;
            }

            mapearYValidarFilasData(jsonRows);
        } catch (err) {
            console.error('Error al leer Excel:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error al leer archivo',
                text: 'No se pudo interpretar el archivo Excel: ' + err.message,
                confirmButtonColor: '#2563eb'
            });
        }
    };
    reader.readAsArrayBuffer(file);
}

// ==============================================================================
// MAPEO INTELIGENTE Y PREVALIDACIÓN DE FILAS
// ==============================================================================

function mapearYValidarFilasData(rawRows) {
    const conf = CONFIG_ENTIDADES_DATA[entidadDataActiva];
    if (!conf) return;

    filasDataPrevisualizadas = [];
    let countValidas = 0;
    let countAdvertencias = 0;
    let countErrores = 0;

    rawRows.forEach((r, index) => {
        const itemMapeado = {};
        const keysInRow = Object.keys(r);

        // Buscar coincidencia para cada campo configurado
        for (const [prop, posiblesNombres] of Object.entries(conf.mapeoColumnas)) {
            let valorEncontrado = null;
            for (const nom of posiblesNombres) {
                const keyMatch = keysInRow.find(k => k.trim().toUpperCase() === nom.toUpperCase());
                if (keyMatch && r[keyMatch] !== undefined && r[keyMatch] !== '') {
                    valorEncontrado = r[keyMatch];
                    break;
                }
            }
            itemMapeado[prop] = valorEncontrado != null ? String(valorEncontrado).trim() : null;
        }

        // Validaciones por entidad
        let estado = 'VALIDO';
        let mensajeValidacion = 'Listo para importar';

        if (entidadDataActiva === 'FINCAS') {
            const nomFinca = itemMapeado.nombre;
            const prop = itemMapeado.propietario;
            const pUSD = parseFloat(itemMapeado.precioLitroUSD);

            itemMapeado.precioLitroUSD = (!isNaN(pUSD) && pUSD > 0) ? pUSD : 0.4000;
            const pAcida = parseFloat(itemMapeado.precioLitroAcidaUSD);
            itemMapeado.precioLitroAcidaUSD = (!isNaN(pAcida) && pAcida >= 0) ? pAcida : 0.0000;
            const str2Tipos = (itemMapeado.tieneDosTiposLeche || '').toUpperCase();
            itemMapeado.tieneDosTiposLeche = str2Tipos === 'SI' || str2Tipos === 'TRUE' || str2Tipos === '1';

            if (!nomFinca) {
                estado = 'ERROR';
                mensajeValidacion = 'Falta Nombre de Finca';
                countErrores++;
            } else if (!prop) {
                estado = 'ADVERTENCIA';
                mensajeValidacion = 'Sin propietario asignado';
                countAdvertencias++;
            } else {
                countValidas++;
            }
        }
        else if (entidadDataActiva === 'PROPIETARIOS') {
            const nom = itemMapeado.nombre;
            if (!nom) {
                estado = 'ERROR';
                mensajeValidacion = 'Falta Nombre de Propietario';
                countErrores++;
            } else {
                countValidas++;
            }
        }
        else if (entidadDataActiva === 'COMPANIAS') {
            const nom = itemMapeado.nombre;
            const pCompra = parseFloat(itemMapeado.precioCompraLitroUSD);
            itemMapeado.precioCompraLitroUSD = (!isNaN(pCompra) && pCompra > 0) ? pCompra : 0.5000;
            if (!nom) {
                estado = 'ERROR';
                mensajeValidacion = 'Falta Nombre de Compañía';
                countErrores++;
            } else {
                countValidas++;
            }
        }
        else if (entidadDataActiva === 'BANCOS') {
            const nom = itemMapeado.nombre;
            const cod = itemMapeado.codigo;
            if (!nom && !cod) {
                estado = 'ERROR';
                mensajeValidacion = 'Falta Código o Nombre de Banco';
                countErrores++;
            } else {
                countValidas++;
            }
        }

        filasDataPrevisualizadas.push({
            numeroFila: index + 1,
            estado,
            mensajeValidacion,
            data: itemMapeado
        });
    });

    renderizarPrevisualizacionData(countValidas, countAdvertencias, countErrores);
}

// ==============================================================================
// RENDERIZADO DE TABLA DE PREVIEW
// ==============================================================================

function renderizarPrevisualizacionData(validas, advertencias, errores) {
    const panel = document.getElementById('panelPrevisualizacionData');
    const lblTotal = document.getElementById('lblTotalFilasLeidas');
    const lblVal = document.getElementById('lblFilasValidas');
    const lblAdv = document.getElementById('lblFilasAdvertencias');
    const lblErr = document.getElementById('lblFilasErrores');
    const thead = document.getElementById('theadPreviewData');
    const tbody = document.getElementById('tbodyPreviewData');
    const btnConfirmar = document.getElementById('btnConfirmarImportacionData');

    if (!panel || !tbody) return;

    panel.style.display = 'block';
    if (lblTotal) lblTotal.innerText = filasDataPrevisualizadas.length;
    if (lblVal) lblVal.innerText = validas;
    if (lblAdv) lblAdv.innerText = advertencias;
    if (lblErr) lblErr.innerText = errores;

    if (btnConfirmar) {
        btnConfirmar.disabled = (validas + advertencias === 0);
        btnConfirmar.style.opacity = (validas + advertencias === 0) ? '0.5' : '1';
    }

    // Encabezados según la entidad
    let theadHtml = '';
    if (entidadDataActiva === 'FINCAS') {
        theadHtml = `
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 14%;">ESTADO</th>
                <th style="width: 8%;">CÓDIGO</th>
                <th style="width: 20%;">FINCA</th>
                <th style="width: 18%;">PROPIETARIO</th>
                <th style="width: 12%;">BANCO / CUENTA</th>
                <th style="width: 12%;">RECEPTORÍA</th>
                <th style="width: 11%; text-align: right;">PRECIO USD</th>
            </tr>
        `;
    } else if (entidadDataActiva === 'PROPIETARIOS') {
        theadHtml = `
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 15%;">ESTADO</th>
                <th style="width: 25%;">NOMBRE COMPLETO</th>
                <th style="width: 15%;">CÉDULA / RIF</th>
                <th style="width: 15%;">TELÉFONO</th>
                <th style="width: 15%;">BANCO</th>
                <th style="width: 10%;">CUENTA</th>
            </tr>
        `;
    } else if (entidadDataActiva === 'COMPANIAS') {
        theadHtml = `
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 15%;">ESTADO</th>
                <th style="width: 28%;">NOMBRE COMPAÑÍA</th>
                <th style="width: 20%;">ENCARGADO</th>
                <th style="width: 16%;">TELÉFONO</th>
                <th style="width: 16%; text-align: right;">PRECIO COMPRA USD</th>
            </tr>
        `;
    } else if (entidadDataActiva === 'BANCOS') {
        theadHtml = `
            <tr>
                <th style="width: 8%;">#</th>
                <th style="width: 20%;">ESTADO</th>
                <th style="width: 25%;">CÓDIGO</th>
                <th style="width: 47%;">NOMBRE BANCO</th>
            </tr>
        `;
    }
    if (thead) thead.innerHTML = theadHtml;

    // Filas (primeras 80 filas para rendimiento óptimo)
    let rowsHtml = '';
    const muestraFilas = filasDataPrevisualizadas.slice(0, 80);

    muestraFilas.forEach(f => {
        let badgeEstado = '';
        if (f.estado === 'VALIDO') {
            badgeEstado = `<span class="badge" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;"><i class="fa-solid fa-circle-check"></i> Válido</span>`;
        } else if (f.estado === 'ADVERTENCIA') {
            badgeEstado = `<span class="badge" style="background: #fefce8; color: #854d0e; border: 1px solid #fef08a; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;" title="${f.mensajeValidacion}"><i class="fa-solid fa-triangle-exclamation"></i> ${f.mensajeValidacion}</span>`;
        } else {
            badgeEstado = `<span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;" title="${f.mensajeValidacion}"><i class="fa-solid fa-circle-xmark"></i> ${f.mensajeValidacion}</span>`;
        }

        const d = f.data;
        if (entidadDataActiva === 'FINCAS') {
            rowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #64748b;">${f.numeroFila}</td>
                    <td>${badgeEstado}</td>
                    <td style="font-weight: 700; color: #3b82f6;">${d.codigo || '-'}</td>
                    <td style="font-weight: 800; color: #0f172a;">${d.nombre || '<span style="color: #ef4444;">Sin Nombre</span>'}</td>
                    <td style="font-weight: 600; color: #334155;">${d.propietario || '<span style="color: #94a3b8;">Sin Asignar</span>'}</td>
                    <td style="font-size: 11.5px; color: #475569;">${d.bancoNombre || ''} ${d.numeroCuenta ? `<br><small style="font-family: monospace;">${d.numeroCuenta}</small>` : ''}</td>
                    <td style="font-size: 12px; color: #059669; font-weight: 700;">${d.companiaNombre || '-'}</td>
                    <td style="text-align: right; font-weight: 800; color: #047857;">$ ${parseFloat(d.precioLitroUSD || 0).toFixed(4)}</td>
                </tr>
            `;
        } else if (entidadDataActiva === 'PROPIETARIOS') {
            rowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #64748b;">${f.numeroFila}</td>
                    <td>${badgeEstado}</td>
                    <td style="font-weight: 800; color: #0f172a;">${d.nombre || '-'}</td>
                    <td style="font-weight: 700; color: #3b82f6;">${d.cedulaRIF || '-'}</td>
                    <td style="font-size: 12px; color: #475569;">${d.telefono || '-'}</td>
                    <td style="font-size: 12px; color: #334155;">${d.bancoNombre || '-'}</td>
                    <td style="font-family: monospace; font-size: 11.5px;">${d.numeroCuenta || '-'}</td>
                </tr>
            `;
        } else if (entidadDataActiva === 'COMPANIAS') {
            rowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #64748b;">${f.numeroFila}</td>
                    <td>${badgeEstado}</td>
                    <td style="font-weight: 800; color: #0f172a;">${d.nombre || '-'}</td>
                    <td style="font-size: 12.5px; color: #334155;">${d.encargado || '-'}</td>
                    <td style="font-size: 12px; color: #475569;">${d.telefono || '-'}</td>
                    <td style="text-align: right; font-weight: 800; color: #059669;">$ ${parseFloat(d.precioCompraLitroUSD || 0).toFixed(4)}</td>
                </tr>
            `;
        } else if (entidadDataActiva === 'BANCOS') {
            rowsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="font-weight: 700; color: #64748b;">${f.numeroFila}</td>
                    <td>${badgeEstado}</td>
                    <td style="font-family: monospace; font-weight: 800; color: #2563eb;">${d.codigo || '-'}</td>
                    <td style="font-weight: 800; color: #0f172a;">${d.nombre || '-'}</td>
                </tr>
            `;
        }
    });

    if (filasDataPrevisualizadas.length > 80) {
        rowsHtml += `
            <tr style="background: #f8fafc; font-weight: 700; color: #64748b; text-align: center;">
                <td colspan="8" style="padding: 12px;">
                    ... y ${filasDataPrevisualizadas.length - 80} filas adicionales listas para guardar.
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = rowsHtml;
}

function cancelarPrevisualizacionData() {
    filasDataPrevisualizadas = [];
    const panel = document.getElementById('panelPrevisualizacionData');
    const infoElem = document.getElementById('infoArchivoSeleccionadoData');
    const fileInput = document.getElementById('inputArchivoExcelData');

    if (panel) panel.style.display = 'none';
    if (infoElem) infoElem.style.display = 'none';
    if (fileInput) fileInput.value = '';
}
window.cancelarPrevisualizacionData = cancelarPrevisualizacionData;

// ==============================================================================
// EJECUCIÓN DE IMPORTACIÓN MASIVA HACIA EL SERVIDOR
// ==============================================================================

async function ejecutarImportacionMasivaData() {
    const filasAProcesar = filasDataPrevisualizadas.filter(f => f.estado !== 'ERROR');
    if (filasAProcesar.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos válidos',
            text: 'No hay filas válidas para importar en este archivo.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const autoCrear = document.getElementById('chkAutoCrearDependencias')?.checked ?? true;
    const conf = CONFIG_ENTIDADES_DATA[entidadDataActiva];

    const result = await Swal.fire({
        title: `¿Confirmar Importación Masiva?`,
        html: `
            <div style="text-align: left; font-size: 13.5px; line-height: 1.5; color: #334155;">
                <p>Se guardarán <strong>${filasAProcesar.length} registros</strong> en el catálogo de <strong>${conf.titulo}</strong>.</p>
                ${entidadDataActiva === 'FINCAS' && autoCrear ? '<div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px 12px; border-radius: 6px; color: #047857; font-size: 12px; margin-top: 8px;"><strong>Auto-creación activada:</strong> Si una finca tiene un propietario que no existe, se registrará automáticamente en el sistema.</div>' : ''}
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-cloud-arrow-up"></i> Sí, Importar Ahora',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Importando datos...',
        html: '<i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: #059669; margin-bottom: 12px;"></i><p>Guardando y validando registros en base de datos...</p>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    try {
        const token = state.token;
        let url = '';
        let payload = null;

        if (entidadDataActiva === 'FINCAS') {
            url = `${API_BASE}/data/importar/fincas`;
            payload = {
                items: filasAProcesar.map(f => f.data),
                autoCrearPropietarios: autoCrear
            };
        } else if (entidadDataActiva === 'PROPIETARIOS') {
            url = `${API_BASE}/data/importar/propietarios`;
            payload = filasAProcesar.map(f => f.data);
        } else if (entidadDataActiva === 'COMPANIAS') {
            url = `${API_BASE}/data/importar/companias`;
            payload = filasAProcesar.map(f => f.data);
        } else if (entidadDataActiva === 'BANCOS') {
            url = `${API_BASE}/data/importar/bancos`;
            payload = filasAProcesar.map(f => f.data);
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Error en el servidor al procesar la importación.');
        }

        const resp = await res.json();
        cancelarPrevisualizacionData();
        await recargarEstadoPrerequisitosData();

        // Refrescar catálogos locales si existen
        if (typeof cargarCatalogosGlobales === 'function') {
            cargarCatalogosGlobales();
        }

        Swal.fire({
            icon: 'success',
            title: '¡Importación Completada!',
            html: `
                <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #334155;">
                    <p style="margin-bottom: 8px;"><strong>Resumen del proceso:</strong></p>
                    <ul style="padding-left: 20px; margin: 0 0 10px 0;">
                        <li>Total procesados: <strong>${resp.totalRecibidos || filasAProcesar.length}</strong></li>
                        <li>Nuevos insertados: <strong style="color: #16a34a;">+${resp.insertados || 0}</strong></li>
                        <li>Existentes actualizados: <strong style="color: #2563eb;">${resp.actualizados || 0}</strong></li>
                        ${resp.propietariosAutoCreados ? `<li>Propietarios auto-creados: <strong style="color: #059669;">+${resp.propietariosAutoCreados}</strong></li>` : ''}
                    </ul>
                    ${resp.errores && resp.errores.length > 0 ? `
                        <div style="background: #fff1f2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; color: #991b1b; font-size: 11.5px; max-height: 100px; overflow-y: auto;">
                            <strong>Advertencias / Omitidos (${resp.errores.length}):</strong><br>
                            ${resp.errores.join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `,
            confirmButtonColor: '#2563eb'
        });

    } catch (e) {
        console.error('Error durante la importación masiva:', e);
        Swal.fire({
            icon: 'error',
            title: 'Error de Importación',
            text: e.message,
            confirmButtonColor: '#2563eb'
        });
    }
}
window.ejecutarImportacionMasivaData = ejecutarImportacionMasivaData;
