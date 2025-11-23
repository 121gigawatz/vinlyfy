#!/usr/bin/env python3
import json
import re
import os

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION_FILE = os.path.join(BASE_DIR, 'build', 'version.json')
APP_JS = os.path.join(BASE_DIR, 'needle', 'js', 'app.js')
INDEX_HTML = os.path.join(BASE_DIR, 'needle', 'index.html')
SERVICE_WORKER = os.path.join(BASE_DIR, 'needle', 'service-worker.js')

def load_version():
    with open(VERSION_FILE, 'r') as f:
        return json.load(f)

def update_app_js(version_data):
    with open(APP_JS, 'r') as f:
        content = f.read()

    # Update APP_VERSION constant
    # const APP_VERSION = 'v1.0.0 Beta 4.1';
    content = re.sub(
        r"const APP_VERSION = '.*?';",
        f"const APP_VERSION = '{version_data['version']}';",
        content
    )

    # Update imports with cache busting
    # import ... from './...js?v=beta4.1';
    short_ver = version_data['shortVersion']
    content = re.sub(
        r"(\.js\?v=)([^';]+)",
        f"\\g<1>{short_ver}",
        content
    )

    with open(APP_JS, 'w') as f:
        f.write(content)
    print(f"Updated {APP_JS}")

def update_index_html(version_data):
    with open(INDEX_HTML, 'r') as f:
        content = f.read()

    short_ver = version_data['shortVersion']
    full_ver = version_data['version']

    # Update CSS/JS links
    # href="/css/...css?v=beta3"
    # src="/js/...js?v=beta3"
    content = re.sub(
        r'(\.(?:css|js)\?v=)([^"]+)',
        f"\\g<1>{short_ver}",
        content
    )

    # Update Footer Version
    # Version: v1.0.0 Beta 3</p>
    content = re.sub(
        r'(Version: )(v.*?)(</p>)',
        f"\\g<1>{full_ver}\\g<3>",
        content
    )

    with open(INDEX_HTML, 'w') as f:
        f.write(content)
    print(f"Updated {INDEX_HTML}")

def update_service_worker(version_data):
    with open(SERVICE_WORKER, 'r') as f:
        content = f.read()

    short_ver = version_data['shortVersion']
    full_ver = version_data['version']

    # Update CACHE_NAME
    # const CACHE_NAME = 'vinylfy-beta2.4.3';
    content = re.sub(
        r"const CACHE_NAME = 'vinylfy-.*?';",
        f"const CACHE_NAME = 'vinylfy-{short_ver}';",
        content
    )

    # Update RUNTIME_CACHE
    # const RUNTIME_CACHE = 'vinylfy-runtime-beta2.4.3';
    content = re.sub(
        r"const RUNTIME_CACHE = 'vinylfy-runtime-.*?';",
        f"const RUNTIME_CACHE = 'vinylfy-runtime-{short_ver}';",
        content
    )

    # Update VERSION
    # const VERSION = 'v1.0.0 Beta 2.4.3';
    content = re.sub(
        r"const VERSION = '.*?';",
        f"const VERSION = '{full_ver}';",
        content
    )

    with open(SERVICE_WORKER, 'w') as f:
        f.write(content)
    print(f"Updated {SERVICE_WORKER}")

def main():
    print(f"Reading version from {VERSION_FILE}...")
    try:
        version_data = load_version()
        print(f"Found version: {version_data['version']} ({version_data['shortVersion']})")
        
        update_app_js(version_data)
        update_index_html(version_data)
        update_service_worker(version_data)
        
        print("✅ Version update complete!")
    except Exception as e:
        print(f"❌ Error updating version: {e}")
        exit(1)

if __name__ == "__main__":
    main()
