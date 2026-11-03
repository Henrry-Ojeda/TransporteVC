export interface TasaBcv {
  tasa?: number;
  tasaDolarBs?: number;
  tieneTasaHoy?: boolean;
  fecha: string;
  fuente?: string;
  observacion?: string;
  data?: any;
}

export type BcvRateResponse = TasaBcv;

export interface HistorialBcvDto {
  id: number;
  fecha: string;
  tasaDolarBs: number;
  tasa?: number;
  fuente?: string;
  observacion?: string;
}
