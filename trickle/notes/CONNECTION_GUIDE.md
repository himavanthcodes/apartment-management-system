# Database Connection Guide

If you see `TypeError: Failed to fetch`, it means your browser or network is blocking the connection to the Trickle database.

## Quick Fixes
1. **Disable Ad-Blockers**: Tools like uBlock Origin, AdBlock, or Brave Shields often block the database API.
2. **Use Incognito Mode**: Press `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac). This runs the app without extensions.
3. **Check Network**: Some office or school Wi-Fi networks block third-party API calls.

## How to Verify
1. Press `F12` to open Developer Tools.
2. Click the **Network** tab.
3. Refresh the page.
4. If you see red lines with `ERR_BLOCKED_BY_CLIENT`, an extension is blocking the app.