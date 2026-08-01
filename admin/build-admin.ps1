# build-admin.ps1
# Script to build Next.js admin dashboard and copy static assets to the FastAPI backend static directory

# 1. Build Next.js project
Write-Host "Starting Next.js static production build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Next.js build failed!" -ForegroundColor Red
    Exit 1
}

# 2. Clear backend static directory
$staticDir = Join-Path (Get-Item -Path ".." -ErrorAction SilentlyContinue).FullName "backend\static"
Write-Host "Clearing static build directory: $staticDir..." -ForegroundColor Cyan

if (Test-Path $staticDir) {
    Remove-Item -Path "$staticDir\*" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $staticDir -Force | Out-Null
}

# 3. Copy built files to backend
Write-Host "Copying built dashboard output to backend..." -ForegroundColor Cyan
Copy-Item -Path "out\*" -Destination $staticDir -Recurse -Force

Write-Host "MultiStocks AI Admin Dashboard compiled and deployed to backend/static successfully!" -ForegroundColor Green
