// Test to verify color update logic
const REVIEW_INTERVALS_MS = [2000, 6000, 14000, 32000, 70000];

const interpolateColor = (ratio) => {
    ratio = Math.max(0, Math.min(1, ratio));
    const r = 255;
    const g = Math.round(255 * (1 - ratio));
    const b = Math.round(255 * (1 - ratio));
    return `rgb(${r}, ${g}, ${b})`;
};

const getRipenessState = (entry, now) => {
    if (!entry || entry.views === 0) {
        return { state: "never", color: "#808080" };
    }
    
    if (entry.nextReview !== null && entry.nextReview <= now) {
        return { state: "needReview", color: "#ff0000" };
    }
    
    if (entry.nextReview === null && entry.views >= 6) {
        return { state: "mastered", color: "#ffd700" };
    }
    
    const timeSinceLastView = now - entry.lastViewed;
    const totalInterval = entry.nextReview - entry.lastViewed;
    const progress = timeSinceLastView / totalInterval;
    
    const color = interpolateColor(progress);
    return { state: "ripening", color };
};

// Simulate the update flow
console.log("=== Simulating history update ===\n");

const now = Date.now();
const hanzi = "火";

// Initial state (never studied)
let entry = { views: 0, lastViewed: null, nextReview: null };
console.log("1. Initial state (gray):");
console.log("   Entry:", entry);
console.log("   Color:", getRipenessState(entry, now));
console.log();

// After first view (content.js updates)
entry.views = 1;
entry.lastViewed = now;
entry.nextReview = now + REVIEW_INTERVALS_MS[0]; // +1 day
console.log("2. After first view (should be white - just learned):");
console.log("   Entry:", entry);
console.log("   Color:", getRipenessState(entry, now));
console.log();

// After 1 second (halfway through first interval of 2 seconds)
const oneSecondLater = now + 1000;
console.log("3. After 1 second (should be light pink - halfway):");
console.log("   Color:", getRipenessState(entry, oneSecondLater));
console.log();

// After 2 seconds (review needed)
const twoSecondsLater = now + 2000;
console.log("4. After 2 seconds (should be red - review needed):");
console.log("   Color:", getRipenessState(entry, twoSecondsLater));
console.log();

// After second view
entry.views = 2;
entry.lastViewed = twoSecondsLater;
entry.nextReview = twoSecondsLater + REVIEW_INTERVALS_MS[1]; // +6 seconds
console.log("5. After second view (white again):");
console.log("   Entry:", entry);
console.log("   Color:", getRipenessState(entry, twoSecondsLater));
console.log();

// After 6 views (mastered)
entry.views = 6;
entry.lastViewed = now;
entry.nextReview = null;
console.log("6. After 6 views (should be gold - mastered):");
console.log("   Entry:", entry);
console.log("   Color:", getRipenessState(entry, now));
console.log();

console.log("=== Timeline Summary ===");
console.log("1st review: 2 seconds after view 1");
console.log("2nd review: 6 seconds after view 2"); 
console.log("3rd review: 14 seconds after view 3");
console.log("4th review: 32 seconds after view 4");
console.log("5th review: 70 seconds after view 5");
console.log("After 6th view: MASTERED (gold)!");
