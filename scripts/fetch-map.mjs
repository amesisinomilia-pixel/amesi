import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(projectRoot, "public");
const assetsDir = resolve(publicDir, "assets");
const backupDir = resolve(projectRoot, "backup");

const mapBaseUrl = new URL(
    "https://test-37102.map-storage.workadventu.re/direct/",
);
const mapUrl = new URL("amesidimokratia.tmj", mapBaseUrl);
const wamUrl = new URL("amesidimokratia.wam", mapBaseUrl);

async function fetchBytes(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not download ${url}: HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
}

async function download(url, destination) {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await fetchBytes(url));
}

await mkdir(publicDir, { recursive: true });
await mkdir(assetsDir, { recursive: true });
await mkdir(backupDir, { recursive: true });

const mapResponse = await fetch(mapUrl);
if (!mapResponse.ok) {
    throw new Error(`Could not download ${mapUrl}: HTTP ${mapResponse.status}`);
}

const map = await mapResponse.json();
const scriptProperty = map.properties?.find(
    (property) => property.name === "script",
);

if (!scriptProperty || typeof scriptProperty.value !== "string") {
    throw new Error("The live map does not contain a script property.");
}

const currentScriptHtmlPath = scriptProperty.value.replaceAll("\\", "/");
const currentScriptHtmlUrl = new URL(currentScriptHtmlPath, mapBaseUrl);
const currentScriptHtmlResponse = await fetch(currentScriptHtmlUrl);

if (!currentScriptHtmlResponse.ok) {
    throw new Error(
        `Could not download ${currentScriptHtmlUrl}: HTTP ${currentScriptHtmlResponse.status}`,
    );
}

const currentScriptHtml = await currentScriptHtmlResponse.text();
const moduleMatch = currentScriptHtml.match(
    /<script[^>]+src=["']([^"']+\.js)["'][^>]*>/i,
);

if (!moduleMatch) {
    throw new Error("Could not locate the current room script bundle.");
}

const currentScriptJsUrl = new URL(moduleMatch[1], currentScriptHtmlUrl);
await download(currentScriptJsUrl, resolve(assetsDir, "current-main.js"));

const localImages = new Set();

for (const tileset of map.tilesets ?? []) {
    if (typeof tileset.image === "string") {
        localImages.add(tileset.image);
    }
}

for (const property of map.properties ?? []) {
    if (property.name === "mapImage" && typeof property.value === "string") {
        localImages.add(property.value);
    }
}

for (const imagePath of localImages) {
    await download(
        new URL(imagePath.replaceAll("\\", "/"), mapBaseUrl),
        resolve(publicDir, imagePath.replaceAll("\\", "/")),
    );
}

scriptProperty.value = "quest-script.html";

await writeFile(
    resolve(publicDir, "amesidimokratia.tmj"),
    `${JSON.stringify(map)}\n`,
    "utf8",
);

await download(wamUrl, resolve(backupDir, "amesidimokratia.wam"));

console.info("Downloaded the live map, preserved its current script, and added the quest entry point.");
