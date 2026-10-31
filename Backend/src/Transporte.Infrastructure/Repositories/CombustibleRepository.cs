using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Transporte.Core.DTOs;

namespace Transporte.Infrastructure.Repositories
{
    public interface ICombustibleRepository
    {
        Task<IEnumerable<CombustibleInventarioDto>> ObtenerInventarioAsync();
        Task<IEnumerable<CombustibleHistorialDto>> ObtenerHistorialAsync(string? tipoCombustible = null, int? camionId = null, int top = 100);
        Task<bool> RegistrarCompraAsync(RegistrarCompraCombustibleDto dto, int? userId);
        Task<bool> RegistrarDespachoAsync(RegistrarDespachoCombustibleDto dto, int? userId);
        Task<bool> AjustarStockAsync(string tipoCombustible, decimal nuevoStock, string motivo, int? userId);
    }

    public class CombustibleRepository : ICombustibleRepository
    {
        private readonly string _connectionString;

        public CombustibleRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? configuration.GetConnectionString("BD_TRANSPORTE") 
                ?? "Server=localhost;Database=BD_CV_PROD;Trusted_Connection=True;TrustServerCertificate=True;";
        }

        private IDbConnection CreateConnection() => new SqlConnection(_connectionString);

        public async Task<IEnumerable<CombustibleInventarioDto>> ObtenerInventarioAsync()
        {
            using var connection = CreateConnection();
            var sql = @"
                SELECT 
                    Id,
                    TipoCombustible,
                    StockActualLitros,
                    CapacidadTanqueAlmacen,
                    UpdatedAt
                FROM TB_COMBUSTIBLE_INVENTARIO
                ORDER BY TipoCombustible ASC";
            return await connection.QueryAsync<CombustibleInventarioDto>(sql);
        }

        public async Task<IEnumerable<CombustibleHistorialDto>> ObtenerHistorialAsync(string? tipoCombustible = null, int? camionId = null, int top = 100)
        {
            using var connection = CreateConnection();
            var sql = @"
                SELECT TOP (@Top)
                    h.Id,
                    h.TipoMovimiento,
                    h.TipoCombustible,
                    h.Litros,
                    h.StockAnteriorLitros,
                    h.StockNuevoLitros,
                    h.CamionId,
                    c.Placa AS CamionPlaca,
                    u.NombreCompleto AS ChoferNombre,
                    h.ControlRutaId,
                    rl.Nombre AS RutaNombre,
                    h.OdometroKm,
                    h.CostoPorLitroUSD,
                    h.Proveedor,
                    h.Observaciones,
                    h.Fecha,
                    h.CreatedAt
                FROM TB_COMBUSTIBLE_HISTORIAL h
                LEFT JOIN TB_CAMIONES c ON h.CamionId = c.Id
                LEFT JOIN TB_USUARIOS u ON c.UsuarioId = u.Id
                LEFT JOIN TB_CONTROL_RUTAS cr ON h.ControlRutaId = cr.Id
                LEFT JOIN TB_RUTAS_LOGISTICA rl ON cr.RutaLogisticaId = rl.Id
                WHERE (@TipoCombustible IS NULL OR h.TipoCombustible = @TipoCombustible)
                  AND (@CamionId IS NULL OR h.CamionId = @CamionId)
                ORDER BY h.Fecha DESC, h.Id DESC";

            return await connection.QueryAsync<CombustibleHistorialDto>(sql, new 
            { 
                Top = top, 
                TipoCombustible = string.IsNullOrWhiteSpace(tipoCombustible) ? null : tipoCombustible,
                CamionId = camionId
            });
        }

