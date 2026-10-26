$cs = "Data Source=localhost;Initial Catalog=BD_TRANSPORTE_V2;Persist Security Info=True;User ID=sa;Password=1234;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'SELECT * FROM TB_TIPO_SERVICIO'
$adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
$table = New-Object System.Data.DataTable
$adapter.Fill($table) | Out-Null
$table | Format-Table -AutoSize

$cmd.CommandText = 'SELECT f.Id, f.Nombre, f.TipoServicioId, ts.Nombre as TipoServicio, f.PrecioLitroUSD FROM TB_FINCAS f LEFT JOIN TB_TIPO_SERVICIO ts ON f.TipoServicioId = ts.Id WHERE f.Id IN (76, 72, 55, 54, 57, 71, 13114, 58, 38)'
$table2 = New-Object System.Data.DataTable
$adapter.SelectCommand = $cmd
$adapter.Fill($table2) | Out-Null
$table2 | Format-Table -AutoSize
$conn.Close()
