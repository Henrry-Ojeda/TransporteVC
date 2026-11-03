import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Superior Fijo */}
      <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      {/* Backdrop Móvil */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop active"
          id="sidebarBackdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenedor Principal: Sidebar + Main Content */}
      <div
        className="main-layout"
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: 'calc(100vh - 65px)',
          overflow: 'hidden',
        }}
      >
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main
          className="content-area main-content"
          id="mainContainer"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            padding: '24px 32px',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
