import apiClient from './client';
import type { LoginDto, LoginResponseDto, AuthUser } from '@/types';

export const authApi = {
  login: async (credentials: LoginDto): Promise<LoginResponseDto> => {
    const response = await apiClient.post<LoginResponseDto>('/auth/login', credentials);
    return response.data;
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await apiClient.get<AuthUser>('/auth/me');
    return response.data;
  },
};

