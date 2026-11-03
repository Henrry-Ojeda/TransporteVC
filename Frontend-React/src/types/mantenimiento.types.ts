export type TipoEventoMantenimiento =
  | 'CAMBIO_ACEITE'
  | 'CAUCHOS'
  | 'PREVENTIVO'
  | 'CORRECTIVO'
  | 'MEJORA'
  | 'SINIESTRO_CHOFER';

export type EstadoMantenimiento = 'REPORTADO_CHOFER' | 'EN_TALLER' | 'RESUELTO';

export interface MantenimientoCamionDto {
  id: number;
  camionId: number;
  camionPlaca?: string;
  marcaModelo?: string;
  tipoEvento: TipoEventoMantenimiento | string;
  titulo: string;
  descripcion: string;
  fechaEvento: string;
  odometroKm?: number | null;
  proximoKmSugerido?: number | null;
  proximaFechaSugerida?: string | null;
  tallerOMecanico?: string | null;
  estado: EstadoMantenimiento | string;
  reportadoPorChoferId?: number | null;
  choferNombre?: string | null;
  costoTotalUSD: number;
  createdAt: string;
}

export interface CrearMantenimientoCamionDto {
  camionId: number;
  tipoEvento: string;
  titulo: string;
  descripcion: string;
  fechaEvento: string;
  odometroKm?: number | null;
  proximoKmSugerido?: number | null;
  proximaFechaSugerida?: string | null;
  tallerOMecanico?: string | null;
  estado: string;
  costoTotalUSD: number;
}

export interface AlertaPreventivaDto {
  camionId: number;
  placa: string;
  marcaModelo: string;
  odometroActualKm: number;
  choferNombre?: string | null;
  ultimoMantenimientoId?: number | null;
  tipoEvento?: string | null;
  titulo?: string | null;
  ultimoKmRealizado?: number | null;
  proximoKmSugerido?: number | null;
  proximaFechaSugerida?: string | null;
  kmRestantes?: number | null;
  diasRestantes?: number | null;
}

