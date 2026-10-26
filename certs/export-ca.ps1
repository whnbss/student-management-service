# 导出公司网关根证书为 PEM（供 Node NODE_EXTRA_CA_CERTS 使用）
$stores = @('Cert:\CurrentUser\Root', 'Cert:\LocalMachine\Root', 'Cert:\LocalMachine\CA', 'Cert:\CurrentUser\CA')
$found = $null
foreach ($s in $stores) {
  if (-not (Test-Path $s)) { continue }
  $c = Get-ChildItem $s | Where-Object { $_.Subject -match 'Hihonor Web Secure Internet Gateway' } | Select-Object -First 1
  if ($c) { $found = $c; Write-Host "found in $s : $($c.Subject)"; break }
}
if (-not $found) { Write-Host 'NOT FOUND'; exit 1 }
$b64 = [Convert]::ToBase64String($found.RawData, [Base64FormattingOptions]::InsertLineBreaks)
$pem = "-----BEGIN CERTIFICATE-----`n$b64`n-----END CERTIFICATE-----"
Set-Content -Path "$PSScriptRoot\corporate-ca.pem" -Value $pem -Encoding ascii
Write-Host "exported to $PSScriptRoot\corporate-ca.pem"
