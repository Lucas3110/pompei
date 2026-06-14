# Descarga Cinzel + Montserrat desde Google Fonts y genera css/fonts.css (self-hosted, offline)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ua   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
$proj = "C:\Users\lucas\Desktop\Pompei"
$fontsDir = Join-Path $proj "fonts"
New-Item -ItemType Directory -Force -Path $fontsDir | Out-Null

# Limpiar fuentes anteriores (Inter, etc.) para regenerar desde cero
Get-ChildItem -Path $fontsDir -Filter *.woff2 -ErrorAction SilentlyContinue | Remove-Item -Force

$cssUrl = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
Write-Output "Solicitando CSS de Google Fonts (Cinzel + Montserrat)..."
$css = (Invoke-WebRequest -Uri $cssUrl -UserAgent $ua -UseBasicParsing).Content

$keep = @("latin", "latin-ext")
$pattern = '(?s)/\*\s*([a-z0-9-]+)\s*\*/\s*@font-face\s*\{(.*?)\}'
$ms = [regex]::Matches($css, $pattern)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/* Fuentes self-hosted (offline) - Cinzel + Montserrat - subsets: latin, latin-ext */")
$downloaded = 0

foreach ($m in $ms) {
  $subset = $m.Groups[1].Value
  if ($keep -notcontains $subset) { continue }
  $block  = $m.Groups[2].Value
  $fam    = ([regex]::Match($block, "font-family:\s*'([^']+)'")).Groups[1].Value
  $style  = ([regex]::Match($block, 'font-style:\s*([a-z]+)')).Groups[1].Value
  $weight = ([regex]::Match($block, 'font-weight:\s*(\d+)')).Groups[1].Value
  $url    = ([regex]::Match($block, 'src:\s*url\(([^)]+)\)')).Groups[1].Value
  $range  = ([regex]::Match($block, 'unicode-range:\s*([^;}]+)')).Groups[1].Value.Trim()

  $slug = ($fam.ToLower()) + "-" + $weight + "-" + $style + "-" + $subset
  $file = "$slug.woff2"
  $dest = Join-Path $fontsDir $file

  Invoke-WebRequest -Uri $url -UserAgent $ua -UseBasicParsing -OutFile $dest
  $downloaded++

  [void]$sb.AppendLine("@font-face {")
  [void]$sb.AppendLine("  font-family: '$fam';")
  [void]$sb.AppendLine("  font-style: $style;")
  [void]$sb.AppendLine("  font-weight: $weight;")
  [void]$sb.AppendLine("  font-display: swap;")
  [void]$sb.AppendLine("  src: url('../fonts/$file') format('woff2');")
  [void]$sb.AppendLine("  unicode-range: $range;")
  [void]$sb.AppendLine("}")
}

Set-Content -Path (Join-Path $proj "css\fonts.css") -Value $sb.ToString() -Encoding UTF8
Write-Output "Archivos .woff2 descargados: $downloaded"
Write-Output "Generado: css\fonts.css"