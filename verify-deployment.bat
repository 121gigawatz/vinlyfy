@echo off
REM Verify all files needed for deployment are present (Windows version)

echo.
echo Verifying Vinylfy deployment requirements...
echo.

set MISSING=0

REM Check required files
if not exist "Dockerfile" (
    echo [X] Missing: Dockerfile
    set MISSING=1
) else (
    echo [OK] Dockerfile
)

if not exist "docker-compose.yml" (
    echo [X] Missing: docker-compose.yml
    set MISSING=1
) else (
    echo [OK] docker-compose.yml
)

if not exist "docker-compose.prod.yml" (
    echo [X] Missing: docker-compose.prod.yml
    set MISSING=1
) else (
    echo [OK] docker-compose.prod.yml
)

if not exist "start.sh" (
    echo [X] Missing: start.sh
    set MISSING=1
) else (
    echo [OK] start.sh
)

if not exist "nginx.conf" (
    echo [X] Missing: nginx.conf
    set MISSING=1
) else (
    echo [OK] nginx.conf
)

if not exist ".env.example" (
    echo [X] Missing: .env.example
    set MISSING=1
) else (
    echo [OK] .env.example
)

REM Check required directories
if not exist "table\app" (
    echo [X] Missing: table\app directory
    set MISSING=1
) else (
    echo [OK] table\app directory
)

if not exist "needle" (
    echo [X] Missing: needle directory
    set MISSING=1
) else (
    echo [OK] needle directory
)

echo.

if %MISSING%==0 (
    echo All required files and directories are present!
    echo.
    echo You can now run:
    echo   docker compose up -d
    echo.
    echo Or for production:
    echo   docker compose -f docker-compose.prod.yml up -d
    echo.
) else (
    echo.
    echo ERROR: Some required files or directories are missing.
    echo Please ensure you've extracted the complete release archive.
    echo.
    echo Current directory: %CD%
    echo.
    echo Make sure you're in the vinylfy-beta folder ^(or whatever the extracted folder is named^).
    echo.
)

pause
