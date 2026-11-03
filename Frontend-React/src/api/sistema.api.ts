import apiClient from './client';
import type {
  UsuarioDto,
  GuardarUsuarioDto,
  PermisoModuloDto,
} from '@/types';

export const sistemaApi = {
  // USUARIOS
  getUsuarios: async (rol?: string, soloActivos = false): Promise<UsuarioDto[]> => {
    const params: Record<string, any> = { soloActivos };
    if (rol) params.rol = rol;
    const res = await apiClient.get<UsuarioDto[]>('/usuarios', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getUsuarioPorId: async (id: number): Promise<UsuarioDto> => {
    const res = await apiClient.get<UsuarioDto>(`/usuarios/${id}`);
    return res.data;
  },

  crearUsuario: async (dto: GuardarUsuarioDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/usuarios', dto);
    return res.data;
  },

  actualizarUsuario: async (id: number, dto: Partial<GuardarUsuarioDto>): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/usuarios/${id}`, dto);
    return res.data;
  },

  actualizarPassword: async (id: number, passwordActual: string, nuevoPassword: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/usuarios/${id}/password`, { passwordActual, nuevoPassword });
    return res.data;
  },

  eliminarUsuario: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/usuarios/${id}`);
    return res.data;
  },

  // PERMISOS & ROLES RBAC
  getMatrizPermisos: async (): Promise<PermisoModuloDto[]> => {
    const res = await apiClient.get<PermisoModuloDto[]>('/permisos/matriz');
    return Array.isArray(res.data) ? res.data : [];
  },

  actualizarPermisoRol: async (rol: string, moduloCodigo: string, acciones: { puedeVer: boolean; puedeEditar: boolean; puedeAgregar: boolean; puedeEliminar: boolean }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put('/permisos/rol-modulo', { rol, moduloCodigo, ...acciones });
    return res.data;
  },

  // CONFIGURACIÓN GLOBAL
  getConfiguracion: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/configuracion/parametros');
    return Array.isArray(res.data) ? res.data : [];
  },

  guardarParametro: async (clave: string, valor: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/configuracion/parametros', { clave, valor });
    return res.data;
  },

  getTiposLeche: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/configuracion/tipos-leche');
    return Array.isArray(res.data) ? res.data : [];
  },

  toggleTipoLeche: async (id: number, activo: boolean): Promise<any> => {
    const res = await apiClient.put(`/configuracion/tipos-leche/${id}/toggle`, activo);
    return res.data;
  },

  getModulosAdmin: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/configuracion/modulos-admin');
    return Array.isArray(res.data) ? res.data : [];
  },

  toggleModulo: async (id: number, activo: boolean): Promise<any> => {
    const res = await apiClient.put(`/configuracion/modulos/${id}/toggle`, activo);
    return res.data;
  },

  // REPORTES INTEGRALES (8 REPORTES OFICIALES)
  getDashboardAvanzado: async (semanas = 8): Promise<any> => {
    const res = await apiClient.get('/reportes/dashboard-avanzado', { params: { semanas } });
    return res.data;
  },

  getReporteDiarios: async (fechaInicio: string, fechaFin: string, choferId?: number): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (choferId) params.choferId = choferId;
    const res = await apiClient.get<any[]>('/reportes/diarios', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteReceptorias: async (fechaInicio: string, fechaFin: string, companiaId?: number): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (companiaId) params.companiaId = companiaId;
    const res = await apiClient.get<any[]>('/reportes/receptorias', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteFincas: async (fechaInicio: string, fechaFin: string, fincaIds?: string): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (fincaIds) params.fincaIds = fincaIds;
    const res = await apiClient.get<any[]>('/reportes/fincas', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteChoferes: async (fechaInicio: string, fechaFin: string, choferId?: number): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (choferId) params.choferId = choferId;
    const res = await apiClient.get<any[]>('/reportes/choferes', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteBancos: async (fechaInicio: string, fechaFin: string, bancoId?: number, cicloId?: number, tasaBcv?: number): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (bancoId) params.bancoId = bancoId;
    if (cicloId) params.cicloId = cicloId;
    if (tasaBcv) params.tasaBcv = tasaBcv;
    const res = await apiClient.get<any[]>('/reportes/bancos', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteCompanias: async (fechaInicio: string, fechaFin: string, companiaId?: number, cicloId?: number, tasaBcv?: number): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (companiaId) params.companiaId = companiaId;
    if (cicloId) params.cicloId = cicloId;
    if (tasaBcv) params.tasaBcv = tasaBcv;
    const res = await apiClient.get<any[]>('/reportes/relacion-companias', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteRelacionChoferes: async (fechaInicio: string, fechaFin: string): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    const res = await apiClient.get<any[]>('/reportes/relacion-choferes', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteRelacionCompanias: async (fechaInicio: string, fechaFin: string, companiaId?: number, cicloId?: number, tasaBcv?: number): Promise<any[]> => {
    const params: Record<string, any> = { fechaInicio, fechaFin };
    if (companiaId) params.companiaId = companiaId;
    if (cicloId) params.cicloId = cicloId;
    if (tasaBcv) params.tasaBcv = tasaBcv;
    const res = await apiClient.get<any[]>('/reportes/relacion-companias', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getReporteRelacionPagos: async (fechaInicio?: string, fechaFin?: string, bancoId?: number, cicloId?: number): Promise<any[]> => {
    const params: Record<string, any> = {};
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    if (bancoId) params.bancoId = bancoId;
    if (cicloId) params.cicloId = cicloId;
    const res = await apiClient.get<any[]>('/reportes/bancos', { params });
    return Array.isArray(res.data) ? res.data : [];
  },
};

