using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.IO;
using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Transporte.Core.Interfaces;

namespace Transporte.API.Multitenancy
{
    public class TenantInfo
    {
        public int EmpresaId { get; set; }
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string ConnectionString { get; set; } = "";
        public string Estado { get; set; } = "ACTIVA";
        public DateTime FechaVencimiento { get; set; }
        public int DiasGracia { get; set; }
        public List<string> Modulos { get; set; } = new();
    }

    public class TenantService : ITenantService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TenantService> _logger;

        private static readonly ConcurrentDictionary<string, (TenantInfo info, DateTime cachedAt)> _tenantCache = new();
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);

        private TenantInfo? _currentTenant;

        public static bool IsRunningInDocker => 
            File.Exists("/.dockerenv") || 
            string.Equals(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"), "true", StringComparison.OrdinalIgnoreCase);

        public static string AdjustConnectionStringForEnvironment(string connStr)
        {
            if (string.IsNullOrWhiteSpace(connStr)) return connStr;
            if (IsRunningInDocker && connStr.Contains("84.247.178.194"))
            {
                return connStr.Replace("84.247.178.194", "sql_instancia");
            }
            return connStr;
        }

        public TenantService(
            IHttpContextAccessor httpContextAccessor,
            IConfiguration configuration,
            ILogger<TenantService> logger)
        {
            _httpContextAccessor = httpContextAccessor;
            _configuration = configuration;
            _logger = logger;
            ResolveTenant();
        }

        private void ResolveTenant()
        {
            var context = _httpContextAccessor.HttpContext;
            string host = "localhost";

            if (context != null)
            {
                if (context.Request.Headers.TryGetValue("X-Tenant-Domain", out var headerDomain) && !string.IsNullOrWhiteSpace(headerDomain))
                {
                    host = headerDomain.ToString();
                }
                else if (context.Request.Headers.TryGetValue("X-Tenant-Code", out var headerCode) && !string.IsNullOrWhiteSpace(headerCode))
                {
                    host = headerCode.ToString();
                }
                else if (context.Request.Headers.TryGetValue("X-Forwarded-Host", out var fwdHost) && !string.IsNullOrWhiteSpace(fwdHost))
                {
                    host = fwdHost.ToString();
                }
                else if (context.Request.Query.TryGetValue("tenant", out var qTenant) && !string.IsNullOrWhiteSpace(qTenant))
                {
                    host = qTenant.ToString();
                }
                else
                {
                    host = context.Request.Host.Host;
                }
            }

            cleanHost(ref host);

            if (_tenantCache.TryGetValue(host, out var cached) && (DateTime.UtcNow - cached.cachedAt) < CacheDuration)
            {
                _currentTenant = cached.info;
                return;
            }

            try
            {
                string sqlHost = IsRunningInDocker ? "sql_instancia" : "84.247.178.194";
                string masterConn = $"Server={sqlHost},1433;Database=DB_SAAS_MASTER;User Id=sa;Password=sql_HO_2026!;TrustServerCertificate=True;Connect Timeout=5;";
                using var db = new SqlConnection(masterConn);
                
                var emp = db.QueryFirstOrDefault<dynamic>(
                    @"SELECT Id, Codigo, NombreComercial, CadenaConexion, Estado, FechaVencimientoLicencia, DiasGraciaMora
                      FROM TB_EMPRESAS
                      WHERE DominioPrincipal = @h OR SubdominioAlterno = @h OR Codigo = @h",
                    new { h = host });

                if (emp == null && (host == "localhost" || host == "127.0.0.1" || host == "84.247.178.194"))
                {
                    emp = db.QueryFirstOrDefault<dynamic>(
                        "SELECT Id, Codigo, NombreComercial, CadenaConexion, Estado, FechaVencimientoLicencia, DiasGraciaMora FROM TB_EMPRESAS WHERE Codigo = 'CAMPO_VERDE'");
                }

                if (emp != null)
                {
                    int empId = (int)emp.Id;
                    var mods = db.Query<string>(
                        "SELECT ModuloCodigo FROM TB_EMPRESA_MODULOS WHERE EmpresaId = @empId AND Habilitado = 1",
                        new { empId }).AsList();

                    string effectiveConnStr = AdjustConnectionStringForEnvironment((string)emp.CadenaConexion);

                    var tInfo = new TenantInfo
                    {
                        EmpresaId = empId,
                        Codigo = emp.Codigo,
                        Nombre = emp.NombreComercial,
                        ConnectionString = effectiveConnStr,
                        Estado = emp.Estado,
                        FechaVencimiento = emp.FechaVencimientoLicencia,
                        DiasGracia = emp.DiasGraciaMora,
                        Modulos = mods
                    };

                    _tenantCache[host] = (tInfo, DateTime.UtcNow);
                    _currentTenant = tInfo;
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Fallback a conexión local: {Msg}", ex.Message);
            }

            string fallbackConn = _configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=84.247.178.194,1433;Database=DB_PROD_CAMPO_VERDE;User Id=user_campoverde;Password=Campo_Verde_2026!;TrustServerCertificate=True;";
            
            _currentTenant = new TenantInfo
            {
                Codigo = "CAMPO_VERDE",
                Nombre = "Lácteos Campo Verde, C.A.",
                ConnectionString = AdjustConnectionStringForEnvironment(fallbackConn),
                Estado = "ACTIVA",
                FechaVencimiento = DateTime.UtcNow.AddYears(1),
                Modulos = new List<string> { "MOD_DASHBOARD", "MOD_LECHE_VACA", "MOD_LECHE_BUFALA", "MOD_LOGISTICA_RUTAS", "MOD_RECEPTORIA", "MOD_COMBUSTIBLE", "MOD_MANTENIMIENTO", "MOD_REPUESTOS", "MOD_LIQUIDACIONES", "MOD_HISTORIAL_BCV" }
            };
        }

        private static void cleanHost(ref string host)
        {
            if (string.IsNullOrWhiteSpace(host)) { host = "localhost"; return; }
            if (host.Contains(',')) host = host.Split(',')[0].Trim();
            host = host.Split(':')[0].Trim().ToLower();
        }

        public string GetConnectionString() => _currentTenant?.ConnectionString 
            ?? AdjustConnectionStringForEnvironment(_configuration.GetConnectionString("DefaultConnection") 
            ?? "Server=84.247.178.194,1433;Database=DB_PROD_CAMPO_VERDE;User Id=user_campoverde;Password=Campo_Verde_2026!;TrustServerCertificate=True;");

        public string GetTenantCode() => _currentTenant?.Codigo ?? "CAMPO_VERDE";
        public string GetTenantName() => _currentTenant?.Nombre ?? "Lácteos Campo Verde, C.A.";
        public List<string> GetModulosActivos() => _currentTenant?.Modulos ?? new List<string>();
        public bool TieneModulo(string moduloCodigo) => _currentTenant?.Modulos.Contains(moduloCodigo) ?? true;
    }
}
