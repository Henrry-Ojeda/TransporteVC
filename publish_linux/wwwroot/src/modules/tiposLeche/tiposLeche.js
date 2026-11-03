// ==========================================================================
// MÓDULO DE TIPOS DE LECHE & FACTORES DE PRECIO (TB_TIPOS_LECHE)
// ==========================================================================

/**
 * Consulta la lista de tipos de leche y factores de precio registrados.
 * 
 * @param {boolean} [forceRefresh=false] - Forzar consulta directa a la API.
 */
async function cargarTiposLeche(forceRefresh = false) {
    const tbody = document.getElementById('tbodyTiposLeche');
    if (!tbody) return;

    if (!forceRefresh && window.tiposLecheDataCache && window.tiposLecheDataCache.length > 0) {
        renderTablaTiposLeche(window.tiposLecheDataCache);
        return;
    }

    renderTableLoading('tbodyTiposLeche', 8, 'Cargando tipos de leche...');

    const res = await apiFetch('/configuracion/tipos-leche');
    if (res.ok && Array.isArray(res.data)) {
        window.tiposLecheDataCache = res.data;
        renderTablaTiposLeche(window.tiposLecheDataCache);
    } else {
        renderTableError('tbodyTiposLeche', 8, res.error || 'Error al cargar los tipos de leche.');
    }
}

/**
 * Renderiza visualmente la tabla de tipos de leche (Vaca, Búfala, Ácida, etc.).
 * 
 * @param {Array<Object>} lista - Lista de tipos de leche.
 */
