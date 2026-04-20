/**
 * Verify that sending postMessage({request:"play"}) to the SVG iframe
 * triggers autoplay animation. Simulates exactly what our content script fix does.
 *
 * Run with:  npx playwright test tests/stroke_autoplay.spec.js --reporter=list
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, chromium } = require("@playwright/test");

const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const extensionPath = path.resolve(__dirname, "..");
const SEARCH_URL = "https://hanja.dict.naver.com/#/search?query=%E7%81%AB";

async function launchCtx(loadExt = false) {
    const tmpDir = path.join(os.tmpdir(), `hanja-autoplay-${crypto.randomBytes(4).toString("hex")}`);
    const args = loadExt
        ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
        : [];
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
        args,
    });
}

test("postMessage play triggers animation in SVG iframe (no extension)", async () => {
    const ctx = await launchCtx(false);
    try {
        const page = await ctx.newPage();
        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("a.hanja_link", { timeout: 15000 }).catch(() => {});
        const firstLink = page.locator("a.hanja_link").first();
        if (await firstLink.isVisible().catch(() => false)) await firstLink.click();
        await page.waitForSelector(".myFontStrokePlayBtn", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Simulate our extension: pin the overlay, set iframe.src, then postMessage play
        const result = await page.evaluate(async (svgUrl) => {
            return new Promise((resolve) => {
                const playBtn = document.querySelector(".myFontStrokePlayBtn");
                if (!playBtn) { resolve({ error: "no .myFontStrokePlayBtn" }); return; }
                const overlay = playBtn.querySelector("._ly_hanja_stroke");
                if (!overlay) { resolve({ error: "no ._ly_hanja_stroke" }); return; }
                const iframe = overlay.querySelector("iframe");
                if (!iframe) { resolve({ error: "no iframe" }); return; }

                // Pin overlay (as our extension does)
                document.body.appendChild(overlay);
                overlay.style.cssText += ";display:block;position:fixed;top:10px;right:10px;z-index:9999;width:300px;height:300px;";

                iframe.addEventListener("load", () => {
                    // Send play command via postMessage (same as our fix)
                    iframe.contentWindow.postMessage({ request: "play" }, "*");
                    setTimeout(() => {
                        resolve({
                            success: true,
                            iframeSrc: iframe.src,
                            iframeWidth: iframe.getBoundingClientRect().width,
                            iframeHeight: iframe.getBoundingClientRect().height,
                            message: "postMessage play sent — animation should be playing",
                        });
                    }, 1000);
                }, { once: true });

                iframe.src = svgUrl;
            });
        }, "https://ssl.pstatic.net/dicimg/cckodict/aniSVG_2025_03/7000/706B.svg");

        console.log("=== postMessage PLAY TEST ===");
        console.log(JSON.stringify(result, null, 2));

        // Keep browser open for 5 seconds to visually verify animation plays
        await page.waitForTimeout(5000);

    } finally {
        await ctx.close();
    }
});

test("Extension autoplay: stroke animation plays on page load (with extension)", async () => {
    const ctx = await launchCtx(true);
    try {
        const page = await ctx.newPage();

        // Capture extension console logs
        page.on("console", (msg) => {
            if (msg.text().includes("[Hanzi Ext]")) {
                console.log(`[PAGE CONSOLE ${msg.type()}] ${msg.text()}`);
            }
        });
        page.on("pageerror", (err) => console.log(`[PAGE ERROR] ${err.message}`));

        // Inject tracker BEFORE page runs — defer observe until documentElement is ready
        await page.addInitScript(() => {
            window.__extTracker = { events: [], obsStarted: false, obsError: null };
            const track = (msg) => window.__extTracker.events.push({ t: Date.now(), msg });
            const obs = new MutationObserver((muts) => {
                for (const m of muts) {
                    for (const n of m.addedNodes) {
                        if (n.id === "hanzi-ext-stroke") track("ADDED to " + (n.parentElement ? n.parentElement.tagName : "detached"));
                        else if (n.nodeType === 1 && n.querySelector) {
                            const found = n.querySelector && n.querySelector("#hanzi-ext-stroke");
                            if (found) track("inside added subtree, parent=" + (n.tagName || "?"));
                        }
                    }
                    for (const n of m.removedNodes) {
                        if (n.id === "hanzi-ext-stroke") track("REMOVED from " + (m.target ? m.target.tagName : "?"));
                        else if (n.nodeType === 1 && n.id) track("removed node id=" + n.id + " tag=" + n.tagName);
                    }
                }
            });
            const startObs = () => {
                if (document && document.documentElement) {
                    try {
                        obs.observe(document.documentElement, { childList: true, subtree: true });
                        window.__extTracker.obsStarted = true;
                    } catch(e) {
                        window.__extTracker.obsError = e.toString();
                    }
                } else {
                    setTimeout(startObs, 10);
                }
            };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", startObs, { once: true });
            } else {
                startObs();
            }
        });

        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

        // Extension auto-clicks the best search result → SPA navigates to description page
        // Wait for the description page URL pattern
        await page.waitForURL(/entry|detail/, { timeout: 20000 }).catch(() => {});
        console.log("=== CURRENT URL AFTER EXTENSION CLICK ===");
        console.log(page.url());

        // Now wait for stroke play button to appear (extension sets up the overlay after this)
        await page.waitForSelector(".myFontStrokePlayBtn", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        const state = await page.evaluate(() => {
            const overlay = document.getElementById("hanzi-ext-stroke");
            const iframe = overlay ? overlay.querySelector("iframe") : null;
            const strokeBtn = document.querySelector(".myFontStrokePlayBtn");
            const origOverlay = document.querySelector("._ly_hanja_stroke");
            return {
                overlayFound: !!overlay,
                overlayDisplay: overlay ? getComputedStyle(overlay).display : "none",
                overlayPosition: overlay ? getComputedStyle(overlay).position : "none",
                iframeFound: !!iframe,
                iframeSrc: iframe ? iframe.src : "none",
                strokeBtnFound: !!strokeBtn,
                // Is ._ly_hanja_stroke inside .myFontStrokePlayBtn?
                overlayInsideBtn: strokeBtn && origOverlay ? strokeBtn.contains(origOverlay) : null,
                origOverlayExists: !!origOverlay,
                origOverlayParent: origOverlay ? origOverlay.parentElement && origOverlay.parentElement.className : null,
                strokeBtnHTML: strokeBtn ? strokeBtn.outerHTML.substring(0, 500) : null,
                currentUrl: window.location.href,
            };
        });

        console.log("=== EXTENSION AUTOPLAY STATE ===");
        console.log(JSON.stringify(state, null, 2));

        const tracker = await page.evaluate(() => window.__extTracker || { events: [], obsStarted: false });
        console.log("=== DOM TRACKER ===");
        console.log("obsStarted:", tracker.obsStarted, "obsError:", tracker.obsError);
        console.log("events:", JSON.stringify(tracker.events, null, 2));

        // Keep browser open for 6 seconds to visually verify animation autoplays
        await page.waitForTimeout(6000);

    } finally {
        await ctx.close();
    }
});
