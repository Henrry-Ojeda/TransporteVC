Set WshShell = CreateObject("WScript.Shell")
strCurrentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
strBatPath = strCurrentDir & "\AutoInicio_Transporte.bat"
WshShell.Run Chr(34) & strBatPath & Chr(34), 0, False
Set WshShell = Nothing
