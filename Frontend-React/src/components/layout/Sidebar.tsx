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
        { name: 'Análisis & Balance Leche', href: '/balance', tabId: 'balance', icon: 'fa-solid fa-chart-line' },
        { name: 'Control de Viajes / Tickets', href: '/viajes', tabId: 'control-rutas', icon: 'fa-solid fa-clipboard-check' },
        { name: 'Trazabilidad Búfala', href: '/bufala', tabId: 'bufala', icon: 'fa-solid fa-gem', color: '#0d9488' },
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
      ],
    },
  ];

  // Identificar qué grupo tiene la ruta actual activa
  const isGroupActive = (grp: NavGroupDef) => {
    return grp.items.some(it => location.pathname === it.href);
  };

  // Estado para colapsar manualmente con clic
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <aside
      className={`sidebar hover-accordion-sidebar ${isOpen ? 'mobile-open' : ''}`}
      id="mainSidebar"
      style={{
        width: '260px',
        minWidth: '260px',
        maxWidth: '260px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <nav className="sidebar-nav">
        {groups.map((grp) => {
          const visibleItems = grp.items.filter(item => canAccessTab(item.tabId));
          if (visibleItems.length === 0) return null;

          const groupActive = isGroupActive(grp);
          const isCollapsed = collapsedGroups[grp.id] === true;
          const groupClasses = [
            'nav-accordion-group',
            groupActive ? 'has-active' : '',
            isCollapsed ? 'collapsed' : (groupActive ? 'open' : ''),
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
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="connection-status">
          <span className="status-dot online"></span>
          <span>Sistema Conectado</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
