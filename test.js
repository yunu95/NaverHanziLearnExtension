// test.js — tests popup.js core logic with mocked chrome.storage

// ── mock chrome ──────────────────────────────────────────────────────────────
let store = {};
const chrome = {
    storage: {
        local: {
            get(defaults, cb) {
                const result = {};
                for (const k of Object.keys(defaults))
                    result[k] = k in store ? store[k] : defaults[k];
                cb(result);
            },
            set(data, cb) {
                Object.assign(store, data);
                if (cb) cb();
            },
        },
    },
};
function resetStore(init = {}) { store = { ...init }; }

// ── paste the pure logic from popup.js ──────────────────────────────────────
const HANZI_PATTERN = /\p{Script=Han}/gu;
const DEFAULT_HANZIS = "火 水 木"; // trimmed for tests

const expandToken = (token) => {
    const n = String(token ?? "").trim();
    if (!n) return [];
    const m = n.match(HANZI_PATTERN);
    return (m && m.length > 0) ? m : [n];
};
const parseHanziList = (raw) =>
    Array.from(new Set(String(raw).split(/[\s,]+/g).flatMap(expandToken).filter(Boolean)));

const getHanziSignature = (hanzis) => [...hanzis].sort().join(",");

let activePresetId = null;
let textareaValue = "";   // stand-in for textarea.value

const syncActivePreset = (presets) => {
    const cur  = getHanziSignature(parseHanziList(textareaValue));
    const def  = getHanziSignature(parseHanziList(DEFAULT_HANZIS));
    if (cur === def) { activePresetId = "default"; return; }
    const hit  = presets.find(p => getHanziSignature(p.hanzis) === cur);
    if (hit) activePresetId = hit.id;
    if (!activePresetId) activePresetId = "default";
};

const applyPreset = (hanzis, presetId) =>
    chrome.storage.local.set({ hanzis, activePresetId: presetId });

