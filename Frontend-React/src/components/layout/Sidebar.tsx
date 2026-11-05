import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavSubItem {
  name: string;
  href: string;
  tabId: string;
  icon: string;
  color?: string;
}

interface NavGroupDef {
  id: string;
  title: string;
  iconClass: string;
  groupIconClass: string;
  items: NavSubItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { canAccessTab } = useAuthStore();

  const groups: NavGroupDef[] = [
    {
      id: 'grp-operaciones',
      title: 'Operaciones',
      iconClass: 'fa-solid fa-bolt-lightning',
      groupIconClass: 'icon-op',
      items: [
        { name: 'Principal', href: '/dashboard', tabId: 'dashboard', icon: 'fa-solid fa-chart-pie' },
        { name: 'Recolección en Ruta', href: '/rutas', tabId: 'rutas', icon: 'fa-solid fa-route' },
        { name: 'Entregas Receptoría', href: '/receptoria', tabId: 'receptoria', icon: 'fa-solid fa-truck-ramp-box' },
        { name: 'Balance Silos (Receptoría)', href: '/balance', tabId: 'balance', icon: 'fa-solid fa-chart-line' },
        { name: 'Control de Viajes / Tickets', href: '/viajes', tabId: 'control-rutas', icon: 'fa-solid fa-clipboard-check' },
        { name: 'Formulario Silos-01', href: '/control-tanques', tabId: 'control-tanques', icon: 'fa-solid fa-clipboard-list', color: '#6366f1' },
        { name: 'Trazabilidad Búfala', href: '/bufala', tabId: 'bufala', icon: 'fa-solid fa-gem', color: '#0d9488' },
        { name: 'Evolución Fincas & Flota', href: '/evolucion-fincas', tabId: 'evolucion-fincas', icon: 'fa-solid fa-arrow-trend-up', color: '#10b981' },
        { name: 'Planificación de Rutas', href: '/planificacion-rutas', tabId: 'rutas-planificacion', icon: 'fa-solid fa-map-location-dot', color: '#3b82f6' },
      ],
    },
    {
      id: 'grp-catalogos',
      title: 'Catálogos & Flota',
      iconClass: 'fa-solid fa-folder-tree',
      groupIconClass: 'icon-cat',
      items: [
        { name: 'Fincas', href: '/fincas', tabId: 'fincas', icon: 'fa-solid fa-seedling' },
        { name: 'Propietarios', href: '/propietarios', tabId: 'propietarios', icon: 'fa-solid fa-users' },
        { name: 'Conductores', href: '/conductores', tabId: 'conductores', icon: 'fa-solid fa-id-card' },
        { name: 'Camiones (Flota)', href: '/camiones', tabId: 'camiones', icon: 'fa-solid fa-truck-front' },
        { name: 'Compañías', href: '/companias', tabId: 'companias', icon: 'fa-solid fa-building' },
        { name: 'Bancos', href: '/bancos', tabId: 'bancos', icon: 'fa-solid fa-building-columns' },
        { name: 'Datos de Empresa', href: '/empresa', tabId: 'empresa', icon: 'fa-solid fa-building-flag', color: '#38bdf8' },
      ],
    },
    {
      id: 'grp-flota',
      title: 'Flota & Mantenimiento',
      iconClass: 'fa-solid fa-screwdriver-wrench',
      groupIconClass: 'icon-op',
      items: [
        { name: 'Gestión de Combustible', href: '/combustible', tabId: 'combustible', icon: 'fa-solid fa-gas-pump', color: '#ef4444' },
        { name: 'Historial & Mantenimiento', href: '/mantenimiento', tabId: 'historial-camiones', icon: 'fa-solid fa-wrench', color: '#f59e0b' },
        { name: 'Inventario de Repuestos', href: '/repuestos', tabId: 'repuestos', icon: 'fa-solid fa-boxes-stacked', color: '#10b981' },
      ],
    },
    {
      id: 'grp-finanzas',
      title: 'Liquidación',
      iconClass: 'fa-solid fa-calculator',
      groupIconClass: 'icon-fin',
      items: [
        { name: 'Semanas Operativas', href: '/semanas', tabId: 'semanas', icon: 'fa-regular fa-calendar-check' },
        { name: 'Liquidación Fincas', href: '/liquidaciones', tabId: 'liquidacion', icon: 'fa-solid fa-file-invoice-dollar' },
        { name: 'Pagos Choferes & Personal', href: '/pagos-personal', tabId: 'pagos-usuarios', icon: 'fa-solid fa-money-check-dollar', color: '#38bdf8' },
        { name: 'Historial de Pagos', href: '/historial-pagos', tabId: 'historial-pagos', icon: 'fa-solid fa-receipt', color: '#6366f1' },
        { name: 'Administración General', href: '/administracion', tabId: 'administracion', icon: 'fa-solid fa-scale-balanced', color: '#10b981' },
      ],
    },
    {
      id: 'grp-adelantos',
      title: 'Adelantos',
      iconClass: 'fa-solid fa-hand-holding-dollar',
      groupIconClass: 'icon-ade',
      items: [
        { name: 'Adelantos a Fincas', href: '/adelantos-fincas', tabId: 'adelantos-fincas', icon: 'fa-solid fa-leaf' },
        { name: 'Adelantos Personal & Chofer', href: '/adelantos-personal', tabId: 'adelantos-usuarios', icon: 'fa-solid fa-hand-holding-dollar', color: '#fbbf24' },
        { name: 'Abonos a Compañías', href: '/abonos-companias', tabId: 'abonos-companias', icon: 'fa-solid fa-building' },
        { name: 'Adelantos Receptoría', href: '/adelantos-receptoria', tabId: 'adelantos-receptoria', icon: 'fa-solid fa-truck-droplet', color: '#2563eb' },
        { name: 'Abonos & Amortizaciones', href: '/abonos-amortizaciones', tabId: 'abonos', icon: 'fa-solid fa-coins', color: '#f59e0b' },
        { name: 'Historial de Adelantos', href: '/historial-adelantos', tabId: 'historial-adelantos', icon: 'fa-solid fa-clock-rotate-left', color: '#0d9488' },
      ],
    },
    {
      id: 'grp-reportes',
      title: 'Reportes',
      iconClass: 'fa-solid fa-chart-line',
      groupIconClass: 'icon-rep',
      items: [
        { name: 'Reportes Generales', href: '/reportes', tabId: 'reportes', icon: 'fa-solid fa-square-poll-vertical' },
        { name: 'Historial Tasas BCV', href: '/historial-bcv', tabId: 'historial-bcv', icon: 'fa-solid fa-coins' },
      ],
    },
    {
      id: 'grp-sistema',
      title: 'Sistema',
      iconClass: 'fa-solid fa-gears',
      groupIconClass: 'icon-sis',
      items: [
        { name: 'Usuarios & Roles', href: '/usuarios', tabId: 'usuarios', icon: 'fa-solid fa-user-gear' },
        { name: 'Módulos & Permisos', href: '/permisos', tabId: 'permisos', icon: 'fa-solid fa-shield-halved', color: '#38bdf8' },
        { name: 'Parametrización Global', href: '/configuracion', tabId: 'configuracion-sistema', icon: 'fa-solid fa-sliders', color: '#a855f7' },
        { name: 'Gestión de Data (Excel)', href: '/gestion-data', tabId: 'gestion-data', icon: 'fa-solid fa-file-excel', color: '#10b981' },
        { name: 'Tiempo de Sesión', href: '/tiempo-sesion', tabId: 'configuracion-sesion', icon: 'fa-solid fa-stopwatch', color: '#f43f5e' },
      ],
    },
  ];

