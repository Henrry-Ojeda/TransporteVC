import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sistemaApi } from '@/api/sistema.api';

export const ConfiguracionPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [toleranciaMerma, setToleranciaMerma] = useState<string>('1.50');
  const [diaCorteSemana, setDiaCorteSemana] = useState<string>('DOMINGO');
  const [alertaCombustibleMin, setAlertaCombustibleMin] = useState<string>('500');
  const [alertaKmSugerido, setAlertaKmSugerido] = useState<string>('500');
  const [subTab, setSubTab] = useState<'parametros' | 'tiposLeche' | 'navegacion'>('parametros');

  const { data: parametros = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['configuracion-parametros'],
    queryFn: () => sistemaApi.getConfiguracion(),
  });

  const guardarMutation = useMutation({
    mutationFn: async () => {
      await sistemaApi.guardarParametro('TOLERANCIA_MERMA_PCT', toleranciaMerma);
      await sistemaApi.guardarParametro('DIA_CORTE_SEMANA', diaCorteSemana);
      await sistemaApi.guardarParametro('ALERTA_COMBUSTIBLE_MIN_LITROS', alertaCombustibleMin);
      await sistemaApi.guardarParametro('ALERTA_MANTENIMIENTO_KM', alertaKmSugerido);
    },
    onSuccess: () => {
      toast.success('Parámetros globales y semáforo operativo actualizados');
      queryClient.invalidateQueries({ queryKey: ['configuracion-parametros'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar parámetros');
    },
  });

  return (
    <div>
      {/* VISTA HEADER 1:1 */}
      <div className="view-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-sliders" style={{ color: '#a855f7' }}></i>
            Parametrización & Configuración Global
          </h1>
          <p className="view-subtitle">
            Gestión desacoplada y en caliente de parámetros de negocio, catálogo de tipos de leche, navegación dinámica y widgets
          </p>
        </div>

        <div className="view-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refetch()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <i className="fa-solid fa-arrows-rotate"></i> Recargar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => guardarMutation.mutate()}
            disabled={guardarMutation.isPending}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
              border: 'none',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-floppy-disk"></i>
            {guardarMutation.isPending ? 'Guardando...' : 'Guardar Todo'}
          </button>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS / SUBMODULOS */}
      <div
        className="filter-pills-bar"
        style={{
          marginBottom: '20px',
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          padding: '6px',
          borderRadius: '12px',
          display: 'inline-flex',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setSubTab('parametros')}
          className={`filter-pill ${subTab === 'parametros' ? 'active' : ''}`}
          style={{
            borderRadius: '8px',
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '12.5px',
            border: 'none',
            background: subTab === 'parametros' ? '#7c3aed' : 'transparent',
            color: subTab === 'parametros' ? '#ffffff' : '#475569',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-gears" style={{ marginRight: '6px' }}></i> Parámetros de Negocio
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tiposLeche')}
          className={`filter-pill ${subTab === 'tiposLeche' ? 'active' : ''}`}
          style={{
            borderRadius: '8px',
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '12.5px',
            border: 'none',
            background: subTab === 'tiposLeche' ? '#0284c7' : 'transparent',
            color: subTab === 'tiposLeche' ? '#ffffff' : '#475569',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-bottle-droplet" style={{ marginRight: '6px' }}></i> Tipos de Leche & Precios
        </button>
        <button
          type="button"
          onClick={() => setSubTab('navegacion')}
          className={`filter-pill ${subTab === 'navegacion' ? 'active' : ''}`}
          style={{
            borderRadius: '8px',
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '12.5px',
            border: 'none',
            background: subTab === 'navegacion' ? '#059669' : 'transparent',
            color: subTab === 'navegacion' ? '#ffffff' : '#475569',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-folder-tree" style={{ marginRight: '6px' }}></i> Módulos de Navegación
        </button>
      </div>

      {/* TARJETA ESPECIAL: SEMÁFORO DE TOLERANCIA DE MERMA */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '14px',
          padding: '20px 24px',
          marginBottom: '22px',
          color: '#ffffff',
          border: '1.5px solid #334155',
          boxShadow: '0 10px 25px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '620px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1.5px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <i className="fa-solid fa-traffic-light"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>
                Semáforo Operativo de Tolerancia de Merma
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                Define el porcentaje máximo de pérdida permitido en las rutas. Los tickets se colorean automáticamente en el sistema:
              </p>
              <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#34d399' }}>
                  <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> Verde: Sin merma o ganancia (0.00%)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#fbbf24' }}>
                  <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> Amarillo: Faltante &le; Tolerancia
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#f87171' }}>
                  <i className="fa-solid fa-circle" style={{ fontSize: '8px' }}></i> Rojo: Alerta / Faltante &gt; Tolerancia
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                Tolerancia Permitida (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="25"
                  value={toleranciaMerma}
                  onChange={(e) => setToleranciaMerma(e.target.value)}
                  style={{
                    width: '95px',
                    height: '38px',
                    textAlign: 'center',
                    fontSize: '17px',
                    fontWeight: 900,
                    background: '#0f172a',
                    color: '#38bdf8',
                    border: '1.5px solid #0284c7',
                    borderRadius: '8px',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8' }}>%</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => guardarMutation.mutate()}
              disabled={guardarMutation.isPending}
              style={{
                height: '40px',
                padding: '0 16px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
                cursor: 'pointer',
                color: '#fff',
              }}
            >
              <i className="fa-solid fa-floppy-disk"></i> Guardar
            </button>
          </div>
        </div>
      </div>

      {/* FORMULARIO DE PARÁMETROS GLOBALES */}
      <div className="content-card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-gears" style={{ color: '#7c3aed' }}></i> Reglas de Negocio & Parámetros Operativos
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Día de Cierre de Ciclo Semanal
            </label>
            <select
              value={diaCorteSemana}
              onChange={(e) => setDiaCorteSemana(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: '40px', fontWeight: 700, borderRadius: '8px' }}
            >
              <option value="DOMINGO">Domingo (Corte Oficial Tradicional)</option>
              <option value="LUNES">Lunes</option>
              <option value="SABADO">Sábado</option>
            </select>
            <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Día utilizado como límite de agrupación en nóminas y conciliaciones.
            </small>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Alerta Combustible Crítico (Litros en Tanque)
            </label>
            <input
              type="number"
              value={alertaCombustibleMin}
              onChange={(e) => setAlertaCombustibleMin(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: '40px', fontWeight: 700, borderRadius: '8px' }}
            />
            <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Se muestra una advertencia en el módulo de combustible si el stock baja de esta cifra.
            </small>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Alerta Preventiva Odómetro Mantenimiento (Km)
            </label>
            <input
              type="number"
              value={alertaKmSugerido}
              onChange={(e) => setAlertaKmSugerido(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: '40px', fontWeight: 700, borderRadius: '8px' }}
            />
            <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Kilometraje de anticipación para notificar cambios de aceite y filtros.
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => guardarMutation.mutate()}
            disabled={guardarMutation.isPending}
            style={{
              padding: '10px 24px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)',
            }}
          >
            <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i>
            {guardarMutation.isPending ? 'Guardando...' : 'Guardar Parámetros'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionPage;
