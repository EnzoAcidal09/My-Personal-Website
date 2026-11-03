param(
  [int]$Port = 5173
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Error "Could not start the server on port $Port. Another program may be using it, or HttpListener needs a URL reservation. Try a different port: .\serve.ps1 -Port 8080"
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.ttf'  = 'font/ttf'
  '.woff2' = 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
}

Write-Host ""
Write-Host "  Kurt's Isle - local preview" -ForegroundColor Yellow
Write-Host "  Serving: $root"
Write-Host "  Open:    http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  Stop:    Ctrl+C"
Write-Host ""

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
      if ([string]::IsNullOrWhiteSpace($urlPath) -or $urlPath -eq '/') {
        $urlPath = '/index.html'
      }

      $rootFull = [System.IO.Path]::GetFullPath($root + [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $urlPath.TrimStart('/')))

      if (-not $filePath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      } elseif (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $response.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
      } else {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $response.StatusCode = 200
      }

      $response.Headers.Add('Cache-Control', 'no-store')
      $response.ContentLength64 = $bytes.Length
      if ($request.HttpMethod -ne 'HEAD') {
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      $response.StatusCode = 500
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Host "Server stopped."
}
