param(
  [ValidateSet("build", "run", "all")]
  [string]$Action = "all",
  [switch]$Detach
)

$ErrorActionPreference = "Stop"
$composeFile = "docker-compose.osrm.yml"

function Invoke-Compose {
  param([string[]]$Args)
  $display = $Args -join " "
  Write-Host ">> docker compose -f $composeFile $display"
  & docker compose -f $composeFile @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Docker compose failed: $display"
  }
}

if ($Action -eq "build" -or $Action -eq "all") {
  Invoke-Compose @("run", "--rm", "osrm-extract")
  Invoke-Compose @("run", "--rm", "osrm-partition")
  Invoke-Compose @("run", "--rm", "osrm-customize")
}

if ($Action -eq "run" -or $Action -eq "all") {
  $upArgs = @("up")
  if ($Detach) {
    $upArgs += "-d"
  }
  $upArgs += "osrm-routed"
  Invoke-Compose $upArgs
}
