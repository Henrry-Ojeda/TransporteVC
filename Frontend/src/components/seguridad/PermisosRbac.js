// ==========================================================================
// MODAL SYSTEM CONTROLS (GLOBALES)
// ==========================================================================
function abrirModalCustom(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Modal con ID '${id}' no encontrado.`);
        return;
    }
    el.style.display = 'flex';
    el.classList.add('open');
}
window.abrirModalCustom = abrirModalCustom;

function cerrarModalCustom(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    el.style.display = 'none';
}
window.cerrarModalCustom = cerrarModalCustom;

let cacheRBAC = {
    roles: [],
    modulos: [],
    modulosCat: [],
    permisos: [],
    rolActivoId: null,
    permisosRolActivo: new Set(),
    subvistaActiva: 'matriz',
    filtroMatriz: '',
    filtroModulos: '',
    filtroPermisos: ''
};

// Conmutar entre sub-pestañas: Matriz, Catálogo Módulos, Catálogo Acciones
function conmutarSubvistaPermisos(subvista) {
    cacheRBAC.subvistaActiva = subvista;
    
    // Botones
    const btns = {
        matriz: document.getElementById('btnSubtabMatriz'),
        modulos: document.getElementById('btnSubtabModulos'),
        acciones: document.getElementById('btnSubtabAcciones')
    };
    Object.keys(btns).forEach(k => {
        const btn = btns[k];
        if (btn) {
            if (k === subvista) {
                btn.classList.add('active');
                btn.style.background = '#2563eb';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = '0 4px 12px rgba(37,99,235,0.25)';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = '#475569';
                btn.style.boxShadow = 'none';
            }
        }
    });

    // Paneles
    const paneles = {
        matriz: document.getElementById('subvista-matriz'),
        modulos: document.getElementById('subvista-modulos'),
        acciones: document.getElementById('subvista-acciones')
    };
    Object.keys(paneles).forEach(k => {
        if (paneles[k]) {
            paneles[k].style.display = (k === subvista) ? 'block' : 'none';
        }
    });

    if (subvista === 'modulos') {
        cargarModulosCat();
    } else if (subvista === 'acciones') {
        cargarPermisosCat();
    } else if (subvista === 'matriz') {
        renderMatrizPermisos();
    }
}
window.conmutarSubvistaPermisos = conmutarSubvistaPermisos;

// Cargar todo el módulo de permisos
async function cargarModuloPermisos() {
    try {
        const [respMatriz, respModulos, respPermisos] = await Promise.all([
            fetch('/api/permisos/matriz', { headers: getAuthHeaders() }),
            fetch('/api/permisos/modulos', { headers: getAuthHeaders() }),
            fetch('/api/permisos', { headers: getAuthHeaders() })
        ]);

        if (respMatriz.ok) {
            const dataMatriz = await respMatriz.json();
            cacheRBAC.roles = dataMatriz.roles || [];
            cacheRBAC.modulos = dataMatriz.modulos || [];
        }

        if (respModulos.ok) {
            cacheRBAC.modulosCat = await respModulos.json();
            if (!cacheRBAC.modulos || cacheRBAC.modulos.length === 0) {
                cacheRBAC.modulos = cacheRBAC.modulosCat;
            }
        }

        if (respPermisos.ok) {
            cacheRBAC.permisos = await respPermisos.json();
        }

        // Actualizar KPIs
        actualizarKpisRBAC();

        // Renderizar pills de roles
        renderRolesPillsRBAC();

        // Poblar selectores dependientes de módulos
        poblarSelectoresModulosRBAC();

        // Si no hay rol activo seleccionado o ya no existe, seleccionar el primero
        if (!cacheRBAC.rolActivoId && cacheRBAC.roles.length > 0) {
            cacheRBAC.rolActivoId = Number(cacheRBAC.roles[0].id || cacheRBAC.roles[0].Id || cacheRBAC.roles[0].rolId || cacheRBAC.roles[0].RolId);
        }

        if (cacheRBAC.rolActivoId) {
            await seleccionarRolMatrizRBAC(cacheRBAC.rolActivoId, false);
        } else {
            renderMatrizPermisos();
        }

        // Si la subvista actual no es matriz, cargarla
        if (cacheRBAC.subvistaActiva === 'modulos') {
            renderTablaModulosCat(cacheRBAC.modulosCat || []);
        } else if (cacheRBAC.subvistaActiva === 'acciones') {
            renderTablaPermisosCat(cacheRBAC.permisos || []);
        }

    } catch (err) {
        console.error('Error al cargar módulo de permisos:', err);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error de Conexión',
                text: 'No se pudieron cargar los datos de seguridad y permisos: ' + err.message
            });
        }
    }
}
window.cargarModuloPermisos = cargarModuloPermisos;

function actualizarKpisRBAC() {
    const elMod = document.getElementById('kpiTotalModulosRBAC');
    const elPerm = document.getElementById('kpiTotalPermisosRBAC');
    const elRol = document.getElementById('kpiTotalRolesRBAC');

    if (elMod) elMod.textContent = (cacheRBAC.modulosCat || cacheRBAC.modulos || []).length;
    if (elPerm) elPerm.textContent = (cacheRBAC.permisos || []).length;
    if (elRol) elRol.textContent = (cacheRBAC.roles || []).length;
}

function renderRolesPillsRBAC() {
    const cont = document.getElementById('contenedorPillsRoles');
    if (!cont) return;

    if (!cacheRBAC.roles || cacheRBAC.roles.length === 0) {
        cont.innerHTML = '<span style="color: #64748b; font-size: 13px; font-weight: 600;">No hay roles configurados</span>';
        return;
    }

    let html = '';
    cacheRBAC.roles.forEach(r => {
        const rId = Number(r.id || r.Id || r.rolId || r.RolId);
        const rNom = r.nombre || r.Nombre || `Rol ${rId}`;
        const esActivo = (rId === cacheRBAC.rolActivoId);
        
        const activeStyle = esActivo 
            ? 'background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; border-color: #1d4ed8; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3); transform: translateY(-1px);'
            : 'background: #ffffff; color: #334155; border-color: #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02);';

        html += `
            <button type="button" class="btn btn-sm" onclick="seleccionarRolMatrizRBAC(${rId})" 
                style="padding: 8px 16px; font-size: 12.5px; font-weight: 700; border-radius: 10px; border: 1.5px solid; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; ${activeStyle}"
                onmouseover="if(!${esActivo}) { this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc'; }"
                onmouseout="if(!${esActivo}) { this.style.borderColor='#e2e8f0'; this.style.background='#ffffff'; }">
                <i class="fa-solid fa-user-shield" style="font-size: 13px; ${esActivo ? 'color: #ffffff;' : 'color: #2563eb;'}"></i>
                <span>${rNom}</span>
            </button>
        `;
    });

    cont.innerHTML = html;
}

async function seleccionarRolMatrizRBAC(rolId, reRenderPills = true) {
    cacheRBAC.rolActivoId = Number(rolId);
    if (reRenderPills) renderRolesPillsRBAC();

    const rolObj = (cacheRBAC.roles || []).find(r => Number(r.id || r.Id || r.rolId || r.RolId) === cacheRBAC.rolActivoId);
    const lblNom = document.getElementById('lblNombreRolActivo');
    const lblDesc = document.getElementById('lblDescRolActivo');
    if (lblNom && rolObj) lblNom.textContent = rolObj.nombre || rolObj.Nombre || 'Rol Seleccionado';
    if (lblDesc && rolObj) lblDesc.textContent = `(${rolObj.descripcion || rolObj.Descripcion || 'Acceso configurado'})`;

    // Cargar permisos asignados al rol desde API: GET /api/permisos/rol/{rolId}
    try {
        const resp = await fetch(`/api/permisos/rol/${cacheRBAC.rolActivoId}`, {
            headers: getAuthHeaders()
        });
        cacheRBAC.permisosRolActivo = new Set();
        if (resp.ok) {
            const list = await resp.json();
            if (Array.isArray(list)) {
                list.forEach(p => {
                    const concedido = (p.concedido === true || p.Concedido === true || p.concedido === 1 || p.Concedido === 1);
                    if (concedido) {
                        const pId = Number(p.permisoId || p.PermisoId || p.id || p.Id);
                        if (pId) cacheRBAC.permisosRolActivo.add(pId);
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error al obtener permisos del rol:', e);
        cacheRBAC.permisosRolActivo = new Set();
    }

    renderMatrizPermisos();
}
window.seleccionarRolMatrizRBAC = seleccionarRolMatrizRBAC;

function renderMatrizPermisos() {
    const grid = document.getElementById('gridMatrizModulosPermisos');
    if (!grid) return;

    const listaModulos = cacheRBAC.modulosCat && cacheRBAC.modulosCat.length > 0 ? cacheRBAC.modulosCat : (cacheRBAC.modulos || []);

    if (!listaModulos || listaModulos.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748b; background: #ffffff; border-radius: 16px; border: 1.5px dashed #e2e8f0;">
                <i class="fa-solid fa-folder-open" style="font-size: 38px; margin-bottom: 12px; color: #94a3b8; display: block;"></i>
                <div style="font-size: 15px; font-weight: 700; color: #1e293b;">No hay módulos configurados</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Utiliza la pestaña de Catálogo de Módulos para crear uno nuevo.</div>
            </div>
        `;
        return;
    }

    const filtro = (cacheRBAC.filtroMatriz || '').toLowerCase().trim();
    let totalPermisosVisibles = 0;
    let totalPermisosAsignados = 0;

    let html = '';

    listaModulos.forEach(mod => {
        const modId = Number(mod.id || mod.Id || mod.moduloId || mod.ModuloId);
        const modCod = mod.codigo || mod.Codigo || '';
        const modNom = mod.nombre || mod.Nombre || '';
        const modIcon = mod.icono || mod.Icono || 'fa-cubes';
        
        // Obtener las acciones correspondientes a este módulo
        const accionesModulo = (cacheRBAC.permisos || []).filter(p => Number(p.moduloId || p.ModuloId) === modId);

        // Filtrado
        const accionesFiltradas = accionesModulo.filter(acc => {
            if (!filtro) return true;
            const cod = (acc.codigo || acc.Codigo || '').toLowerCase();
            const nom = (acc.nombre || acc.Nombre || '').toLowerCase();
            const tipo = (acc.accion || acc.Accion || '').toLowerCase();
            return cod.includes(filtro) || nom.includes(filtro) || tipo.includes(filtro) || modNom.toLowerCase().includes(filtro);
        });

        if (filtro && accionesFiltradas.length === 0 && !modNom.toLowerCase().includes(filtro) && !modCod.toLowerCase().includes(filtro)) {
            return; // No mostrar este módulo si no coincide el filtro
        }

        const accionesAMostrar = filtro ? accionesFiltradas : accionesModulo;
        let countAsignadosModulo = 0;

        accionesAMostrar.forEach(acc => {
            const pId = Number(acc.id || acc.Id || acc.permisoId || acc.PermisoId);
            totalPermisosVisibles++;
            if (cacheRBAC.permisosRolActivo.has(pId)) {
                countAsignadosModulo++;
                totalPermisosAsignados++;
            }
        });

        const todosDelModuloMarcados = accionesAMostrar.length > 0 && countAsignadosModulo === accionesAMostrar.length;
        const parcialModulo = countAsignadosModulo > 0 && !todosDelModuloMarcados;

        // Renderizar tarjeta del módulo profesional light
        html += `
            <div style="background: #ffffff; border-radius: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.03); overflow: hidden; display: flex; flex-direction: column; transition: transform 0.15s, box-shadow 0.15s;">
                <!-- Header Módulo -->
                <div style="padding: 14px 18px; background: #f8fafc; border-bottom: 1.5px solid #edf2f7; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #eff6ff, #dbeafe); color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid #bfdbfe; flex-shrink: 0;">
                            <i class="fa-solid ${modIcon}"></i>
                        </div>
                        <div>
                            <h4 style="font-size: 14.5px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">${modNom}</h4>
                            <span style="font-size: 11px; color: #64748b; font-family: monospace; font-weight: 700; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px;">${modCod}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; ${countAsignadosModulo === accionesAMostrar.length && accionesAMostrar.length > 0 ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;' : 'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;'}">
                            ${countAsignadosModulo} / ${accionesAMostrar.length}
                        </span>
                        <button type="button" onclick="toggleModuloCompletoRBAC(${modId})" title="Alternar todos los permisos de este módulo" 
                            style="padding: 5px 9px; font-size: 13px; border-radius: 8px; border: 1.5px solid ${todosDelModuloMarcados ? '#a7f3d0' : '#e2e8f0'}; background: ${todosDelModuloMarcados ? '#ecfdf5' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease;">
                            <i class="fa-solid ${todosDelModuloMarcados ? 'fa-square-check' : (parcialModulo ? 'fa-square-minus' : 'fa-square')}" style="color: ${todosDelModuloMarcados ? '#10b981' : (parcialModulo ? '#0284c7' : '#94a3b8')}"></i>
                        </button>
                    </div>
                </div>

                <!-- Lista de Acciones / Permisos -->
                <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1;">
                    ${accionesAMostrar.length === 0 ? '<div style="color: #94a3b8; font-size: 12.5px; font-style: italic; padding: 14px 0; text-align: center;">Sin acciones registradas para este módulo</div>' : ''}
                    ${accionesAMostrar.map(acc => {
                        const pId = Number(acc.id || acc.Id || acc.permisoId || acc.PermisoId);
                        const accTipo = (acc.accion || acc.Accion || 'VER').toUpperCase();
                        const accCod = acc.codigo || acc.Codigo || '';
                        const accNom = acc.nombre || acc.Nombre || accCod;
                        const isChecked = cacheRBAC.permisosRolActivo.has(pId);

                        // Color badge según tipo de acción
                        let badgeBg = '#eff6ff';
                        let badgeColor = '#1d4ed8';
                        let badgeBorder = '#bfdbfe';
                        if (accTipo === 'CREAR') { badgeBg = '#ecfdf5'; badgeColor = '#047857'; badgeBorder = '#a7f3d0'; }
                        else if (accTipo === 'EDITAR') { badgeBg = '#fffbeb'; badgeColor = '#b45309'; badgeBorder = '#fde68a'; }
                        else if (accTipo === 'ELIMINAR') { badgeBg = '#fef2f2'; badgeColor = '#b91c1c'; badgeBorder = '#fecaca'; }
                        else if (accTipo === 'APROBAR') { badgeBg = '#faf5ff'; badgeColor = '#7e22ce'; badgeBorder = '#e9d5ff'; }
                        else if (accTipo === 'EXPORTAR') { badgeBg = '#f0fdfa'; badgeColor = '#0f766e'; badgeBorder = '#99f6e4'; }

                        return `
                            <label style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 9px; background: ${isChecked ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${isChecked ? '#bbf7d0' : '#f1f5f9'}; cursor: pointer; transition: all 0.15s ease; box-shadow: ${isChecked ? '0 1px 3px rgba(16,185,129,0.05)' : 'none'};"
                                onmouseover="this.style.borderColor='#cbd5e1'; if(!${isChecked}) this.style.background='#f8fafc';"
                                onmouseout="this.style.borderColor='${isChecked ? '#bbf7d0' : '#f1f5f9'}'; if(!${isChecked}) this.style.background='#ffffff';">
                                <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; margin-right: 8px;">
                                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="togglePermisoRolRBAC(${pId}, this.checked)" style="width: 17px; height: 17px; accent-color: #10b981; cursor: pointer; flex-shrink: 0;">
                                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        <div style="font-size: 13px; font-weight: 700; color: ${isChecked ? '#065f46' : '#1e293b'}; overflow: hidden; text-overflow: ellipsis;">${accNom}</div>
                                        <div style="font-size: 11px; color: #64748b; font-family: monospace;">${accCod}</div>
                                    </div>
                                </div>
                                <span style="font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; flex-shrink: 0; letter-spacing: 0.03em;">
                                    ${accTipo}
                                </span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;

    // Actualizar contadores en barra superior y barra de progreso
    const badgeCount = document.getElementById('badgePermisosAsignadosCount');
    const badgePorc = document.getElementById('badgePorcentajePermisos');
    const pBar = document.getElementById('progressBarPermisosRol');
    const totalGlobal = (cacheRBAC.permisos || []).length;
    const asignadosGlobal = cacheRBAC.permisosRolActivo.size;
    const porc = totalGlobal > 0 ? Math.round((asignadosGlobal / totalGlobal) * 100) : 0;

    if (badgeCount) badgeCount.textContent = `${asignadosGlobal} / ${totalGlobal} Permisos Asignados`;
    if (badgePorc) {
        badgePorc.textContent = `${porc}%`;
        badgePorc.style.background = porc === 100 ? '#ecfdf5' : (porc > 0 ? '#eff6ff' : '#f1f5f9');
        badgePorc.style.color = porc === 100 ? '#047857' : (porc > 0 ? '#1d4ed8' : '#64748b');
        badgePorc.style.borderColor = porc === 100 ? '#a7f3d0' : (porc > 0 ? '#bfdbfe' : '#e2e8f0');
    }
    if (pBar) {
        pBar.style.width = `${porc}%`;
    }
}

function filtrarMatrizPermisos(query) {
    cacheRBAC.filtroMatriz = query;
    renderMatrizPermisos();
}
window.filtrarMatrizPermisos = filtrarMatrizPermisos;

function togglePermisoRolRBAC(permisoId, checkState) {
    permisoId = Number(permisoId);
    if (!permisoId) return;
    if (checkState) {
        cacheRBAC.permisosRolActivo.add(permisoId);
    } else {
        cacheRBAC.permisosRolActivo.delete(permisoId);
    }
    renderMatrizPermisos();
}
window.togglePermisoRolRBAC = togglePermisoRolRBAC;

function toggleModuloCompletoRBAC(moduloId) {
    moduloId = Number(moduloId);
    const mod = (cacheRBAC.modulosCat || cacheRBAC.modulos || []).find(m => Number(m.id || m.Id || m.moduloId || m.ModuloId) === moduloId);
    if (!mod) return;

    const acciones = (cacheRBAC.permisos || []).filter(p => Number(p.moduloId || p.ModuloId) === moduloId);
    const pIds = acciones.map(a => Number(a.id || a.Id || a.permisoId || a.PermisoId)).filter(Boolean);
    
    // Si todos están asignados, desmarcarlos; de lo contrario, marcarlos todos
    const todosAsignados = pIds.length > 0 && pIds.every(id => cacheRBAC.permisosRolActivo.has(id));
    if (todosAsignados) {
        pIds.forEach(id => cacheRBAC.permisosRolActivo.delete(id));
    } else {
        pIds.forEach(id => cacheRBAC.permisosRolActivo.add(id));
    }

    renderMatrizPermisos();
}
window.toggleModuloCompletoRBAC = toggleModuloCompletoRBAC;

function marcarTodosPermisosRol(tipo) {
    if (!cacheRBAC.rolActivoId) return;

    if (tipo === 'todos') {
        (cacheRBAC.permisos || []).forEach(p => {
            const pId = Number(p.id || p.Id || p.permisoId || p.PermisoId);
            if (pId) cacheRBAC.permisosRolActivo.add(pId);
        });
    } else if (tipo === 'ninguno') {
        cacheRBAC.permisosRolActivo.clear();
    } else if (tipo === 'ver') {
        cacheRBAC.permisosRolActivo.clear();
        (cacheRBAC.permisos || []).forEach(p => {
            const acc = (p.accion || p.Accion || '').toUpperCase();
            if (acc === 'VER') {
                const pId = Number(p.id || p.Id || p.permisoId || p.PermisoId);
                if (pId) cacheRBAC.permisosRolActivo.add(pId);
            }
        });
    }

    renderMatrizPermisos();
}
window.marcarTodosPermisosRol = marcarTodosPermisosRol;

async function guardarMatrizRolActual() {
    if (!cacheRBAC.rolActivoId) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'Atención', text: 'Selecciona un rol para guardar sus permisos.' });
        }
        return;
    }

    const btn = document.getElementById('btnGuardarMatrizRol');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    const payload = {
        rolId: Number(cacheRBAC.rolActivoId),
        permisosIds: Array.from(cacheRBAC.permisosRolActivo)
    };

    try {
        const resp = await fetch('/api/permisos/matriz/guardar-rol', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const res = await resp.json();
        if (resp.ok && (res.success || res.Success !== false)) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Permisos Guardados!',
                    text: `Se han configurado ${payload.permisosIds.length} permisos exitosamente para el rol seleccionado.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } else {
            const errMsg = res.message || res.Message || (res.errors ? Object.values(res.errors).flat().join(', ') : 'Error al guardar permisos.');
            throw new Error(errMsg);
        }
    } catch (e) {
        console.error('Error al guardar matriz de permisos:', e);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Error al Guardar', text: e.message });
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Permisos';
        }
    }
}
window.guardarMatrizRolActual = guardarMatrizRolActual;

// ==========================================
// GESTIÓN DE CATÁLOGO DE MÓDULOS
// ==========================================

async function cargarModulosCat() {
    try {
        const estadoFiltro = document.getElementById('filtroEstadoModulo')?.value || '';
        let url = '/api/permisos/modulos';
        if (estadoFiltro !== '') {
            url += `?soloActivos=${estadoFiltro === '1'}`;
        }
        const resp = await fetch(url, {
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            cacheRBAC.modulosCat = await resp.json();
            renderTablaModulosCat(cacheRBAC.modulosCat || []);
        }
    } catch (e) {
        console.error('Error al cargar catálogo de módulos:', e);
    }
}
window.cargarModulosCat = cargarModulosCat;

function filtrarModulosCat(query) {
    cacheRBAC.filtroModulos = (query || '').toLowerCase().trim();
    const filtrados = (cacheRBAC.modulosCat || []).filter(m => {
        const cod = (m.codigo || m.Codigo || '').toLowerCase();
        const nom = (m.nombre || m.Nombre || '').toLowerCase();
        return cod.includes(cacheRBAC.filtroModulos) || nom.includes(cacheRBAC.filtroModulos);
    });
    renderTablaModulosCat(filtrados);
}
window.filtrarModulosCat = filtrarModulosCat;

function renderTablaModulosCat(lista) {
    const tbody = document.getElementById('tbodyModulosCat');
    const badgeTotal = document.getElementById('badgeTotalModulosCat');
    if (!tbody) return;

    if (badgeTotal) badgeTotal.textContent = `${lista.length} Módulos`;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 30px; color: #64748b; font-weight: 600;">No se encontraron módulos con el criterio seleccionado.</td></tr>`;
        return;
    }

    let html = '';
    lista.forEach(m => {
        const mId = Number(m.id || m.Id || m.moduloId || m.ModuloId);
        const mCod = m.codigo || m.Codigo || '';
        const mNom = m.nombre || m.Nombre || '';
        const mIcon = m.icono || m.Icono || 'fa-cubes';
        const mOrd = m.orden !== undefined ? m.orden : (m.Orden !== undefined ? m.Orden : 0);
        const mAct = m.activo !== undefined ? m.activo : (m.Activo !== undefined ? m.Activo : true);
        const totalPerm = m.totalPermisos !== undefined ? m.totalPermisos : (m.TotalPermisos !== undefined ? m.TotalPermisos : 0);

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="font-weight: 800; color: #64748b; padding: 12px 14px;">#${mId}</td>
                <td style="padding: 12px 14px;"><span style="font-family: monospace; font-weight: 800; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px;">${mCod}</span></td>
                <td style="font-weight: 800; color: #0f172a; padding: 12px 14px;">${mNom}</td>
                <td style="text-align: center; padding: 12px 14px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; display: inline-flex; align-items: center; justify-content: center; color: #2563eb; font-size: 14px;">
                        <i class="fa-solid ${mIcon}"></i>
                    </div>
                </td>
                <td style="text-align: center; font-weight: 700; color: #334155; padding: 12px 14px;">${mOrd}</td>
                <td style="text-align: center; padding: 12px 14px;">
                    <span style="font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 6px; ${totalPerm > 0 ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;' : 'background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;'}">
                        ${totalPerm} Acciones
                    </span>
                </td>
                <td style="text-align: center; padding: 12px 14px;">
                    <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; ${mAct ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;' : 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'}">
                        ${mAct ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td style="text-align: center; padding: 12px 14px;">
                    <div style="display: inline-flex; gap: 6px;">
                        <button type="button" onclick="abrirModalEditarModulo(${mId})" title="Editar Módulo" 
                            style="padding: 5px 9px; font-size: 12px; border-radius: 6px; border: 1px solid #bfdbfe; background: #eff6ff; color: #2563eb; cursor: pointer; transition: all 0.15s ease;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" onclick="eliminarModuloRBAC(${mId}, '${mNom}')" title="Eliminar Módulo" 
                            style="padding: 5px 9px; font-size: 12px; border-radius: 6px; border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; cursor: pointer; transition: all 0.15s ease;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function abrirModalCustom(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.display = 'flex';
        m.style.alignItems = 'center';
        m.style.justifyContent = 'center';
    }
}
window.abrirModalCustom = abrirModalCustom;

function cerrarModalCustom(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
}
window.cerrarModalCustom = cerrarModalCustom;

function abrirModalCrearModulo() {
    document.getElementById('modalModuloTitle').textContent = 'Registrar Nuevo Módulo';
    document.getElementById('modalModuloId').value = '';
    document.getElementById('modalModuloCodigo').value = '';
    document.getElementById('modalModuloCodigo').disabled = false;
    document.getElementById('modalModuloNombre').value = '';
    document.getElementById('modalModuloIcono').value = 'fa-cubes';
    actualizarPreviewIconoModulo('fa-cubes');
    document.getElementById('modalModuloOrden').value = ((cacheRBAC.modulosCat || []).length + 1) * 10;
    document.getElementById('modalModuloActivo').checked = true;

    abrirModalCustom('modalModuloCustom');
}
window.abrirModalCrearModulo = abrirModalCrearModulo;

function abrirModalEditarModulo(id) {
    const mod = (cacheRBAC.modulosCat || cacheRBAC.modulos || []).find(m => Number(m.id || m.Id || m.moduloId || m.ModuloId) === Number(id));
    if (!mod) return;

    document.getElementById('modalModuloTitle').textContent = 'Editar Módulo';
    document.getElementById('modalModuloId').value = mod.id || mod.Id || mod.moduloId || mod.ModuloId;
    document.getElementById('modalModuloCodigo').value = mod.codigo || mod.Codigo || '';
    document.getElementById('modalModuloCodigo').disabled = true; // El código no debe alterarse
    document.getElementById('modalModuloNombre').value = mod.nombre || mod.Nombre || '';
    const icono = mod.icono || mod.Icono || 'fa-cubes';
    document.getElementById('modalModuloIcono').value = icono;
    actualizarPreviewIconoModulo(icono);
    document.getElementById('modalModuloOrden').value = mod.orden !== undefined ? mod.orden : (mod.Orden !== undefined ? mod.Orden : 10);
    document.getElementById('modalModuloActivo').checked = mod.activo !== undefined ? mod.activo : (mod.Activo !== undefined ? mod.Activo : true);

    abrirModalCustom('modalModuloCustom');
}
window.abrirModalEditarModulo = abrirModalEditarModulo;

function actualizarPreviewIconoModulo(icono) {
    const preview = document.getElementById('previewIconoModulo');
    if (!preview) return;
    const cleanIcon = (icono || 'fa-cubes').trim();
    preview.innerHTML = `<i class="fa-solid ${cleanIcon}"></i>`;
}
window.actualizarPreviewIconoModulo = actualizarPreviewIconoModulo;

async function guardarModuloSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('modalModuloId').value;
    const payload = {
        codigo: document.getElementById('modalModuloCodigo').value.trim().toUpperCase(),
        nombre: document.getElementById('modalModuloNombre').value.trim(),
        icono: document.getElementById('modalModuloIcono').value.trim() || 'fa-cubes',
        orden: parseInt(document.getElementById('modalModuloOrden').value) || 0,
        activo: document.getElementById('modalModuloActivo').checked
    };

    if (!payload.codigo || !payload.nombre) {
        if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'Campos Requeridos', text: 'Código y Nombre son obligatorios.' });
        return;
    }

    try {
        const isEdit = !!id;
        const url = isEdit ? `/api/permisos/modulos/${id}` : '/api/permisos/modulos';
        const method = isEdit ? 'PUT' : 'POST';

        const resp = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const res = await resp.json();
        if (resp.ok && (res.success || res.Success !== false)) {
            cerrarModalCustom('modalModuloCustom');
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: isEdit ? 'Módulo Actualizado' : 'Módulo Creado',
                    text: res.message || res.Message || 'Operación realizada exitosamente.',
                    timer: 1800,
                    showConfirmButton: false
                });
            }
            await cargarModuloPermisos();
        } else {
            const errMsg = res.message || res.Message || (res.errors ? Object.values(res.errors).flat().join(', ') : 'Error al procesar el módulo.');
            throw new Error(errMsg);
        }
    } catch (err) {
        console.error('Error al guardar módulo:', err);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}
