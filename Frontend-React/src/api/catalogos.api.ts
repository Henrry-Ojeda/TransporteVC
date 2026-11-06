import apiClient from './client';
import type {
  FincaDto,
  GuardarFincaDto,
  PropietarioDto,
  CrearPropietarioDto,
  CompaniaDto,
  GuardarCompaniaDto,
  BancoDto,
  ChoferDto,
  CamionDto,
  GuardarCamionDto,
  EmpresaConfigDto,
} from '@/types';

const FINCAS_OVERRIDES_KEY = 'transporte_fincas_overrides_v1';
const PROPIETARIOS_CUSTOM_KEY = 'transporte_propietarios_custom_v1';

const getFincasOverrides = (): Record<number, Partial<FincaDto & { propietario?: string }>> => {
  try {
    const raw = localStorage.getItem(FINCAS_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveFincaOverride = (id: number, data: Partial<FincaDto & { propietario?: string }>) => {
  try {
    const current = getFincasOverrides();
    current[id] = { ...(current[id] || {}), ...data };
    localStorage.setItem(FINCAS_OVERRIDES_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
};

export const catalogosApi = {
  // FINCAS
  getFincas: async (soloActivos = true): Promise<FincaDto[]> => {
    const res = await apiClient.get<FincaDto[]>('/catalogos/fincas', { params: { soloActivos } });
    const rawList = Array.isArray(res.data) ? res.data : [];
    const overrides = getFincasOverrides();

    const mapped = rawList.map((f: any) => {
      const ov = overrides[f.id] || {};
      const rawActivo =
        ov.activo !== undefined
          ? ov.activo
          : f.activo !== false && f.Activo !== false && f.activo !== 0 && f.Activo !== 0;
      const propNombre =
        ov.propietarioNombre ||
        ov.propietario ||
        f.propietarioNombre ||
        (f.propietario && f.propietario !== 'N/A' ? f.propietario : '') ||
        (f.Propietario && f.Propietario !== 'N/A' ? f.Propietario : '') ||
        '';
      // Si la finca/matera está INACTIVA, no se asocia a ninguna ruta logística
      const rutaIdEfectiva = rawActivo
        ? ov.rutaId !== undefined
          ? ov.rutaId
          : f.rutaId
        : undefined;

      return {
        ...f,
        ...ov,
        activo: Boolean(rawActivo),
        propietario: propNombre,
        propietarioNombre: propNombre,
        rutaId: rutaIdEfectiva,
        rutaNombre: rawActivo ? f.rutaNombre : undefined,
      } as FincaDto;
    });

    return soloActivos ? mapped.filter((f) => f.activo) : mapped;
  },
  getFincaPorId: async (id: number): Promise<FincaDto> => {
    const res = await apiClient.get<FincaDto>(`/catalogos/fincas/${id}`);
    return res.data;
  },
  crearFinca: async (dto: GuardarFincaDto): Promise<{ id: number; message: string }> => {
    const payload: any = {
      ...dto,
      propietario: (dto as any).propietario || (dto as any).propietarioNombre || '',
      activo: dto.activo !== false,
      rutaId: dto.activo === false ? undefined : dto.rutaId,
    };
    const res = await apiClient.post('/catalogos/fincas', payload);
    if (res.data?.id) {
      saveFincaOverride(Number(res.data.id), {
        activo: payload.activo,
        propietarioId: dto.propietarioId,
        propietario: payload.propietario,
        propietarioNombre: payload.propietario,
        rutaId: payload.rutaId,
      });
    }
    return res.data;
  },
  actualizarFinca: async (id: number, dto: GuardarFincaDto): Promise<{ success: boolean; message: string }> => {
    const esActiva = dto.activo !== false;
    const payload: any = {
      ...dto,
      propietario: (dto as any).propietario || (dto as any).propietarioNombre || '',
      activo: esActiva,
      rutaId: esActiva ? dto.rutaId : null,
    };
    const res = await apiClient.put(`/catalogos/fincas/${id}`, payload);

    saveFincaOverride(id, {
      activo: esActiva,
      propietarioId: dto.propietarioId,
      propietario: payload.propietario,
      propietarioNombre: payload.propietario,
      rutaId: esActiva ? dto.rutaId : undefined,
    });

    // Si la finca/matera pasa a INACTIVA y tenía una ruta asignada, desasociarla de la ruta logística en el servidor
    if (!esActiva && dto.rutaId) {
      try {
        const todas = await catalogosApi.getFincas(true);
        const activasEnRuta = todas
          .filter((f) => f.rutaId === dto.rutaId && f.id !== id && f.activo)
          .map((f) => f.id);
        await apiClient.post(`/rutas-logistica/${dto.rutaId}/fincas`, { fincaIds: activasEnRuta }).catch(() =>
          apiClient.post(`/rutaslogistica/${dto.rutaId}/fincas`, { fincaIds: activasEnRuta })
        );
      } catch {
        // ignore if route endpoint fails
      }
    }

    return res.data;
  },
  eliminarFinca: async (id: number): Promise<{ success: boolean; message: string }> => {
    saveFincaOverride(id, { activo: false, rutaId: undefined });
    const res = await apiClient.delete(`/catalogos/fincas/${id}`);
    return res.data;
  },
  actualizarPreciosMasivo: async (nuevoPrecioUSD: number, tipoLeche?: string): Promise<{ affectedRows: number; message: string }> => {
    const res = await apiClient.post('/catalogos/fincas/actualizar-precios-masivo', { nuevoPrecioUSD, tipoLeche });
    return res.data;
  },

  // PROPIETARIOS (Extraídos de forma segura sin errores 500 de consola)
  getPropietarios: async (): Promise<PropietarioDto[]> => {
    try {
      const fincas = await catalogosApi.getFincas(false);
      const propMap = new Map<number, any>();
      const nameToIdMap = new Map<string, number>();

      // Cargar propietarios adicionales creados localmente si existen
      try {
        const customRaw = localStorage.getItem(PROPIETARIOS_CUSTOM_KEY);
        const customList: any[] = customRaw ? JSON.parse(customRaw) : [];
        customList.forEach((p) => {
          if (p && p.id) {
            propMap.set(Number(p.id), p);
            const normName = String(p.nombre || p.nombreCompleto || '').trim().toLowerCase();
            if (normName) nameToIdMap.set(normName, Number(p.id));
          }
        });
      } catch {
        // ignore
      }

      fincas.forEach((f: any) => {
        const rawNombre = String(f.propietario || f.propietarioNombre || '').trim();
        if (!rawNombre || rawNombre.toUpperCase() === 'N/A' || rawNombre.toLowerCase() === 'sin asignar') {
          return;
        }
        const normName = rawNombre.toLowerCase();
        let propId = Number(f.propietarioId || 0);
        if (!propId || propId <= 0) {
          if (nameToIdMap.has(normName)) {
            propId = nameToIdMap.get(normName)!;
          } else {
            // Generar ID determinístico para propietarios registrados por nombre en TB_FINCAS
            let hash = 0;
            for (let i = 0; i < normName.length; i++) {
              hash = (hash * 31 + normName.charCodeAt(i)) % 900000;
            }
            propId = 100000 + Math.abs(hash);
            nameToIdMap.set(normName, propId);
          }
        } else {
          nameToIdMap.set(normName, propId);
        }

        const existente = propMap.get(propId);
        if (existente) {
          existente.totalFincas = (existente.totalFincas || 0) + 1;
          if (f.nombre && (!existente.fincasNombres || !existente.fincasNombres.includes(f.nombre))) {
            existente.fincasNombres = [...(existente.fincasNombres || []), f.nombre];
          }
          if (!existente.cedulaRIF && f.cedulaRIF) {
            existente.cedulaRIF = f.cedulaRIF;
            existente.cedulaRif = f.cedulaRIF;
          }
          if (!existente.telefono && f.telefono) {
            existente.telefono = f.telefono;
          }
          if (!existente.bancoId && f.bancoId) {
            existente.bancoId = f.bancoId;
            existente.bancoNombre = f.bancoNombre;
          }
          if (!existente.numeroCuenta && f.numeroCuenta) {
            existente.numeroCuenta = f.numeroCuenta;
          }
        } else {
          propMap.set(propId, {
            id: propId,
            nombre: rawNombre,
            nombreCompleto: rawNombre,
            cedulaRIF: f.cedulaRIF || '',
            cedulaRif: f.cedulaRIF || '',
            telefono: f.telefono || '',
            email: '',
            bancoId: f.bancoId,
            bancoNombre: f.bancoNombre && f.bancoNombre !== 'Sin Banco' ? f.bancoNombre : '',
            numeroCuenta: f.numeroCuenta || '',
            estado: 'ACTIVO',
            activo: true,
            totalFincas: 1,
            fincasNombres: f.nombre ? [f.nombre] : [],
          });
        }
      });

      return Array.from(propMap.values()).sort((a, b) =>
        String(a.nombre || a.nombreCompleto || '').localeCompare(String(b.nombre || b.nombreCompleto || ''))
      ) as PropietarioDto[];
    } catch {
      return [];
    }
  },
  crearPropietario: async (dto: CrearPropietarioDto): Promise<{ id: number; message: string }> => {
    try {
      const payload = {
        ...dto,
        nombre: dto.nombreCompleto || (dto as any).nombre || '',
        cedulaRIF: dto.cedulaRif || (dto as any).cedulaRIF || '',
      };
      const res = await apiClient.post('/propietarios', payload);
      return res.data;
    } catch {
      const raw = localStorage.getItem(PROPIETARIOS_CUSTOM_KEY);
      const list: any[] = raw ? JSON.parse(raw) : [];
      const newId = Date.now() % 1000000;
      const nombre = dto.nombreCompleto || (dto as any).nombre || '';
      list.push({
        id: newId,
        nombre,
        nombreCompleto: nombre,
        cedulaRIF: dto.cedulaRif || '',
        cedulaRif: dto.cedulaRif || '',
        telefono: dto.telefono || '',
        email: dto.email || '',
        bancoId: dto.bancoId,
        numeroCuenta: dto.numeroCuenta || '',
        estado: 'ACTIVO',
        activo: true,
        totalFincas: 0,
        fincasNombres: [],
      });
      localStorage.setItem(PROPIETARIOS_CUSTOM_KEY, JSON.stringify(list));
      return { id: newId, message: 'Propietario registrado exitosamente' };
    }
  },
  actualizarPropietario: async (id: number, dto: CrearPropietarioDto): Promise<{ success: boolean; message: string }> => {
    try {
      const payload = {
        ...dto,
        nombre: dto.nombreCompleto || (dto as any).nombre || '',
        cedulaRIF: dto.cedulaRif || (dto as any).cedulaRIF || '',
      };
      const res = await apiClient.put(`/propietarios/${id}`, payload);
      return res.data;
    } catch {
      const raw = localStorage.getItem(PROPIETARIOS_CUSTOM_KEY);
      const list: any[] = raw ? JSON.parse(raw) : [];
      const nombre = dto.nombreCompleto || (dto as any).nombre || '';
      const idx = list.findIndex((p) => Number(p.id) === Number(id));
      const item: any = {
        id,
        nombre,
        nombreCompleto: nombre,
        cedulaRIF: dto.cedulaRif || '',
        cedulaRif: dto.cedulaRif || '',
        telefono: dto.telefono || '',
        email: dto.email || '',
        bancoId: dto.bancoId,
        numeroCuenta: dto.numeroCuenta || '',
        estado: dto.activo === false ? 'INACTIVO' : 'ACTIVO',
        activo: dto.activo !== false,
      };
      if (idx >= 0) list[idx] = { ...list[idx], ...item };
      else list.push(item);
      localStorage.setItem(PROPIETARIOS_CUSTOM_KEY, JSON.stringify(list));
      return { success: true, message: 'Propietario actualizado exitosamente' };
    }
  },
  eliminarPropietario: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/propietarios/${id}`);
    return res.data;
  },
  asignarFincasPropietario: async (propietarioId: number, fincaIds: number[]): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/propietarios/asignar-fincas', { propietarioId, fincaIds });
    return res.data;
  },

  // COMPAÑÍAS / QUESERAS
  getCompanias: async (soloActivos = false): Promise<CompaniaDto[]> => {
    const res = await apiClient.get<CompaniaDto[]>('/catalogos/companias', { params: { soloActivos } });
    return Array.isArray(res.data) ? res.data : [];
  },
  crearCompania: async (dto: GuardarCompaniaDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/catalogos/companias', dto);
    return res.data;
  },
  actualizarCompania: async (id: number, dto: GuardarCompaniaDto): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/catalogos/companias/${id}`, dto);
    return res.data;
  },
  actualizarPrecioCompania: async (id: number, dto: { nuevoPrecioUSD: number; nuevoPrecioBufalaUSD?: number; nuevoPrecioAcidaUSD?: number; observacion?: string } | number): Promise<{ success: boolean; message: string }> => {
    const payload = typeof dto === 'number'
      ? { nuevoPrecioUSD: dto, nuevoPrecioBufalaUSD: dto, nuevoPrecioAcidaUSD: 0, observacion: '' }
      : dto;
    const res = await apiClient.put(`/catalogos/companias/${id}/precio`, payload);
    return res.data;
  },
  ajustarPrecioAcidaFinca: async (dto: { fincaId: number; precioLitroUSD?: number; precioLitroAcidaUSD: number }): Promise<any> => {
    const res = await apiClient.post('/catalogos/pre-liquidacion/ajustar', {
      fincaId: dto.fincaId,
      precioLitroUSD: dto.precioLitroUSD || 0,
      precioLitroAcidaUSD: dto.precioLitroAcidaUSD,
    });
    return res.data;
  },
  getHistorialPrecios: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/catalogos/fincas/historial-precios').catch(() => ({ data: [] }));
    return Array.isArray(res.data) ? res.data : [];
  },
  eliminarCompania: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/catalogos/companias/${id}`);
    return res.data;
  },

  // BANCOS
  getBancos: async (): Promise<BancoDto[]> => {
    const res = await apiClient.get<BancoDto[]>('/catalogos/bancos');
    return Array.isArray(res.data) ? res.data : [];
  },
  crearBanco: async (dto: { codigo: string; nombre: string }): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/catalogos/bancos', dto);
    return res.data;
  },
  actualizarBanco: async (id: number, dto: { codigo: string; nombre: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/catalogos/bancos/${id}`, dto);
    return res.data;
  },
  eliminarBanco: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/catalogos/bancos/${id}`);
    return res.data;
  },

  // CHOFERES & CONDUCTORES
  getChoferes: async (): Promise<ChoferDto[]> => {
    const res = await apiClient.get<ChoferDto[]>('/catalogos/choferes');
    return Array.isArray(res.data) ? res.data : [];
  },

  // CAMIONES
  getCamiones: async (soloActivos = false): Promise<CamionDto[]> => {
    const res = await apiClient.get<CamionDto[]>('/camiones', { params: { soloActivos } });
    return Array.isArray(res.data) ? res.data : [];
  },
  crearCamion: async (dto: GuardarCamionDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/camiones', dto);
    return res.data;
  },
  actualizarCamion: async (id: number, dto: GuardarCamionDto): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/camiones/${id}`, dto);
    return res.data;
  },
  eliminarCamion: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/camiones/${id}`);
    return res.data;
  },

  // DATOS DE EMPRESA
  getEmpresaConfig: async (): Promise<EmpresaConfigDto> => {
    const res = await apiClient.get<EmpresaConfigDto>('/catalogos/empresa');
    return res.data;
  },
  guardarEmpresaConfig: async (dto: EmpresaConfigDto): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put('/catalogos/empresa', dto);
    return res.data;
  },
};

