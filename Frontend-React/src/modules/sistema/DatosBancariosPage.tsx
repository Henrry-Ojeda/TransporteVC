import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/api/auth.api';
import type { PerfilUsuarioDto, ActualizarPerfilDto } from '@/types';

const BANCOS_VENEZUELA = [
  { codigo: '0102', nombre: '0102 - Banco de Venezuela' },
  { codigo: '0134', nombre: '0134 - Banesco' },
  { codigo: '0105', nombre: '0105 - Banco Mercantil' },
  { codigo: '0108', nombre: '0108 - BBVA Provincial' },
  { codigo: '0172', nombre: '0172 - Bancamiga' },
  { codigo: '0191', nombre: '0191 - BNC (Banco Nacional de Crédito)' },
  { codigo: '0163', nombre: '0163 - Banco del Tesoro' },
  { codigo: '0114', nombre: '0114 - Bancaribe' },
  { codigo: '0115', nombre: '0115 - Banco Exterior' },
  { codigo: '0175', nombre: '0175 - Banco Bicentenario' },
  { codigo: '0166', nombre: '0166 - Banco Agrícola de Venezuela' },
  { codigo: '0177', nombre: '0177 - BANFANB' },
  { codigo: '0174', nombre: '0174 - Banplus' },
  { codigo: '0128', nombre: '0128 - Banco Caroní' },
  { codigo: '0168', nombre: '0168 - Bancrecer' },
  { codigo: '0151', nombre: '0151 - BFC (Banco Fondo Común)' },
  { codigo: '0138', nombre: '0138 - Banco Plaza' },
  { codigo: '0157', nombre: '0157 - DelSur' },
  { codigo: '0156', nombre: '0156 - 100% Banco' },
];

