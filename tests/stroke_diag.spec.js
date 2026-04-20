/**
 * Diagnostic test: inspect the real DOM structure of the stroke-order overlay
 * on a live Naver Hanja description page to understand why the animation
 * doesn't autoplay when our extension pins the overlay.
 *
 * Run with:  npx playwright test tests/stroke_diag.spec.js --headed
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "..");
const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function launchCtx() {
    const tmpDir = path.join(
        os.tmpdir(),
        `hanja-diag-${crypto.randomBytes(4).toString("hex")}`
    );
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });
}

// Search URL for 火 — the extension will auto-click into the description page
const SEARCH_URL = "https://hanja.dict.naver.com/#/search?query=%E7%81%AB";

test("Diagnose stroke-order overlay DOM structure", async () => {
    const ctx = await launchCtx();
    try {
        const page = await ctx.newPage();
        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

        // The extension auto-clicks the best search result and navigates to the
        // description page. Wait up to 20s for .myFontStrokePlayBtn to appear.
        // ── 1. Wait for the .myFontStrokePlayBtn to appear ────────────────────
        await page.waitForSelector(".myFontStrokePlayBtn", { timeout: 20000 }).catch(() => {});
        await page.waitForSelector(".myStrokePlayBtn", { timeout: 5000 }).catch(() => {});

        // ── 2. Dump outer button structures before any click ──────────────────
        const beforeClick = await page.evaluate(() => {
            const results = {};

            const fontBtn = document.querySelector(".myFontStrokePlayBtn");
            results.myFontStrokePlayBtn = fontBtn ? {
                exists: true,
                outerHTML: fontBtn.outerHTML.substring(0, 2000),
                attributes: Array.from(fontBtn.attributes).map(a => `${a.name}="${a.value}"`),
                childCount: fontBtn.children.length,
            } : { exists: false };

            const strokeBtn = document.querySelector(".myStrokePlayBtn");
            results.myStrokePlayBtn = strokeBtn ? {
                exists: true,
                outerHTML: strokeBtn.outerHTML.substring(0, 500),
                attributes: Array.from(strokeBtn.attributes).map(a => `${a.name}="${a.value}"`),
                isInsideFontBtn: fontBtn ? fontBtn.contains(strokeBtn) : false,
            } : { exists: false };

            const overlay = document.querySelector("._ly_hanja_stroke");
            results._ly_hanja_stroke = overlay ? {
                exists: true,
                display: getComputedStyle(overlay).display,
                visibility: getComputedStyle(overlay).visibility,
                outerHTMLSnippet: overlay.outerHTML.substring(0, 3000),
                attributes: Array.from(overlay.attributes).map(a => `${a.name}="${a.value}"`),
                iframeCount: overlay.querySelectorAll("iframe").length,
                buttonClasses: Array.from(overlay.querySelectorAll("button, [role=button], [class*=btn], [class*=play]"))
                    .map(b => ({ tag: b.tagName, classes: b.className, text: b.textContent.trim().substring(0, 40) })),
            } : { exists: false };

            const iframe = document.querySelector("._ly_hanja_stroke iframe");
            results.iframe = iframe ? {
                exists: true,
                src: iframe.src,
                width: iframe.getAttribute("width"),
                height: iframe.getAttribute("height"),
                sandbox: iframe.getAttribute("sandbox"),
                allAttributes: Array.from(iframe.attributes).map(a => `${a.name}="${a.value}"`),
            } : { exists: false };

            return results;
        });

        console.log("=== BEFORE CLICK ===");
        console.log(JSON.stringify(beforeClick, null, 2));

        // ── 3. Click the play button (as the user would) ──────────────────────
        const playBtn = page.locator(".myFontStrokePlayBtn").first();
        const btnVisible = await playBtn.isVisible().catch(() => false);
        if (btnVisible) {
            await playBtn.click({ force: true });
            await page.waitForTimeout(1500);
        }

        // ── 4. Dump state AFTER click ─────────────────────────────────────────
        const afterClick = await page.evaluate(() => {
            const results = {};

            const overlay = document.querySelector("._ly_hanja_stroke");
            results._ly_hanja_stroke = overlay ? {
                exists: true,
                display: getComputedStyle(overlay).display,
                visibility: getComputedStyle(overlay).visibility,
                position: getComputedStyle(overlay).position,
                top: getComputedStyle(overlay).top,
                zIndex: getComputedStyle(overlay).zIndex,
                boundingRect: overlay.getBoundingClientRect(),
            } : { exists: false };

            const iframe = document.querySelector("._ly_hanja_stroke iframe");
            results.iframe = iframe ? {
                exists: true,
                src: iframe.src,
                width: iframe.getAttribute("width"),
                height: iframe.getAttribute("height"),
                boundingRect: iframe.getBoundingClientRect(),
            } : { exists: false };

            // Check what buttons/controls are visible inside the overlay
            const overlay2 = document.querySelector("._ly_hanja_stroke");
            results.visibleButtons = overlay2 ?
                Array.from(overlay2.querySelectorAll("button, [role=button], [class*=btn], [class*=play], [class*=stop], [class*=pause]"))
                    .map(b => ({
                        tag: b.tagName,
                        classes: b.className,
                        text: b.textContent.trim().substring(0, 60),
                        display: getComputedStyle(b).display,
                        visibility: getComputedStyle(b).visibility,
                    }))
                : [];

            // Check if myStrokePlayBtn is inside the overlay
            const strokeBtn = document.querySelector(".myStrokePlayBtn");
            const overlay3 = document.querySelector("._ly_hanja_stroke");
            results.myStrokePlayBtn = strokeBtn ? {
                exists: true,
                isInsideOverlay: overlay3 ? overlay3.contains(strokeBtn) : false,
                attributes: Array.from(strokeBtn.attributes).map(a => `${a.name}="${a.value}"`),
                display: getComputedStyle(strokeBtn).display,
            } : { exists: false };

            return results;
        });

        console.log("\n=== AFTER CLICK ===");
        console.log(JSON.stringify(afterClick, null, 2));

        // ── 5. Check if CORS allows fetching the SVG URL ──────────────────────
        if (afterClick.iframe && afterClick.iframe.src) {
            const corsResult = await page.evaluate(async (iframeSrc) => {
                try {
                    const r = await fetch(iframeSrc, { mode: "cors" });
                    const text = await r.text();
                    return {
                        ok: r.ok,
                        status: r.status,
                        corsHeaders: {
                            acao: r.headers.get("access-control-allow-origin"),
                            contentType: r.headers.get("content-type"),
                        },
                        firstChars: text.substring(0, 300),
                        hasSMIL: text.includes("begin="),
                        hasClickBegin: text.includes('begin="click"') || text.includes("begin='click'"),
                        hasIndefiniteBegin: text.includes('begin="indefinite"') || text.includes("begin='indefinite'"),
                        hasScriptTag: text.includes("<script"),
                        hasAnimateTag: text.includes("<animate"),
                    };
                } catch (e) {
                    return { error: e.toString() };
                }
            }, afterClick.iframe.src);

            console.log("\n=== CORS / SVG FETCH TEST ===");
            console.log(JSON.stringify(corsResult, null, 2));
        }

        // ── 6. Check postMessage events arriving at the iframe ────────────────
        // (We intercept messages for 3 seconds after clicking)
        const messages = await page.evaluate(() => {
            return new Promise((resolve) => {
                const msgs = [];
                const handler = (e) => msgs.push({ origin: e.origin, data: JSON.stringify(e.data) });
                window.addEventListener("message", handler);
                setTimeout(() => {
                    window.removeEventListener("message", handler);
                    resolve(msgs);
                }, 3000);
            });
        });
        console.log("\n=== postMessages received (3 sec window) ===");
        console.log(JSON.stringify(messages, null, 2));

        // Just assert the page loaded — we care about the console output
        expect(beforeClick._ly_hanja_stroke || afterClick._ly_hanja_stroke).toBeTruthy();

    } finally {
        await ctx.close();
    }
});
