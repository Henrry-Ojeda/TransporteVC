import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { catalogosApi } from '@/api/catalogos.api';
import type { EmpresaConfigDto } from '@/types';

export const EmpresaPage: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EmpresaConfigDto>({
    nombreEmpresa: '',
    rif: '',
    direccion: '',
    telefono: '',
    email: '',
    logoUrl: '',
    monedaPrincipal: 'USD',
    toleranciaMermaPct: 1.5,
  });

  const { data: config, isLoading, refetch } = useQuery<EmpresaConfigDto>({
    queryKey: ['empresa-config'],
    queryFn: () => catalogosApi.getEmpresaConfig(),
  });

  useEffect(() => {
    if (config) {
      const nom = (config as any).nombre || config.nombreEmpresa || '';
      const logo = (config as any).logoUrl || (config as any).LogoUrl || config.logoUrl || '';
      setForm({
        id: config.id,
        nombreEmpresa: nom,
        rif: config.rif || (config as any).Rif || '',
        direccion: config.direccion || (config as any).Direccion || '',
        telefono: config.telefono || (config as any).Telefono || '',
        email: config.email || (config as any).Email || '',
        logoUrl: logo,
        monedaPrincipal: config.monedaPrincipal || 'USD',
        toleranciaMermaPct: config.toleranciaMermaPct ?? 1.5,
      });
    }
  }, [config]);

  const guardarMutation = useMutation({
    mutationFn: (dto: EmpresaConfigDto) => catalogosApi.guardarEmpresaConfig(dto),
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Configuración Guardada!',
        text: data.mensaje || data.message || 'Configuración y membrete guardados exitosamente.',
        confirmButtonColor: '#059669',
        timer: 2000,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['empresa-config'] });
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar',
        text: err.response?.data?.mensaje || err.response?.data?.message || 'No se pudo guardar la configuración.',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombreEmpresa?.trim() || !form.rif?.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos Requeridos',
        text: 'Nombre de empresa y RIF son obligatorios para el membrete.',
        confirmButtonColor: '#0284c7',
      });
      return;
    }
    guardarMutation.mutate(form);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire({
        icon: 'error',
        title: 'Archivo Inválido',
        text: 'Por favor seleccione una imagen en formato PNG, JPG o SVG.',
        confirmButtonColor: '#ef4444',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Imagen Muy Pesada',
        text: 'El tamaño máximo permitido para el logotipo es de 2 MB.',
        confirmButtonColor: '#d97706',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setForm((prev) => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
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
            Administración de datos fiscales, logotipo e imagen institucional para comprobantes de pago y reportes oficiales
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
            {/* LOGOTIPO DE LA EMPRESA */}
            <div style={{ marginBottom: '18px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px dashed #cbd5e1' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                <i className="fa-solid fa-image" style={{ color: '#0284c7', marginRight: '6px' }}></i>
                Logotipo de la Empresa para Membrete
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {form.logoUrl ? (
                  <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #cbd5e1', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={form.logoUrl} alt="Logo Empresa" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    <i className="fa-solid fa-building"></i>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-outline"
                      style={{ height: '34px', fontSize: '12px', padding: '0 12px', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-upload" style={{ marginRight: '4px' }}></i> Subir Imagen
                    </button>
                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, logoUrl: '' })}
                        className="btn btn-outline"
                        style={{ height: '34px', fontSize: '12px', padding: '0 10px', color: '#ef4444', borderColor: '#fca5a5' }}
                        title="Quitar logotipo"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>PNG, JPG o SVG (Recomendado: 300x300 px, máx. 2MB)</span>
                </div>
              </div>
            </div>

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
                  style={{ width: '100%', height: '44px', fontSize: '13.5px', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                Correo Electrónico Institucional
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Ej: administracion@empresa.com"
                className="form-input"
                style={{ width: '100%', height: '44px', fontSize: '13.5px', borderRadius: '8px' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                Dirección Fiscal & Operativa
              </label>
              <textarea
                rows={3}
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección completa del centro de operaciones o planta"
                className="form-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: '13px', borderRadius: '8px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1.5px solid #f1f5f9', paddingTop: '16px' }}>
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
                    width: '64px',
                    height: '64px',
                    borderRadius: '14px',
                    background: form.logoUrl ? '#ffffff' : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    boxShadow: '0 6px 16px rgba(15,23,42,0.15)',
                    border: '2px solid #cbd5e1',
                    overflow: 'hidden',
                  }}
                >
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <i className="fa-solid fa-truck-droplet" style={{ color: '#38bdf8' }}></i>
                  )}
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
                    }}
                  >
                    RIF: {form.rif || 'J-00000000-0'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  <i className="fa-solid fa-phone" style={{ marginRight: '4px' }}></i>
                  {form.telefono || 'Sin teléfono registrado'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  <i className="fa-solid fa-envelope" style={{ marginRight: '4px' }}></i>
                  {form.email || 'Sin correo registrado'}
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Ubicación / Dirección Fiscal:
              </div>
              <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 600, marginTop: '2px' }}>
                {form.direccion || 'Carretera Nacional, Sector El Cruce, Estado Zulia, Venezuela'}
              </div>
            </div>

            {/* MOCKUP REPORTE EN MEMBRETE */}
            <div style={{ marginTop: '20px', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '16px', background: '#fafaf9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  RELACIÓN OFICIAL DE RECOLECCIÓN
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>FECHA: {new Date().toLocaleDateString('es-VE')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                <div style={{ background: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>VOLUMEN TOTAL</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0284c7' }}>18.450 Lts</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>PRECIO LIQUIDACIÓN</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#059669' }}>$0.3800 /L</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>MONTO TOTAL</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>$7,011.00</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', fontSize: '11.5px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
              Este membrete con su logotipo se incluye automáticamente en todos los comprobantes y reportes exportables del sistema.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmpresaPage;
