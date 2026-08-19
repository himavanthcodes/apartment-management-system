# Troubleshooting "Failed to fetch" Errors

The error `TypeError: Failed to fetch` is a browser-level security exception usually triggered when an outgoing request to the database is blocked by the environment.

## 1. Primary Cause: Ad-Blockers
Modern ad-blockers (uBlock Origin, AdBlock, Brave Shields) often flag API endpoints from `app.trickle.so`.
- **Solution**: Disable the ad-blocker for this specific site or globally while using the management tool.

## 2. Browser Extensions
Privacy-focused extensions like "Ghostery" or "Privacy Badger" may block tracking-like patterns.
- **Solution**: Use **Incognito Mode** (Ctrl+Shift+N or Cmd+Shift+N). This disables most extensions and is the fastest way to confirm if a plugin is the culprit.

## 3. Corporate or Restricted Networks
Firewalls in office environments may block domain requests that aren't on their whitelist.
- **Solution**: Try accessing the site via a Mobile Hotspot.

## 4. Technical Diagnostics
- Open Developer Tools (`F12` or `Right-Click -> Inspect`).
- Go to the **Network** tab.
- Refresh the page and look for red entries.
- If the status is `(blocked:other)` or `(failed)net::ERR_BLOCKED_BY_CLIENT`, it is 100% an extension or ad-blocker.