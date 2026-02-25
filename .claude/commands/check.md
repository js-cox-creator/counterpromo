Run the dev check agent to typecheck all packages and smoke-test the API startup.

Spawn a general-purpose subagent with this exact prompt:

"Run the dev check script at /Users/jamescox/Documents/counterpromo-v2/scripts/dev-check.sh using bash. Capture the full output. Report back with:
1. Whether all checks passed or failed
2. The exact error output for any failures
3. Which files/lines need fixing if there are TypeScript errors

Do not fix anything — just report."

Wait for the agent to complete, then summarise the results to the user and (if there are failures) suggest which files to look at.
