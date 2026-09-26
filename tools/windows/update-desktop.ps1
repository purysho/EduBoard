# Installs the newest EduBoard test build on this computer. Run by Update-EduBoard.cmd
# (double-click that, not this). The build comes from the "test-latest" pre-release
# that GitHub Actions publishes after each desktop change (.github/workflows/test-build.yml).
#
# The repository is private, so a read-only GitHub token is needed: asked for once, then
# kept in %LOCALAPPDATA%\EduBoard-Updater (only this Windows user can read it).
param(
  [string]$Repo = 'purysho/EduBoard',
  [string]$Tag = 'test-latest',
  # Download and check the installer without installing (used by CI to test this script).
  [switch]$DownloadOnly
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 may default to old TLS versions GitHub refuses.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

$dir = Join-Path $env:LOCALAPPDATA 'EduBoard-Updater'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$tokenFile = Join-Path $dir 'github-token.txt'
$stampFile = Join-Path $dir 'installed-build.txt'

$token = $env:EDUBOARD_GITHUB_TOKEN
if (-not $token -and (Test-Path $tokenFile)) { $token = (Get-Content $tokenFile -Raw).Trim() }
if (-not $token) {
  Write-Host ''
  Write-Host '  First time: this needs a read-only GitHub token for the EduBoard repository.'
  Write-Host '  (The same kind you made for the server: Contents = Read-only. You can reuse it.)'
  Write-Host '  Make one at https://github.com/settings/personal-access-tokens/new'
  Write-Host ''
  $token = (Read-Host '  Paste the token and press Enter').Trim()
  if (-not $token) { Write-Host '  No token given; skipping the desktop update.'; exit 1 }
  Set-Content -Path $tokenFile -Value $token -NoNewline
}

$client = New-Object System.Net.Http.HttpClient((New-Object System.Net.Http.HttpClientHandler -Property @{ AllowAutoRedirect = $false }))
$client.Timeout = [TimeSpan]::FromMinutes(10)
function Send([string]$url, [string]$accept, [bool]$auth) {
  $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, $url)
  $req.Headers.UserAgent.ParseAdd('EduBoard-Updater')
  $req.Headers.Accept.ParseAdd($accept)
  if ($auth) { $req.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $token) }
  return $client.SendAsync($req, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
}

# Which build is newest.
$resp = Send "https://api.github.com/repos/$Repo/releases/tags/$Tag" 'application/vnd.github+json' $true
$code = [int]$resp.StatusCode
if ($code -eq 401) {
  Remove-Item $tokenFile -ErrorAction SilentlyContinue
  Write-Host '  GitHub rejected the token (expired or mistyped). Run this again to enter a new one.'
  exit 1
}
if ($code -eq 404) {
  Write-Host '  No test build found yet, or the token cannot read this repository (it needs Contents: Read-only on EduBoard).'
  exit 1
}
if ($code -ne 200) { Write-Host "  GitHub answered $code; try again later."; exit 1 }
$release = $resp.Content.ReadAsStringAsync().Result | ConvertFrom-Json
$asset = $release.assets | Where-Object { $_.name -eq 'EduBoard-Setup.exe' } | Select-Object -First 1
if (-not $asset) { Write-Host '  The newest build has no installer attached.'; exit 1 }

$build = "$($asset.id)"
if (-not $DownloadOnly -and (Test-Path $stampFile) -and ((Get-Content $stampFile -Raw).Trim() -eq $build)) {
  Write-Host "  The desktop app is already the newest build ($($release.name))."
  exit 0
}

# Download. GitHub answers with a redirect to a signed storage link, which must be fetched
# WITHOUT the GitHub token (the storage service rejects it), so redirects are followed here.
Write-Host "  Downloading $($release.name)..."
$out = Join-Path $env:TEMP 'EduBoard-Setup.exe'
$resp = Send $asset.url 'application/octet-stream' $true
$hops = 0
while ([int]$resp.StatusCode -ge 300 -and [int]$resp.StatusCode -lt 400 -and $hops -lt 5) {
  $resp = Send $resp.Headers.Location.AbsoluteUri 'application/octet-stream' $false
  $hops++
}
if (-not $resp.IsSuccessStatusCode) { Write-Host "  Download failed ($([int]$resp.StatusCode))."; exit 1 }
$stream = $resp.Content.ReadAsStreamAsync().Result
$file = [System.IO.File]::Create($out)
try { $stream.CopyTo($file) } finally { $file.Close(); $stream.Close() }

$size = (Get-Item $out).Length
if ($size -ne $asset.size) { Write-Host "  The download was incomplete ($size of $($asset.size) bytes). Try again."; exit 1 }
Write-Host ('  Downloaded {0:N0} MB.' -f ($size / 1MB))
if ($DownloadOnly) { exit 0 }

# Close EduBoard politely (so it can finish saving), then install over it and reopen.
$running = Get-Process -Name 'EduBoard' -ErrorAction SilentlyContinue
if ($running) {
  Write-Host '  Closing EduBoard...'
  $running | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  Start-Sleep -Seconds 5
  Get-Process -Name 'EduBoard' -ErrorAction SilentlyContinue | Stop-Process -Force
}
Write-Host '  Installing (your classes and data are kept)...'
# Not Start-Process -Wait: that also waits for the reopened app, i.e. until it's closed.
$p = [System.Diagnostics.Process]::Start($out, '/S --force-run')
$p.WaitForExit()
if ($p.ExitCode -ne 0) { Write-Host "  The installer stopped with code $($p.ExitCode)."; exit 1 }
Set-Content -Path $stampFile -Value $build -NoNewline
Remove-Item $out -ErrorAction SilentlyContinue
Write-Host "  Done: EduBoard is updated to $($release.name) and reopening."
