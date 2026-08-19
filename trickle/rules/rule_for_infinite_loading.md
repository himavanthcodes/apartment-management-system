When implementing application initialization:
- rule 1: Every API request MUST have a timeout (e.g., using window.utils.withTimeout) to prevent infinite waiting.
- rule 2: Every asynchronous initialization flow MUST use a try/catch/finally block where 'loading' state is ALWAYS set to false in the 'finally' section.
- rule 3: Resident portal entry MUST NOT be blocked by admin authentication checks or data failures; fallbacks should allow at least the Admin Login path to remain accessible.
- rule 4: Pagination loops in trickleListObjects must have a safety iteration limit (e.g., max 5-10 pages) to prevent runaway processes.
- rule 3: Resident portal entry MUST NOT be blocked by admin authentication checks or data failures; fallbacks should allow at least the Admin Login path to remain accessible.
- rule 4: Pagination loops in trickleListObjects must have a safety iteration limit (e.g., max 5-10 pages) to prevent runaway processes.