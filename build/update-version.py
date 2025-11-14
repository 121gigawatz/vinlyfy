#!/usr/bin/env python3
"""
Vinylfy Version Update Script
Updates the version across all files from the centralized version.json

Run from project root: python3 build/update-version.py
"""

import json
import re
import os
from pathlib import Path

def load_version():
    """Load version information from version.json"""
    # Script is in build/, version.json is also in build/
    script_dir = Path(__file__).parent
    version_file = script_dir / 'version.json'

    if not version_file.exists():
        print("❌ Error: version.json not found in build/ directory!")
        print(f"   Looking for: {version_file}")
        exit(1)

    with open(version_file, 'r') as f:
        return json.load(f)

def update_file(file_path, patterns):
    """Update a file with multiple regex patterns"""
    # file_path is relative to project root
    project_root = Path(__file__).parent.parent
    full_path = project_root / file_path

    if not full_path.exists():
        print(f"  ⚠️  File not found: {file_path}")
        return False

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)

    if content != original_content:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False

def main():
    print("🔄 Updating Vinylfy version from version.json...")
    print()

    # Load version info
    version_info = load_version()
    version = version_info['version']
    short_version = version_info['shortVersion']
    docker_tag = version_info['dockerTag']

    print(f"📦 Version: {version}")
    print(f"📦 Short Version: {short_version}")
    print(f"📦 Docker Tag: {docker_tag}")
    print()

    # Update frontend files
    print("📝 Updating frontend files...")

    # Update needle/js/app.js
    app_js_updated = update_file('needle/js/app.js', [
        (r"const APP_VERSION = '[^']*';", f"const APP_VERSION = '{version}';"),
        (r"\.js\?v=[^'\"]*'", f".js?v={short_version}'"),
        (r"const currentVersion = '[^']*';", f"const currentVersion = '{short_version}';"),
    ])
    if app_js_updated:
        print("  ✅ Updated needle/js/app.js")

    # Update needle/index.html
    index_html_updated = update_file('needle/index.html', [
        (r'\.css\?v=[^"]*"', f'.css?v={short_version}"'),
        (r'\.js\?v=[^"]*"', f'.js?v={short_version}"'),
        (r'<p id="appVersion"[^>]*>\s*Version:[^<]*', f'<p id="appVersion" style="font-size: var(--font-size-sm); color: var(--color-primary); font-weight: var(--font-weight-light); margin-bottom: var(--space-sm);">\n        Version: {version}'),
    ])
    if index_html_updated:
        print("  ✅ Updated needle/index.html")

    # Update needle/service-worker.js
    sw_updated = update_file('needle/service-worker.js', [
        (r"const CACHE_NAME = 'vinylfy-[^']*';", f"const CACHE_NAME = 'vinylfy-{short_version}';"),
        (r"const RUNTIME_CACHE = 'vinylfy-runtime-[^']*';", f"const RUNTIME_CACHE = 'vinylfy-runtime-{short_version}';"),
        (r"const VERSION = '[^']*';", f"const VERSION = '{version}';"),
    ])
    if sw_updated:
        print("  ✅ Updated needle/service-worker.js")

    # Update backend __init__.py
    print()
    print("📝 Updating backend files...")

    backend_init_updated = update_file('table/app/__init__.py', [
        (r"__version__ = '[^']*'", f"__version__ = '{version}'"),
    ])
    if backend_init_updated:
        print("  ✅ Updated table/app/__init__.py")

    # Update Docker configuration
    print()
    print("📝 Updating Docker configuration...")

    docker_compose_updated = update_file('docker-compose.yml', [
        (r'image: vinylfy:.*', f'image: vinylfy:{docker_tag}'),
    ])
    if docker_compose_updated:
        print("  ✅ Updated docker-compose.yml")

    print()
    print("✅ Version update complete!")
    print()
    print("📋 Summary:")
    print(f"  • Version: {version}")
    print(f"  • Short Version: {short_version}")
    print(f"  • Docker Tag: {docker_tag}")
    print()
    print("💡 Next steps:")
    print("  1. Review changes: git diff")
    print("  2. Test the application")
    print("  3. Rebuild Docker image: docker-compose build")
    print(f"  4. Commit changes: git add . && git commit -m 'Update version to {version}'")
    print()

if __name__ == '__main__':
    main()
