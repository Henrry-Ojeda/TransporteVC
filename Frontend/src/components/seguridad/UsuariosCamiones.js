// ==========================================================================
// MÓDULO DE USUARIOS, ROLES Y CAMIONES (TB_CAMIONES)
// ==========================================================================
if (!state.datatableUsuarios) {
    state.datatableUsuarios = {
        search: '',
        rolFilter: '',
        sortColumn: 'nombre',
        sortDirection: 'asc',
        currentPage: 1,
        pageSize: 10,
        data: []
    };
}

state.usuarios = state.usuarios || [];
state.rolesUsuarios = state.rolesUsuarios || [];

async function cargarRolesUsuarios() {
    try {
        const res = await fetch(`${API_BASE}/usuarios/roles`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) return;
        const roles = await res.json();
        state.rolesUsuarios = roles || [];

        // Rellenar select del modal si existe
        const selModal = document.getElementById('modalUsuarioRolId');
        if (selModal && roles.length > 0) {
            const currentVal = selModal.value;
            selModal.innerHTML = roles.map(r => `
                <option value="${r.id}">${r.codigo} (${r.nombre})</option>
            `).join('');
            if (currentVal) selModal.value = currentVal;
        }

        // Rellenar select de filtro si existe
        const selFiltro = document.getElementById('filtroRolUsuario');
        if (selFiltro && roles.length > 0) {
            const currentFiltro = selFiltro.value;
            selFiltro.innerHTML = `<option value="">Todos los Roles</option>` + roles.map(r => `
                <option value="${r.codigo}">${r.nombre}</option>
            `).join('');
            selFiltro.value = currentFiltro;
        }
    } catch (e) {
        console.warn('Error al cargar roles de usuarios:', e);
    }
}
window.cargarRolesUsuarios = cargarRolesUsuarios;

async function cargarUsuariosCat() {
    try {
        const tbody = document.getElementById('tbodyUsuariosCat');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios...</td></tr>`;
        }

        const res = await fetch(`${API_BASE}/usuarios`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar usuarios (Verifique permisos de Administrador)</td></tr>`;
            return;
        }

        const list = await res.json();
        state.usuarios = list || [];
        state.datatableUsuarios.data = list || [];
        renderTablaUsuarios();
    } catch (e) {
        console.warn('Error al cargar usuarios:', e);
        const tbody = document.getElementById('tbodyUsuariosCat');
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 20px; color: #f87171;">Error de conexión</td></tr>`;
    }
}
window.cargarUsuariosCat = cargarUsuariosCat;

