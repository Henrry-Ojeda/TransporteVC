export type TipoCombustible = 'GASOIL' | 'GASOLINA';
export type TipoMovimientoCombustible = 'COMPRA_INGRESO' | 'DESPACHO_CAMION' | 'AJUSTE';

export interface InventarioCombustibleDto {
  id?: number;
  tipoCombustible: string;
  stockActualLitros: number;
  capacidadTanqueAlmacen?: number;
  capacidadTanqueLitros?: number;
  porcentajeOcupado?: number;
  porcentajeLlenado?: number;
  costoPromedioPorLitroUSD?: number;
  updatedAt?: string;
}

export interface CombustibleHistorialDto {
  id: number;
  tipoMovimiento: string;
  tipoCombustible: string;
  litros: number;
  stockAnteriorLitros: number;
  stockNuevoLitros: number;
  camionId?: number;
  camionPlaca?: string;
  choferNombre?: string;
  controlRutaId?: number;
  rutaNombre?: string;
  odometroKm?: number;
  costoPorLitroUSD?: number;
  proveedor?: string;
  observaciones?: string;
  fecha: string;
  createdAt?: string;
}

export interface RegistrarDespachoCombustibleDto {
  camionId: number;
  tipoCombustible: string;
  litros: number;
  controlRutaId?: number;
  odometroKm?: number;
  fecha: string;
  observaciones?: string;
}

export interface RegistrarCompraCombustibleDto {
  tipoCombustible: string;
  litros: number;
  costoPorLitroUSD: number;
  proveedor?: string;
  fecha: string;
  observaciones?: string;
}

export interface AjustarStockCombustibleDto {
  tipoCombustible: string;
  nuevoStock: number;
  nuevaCapacidad?: number;
  motivo: string;
}

export interface CamionSimpleDto {
  id: number;
  placa: string;
  marca?: string;
  modelo?: string;
  capacidadLitros?: number;
  usuarioId?: number;
  choferNombre?: string;
  activo?: boolean;
}