  // Identificar qué grupo tiene la ruta actual activa
  const isGroupActive = (grp: NavGroupDef) => {
    return grp.items.some(it => location.pathname === it.href);
  };

  // Estado para contraer/achicar menú lateral
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1280;
    }
    return false;
  });

  // Estado para colapsar manualmente con clic en vista normal
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <aside
      className={`sidebar ${isOpen ? 'mobile-open' : ''} ${isSidebarCollapsed ? 'is-collapsed' : 'hover-accordion-sidebar'}`}
      id="mainSidebar"
      style={{
        width: isSidebarCollapsed ? '68px' : '230px',
        minWidth: isSidebarCollapsed ? '68px' : '230px',
        maxWidth: isSidebarCollapsed ? '68px' : '230px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease',
      }}
    >
      {/* Botón para achicar/expandir menú lateral */}
      <div style={{ display: 'flex', justifyContent: isSidebarCollapsed ? 'center' : 'flex-end', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? 'Expandir menú lateral' : 'Achicar menú lateral'}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8',
            borderRadius: '6px',
            padding: isSidebarCollapsed ? '6px' : '4px 8px',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <i className={`fa-solid ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          {!isSidebarCollapsed && <span style={{ fontSize: '10.5px', fontWeight: 600 }}>Achicar</span>}
        </button>
      </div>

      <nav className="sidebar-nav">
        {isSidebarCollapsed ? (
          /* MODO ACHICADO (68px): Se muestran ÚNICAMENTE las categorías ("OPERACIONES", "CATÁLOGOS", "FLOTA", etc.) */
          <div className="flex flex-col items-center py-2 space-y-2">
            {groups.map((grp) => {
              const visibleItems = grp.items.filter(item => canAccessTab(item.tabId));
              if (visibleItems.length === 0) return null;

              const active = isGroupActive(grp);
              // Primer item accesible para navegación directa
              const firstItem = visibleItems[0];

              // Nombre corto para visualización compacta
              const shortName = grp.title
                .replace('& Flota', '')
                .replace('& Mantenimiento', '')
                .replace('& Pagos', '')
                .trim()
                .toUpperCase();

              return (
                <NavLink
                  key={grp.id}
                  to={firstItem?.href || '#'}
                  onClick={() => {
                    if (isOpen) onClose();
                  }}
                  title={`${grp.title} (Clic para abrir ${firstItem?.name})`}
                  className={`w-14 py-2 px-1 my-0.5 flex flex-col items-center justify-center rounded-xl transition-all duration-150 ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  style={{ textDecoration: 'none' }}
                >
                  <i className={`${grp.iconClass} text-[17px] mb-1`} style={active ? { color: '#ffffff' } : undefined}></i>
                  <span
                    style={{
                      fontSize: '8px',
                      fontWeight: 800,
                      lineHeight: '10px',
                      textAlign: 'center',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '56px',
                    }}
                  >
                    {shortName}
                  </span>
                </NavLink>
              );
            })}
          </div>
        ) : (
          /* MODO EXPANDIDO: Acordeón normal interactivo */
          groups.map((grp) => {
            const visibleItems = grp.items.filter(item => canAccessTab(item.tabId));
            if (visibleItems.length === 0) return null;

            const groupActive = isGroupActive(grp);
            const isGroupCollapsed = collapsedGroups[grp.id] === true;
            const groupClasses = [
              'nav-accordion-group',
              groupActive ? 'has-active' : '',
              isGroupCollapsed ? 'collapsed' : (groupActive ? 'open' : ''),
            ].filter(Boolean).join(' ');

            return (
              <div key={grp.id} className={groupClasses} id={grp.id}>
                <div className="nav-accordion-header" onClick={() => toggleGroup(grp.id)}>
                  <div className="header-main">
                    <i className={`${grp.iconClass} group-icon ${grp.groupIconClass}`}></i>
                    <span className="group-title">{grp.title}</span>
                  </div>
                  <i className="fa-solid fa-chevron-right group-chevron"></i>
                </div>
                <div className="nav-accordion-body">
                  <div className="accordion-subitems">
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => {
                          if (isOpen) onClose();
                        }}
                        title={item.name}
                        className={({ isActive }) =>
                          isActive ? 'nav-item active' : 'nav-item'
                        }
                      >
                        <i className={item.icon} style={item.color ? { color: item.color } : undefined}></i>
                        <span>{item.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="connection-status">
          <span className="status-dot online"></span>
          {!isSidebarCollapsed && <span>Sistema Conectado</span>}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
