#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const variantsPathArg = process.argv[2];
const readingsPathArg = process.argv[3];
const outputJson = process.argv[4];
const outputJs = process.argv[5];

if (!variantsPathArg || !readingsPathArg || !outputJson || !outputJs) {
    console.error("Usage: node scripts/build-trad-to-simp.js <Unihan_Variants.txt> <Unihan_Readings.txt> <output.json> <output.js>");
    process.exit(1);
}

const outputPath = path.resolve(outputJson);
const outputJsPath = path.resolve(outputJs);
const variantsPath = path.resolve(variantsPathArg);
const readingsPath = path.resolve(readingsPathArg);

const variantsRaw = fs.readFileSync(variantsPath, "utf8");
const readingsRaw = fs.readFileSync(readingsPath, "utf8");

const tradToSimp = new Map();
const simplifiedChars = new Set();
const pinyinByChar = new Map();

const parseCodePoint = (token) => {
    const matched = String(token).match(/^U\+([0-9A-F]{4,6})$/i);
    return matched ? String.fromCodePoint(parseInt(matched[1], 16)) : "";
};

const parseVariantField = (value) =>
    String(value)
        .trim()
        .split(/\s+/)
        .map((token) => token.split("<")[0])
        .map(parseCodePoint)
        .filter(Boolean);

const parsePinyinList = (value) =>
    String(value)
        .split(/[,\s]+/g)
        .map((item) => item.trim())
        .filter(Boolean);

const parseHanyuPinyin = (value) =>
    String(value)
        .trim()
        .split(/\s+/)
        .flatMap((chunk) => {
            const [, readings = ""] = chunk.split(":");
            return parsePinyinList(readings);
        });

const rememberPinyin = (char, readings) => {
    if (!char || !Array.isArray(readings) || readings.length === 0) {
        return;
    }

    const existing = pinyinByChar.get(char) || new Set();
    for (const reading of readings) {
        existing.add(reading);
    }
    pinyinByChar.set(char, existing);
};

for (const line of variantsRaw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
        continue;
    }

    const [sourceCodePoint, field, rawValue] = line.split("\t");
    if (!sourceCodePoint || !field || !rawValue) {
        continue;
    }

    const sourceChar = parseCodePoint(sourceCodePoint);
    if (!sourceChar) {
        continue;
    }

    if (field === "kSimplifiedVariant") {
        const targets = parseVariantField(rawValue);
        if (targets.length === 0) {
            continue;
        }

        const existing = tradToSimp.get(sourceChar) || new Set();
        for (const target of targets) {
            existing.add(target);
            simplifiedChars.add(target);
        }
        tradToSimp.set(sourceChar, existing);
    } else if (field === "kTraditionalVariant") {
        simplifiedChars.add(sourceChar);
    }
}

for (const line of readingsRaw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
        continue;
    }

    const [sourceCodePoint, field, rawValue] = line.split("\t");
    if (!sourceCodePoint || !field || !rawValue) {
        continue;
    }

    const sourceChar = parseCodePoint(sourceCodePoint);
    if (!sourceChar) {
        continue;
    }

    if (field === "kMandarin") {
        rememberPinyin(sourceChar, parsePinyinList(rawValue));
    } else if (field === "kHanyuPinyin" && !pinyinByChar.has(sourceChar)) {
        rememberPinyin(sourceChar, parseHanyuPinyin(rawValue));
    }
}

const serializedMap = Object.fromEntries(
    [...tradToSimp.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([char, variants]) => [char, [...variants].sort()])
);

const serializedPinyin = Object.fromEntries(
    [...pinyinByChar.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([char, readings]) => [char, [...readings].sort()])
);

const payload = {
    generatedFrom: "Unicode Unihan_Variants.txt",
    generatedAt: new Date().toISOString(),
    map: serializedMap,
    pinyin: serializedPinyin,
    simplifiedChars: [...simplifiedChars].sort().join(""),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload));
fs.writeFileSync(outputJsPath, `globalThis.__HANZI_TRAD_TO_SIMP_DATA__ = ${JSON.stringify(payload)};\n`);

console.log(
    `Wrote ${Object.keys(serializedMap).length} traditional->simplified entries, ${Object.keys(serializedPinyin).length} pinyin entries, and ${simplifiedChars.size} simplified chars to ${outputPath} and ${outputJsPath}`
);