function renderTablaUsuarios() {
    const dt = state.datatableUsuarios;
    const tbody = document.getElementById('tbodyUsuariosCat');
    if (!tbody) return;

    let items = [...(dt.data || [])];

    // Filtrar búsqueda
    if (dt.search && dt.search.trim() !== '') {
        const term = dt.search.toLowerCase().trim();
        items = items.filter(u => 
            (u.username && u.username.toLowerCase().includes(term)) ||
            (u.nombreCompleto && u.nombreCompleto.toLowerCase().includes(term)) ||
            (u.cedula && u.cedula.toLowerCase().includes(term)) ||
            (u.telefono && u.telefono.toLowerCase().includes(term)) ||
            (u.rol && u.rol.toLowerCase().includes(term)) ||
            (u.rolNombre && u.rolNombre.toLowerCase().includes(term)) ||
            (u.camion && u.camion.placa && u.camion.placa.toLowerCase().includes(term))
        );
    }

    // Filtrar por rol
    if (dt.rolFilter && dt.rolFilter.trim() !== '') {
        const rf = dt.rolFilter.toUpperCase().trim();
        items = items.filter(u => (u.rol && u.rol.toUpperCase() === rf));
    }

    // Actualizar badge de total
    const badgeTotal = document.getElementById('badgeTotalUsuarios');
    if (badgeTotal) {
        badgeTotal.textContent = `${items.length} ${items.length === 1 ? 'Usuario' : 'Usuarios'}`;
    }

    // Ordenar
    items.sort((a, b) => {
        let valA, valB;
        if (dt.sortColumn === 'id') {
            valA = a.id || 0;
            valB = b.id || 0;
        } else if (dt.sortColumn === 'username') {
            valA = (a.username || '').toLowerCase();
            valB = (b.username || '').toLowerCase();
        } else if (dt.sortColumn === 'rol') {
            valA = (a.rol || '').toLowerCase();
            valB = (b.rol || '').toLowerCase();
        } else if (dt.sortColumn === 'activo') {
            valA = a.activo ? 1 : 0;
            valB = b.activo ? 1 : 0;
        } else {
            valA = (a.nombreCompleto || '').toLowerCase();
            valB = (b.nombreCompleto || '').toLowerCase();
        }

        if (valA < valB) return dt.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return dt.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginación
    const totalItems = items.length;
    let pageSize = parseInt(dt.pageSize);
    if (isNaN(pageSize) || pageSize <= 0) pageSize = totalItems || 1;

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (dt.currentPage > totalPages) dt.currentPage = totalPages;
    if (dt.currentPage < 1) dt.currentPage = 1;

    const startIndex = (dt.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = dt.pageSize === -1 ? items : items.slice(startIndex, endIndex);

    // Actualizar texto info
    const infoSpan = document.getElementById('infoPaginacionUsuarios');
    if (infoSpan) {
        if (totalItems === 0) {
            infoSpan.textContent = 'Mostrando 0 a 0 de 0 registros';
        } else {
            infoSpan.textContent = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItems} registros`;
        }
    }

    // Renderizar botones de paginación
    renderPaginacionControls('paginacionUsuarios', dt.currentPage, totalPages, 'irAPaginaUsuarios');

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center" style="padding: 30px; color: #94a3b8;">
                    <i class="fa-solid fa-users-slash" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No se encontraron usuarios registrados
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = paginatedItems.map(u => {
        // Badge según Rol
        let rolBadge = '';
        const rolUpper = (u.rol || '').toUpperCase();
        if (rolUpper === 'ADMIN') {
            rolBadge = `<span class="badge" style="background: #fdf2f8; color: #be185d; border: 1.5px solid #fbcfe8; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>`;
        } else if (rolUpper === 'SUPERVISOR') {
            rolBadge = `<span class="badge" style="background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-user-tie"></i> SUPERVISOR</span>`;
        } else if (rolUpper === 'FINANZAS') {
            rolBadge = `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-calculator"></i> FINANZAS</span>`;
        } else if (rolUpper === 'CHOFER') {
            rolBadge = `<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-truck"></i> CHOFER</span>`;
        } else if (rolUpper === 'RECEPTOR') {
            rolBadge = `<span class="badge" style="background: #f0fdfa; color: #0f766e; border: 1.5px solid #99f6e4; font-weight: 800; font-size: 11px;"><i class="fa-solid fa-industry"></i> RECEPTOR</span>`;
        } else {
            rolBadge = `<span class="badge" style="background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 11px;">${u.rol}</span>`;
        }

        // Camión asignado
        let camionHtml = '<span style="color: #94a3b8; font-size: 12px;">-</span>';
        if (u.camion && u.camion.placa) {
            camionHtml = `
                <div style="font-weight: 700; color: #0f172a; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <span class="badge badge-primary" style="font-family: monospace; font-size: 11.5px; padding: 2px 6px;">${u.camion.placa}</span>
                    <span style="color: #047857; font-weight: 800; font-size: 12px;">${(u.camion.capacidadLitros || 0).toLocaleString()} L</span>
                </div>
                <small style="color: #64748b; font-size: 11px; display: block; text-align: center;">
                    ${u.camion.compartimientos || 1} ${(u.camion.compartimientos || 1) === 1 ? 'Compartimiento' : 'Compartimientos'}
                </small>
            `;
        }

        return `
            <tr>
                <td><span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; border: 1px solid #cbd5e1;">#${u.id}</span></td>
                <td>
                    <strong style="font-family: monospace; color: #2563eb; font-size: 13px; font-weight: 700;">${u.username}</strong>
                </td>
                <td>
                    <strong style="color: #0f172a; font-size: 13.5px; font-weight: 700;">${u.nombreCompleto}</strong>
                </td>
                <td style="text-align: center;">
                    ${rolBadge}
                </td>
                <td>
                    <span style="color: #475569; font-size: 12.5px; font-weight: 600;">${u.cedula || '<span style="color:#94a3b8;">-</span>'}</span>
                </td>
                <td>
                    <span style="color: #475569; font-size: 12.5px;">${u.telefono || '<span style="color:#94a3b8;">-</span>'}</span>
                </td>
                <td style="text-align: center;">
                    ${camionHtml}
                </td>
                <td style="text-align: center;">
                    <span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 11.5px;">
                        <i class="fa-solid ${u.activo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalCambiarPassword(${u.id}, '${u.username}', '${u.nombreCompleto.replace(/'/g, "\\'")}')" title="Actualizar Contraseña" style="padding: 4px 8px; font-size: 12px; border-color: #fde68a; color: #b45309; background: #fffbeb;">
                            <i class="fa-solid fa-key"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarUsuario(${u.id})" title="Editar Usuario" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-user-pen"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="eliminarUsuario(${u.id}, '${u.nombreCompleto.replace(/'/g, "\\'")}')" title="Eliminar Usuario" style="padding: 4px 8px; font-size: 12px; border-color: #fecdd3; color: #e11d48; background: #fff1f2;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
window.renderTablaUsuarios = renderTablaUsuarios;

function filtrarUsuariosCat(val) {
    state.datatableUsuarios.search = val;
    state.datatableUsuarios.currentPage = 1;
    renderTablaUsuarios();
}
window.filtrarUsuariosCat = filtrarUsuariosCat;

function cambiarFiltroRolUsuario(val) {
    state.datatableUsuarios.rolFilter = val;
    state.datatableUsuarios.currentPage = 1;
    renderTablaUsuarios();
}
window.cambiarFiltroRolUsuario = cambiarFiltroRolUsuario;

function cambiarPageSizeUsuarios(val) {
    state.datatableUsuarios.pageSize = parseInt(val);
    state.datatableUsuarios.currentPage = 1;
    renderTablaUsuarios();
}
window.cambiarPageSizeUsuarios = cambiarPageSizeUsuarios;

function ordenarUsuarios(col) {
    const dt = state.datatableUsuarios;
    if (dt.sortColumn === col) {
        dt.sortDirection = dt.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        dt.sortColumn = col;
        dt.sortDirection = 'asc';
    }

    ['id', 'username', 'nombre', 'rol', 'activo'].forEach(c => {
        const icon = document.getElementById(`sort-usuarios-${c}`);
        if (icon) {
            if (c === col) {
                icon.className = dt.sortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                icon.style.color = '#38bdf8';
            } else {
                icon.className = 'fa-solid fa-sort';
                icon.style.color = '';
            }
        }
    });

    renderTablaUsuarios();
}
window.ordenarUsuarios = ordenarUsuarios;

function irAPaginaUsuarios(page) {
    state.datatableUsuarios.currentPage = page;
    renderTablaUsuarios();
}
window.irAPaginaUsuarios = irAPaginaUsuarios;

function onCambioRolUsuario(val) {
    const seccionCamion = document.getElementById('seccionCamionChofer');
    if (!seccionCamion) return;

    // Buscar código de rol si val es un ID
    let esChofer = false;
    const rolObj = state.rolesUsuarios.find(r => r.id.toString() === val.toString() || r.codigo.toUpperCase() === val.toString().toUpperCase());
    if (rolObj) {
        esChofer = (rolObj.codigo.toUpperCase() === 'CHOFER');
    } else {
        esChofer = (val.toString() === '4' || val.toString().toUpperCase() === 'CHOFER');
    }

    if (esChofer) {
        seccionCamion.style.display = 'block';
    } else {
        seccionCamion.style.display = 'none';
        const selCamion = document.getElementById('modalUsuarioCamionId');
        if (selCamion) selCamion.value = '';
        onCambioCamionEnUsuario('');
    }
}
window.onCambioRolUsuario = onCambioRolUsuario;

async function cargarSelectCamionesEnUsuario(camionIdPreseleccionado = null) {
    const sel = document.getElementById('modalUsuarioCamionId');
    if (!sel) return;

    try {
        sel.innerHTML = '<option value="">Cargando camiones de la flota...</option>';
        const res = await fetch(`${API_BASE}/camiones`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error('Error al cargar camiones');
        const camiones = await res.json();
        state.camiones = camiones || [];

        let html = '<option value="">-- Sin Camión Asignado / Disponible en Flota --</option>';
        state.camiones.forEach(c => {
            const isSelected = (camionIdPreseleccionado && c.id === camionIdPreseleccionado);
            const choferTag = c.choferNombre ? ` [Asignado: ${c.choferNombre}]` : ' [DISPONIBLE]';
            const capStr = Number(c.capacidadLitros || 0).toLocaleString();
            html += `<option value="${c.id}" ${isSelected ? 'selected' : ''}>${c.placa} - ${c.marcaModelo || 'Cisterna'} (${capStr} L / ${c.compartimientos} comp)${choferTag}</option>`;
        });

        sel.innerHTML = html;
        if (camionIdPreseleccionado) {
            sel.value = camionIdPreseleccionado.toString();
        }
        onCambioCamionEnUsuario(sel.value);
    } catch (err) {
        console.warn('Error al cargar select de camiones:', err);
        sel.innerHTML = '<option value="">-- Error al cargar flota de camiones --</option>';
    }
}
window.cargarSelectCamionesEnUsuario = cargarSelectCamionesEnUsuario;

function onCambioCamionEnUsuario(camionId) {
    const infoBox = document.getElementById('infoCamionSeleccionado');
    if (!infoBox) return;

    if (!camionId || camionId === '') {
        infoBox.style.display = 'none';
        infoBox.innerHTML = '';
        return;
    }

    const c = (state.camiones || []).find(cam => cam.id.toString() === camionId.toString());
    if (c) {
        infoBox.style.display = 'block';
        const cap = Number(c.capacidadLitros || 0).toLocaleString();
        infoBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <span><strong>Placa:</strong> <span class="badge badge-primary" style="font-family: monospace;">${c.placa}</span></span>
                <span><strong>Capacidad:</strong> <strong style="color: #047857;">${cap} Litros</strong></span>
                <span><strong>Compartimientos:</strong> ${c.compartimientos}</span>
                <span><strong>Marca/Modelo:</strong> ${c.marcaModelo || 'N/A'}</span>
            </div>
            ${c.choferNombre ? `<div style="margin-top: 6px; font-size: 11.5px; color: #b45309;"><i class="fa-solid fa-triangle-exclamation"></i> <em>Actualmente asignado a: ${c.choferNombre} (se reasignará a este conductor al guardar).</em></div>` : ''}
        `;
    } else {
        infoBox.style.display = 'none';
    }
}
window.onCambioCamionEnUsuario = onCambioCamionEnUsuario;

function toggleMostrarPassword(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
    } else {
        inp.type = 'password';
        if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    }
}
window.toggleMostrarPassword = toggleMostrarPassword;

function validarCoincidenciaPasswords() {
    const p1 = document.getElementById('modalUsuarioPassword')?.value || '';
    const p2 = document.getElementById('modalUsuarioPasswordConfirm')?.value || '';
    const msg = document.getElementById('msgMatchPassword');
    const inp1 = document.getElementById('modalUsuarioPassword');
    const inp2 = document.getElementById('modalUsuarioPasswordConfirm');
    if (!msg) return;

    if (!p1 && !p2) {
        msg.style.display = 'none';
        if (inp1) inp1.style.borderColor = '';
        if (inp2) inp2.style.borderColor = '';
        return true;
    }

    if (p1 && p2) {
        msg.style.display = 'block';
        if (p1 === p2) {
            msg.style.color = '#10b981';
            msg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Las contraseñas coinciden correctamente';
            if (inp1) inp1.style.borderColor = '#10b981';
            if (inp2) inp2.style.borderColor = '#10b981';
            return true;
        } else {
            msg.style.color = '#ef4444';
            msg.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Las contraseñas no coinciden';
            if (inp1) inp1.style.borderColor = '#ef4444';
            if (inp2) inp2.style.borderColor = '#ef4444';
            return false;
        }
    } else {
        msg.style.display = 'none';
        if (inp1) inp1.style.borderColor = '';
        if (inp2) inp2.style.borderColor = '';
        return false;
    }
}
window.validarCoincidenciaPasswords = validarCoincidenciaPasswords;

function cargarSelectCamionesEnUsuario(selectedCamionId) {
    const sel = document.getElementById('modalUsuarioCamionId');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Sin camión asignado --</option>';
    if (state.camiones && state.camiones.length > 0) {
        state.camiones.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.placa || ''} - ${c.marca || ''} ${c.modelo || ''} (Cap: ${(c.capacidadLitros || 0).toLocaleString('de-DE')} L)`;
            if (selectedCamionId && (c.id === selectedCamionId || c.id === parseInt(selectedCamionId))) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    }
}
window.cargarSelectCamionesEnUsuario = cargarSelectCamionesEnUsuario;

function onCambioRolUsuario(val) {
    const contenedorCamion = document.getElementById('contenedorCamionUsuario');
    const seccionBancos = document.getElementById('seccionTarifaYDatosBancariosUsuario');
    const selRol = document.getElementById('modalUsuarioRolId');
    const rolText = selRol ? selRol.options[selRol.selectedIndex]?.text.toUpperCase() : '';
    const rolVal = (val || '').toString().toUpperCase();

    const isChofer = rolVal === '4' || rolVal === 'CHOFER' || rolText.includes('CHOFER') || rolText.includes('CONDUCTOR');
    const isMatera = rolVal === '6' || rolVal === 'MATERA' || rolText.includes('MATERA');

    if (contenedorCamion) {
        contenedorCamion.style.display = isChofer ? 'block' : 'none';
        const selCamion = document.getElementById('modalUsuarioCamionId');
        if (selCamion && !isChofer) selCamion.value = '';
    }

    if (seccionBancos) {
        seccionBancos.style.display = (isChofer || isMatera) ? 'block' : 'block';
    }
}
window.onCambioRolUsuario = onCambioRolUsuario;

function abrirModalCrearUsuario() {
    document.getElementById('modalUsuarioTitle').textContent = 'Registrar Nuevo Usuario';
    document.getElementById('modalUsuarioId').value = '';
    document.getElementById('modalUsuarioUsername').value = '';
    document.getElementById('modalUsuarioUsername').disabled = false;
    
    const inputPass = document.getElementById('modalUsuarioPassword');
    const inputPassConfirm = document.getElementById('modalUsuarioPasswordConfirm');
    if (inputPass) {
        inputPass.value = '';
        inputPass.type = 'password';
        inputPass.required = true;
        inputPass.style.borderColor = '';
    }
    if (inputPassConfirm) {
        inputPassConfirm.value = '';
        inputPassConfirm.type = 'password';
        inputPassConfirm.required = true;
        inputPassConfirm.style.borderColor = '';
    }

    const icon1 = document.getElementById('eyePass1');
    if (icon1) { icon1.className = 'fa-solid fa-eye'; }
    const icon2 = document.getElementById('eyePass2');
    if (icon2) { icon2.className = 'fa-solid fa-eye'; }

    const msg = document.getElementById('msgMatchPassword');
    if (msg) msg.style.display = 'none';

    document.getElementById('labelPasswordRequerido').style.display = 'inline';
    const labelConfirm = document.getElementById('labelPasswordConfirmRequerido');
    if (labelConfirm) labelConfirm.style.display = 'inline';
    document.getElementById('helpPasswordEditar').style.display = 'none';

    document.getElementById('modalUsuarioNombreCompleto').value = '';
    document.getElementById('modalUsuarioCedula').value = '';
    document.getElementById('modalUsuarioTelefono').value = '';
    document.getElementById('modalUsuarioTarifaPorLitro').value = '';
    document.getElementById('modalUsuarioBancoNombre').value = '';
    document.getElementById('modalUsuarioNumeroCuenta').value = '';
    document.getElementById('modalUsuarioCedulaPagoMovil').value = '';
    document.getElementById('modalUsuarioTelefonoPagoMovil').value = '';

    // Selector de Rol (por defecto Chofer)
    const selRol = document.getElementById('modalUsuarioRolId');
    if (selRol) {
        const optChofer = Array.from(selRol.options).find(o => o.text.includes('CHOFER') || o.value === '4');
        if (optChofer) selRol.value = optChofer.value;
    }

    document.getElementById('modalUsuarioActivo').checked = true;

    // Cargar selector de camiones de la flota
    cargarSelectCamionesEnUsuario(null);
    onCambioRolUsuario(selRol ? selRol.value : '4');

    const modal = document.getElementById('modalUsuarioCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalCrearUsuario = abrirModalCrearUsuario;

function abrirModalEditarUsuario(id) {
    const usuario = state.usuarios.find(u => u.id === id);
    if (!usuario) return;

    document.getElementById('modalUsuarioTitle').textContent = 'Editar Usuario del Sistema';
    document.getElementById('modalUsuarioId').value = usuario.id;
    document.getElementById('modalUsuarioUsername').value = usuario.username || '';
    document.getElementById('modalUsuarioUsername').disabled = true;

    const inputPass = document.getElementById('modalUsuarioPassword');
    const inputPassConfirm = document.getElementById('modalUsuarioPasswordConfirm');
    if (inputPass) {
        inputPass.value = '';
        inputPass.type = 'password';
        inputPass.required = false;
        inputPass.style.borderColor = '';
    }
    if (inputPassConfirm) {
        inputPassConfirm.value = '';
        inputPassConfirm.type = 'password';
        inputPassConfirm.required = false;
        inputPassConfirm.style.borderColor = '';
    }

    const icon1 = document.getElementById('eyePass1');
    if (icon1) { icon1.className = 'fa-solid fa-eye'; }
    const icon2 = document.getElementById('eyePass2');
    if (icon2) { icon2.className = 'fa-solid fa-eye'; }

    const msg = document.getElementById('msgMatchPassword');
    if (msg) msg.style.display = 'none';

    document.getElementById('labelPasswordRequerido').style.display = 'none';
    const labelConfirm = document.getElementById('labelPasswordConfirmRequerido');
    if (labelConfirm) labelConfirm.style.display = 'none';
    document.getElementById('helpPasswordEditar').style.display = 'block';

    document.getElementById('modalUsuarioNombreCompleto').value = usuario.nombreCompleto || '';
    document.getElementById('modalUsuarioCedula').value = usuario.cedula || '';
    document.getElementById('modalUsuarioTelefono').value = usuario.telefono || '';
    document.getElementById('modalUsuarioTarifaPorLitro').value = usuario.tarifaPorLitro || (usuario.TarifaPorLitro || '');
    document.getElementById('modalUsuarioBancoNombre').value = usuario.bancoNombre || (usuario.BancoNombre || '');
    document.getElementById('modalUsuarioNumeroCuenta').value = usuario.numeroCuenta || (usuario.NumeroCuenta || '');
    document.getElementById('modalUsuarioCedulaPagoMovil').value = usuario.cedulaPagoMovil || (usuario.CedulaPagoMovil || '');
    document.getElementById('modalUsuarioTelefonoPagoMovil').value = usuario.telefonoPagoMovil || (usuario.TelefonoPagoMovil || '');

    const selRol = document.getElementById('modalUsuarioRolId');
    if (selRol) {
        if (usuario.rolId) {
            selRol.value = usuario.rolId.toString();
        } else {
            const opt = Array.from(selRol.options).find(o => o.text.includes(usuario.rol));
            if (opt) selRol.value = opt.value;
        }
    }

    document.getElementById('modalUsuarioActivo').checked = usuario.activo !== false;

    // Cargar selector de camiones y preseleccionar el del usuario
    const camionId = usuario.camion ? usuario.camion.id : null;
    cargarSelectCamionesEnUsuario(camionId);
    onCambioRolUsuario(selRol ? selRol.value : (usuario.rolId || '4'));

    const modal = document.getElementById('modalUsuarioCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalEditarUsuario = abrirModalEditarUsuario;

async function guardarUsuarioSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalUsuarioId').value;
    const username = document.getElementById('modalUsuarioUsername').value.trim();
    const password = document.getElementById('modalUsuarioPassword').value;
    const passwordConfirm = document.getElementById('modalUsuarioPasswordConfirm')?.value || '';
    const nombreCompleto = document.getElementById('modalUsuarioNombreCompleto').value.trim();
    const cedula = document.getElementById('modalUsuarioCedula').value.trim();
    const telefono = document.getElementById('modalUsuarioTelefono').value.trim();
    const tarifaPorLitro = parseFloat(document.getElementById('modalUsuarioTarifaPorLitro').value) || 0;
    const bancoNombre = document.getElementById('modalUsuarioBancoNombre').value.trim();
    const numeroCuenta = document.getElementById('modalUsuarioNumeroCuenta').value.trim();
    const cedulaPagoMovil = document.getElementById('modalUsuarioCedulaPagoMovil').value.trim();
    const telefonoPagoMovil = document.getElementById('modalUsuarioTelefonoPagoMovil').value.trim();
    const rolVal = document.getElementById('modalUsuarioRolId').value;
    const rolId = parseInt(rolVal) || null;
    const activo = document.getElementById('modalUsuarioActivo').checked;

    const isEdit = id && id !== '';

    // Doble verificación de contraseña
    if (!isEdit) {
        if (!password) {
            Swal.fire({ icon: 'warning', title: 'Contraseña Requerida', text: 'La contraseña es obligatoria para nuevos usuarios', background: '#1e293b', color: '#f8fafc' });
            return;
        }
        if (password.length < 6) {
            Swal.fire({ icon: 'warning', title: 'Contraseña Corta', text: 'La contraseña debe tener un mínimo de 6 caracteres', background: '#1e293b', color: '#f8fafc' });
            return;
        }
        if (password !== passwordConfirm) {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Contraseñas no coinciden', 
                text: 'La contraseña y su confirmación no son iguales. Por favor verifíquelas.', 
                background: '#1e293b', 
                color: '#f8fafc' 
            });
            return;
        }
    } else {
        // Al editar, si ingresó contraseña o confirmación
        if (password || passwordConfirm) {
            if (password !== passwordConfirm) {
                Swal.fire({ 
                    icon: 'warning', 
                    title: 'Contraseñas no coinciden', 
                    text: 'La nueva contraseña y su confirmación no son iguales. Por favor verifíquelas.', 
                    background: '#1e293b', 
                    color: '#f8fafc' 
                });
                return;
            }
            if (password.length < 6) {
                Swal.fire({ icon: 'warning', title: 'Contraseña Corta', text: 'La contraseña debe tener un mínimo de 6 caracteres', background: '#1e293b', color: '#f8fafc' });
                return;
            }
        }
    }

    // Buscar código de rol
    let rolCodigo = 'CHOFER';
    const rolObj = state.rolesUsuarios.find(r => r.id === rolId || r.codigo.toUpperCase() === rolVal.toUpperCase());
    if (rolObj) {
        rolCodigo = rolObj.codigo;
    } else if (rolId === 6 || rolVal === '6' || rolVal.toUpperCase() === 'MATERA') {
        rolCodigo = 'MATERA';
    }

    // Camión seleccionado de la flota
    const camionIdVal = document.getElementById('modalUsuarioCamionId')?.value;
    const camionId = (rolCodigo === 'CHOFER' && camionIdVal && camionIdVal !== '') ? parseInt(camionIdVal) : 0;

    const payload = {
        username,
        password: password || undefined,
        nombreCompleto,
        cedula,
        telefono,
        tarifaPorLitro,
        bancoNombre,
        numeroCuenta,
        cedulaPagoMovil,
        telefonoPagoMovil,
        rol: rolCodigo,
        rolId,
        activo,
        camionId
    };

    const url = isEdit ? `${API_BASE}/usuarios/${id}` : `${API_BASE}/usuarios`;
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
            const err = await res.json().catch(() => ({ message: 'Error al procesar la solicitud' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalUsuarioCustom');
        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Usuario Actualizado' : 'Usuario Creado',
            text: `El usuario "${nombreCompleto}" fue guardado exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });

        await cargarUsuariosCat();
        if (typeof cargarConductoresCat === 'function') {
            cargarConductoresCat();
        }
    } catch (err) {
        console.error('Error al guardar usuario:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.guardarUsuarioSubmit = guardarUsuarioSubmit;

async function eliminarUsuario(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar Usuario?',
        html: `¿Está seguro de eliminar al usuario <strong>${nombre}</strong>?<br><small style="color: #94a3b8;">El usuario ya no podrá iniciar sesión en el sistema.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/usuarios/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al eliminar' }));
            throw new Error(err.message || 'No se pudo eliminar el usuario.');
        }

        Swal.fire({
            icon: 'success',
            title: 'Usuario Eliminado',
            text: `El usuario "${nombre}" fue eliminado correctamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        await cargarUsuariosCat();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.eliminarUsuario = eliminarUsuario;

// ==========================================================================
// CAMBIAR / ACTUALIZAR CONTRASEÑA DE USUARIO
// ==========================================================================
function abrirModalCambiarPassword(id, username, nombreCompleto) {
    document.getElementById('modalCambiarPassUsuarioId').value = id;
    document.getElementById('labelUsuarioCambiarPass').textContent = `@${username}`;
    document.getElementById('labelNombreCambiarPass').textContent = nombreCompleto;

    const inp1 = document.getElementById('modalNuevaPass');
    const inp2 = document.getElementById('modalConfirmarNuevaPass');
    if (inp1) {
        inp1.value = '';
        inp1.type = 'password';
        inp1.style.borderColor = '';
    }
    if (inp2) {
        inp2.value = '';
        inp2.type = 'password';
        inp2.style.borderColor = '';
    }

    const icon1 = document.getElementById('eyeNuevaPass1');
    if (icon1) { icon1.className = 'fa-solid fa-eye'; }
    const icon2 = document.getElementById('eyeNuevaPass2');
    if (icon2) { icon2.className = 'fa-solid fa-eye'; }

    const msg = document.getElementById('msgMatchNuevaPassword');
    if (msg) msg.style.display = 'none';

    const modal = document.getElementById('modalCambiarPasswordCustom');
    if (modal) modal.style.display = 'flex';
}
window.abrirModalCambiarPassword = abrirModalCambiarPassword;

function validarCoincidenciaNuevaPassword() {
    const p1 = document.getElementById('modalNuevaPass')?.value || '';
    const p2 = document.getElementById('modalConfirmarNuevaPass')?.value || '';
    const msg = document.getElementById('msgMatchNuevaPassword');
    const inp1 = document.getElementById('modalNuevaPass');
    const inp2 = document.getElementById('modalConfirmarNuevaPass');
    if (!msg) return;

    if (!p1 && !p2) {
        msg.style.display = 'none';
        if (inp1) inp1.style.borderColor = '';
        if (inp2) inp2.style.borderColor = '';
        return true;
    }

    if (p1 && p2) {
        msg.style.display = 'block';
        if (p1 === p2) {
            msg.style.color = '#10b981';
            msg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Las contraseñas coinciden correctamente';
            if (inp1) inp1.style.borderColor = '#10b981';
            if (inp2) inp2.style.borderColor = '#10b981';
            return true;
        } else {
            msg.style.color = '#ef4444';
            msg.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Las contraseñas no coinciden';
            if (inp1) inp1.style.borderColor = '#ef4444';
            if (inp2) inp2.style.borderColor = '#ef4444';
            return false;
        }
    } else {
        msg.style.display = 'none';
        if (inp1) inp1.style.borderColor = '';
        if (inp2) inp2.style.borderColor = '';
        return false;
    }
}
window.validarCoincidenciaNuevaPassword = validarCoincidenciaNuevaPassword;

async function guardarCambioPasswordSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalCambiarPassUsuarioId').value;
    const p1 = document.getElementById('modalNuevaPass').value;
    const p2 = document.getElementById('modalConfirmarNuevaPass').value;

    if (!p1 || p1.length < 6) {
        Swal.fire({
            icon: 'warning',
            title: 'Contraseña Corta',
            text: 'La nueva contraseña debe contener al menos 6 caracteres.',
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    if (p1 !== p2) {
        Swal.fire({
            icon: 'warning',
            title: 'Contraseñas no coinciden',
            text: 'La contraseña y la confirmación no son iguales. Por favor verifíquelas.',
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/usuarios/${id}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ nuevaPassword: p1 })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al actualizar contraseña' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        cerrarModalCustom('modalCambiarPasswordCustom');
        Swal.fire({
            icon: 'success',
            title: 'Contraseña Actualizada',
            text: 'La contraseña ha sido modificada exitosamente.',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Actualizar',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.guardarCambioPasswordSubmit = guardarCambioPasswordSubmit;

// ==========================================================================
// CARGAR CONDUCTORES CAT (TAB-CONDUCTORES CON TB_CAMIONES)
// ==========================================================================
async function cargarConductoresCat() {
    const tbody = document.getElementById('tbodyConductoresList');
    if (!tbody) return;

    try {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando conductores y camiones...</td></tr>`;

        const res = await fetch(`${API_BASE}/usuarios?rol=CHOFER`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 20px; color: #f87171;">Error al cargar conductores</td></tr>`;
            return;
        }

        const choferes = await res.json();
        if (!choferes || choferes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: #94a3b8;">No se encontraron conductores registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = choferes.map(c => {
            const camion = c.camion;
            const placaBadge = camion && camion.placa
                ? `<span class="badge badge-primary" style="font-family: monospace; font-size: 12px; font-weight: 800;">${camion.placa}</span>`
                : `<span style="color: #94a3b8; font-size: 12px;">Sin Camión</span>`;

            const capacidadStr = camion && camion.capacidadLitros > 0
                ? `<strong style="color: #047857; font-size: 13.5px;">${camion.capacidadLitros.toLocaleString()} L</strong>`
                : `<span style="color: #94a3b8;">-</span>`;

            const compartimientosStr = camion && camion.compartimientos > 0
                ? `<span class="badge" style="background: #f1f5f9; color: #334155; font-weight: 700; font-size: 11px; border: 1px solid #cbd5e1;">${camion.compartimientos} ${camion.compartimientos === 1 ? 'Compartimiento' : 'Compartimientos'}</span>`
                : `<span style="color: #94a3b8;">-</span>`;

            return `
                <tr>
                    <td><span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; border: 1px solid #cbd5e1;">#${c.id}</span></td>
                    <td><strong style="color: #0f172a; font-size: 13.5px;">${capitalizarTexto(c.nombreCompleto)}</strong></td>
                    <td><span style="font-family: monospace; color: #2563eb; font-size: 12.5px; font-weight: 700;">${c.username}</span></td>
                    <td><span style="color: #475569; font-size: 12.5px; font-weight: 600;">${c.cedula || '-'}</span></td>
                    <td style="text-align: center;">${placaBadge}</td>
                    <td style="text-align: center;">${compartimientosStr}</td>
                    <td style="text-align: right;">${capacidadStr}</td>
                    <td style="text-align: center;">
                        <span class="badge ${c.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 11px;">
                            <i class="fa-solid ${c.activo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarUsuario(${c.id})" title="Editar Chofer y Camión" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.warn('Error cargando conductores:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar catálogo de conductores</td></tr>`;
    }
}
window.cargarConductoresCat = cargarConductoresCat;

// ==========================================================================
// MÓDULO CRUD DE CAMIONES (FLOTA TB_CAMIONES)
// ==========================================================================
state.camiones = [];
state.datatableCamiones = {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    busqueda: '',
    filtroEstado: 'TODOS'
};

async function cargarCamionesCat() {
    const tbody = document.getElementById('tbodyCamionesList');
    if (!tbody) return;

    try {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando flota de camiones...</td></tr>`;

        const res = await fetch(`${API_BASE}/camiones`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 20px; color: #f87171;">Error al cargar camiones</td></tr>`;
            return;
        }

        const data = await res.json();
        state.camiones = data || [];
        renderTablaCamiones();
    } catch (err) {
        console.warn('Error cargando camiones:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 20px; color: #f87171;">Error al consultar camiones</td></tr>`;
    }
}
window.cargarCamionesCat = cargarCamionesCat;

function renderTablaCamiones() {
    const tbody = document.getElementById('tbodyCamionesList');
    if (!tbody) return;

    let items = [...(state.camiones || [])];

    // Filtro de búsqueda
    const busq = (document.getElementById('buscarCamionInput')?.value || '').trim().toLowerCase();
    if (busq) {
        items = items.filter(c => 
            (c.placa && c.placa.toLowerCase().includes(busq)) ||
            (c.marcaModelo && c.marcaModelo.toLowerCase().includes(busq)) ||
            (c.choferNombre && c.choferNombre.toLowerCase().includes(busq)) ||
            (c.choferCedula && c.choferCedula.toLowerCase().includes(busq)) ||
            (c.observaciones && c.observaciones.toLowerCase().includes(busq))
        );
    }

    // Filtro de estado / asignación
    const filtroEstado = document.getElementById('filtroEstadoCamion')?.value || 'TODOS';
    if (filtroEstado === 'ASIGNADOS') {
        items = items.filter(c => c.usuarioId && c.usuarioId > 0);
    } else if (filtroEstado === 'DISPONIBLES') {
        items = items.filter(c => !c.usuarioId || c.usuarioId <= 0);
    }

    const badgeTotal = document.getElementById('badgeTotalCamiones');
    if (badgeTotal) badgeTotal.textContent = `${items.length} ${items.length === 1 ? 'Camión' : 'Camiones'}`;

    state.datatableCamiones.totalItems = items.length;
    const totalPages = Math.ceil(items.length / state.datatableCamiones.pageSize) || 1;
    if (state.datatableCamiones.currentPage > totalPages) state.datatableCamiones.currentPage = totalPages;
    if (state.datatableCamiones.currentPage < 1) state.datatableCamiones.currentPage = 1;

    const startIdx = (state.datatableCamiones.currentPage - 1) * state.datatableCamiones.pageSize;
    const paginatedItems = items.slice(startIdx, startIdx + state.datatableCamiones.pageSize);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: #94a3b8;">No se encontraron camiones registrados</td></tr>`;
        renderPaginacionCamiones(totalPages, items.length, startIdx, 0);
        return;
    }

    tbody.innerHTML = paginatedItems.map(c => {
        const placaBadge = `<span class="badge badge-primary" style="font-family: monospace; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; padding: 4px 8px;">${c.placa}</span>`;
        const cap = Number(c.capacidadLitros || 0).toLocaleString();
        const compartimientosStr = `<span class="badge" style="background: #f1f5f9; color: #334155; font-weight: 700; font-size: 11px; border: 1px solid #cbd5e1;">${c.compartimientos} ${c.compartimientos === 1 ? 'Comp' : 'Comps'}</span>`;

        const choferBadge = c.usuarioId && c.choferNombre
            ? `<div style="display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-user-check" style="color: #10b981; font-size: 12px;"></i>
                <div>
                    <strong style="color: #0f172a; font-size: 13px; display: block;">${c.choferNombre}</strong>
                    <small style="color: #64748b; font-size: 11px;">${c.choferCedula || ''}</small>
                </div>
               </div>`
            : `<span class="badge badge-warning" style="font-size: 11px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
                <i class="fa-solid fa-clock"></i> Disponible en Flota
               </span>`;

        return `
            <tr>
                <td><span class="badge" style="background: #f8fafc; color: #475569; font-weight: 700; font-size: 12px; border: 1px solid #e2e8f0;">#${c.id}</span></td>
                <td style="text-align: center;">${placaBadge}</td>
                <td><strong style="color: #1e293b; font-size: 13px;">${c.marcaModelo || '<span style="color:#94a3b8;">Sin especificar</span>'}</strong></td>
                <td style="text-align: center;">${compartimientosStr}</td>
                <td style="text-align: right;"><strong style="color: #047857; font-size: 14px; font-weight: 800;">${cap} L</strong></td>
                <td>${choferBadge}</td>
                <td><span style="color: #64748b; font-size: 12px;">${c.observaciones || '-'}</span></td>
                <td style="text-align: center;">
                    <span class="badge ${c.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 11px;">
                        <i class="fa-solid ${c.activo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 6px;">
                        <button type="button" class="btn btn-outline" onclick="abrirModalEditarCamion(${c.id})" title="Editar Camión" style="padding: 4px 8px; font-size: 12px; border-color: #93c5fd; color: #2563eb; background: #eff6ff;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline" onclick="eliminarCamion(${c.id}, '${c.placa}')" title="Eliminar Camión" style="padding: 4px 8px; font-size: 12px; border-color: #fecaca; color: #dc2626; background: #fef2f2;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPaginacionCamiones(totalPages, items.length, startIdx, paginatedItems.length);
}
window.renderTablaCamiones = renderTablaCamiones;

function filtrarCamiones() {
    state.datatableCamiones.currentPage = 1;
    renderTablaCamiones();
}
window.filtrarCamiones = filtrarCamiones;

function irAPaginaCamiones(page) {
    state.datatableCamiones.currentPage = page;
    renderTablaCamiones();
}
window.irAPaginaCamiones = irAPaginaCamiones;

function renderPaginacionCamiones(totalPages, totalItems, startIdx, countCurrent) {
    const info = document.getElementById('infoPaginacionCamiones');
    const container = document.getElementById('paginacionCamionesBtns');
    if (!info || !container) return;

    if (totalItems === 0) {
        info.textContent = 'Mostrando 0 registros';
        container.innerHTML = '';
        return;
    }

    const start = startIdx + 1;
    const end = startIdx + countCurrent;
    info.textContent = `Mostrando ${start} a ${end} de ${totalItems} vehículos`;

    let btnsHtml = '';
    btnsHtml += `<button type="button" class="btn btn-outline" ${state.datatableCamiones.currentPage === 1 ? 'disabled' : ''} onclick="irAPaginaCamiones(${state.datatableCamiones.currentPage - 1})" style="padding: 3px 8px; font-size: 12px;">&laquo; Ant</button>`;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= state.datatableCamiones.currentPage - 1 && p <= state.datatableCamiones.currentPage + 1)) {
            btnsHtml += `<button type="button" class="btn ${p === state.datatableCamiones.currentPage ? 'btn-primary' : 'btn-outline'}" onclick="irAPaginaCamiones(${p})" style="padding: 3px 9px; font-size: 12px; min-width: 28px;">${p}</button>`;
        } else if (p === state.datatableCamiones.currentPage - 2 || p === state.datatableCamiones.currentPage + 2) {
            btnsHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
        }
    }

    btnsHtml += `<button type="button" class="btn btn-outline" ${state.datatableCamiones.currentPage === totalPages ? 'disabled' : ''} onclick="irAPaginaCamiones(${state.datatableCamiones.currentPage + 1})" style="padding: 3px 8px; font-size: 12px;">Sig &raquo;</button>`;
    container.innerHTML = btnsHtml;
}

async function cargarChoferesParaCamionModal(choferIdSeleccionado = null) {
    if (!comboboxModalStandaloneChoferInstance && document.getElementById('comboboxModalStandaloneChofer')) {
        comboboxModalStandaloneChoferInstance = setupCombobox({
            containerId: 'comboboxModalStandaloneChofer',
            inputSearchId: 'searchModalStandaloneChoferInput',
            inputHiddenId: 'modalStandaloneChoferId',
            dropdownId: 'dropdownModalStandaloneChoferList',
            placeholder: '-- DISPONIBLE EN FLOTA (SIN CHOFER ASIGNADO) --',
            getItemsFn: () => {
                const list = [{ value: '', label: '-- DISPONIBLE EN FLOTA (SIN CHOFER ASIGNADO) --', sub: '' }];
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
            }
        });
        window.comboboxModalStandaloneChoferInstance = comboboxModalStandaloneChoferInstance;
    }

    if (comboboxModalStandaloneChoferInstance) {
        if (choferIdSeleccionado) {
            const listChoferes = (state.choferes && state.choferes.length) ? state.choferes : (state.conductores || []);
            const ch = listChoferes.find(c => Number(c.id || c.Id) === Number(choferIdSeleccionado));
            if (ch) {
                const nombre = ch.nombreCompleto || ch.NombreCompleto || ch.username || ch.Username || '';
                comboboxModalStandaloneChoferInstance.selectItem(ch.id || ch.Id, capitalizarTexto(nombre));
            } else {
                comboboxModalStandaloneChoferInstance.selectItem(choferIdSeleccionado, `Conductor #${choferIdSeleccionado}`);
            }
        } else {
            comboboxModalStandaloneChoferInstance.reset();
        }
    }
}

function abrirModalCrearCamion() {
    window._creandoCamionParaUsuario = false;
    document.getElementById('modalCamionStandaloneTitle').textContent = 'Registrar Nuevo Camión';
    document.getElementById('modalStandaloneCamionId').value = '';
    document.getElementById('modalStandalonePlaca').value = '';
    document.getElementById('modalStandaloneCapacidadLitros').value = '';
    document.getElementById('modalStandaloneCompartimientos').value = '1';
    document.getElementById('modalStandaloneMarcaModelo').value = '';
    document.getElementById('modalStandaloneObservaciones').value = '';
    document.getElementById('modalStandaloneActivo').checked = true;

    cargarChoferesParaCamionModal(null);
    abrirModalCustom('modalCamionStandalone');
}
window.abrirModalCrearCamion = abrirModalCrearCamion;

function abrirModalCrearCamionRapido() {
    abrirModalCrearCamion();
    window._creandoCamionParaUsuario = true;
}
window.abrirModalCrearCamionRapido = abrirModalCrearCamionRapido;

async function abrirModalEditarCamion(id) {
    window._creandoCamionParaUsuario = false;
    let camion = (state.camiones || []).find(c => c.id == id);
    if (!camion) {
        try {
            const res = await fetch(`${API_BASE}/camiones/${id}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (res.ok) camion = await res.json();
        } catch (e) {
            console.warn('Error buscando camión:', e);
        }
    }

    if (!camion) {
        Swal.fire({
            icon: 'error',
            title: 'No encontrado',
            text: 'No se pudo localizar el camión seleccionado',
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    document.getElementById('modalCamionStandaloneTitle').textContent = `Editar Camión: ${camion.placa}`;
    document.getElementById('modalStandaloneCamionId').value = camion.id;
    document.getElementById('modalStandalonePlaca').value = camion.placa || '';
    document.getElementById('modalStandaloneCapacidadLitros').value = camion.capacidadLitros || '';
    document.getElementById('modalStandaloneCompartimientos').value = (camion.compartimientos || 1).toString();
    document.getElementById('modalStandaloneMarcaModelo').value = camion.marcaModelo || '';
    document.getElementById('modalStandaloneObservaciones').value = camion.observaciones || '';
    document.getElementById('modalStandaloneActivo').checked = camion.activo !== false;

    await cargarChoferesParaCamionModal(camion.usuarioId || null);
    abrirModalCustom('modalCamionStandalone');
}
window.abrirModalEditarCamion = abrirModalEditarCamion;

async function guardarCamionStandaloneSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalStandaloneCamionId').value;
    const placa = document.getElementById('modalStandalonePlaca').value.trim().toUpperCase();
    const capacidadLitros = parseFloat(document.getElementById('modalStandaloneCapacidadLitros').value) || 0;
    const compartimientos = parseInt(document.getElementById('modalStandaloneCompartimientos').value) || 1;
    const marcaModelo = document.getElementById('modalStandaloneMarcaModelo').value.trim() || null;
    const usuarioIdVal = document.getElementById('modalStandaloneChoferId').value;
    const usuarioId = usuarioIdVal ? parseInt(usuarioIdVal) : null;
    const observaciones = document.getElementById('modalStandaloneObservaciones').value.trim() || null;
    const activo = document.getElementById('modalStandaloneActivo').checked;

    if (!placa) {
        Swal.fire({ icon: 'warning', title: 'Placa Requerida', text: 'La placa del camión es obligatoria', background: '#1e293b', color: '#f8fafc' });
        return;
    }
    if (capacidadLitros <= 0) {
        Swal.fire({ icon: 'warning', title: 'Capacidad Inválida', text: 'La capacidad en litros debe ser mayor a 0', background: '#1e293b', color: '#f8fafc' });
        return;
    }

    const isEdit = id && id !== '';
    const payload = {
        placa,
        capacidadLitros,
        compartimientos,
        marcaModelo,
        usuarioId,
        observaciones,
        activo
    };

    const url = isEdit ? `${API_BASE}/camiones/${id}` : `${API_BASE}/camiones`;
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
            const err = await res.json().catch(() => ({ message: 'Error al procesar camión' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        const resJson = await res.json().catch(() => ({}));
        cerrarModalCustom('modalCamionStandalone');

        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Camión Actualizado' : 'Camión Registrado',
            text: `El camión con placa "${placa}" fue guardado exitosamente.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        // Recargar flota de camiones
        await cargarCamionesCat();
        if (typeof cargarConductoresCat === 'function') cargarConductoresCat();
        if (typeof cargarUsuariosCat === 'function') cargarUsuariosCat();

        // Si fue creado desde el modal de usuario, refrescar el select y preseleccionarlo
        if (window._creandoCamionParaUsuario) {
            const nuevoId = resJson.id || null;
            await cargarSelectCamionesEnUsuario(nuevoId);
            window._creandoCamionParaUsuario = false;
        }
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
window.guardarCamionStandaloneSubmit = guardarCamionStandaloneSubmit;

async function eliminarCamion(id, placa) {
    const result = await Swal.fire({
        title: '¿Eliminar Camión?',
        text: `¿Estás seguro de dar de baja el camión "${placa}" de la flota?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, Eliminar',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_BASE}/camiones/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Error al eliminar camión' }));
            throw new Error(err.message || 'Error en el servidor');
        }

        Swal.fire({
            icon: 'success',
            title: 'Camión Eliminado',
            text: `El camión "${placa}" fue retirado de la flota.`,
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1800,
            showConfirmButton: false
        });

        await cargarCamionesCat();
        if (typeof cargarConductoresCat === 'function') cargarConductoresCat();
        if (typeof cargarUsuariosCat === 'function') cargarUsuariosCat();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Eliminar',
            text: err.message,
            background: '#1e293b',
            color: '#f8fafc'
        });
    }
}
window.eliminarCamion = eliminarCamion;
