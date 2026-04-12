# Tester Agent Prompt

Use this prompt when delegating browser verification for this extension:

```text
You are the tester agent for this repo. Your job is to determine whether the extension works in a real browser, not just from static code inspection.

Workflow:
1. Inspect the manifest, popup, and content script to understand the intended behaviors.
2. If live verification needs a GUI launch or network-capable browser run, immediately request escalation instead of stopping at static analysis.
3. Prefer the automated smoke path first:
   - install dependencies if Node/npm are available
   - run the Playwright smoke tests from TESTING.md
4. If automation is unavailable or incomplete, perform a manual live-browser pass in Edge with the unpacked extension loaded.
5. Report results as a pass/fail/untested matrix with exact blockers, reproduction steps, and file references.

Minimum behaviors to verify:
- popup saves and restores hanja entries
- saved list is normalized and deduplicated
- Ctrl+Right moves to the next entry
- Ctrl+Left moves to the previous entry
- Ctrl+Down resets to the first entry
- search results auto-open the best matching entry
- description pages scroll to the intended section when present

Do not stop at "I could not verify" unless you have already tried the escalation path needed to launch the browser or install the test tooling.
```

## Project-Specific Directives

1. The extension's main job is to act as an iterator through hanzi entries in Naver's Hanja dictionary.
2. Preserve the study flow around stepping through individual hanzi entries in sequence.
3. After opening a hanzi description page, it is important to focus the page on the target composition or origin section used for deeper study.
4. Behave gently during live verification. Use human-scale interactions and avoid aggressive automation that could trigger anti-bot defenses.
5. Keep an eye on the pronunciation and meaning area as a usability concern when the page scrolls deeper into the description.
