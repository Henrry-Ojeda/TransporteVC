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
    public interface IRutasLogisticaRepository
    {
        Task<IEnumerable<RutaLogisticaDto>> ObtenerRutasAsync();
        Task<RutaLogisticaDto?> ObtenerRutaPorIdAsync(int id);
        Task<int> CrearRutaAsync(GuardarRutaLogisticaDto dto);
        Task<bool> ActualizarRutaAsync(int id, GuardarRutaLogisticaDto dto);
        Task<bool> EliminarRutaAsync(int id);
        Task<IEnumerable<dynamic>> ObtenerFincasDeRutaAsync(int rutaId);
        Task<bool> AsignarFincasARutaAsync(int rutaId, List<int> fincaIds);
    }

    public class RutasLogisticaRepository : IRutasLogisticaRepository
    {
        private readonly string _connectionString;

        public RutasLogisticaRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? configuration.GetConnectionString("BD_TRANSPORTE") 
                ?? "Server=localhost;Database=BD_CV_PROD;Trusted_Connection=True;TrustServerCertificate=True;";
        }

        private IDbConnection CreateConnection() => new SqlConnection(_connectionString);

        public async Task<IEnumerable<RutaLogisticaDto>> ObtenerRutasAsync()
        {
            using var connection = CreateConnection();
            var sql = @"
                SELECT 
                    r.Id,
                    r.Codigo,
                    r.Nombre,
                    r.Descripcion,
                    r.Color,
                    r.Activo,
                    r.CreatedAt,
                    (SELECT COUNT(*) FROM TB_FINCAS f WHERE f.RutaId = r.Id AND f.Activo = 1) AS TotalFincasAsignadas
                FROM TB_RUTAS_LOGISTICA r
                ORDER BY r.Nombre ASC";
            return await connection.QueryAsync<RutaLogisticaDto>(sql);
        }

        public async Task<RutaLogisticaDto?> ObtenerRutaPorIdAsync(int id)
        {
            using var connection = CreateConnection();
            var sql = @"
                SELECT 
                    r.Id,
                    r.Codigo,
                    r.Nombre,
                    r.Descripcion,
                    r.Color,
                    r.Activo,
                    r.CreatedAt,
                    (SELECT COUNT(*) FROM TB_FINCAS f WHERE f.RutaId = r.Id AND f.Activo = 1) AS TotalFincasAsignadas
                FROM TB_RUTAS_LOGISTICA r
                WHERE r.Id = @id";
            return await connection.QueryFirstOrDefaultAsync<RutaLogisticaDto>(sql, new { id });
        }

        public async Task<int> CrearRutaAsync(GuardarRutaLogisticaDto dto)
        {
            using var connection = CreateConnection();
            var sql = @"
                INSERT INTO TB_RUTAS_LOGISTICA (Codigo, Nombre, Descripcion, Color, Activo, CreatedAt)
                VALUES (@Codigo, @Nombre, @Descripcion, @Color, @Activo, GETDATE());
                SELECT CAST(SCOPE_IDENTITY() AS INT);";
            return await connection.ExecuteScalarAsync<int>(sql, dto);
        }

        public async Task<bool> ActualizarRutaAsync(int id, GuardarRutaLogisticaDto dto)
        {
            using var connection = CreateConnection();
            var sql = @"
                UPDATE TB_RUTAS_LOGISTICA
                SET Codigo = @Codigo,
                    Nombre = @Nombre,
                    Descripcion = @Descripcion,
                    Color = @Color,
                    Activo = @Activo
                WHERE Id = @id";
            var rows = await connection.ExecuteAsync(sql, new
            {
                id,
                dto.Codigo,
                dto.Nombre,
                dto.Descripcion,
                dto.Color,
                dto.Activo
            });
            return rows > 0;
        }

        public async Task<bool> EliminarRutaAsync(int id)
        {
            using var connection = CreateConnection();
            var sql = @"
                UPDATE TB_FINCAS SET RutaId = NULL WHERE RutaId = @id;
                DELETE FROM TB_RUTAS_LOGISTICA WHERE Id = @id;";
            var rows = await connection.ExecuteAsync(sql, new { id });
            return rows > 0;
        }

        public async Task<IEnumerable<dynamic>> ObtenerFincasDeRutaAsync(int rutaId)
        {
            using var connection = CreateConnection();
            var sql = @"
                SELECT 
                    f.Id, 
                    f.Codigo, 
                    f.Nombre, 
                    f.Propietario, 
                    f.RutaId,
                    CASE WHEN f.RutaId = @rutaId THEN 1 ELSE 0 END AS Asignada
                FROM TB_FINCAS f
                WHERE f.Activo = 1
                ORDER BY Asignada DESC, f.Nombre ASC";
            return await connection.QueryAsync(sql, new { rutaId });
        }

        public async Task<bool> AsignarFincasARutaAsync(int rutaId, List<int> fincaIds)
        {
            using var connection = CreateConnection();
            if (connection.State != ConnectionState.Open) connection.Open();
            using var tx = connection.BeginTransaction();
            try
            {
                if (fincaIds == null || fincaIds.Count == 0)
                {
                    await connection.ExecuteAsync("UPDATE TB_FINCAS SET RutaId = NULL WHERE RutaId = @rutaId", new { rutaId }, tx);
                }
                else
                {
                    // Desasociar fincas de esta ruta que ya no estén seleccionadas
                    await connection.ExecuteAsync(
                        "UPDATE TB_FINCAS SET RutaId = NULL WHERE RutaId = @rutaId AND Id NOT IN @fincaIds",
                        new { rutaId, fincaIds }, tx);

                    // Asociar fincas seleccionadas
                    await connection.ExecuteAsync(
                        "UPDATE TB_FINCAS SET RutaId = @rutaId WHERE Id IN @fincaIds",
                        new { rutaId, fincaIds }, tx);
                }

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
