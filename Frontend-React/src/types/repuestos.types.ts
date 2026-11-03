export interface RepuestoDto {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitarioUSD: number;
  ubicacionAlmacen?: string;
  activo: boolean;
  createdAt: string;
}

export interface GuardarRepuestoDto {
  codigo: string;
  nombre: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitarioUSD: number;
  ubicacionAlmacen?: string;
  activo: boolean;
}

export type TipoMovimientoRepuesto = 'ENTRADA_COMPRA' | 'SALIDA_MANTENIMIENTO' | 'AJUSTE';

export interface MovimientoRepuestoDto {
  id: number;
  repuestoId: number;
  repuestoCodigo?: string;
  repuestoNombre?: string;
  tipoMovimiento: TipoMovimientoRepuesto | string;
  cantidad: number;
  costoUnitarioUSD: number;
  mantenimientoId?: number;
  camionId?: number;
  camionPlaca?: string;
  fecha: string;
  observaciones?: string;
  createdAt?: string;
}

export interface RegistrarMovimientoRepuestoDto {
  repuestoId: number;
  tipoMovimiento: string;
  cantidad: number;
  costoUnitarioUSD: number;
  mantenimientoId?: number;
  camionId?: number;
  fecha: string;
  observaciones?: string;
}

