When updating authentication or navigation logic:
- rule 1: The root index.html MUST always remain the Resident Portal entry point.
- rule 2: Never implement automatic redirects to admin pages from the main application startup.
- rule 3: Admin authentication queries MUST only occur upon explicit user interaction (e.g., clicking Login).
- rule 4: Ensure all useEffect hooks fetching data include a mounting check or proper dependency array to prevent infinite request loops.