import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { LoginPage } from '@/modules/auth/LoginPage';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';

// Dashboard
import { DashboardPage } from '@/modules/dashboard/DashboardPage';

// Operaciones
import { RutasLogisticaPage } from '@/modules/operaciones/RutasLogisticaPage';
import { RecoleccionRutasPage } from '@/modules/operaciones/RecoleccionRutasPage';
import { ViajesTicketsPage } from '@/modules/operaciones/ViajesTicketsPage';
import { ReceptoriaPage } from '@/modules/operaciones/ReceptoriaPage';
import { BalanceLechePage } from '@/modules/operaciones/BalanceLechePage';
import { PlanificacionRutasPage } from '@/modules/operaciones/PlanificacionRutasPage';
import { BufalaPage } from '@/modules/operaciones/BufalaPage';

// Catálogos
import { FincasPage } from '@/modules/catalogos/FincasPage';
import { PropietariosPage } from '@/modules/catalogos/PropietariosPage';
import { ConductoresPage } from '@/modules/catalogos/ConductoresPage';
import { CamionesPage } from '@/modules/catalogos/CamionesPage';
import { CompaniasPage } from '@/modules/catalogos/CompaniasPage';
import { BancosPage } from '@/modules/catalogos/BancosPage';
import { EmpresaPage } from '@/modules/catalogos/EmpresaPage';

// Flota & Mantenimiento
import { CombustiblePage } from '@/modules/combustible/CombustiblePage';
import { MantenimientoPage } from '@/modules/mantenimiento/MantenimientoPage';
import { RepuestosPage } from '@/modules/repuestos/RepuestosPage';

// Liquidación & Finanzas
import { SemanasPage } from '@/modules/finanzas/SemanasPage';
import { LiquidacionesPage } from '@/modules/finanzas/LiquidacionesPage';
import { PagosPersonalPage } from '@/modules/finanzas/PagosPersonalPage';

// Adelantos
import { AdelantosFincasPage } from '@/modules/finanzas/AdelantosFincasPage';
import { AdelantosPersonalPage } from '@/modules/finanzas/AdelantosPersonalPage';
import { AbonosCompaniasPage } from '@/modules/finanzas/AbonosCompaniasPage';

// Sistema & Reportes
import { ReportesPage } from '@/modules/sistema/ReportesPage';
import { HistorialBcvPage } from '@/modules/sistema/HistorialBcvPage';
import { GestionDataPage } from '@/modules/data/GestionDataPage';
import { UsuariosPage } from '@/modules/sistema/UsuariosPage';
import { PermisosPage } from '@/modules/sistema/PermisosPage';
import { ConfiguracionPage } from '@/modules/sistema/ConfiguracionPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Ruta Pública de Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas Protegidas dentro de MainLayout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Redirección raíz a Dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Operaciones */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/rutas" element={<RecoleccionRutasPage />} />
            <Route path="/viajes" element={<ViajesTicketsPage />} />
            <Route path="/receptoria" element={<ReceptoriaPage />} />
            <Route path="/balance" element={<BalanceLechePage />} />
            <Route path="/planificacion-rutas" element={<RutasLogisticaPage />} />
            <Route path="/bufala" element={<BufalaPage />} />

            {/* Catálogos */}
            <Route path="/fincas" element={<FincasPage />} />
            <Route path="/propietarios" element={<PropietariosPage />} />
            <Route path="/conductores" element={<ConductoresPage />} />
            <Route path="/camiones" element={<CamionesPage />} />
            <Route path="/companias" element={<CompaniasPage />} />
            <Route path="/bancos" element={<BancosPage />} />
            <Route path="/empresa" element={<EmpresaPage />} />

            {/* Flota & Mantenimiento */}
            <Route path="/combustible" element={<CombustiblePage />} />
            <Route path="/mantenimiento" element={<MantenimientoPage />} />
            <Route path="/repuestos" element={<RepuestosPage />} />

            {/* Liquidación & Finanzas */}
            <Route path="/semanas" element={<SemanasPage />} />
            <Route path="/liquidaciones" element={<LiquidacionesPage />} />
            <Route path="/pagos-personal" element={<PagosPersonalPage />} />

            {/* Adelantos */}
            <Route path="/adelantos-fincas" element={<AdelantosFincasPage />} />
            <Route path="/adelantos-personal" element={<AdelantosPersonalPage />} />
            <Route path="/abonos-companias" element={<AbonosCompaniasPage />} />

            {/* Reportes */}
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/historial-bcv" element={<HistorialBcvPage />} />

            {/* Sistema */}
            <Route path="/data" element={<GestionDataPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/permisos" element={<PermisosPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>

          {/* Ruta no encontrada */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