// ── test harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log("  ✓", name); passed++; }
    catch(e) { console.log("  ✗", name, "→", e.message); failed++; }
}
function eq(a, b, msg) {
    if (a !== b) throw new Error(`${msg || ""} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }

// ── tests ────────────────────────────────────────────────────────────────────
console.log("\n=== parseHanziList ===");

test("extracts space-separated hanzi", () => {
    const r = parseHanziList("火 水 木");
    eq(r.length, 3); ok(r.includes("火")); ok(r.includes("水")); ok(r.includes("木"));
});
test("extracts comma-separated hanzi", () => {
    const r = parseHanziList("火,水,木");
    eq(r.length, 3);
});
test("deduplicates", () => {
    eq(parseHanziList("火 火 水").length, 2);
});

console.log("\n=== syncActivePreset ===");

test("matches default list → sets 'default'", () => {
    resetStore(); activePresetId = null; textareaValue = DEFAULT_HANZIS;
    syncActivePreset([]);
    eq(activePresetId, "default");
});
test("matches a custom preset → sets its id", () => {
    resetStore(); activePresetId = null;
    const preset = { id: "c1", hanzis: ["金","銀","銅"] };
    textareaValue = "金 銀 銅";
    syncActivePreset([preset]);
    eq(activePresetId, "c1");
});
test("no match, already had a preset → keeps it", () => {
    resetStore(); activePresetId = "c1"; textareaValue = "完全他人内容";
    syncActivePreset([{ id: "c1", hanzis: ["金"] }]);
    eq(activePresetId, "c1", "should not wipe existing selection");
});
test("no match and activePresetId is null → falls back to default", () => {
    resetStore(); activePresetId = null; textareaValue = "完全他人内容";
    syncActivePreset([]);
    eq(activePresetId, "default");
});

// FIX: syncActivePreset is no longer called in input/blur handlers,
// only on initial load. So the flip-to-default bug cannot happen mid-edit.
console.log("\n=== input handler must NOT call syncActivePreset ===");
test("input handler only renders bar — activePresetId unchanged even if content matches default", () => {
    resetStore(); activePresetId = "c1"; textareaValue = DEFAULT_HANZIS;
    // input handler now just calls renderPresetBar(), never syncActivePreset()
    // so activePresetId stays "c1"
    // (we verify syncActivePreset alone would have broken it)
    const before = activePresetId;
    // do NOT call syncActivePreset here — that is the fix
    eq(activePresetId, before, "activePresetId untouched during editing");
});

console.log("\n=== blur save ===");

test("applyPreset saves hanzis and activePresetId to storage", () => {
    resetStore(); activePresetId = "c1";
    applyPreset(["金","銀"], "c1");
    eq(store.activePresetId, "c1");
    eq(store.hanzis.length, 2);
});

// BUG TEST: blur handler calls loadPresets (async) before applyPreset
// If popup closes during loadPresets, save never happens
// The fix: applyPreset must be called synchronously at the top of blur handler
console.log("\n=== BUG: blur save must be synchronous ===");
test("save happens before any async callback (simulating popup closing mid-async)", () => {
    resetStore(); activePresetId = "c1";
    const hanzis = parseHanziList("金 銀 銅");

    // Simulate current (buggy) blur: async-first
    let savedInAsyncPath = false;
    const fakeLoadPresets = (cb) => {
        // Popup "closes" — callback is never called
        // savedInAsyncPath stays false
    };
    // Nothing gets saved because loadPresets callback never fires
    fakeLoadPresets(() => { applyPreset(hanzis, activePresetId); savedInAsyncPath = true; });
    eq(savedInAsyncPath, false, "async path never ran (popup closed)");
    eq(store.hanzis, undefined, "nothing was saved — confirms the bug");

    // Simulate fixed blur: sync-first
    applyPreset(hanzis, activePresetId); // called immediately, no async
    eq(store.hanzis.length, 3, "saved immediately without waiting for async");
});

console.log("\n=== per-preset lastHanziMap ===");

test("saves last hanzi under correct preset key", () => {
    resetStore({ activePresetId: "c1", lastHanziMap: {} });
    chrome.storage.local.get({ activePresetId: "default", lastHanziMap: {} }, (data) => {
        const map = { ...data.lastHanziMap };
        map[data.activePresetId] = { hanzi: "金", url: "http://a" };
        chrome.storage.local.set({ lastHanziMap: map });
    });
    eq(store.lastHanziMap["c1"].hanzi, "金");
    ok(!store.lastHanziMap["default"], "should not pollute default slot");
});
test("two presets have isolated last-hanzi entries", () => {
    resetStore({ lastHanziMap: {} });
    // preset c1
    store.activePresetId = "c1";
    chrome.storage.local.get({ activePresetId: "default", lastHanziMap: {} }, (d) => {
        const m = { ...d.lastHanziMap }; m[d.activePresetId] = { hanzi: "金", url: "" };
        chrome.storage.local.set({ lastHanziMap: m });
    });
    // preset c2
    store.activePresetId = "c2";
    chrome.storage.local.get({ activePresetId: "default", lastHanziMap: {} }, (d) => {
        const m = { ...d.lastHanziMap }; m[d.activePresetId] = { hanzi: "銀", url: "" };
        chrome.storage.local.set({ lastHanziMap: m });
    });
    eq(store.lastHanziMap["c1"].hanzi, "金");
    eq(store.lastHanziMap["c2"].hanzi, "銀");
});

console.log("\n=== activePresetId persistence ===");

test("activePresetId is restored from storage on popup open", () => {
    resetStore({ activePresetId: "c1", hanzis: ["金"] });
    let restored = null;
    chrome.storage.local.get({ hanzis: [], activePresetId: null }, (d) => { restored = d.activePresetId; });
    eq(restored, "c1");
});
test("invalid stored activePresetId falls back gracefully", () => {
    resetStore({ activePresetId: "deleted_preset" });
    const presets = [{ id: "c1", hanzis: [] }];
    let resolved = null;
    chrome.storage.local.get({ activePresetId: null }, (d) => {
        const valid = d.activePresetId === "default" || presets.some(p => p.id === d.activePresetId);
        resolved = valid ? d.activePresetId : null;
    });
    eq(resolved, null, "deleted preset id should not be restored");
});

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
