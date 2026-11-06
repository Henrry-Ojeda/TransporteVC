import apiClient from './client';
import type { LoginDto, LoginResponseDto, AuthUser, PerfilUsuarioDto, ActualizarPerfilDto } from '@/types';

export const authApi = {
  login: async (credentials: LoginDto): Promise<LoginResponseDto> => {
    const response = await apiClient.post<LoginResponseDto>('/auth/login', credentials);
    return response.data;
  },

  getTenantInfo: async (): Promise<{ codigo: string; nombre: string; modulos: string[] }> => {
    const response = await apiClient.get<{ codigo: string; nombre: string; modulos: string[] }>('/auth/tenant');
    return response.data;
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await apiClient.get<AuthUser>('/auth/me');
    return response.data;
  },

  getPerfil: async (): Promise<PerfilUsuarioDto> => {
    const response = await apiClient.get<PerfilUsuarioDto>('/auth/perfil');
    return response.data;
  },

  updatePerfil: async (dto: ActualizarPerfilDto): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.put<{ success: boolean; message: string }>('/auth/perfil', dto);
    return response.data;
  },
};

