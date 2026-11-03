import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { finanzasApi } from '@/api/finanzas.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type { CicloSemanalDto } from '@/types';

export const SemanasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalCrear, setModalCrear] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [cicloSeleccionado, setCicloSeleccionado] = useState<CicloSemanalDto | null>(null);
  const [tasaCierre, setTasaCierre] = useState<number>(889.25);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');

  const initialForm = {
    numeroSemana: 1,
    año: new Date().getFullYear(),
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
  };
  const [form, setForm] = useState(initialForm);

  // Queries
  const { data: ciclos = [], isLoading } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-semanas'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  const semanaActiva = useMemo(() => {
    return ciclos.find((c) => c.estado === 'ABIERTO') || ciclos[0];
  }, [ciclos]);

  // Mutaciones
  const crearMutation = useMutation({
    mutationFn: (dto: typeof initialForm) => finanzasApi.crearCiclo(dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Semana operativa abierta');
      queryClient.invalidateQueries({ queryKey: ['ciclos-semanas'] });
      setModalCrear(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al abrir semana');
    },
  });

  const cerrarMutation = useMutation({
    mutationFn: ({ id, tasa }: { id: number; tasa: number }) => finanzasApi.cerrarCiclo(id, tasa),
    onSuccess: (data) => {
      toast.success(data.message || 'Semana operativa cerrada y liquidada');
      queryClient.invalidateQueries({ queryKey: ['ciclos-semanas'] });
      setModalCerrar(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al cerrar semana');
    },
  });

  const displaySemana = (s: any) => {
    if (!s) return 'Semana';
    const num = s.numeroSemana || s.NumeroSemana || s.codigo?.match(/#\s*(\d+)/)?.[1] || s.id;
    const anio = s.anio || s.Anio || s.año || s.Año || (s.fechaInicio ? new Date(s.fechaInicio).getFullYear() : '');
    return `Semana #${num} (${anio})`;
  };

  const columns: ColumnDef<CicloSemanalDto>[] = [
    {
      header: 'SEMANA & AÑO',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
            {displaySemana(row)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {new Date(row.fechaInicio).toLocaleDateString('es-VE')} al {new Date(row.fechaFin).toLocaleDateString('es-VE')}
          </div>
        </div>
      ),
    },
    {
      header: 'TOTAL LITROS RECOGIDOS',
      accessorKey: 'totalLitros',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '13.5px' }}>
          {(row.totalLitros || 0).toLocaleString()} <small>Lts</small>
        </span>
      ),
    },
    {
      header: 'MONTO TOTAL LIQUIDACIÓN',
      accessorKey: 'totalMontoUSD',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#059669', fontSize: '13.5px' }}>
            ${(row.totalMontoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} <small>USD</small>
          </div>
          {row.totalMontoBs > 0 && (
            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
              Bs. {(row.totalMontoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'TASA BCV CIERRE',
      accessorKey: 'tasaBCVCierre',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#475569', fontSize: '12.5px' }}>
          {row.tasaBCVCierre ? `Bs. ${row.tasaBCVCierre.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '-'}
        </span>
      ),
    },
    {
      header: 'ESTADO',
      accessorKey: 'estado',
      sortable: true,
      cell: (row) => {
        const esAbierto = row.estado === 'ABIERTO';
        return (
          <span
            className="badge"
            style={{
              background: esAbierto ? '#ecfdf5' : '#f1f5f9',
              color: esAbierto ? '#047857' : '#475569',
              border: `1px solid ${esAbierto ? '#a7f3d0' : '#cbd5e1'}`,
              fontWeight: 800,
            }}
          >
            <i className={`fa-solid ${esAbierto ? 'fa-unlock' : 'fa-lock'}`} style={{ marginRight: '4px' }}></i>
            {esAbierto ? 'Abierta (En Curso)' : 'Cerrada / Liquidada'}
          </span>
        );
      },
    },
    {
      header: 'ACCIONES',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          {row.estado === 'ABIERTO' && (
            <button
              type="button"
              onClick={() => {
                setCicloSeleccionado(row);
                setModalCerrar(true);
              }}
              className="btn btn-sm btn-outline"
              style={{
                height: '30px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#dc2626',
                borderColor: '#fca5a5',
                background: '#fef2f2',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="fa-solid fa-lock"></i>
              Cerrar Semana
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section id="tab-semanas" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Gestión de Semanas Operativas</h1>
          <p className="view-subtitle">
            Apertura y control de semanas de recolección (por defecto Martes a Lunes con días flexibles)
          </p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setModalCrear(true)}
            style={{ fontWeight: 700 }}
          >
            <i className="fa-solid fa-plus"></i> Nueva Semana Manual
          </button>
        </div>
      </div>

      {/* BANNER SEMANA OPERATIVA ACTIVA (1:1 ORIGINAL) */}
      {semanaActiva && (
        <div
          className="content-card"
          style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1.5px solid #334155',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            marginBottom: '24px',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '16px', fontWeight: 800 }}>
                <i className="fa-solid fa-star" style={{ color: '#fbbf24', marginRight: '6px' }}></i>
                Semana Operativa Activa para Recolecciones
              </h3>
              <span
                className="badge"
                style={{
                  background: semanaActiva.estado === 'ABIERTO' ? '#059669' : '#64748b',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <i className={`fa-solid ${semanaActiva.estado === 'ABIERTO' ? 'fa-circle-check' : 'fa-lock'}`} style={{ marginRight: '4px' }}></i>
                {semanaActiva.estado === 'ABIERTO' ? 'ACTIVA (EN CURSO)' : 'CERRADA'}
              </span>
            </div>

            {semanaActiva.estado === 'ABIERTO' && (
              <button
                type="button"
                onClick={() => {
                  setCicloSeleccionado(semanaActiva);
                  setModalCerrar(true);
                }}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <i className="fa-solid fa-lock"></i> CERRAR ESTA SEMANA OPERATIVA
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              marginTop: '12px',
            }}
          >
            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                CÓDIGO / SEMANA
              </span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                {displaySemana(semanaActiva)}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                RANGO DE FECHAS
              </span>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8' }}>
                {new Date(semanaActiva.fechaInicio).toLocaleDateString('es-VE')} al {new Date(semanaActiva.fechaFin).toLocaleDateString('es-VE')}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                LITROS ACUMULADOS
              </span>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#4ade80' }}>
                {(semanaActiva.totalLitros || 0).toLocaleString()} Lts
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                TOTAL LIQUIDACIÓN
              </span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#fbbf24' }}>
                ${(semanaActiva.totalMontoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALENDARIO DE SEMANAS */}
      <div className="content-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
            <i className="fa-solid fa-calendar-days" style={{ color: '#2563eb', marginRight: '8px' }}></i>
            Calendario de Semanas Operativas
          </h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${filtroEstado === 'TODOS' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroEstado('TODOS')}
              style={{ borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 700 }}
            >
              Todas
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filtroEstado === 'ABIERTO' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroEstado('ABIERTO')}
              style={{ borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 700 }}
            >
              Abiertas
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filtroEstado === 'CERRADO' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFiltroEstado('CERRADO')}
              style={{ borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 700 }}
            >
              Cerradas
            </button>
          </div>
        </div>

        <DataTable
          data={ciclos.filter((c) => {
            if (filtroEstado === 'ABIERTO') return c.estado === 'ABIERTO';
            if (filtroEstado === 'CERRADO') return c.estado !== 'ABIERTO';
            return true;
          })}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Buscar por semana o año..."
          exportFileName="semanas_operativas"
        />
      </div>

      {/* MODAL CREAR SEMANA */}
      {modalCrear && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '14px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-calendar-plus" style={{ color: '#2563eb', marginRight: '8px' }}></i>
                Apertura de Semana Operativa
              </h3>
              <button
                type="button"
                onClick={() => setModalCrear(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                crearMutation.mutate(form);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Semana # *
                    </label>
                    <input
                      type="number"
                      value={form.numeroSemana}
                      onChange={(e) => setForm({ ...form, numeroSemana: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px', fontWeight: 700 }}
                      min="1"
                      max="53"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Año *
                    </label>
                    <input
                      type="number"
                      value={form.año}
                      onChange={(e) => setForm({ ...form, año: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px', fontWeight: 700 }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Fecha Inicio (Martes)
                    </label>
                    <input
                      type="date"
                      value={form.fechaInicio}
                      onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Fecha Fin (Lunes)
                    </label>
                    <input
                      type="date"
                      value={form.fechaFin}
                      onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalCrear(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px' }}
                >
                  {crearMutation.isPending ? 'Guardando...' : 'Abrir Semana'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CERRAR SEMANA */}
      {modalCerrar && cicloSeleccionado && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '14px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#dc2626' }}>
                <i className="fa-solid fa-lock" style={{ marginRight: '8px' }}></i>
                Cierre de Semana Operativa #{cicloSeleccionado.numeroSemana}
              </h3>
              <button
                type="button"
                onClick={() => setModalCerrar(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Al cerrar esta semana se congelarán las entregas de leche de fincas y se fijará la tasa oficial BCV para la liquidación.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                cerrarMutation.mutate({
                  id: cicloSeleccionado.id,
                  tasa: tasaCierre,
                });
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Tasa Oficial BCV de Cierre (Bs / USD) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={tasaCierre}
                  onChange={(e) => setTasaCierre(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '100%', height: '40px', fontSize: '16px', fontWeight: 800, color: '#b45309' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalCerrar(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cerrarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                >
                  {cerrarMutation.isPending ? 'Cerrando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default SemanasPage;
