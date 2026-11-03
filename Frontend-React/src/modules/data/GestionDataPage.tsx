import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Trash2,
  Building,
  Building2,
  Users,
  TreePine,
  Loader2,
  Info,
} from 'lucide-react';
import { dataApi } from '@/api/data.api';
import type { EntidadData } from '@/types';

interface ConfigEntidad {
  id: EntidadData;
  titulo: string;
  subtitulo: string;
  icono: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  camposRequeridos: string[];
  columnasPreview: { key: string; label: string }[];
  mapeo: Record<string, string[]>;
}

const CONFIG_ENTIDADES: Record<EntidadData, ConfigEntidad> = {
  FINCAS: {
    id: 'FINCAS',
    titulo: 'Fincas',
    subtitulo: 'Catálogo de fincas lecheras, códigos, precios y vinculación de propietario.',
    icono: TreePine,
    color: 'from-blue-600 to-indigo-600',
    camposRequeridos: ['nombre'],
    columnasPreview: [
      { key: 'codigo', label: 'Código' },
      { key: 'nombre', label: 'Nombre de Finca' },
      { key: 'propietario', label: 'Propietario' },
      { key: 'precioLitroUSD', label: 'Precio USD' },
      { key: 'tipoLeche', label: 'Tipo Leche' },
      { key: 'companiaNombre', label: 'Receptoría' },
    ],
    mapeo: {
      codigo: ['CODIGO', 'COD', 'CODIGO_FINCA'],
      nombre: ['NOMBRE_FINCA', 'NOMBRE', 'FINCA', 'NOMBRE FINCA'],
      propietario: ['PROPIETARIO', 'PROPIETARIO_NOMBRE', 'DUEÑO', 'TITULAR'],
      cedulaRIF: ['CEDULA_RIF', 'CEDULA', 'RIF', 'DOCUMENTO'],
      telefono: ['TELEFONO', 'TLF', 'CELULAR'],
      bancoNombre: ['BANCO', 'BANCO_NOMBRE'],
      numeroCuenta: ['NUMERO_CUENTA', 'CUENTA', 'NRO_CUENTA'],
      companiaNombre: ['COMPANIA_RECEPTORIA', 'COMPANIA', 'RECEPTORIA', 'PLANTA'],
      precioLitroUSD: ['PRECIO_LITRO_USD', 'PRECIO_USD', 'PRECIO', 'PRECIO LITRO'],
      precioLitroAcidaUSD: ['PRECIO_ACIDA_USD', 'PRECIO_MALA_USD'],
      tipoLeche: ['TIPO_LECHE', 'TIPO', 'LECHE'],
      tieneDosTiposLeche: ['TIENE_DOS_TIPOS_LECHE', 'DOS_TIPOS'],
    },
  },
  PROPIETARIOS: {
    id: 'PROPIETARIOS',
    titulo: 'Propietarios',
    subtitulo: 'Titulares y dueños de fincas lecheras, datos de contacto y cuentas bancarias.',
    icono: Users,
    color: 'from-sky-600 to-blue-600',
    camposRequeridos: ['nombre'],
    columnasPreview: [
      { key: 'nombre', label: 'Nombre Completo' },
      { key: 'cedulaRIF', label: 'Cédula / RIF' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'bancoNombre', label: 'Banco' },
      { key: 'numeroCuenta', label: 'Cuenta' },
    ],
    mapeo: {
      nombre: ['NOMBRE_COMPLETO', 'NOMBRE', 'PROPIETARIO', 'TITULAR'],
      cedulaRIF: ['CEDULA_RIF', 'CEDULA', 'RIF', 'DOCUMENTO'],
      telefono: ['TELEFONO', 'TLF', 'CELULAR'],
      email: ['EMAIL', 'CORREO'],
      bancoNombre: ['BANCO', 'BANCO_NOMBRE'],
      numeroCuenta: ['NUMERO_CUENTA', 'CUENTA', 'NRO_CUENTA'],
      observacion: ['OBSERVACION', 'NOTA'],
    },
  },
  COMPANIAS: {
    id: 'COMPANIAS',
    titulo: 'Compañías / Receptorías',
    subtitulo: 'Plantas procesadoras y destinos finales donde se entrega la leche.',
    icono: Building,
    color: 'from-emerald-600 to-teal-600',
    camposRequeridos: ['nombre'],
    columnasPreview: [
      { key: 'nombre', label: 'Compañía' },
      { key: 'encargado', label: 'Encargado' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'precioCompraLitroUSD', label: 'Precio Compra' },
      { key: 'precioBufalaLitroUSD', label: 'Precio Búfala' },
    ],
    mapeo: {
      nombre: ['NOMBRE_COMPANIA', 'NOMBRE', 'COMPANIA', 'RECEPTORIA', 'PLANTA'],
      encargado: ['ENCARGADO', 'RESPONSABLE', 'CONTACTO'],
      telefono: ['TELEFONO', 'TLF'],
      direccion: ['DIRECCION', 'UBICACION'],
      precioCompraLitroUSD: ['PRECIO_COMPRA_USD', 'PRECIO_COMPRA', 'PRECIO_USD'],
      precioBufalaLitroUSD: ['PRECIO_BUFALA_USD', 'PRECIO_BUFALA'],
      precioAcidaLitroUSD: ['PRECIO_ACIDA_USD', 'PRECIO_ACIDA'],
    },
  },
  BANCOS: {
    id: 'BANCOS',
    titulo: 'Bancos',
    subtitulo: 'Catálogo de entidades bancarias nacionales y sus códigos de 4 dígitos.',
    icono: Building2,
    color: 'from-amber-600 to-orange-600',
    camposRequeridos: ['nombre'],
    columnasPreview: [
      { key: 'codigo', label: 'Código Banco' },
      { key: 'nombre', label: 'Nombre del Banco' },
    ],
    mapeo: {
      codigo: ['CODIGO_BANCO', 'CODIGO', 'COD'],
      nombre: ['NOMBRE_BANCO', 'NOMBRE', 'BANCO'],
    },
  },
};