export const DatosBancariosPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [bancoNombre, setBancoNombre] = useState('');
  const [bancoCuenta, setBancoCuenta] = useState('');
  const [pagoMovilCedula, setPagoMovilCedula] = useState('');
  const [pagoMovilTelefono, setPagoMovilTelefono] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Corriente');
  const [mismoBancoPagoMovil, setMismoBancoPagoMovil] = useState(true);
  const [bancoPagoMovil, setBancoPagoMovil] = useState('');

  // Consulta del perfil
  const { data: perfil, isLoading } = useQuery<PerfilUsuarioDto>({
    queryKey: ['perfil-usuario'],
    queryFn: authApi.getPerfil,
  });

  useEffect(() => {
    if (perfil) {
      const cuenta = perfil.numeroCuenta || perfil.bancoCuenta || '';
      const bNombre = perfil.bancoNombre || '';
      const ci = perfil.cedulaPagoMovil || perfil.pagoMovilCedula || perfil.cedula || '';
      const tlf = perfil.telefonoPagoMovil || perfil.pagoMovilTelefono || perfil.telefono || '';

      setBancoNombre(bNombre);
      setBancoCuenta(cuenta);
      setPagoMovilCedula(ci);
      setPagoMovilTelefono(tlf);
      setBancoPagoMovil(bNombre);
    }
  }, [perfil]);

  const mutationGuardar = useMutation({
    mutationFn: authApi.updatePerfil,
    onSuccess: (data) => {
      toast.success(data.message || 'Datos bancarios actualizados correctamente');
      queryClient.invalidateQueries({ queryKey: ['perfil-usuario'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Error al guardar datos bancarios';
      toast.error(msg);
    },
  });

  const handleCuentaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir solo dígitos y limitar a 20 caracteres
    const raw = e.target.value.replace(/\D/g, '').slice(0, 20);
    setBancoCuenta(raw);

    // Detección automática de banco si inicia con 4 dígitos conocidos
    if (raw.length >= 4) {
      const prefijo = raw.slice(0, 4);
      const bancoMatch = BANCOS_VENEZUELA.find((b) => b.codigo === prefijo);
      if (bancoMatch && (!bancoNombre || BANCOS_VENEZUELA.some((b) => b.nombre === bancoNombre))) {
        setBancoNombre(bancoMatch.nombre);
        if (mismoBancoPagoMovil) {
          setBancoPagoMovil(bancoMatch.nombre);
        }
      }
    }
  };

  const handleCopiarCuenta = () => {
    if (!bancoCuenta) {
      toast.error('No hay número de cuenta para copiar');
      return;
    }
    navigator.clipboard.writeText(bancoCuenta);
    toast.success('Número de cuenta copiado al portapapeles');
  };

  const handleCopiarPagoMovil = () => {
    if (!pagoMovilTelefono || !pagoMovilCedula) {
      toast.error('Completa los datos de pago móvil primero');
      return;
    }
    const texto = `PAGO MÓVIL:\nBanco: ${bancoPagoMovil || bancoNombre || 'N/A'}\nCédula: ${pagoMovilCedula}\nTeléfono: ${pagoMovilTelefono}\nTitular: ${perfil?.nombreCompleto || ''}`;
    navigator.clipboard.writeText(texto);
    toast.success('Datos de Pago Móvil copiados al portapapeles');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (bancoCuenta && bancoCuenta.length !== 20) {
      toast.error('El número de cuenta bancaria debe contener exactamente 20 dígitos numéricos');
      return;
    }

    const payload: ActualizarPerfilDto = {
      nombreCompleto: perfil?.nombreCompleto || '',
      cedula: perfil?.cedula,
      telefono: perfil?.telefono,
      fotoUrl: perfil?.fotoUrl,
      bancoNombre: bancoNombre.trim(),
      numeroCuenta: bancoCuenta.trim(),
      bancoCuenta: bancoCuenta.trim(),
      cedulaPagoMovil: pagoMovilCedula.trim(),
      pagoMovilCedula: pagoMovilCedula.trim(),
      telefonoPagoMovil: pagoMovilTelefono.trim(),
      pagoMovilTelefono: pagoMovilTelefono.trim(),
    };

    mutationGuardar.mutate(payload);
  };

  // Formatear cuenta con guiones visuales (0000-0000-00-0000000000)
  const formatearCuenta = (num: string) => {
    if (!num) return '•••• •••• •••• •••• ••••';
    const partes = [
      num.slice(0, 4),
      num.slice(4, 8),
      num.slice(8, 10),
      num.slice(10, 20),
    ].filter(Boolean);
    return partes.join(' ');
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: '#0284c7', marginBottom: '12px' }}></i>
        <p style={{ fontWeight: 600 }}>Cargando información bancaria...</p>
      </div>
    );
  }

  return (
    <section id="tab-datos-bancarios" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA & INDICADOR DE MÓDULO */}
      <div className="view-header" style={{ marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Módulo Sistema &amp; Configuración / Finanzas Personales
            </span>
          </div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-building-columns" style={{ color: '#059669' }}></i>
            Mis Datos Bancarios &amp; Pago Móvil
          </h1>
          <p className="view-subtitle">
            Cuentas y métodos de recepción de fondos para transferencias de nómina, viáticos de rutas y liquidaciones
          </p>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN PROFESIONAL */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '24px',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/perfil')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            color: '#64748b',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '10px 10px 0 0',
            transition: 'all 0.2s',
          }}
        >
          <i className="fa-solid fa-user-shield"></i>
          Mi Perfil &amp; Seguridad
        </button>

        <button
          type="button"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: '#ffffff',
            color: '#059669',
            fontWeight: 800,
            fontSize: '13.5px',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '10px 10px 0 0',
            borderBottom: '3px solid #059669',
            boxShadow: '0 -2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <i className="fa-solid fa-building-columns"></i>
          Datos Bancarios &amp; Pago Móvil
        </button>
      </div>

      {/* TARJETAS VISUALES DIGITALES FINTECH (FINANCIAL SHOWCASE) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '22px',
          marginBottom: '26px',
        }}
      >
        {/* TARJETA VISUAL DIGITAL: CUENTA BANCARIA */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
            borderRadius: '20px',
            padding: '24px',
            color: '#ffffff',
            boxShadow: '0 12px 25px -4px rgba(2, 132, 199, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '210px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Chip y Ondas Contactless */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa-solid fa-microchip" style={{ color: '#78350f', fontSize: '15px' }}></i>
              </div>
              <i className="fa-solid fa-wifi" style={{ transform: 'rotate(90deg)', color: 'rgba(255,255,255,0.6)', fontSize: '16px' }}></i>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '3px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              Transferencia Bancaria
            </span>
          </div>

          {/* Número de Cuenta Digital */}
          <div style={{ margin: '18px 0 14px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
              {bancoNombre || 'Banco no configurado'}
            </span>
            <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 800, letterSpacing: '2px', color: '#f8fafc', wordBreak: 'break-all' }}>
              {formatearCuenta(bancoCuenta)}
            </div>
          </div>

          {/* Titular y Botón de Copiado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '12px' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Titular de la Cuenta</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                {perfil?.nombreCompleto || 'TITULAR'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopiarCuenta}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              title="Copiar Nro de Cuenta"
            >
              <i className="fa-solid fa-copy"></i> Copiar Cuenta
            </button>
          </div>
        </div>

        {/* TARJETA VISUAL DIGITAL: PAGO MÓVIL */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            borderRadius: '20px',
            padding: '24px',
            color: '#ffffff',
            boxShadow: '0 12px 25px -4px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '210px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header Pago Móvil */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '17px',
                }}
              >
                <i className="fa-solid fa-mobile-screen-button"></i>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                Pago Móvil Interbancario
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#a7f3d0',
                background: 'rgba(167, 243, 208, 0.2)',
                padding: '3px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(167, 243, 208, 0.4)',
              }}
            >
              Liquidación Inmediata
            </span>
          </div>

          {/* Datos Rápidos Pago Móvil */}
          <div style={{ margin: '14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '10.5px', color: '#a7f3d0', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Teléfono Afiliado
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                {pagoMovilTelefono || 'No configurado'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10.5px', color: '#a7f3d0', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Cédula Identidad
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                {pagoMovilCedula || 'No configurado'}
              </span>
            </div>
          </div>

          {/* Footer y Botón Copiar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#a7f3d0', textTransform: 'uppercase', display: 'block' }}>Banco Destino</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                {bancoPagoMovil || bancoNombre || 'Banco no seleccionado'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopiarPagoMovil}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              title="Copiar datos completos para Pago Móvil"
            >
              <i className="fa-solid fa-copy"></i> Copiar Datos PM
            </button>
          </div>
        </div>
      </div>

      {/* FORMULARIO DE CONFIGURACIÓN BANCARIA */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '22px' }}>
          
          {/* SECCIÓN 1: CUENTA BANCARIA */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px' }}>
                <i className="fa-solid fa-landmark"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Cuenta Bancaria para Transferencias
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Acreditación de sueldos, viajes y liquidaciones</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Banco Receptor *
                </label>
                <select
                  value={bancoNombre}
                  onChange={(e) => {
                    const sel = e.target.value;
                    setBancoNombre(sel);
                    if (mismoBancoPagoMovil) setBancoPagoMovil(sel);
                  }}
                  className="form-input"
                  style={{ width: '100%', height: '42px', fontWeight: 600 }}
                  required
                >
                  <option value="">-- Seleccionar Institución Bancaria --</option>
                  {BANCOS_VENEZUELA.map((b) => (
                    <option key={b.codigo} value={b.nombre}>
                      {b.nombre}
                    </option>
                  ))}
                  <option value="Otro">Otro Banco Nacional / Internacional</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                    Número de Cuenta Bancaria (20 Dígitos) *
                  </label>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: bancoCuenta.length === 20 ? '#059669' : '#e11d48',
                    }}
                  >
                    {bancoCuenta.length === 20 ? '✓ 20 dígitos completados' : `${bancoCuenta.length} / 20 dígitos`}
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    maxLength={20}
                    value={bancoCuenta}
                    onChange={handleCuentaChange}
                    className="form-input"
                    placeholder="01020123456789012345"
                    style={{
                      width: '100%',
                      height: '42px',
                      fontFamily: 'monospace',
                      fontSize: '14.5px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      color: '#0f172a',
                    }}
                    required
                  />
                  {bancoCuenta.length === 20 && (
                    <i
                      className="fa-solid fa-circle-check"
                      style={{ position: 'absolute', right: '12px', top: '13px', color: '#10b981', fontSize: '16px' }}
                    ></i>
                  )}
                </div>
                <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Ingresa los 20 dígitos continuos sin guiones ni espacios.
                </small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Tipo de Cuenta
                  </label>
                  <select
                    value={tipoCuenta}
                    onChange={(e) => setTipoCuenta(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', height: '42px', fontWeight: 600 }}
                  >
                    <option value="Corriente">Cuenta Corriente</option>
                    <option value="Ahorro">Cuenta de Ahorro</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Titular Registrado
                  </label>
                  <input
                    type="text"
                    value={perfil?.nombreCompleto || ''}
                    disabled
                    className="form-input"
                    style={{ width: '100%', height: '42px', background: '#f8fafc', color: '#64748b', fontWeight: 600, cursor: 'not-allowed' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: PAGO MÓVIL */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px' }}>
                  <i className="fa-solid fa-mobile-retro"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    Afiliación de Pago Móvil
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Para pagos directos e inmediatos</span>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#059669', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mismoBancoPagoMovil}
                  onChange={(e) => {
                    setMismoBancoPagoMovil(e.target.checked);
                    if (e.target.checked) setBancoPagoMovil(bancoNombre);
                  }}
                  style={{ accentColor: '#059669' }}
                />
                <span>Mismo banco</span>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Banco de Pago Móvil *
                </label>
                <select
                  value={bancoPagoMovil || (mismoBancoPagoMovil ? bancoNombre : '')}
                  onChange={(e) => setBancoPagoMovil(e.target.value)}
                  disabled={mismoBancoPagoMovil}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '42px',
                    fontWeight: 600,
                    background: mismoBancoPagoMovil ? '#f8fafc' : '#ffffff',
                    cursor: mismoBancoPagoMovil ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="">-- Seleccionar Banco para Pago Móvil --</option>
                  {BANCOS_VENEZUELA.map((b) => (
                    <option key={`pm-${b.codigo}`} value={b.nombre}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Cédula Pago Móvil *
                  </label>
                  <input
                    type="text"
                    value={pagoMovilCedula}
                    onChange={(e) => setPagoMovilCedula(e.target.value)}
                    className="form-input"
                    placeholder="Ej: V-18408156"
                    style={{ width: '100%', height: '42px', fontWeight: 600 }}
                    required
                  />
                  <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                    Incluye la letra (V, E o J).
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Teléfono Celular Pago Móvil *
                  </label>
                  <input
                    type="text"
                    value={pagoMovilTelefono}
                    onChange={(e) => setPagoMovilTelefono(e.target.value)}
                    className="form-input"
                    placeholder="Ej: 04127869868"
                    style={{ width: '100%', height: '42px', fontWeight: 600 }}
                    required
                  />
                  <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                    11 dígitos de operadora venezolana.
                  </small>
                </div>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  borderRadius: '10px',
                  border: '1px solid #bbf7d0',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12px',
                  color: '#166534',
                }}
              >
                <i className="fa-solid fa-circle-info" style={{ fontSize: '16px', color: '#16a34a' }}></i>
                <span>
                  Estos datos serán utilizados por administración para emitir los pagos y adelantos autorizados en tu cuenta.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE ACCIÓN Y GUARDADO */}
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '14px',
            background: '#ffffff',
            padding: '16px 24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          }}
        >
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Asegúrate de verificar el número de cuenta de 20 dígitos antes de guardar.
          </span>
          <button
            type="submit"
            disabled={mutationGuardar.isPending}
            className="btn btn-primary"
            style={{
              padding: '10px 28px',
              fontSize: '14px',
              fontWeight: 800,
              background: '#059669',
              borderColor: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {mutationGuardar.isPending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> Guardando Datos Bancarios...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk"></i> Guardar Datos Bancarios
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export default DatosBancariosPage;
