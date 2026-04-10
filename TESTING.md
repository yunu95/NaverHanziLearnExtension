# Testing

## Smoke Test Setup

This repo now includes a minimal Playwright smoke-test scaffold for the unpacked extension.

### Prerequisites

- Microsoft Edge installed at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- Node.js and npm available on `PATH`

### Install

```powershell
npm install
```

### Run

```powershell
npm run test:smoke
```

The tests launch Edge with the local extension loaded from this repo and cover:

- popup save/load normalization
- a basic keyboard-navigation smoke path in the content script

## Manual Live Browser Checklist

Load the unpacked extension from this folder in `chrome://extensions` or `edge://extensions`.

You can launch a fresh Edge window with the unpacked extension preloaded by running:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\launch-edge-extension.ps1
```

Verify these behaviors:

1. Open the popup and save three entries such as `U+5929`, `U+5730`, and `U+4EBA`.
2. Reopen the popup and confirm the saved value is restored.
3. Open `https://hanja.dict.naver.com/#/search?query=%E5%A4%A9`.
4. Press `Ctrl+Right` and confirm navigation moves to the second saved entry.
5. Press `Ctrl+Left` and confirm navigation returns to the first saved entry.
6. Press `Ctrl+Down` and confirm navigation resets to the first saved entry.
7. Search-result pages should auto-open the best matching entry when the result list renders.
8. Description pages should scroll toward the target section when the heading is present.

## Known Limits

- The live site selectors in `content.js` are still dependent on Naver's DOM.
- The smoke suite covers popup persistence and keyboard navigation, but it does not yet assert the auto-click and deep-scroll behaviors against live Naver markup.
