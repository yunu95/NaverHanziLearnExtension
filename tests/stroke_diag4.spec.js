/**
 * Diagnostic test 4: navigate directly to the SVG animation URL and read its source.
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, chromium } = require("@playwright/test");

const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const SVG_URL = "https://ssl.pstatic.net/dicimg/cckodict/aniSVG_2025_03/7000/706B.svg";

async function launchCtx() {
    const tmpDir = path.join(os.tmpdir(), `hanja-diag4-${crypto.randomBytes(4).toString("hex")}`);
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
        args: [],
    });
}

test("Read SVG animation file source directly", async () => {
    const ctx = await launchCtx();
    try {
        const page = await ctx.newPage();

        // Intercept the response before it's processed
        let svgSource = "";
        page.on("response", async (response) => {
            if (response.url() === SVG_URL) {
                try {
                    svgSource = await response.text();
                } catch (e) {}
            }
        });

        await page.goto(SVG_URL, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Also try Playwright's content() and inner XML
        const pageContent = await page.content().catch(() => "");
        const docInfo = await page.evaluate(() => {
            const root = document.documentElement;
            return {
                rootTag: root ? root.tagName : "none",
                bodyExists: !!document.body,
                docType: document.doctype ? document.doctype.name : "none",
                rootOuterHTML: root ? root.outerHTML.substring(0, 5000) : "none",
            };
        }).catch(e => ({ error: e.toString() }));

        console.log("=== SVG DIRECT NAVIGATION ===");
        console.log("SVG source length:", svgSource.length);
        console.log("\n--- SVG SOURCE (first 3000 chars) ---");
        console.log(svgSource.substring(0, 3000));
        if (svgSource.length > 3000) {
            console.log("\n--- SVG SOURCE (last 1000 chars) ---");
            console.log(svgSource.substring(svgSource.length - 1000));
        }

        console.log("\n--- PAGE CONTENT (first 2000) ---");
        console.log(pageContent.substring(0, 2000));

        console.log("\n--- DOC INFO ---");
        console.log(JSON.stringify(docInfo, null, 2));

        // Check SMIL/animation patterns
        if (svgSource) {
            console.log("\n--- ANIMATION PATTERNS IN SVG ---");
            console.log("Has <animate>:", svgSource.includes("<animate"));
            console.log("Has <animateMotion>:", svgSource.includes("<animateMotion"));
            console.log("Has begin=\"0s\":", svgSource.includes('begin="0s"'));
            console.log("Has begin=\"0\":", svgSource.includes('begin="0"'));
            console.log("Has begin=\"click\":", svgSource.includes('begin="click"'));
            console.log("Has begin=\"indefinite\":", svgSource.includes('begin="indefinite"'));
            console.log("Has <script:", svgSource.includes("<script"));
            console.log("Has addEventListener:", svgSource.includes("addEventListener"));
            console.log("Has click:", svgSource.toLowerCase().includes("click"));
            console.log("Has play:", svgSource.toLowerCase().includes("play"));
            console.log("Has start:", svgSource.toLowerCase().includes("start"));
            console.log("Has autoplay:", svgSource.toLowerCase().includes("autoplay"));

            // Count animate elements
            const animateMatches = svgSource.match(/<animate/g);
            console.log("Animate element count:", animateMatches ? animateMatches.length : 0);

            // Find begin attributes
            const beginMatches = svgSource.match(/begin="[^"]*"/g);
            console.log("All begin= values:", beginMatches ? [...new Set(beginMatches)] : []);
        }

    } finally {
        await ctx.close();
    }
});
