export interface ControlRutaDto {
  id: number;
  codigoTicket?: string;
  fecha: string;
  camionId: number;
  camionPlaca?: string;
  choferId: number;
  choferNombre?: string;
  rutaLogisticaId?: number;
  rutaNombre?: string;
  totalLitrosRecogidos: number;
  totalLitrosEntregados: number;
  mermaLitros: number;
  mermaPorcentaje: number;
  estadoProceso: string; // INICIADO, EN_RUTA, EN_RECEPTORIA, ENTREGADO_COMPANIA, CERRADO
  odometroInicialKm?: number;
  odometroFinalKm?: number;
  observaciones?: string;
  createdAt: string;
  fincasDetalle?: ControlRutaFincaDto[];
  entregasDetalle?: ControlRutaEntregaDto[];
}

export interface ControlRutaFincaDto {
  id: number;
  controlRutaId: number;
  fincaId: number;
  fincaNombre?: string;
  propietarioNombre?: string;
  litrosLeche: number;
  temperatura?: number;
  tipoLeche?: string;
  horaRecoleccion?: string;
  precioLitroUSD?: number;
}

export interface ControlRutaEntregaDto {
  id: number;
  controlRutaId: number;
  companiaId: number;
  companiaNombre?: string;
  litrosEntregados: number;
  ticketReceptoria?: string;
  fechaHora?: string;
  precioLitroUSD?: number;
  observaciones?: string;
}

export interface RutaLogisticaDto {
  id: number;
  nombre: string;
  codigo?: string;
  descripcion?: string;
  activo: boolean;
  camionPredeterminadoId?: number;
  camionPlaca?: string;
  choferPredeterminadoId?: number;
  choferNombre?: string;
  totalFincas?: number;
  fincas?: { fincaId: number; fincaNombre: string; ordenSecuencia: number }[];
}

export interface DespachoCompaniaDto {
  id: number;
  fecha: string;
  usuarioId?: number;
  nombreConductor?: string;
  camionId?: number;
  camionPlaca?: string;
  choferNombre?: string;
  companiaId: number;
  companiaNombre?: string;
  nombreCompania?: string;
  litrosDespachados: number;
  litrosConfirmados?: number;
  litrosRecibidosCompania?: number;
  diferenciaLitros?: number;
  porcentajeMerma?: number;
  tipoLeche: string;
  estado: string; // EN_TRANSITO, RECIBIDO_COMPANIA, CONCILIADO
  numeroGuiaSADA?: string;
  observaciones?: string;
  observacion?: string;
  controlRutaId?: number;
  createdAt?: string;
}

export interface BalanceVolumetricoResumenDto {
  totalLitrosRecogidos: number;
  totalLitrosEntregados: number;
  mermaLitros: number;
  mermaPorcentaje: number;
  totalViajes: number;
  totalFincasVisitadas: number;
  fechaInicio?: string;
  fechaFin?: string;
}

