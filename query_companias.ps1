Add-Type -AssemblyName System.Data
$connStr = 'Server=localhost;Database=BD_TRANSPORTE_V2;Trusted_Connection=True;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "
SELECT c.Id, c.Nombre, c.PrecioCompraLitroUSD, 
       (SELECT COUNT(*) FROM TB_CONTROL_COMPANIAS cc WHERE cc.CompaniaId = c.Id AND cc.Fecha >= '2026-09-01' AND cc.Fecha <= '2026-09-07') as TicketsCount,
       (SELECT SUM(COALESCE(NULLIF(cc.LitrosRecibidosCompania,0), cc.LitrosDespachados, 0)) FROM TB_CONTROL_COMPANIAS cc WHERE cc.CompaniaId = c.Id AND cc.Fecha >= '2026-09-01' AND cc.Fecha <= '2026-09-07') as LitrosSemana
FROM TB_COMPANIAS c
WHERE c.IsDeleted = 0
ORDER BY c.Nombre
"
$reader = $cmd.ExecuteReader()
$dt = New-Object System.Data.DataTable
$dt.Load($reader)
$conn.Close()
$dt | Format-Table -AutoSize
