import apiClient from './client';
import type {
  ControlRutaDto,
  ControlRutaFincaDto,
  ControlRutaEntregaDto,
  RutaLogisticaDto,
  DespachoCompaniaDto,
  BalanceVolumetricoResumenDto,
  ControlTanquesDiarioDto,
} from '@/types';

export const operacionesApi = {
  // CONTROL DE RUTAS / VIAJES / TICKETS
  getControles: async (fecha?: string, choferId?: number, estado?: string): Promise<ControlRutaDto[]> => {
    const params: Record<string, any> = {};

    if (fecha) params.fecha = fecha;
    if (choferId) params.choferId = choferId;
    if (estado) params.estado = estado;
    const res = await apiClient.get<ControlRutaDto[]>('/controlrutas', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getControlPorId: async (id: number): Promise<ControlRutaDto> => {
    const res = await apiClient.get<ControlRutaDto>(`/controlrutas/${id}`);
    return res.data;
  },

  iniciarViaje: async (dto: { fecha?: string; camionId?: number; choferId?: number; conductorId?: number; rutaLogisticaId?: number; rutasLogisticasIds?: number[]; odometroInicialKm?: number; observaciones?: string; observacion?: string }): Promise<{ id: number; message: string }> => {
    const payload = {
      fecha: dto.fecha || undefined,
      camionId: dto.camionId || undefined,
      conductorId: dto.conductorId || dto.choferId || undefined,
      choferId: dto.choferId || dto.conductorId || undefined,
      rutaLogisticaId: dto.rutaLogisticaId || undefined,
      rutasLogisticasIds: dto.rutasLogisticasIds || undefined,
      odometroInicialKm: dto.odometroInicialKm || undefined,
      observacion: dto.observacion || dto.observaciones || undefined,
      observaciones: dto.observaciones || dto.observacion || undefined,
    };

    const res = await apiClient.post('/controlrutas/iniciar-viaje', payload);
    return res.data;
  },

  cambiarEstadoProceso: async (id: number, nuevoEstado: string, motivo?: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/controlrutas/${id}/proceso`, { nuevoEstado, motivo });
    return res.data;
  },

  agregarFincaViaje: async (id: number, dto: { fincaId: number; litrosLeche: number; temperatura?: number; tipoLeche?: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/controlrutas/${id}/fincas`, dto);
    return res.data;
  },

  getFincasViaje: async (id: number): Promise<ControlRutaFincaDto[]> => {
    const res = await apiClient.get<ControlRutaFincaDto[]>(`/controlrutas/${id}/fincas`);
    return Array.isArray(res.data) ? res.data : [];
  },

  entregarDirectoCompania: async (id: number, dto: { companiaId: number; litrosEntregados: number; ticketReceptoria?: string; observaciones?: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/controlrutas/${id}/entregar-compania-directo`, dto);
    return res.data;
  },

  getEntregasViaje: async (id: number): Promise<ControlRutaEntregaDto[]> => {
    const res = await apiClient.get<ControlRutaEntregaDto[]>(`/controlrutas/${id}/entregas`);
    return Array.isArray(res.data) ? res.data : [];
  },

  cerrarViaje: async (id: number, dto: { odometroFinalKm?: number; observaciones?: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/controlrutas/${id}/cerrar-viaje`, dto);
    return res.data;
  },

  eliminarControl: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/controlrutas/${id}`);
    return res.data;
  },

  // RUTAS LOGÍSTICAS
  getRutasLogistica: async (): Promise<RutaLogisticaDto[]> => {
    try {
      const res = await apiClient.get<RutaLogisticaDto[]>('/rutas-logistica');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      const res = await apiClient.get<RutaLogisticaDto[]>('/rutaslogistica');
      return Array.isArray(res.data) ? res.data : [];
    }
  },

  crearRutaLogistica: async (dto: { nombre: string; descripcion?: string; camionPredeterminadoId?: number; choferPredeterminadoId?: number }): Promise<{ id: number; message: string }> => {
    try {
      const res = await apiClient.post('/rutas-logistica', dto);
      return res.data;
    } catch {
      const res = await apiClient.post('/rutaslogistica', dto);
      return res.data;
    }
  },

  actualizarRutaLogistica: async (id: number, dto: { nombre: string; descripcion?: string; camionPredeterminadoId?: number; choferPredeterminadoId?: number; activo?: boolean }): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await apiClient.put(`/rutas-logistica/${id}`, dto);
      return res.data;
    } catch {
      const res = await apiClient.put(`/rutaslogistica/${id}`, dto);
      return res.data;
    }
  },

  asignarFincasARuta: async (id: number, fincaIds: number[]): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await apiClient.post(`/rutas-logistica/${id}/fincas`, { fincaIds });
      return res.data;
    } catch {
      const res = await apiClient.post(`/rutaslogistica/${id}/fincas`, { fincaIds });
      return res.data;
    }
  },

  eliminarRutaLogistica: async (id: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await apiClient.delete(`/rutas-logistica/${id}`);
      return res.data;
    } catch {
      const res = await apiClient.delete(`/rutaslogistica/${id}`);
      return res.data;
    }
  },

  // CONTROL COMPAÑÍAS / RECEPTORÍA
  getDespachosCompanias: async (fecha?: string, companiaId?: number): Promise<DespachoCompaniaDto[]> => {
    const params: Record<string, any> = {};

    if (fecha) params.fecha = fecha;
    if (companiaId) params.companiaId = companiaId;
    const res = await apiClient.get<DespachoCompaniaDto[]>('/controlcompanias', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  crearDespachoCompania: async (dto: {
    fecha?: string;
    camionId?: number;
    usuarioId?: number;
    companiaId: number;
    litrosDespachados: number;
    tipoLeche: string;
    numeroGuiaSADA?: string;
    observaciones?: string;
    observacion?: string;
  }): Promise<{ id: number; message: string }> => {
    const payload = {
      ...dto,
      observacion: dto.observacion || dto.observaciones || '',
    };

    const res = await apiClient.post('/controlcompanias', payload);
    return res.data;
  },

  actualizarDespachoCompania: async (id: number, dto: any): Promise<{ message: string }> => {
    const res = await apiClient.put('/controlcompanias/' + id, dto);
    return res.data;
  },

  validarEntregaCompania: async (id: number, dto: { litrosConfirmados: number; observaciones?: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/controlcompanias/${id}/validar-entrega`, dto);
    return res.data;
  },

  // TRAZABILIDAD BÚFALA
  getTrazabilidadBufala: async (fechaInicio?: string, fechaFin?: string): Promise<any[]> => {
    const params: Record<string, any> = {};

    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    const res = await apiClient.get<any[]>('/controlcompanias/trazabilidad-bufala', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  // RECEPTORIA HOY / ENTREGAS
  getEntregasHoy: async (fecha?: string): Promise<any[]> => {
    const params: Record<string, any> = {};

    if (fecha) params.fecha = fecha;
    const res = await apiClient.get<any[]>('/receptoria/hoy', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getRutasHoy: async (fecha?: string): Promise<any[]> => {
    const params: Record<string, any> = {};

    if (fecha) params.fecha = fecha;
    const res = await apiClient.get<any[]>('/rutas/hoy', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  guardarEntrega: async (dto: { fecha: string; usuarioId: number; companiaId: number; litros: number; observacion?: string }): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/receptoria', dto);
    return res.data;
  },

  eliminarEntrega: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/receptoria/${id}`);
    return res.data;
  },

  // GESTIÓN OPERATIVA DE VIAJES / TICKETS
  enviarAReceptoria: async (id: number, observacion?: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/controlrutas/${id}/enviar-receptoria`, { observacion });
    return res.data;
  },

  enviarACompania: async (id: number, dto: { companiaId?: number; choferId?: number; litrosDespachados?: number; observacion?: string; destinos?: { companiaId: number; litros: number; tipoLeche: string }[] }): Promise<{ success: boolean; message: string; controlCompaniaId?: number }> => {
    const res = await apiClient.post(`/controlrutas/${id}/enviar-compania`, dto);
    return res.data;
  },

  traspasarLeche: async (id: number, dto: { ticketDestinoId?: number; choferDestinoId?: number; fechaDestino?: string; litrosTraspaso?: number; observacion?: string }): Promise<any> => {
    const res = await apiClient.post(`/controlrutas/${id}/traspasar-leche`, dto);
    return res.data;
  },

  editarRecoleccion: async (id: number, dto: { fincaId?: number; litros?: number; tipoLeche?: string; esAcida?: boolean; observacion?: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/rutas/${id}`, dto);
    return res.data;
  },

  eliminarRecoleccion: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/rutas/${id}`);
    return res.data;
  },

  // BALANCE LECHE / MERMAS
  getMermasHoy: async (fechaInicio?: string, fechaFin?: string, choferId?: number): Promise<BalanceVolumetricoResumenDto> => {
    const params: Record<string, any> = {};

    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    if (choferId) params.choferId = choferId;
    const res = await apiClient.get<BalanceVolumetricoResumenDto>('/catalogos/mermas', { params });
    return res.data;
  },

  // CONTROL DIARIO DE TANQUES / SILOS
  getControlTanquesDiario: async (fecha?: string): Promise<ControlTanquesDiarioDto | null> => {
    try {
      const params: Record<string, any> = {};
      if (fecha) params.fecha = fecha;
      const res = await apiClient.get<ControlTanquesDiarioDto>('/receptoria/control-tanques-diario', { params });
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  guardarControlTanquesDiario: async (dto: ControlTanquesDiarioDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/receptoria/control-tanques-diario', dto);
    return res.data;
  },

  confirmarAperturaTanques: async (fecha: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/receptoria/control-tanques-diario/confirmar-apertura', { fecha });
    return res.data;
  },

  confirmarCierreTanques: async (fecha: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/receptoria/control-tanques-diario/confirmar-cierre', { fecha });
    return res.data;
  },
};


