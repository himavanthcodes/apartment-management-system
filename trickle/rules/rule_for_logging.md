When logging debug information:
- rule 1: Do not use `console.group` or `console.groupEnd` as they may not be supported or could be overridden in some environments.
- rule 2: Use standard `console.error`, `console.warn`, or `console.log` with an object payload for detailed debugging information.
- rule 3: When a "Failed to fetch" or "TypeError" occurs in database operations, always provide explicit instructions to the user to check ad-blockers, as these are external environment issues that cannot be resolved via code changes.
- rule 4: For critical data fetches (readings, bills), implement localized "Retry" buttons in the UI to allow users to attempt reconnection without a full page refresh.