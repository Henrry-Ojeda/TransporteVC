Add-Type -AssemblyName System.Data
$connStr = 'Server=localhost;Database=BD_TRANSPORTE_V2;Trusted_Connection=True;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, Nombre, PrecioCompraLitroUSD, TipoServicioId FROM TB_COMPANIAS WHERE IsDeleted = 0 ORDER BY TipoServicioId DESC, Nombre"
$reader = $cmd.ExecuteReader()
$dt = New-Object System.Data.DataTable
$dt.Load($reader)
$conn.Close()
$dt | Format-Table -AutoSize
