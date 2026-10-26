Add-Type -AssemblyName System.Data
$connStr = 'Server=localhost;Database=BD_TRANSPORTE_V2;Trusted_Connection=True;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, Nombre, Propietario, PrecioLitroUSD, TipoServicioId FROM TB_FINCAS WHERE TipoServicioId = 2 OR Id IN (54, 55, 57, 58, 71, 72, 76, 13114) ORDER BY Id"
$reader = $cmd.ExecuteReader()
$dt = New-Object System.Data.DataTable
$dt.Load($reader)
$conn.Close()
$dt | Format-Table -AutoSize
