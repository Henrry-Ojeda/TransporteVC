export interface LoginDto {
  username: string;
  password: string;
}

export type PermisoAccion = 'VER' | 'EDITAR' | 'AGREGAR' | 'ELIMINAR';

export interface AuthUser {
  id: number;
  username: string;
  nombreCompleto: string;
  rol: string;
  permisos: string[];
  modulosHabilitados?: string[];
  empresaCodigo?: string;
  empresaNombre?: string;
}

export interface LoginResponseDto {
  token: string;
  id: number;
  username: string;
  nombreCompleto: string;
  rol: string;
  permisos: string[];
  modulosHabilitados?: string[];
  empresaCodigo?: string;
  empresaNombre?: string;
}

