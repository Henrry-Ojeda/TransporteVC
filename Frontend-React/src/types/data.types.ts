export type EntidadData = 'FINCAS' | 'PROPIETARIOS' | 'COMPANIAS' | 'BANCOS';

export interface PrerequisitoItem {
  nombre: string;
  cantidad: number;
  cumplido: boolean;
  mensaje: string;
}

export interface PrerequisitosResponse {
  entidad: string;
  requierePrevio: boolean;
  prerequisitos: PrerequisitoItem[];
  listo: boolean;
}

export interface ImportResult {
  message?: string;
  insertados?: number;
  actualizados?: number;
  propietariosAutoCreados?: number;
  total?: number;
  errores?: string[];
}

