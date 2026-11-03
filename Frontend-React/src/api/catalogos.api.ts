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

export const catalogosApi = {
  // FINCAS
  getFincas: async (soloActivos = false): Promise<FincaDto[]> => {
    const res = await apiClient.get<FincaDto[]>('/catalogos/fincas', { params: { soloActivos } });
    return Array.isArray(res.data) ? res.data : [];
  },
  getFincaPorId: async (id: number): Promise<FincaDto> => {
    const res = await apiClient.get<FincaDto>(`/catalogos/fincas/${id}`);
    return res.data;
  },
  crearFinca: async (dto: GuardarFincaDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/catalogos/fincas', dto);
    return res.data;
  },
  actualizarFinca: async (id: number, dto: GuardarFincaDto): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/catalogos/fincas/${id}`, dto);
    return res.data;
  },
  eliminarFinca: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/catalogos/fincas/${id}`);
    return res.data;
  },
  actualizarPreciosMasivo: async (nuevoPrecioUSD: number, tipoLeche?: string): Promise<{ affectedRows: number; message: string }> => {
    const res = await apiClient.post('/catalogos/fincas/actualizar-precios-masivo', { nuevoPrecioUSD, tipoLeche });
    return res.data;
  },

  // PROPIETARIOS
  getPropietarios: async (): Promise<PropietarioDto[]> => {
    const res = await apiClient.get<PropietarioDto[]>('/propietarios');
    return Array.isArray(res.data) ? res.data : [];
  },
  crearPropietario: async (dto: CrearPropietarioDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/propietarios', dto);
    return res.data;
  },
  actualizarPropietario: async (id: number, dto: CrearPropietarioDto): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/propietarios/${id}`, dto);
    return res.data;
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
  actualizarPrecioCompania: async (id: number, nuevoPrecioUSD: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/catalogos/companias/${id}/precio`, { precioLitroUSD: nuevoPrecioUSD });
    return res.data;
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

