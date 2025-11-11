# Vinylfy Troubleshooting Guide

## Mobile Chrome: ERR_CONNECTION_REFUSED

If you're experiencing connection issues on mobile Chrome (especially with ERR_CONNECTION_REFUSED errors), try these solutions:

### Solution 1: Bypass Service Worker (Quick Test)

Add `?no-sw=true` to the end of the URL:
```
http://192.168.68.100:8888/?no-sw=true
```

This will disable the service worker and help determine if that's causing the issue. If this works, proceed to Solution 2.

### Solution 2: Clear Site Data

On mobile Chrome:
1. Tap the three dots (⋮) in the top right
2. Go to **Settings** → **Privacy and Security** → **Site Settings**
3. Find **Vinylfy** or your server IP in the list
4. Tap **Clear & Reset**
5. Refresh the page

### Solution 3: Clear Chrome Cache

1. Open Chrome on your phone
2. Tap the three dots (⋮) → **History**
3. Tap **Clear browsing data**
4. Select:
   - Cached images and files
   - Cookies and site data
5. Choose **All time**
6. Tap **Clear data**

### Solution 4: Force Refresh

On mobile Chrome:
1. Open the Vinylfy app
2. Tap the address bar
3. Pull down to refresh (or use the refresh button)
4. Hold the refresh button for 2-3 seconds to force a hard refresh

### Solution 5: Check Network Settings

#### If accessing via local IP (192.168.x.x):

1. **Ensure phone is on the same WiFi network** as the server
2. **Check if your router has AP isolation enabled** (prevents devices from talking to each other)
   - Log into your router settings
   - Look for "AP Isolation", "Client Isolation", or "Guest Network"
   - Disable this feature if enabled
3. **Try accessing via hostname instead of IP**:
   ```
   http://your-server-name:8888
   ```

#### If accessing via domain name:

1. **Check DNS resolution**: Try pinging the domain from your phone's browser
2. **Verify HTTPS/HTTP**: Mobile Chrome is strict about mixed content
   - If your domain uses HTTPS, all requests must be HTTPS
   - Check if you have a reverse proxy (nginx, Caddy, Traefik) handling SSL

### Solution 6: Disable Chrome Data Saver

Mobile Chrome's Data Saver can interfere with local network requests:

1. Open Chrome → Settings
2. Tap **Lite mode** (or **Data Saver**)
3. Toggle it **OFF**

### Solution 7: Check Docker Container Health

If you have access to the server terminal:

```bash
# Check if container is running
docker ps

# Check container logs
docker logs vinylfy

# Restart the container
docker-compose restart

# Check if the health endpoint is responding
curl http://localhost:8888/api/health
```

### Solution 8: Browser Console Diagnostics

To see what's actually failing:

1. On mobile Chrome, visit: `chrome://inspect`
2. Or use **Remote Debugging**:
   - Connect your phone via USB
   - Enable USB debugging on your phone
   - Open `chrome://inspect#devices` on your desktop Chrome
   - Inspect the Vinylfy page to see console errors

### Common Error Messages & Fixes

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `ERR_CONNECTION_REFUSED` | Service Worker blocking requests | Try `?no-sw=true` URL parameter |
| `ERR_CONNECTION_CLOSED` | CORS misconfiguration | Check `CORS_ORIGINS` in docker-compose.yml |
| `net::ERR_FAILED` | Mixed content (HTTP/HTTPS) | Ensure all resources use the same protocol |
| `Service Worker registration failed` | HTTPS required or scope issue | Use `?no-sw=true` or set up HTTPS |

### For Developers: Debug Mode

Enable verbose logging by opening the browser console and running:

```javascript
// Enable verbose service worker logging
localStorage.setItem('debug', 'true');
location.reload();
```

Then check the console for detailed fetch and cache logs.

### Still Having Issues?

1. **Check the GitHub Issues**: https://github.com/121gigawatz/vinylfy/issues
2. **Report with details**:
   - Device model and OS version
   - Chrome version
   - Network setup (local IP, domain, etc.)
   - Full error message from console
   - Whether `?no-sw=true` works or not

### Technical Details

**Why does this happen on mobile Chrome specifically?**

- Mobile Chrome is more aggressive with service worker caching
- Stricter mixed content policies (HTTP/HTTPS)
- Different network stack than desktop Chrome
- More aggressive connection timeouts
- Service Worker scope restrictions on non-HTTPS origins

**How the bypass works:**

Adding `?no-sw=true` to the URL:
1. Prevents service worker registration
2. Unregisters any existing service workers
3. Forces direct network requests
4. Helps isolate whether the service worker is causing the issue