window.guardarModuloSubmit = guardarModuloSubmit;

async function eliminarModuloRBAC(id, nombre) {
    if (typeof Swal === 'undefined') return;

    const result = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar Módulo?',
        text: `¿Estás seguro de eliminar el módulo "${nombre}"? Se verificarán dependencias antes de proceder.`,
        showCancelButton: true,
        confirmButtonText: 'Sí, Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e11d48'
    });

    if (result.isConfirmed) {
        try {
            const resp = await fetch(`/api/permisos/modulos/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const res = await resp.json();
            if (resp.ok && (res.success || res.Success !== false)) {
                Swal.fire({ icon: 'success', title: 'Eliminado', text: res.message || 'Módulo eliminado correctamente.', timer: 1800, showConfirmButton: false });
                await cargarModuloPermisos();
            } else {
                throw new Error(res.message || res.Message || 'No se pudo eliminar el módulo.');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'No se puede eliminar', text: err.message });
        }
    }
}
window.eliminarModuloRBAC = eliminarModuloRBAC;

// ==========================================
// GESTIÓN DE ACCIONES Y PERMISOS ATÓMICOS
// ==========================================

function poblarSelectoresModulosRBAC() {
    const selModal = document.getElementById('modalPermisoModuloId');
    const selFiltro = document.getElementById('filtroModuloPermisosCat');

    const modulos = cacheRBAC.modulosCat && cacheRBAC.modulosCat.length > 0 ? cacheRBAC.modulosCat : (cacheRBAC.modulos || []);

    if (selModal) {
        const valActual = selModal.value;
        selModal.innerHTML = '<option value="">-- Seleccionar Módulo --</option>' +
            modulos.map(m => {
                const id = m.id || m.Id || m.moduloId || m.ModuloId;
                const nom = m.nombre || m.Nombre;
                const cod = m.codigo || m.Codigo;
                return `<option value="${id}">${nom} (${cod})</option>`;
            }).join('');
        if (valActual) selModal.value = valActual;
    }

    if (selFiltro) {
        const valActual = selFiltro.value;
        selFiltro.innerHTML = '<option value="">Todos los Módulos</option>' +
            modulos.map(m => {
                const id = m.id || m.Id || m.moduloId || m.ModuloId;
                const nom = m.nombre || m.Nombre;
                return `<option value="${id}">${nom}</option>`;
            }).join('');
        if (valActual) selFiltro.value = valActual;
    }
}

async function cargarPermisosCat() {
    try {
        const modId = document.getElementById('filtroModuloPermisosCat')?.value || '';
        const tipoAcc = document.getElementById('filtroTipoAccionPermisosCat')?.value || '';

        let params = [];
        if (modId) params.push(`moduloId=${modId}`);
        if (tipoAcc) params.push(`accion=${encodeURIComponent(tipoAcc)}`);

        const qs = params.length > 0 ? `?${params.join('&')}` : '';
        const resp = await fetch(`/api/permisos${qs}`, {
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            cacheRBAC.permisos = await resp.json();
            renderTablaPermisosCat(cacheRBAC.permisos || []);
        }
    } catch (e) {
        console.error('Error al cargar catálogo de permisos:', e);
    }
}
window.cargarPermisosCat = cargarPermisosCat;

function filtrarPermisosCat(query) {
    cacheRBAC.filtroPermisos = (query || '').toLowerCase().trim();
    const filtrados = (cacheRBAC.permisos || []).filter(p => {
        const cod = (p.codigo || p.Codigo || '').toLowerCase();
        const nom = (p.nombre || p.Nombre || '').toLowerCase();
        const desc = (p.descripcion || p.Descripcion || '').toLowerCase();
        const mod = (p.moduloNombre || p.ModuloNombre || '').toLowerCase();
        return cod.includes(cacheRBAC.filtroPermisos) || nom.includes(cacheRBAC.filtroPermisos) || desc.includes(cacheRBAC.filtroPermisos) || mod.includes(cacheRBAC.filtroPermisos);
    });
    renderTablaPermisosCat(filtrados);
}
window.filtrarPermisosCat = filtrarPermisosCat;

function renderTablaPermisosCat(lista) {
    const tbody = document.getElementById('tbodyPermisosCat');
    const badgeTotal = document.getElementById('badgeTotalPermisosCat');
    if (!tbody) return;

    if (badgeTotal) badgeTotal.textContent = `${lista.length} Acciones`;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 30px; color: #64748b; font-weight: 600;">No se encontraron acciones o permisos con el criterio seleccionado.</td></tr>`;
        return;
    }

    let html = '';
    lista.forEach(p => {
        const pId = Number(p.id || p.Id || p.permisoId || p.PermisoId);
        const pMod = p.moduloNombre || p.ModuloNombre || 'Sin Módulo';
        const pCod = p.codigo || p.Codigo || '';
        const pAcc = (p.accion || p.Accion || 'VER').toUpperCase();
        const pNom = p.nombre || p.Nombre || '';
        const pDesc = p.descripcion || p.Descripcion || '-';
        const pRoles = p.totalRolesAsignados !== undefined ? p.totalRolesAsignados : (p.TotalRolesAsignados !== undefined ? p.TotalRolesAsignados : 0);
        const pAct = p.activo !== undefined ? p.activo : (p.Activo !== undefined ? p.Activo : true);

        // Badge color por acción
        let badgeBg = '#eff6ff';
        let badgeColor = '#1d4ed8';
        let badgeBorder = '#bfdbfe';
        if (pAcc === 'CREAR') { badgeBg = '#ecfdf5'; badgeColor = '#047857'; badgeBorder = '#a7f3d0'; }
        else if (pAcc === 'EDITAR') { badgeBg = '#fffbeb'; badgeColor = '#b45309'; badgeBorder = '#fde68a'; }
        else if (pAcc === 'ELIMINAR') { badgeBg = '#fef2f2'; badgeColor = '#b91c1c'; badgeBorder = '#fecaca'; }
        else if (pAcc === 'APROBAR') { badgeBg = '#faf5ff'; badgeColor = '#7e22ce'; badgeBorder = '#e9d5ff'; }
        else if (pAcc === 'EXPORTAR') { badgeBg = '#f0fdfa'; badgeColor = '#0f766e'; badgeBorder = '#99f6e4'; }

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="font-weight: 800; color: #64748b; padding: 12px 14px;">#${pId}</td>
                <td style="font-weight: 800; color: #334155; padding: 12px 14px;">${pMod}</td>
                <td style="padding: 12px 14px;"><span style="font-family: monospace; font-weight: 800; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px;">${pCod}</span></td>
                <td style="text-align: center; padding: 12px 14px;">
                    <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                        ${pAcc}
                    </span>
                </td>
                <td style="font-weight: 800; color: #0f172a; padding: 12px 14px;">${pNom}</td>
                <td style="font-size: 12.5px; color: #64748b; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 12px 14px;" title="${pDesc}">${pDesc}</td>
                <td style="text-align: center; padding: 12px 14px;">
                    <span style="font-size: 11.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px; ${pRoles > 0 ? 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;' : 'background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;'}">
                        ${pRoles} Roles
                    </span>
                </td>
                <td style="text-align: center; padding: 12px 14px;">
                    <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; ${pAct ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;' : 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'}">
                        ${pAct ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td style="text-align: center; padding: 12px 14px;">
                    <div style="display: inline-flex; gap: 6px;">
                        <button type="button" onclick="abrirModalEditarPermiso(${pId})" title="Editar Permiso" 
                            style="padding: 5px 9px; font-size: 12px; border-radius: 6px; border: 1px solid #bfdbfe; background: #eff6ff; color: #2563eb; cursor: pointer; transition: all 0.15s ease;">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" onclick="eliminarPermisoRBAC(${pId}, '${pNom}')" title="Eliminar Permiso" 
                            style="padding: 5px 9px; font-size: 12px; border-radius: 6px; border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; cursor: pointer; transition: all 0.15s ease;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function sugerirCodigoPermiso() {
    const isEdit = !!document.getElementById('modalPermisoId').value;
    if (isEdit) return; // No auto-cambiar en edición

    const modId = document.getElementById('modalPermisoModuloId').value;
    const accion = document.getElementById('modalPermisoAccion').value;
    const modObj = (cacheRBAC.modulosCat || cacheRBAC.modulos || []).find(m => Number(m.id || m.Id || m.moduloId || m.ModuloId) === Number(modId));
    
    if (modObj && accion) {
        const modCod = (modObj.codigo || modObj.Codigo || '').toUpperCase();
        const inputCod = document.getElementById('modalPermisoCodigo');
        const inputNom = document.getElementById('modalPermisoNombre');
        
        if (inputCod) inputCod.value = `${modCod}_${accion}`;
        
        // Sugerir nombre legible
        let verbo = 'Ver';
        if (accion === 'CREAR') verbo = 'Crear / Registrar';
        else if (accion === 'EDITAR') verbo = 'Editar / Modificar';
        else if (accion === 'ELIMINAR') verbo = 'Eliminar / Anular';
        else if (accion === 'APROBAR') verbo = 'Aprobar / Cerrar';
        else if (accion === 'EXPORTAR') verbo = 'Exportar Reportes de';

        if (inputNom && (!inputNom.value || inputNom.dataset.autoSugerido === 'true')) {
            inputNom.value = `${verbo} ${modObj.nombre || modObj.Nombre}`;
            inputNom.dataset.autoSugerido = 'true';
        }
    }
}
window.sugerirCodigoPermiso = sugerirCodigoPermiso;

function abrirModalCrearPermiso() {
    poblarSelectoresModulosRBAC();
    document.getElementById('modalPermisoTitle').textContent = 'Registrar Nueva Acción / Permiso';
    document.getElementById('modalPermisoId').value = '';
    document.getElementById('modalPermisoModuloId').value = '';
    document.getElementById('modalPermisoAccion').value = 'VER';
    document.getElementById('modalPermisoCodigo').value = '';
    document.getElementById('modalPermisoCodigo').disabled = false;
    document.getElementById('modalPermisoNombre').value = '';
    document.getElementById('modalPermisoDescripcion').value = '';
    document.getElementById('modalPermisoActivo').checked = true;

    abrirModalCustom('modalPermisoCustom');
}
window.abrirModalCrearPermiso = abrirModalCrearPermiso;

function abrirModalEditarPermiso(id) {
    poblarSelectoresModulosRBAC();
    const perm = (cacheRBAC.permisos || []).find(p => Number(p.id || p.Id || p.permisoId || p.PermisoId) === Number(id));
    if (!perm) return;

    document.getElementById('modalPermisoTitle').textContent = 'Editar Acción / Permiso';
    document.getElementById('modalPermisoId').value = perm.id || perm.Id || perm.permisoId || perm.PermisoId;
    document.getElementById('modalPermisoModuloId').value = perm.moduloId || perm.ModuloId;
    document.getElementById('modalPermisoAccion').value = perm.accion || perm.Accion || 'VER';
    document.getElementById('modalPermisoCodigo').value = perm.codigo || perm.Codigo || '';
    document.getElementById('modalPermisoCodigo').disabled = true;
    document.getElementById('modalPermisoNombre').value = perm.nombre || perm.Nombre || '';
    document.getElementById('modalPermisoDescripcion').value = perm.descripcion || perm.Descripcion || '';
    document.getElementById('modalPermisoActivo').checked = perm.activo !== undefined ? perm.activo : (perm.Activo !== undefined ? perm.Activo : true);

    abrirModalCustom('modalPermisoCustom');
}
window.abrirModalEditarPermiso = abrirModalEditarPermiso;

async function guardarPermisoSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('modalPermisoId').value;
    const payload = {
        moduloId: parseInt(document.getElementById('modalPermisoModuloId').value),
        codigo: document.getElementById('modalPermisoCodigo').value.trim().toUpperCase(),
        nombre: document.getElementById('modalPermisoNombre').value.trim(),
        accion: document.getElementById('modalPermisoAccion').value.trim().toUpperCase(),
        descripcion: document.getElementById('modalPermisoDescripcion').value.trim(),
        activo: document.getElementById('modalPermisoActivo').checked
    };

    if (!payload.moduloId || !payload.codigo || !payload.nombre || !payload.accion) {
        if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'Campos Requeridos', text: 'Módulo, Código, Nombre y Acción son obligatorios.' });
        return;
    }

    try {
        const isEdit = !!id;
        const url = isEdit ? `/api/permisos/${id}` : '/api/permisos';
        const method = isEdit ? 'PUT' : 'POST';

        const resp = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const res = await resp.json();
        if (resp.ok && (res.success || res.Success !== false)) {
            cerrarModalCustom('modalPermisoCustom');
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: isEdit ? 'Permiso Actualizado' : 'Permiso Creado',
                    text: res.message || res.Message || 'Operación realizada exitosamente.',
                    timer: 1800,
                    showConfirmButton: false
                });
            }
            await cargarModuloPermisos();
        } else {
            const errMsg = res.message || res.Message || (res.errors ? Object.values(res.errors).flat().join(', ') : 'Error al procesar el permiso.');
            throw new Error(errMsg);
        }
    } catch (err) {
        console.error('Error al guardar permiso:', err);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}
window.guardarPermisoSubmit = guardarPermisoSubmit;

async function eliminarPermisoRBAC(id, nombre) {
    if (typeof Swal === 'undefined') return;

    const result = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar Acción / Permiso?',
        text: `¿Estás seguro de eliminar el permiso "${nombre}"?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e11d48'
    });

    if (result.isConfirmed) {
        try {
            const resp = await fetch(`/api/permisos/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const res = await resp.json();
            if (resp.ok && (res.success || res.Success !== false)) {
                Swal.fire({ icon: 'success', title: 'Eliminado', text: res.message || 'Permiso eliminado correctamente.', timer: 1800, showConfirmButton: false });
                await cargarModuloPermisos();
            } else {
                throw new Error(res.message || res.Message || 'No se pudo eliminar el permiso.');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'No se puede eliminar', text: err.message });
        }
    }
}
window.eliminarPermisoRBAC = eliminarPermisoRBAC;
