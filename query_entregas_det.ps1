Add-Type -AssemblyName System.Data
$connStr = 'Server=localhost;Database=BD_TRANSPORTE_V2;Trusted_Connection=True;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "
SELECT cc.Id, c.Id AS CompId, c.Nombre AS CompNombre, c.PrecioCompraLitroUSD AS PrecioDefecto,
       COALESCE(NULLIF(cc.LitrosRecibidosCompania,0), cc.LitrosDespachados, 0) as Litros,
       cc.TipoLeche, cc.Observacion
FROM TB_CONTROL_COMPANIAS cc
INNER JOIN TB_COMPANIAS c ON cc.CompaniaId = c.Id
WHERE cc.Fecha >= '2026-09-01' AND cc.Fecha <= '2026-09-07'
ORDER BY c.Nombre, cc.TipoLeche
"
$reader = $cmd.ExecuteReader()
$dt = New-Object System.Data.DataTable
$dt.Load($reader)
$conn.Close()
$dt | Format-Table -AutoSize