        public async Task<bool> RegistrarCompraAsync(RegistrarCompraCombustibleDto dto, int? userId)
        {
            using var connection = CreateConnection();
            if (connection.State != ConnectionState.Open) connection.Open();
            using var tx = connection.BeginTransaction();

            try
            {
                var inv = await connection.QueryFirstOrDefaultAsync<CombustibleInventarioDto>(
                    "SELECT * FROM TB_COMBUSTIBLE_INVENTARIO WHERE TipoCombustible = @Tipo",
                    new { Tipo = dto.TipoCombustible },
                    transaction: tx);

                decimal stockAnterior = inv?.StockActualLitros ?? 0;
                decimal stockNuevo = stockAnterior + dto.Litros;

                if (inv == null)
                {
                    await connection.ExecuteAsync(
                        @"INSERT INTO TB_COMBUSTIBLE_INVENTARIO (TipoCombustible, StockActualLitros, CapacidadTanqueAlmacen, UpdatedAt)
                          VALUES (@Tipo, @Stock, 10000, GETDATE())",
                        new { Tipo = dto.TipoCombustible, Stock = stockNuevo },
                        transaction: tx);
                }
                else
                {
                    await connection.ExecuteAsync(
                        @"UPDATE TB_COMBUSTIBLE_INVENTARIO 
                          SET StockActualLitros = @Stock, UpdatedAt = GETDATE() 
                          WHERE TipoCombustible = @Tipo",
                        new { Stock = stockNuevo, Tipo = dto.TipoCombustible },
                        transaction: tx);
                }

                await connection.ExecuteAsync(
                    @"INSERT INTO TB_COMBUSTIBLE_HISTORIAL 
                      (TipoMovimiento, TipoCombustible, Litros, StockAnteriorLitros, StockNuevoLitros, CostoPorLitroUSD, Proveedor, Observaciones, Fecha, CreatedBy, CreatedAt)
                      VALUES ('COMPRA_INGRESO', @Tipo, @Litros, @StockAnt, @StockNue, @Costo, @Prov, @Obs, @Fecha, @UserId, GETDATE())",
                    new 
                    {
                        Tipo = dto.TipoCombustible,
                        Litros = dto.Litros,
                        StockAnt = stockAnterior,
                        StockNue = stockNuevo,
                        Costo = dto.CostoPorLitroUSD,
                        Prov = dto.Proveedor,
                        Obs = dto.Observaciones,
                        Fecha = dto.Fecha,
                        UserId = userId
                    },
                    transaction: tx);

                tx.Commit();
                return true;
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }

        public async Task<bool> RegistrarDespachoAsync(RegistrarDespachoCombustibleDto dto, int? userId)
        {
            using var connection = CreateConnection();
            if (connection.State != ConnectionState.Open) connection.Open();
            using var tx = connection.BeginTransaction();

            try
            {
                var inv = await connection.QueryFirstOrDefaultAsync<CombustibleInventarioDto>(
                    "SELECT * FROM TB_COMBUSTIBLE_INVENTARIO WHERE TipoCombustible = @Tipo",
                    new { Tipo = dto.TipoCombustible },
                    transaction: tx);

                if (inv == null)
                {
                    throw new InvalidOperationException($"No existe inventario configurado para {dto.TipoCombustible}.");
                }

                if (inv.StockActualLitros < dto.Litros)
                {
                    throw new InvalidOperationException($"Stock insuficiente en tanque. Disponible: {inv.StockActualLitros:N2} L, Solicitado: {dto.Litros:N2} L.");
                }

                decimal stockAnterior = inv.StockActualLitros;
                decimal stockNuevo = stockAnterior - dto.Litros;

                await connection.ExecuteAsync(
                    @"UPDATE TB_COMBUSTIBLE_INVENTARIO 
                      SET StockActualLitros = @Stock, UpdatedAt = GETDATE() 
                      WHERE TipoCombustible = @Tipo",
                    new { Stock = stockNuevo, Tipo = dto.TipoCombustible },
                    transaction: tx);

                // Actualizar odómetro del camión si se proporcionó y es mayor
                if (dto.OdometroKm.HasValue && dto.OdometroKm.Value > 0)
                {
                    await connection.ExecuteAsync(
                        @"UPDATE TB_CAMIONES 
                          SET OdometroActualKm = CASE 
                                WHEN @Km > OdometroActualKm THEN @Km 
                                ELSE OdometroActualKm 
                              END 
                          WHERE Id = @CamionId",
                        new { Km = dto.OdometroKm.Value, CamionId = dto.CamionId },
                        transaction: tx);
                }

                await connection.ExecuteAsync(
                    @"INSERT INTO TB_COMBUSTIBLE_HISTORIAL 
                      (TipoMovimiento, TipoCombustible, Litros, StockAnteriorLitros, StockNuevoLitros, CamionId, ControlRutaId, OdometroKm, Observaciones, Fecha, CreatedBy, CreatedAt)
                      VALUES ('DESPACHO_CAMION', @Tipo, @Litros, @StockAnt, @StockNue, @CamionId, @ControlRutaId, @OdometroKm, @Obs, @Fecha, @UserId, GETDATE())",
                    new 
                    {
                        Tipo = dto.TipoCombustible,
                        Litros = dto.Litros,
                        StockAnt = stockAnterior,
                        StockNue = stockNuevo,
                        CamionId = dto.CamionId,
                        ControlRutaId = dto.ControlRutaId,
                        OdometroKm = dto.OdometroKm,
                        Obs = dto.Observaciones,
                        Fecha = dto.Fecha,
                        UserId = userId
                    },
                    transaction: tx);

                tx.Commit();
                return true;
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }

        public async Task<bool> AjustarStockAsync(string tipoCombustible, decimal nuevoStock, string motivo, int? userId)
        {
            using var connection = CreateConnection();
            if (connection.State != ConnectionState.Open) connection.Open();
            using var tx = connection.BeginTransaction();

            try
            {
                var inv = await connection.QueryFirstOrDefaultAsync<CombustibleInventarioDto>(
                    "SELECT * FROM TB_COMBUSTIBLE_INVENTARIO WHERE TipoCombustible = @Tipo",
                    new { Tipo = tipoCombustible },
                    transaction: tx);

                decimal stockAnterior = inv?.StockActualLitros ?? 0;
                decimal diferencia = nuevoStock - stockAnterior;

                if (inv == null)
                {
                    await connection.ExecuteAsync(
                        @"INSERT INTO TB_COMBUSTIBLE_INVENTARIO (TipoCombustible, StockActualLitros, CapacidadTanqueAlmacen, UpdatedAt)
                          VALUES (@Tipo, @Stock, 10000, GETDATE())",
                        new { Tipo = tipoCombustible, Stock = nuevoStock },
                        transaction: tx);
                }
                else
                {
                    await connection.ExecuteAsync(
                        @"UPDATE TB_COMBUSTIBLE_INVENTARIO 
                          SET StockActualLitros = @Stock, UpdatedAt = GETDATE() 
                          WHERE TipoCombustible = @Tipo",
                        new { Stock = nuevoStock, Tipo = tipoCombustible },
                        transaction: tx);
                }

                await connection.ExecuteAsync(
                    @"INSERT INTO TB_COMBUSTIBLE_HISTORIAL 
                      (TipoMovimiento, TipoCombustible, Litros, StockAnteriorLitros, StockNuevoLitros, Observaciones, Fecha, CreatedBy, CreatedAt)
                      VALUES ('AJUSTE', @Tipo, @Litros, @StockAnt, @StockNue, @Obs, CAST(GETDATE() AS DATE), @UserId, GETDATE())",
                    new 
                    {
                        Tipo = tipoCombustible,
                        Litros = Math.Abs(diferencia),
                        StockAnt = stockAnterior,
                        StockNue = nuevoStock,
                        Obs = $"Ajuste de inventario: {motivo}",
                        UserId = userId
                    },
                    transaction: tx);

                tx.Commit();
                return true;
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }
    }
}
