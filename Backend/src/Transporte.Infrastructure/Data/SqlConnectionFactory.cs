using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Transporte.Core.Interfaces;

namespace Transporte.Infrastructure.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly ITenantService? _tenantService;
    private readonly string? _fallbackConnectionString;

    public SqlConnectionFactory(IConfiguration configuration, ITenantService? tenantService = null)
    {
        _tenantService = tenantService;
        _fallbackConnectionString = configuration.GetConnectionString("BD_TRANSPORTE") 
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? "Server=84.247.178.194,1433;Database=DB_PROD_CAMPO_VERDE;User Id=user_campoverde;Password=Campo_Verde_2026!;TrustServerCertificate=True;";
    }

    public IDbConnection CreateConnection()
    {
        var connStr = _tenantService?.GetConnectionString() ?? _fallbackConnectionString!;
        if (File.Exists("/.dockerenv") || string.Equals(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"), "true", StringComparison.OrdinalIgnoreCase))
        {
            connStr = connStr.Replace("84.247.178.194", "sql_instancia").Replace("127.0.0.1", "sql_instancia");
        }
        return new SqlConnection(connStr);
    }
}
