using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Data.SqlClient;
using Transporte.Core.DTOs;
using Transporte.Core.Entities;
using Transporte.Infrastructure.Repositories;

namespace Transporte.API.Controllers
{
    [ApiController]
    [Route("api/data")]
    [Authorize]
    public class ImportacionDataController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly ICatalogosRepository _catalogosRepository;

        public ImportacionDataController(IConfiguration configuration, ICatalogosRepository catalogosRepository)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
            _catalogosRepository = catalogosRepository;
        }

        private IDbConnection CreateConnection() => new SqlConnection(_connectionString);

        private int GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out int id) ? id : 1;
        }

        private string GetUserName()
        {
            return User.FindFirst(ClaimTypes.Name)?.Value ?? "Administrador";
        }

        /// <summary>
        /// Valida si existen registros previos necesarios para importar una entidad
        /// (ej: Propietarios antes de Fincas).
        /// </summary>
        [HttpGet("validar-prerequisitos/{entidad}")]
        public async Task<IActionResult> ValidarPrerequisitos(string entidad)
        {
            try
            {
                using var conn = CreateConnection();
                var ent = entidad.Trim().ToUpperInvariant();

                if (ent == "FINCAS")
                {
                    int totalPropietarios = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Propietarios WHERE Estado = 'ACTIVO'");
                    int totalCompanias = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Companias WHERE Activo = 1");
                    int totalBancos = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Bancos WHERE Activo = 1");

                    bool tienePropietarios = totalPropietarios > 0;
                    return Ok(new
                    {
                        entidad = "FINCAS",
                        requierePrevio = true,
                        prerequisitos = new[]
                        {
                            new { nombre = "Propietarios", cantidad = totalPropietarios, cumplido = tienePropietarios, mensaje = tienePropietarios ? $"{totalPropietarios} propietarios registrados." : "No hay propietarios registrados. Se recomienda cargar propietarios antes para asociar fincas." },
                            new { nombre = "Compañías", cantidad = totalCompanias, cumplido = totalCompanias > 0, mensaje = $"{totalCompanias} compañías registradas." },
                            new { nombre = "Bancos", cantidad = totalBancos, cumplido = totalBancos > 0, mensaje = $"{totalBancos} bancos registrados." }
                        },
                        listo = tienePropietarios
                    });
                }
                else if (ent == "PROPIETARIOS")
                {
                    int totalBancos = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM Bancos WHERE Activo = 1");
                    return Ok(new
                    {
                        entidad = "PROPIETARIOS",
                        requierePrevio = false,
                        prerequisitos = new[]
                        {
                            new { nombre = "Bancos", cantidad = totalBancos, cumplido = totalBancos > 0, mensaje = $"{totalBancos} bancos registrados para cuentas bancarias." }
                        },
                        listo = true
                    });
                }
                else
                {
                    return Ok(new
                    {
                        entidad = ent,
                        requierePrevio = false,
                        prerequisitos = Array.Empty<object>(),
                        listo = true
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al validar prerrequisitos: " + ex.Message });
            }
        }

        /// <summary>
        /// Importación masiva de Propietarios
        /// </summary>
        [HttpPost("importar/propietarios")]
        public async Task<IActionResult> ImportarPropietarios([FromBody] List<ImportarPropietarioItemDto> items)
        {
            if (items == null || items.Count == 0)
                return BadRequest(new { message = "No se recibieron datos para importar." });

            int insertados = 0;
            int actualizados = 0;
            var errores = new List<string>();
            int userId = GetUserId();

            try
            {
                using var conn = CreateConnection();
                var bancos = (await conn.QueryAsync<Banco>("SELECT * FROM Bancos WHERE Activo = 1")).ToList();

                foreach (var item in items)
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(item.Nombre))
                        {
                            errores.Add($"Fila omitida: Nombre de propietario requerido.");
                            continue;
                        }

                        string nom = item.Nombre.Trim();
                        string? ced = string.IsNullOrWhiteSpace(item.CedulaRIF) ? null : item.CedulaRIF.Trim();
                        string? tel = string.IsNullOrWhiteSpace(item.Telefono) ? null : item.Telefono.Trim();
                        string? email = string.IsNullOrWhiteSpace(item.Email) ? null : item.Email.Trim();
                        string? numCuenta = string.IsNullOrWhiteSpace(item.NumeroCuenta) ? null : item.NumeroCuenta.Trim();
                        string? obs = string.IsNullOrWhiteSpace(item.Observacion) ? null : item.Observacion.Trim();

                        // Buscar banco por nombre o código si viene en el texto
                        int? bancoId = item.BancoId;
                        if (!bancoId.HasValue && !string.IsNullOrWhiteSpace(item.BancoNombre))
                        {
                            var bEncontrado = bancos.FirstOrDefault(b => 
                                b.Nombre.Equals(item.BancoNombre.Trim(), StringComparison.OrdinalIgnoreCase) ||
                                b.Codigo.Equals(item.BancoNombre.Trim(), StringComparison.OrdinalIgnoreCase));
                            if (bEncontrado != null) bancoId = bEncontrado.Id;
                        }

                        // Verificar si ya existe por Cédula/RIF o Nombre
                        var existente = await conn.QueryFirstOrDefaultAsync<Propietario>(
                            "SELECT TOP 1 * FROM Propietarios WHERE (CedulaRIF IS NOT NULL AND CedulaRIF = @ced) OR LOWER(Nombre) = LOWER(@nom)",
                            new { ced, nom });

                        if (existente != null)
                        {
                            // Actualizar
                            await conn.ExecuteAsync(@"
                                UPDATE Propietarios 
                                SET Nombre = @nom,
                                    CedulaRIF = COALESCE(@ced, CedulaRIF),
                                    Telefono = COALESCE(@tel, Telefono),
                                    Email = COALESCE(@email, Email),
                                    BancoId = COALESCE(@bancoId, BancoId),
                                    NumeroCuenta = COALESCE(@numCuenta, NumeroCuenta),
                                    Observacion = COALESCE(@obs, Observacion)
                                WHERE Id = @id",
                                new { nom, ced, tel, email, bancoId, numCuenta, obs, id = existente.Id });
                            actualizados++;
                        }
                        else
                        {
                            // Insertar nuevo
                            await conn.ExecuteAsync(@"
                                INSERT INTO Propietarios (Nombre, CedulaRIF, Telefono, Email, BancoId, NumeroCuenta, Observacion, Estado, CreatedAt, CreatedBy)
                                VALUES (@nom, @ced, @tel, @email, @bancoId, @numCuenta, @obs, 'ACTIVO', GETDATE(), @userId)",
                                new { nom, ced, tel, email, bancoId, numCuenta, obs, userId });
                            insertados++;
                        }
                    }
                    catch (Exception exItem)
                    {
                        errores.Add($"Error en propietario '{item.Nombre}': {exItem.Message}");
                    }
                }

                return Ok(new
                {
                    totalRecibidos = items.Count,
                    insertados,
                    actualizados,
                    errores
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error durante la importación de propietarios: " + ex.Message });
            }
        }

        /// <summary>
        /// Importación masiva de Fincas (con vinculación y auto-creación opcional de Propietarios)
        /// </summary>
        [HttpPost("importar/fincas")]
        public async Task<IActionResult> ImportarFincas([FromBody] ImportarFincasRequest request)
        {
            if (request == null || request.Items == null || request.Items.Count == 0)
                return BadRequest(new { message = "No se recibieron fincas para importar." });

            int insertados = 0;
            int actualizados = 0;
            int propietariosAutoCreados = 0;
            var errores = new List<string>();
            int userId = GetUserId();

            try
            {
                using var conn = CreateConnection();
                var bancos = (await conn.QueryAsync<Banco>("SELECT * FROM Bancos WHERE Activo = 1")).ToList();
                var companias = (await conn.QueryAsync<Compania>("SELECT * FROM Companias WHERE Activo = 1")).ToList();
                var propietarios = (await conn.QueryAsync<Propietario>("SELECT * FROM Propietarios WHERE Estado = 'ACTIVO'")).ToList();

                foreach (var item in request.Items)
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(item.Nombre))
                        {
                            errores.Add($"Fila omitida: Nombre de finca requerido.");
                            continue;
                        }

                        string nom = item.Nombre.Trim();
                        string? cod = string.IsNullOrWhiteSpace(item.Codigo) ? null : item.Codigo.Trim();
                        string propNombre = (item.Propietario ?? item.PropietarioNombre ?? string.Empty).Trim();
                        string? ced = string.IsNullOrWhiteSpace(item.CedulaRIF) ? null : item.CedulaRIF.Trim();
                        string? tel = string.IsNullOrWhiteSpace(item.Telefono) ? null : item.Telefono.Trim();
                        string? numCuenta = string.IsNullOrWhiteSpace(item.NumeroCuenta) ? null : item.NumeroCuenta.Trim();
                        decimal pUSD = item.PrecioLitroUSD;
                        decimal pAcida = item.PrecioLitroAcidaUSD;
                        bool tiene2Tipos = item.TieneDosTiposLeche;
                        string tipoLeche = string.IsNullOrWhiteSpace(item.TipoLeche) ? "VACA" : item.TipoLeche.Trim().ToUpperInvariant();

                        // Buscar o auto-crear propietario
                        int? propId = item.PropietarioId;
                        if (!propId.HasValue && !string.IsNullOrWhiteSpace(propNombre))
                        {
                            var pEncontrado = propietarios.FirstOrDefault(p => 
                                (!string.IsNullOrEmpty(ced) && p.CedulaRIF == ced) ||
                                p.Nombre.Equals(propNombre, StringComparison.OrdinalIgnoreCase));

                            if (pEncontrado != null)
                            {
                                propId = pEncontrado.Id;
                                propNombre = pEncontrado.Nombre;
                            }
                            else if (request.AutoCrearPropietarios)
                            {
                                // Auto-crear propietario si está activado
                                int nuevoPropId = await conn.QuerySingleAsync<int>(@"
                                    INSERT INTO Propietarios (Nombre, CedulaRIF, Telefono, Estado, CreatedAt, CreatedBy)
                                    VALUES (@propNombre, @ced, @tel, 'ACTIVO', GETDATE(), @userId);
                                    SELECT CAST(SCOPE_IDENTITY() as int);",
                                    new { propNombre, ced, tel, userId });

                                propId = nuevoPropId;
                                propietarios.Add(new Propietario { Id = nuevoPropId, Nombre = propNombre, CedulaRIF = ced, Telefono = tel });
                                propietariosAutoCreados++;
                            }
                        }

                        // Buscar Banco si viene por nombre
                        int? bancoId = item.BancoId;
                        if (!bancoId.HasValue && !string.IsNullOrWhiteSpace(item.BancoNombre))
                        {
                            var bEncontrado = bancos.FirstOrDefault(b => 
                                b.Nombre.Equals(item.BancoNombre.Trim(), StringComparison.OrdinalIgnoreCase) ||
                                b.Codigo.Equals(item.BancoNombre.Trim(), StringComparison.OrdinalIgnoreCase));
                            if (bEncontrado != null) bancoId = bEncontrado.Id;
                        }

                        // Buscar Compañía si viene por nombre
                        int? compId = item.CompaniaId;
                        if (!compId.HasValue && !string.IsNullOrWhiteSpace(item.CompaniaNombre))
                        {
                            var cEncontrada = companias.FirstOrDefault(c => 
                                c.Nombre.Equals(item.CompaniaNombre.Trim(), StringComparison.OrdinalIgnoreCase));
                            if (cEncontrada != null) compId = cEncontrada.Id;
                        }

                        // Buscar si ya existe la finca por Nombre o Código
                        var fincaExistente = await conn.QueryFirstOrDefaultAsync<Finca>(
                            "SELECT TOP 1 * FROM Fincas WHERE (Codigo IS NOT NULL AND Codigo = @cod) OR LOWER(Nombre) = LOWER(@nom)",
                            new { cod, nom });

                        if (fincaExistente != null)
                        {
                            // Actualizar finca existente
                            await conn.ExecuteAsync(@"
                                UPDATE Fincas 
                                SET Nombre = @nom,
                                    Codigo = COALESCE(@cod, Codigo),
                                    Propietario = COALESCE(NULLIF(@propNombre, ''), Propietario),
                                    PropietarioId = COALESCE(@propId, PropietarioId),
                                    CedulaRIF = COALESCE(@ced, CedulaRIF),
                                    Telefono = COALESCE(@tel, Telefono),
                                    BancoId = COALESCE(@bancoId, BancoId),
                                    NumeroCuenta = COALESCE(@numCuenta, NumeroCuenta),
                                    CompaniaId = COALESCE(@compId, CompaniaId),
                                    PrecioLitroUSD = CASE WHEN @pUSD > 0 THEN @pUSD ELSE PrecioLitroUSD END,
                                    PrecioLitroAcidaUSD = CASE WHEN @pAcida > 0 THEN @pAcida ELSE PrecioLitroAcidaUSD END,
                                    TieneDosTiposLeche = @tiene2Tipos,
                                    TipoLeche = @tipoLeche
                                WHERE Id = @id",
                                new { nom, cod, propNombre, propId, ced, tel, bancoId, numCuenta, compId, pUSD, pAcida, tiene2Tipos, tipoLeche, id = fincaExistente.Id });
                            actualizados++;
                        }
                        else
                        {
                            // Insertar nueva finca
                            await conn.ExecuteAsync(@"
                                INSERT INTO Fincas (Codigo, Nombre, Propietario, PropietarioId, CedulaRIF, Telefono, BancoId, NumeroCuenta, CompaniaId, PrecioLitroUSD, PrecioLitroAcidaUSD, TieneDosTiposLeche, TipoLeche, Activo, CreatedAt)
                                VALUES (@cod, @nom, @propNombre, @propId, @ced, @tel, @bancoId, @numCuenta, @compId, @pUSD, @pAcida, @tiene2Tipos, @tipoLeche, 1, GETDATE())",
                                new { cod, nom, propNombre, propId, ced, tel, bancoId, numCuenta, compId, pUSD, pAcida, tiene2Tipos, tipoLeche });
                            insertados++;
                        }
                    }
                    catch (Exception exFinca)
                    {
                        errores.Add($"Error en finca '{item.Nombre}': {exFinca.Message}");
                    }
                }

                return Ok(new
                {
                    totalRecibidos = request.Items.Count,
                    insertados,
                    actualizados,
                    propietariosAutoCreados,
                    errores
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error durante la importación de fincas: " + ex.Message });
            }
        }

        /// <summary>
        /// Importación masiva de Compañías / Receptorías
        /// </summary>
        [HttpPost("importar/companias")]
        public async Task<IActionResult> ImportarCompanias([FromBody] List<ImportarCompaniaItemDto> items)
        {
            if (items == null || items.Count == 0)
                return BadRequest(new { message = "No se recibieron compañías para importar." });

            int insertados = 0;
            int actualizados = 0;
            var errores = new List<string>();

            try
            {
                using var conn = CreateConnection();

                foreach (var item in items)
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(item.Nombre))
                        {
                            errores.Add("Fila omitida: Nombre de compañía requerido.");
                            continue;
                        }

                        string nom = item.Nombre.Trim();
                        string? enc = string.IsNullOrWhiteSpace(item.Encargado) ? null : item.Encargado.Trim();
                        string? tel = string.IsNullOrWhiteSpace(item.Telefono) ? null : item.Telefono.Trim();
                        string? dir = string.IsNullOrWhiteSpace(item.Direccion) ? null : item.Direccion.Trim();
                        decimal pCompra = item.PrecioCompraLitroUSD;
                        decimal? pBufala = item.PrecioBufalaLitroUSD;
                        decimal? pAcida = item.PrecioAcidaLitroUSD;

                        var existente = await conn.QueryFirstOrDefaultAsync<Compania>(
                            "SELECT TOP 1 * FROM Companias WHERE LOWER(Nombre) = LOWER(@nom)",
                            new { nom });

                        if (existente != null)
                        {
                            await conn.ExecuteAsync(@"
                                UPDATE Companias 
                                SET Nombre = @nom,
                                    Encargado = COALESCE(@enc, Encargado),
                                    Telefono = COALESCE(@tel, Telefono),
                                    Direccion = COALESCE(@dir, Direccion),
                                    PrecioCompraLitroUSD = CASE WHEN @pCompra > 0 THEN @pCompra ELSE PrecioCompraLitroUSD END,
                                    PrecioBufalaLitroUSD = COALESCE(@pBufala, PrecioBufalaLitroUSD),
                                    PrecioAcidaLitroUSD = COALESCE(@pAcida, PrecioAcidaLitroUSD)
                                WHERE Id = @id",
                                new { nom, enc, tel, dir, pCompra, pBufala, pAcida, id = existente.Id });
                            actualizados++;
                        }
                        else
                        {
                            await conn.ExecuteAsync(@"
                                INSERT INTO Companias (Nombre, Encargado, Telefono, Direccion, PrecioCompraLitroUSD, PrecioBufalaLitroUSD, PrecioAcidaLitroUSD, Activo, IsDeleted)
                                VALUES (@nom, @enc, @tel, @dir, @pCompra, @pBufala, @pAcida, 1, 0)",
                                new { nom, enc, tel, dir, pCompra, pBufala, pAcida });
                            insertados++;
                        }
                    }
                    catch (Exception exItem)
                    {
                        errores.Add($"Error en compañía '{item.Nombre}': {exItem.Message}");
                    }
                }

                return Ok(new
                {
                    totalRecibidos = items.Count,
                    insertados,
                    actualizados,
                    errores
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error durante la importación de compañías: " + ex.Message });
            }
        }

        /// <summary>
        /// Importación masiva de Bancos
        /// </summary>
        [HttpPost("importar/bancos")]
        public async Task<IActionResult> ImportarBancos([FromBody] List<ImportarBancoItemDto> items)
        {
            if (items == null || items.Count == 0)
                return BadRequest(new { message = "No se recibieron bancos para importar." });

            int insertados = 0;
            int actualizados = 0;
            var errores = new List<string>();

            try
            {
                using var conn = CreateConnection();

                foreach (var item in items)
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(item.Nombre) && string.IsNullOrWhiteSpace(item.Codigo))
                        {
                            errores.Add("Fila omitida: Nombre o Código de banco requerido.");
                            continue;
                        }

                        string nom = (item.Nombre ?? string.Empty).Trim();
                        string cod = (item.Codigo ?? string.Empty).Trim();

                        var existente = await conn.QueryFirstOrDefaultAsync<Banco>(
                            "SELECT TOP 1 * FROM Bancos WHERE (Codigo = @cod AND @cod <> '') OR LOWER(Nombre) = LOWER(@nom)",
                            new { cod, nom });

                        if (existente != null)
                        {
                            await conn.ExecuteAsync(@"
                                UPDATE Bancos 
                                SET Nombre = CASE WHEN @nom <> '' THEN @nom ELSE Nombre END,
                                    Codigo = CASE WHEN @cod <> '' THEN @cod ELSE Codigo END,
                                    Activo = 1
                                WHERE Id = @id",
                                new { nom, cod, id = existente.Id });
                            actualizados++;
                        }
                        else
                        {
                            await conn.ExecuteAsync(@"
                                INSERT INTO Bancos (Codigo, Nombre, Activo)
                                VALUES (@cod, @nom, 1)",
                                new { cod, nom });
                            insertados++;
                        }
                    }
                    catch (Exception exItem)
                    {
                        errores.Add($"Error en banco '{item.Nombre}': {exItem.Message}");
                    }
                }

                return Ok(new
                {
                    totalRecibidos = items.Count,
                    insertados,
                    actualizados,
                    errores
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error durante la importación de bancos: " + ex.Message });
            }
        }

        /// <summary>
        /// Exportación de data completa de una entidad para respaldo o sincronización en Excel
        /// </summary>
        [HttpGet("exportar/{entidad}")]
        public async Task<IActionResult> ExportarData(string entidad)
        {
            try
            {
                using var conn = CreateConnection();
                var ent = entidad.Trim().ToUpperInvariant();

                switch (ent)
                {
                    case "FINCAS":
                        var fincas = await conn.QueryAsync(@"
                            SELECT f.Id, f.Codigo, f.Nombre, f.Propietario, f.PropietarioId,
                                   p.Nombre AS PropietarioNombre, f.CedulaRIF, f.Telefono,
                                   b.Nombre AS BancoNombre, f.NumeroCuenta,
                                   c.Nombre AS CompaniaNombre,
                                   f.PrecioLitroUSD, f.PrecioLitroAcidaUSD, f.TieneDosTiposLeche, f.TipoLeche,
                                   f.Activo
                            FROM Fincas f
                            LEFT JOIN Propietarios p ON f.PropietarioId = p.Id
                            LEFT JOIN Bancos b ON f.BancoId = b.Id
                            LEFT JOIN Companias c ON f.CompaniaId = c.Id
                            ORDER BY f.Nombre ASC");
                        return Ok(fincas);

                    case "PROPIETARIOS":
                        var props = await conn.QueryAsync(@"
                            SELECT p.Id, p.Nombre, p.CedulaRIF, p.Telefono, p.Email,
                                   b.Nombre AS BancoNombre, p.NumeroCuenta, p.Observacion, p.Estado,
                                   (SELECT COUNT(1) FROM Fincas f WHERE f.PropietarioId = p.Id) AS TotalFincasAsociadas
                            FROM Propietarios p
                            LEFT JOIN Bancos b ON p.BancoId = b.Id
                            ORDER BY p.Nombre ASC");
                        return Ok(props);

                    case "COMPANIAS":
                        var comps = await conn.QueryAsync(@"
                            SELECT Id, Nombre, Encargado, Telefono, Direccion,
                                   PrecioCompraLitroUSD, PrecioBufalaLitroUSD, PrecioAcidaLitroUSD,
                                   DiaAperturaSemana, DiaCierreSemana, Activo
                            FROM Companias
                            WHERE IsDeleted = 0
                            ORDER BY Nombre ASC");
                        return Ok(comps);

                    case "BANCOS":
                        var bancos = await conn.QueryAsync(@"
                            SELECT Id, Codigo, Nombre, Activo
                            FROM Bancos
                            ORDER BY Codigo ASC");
                        return Ok(bancos);

                    default:
                        return BadRequest(new { message = $"Entidad '{entidad}' no soportada para exportación." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al exportar entidad: " + ex.Message });
            }
        }

        /// <summary>
        /// Descarga la plantilla oficial en Excel (.xlsx) o CSV (.csv) con encabezado Content-Disposition explícito
        /// garantizando que el navegador guarde el archivo con su nombre y extensión correcta.
        /// </summary>
        [HttpGet("descargar-plantilla/{entidad}")]
        [AllowAnonymous]
        public IActionResult DescargarPlantilla(string entidad, [FromQuery] string formato = "xlsx")
        {
            var ent = entidad.Trim().ToUpperInvariant();
            var ext = formato.Trim().ToLowerInvariant() == "csv" ? "csv" : "xlsx";
            var filename = $"Plantilla_Importacion_{ent}.{ext}";

            var baseDir = AppContext.BaseDirectory;
            var currentDir = Directory.GetCurrentDirectory();

            string? targetPath = null;
            string[] possiblePaths = new[]
            {
                Path.Combine(currentDir, "wwwroot", "plantillas", filename),
                Path.Combine(baseDir, "wwwroot", "plantillas", filename),
                Path.Combine(currentDir, "Frontend", "plantillas", filename)
            };

            foreach (var p in possiblePaths)
            {
                if (System.IO.File.Exists(p))
                {
                    targetPath = p;
                    break;
                }
            }

            if (targetPath == null)
            {
                return NotFound(new { message = $"Plantilla no encontrada: {filename}" });
            }

            var contentType = ext == "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv; charset=utf-8";

            var fileBytes = System.IO.File.ReadAllBytes(targetPath);
            return File(fileBytes, contentType, filename);
        }

        /// <summary>
        /// Recibe contenido en Base64 y lo devuelve como archivo adjunto nativo con Content-Disposition.
        /// Garantiza que Chrome/Edge descarguen cualquier archivo exportado con su nombre y extensión sin UUIDs.
        /// </summary>
        [HttpPost("descargar-archivo")]
        [AllowAnonymous]
        public IActionResult DescargarArchivo([FromForm] string base64Content, [FromForm] string nombreArchivo, [FromForm] string? contentType)
        {
            if (string.IsNullOrWhiteSpace(base64Content) || string.IsNullOrWhiteSpace(nombreArchivo))
            {
                return BadRequest(new { message = "Contenido o nombre de archivo inválido." });
            }

            var type = string.IsNullOrWhiteSpace(contentType) 
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                : contentType;

            var bytes = Convert.FromBase64String(base64Content);
            return File(bytes, type, nombreArchivo);
        }
    }

    // DTOs auxiliares para importación
    public class ImportarFincasRequest
    {
        public List<ImportarFincaItemDto> Items { get; set; } = new();
        public bool AutoCrearPropietarios { get; set; } = true;
    }

    public class ImportarFincaItemDto
    {
        public string? Codigo { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Propietario { get; set; }
        public string? PropietarioNombre { get; set; }
        public int? PropietarioId { get; set; }
        public string? CedulaRIF { get; set; }
        public string? Telefono { get; set; }
        public int? BancoId { get; set; }
        public string? BancoNombre { get; set; }
        public string? NumeroCuenta { get; set; }
        public int? CompaniaId { get; set; }
        public string? CompaniaNombre { get; set; }
        public decimal PrecioLitroUSD { get; set; } = 0.4000m;
        public decimal PrecioLitroAcidaUSD { get; set; } = 0.0000m;
        public bool TieneDosTiposLeche { get; set; } = false;
        public string? TipoLeche { get; set; } = "VACA";
    }

    public class ImportarPropietarioItemDto
    {
        public string Nombre { get; set; } = string.Empty;
        public string? CedulaRIF { get; set; }
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public int? BancoId { get; set; }
        public string? BancoNombre { get; set; }
        public string? NumeroCuenta { get; set; }
        public string? Observacion { get; set; }
    }

    public class ImportarCompaniaItemDto
    {
        public string Nombre { get; set; } = string.Empty;
        public string? Encargado { get; set; }
        public string? Telefono { get; set; }
        public string? Direccion { get; set; }
        public decimal PrecioCompraLitroUSD { get; set; } = 0.5000m;
        public decimal? PrecioBufalaLitroUSD { get; set; }
        public decimal? PrecioAcidaLitroUSD { get; set; }
    }

    public class ImportarBancoItemDto
    {
        public string? Codigo { get; set; }
        public string Nombre { get; set; } = string.Empty;
    }
}
