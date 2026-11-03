$connString = "Server=84.247.178.194,1433;Database=DB_PROD_TRANSPORTE_VERGEL_CARRILLO;User Id=sa;Password=sql_HO_2026!;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TB_CONTROL_RUTAS'"
$adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null
$conn.Close()
$dt | Format-Table -AutoSize