function renderTablaTiposLeche(lista) {
    const tbody = document.getElementById('tbodyTiposLeche');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        renderTableEmpty('tbodyTiposLeche', 8, 'No se encontraron tipos de leche registrados.');
        return;
    }

    tbody.innerHTML = lista.map(t => {
        const color = t.colorHex || '#0284c7';
        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px 16px; text-align: center; font-weight: 800; color: #64748b;">
                    #${t.orden}
                </td>
                <td style="padding: 12px 16px;">
                    <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">
                        ${escapeHtml(t.codigo)}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-weight: 700; color: #1e293b; font-size: 13.5px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color};"></span>
                        ${escapeHtml(t.nombre)}
                    </div>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 3px 8px; border-radius: 6px;">
                        x${Number(t.factorPrecio || 1).toFixed(4)}
                    </span>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    ${t.esAcida 
                        ? `<span style="background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> SÍ (Castigo)</span>` 
                        : `<span style="background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px;">No</span>`
                    }
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <span style="background: ${color}15; color: ${color}; border: 1px solid ${color}40; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">
                        ${escapeHtml(t.codigo)}
                    </span>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <button type="button" class="btn" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 999px; ${t.activo ? 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;'}" onclick="toggleTipoLecheEstado(${t.id}, ${t.activo})">
                        <i class="fa-solid ${t.activo ? 'fa-check' : 'fa-ban'}"></i> ${t.activo ? 'Activo' : 'Inactivo'}
                    </button>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <div style="display: inline-flex; gap: 6px;">
                        <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; color: #0284c7; border-color: #bae6fd;" onclick="abrirModalTipoLeche(${t.id})" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; color: #dc2626; border-color: #fecaca;" onclick="eliminarTipoLeche(${t.id}, '${escapeHtml(t.codigo)}')" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtra reactivamente la tabla de tipos de leche según el texto ingresado en el buscador.
 */
function filtrarTablaTiposLeche() {
    const q = (document.getElementById('buscadorTiposLeche')?.value || '').toLowerCase().trim();
    let filtrados = window.tiposLecheDataCache || [];
    if (q) {
        filtrados = filtrados.filter(t => 
            (t.codigo && t.codigo.toLowerCase().includes(q)) ||
            (t.nombre && t.nombre.toLowerCase().includes(q))
        );
    }
    renderTablaTiposLeche(filtrados);
}

/**
 * Abre el modal para crear o editar un Tipo de Leche.
 * 
 * @param {number|null} [id=null] - ID numérico del registro o null para crear uno nuevo.
 */
function abrirModalTipoLeche(id = null) {
    const titulo = document.getElementById('modalTipoLecheTitulo');
    const inputId = document.getElementById('tipoLecheId');
    const inputCodigo = document.getElementById('tipoLecheCodigo');
    const inputNombre = document.getElementById('tipoLecheNombre');
    const inputFactor = document.getElementById('tipoLecheFactor');
    const inputOrden = document.getElementById('tipoLecheOrden');
    const inputColor = document.getElementById('tipoLecheColor');
    const inputColorTxt = document.getElementById('tipoLecheColorTexto');
    const checkAcida = document.getElementById('tipoLecheEsAcida');
    const checkActivo = document.getElementById('tipoLecheActivo');

    if (id) {
        const item = (window.tiposLecheDataCache || []).find(t => t.id === id);
        if (titulo) titulo.textContent = `Editar Tipo de Leche: ${item?.nombre || ''}`;
        if (inputId) inputId.value = id;
        if (inputCodigo) { inputCodigo.value = item?.codigo || ''; inputCodigo.readOnly = true; inputCodigo.style.background = '#f1f5f9'; }
        if (inputNombre) inputNombre.value = item?.nombre || '';
        if (inputFactor) inputFactor.value = item?.factorPrecio || 1.0;
        if (inputOrden) inputOrden.value = item?.orden || 1;
        if (inputColor) inputColor.value = item?.colorHex || '#0284c7';
        if (inputColorTxt) inputColorTxt.value = item?.colorHex || '#0284c7';
        if (checkAcida) checkAcida.checked = !!item?.esAcida;
        if (checkActivo) checkActivo.checked = item ? item.activo : true;
    } else {
        if (titulo) titulo.textContent = 'Nuevo Tipo de Leche';
        if (inputId) inputId.value = '';
        if (inputCodigo) { inputCodigo.value = ''; inputCodigo.readOnly = false; inputCodigo.style.background = '#ffffff'; }
        if (inputNombre) inputNombre.value = '';
        if (inputFactor) inputFactor.value = '1.0000';
        if (inputOrden) inputOrden.value = (window.tiposLecheDataCache?.length || 0) + 1;
        if (inputColor) inputColor.value = '#0284c7';
        if (inputColorTxt) inputColorTxt.value = '#0284c7';
        if (checkAcida) checkAcida.checked = false;
        if (checkActivo) checkActivo.checked = true;
    }

    abrirModalCustom('modalTipoLeche');
}

/**
 * Guarda o actualiza un Tipo de Leche mediante el formulario del modal.
 * 
 * @param {Event} event - Evento del submit.
 */
async function guardarTipoLecheForm(event) {
    event.preventDefault();
    const id = document.getElementById('tipoLecheId')?.value;
    const codigo = document.getElementById('tipoLecheCodigo')?.value?.trim().toUpperCase();
    const nombre = document.getElementById('tipoLecheNombre')?.value?.trim();
    const factorPrecio = parseFloat(document.getElementById('tipoLecheFactor')?.value) || 1.0;
    const orden = parseInt(document.getElementById('tipoLecheOrden')?.value) || 1;
    const colorHex = document.getElementById('tipoLecheColor')?.value || '#0284c7';
    const esAcida = document.getElementById('tipoLecheEsAcida')?.checked || false;
    const activo = document.getElementById('tipoLecheActivo')?.checked || false;

    if (!codigo || !nombre) {
        Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Ingrese el código y el nombre comercial.' });
        return;
    }

    const payload = { id: id ? parseInt(id) : 0, codigo, nombre, factorPrecio, orden, colorHex, esAcida, activo };
    const endpoint = id ? `/configuracion/tipos-leche/${id}` : '/configuracion/tipos-leche';
    const method = id ? 'PUT' : 'POST';

    const res = await apiFetch(endpoint, { method, body: payload });

    if (res.ok) {
        cerrarModalCustom('modalTipoLeche');
        Swal.fire({
            icon: 'success',
            title: '¡Tipo de Leche Guardado!',
            text: `${nombre} (${codigo}) guardado exitosamente.`,
            timer: 1800,
            showConfirmButton: false
        });
        await cargarTiposLeche(true);
    } else {
        Swal.fire({ icon: 'error', title: 'Error al Guardar', text: res.error || 'No se pudo guardar el tipo de leche.' });
    }
}

/**
 * Alterna rápidamente el estado activo/inactivo de un Tipo de Leche.
 * 
 * @param {number} id - ID del tipo de leche.
 * @param {boolean} estadoActual - Estado booleano actual.
 */
async function toggleTipoLecheEstado(id, estadoActual) {
    const res = await apiFetch(`/configuracion/tipos-leche/${id}/toggle`, {
        method: 'PUT',
        body: !estadoActual
    });
    if (res.ok) {
        await cargarTiposLeche(true);
    }
}

/**
 * Elimina un Tipo de Leche tras confirmación del usuario.
 * 
 * @param {number} id - ID numérico del tipo de leche.
 * @param {string} codigo - Código representativo para el mensaje.
 */
async function eliminarTipoLeche(id, codigo) {
    const confirm = await Swal.fire({
        title: `¿Eliminar tipo de leche ${codigo}?`,
        text: 'Si ya existen registros de recolección asociados, no podrá ser eliminado por integridad referencial.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    const res = await apiFetch(`/configuracion/tipos-leche/${id}`, { method: 'DELETE' });

    if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Eliminado', text: `Tipo de leche ${codigo} eliminado.`, timer: 1500, showConfirmButton: false });
        await cargarTiposLeche(true);
    } else {
        Swal.fire({ icon: 'error', title: 'No se puede eliminar', text: res.error || 'Error al eliminar tipo de leche.' });
    }
}

// Exportación global en Browser
if (typeof window !== 'undefined') {
    window.cargarTiposLeche = cargarTiposLeche;
    window.renderTablaTiposLeche = renderTablaTiposLeche;
    window.filtrarTablaTiposLeche = filtrarTablaTiposLeche;
    window.abrirModalTipoLeche = abrirModalTipoLeche;
    window.guardarTipoLecheForm = guardarTipoLecheForm;
    window.toggleTipoLecheEstado = toggleTipoLecheEstado;
    window.eliminarTipoLeche = eliminarTipoLeche;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cargarTiposLeche,
        renderTablaTiposLeche,
        filtrarTablaTiposLeche,
        abrirModalTipoLeche,
        guardarTipoLecheForm,
        toggleTipoLecheEstado,
        eliminarTipoLeche
    };
}
