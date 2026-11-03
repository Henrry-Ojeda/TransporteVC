import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogosApi } from '@/api/catalogos.api';
import type { EmpresaConfigDto } from '@/types';

export const EmpresaPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<EmpresaConfigDto>({
    nombreEmpresa: '',
    rif: '',
    direccion: '',
    telefono: '',
    email: '',
    monedaPrincipal: 'USD',
    toleranciaMermaPct: 1.5,
  });

  const { data: config, isLoading, refetch } = useQuery<EmpresaConfigDto>({
    queryKey: ['empresa-config'],
    queryFn: () => catalogosApi.getEmpresaConfig(),
  });

  useEffect(() => {
    if (config) {
      setForm({
        id: config.id,
        nombreEmpresa: config.nombreEmpresa || '',
        rif: config.rif || '',
        direccion: config.direccion || '',
        telefono: config.telefono || '',
        email: config.email || '',
        monedaPrincipal: config.monedaPrincipal || 'USD',
        toleranciaMermaPct: config.toleranciaMermaPct ?? 1.5,
      });
    }
  }, [config]);

  const guardarMutation = useMutation({
    mutationFn: (dto: EmpresaConfigDto) => catalogosApi.guardarEmpresaConfig(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Configuración y membrete guardados exitosamente');
      queryClient.invalidateQueries({ queryKey: ['empresa-config'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar configuración');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombreEmpresa?.trim() || !form.rif?.trim()) {
      toast.error('Nombre de empresa y RIF son requeridos');
      return;
    }
    guardarMutation.mutate(form);
  };

  return (
    <div>
      {/* VISTA HEADER 1:1 */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-building-circle-check" style={{ color: '#0284c7', marginRight: '8px' }}></i>
            Configuración de Empresa & Membrete
          </h1>
          <p className="view-subtitle">
            Administración de datos fiscales e institucionales utilizados en comprobantes de pago, relaciones de compra y reportes oficiales
          </p>
        </div>

        <div className="view-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refetch()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <i className="fa-solid fa-arrows-rotate"></i> Recargar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={guardarMutation.isPending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #059669, #10b981)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
            }}
          >
            <i className="fa-solid fa-floppy-disk"></i>
            {guardarMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginTop: '10px' }}>
        {/* COLUMNA 1: FORMULARIO CRUD */}
        <div
          className="content-card"
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1.5px solid #e2e8f0',
              paddingBottom: '14px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                <i className="fa-solid fa-building-circle-check"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Datos de la Empresa</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Tabla de Sistema: TB_EMPRESA_CONFIG</span>
              </div>
            </div>
            <span
              className="badge"
              style={{
                background: '#ecfdf5',
                color: '#047857',
                fontWeight: 800,
                border: '1px solid #a7f3d0',
                fontSize: '11px',
              }}
            >
              <i className="fa-solid fa-shield-halved" style={{ marginRight: '4px' }}></i> OFICIAL
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                Nombre Comercial / Razón Social <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                type="text"
                value={form.nombreEmpresa}
                onChange={(e) => setForm({ ...form, nombreEmpresa: e.target.value })}
                placeholder="Ej: Mi Empresa Láctea C.A."
                className="form-input"
                style={{ width: '100%', height: '44px', fontSize: '14px', fontWeight: 700, color: '#0f172a', borderRadius: '8px' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  RIF / Identificación Fiscal <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.rif}
                  onChange={(e) => setForm({ ...form, rif: e.target.value.toUpperCase() })}
                  placeholder="Ej: J-50000000-0"
                  className="form-input"
                  style={{ width: '100%', height: '44px', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', borderRadius: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Ej: +58 414-0000000"
                  className="form-input"
                  style={{ width: '100%', height: '44px', fontSize: '13.5px', color: '#0f172a', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                Correo Electrónico Oficial
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Ej: contacto@empresa.com"
                className="form-input"
                style={{ width: '100%', height: '44px', fontSize: '13.5px', color: '#0f172a', borderRadius: '8px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                Dirección Fiscal / Operativa
              </label>
              <textarea
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                rows={2}
                placeholder="Ej: Carretera Nacional, Sector El Cruce, Estado Zulia, Venezuela"
                className="form-input"
                style={{ width: '100%', fontSize: '13.5px', color: '#0f172a', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  Moneda Base
                </label>
                <select
                  value={form.monedaPrincipal}
                  onChange={(e) => setForm({ ...form, monedaPrincipal: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', height: '44px', fontSize: '13.5px', fontWeight: 700, borderRadius: '8px' }}
                >
                  <option value="USD">USD ($ - Dólar Estadounidense)</option>
                  <option value="VES">VES (Bs. - Bolívar Digital)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                  Tolerancia Merma Máxima (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.toleranciaMermaPct}
                  onChange={(e) => setForm({ ...form, toleranciaMermaPct: Number(e.target.value) })}
                  className="form-input"
                  style={{ width: '100%', height: '44px', fontSize: '13.5px', fontWeight: 700, borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="submit"
                disabled={guardarMutation.isPending}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  border: 'none',
                  fontWeight: 800,
                  padding: '10px 24px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                }}
              >
                <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i>
                {guardarMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        </div>

        {/* COLUMNA 2: PREVISUALIZACIÓN EN VIVO DEL MEMBRETE */}
        <div>
          <div
            style={{
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-eye" style={{ color: '#0284c7' }}></i> Previsualización en Vivo del Membrete
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '2px solid #0f172a',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #0f172a',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    boxShadow: '0 6px 16px rgba(15,23,42,0.3)',
                    border: '2px solid #334155',
                    overflow: 'hidden',
                  }}
                >
                  <i className="fa-solid fa-truck-droplet" style={{ color: '#38bdf8' }}></i>
                </div>
                <div>
                  <h1
                    style={{
                      margin: 0,
                      color: '#0f172a',
                      fontSize: '18px',
                      fontWeight: 900,
                      letterSpacing: '-0.4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {form.nombreEmpresa || 'TRANSPORTE Y LOGÍSTICA'}
                  </h1>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: '#475569',
                      fontWeight: 700,
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span><strong>RIF:</strong> {form.rif || 'J-00000000-0'}</span>
                    <span>&bull;</span>
                    <span>Transporte y Recolección de Leche</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                    {form.direccion || 'Dirección fiscal de la empresa'}
                  </div>
                  {form.telefono && (
                    <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '1px' }}>
                      <i className="fa-solid fa-phone" style={{ marginRight: '4px' }}></i> {form.telefono}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '18px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '12.5px',
              }}
            >
              <i className="fa-solid fa-file-lines" style={{ fontSize: '28px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}></i>
              Este membrete se genera automáticamente en la parte superior de:
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, padding: '3px 8px' }}>
                  Comprobantes Oficiales de Pago
                </span>
                <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontWeight: 700, padding: '3px 8px' }}>
                  Relaciones de Compra de Leche
                </span>
                <span className="badge" style={{ background: '#fdf4ff', color: '#9333ea', fontWeight: 700, padding: '3px 8px' }}>
                  Exportaciones a PDF / Impresión
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmpresaPage;
