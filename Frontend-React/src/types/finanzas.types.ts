export interface CicloSemanalDto {
  id: number;
  codigo?: string;
  numeroSemana: number;
  año: number;
  anio?: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string; // ABIERTO, CERRADO, LIQUIDADO
  totalLitros: number;
  totalMontoUSD: number;
  totalMontoBs: number;
  tasaBCVCierre?: number;
  observaciones?: string;
}

export interface PreliquidacionFincaDto {
  fincaId: number;
  fincaCodigo?: string;
  fincaNombre: string;
  propietarioId: number;
  propietarioNombre: string;
  bancoNombre?: string;
  numeroCuenta?: string;
  pagoMovil?: string;
  cedulaRif?: string;
  totalLitros: number;
  precioLitroUSD: number;
  totalBrutoUSD: number;
  totalAdelantosUSD: number;
  totalNetoUSD: number;
  totalNetoBs: number;
  tasaBCV: number;
  pagado: boolean;
  fechaPago?: string;
  referenciaPago?: string;
}

export interface AdelantoDto {
  id: number;
  tipoEntidad: 'FINCA' | 'PERSONAL';
  fincaId?: number;
  fincaNombre?: string;
  usuarioId?: number;
  usuarioNombre?: string;
  fecha: string;
  montoUSD: number;
  montoBs?: number;
  tasaBCV?: number;
  motivo?: string;
  amortizado: boolean;
  montoAmortizadoUSD: number;
  saldoPendienteUSD: number;
  cicloId?: number;
  comprobanteRef?: string;
  createdAt: string;
}

export interface AbonoCompaniaDto {
  id: number;
  companiaId: number;
  companiaNombre?: string;
  fecha: string;
  montoUSD: number;
  montoBs?: number;
  tasaBCV?: number;
  bancoReceptorId?: number;
  bancoNombre?: string;
  referenciaBancaria: string;
  controlCompaniaId?: number;
  fechaLecheAbonada?: string;
  litrosAbonados?: number;
  observaciones?: string;
  createdAt: string;
}

export interface PagoPersonalDto {
  id: number;
  usuarioId: number;
  usuarioNombre: string;
  rol: string;
  fecha: string;
  montoUSD: number;
  montoBs: number;
  tasaBCV: number;
  tipoPago: string; // SUELDO, COMISION_LITROS, BONO, VIATICOS
  descripcion?: string;
  referenciaBancaria?: string;
  createdAt: string;
}

