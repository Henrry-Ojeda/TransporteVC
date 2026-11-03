import apiClient from './client';
import type {
  CicloSemanalDto,
  PreliquidacionFincaDto,
  AdelantoDto,
  AbonoCompaniaDto,
  PagoPersonalDto,
} from '@/types';

export const finanzasApi = {
  // SEMANAS / CICLOS
  getCiclos: async (): Promise<CicloSemanalDto[]> => {
    const res = await apiClient.get<CicloSemanalDto[]>('/ciclos');
    return Array.isArray(res.data) ? res.data : [];
  },
  getCicloActivo: async (): Promise<CicloSemanalDto> => {
    const res = await apiClient.get<CicloSemanalDto>('/catalogos/ciclo-activo');
    return res.data;
  },
  crearCiclo: async (dto: { numeroSemana: number; año: number; fechaInicio: string; fechaFin: string; codigo?: string }): Promise<{ id: number; message: string }> => {
    const payload = {
      ...dto,
      codigo: dto.codigo || `Semana #${dto.numeroSemana} (${dto.año})`,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
    };
    const res = await apiClient.post('/ciclos', payload);
    return res.data;
  },
  cerrarCiclo: async (id: number, tasaBCV: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/ciclos/${id}/cerrar`, { tasaBCV });
    return res.data;
  },

  // PRELIQUIDACIÓN & LIQUIDACIÓN
  getPreliquidacion: async (cicloId?: number): Promise<PreliquidacionFincaDto[]> => {
    const params: Record<string, any> = {};
    if (cicloId) params.cicloId = cicloId;
    const res = await apiClient.get<PreliquidacionFincaDto[]>('/catalogos/preliquidacion', { params });
    return Array.isArray(res.data) ? res.data : [];
  },
  pagarPreliquidacion: async (dto: { fincaId: number; cicloId: number; referenciaPago: string; montoUSD: number; montoBs: number; tasaBCV: number }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/catalogos/pre-liquidacion/pagar', dto);
    return res.data;
  },
  actualizarTasaPendientes: async (cicloId: number, nuevaTasa: number): Promise<{ affectedRows: number; message: string }> => {
    const res = await apiClient.post('/catalogos/pre-liquidacion/actualizar-tasa-pendientes', { cicloId, nuevaTasa });
    return res.data;
  },

  // ADELANTOS
  getAdelantos: async (tipoEntidad?: string, fincaId?: number, usuarioId?: number): Promise<AdelantoDto[]> => {
    const params: Record<string, any> = {};
    if (tipoEntidad) params.tipoEntidad = tipoEntidad;
    if (fincaId) params.fincaId = fincaId;
    if (usuarioId) params.usuarioId = usuarioId;
    const res = await apiClient.get<AdelantoDto[]>('/adelantos', { params });
    return Array.isArray(res.data) ? res.data : [];
  },
  crearAdelanto: async (dto: { tipoEntidad: string; fincaId?: number; usuarioId?: number; montoUSD: number; fecha: string; motivo?: string }): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/adelantos', dto);
    return res.data;
  },
  amortizarAdelanto: async (id: number, montoUSD: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/adelantos/${id}/amortizar`, { montoUSD });
    return res.data;
  },
  eliminarAdelanto: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/adelantos/${id}`);
    return res.data;
  },

  // ABONOS COMPAÑÍAS
  getAbonosCompanias: async (companiaId?: number): Promise<AbonoCompaniaDto[]> => {
    const params: Record<string, any> = {};
    if (companiaId) params.companiaId = companiaId;
    const res = await apiClient.get<AbonoCompaniaDto[]>('/catalogos/companias/abonos', { params }).catch(() => ({ data: [] }));
    return Array.isArray(res.data) ? res.data : [];
  },
  crearAbonoCompania: async (dto: { companiaId: number; fecha: string; montoUSD: number; referenciaBancaria: string; observaciones?: string }): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/catalogos/companias/abonos', dto);
    return res.data;
  },

  // PAGOS PERSONAL & CHOFERES
  getPagosPersonal: async (usuarioId?: number): Promise<PagoPersonalDto[]> => {
    const params: Record<string, any> = {};
    if (usuarioId) params.usuarioId = usuarioId;
    const res = await apiClient.get<PagoPersonalDto[]>('/pagosusuarios', { params });
    return Array.isArray(res.data) ? res.data : [];
  },
  crearPagoPersonal: async (dto: { usuarioId: number; fecha: string; montoUSD: number; tipoPago: string; descripcion?: string; referenciaBancaria?: string }): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/pagosusuarios', dto);
    return res.data;
  },
};

