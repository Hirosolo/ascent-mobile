param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('debug', 'release')]
  [string]$Variant
)

$root = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $root 'package.json'
$outputDir = Join-Path $root 'apk-output'

$package = Get-Content $packagePath -Raw | ConvertFrom-Json
$appName = $package.name
$version = $package.version
$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'

$sourceApk = Join-Path $root "android\app\build\outputs\apk\$Variant\app-$Variant.apk"
if (-not (Test-Path $sourceApk)) {
  Write-Error "APK not found: $sourceApk"
  exit 1
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$versionedName = "$appName-v$version-$Variant-$timestamp.apk"
$versionedPath = Join-Path $outputDir $versionedName
$latestPath = Join-Path $outputDir "$appName-$Variant-latest.apk"

Copy-Item -Force $sourceApk $versionedPath
Copy-Item -Force $sourceApk $latestPath

Write-Output "Created: $versionedPath"
Write-Output "Updated latest: $latestPath"