export const GestionDataPage: React.FC = () => {
  const [entidadActiva, setEntidadActiva] = useState<EntidadData>('FINCAS');
  const [filas, setFilas] = useState<any[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [autoCrearPropietarios, setAutoCrearPropietarios] = useState(true);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = CONFIG_ENTIDADES[entidadActiva];

  // Consulta de prerrequisitos
  const { data: prerequisitos, isLoading: cargandoPrerequisitos, refetch: recargarPrerequisitos } = useQuery({
    queryKey: ['prerequisitos', entidadActiva],
    queryFn: () => dataApi.validarPrerequisitos(entidadActiva),
  });

  const cambiarEntidad = (nueva: EntidadData) => {
    setEntidadActiva(nueva);
    setFilas([]);
    setNombreArchivo(null);
    setResultado(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Procesar archivo Excel/CSV subido
  const procesarArchivo = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonRaw = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonRaw.length === 0) {
          toast.error('El archivo cargado está vacío.');
          return;
        }

        // Mapeo inteligente de columnas
        const filasMapeadas = jsonRaw.map((rawRow, idx) => {
          const rowNormalizado: Record<string, any> = { _filaIdx: idx + 2 };

          // Normalizar encabezados en mayúsculas sin espacios
          const rowClean: Record<string, any> = {};
          Object.keys(rawRow).forEach((k) => {
            const cleanKey = k.trim().toUpperCase().replace(/\s+/g, '_');
            rowClean[cleanKey] = rawRow[k];
          });

          // Mapear cada campo definido en la configuración
          Object.keys(config.mapeo).forEach((campo) => {
            const alias = config.mapeo[campo];
            let valorEncontrado = '';
            for (const col of alias) {
              if (rowClean[col] !== undefined && rowClean[col] !== '') {
                valorEncontrado = rowClean[col];
                break;
              }
            }
            rowNormalizado[campo] = valorEncontrado;
          });

          // Conversión de tipos numéricos
          if (rowNormalizado.precioLitroUSD) rowNormalizado.precioLitroUSD = parseFloat(rowNormalizado.precioLitroUSD) || 0;
          if (rowNormalizado.precioLitroAcidaUSD) rowNormalizado.precioLitroAcidaUSD = parseFloat(rowNormalizado.precioLitroAcidaUSD) || 0;
          if (rowNormalizado.precioCompraLitroUSD) rowNormalizado.precioCompraLitroUSD = parseFloat(rowNormalizado.precioCompraLitroUSD) || 0;
          if (rowNormalizado.precioBufalaLitroUSD) rowNormalizado.precioBufalaLitroUSD = parseFloat(rowNormalizado.precioBufalaLitroUSD) || 0;

          // Booleano
          if (typeof rowNormalizado.tieneDosTiposLeche === 'string') {
            const val = rowNormalizado.tieneDosTiposLeche.toUpperCase();
            rowNormalizado.tieneDosTiposLeche = val === 'SI' || val === 'TRUE' || val === '1';
          }

          // Validación básica
          const tieneNombre = !!(rowNormalizado.nombre && String(rowNormalizado.nombre).trim());
          rowNormalizado._esValida = tieneNombre;

          return rowNormalizado;
        });

        setFilas(filasMapeadas);
        setNombreArchivo(file.name);
        setResultado(null);
        toast.success(`Se leyeron ${filasMapeadas.length} registros del archivo ${file.name}`);
      } catch (err: any) {
        console.error('Error al leer Excel:', err);
        toast.error('Error al procesar el archivo Excel. Verifica su estructura.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
  };

  // Descargar plantilla oficial
  const handleDescargarPlantilla = async (formato: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      toast.loading('Generando plantilla...', { id: 'descarga' });
      const blob = await dataApi.descargarPlantilla(entidadActiva, formato);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Plantilla_Importacion_${entidadActiva}.${formato}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Plantilla descargada correctamente.', { id: 'descarga' });
    } catch (err) {
      toast.error('No se pudo descargar la plantilla.', { id: 'descarga' });
    }
  };

  // Exportar data actual existente a Excel
  const handleExportarActual = async () => {
    try {
      toast.loading('Consultando base de datos y exportando...', { id: 'export' });
      const blob = await dataApi.exportarExcel(entidadActiva);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Data_Actual_${entidadActiva}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Exportación completada exitosamente.', { id: 'export' });
    } catch (err) {
      toast.error('Error al exportar los datos actuales.', { id: 'export' });
    }
  };

  // Enviar data validada a la API
  const handleImportarSubmit = async () => {
    const validas = filas.filter((f) => f._esValida);
    if (validas.length === 0) {
      toast.error('No hay registros válidos para importar.');
      return;
    }

    setImportando(true);
    setResultado(null);

    try {
      let res;
      if (entidadActiva === 'FINCAS') {
        res = await dataApi.importarFincas(validas, autoCrearPropietarios);
      } else if (entidadActiva === 'PROPIETARIOS') {
        res = await dataApi.importarPropietarios(validas);
      } else if (entidadActiva === 'COMPANIAS') {
        res = await dataApi.importarCompanias(validas);
      } else if (entidadActiva === 'BANCOS') {
        res = await dataApi.importarBancos(validas);
      }

      setResultado(res);
      toast.success(`Importación completada: ${res?.insertados || 0} nuevos, ${res?.actualizados || 0} actualizados.`);
      recargarPrerequisitos();
    } catch (err: any) {
      console.error('Error en importación:', err);
      toast.error(err.message || 'Ocurrió un error al importar los datos en el servidor.');
    } finally {
      setImportando(false);
    }
  };

  const filasValidasCount = filas.filter((f) => f._esValida).length;
  const filasInvalidasCount = filas.length - filasValidasCount;

  return (
    <div className="space-y-6">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Gestión de Data (Excel &amp; CSV)</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Carga y exportación masiva para poblar catálogos y migrar información oficial.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Globales: Exportar / Descargar Plantilla */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportarActual}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Download size={14} />
            <span>Exportar Data Actual</span>
          </button>

          <button
            type="button"
            onClick={() => handleDescargarPlantilla('xlsx')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Download size={14} />
            <span>Descargar Plantilla (.XLSX)</span>
          </button>
        </div>
      </div>

      {/* Selector de Entidades (Pestañas) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(CONFIG_ENTIDADES) as EntidadData[]).map((key) => {
          const item = CONFIG_ENTIDADES[key];
          const isSelected = entidadActiva === key;
          const Icon = item.icono;

          return (
            <button
              key={key}
              type="button"
              onClick={() => cambiarEntidad(key)}
              className={`p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                isSelected
                  ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/10'
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{item.titulo}</h3>
                  <span className="text-[11px] text-slate-400 font-medium">Catálogo Oficial</span>
                </div>
              </div>
              {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
            </button>
          );
        })}
      </div>

      {/* Alerta de Prerrequisitos */}
      {cargandoPrerequisitos ? (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-slate-400" />
          <span>Verificando dependencias y prerrequisitos en la base de datos...</span>
        </div>
      ) : prerequisitos?.prerequisitos?.length ? (
        <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-extrabold text-blue-900 mb-2">
            <Info size={16} className="text-blue-600" />
            <span>Estado de Prerrequisitos en Base de Datos</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {prerequisitos.prerequisitos.map((p, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  p.cumplido ? 'bg-white border-emerald-200 text-emerald-800' : 'bg-white border-amber-200 text-amber-800'
                }`}
              >
                <div>
                  <span className="font-bold block">{p.nombre}</span>
                  <span className="text-[11px] text-slate-500">{p.mensaje}</span>
                </div>
                {p.cumplido ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-amber-500" />}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Zona de Carga de Archivo (Dropzone) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
          id="fileUploadData"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-blue-50/20 transition cursor-pointer group"
        >
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xs text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition">
            <Upload size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {nombreArchivo ? nombreArchivo : 'Haz clic para seleccionar o arrastra tu archivo Excel / CSV'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Formatos soportados: <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong> con la plantilla de {config.titulo}.
          </p>
        </div>

        {/* Opciones Adicionales */}
        {entidadActiva === 'FINCAS' && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCrearPropietarios}
                onChange={(e) => setAutoCrearPropietarios(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Crear automáticamente propietarios no existentes detectados en las fincas</span>
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Recomendado</span>
          </div>
        )}
      </div>

      {/* Resultados de Importación Previa */}
      {resultado && (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <FileCheck size={18} className="text-emerald-600" />
            <span>Resultado de la Operación</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-xl font-black text-emerald-700">{resultado.insertados ?? 0}</span>
              <span className="text-xs font-bold text-emerald-800 block mt-0.5">Insertados</span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <span className="text-xl font-black text-blue-700">{resultado.actualizados ?? 0}</span>
              <span className="text-xs font-bold text-blue-800 block mt-0.5">Actualizados</span>
            </div>
            {resultado.propietariosAutoCreados !== undefined && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <span className="text-xl font-black text-purple-700">{resultado.propietariosAutoCreados ?? 0}</span>
                <span className="text-xs font-bold text-purple-800 block mt-0.5">Dueños Auto-creados</span>
              </div>
            )}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-xl font-black text-slate-700">{(resultado.insertados ?? 0) + (resultado.actualizados ?? 0)}</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">Total Procesados</span>
            </div>
          </div>

          {resultado.errores?.length > 0 && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <AlertCircle size={14} />
                <span>Observaciones o Filas Omitidas ({resultado.errores.length}):</span>
              </div>
              <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside max-h-40 overflow-y-auto">
                {resultado.errores.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tabla de Previsualización */}
      {filas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Barra de control de la tabla */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">
                Previsualización: <strong className="text-slate-900">{filas.length}</strong> registros leídos
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {filasValidasCount} listos
              </span>
              {filasInvalidasCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  {filasInvalidasCount} con errores
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilas([]);
                  setNombreArchivo(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Limpiar</span>
              </button>

              <button
                type="button"
                onClick={handleImportarSubmit}
                disabled={importando || filasValidasCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-500/25 transition disabled:opacity-60 cursor-pointer"
              >
                {importando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Guardando en BD...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirmar e Importar {filasValidasCount} Registros</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tabla de Datos */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-20 text-center">Estado</th>
                  {config.columnasPreview.map((col) => (
                    <th key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f, i) => (
                  <tr key={i} className={`hover:bg-slate-50/80 transition ${!f._esValida ? 'bg-rose-50/40' : ''}`}>
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{f._filaIdx}</td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {f._esValida ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Sin nombre
                        </span>
                      )}
                    </td>
                    {config.columnasPreview.map((col) => (
                      <td key={col.key} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {col.key === 'precioLitroUSD' || col.key === 'precioCompraLitroUSD' ? (
                          <span className="font-semibold text-emerald-700">
                            ${Number(f[col.key] || 0).toFixed(4)}
                          </span>
                        ) : (
                          String(f[col.key] || '-')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionDataPage;
