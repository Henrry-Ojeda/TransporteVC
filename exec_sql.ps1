param([string]$query)
$cs = "Data Source=localhost;Initial Catalog=BD_CV_PROD;Persist Security Info=True;User ID=sa;Password=1234;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = $query
$adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
$t = New-Object System.Data.DataTable
$adapter.Fill($t) | Out-Null
$t | Format-Table -AutoSize
$conn.Close()
