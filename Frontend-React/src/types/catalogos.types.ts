export interface FincaDto {
  id: number;
  codigo?: string;
  nombre: string;
  propietarioId?: number;
  propietarioNombre?: string;
  rutaId?: number;
  rutaNombre?: string;
  precioLitroUSD: number;
  precioLitroAcidaUSD?: number;
  tieneDosTiposLeche?: boolean;
  precioBufalaLitroUSD?: number;
  tipoLeche?: string; // VACA, BUFALA
  telefono?: string;
  ubicacion?: string;
  activo: boolean;
  bancoNombre?: string;
  numeroCuenta?: string;
  pagoMovil?: string;
  cedulaRif?: string;
}

export interface GuardarFincaDto {
  codigo?: string;
  nombre: string;
  propietarioId?: number;
  rutaId?: number;
  precioLitroUSD: number;
  precioLitroAcidaUSD?: number;
  tieneDosTiposLeche?: boolean;
  precioBufalaLitroUSD?: number;
  tipoLeche?: string;
  telefono?: string;
  ubicacion?: string;
  activo: boolean;
}

export interface PropietarioDto {
  id: number;
  nombre?: string;
  nombreCompleto?: string;
  cedulaRif?: string;
  cedulaRIF?: string;
  telefono?: string;
  email?: string;
  bancoId?: number;
  bancoNombre?: string;
  numeroCuenta?: string;
  pagoMovilTelefono?: string;
  pagoMovilCedula?: string;
  pagoMovilBancoId?: number;
  activo: boolean;
  totalFincas?: number;
  fincasAsignadas?: { id: number; nombre: string }[];
}

export interface CrearPropietarioDto {
  nombreCompleto: string;
  cedulaRif: string;
  telefono?: string;
  email?: string;
  bancoId?: number;
  numeroCuenta?: string;
  pagoMovilTelefono?: string;
  pagoMovilCedula?: string;
  pagoMovilBancoId?: number;
  activo: boolean;
}

export interface CompaniaDto {
  id: number;
  nombre: string;
  rif?: string;
  direccion?: string;
  telefono?: string;
  contacto?: string;
  encargado?: string;
  precioLitroUSD: number;
  activo: boolean;
}

export interface GuardarCompaniaDto {
  nombre: string;
  rif?: string;
  direccion?: string;
  telefono?: string;
  contacto?: string;
  precioLitroUSD: number;
  activo: boolean;
}

export interface BancoDto {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface ChoferDto {
  id: number;
  nombreCompleto: string;
  cedula: string;
  telefono?: string;
  camionAsignadoId?: number;
  camionPlaca?: string;
  activo: boolean;
}

export interface CamionDto {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  año?: number;
  capacidadLitros: number;
  odometroActualKm: number;
  usuarioId?: number;
  choferNombre?: string;
  activo: boolean;
}

export interface GuardarCamionDto {
  placa: string;
  marca: string;
  modelo: string;
  año?: number;
  capacidadLitros: number;
  odometroActualKm: number;
  usuarioId?: number;
  activo: boolean;
}

export interface EmpresaConfigDto {
  id?: number;
  nombreEmpresa: string;
  rif: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoUrl?: string;
  monedaPrincipal?: string;
  toleranciaMermaPct?: number;
}

