/**
 * Diagnostic test: verify arrow hint panels appear and persist on a Naver Hanja
 * detail page. Checks both DOM presence and computed visibility.
 *
 * Run with:  npx playwright test tests/arrow_hint_diag.spec.js --headed --reporter=list
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "..");
const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const SEARCH_URL = "https://hanja.dict.naver.com/#/search?query=%E7%81%AB";

async function launchCtx() {
    const tmpDir = path.join(os.tmpdir(), `hanja-hint-${crypto.randomBytes(4).toString("hex")}`);
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });
}

test("Arrow hint panels appear and remain visible on detail page", async () => {
    const ctx = await launchCtx();
    try {
        const page = await ctx.newPage();

        // Capture all console messages from the page for debugging
        const consoleLogs = [];
        page.on("console", msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

        // Wait for the extension to auto-navigate from search → detail page.
        // The extension clicks the first result, so wait for a URL that is NOT the search URL.
        await page.waitForFunction(
            () => !window.location.href.includes("/search"),
            { timeout: 15000 }
        );

        console.log("Navigated to detail page:", page.url());

        // Give the content script time to run showArrowHint()
        await page.waitForTimeout(2000);

        // ── Snapshot 1: immediately after content script runs ────────────────
        const snapshot1 = await page.evaluate(() => {
            // Find all fixed-position elements with our high z-index
            const allEls = Array.from(document.querySelectorAll("*"));
            const candidates = allEls.filter(el => {
                const s = window.getComputedStyle(el);
                return s.position === "fixed" && parseInt(s.zIndex) >= 2147483640;
            });

            // Also check documentElement direct children (our new append target)
            const htmlChildren = Array.from(document.documentElement.children).map(c => ({
                tag: c.tagName,
                id: c.id,
                class: c.className,
                text: c.textContent?.substring(0, 50),
                position: window.getComputedStyle(c).position,
                opacity: window.getComputedStyle(c).opacity,
                display: window.getComputedStyle(c).display,
                zIndex: window.getComputedStyle(c).zIndex,
            }));

            return {
                candidateCount: candidates.length,
                candidates: candidates.map(el => ({
                    tag: el.tagName,
                    id: el.id,
                    text: el.textContent?.substring(0, 80),
                    opacity: window.getComputedStyle(el).opacity,
                    display: window.getComputedStyle(el).display,
                    visibility: window.getComputedStyle(el).visibility,
                    left: window.getComputedStyle(el).left,
                    right: window.getComputedStyle(el).right,
                    bottom: window.getComputedStyle(el).bottom,
                    parent: el.parentElement?.tagName,
                    inDOM: document.contains(el),
                })),
                htmlChildren,
                bodyChildCount: document.body?.children.length,
                htmlChildCount: document.documentElement?.children.length,
                url: window.location.href,
            };
        });

        console.log("=== SNAPSHOT 1 (t+2s) ===");
        console.log(JSON.stringify(snapshot1, null, 2));

        // Wait another 3 seconds to see if anything removes them
        await page.waitForTimeout(3000);

        // ── Snapshot 2: 5 seconds after script ran ───────────────────────────
        const snapshot2 = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll("*"));
            const candidates = allEls.filter(el => {
                const s = window.getComputedStyle(el);
                return s.position === "fixed" && parseInt(s.zIndex) >= 2147483640;
            });

            // Check for arrow text specifically
            const arrowEls = allEls.filter(el =>
                el.textContent?.includes("←") || el.textContent?.includes("→") ||
                el.textContent?.includes("이전 한자") || el.textContent?.includes("다음 한자")
            ).map(el => ({
                tag: el.tagName,
                text: el.textContent?.substring(0, 80),
                parent: el.parentElement?.tagName,
                opacity: window.getComputedStyle(el).opacity,
                display: window.getComputedStyle(el).display,
                inDOM: document.contains(el),
            }));

            return {
                candidateCount: candidates.length,
                arrowEls,
                htmlChildCount: document.documentElement?.children.length,
                url: window.location.href,
            };
        });

        console.log("=== SNAPSHOT 2 (t+5s) ===");
        console.log(JSON.stringify(snapshot2, null, 2));

        console.log("=== CONSOLE LOGS ===");
        consoleLogs.forEach(l => console.log(l));

        // The panels must exist and be visible
        expect(snapshot2.arrowEls.length).toBeGreaterThan(0);
        const visibleArrow = snapshot2.arrowEls.find(
            el => el.opacity !== "0" && el.display !== "none"
        );
        expect(visibleArrow).toBeTruthy();

    } finally {
        await ctx.close();
    }
});
