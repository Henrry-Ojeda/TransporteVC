Add-Type -AssemblyName System.Data
$connStr = 'Server=localhost;Database=BD_TRANSPORTE_V2;Trusted_Connection=True;TrustServerCertificate=True;'
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TB_CONTROL_COMPANIAS'"
$reader = $cmd.ExecuteReader()
$dt = New-Object System.Data.DataTable
$dt.Load($reader)
$conn.Close()
$dt | Format-Table -AutoSize
