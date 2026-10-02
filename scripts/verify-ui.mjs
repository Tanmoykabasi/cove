/**
 * Browser verification for the two UI features, run against the dev server.
 *
 *   node scripts/verify-ui.mjs
 *
 * Seeds a transcript containing every form in the formatting contract, then
 * checks the rendered DOM, exercises the Appearance panel, and reloads to prove
 * the display settings persisted.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const APP_URL = process.env.COVE_URL ?? "http://127.0.0.1:8081/";
const SHOTS = fileURLToPath(new URL("../screenshots/", import.meta.url));

const FORMATTED = [
  "# Heading one",
  "## Heading two",
  "### Heading three",
  "",
  "Plain **bold**, *italic*, ***bold italic***, ~~struck~~ and `inline **code**`.",
  "",
  "> A quoted line.",
  "",
  "- bullet one",
  "- bullet two",
  "  - nested bullet",
  "- [x] done task",
  "- [ ] open task",
  "",
  "1. first",
  "2. second",
  "",
  "| Model | Speed |",
  "| --- | --- |",
  "| Step | fast |",
  "",
  "---",
  "",
  "```ts",
  "const answer = 42;",
  "```",
  "",
  "See [the docs](https://example.com/docs) or https://example.org",
].join("\n");

const SOURCES = [
  { title: "Markdown reference", url: "https://example.com/md", snippet: "Syntax for emphasis." },
  { title: "Formatting guide", url: "https://example.org/guide", snippet: "Lists and tables." },
  { title: "Renderer notes", url: "https://example.net/notes", snippet: "Escaping rules." },
];

const CONVERSATION = {
  id: "seed-conversation",
  title: "Formatting check",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [
    { id: "m1", role: "user", content: "Show me every supported style.", createdAt: Date.now() },
    {
      id: "m2",
      role: "assistant",
      content: FORMATTED,
      sources: SOURCES,
      createdAt: Date.now(),
    },
  ],
};

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
mkdirSync(SHOTS, { recursive: true });

// Seed through the real persisted key, then reload so the app hydrates from it.
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.evaluate((conversation) => {
  localStorage.setItem(
    "cove-chat-v2",
    JSON.stringify({
      state: { conversations: [conversation], activeId: conversation.id },
      version: 0,
    }),
  );
}, CONVERSATION);
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByText("Show me every supported style.").waitFor({ timeout: 60_000 });

/* ------------------------------------------------------------- formatting */

const dom = await page.evaluate(() => {
  const q = (selector) => document.querySelectorAll(selector).length;
  const inlineCode = Array.from(document.querySelectorAll("code")).find((el) =>
    el.textContent?.includes("inline"),
  );
  const link = document.querySelector('a[href="https://example.com/docs"]');
  const autolink = document.querySelector('a[href="https://example.org"]');
  return {
    strong: q("strong"),
    em: q("em"),
    del: q("del"),
    h2: q("h2"),
    h3: q("h3"),
    h4: q("h4"),
    hr: q("hr"),
    blockquote: q("blockquote"),
    ul: q("ul"),
    ol: q("ol"),
    table: q("table"),
    th: q("th"),
    td: q("td"),
    pre: q("pre"),
    taskMarkers: Array.from(document.querySelectorAll("li")).filter((li) =>
      /[☑☐]/.test(li.textContent ?? ""),
    ).length,
    inlineCodeText: inlineCode?.textContent ?? "",
    // `**code**` inside backticks must stay literal, not become <strong>
    inlineCodeHasStrong: Boolean(inlineCode?.querySelector("strong")),
    linkTarget: link?.getAttribute("target") ?? "",
    autolink: Boolean(autolink),
    olRenderedAsOrdered: document.querySelectorAll("ol li").length,
  };
});

check("bold renders", dom.strong >= 2, `${dom.strong} <strong>`);
check("italic renders", dom.em >= 2, `${dom.em} <em>`);
check("strikethrough renders", dom.del >= 1, `${dom.del} <del>`);
check(
  "h1/h2/h3 map to h2/h3/h4",
  dom.h2 >= 1 && dom.h3 >= 1 && dom.h4 >= 1,
  `${dom.h2}/${dom.h3}/${dom.h4}`,
);
check("horizontal rule renders", dom.hr >= 1);
check("blockquote renders", dom.blockquote >= 1);
check("unordered list renders", dom.ul >= 1, `${dom.ul} <ul>`);
check(
  "ordered list renders as <ol>",
  dom.olRenderedAsOrdered >= 2,
  `${dom.olRenderedAsOrdered} <ol><li>`,
);
check("nested list renders", dom.ul >= 2, `${dom.ul} <ul>`);
check("task list markers render", dom.taskMarkers >= 2, `${dom.taskMarkers} items`);
check("table renders", dom.table >= 1 && dom.th >= 2 && dom.td >= 2, `${dom.th} th / ${dom.td} td`);
check("code block renders", dom.pre >= 1);
check("inline code renders", dom.inlineCodeText.includes("inline"), dom.inlineCodeText);
check("code span is not reformatted", !dom.inlineCodeHasStrong);
check("markdown link renders", dom.linkTarget === "_blank", `target=${dom.linkTarget}`);
check("bare URL autolinks", dom.autolink);

/* ------------------------------------------------------- sources disclosure */

const sourcesToggle = page.getByRole("button", { name: /3 sources/ });
check("sources control shows the count", (await sourcesToggle.count()) === 1);
check(
  "sources list starts collapsed",
  (await page.locator("#cove-sources-list").count()) === 0,
  "not rendered before the tap",
);

await sourcesToggle.click();
await page.waitForTimeout(200);
const expanded = await page.evaluate(() => {
  const list = document.querySelector("#cove-sources-list");
  if (!list) return null;
  const items = Array.from(list.querySelectorAll("li"));
  const tops = items.map((li) => li.getBoundingClientRect().top);
  return {
    tag: list.tagName,
    count: items.length,
    expanded: document
      .querySelector('[aria-controls="cove-sources-list"]')
      ?.getAttribute("aria-expanded"),
    numbered: items.every((li, i) => li.textContent?.trim().startsWith(`${i + 1}.`)),
    hasHost: items.every((li) => /example\.(com|org|net)/.test(li.textContent ?? "")),
    stacked: tops.every((top, i) => i === 0 || top > tops[i - 1]),
  };
});
check("tap expands the sources", expanded?.expanded === "true", String(expanded?.expanded));
check("sources render as an ordered list", expanded?.tag === "OL", String(expanded?.tag));
check("every source is listed", expanded?.count === SOURCES.length, `${expanded?.count}`);
check("entries are numbered top to bottom", expanded?.numbered && expanded?.stacked);
check("entries show the source host", expanded?.hasHost);

await sourcesToggle.click();
await page.waitForTimeout(200);
check("tap collapses the sources again", (await page.locator("#cove-sources-list").count()) === 0);

/* -------------------------------------------------------------- appearance */

await page.getByRole("button", { name: "Settings" }).click();
await page.getByRole("tab", { name: "Appearance" }).click();

const themeGroup = page.getByRole("radiogroup", { name: "Theme" });
check("theme control is labelled", (await themeGroup.count()) === 1);

await themeGroup.getByRole("radio", { name: "Light" }).click();
await page.waitForTimeout(300);

let state = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  colorScheme: document.documentElement.style.colorScheme,
  bg: getComputedStyle(document.body).backgroundColor,
  themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
}));
check("light theme applies", state.theme === "light", `data-theme=${state.theme}`);
check("light background is bright", state.bg === "rgb(251, 251, 253)", state.bg);
check("color-scheme follows theme", state.colorScheme === "light");
check("theme-color meta updates", state.themeColor === "#fbfbfd", String(state.themeColor));
await page.screenshot({ path: `${SHOTS}appearance-light.png`, fullPage: false });

// Keyboard operation — a segmented control has to be reachable and changeable
// without a pointer.
await themeGroup.getByRole("radio", { name: "Light", exact: true }).focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(250);
const afterArrow = await page.evaluate(() => document.documentElement.dataset.theme);
check("arrow key moves the selection", afterArrow === "dark", String(afterArrow));
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(250);
const backArrow = await page.evaluate(() => document.documentElement.dataset.theme);
check("arrow key moves back", backArrow === "light", String(backArrow));

await page
  .getByRole("radiogroup", { name: "Text size" })
  .getByRole("radio", { name: "Large", exact: true })
  .click();
await page.waitForTimeout(200);
const fontPx = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
check("text size applies", fontPx === "18px", fontPx);

await page
  .getByRole("radiogroup", { name: "Reading width" })
  .getByRole("radio", { name: "Wide" })
  .click();
await page.waitForTimeout(200);
// The measure is expressed in rem, so it scales with the text size set above —
// compare against 56rem at the *current* root size, not a fixed pixel value.
const measure = await page.evaluate(() => {
  const el = document.querySelector(".cove-measure");
  if (!el) return { max: "none", rootPx: 16 };
  return {
    max: parseFloat(getComputedStyle(el).maxWidth),
    rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
  };
});
check(
  "wide layout applies",
  Math.abs(measure.max - 56 * measure.rootPx) < 1,
  `${measure.max}px at ${measure.rootPx}px root (56rem)`,
);

await page.getByRole("switch", { name: "Increase contrast" }).click();
await page.waitForTimeout(200);
const contrast = await page.evaluate(() => document.documentElement.dataset.contrast);
check("high contrast applies", contrast === "high", String(contrast));

/* ------------------------------------------------------------- persistence */

await page.reload({ waitUntil: "domcontentloaded" });
await page.getByText("Show me every supported style.").waitFor({ timeout: 60_000 });
const after = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  contrast: document.documentElement.dataset.contrast,
  width: document.documentElement.dataset.width,
  font: getComputedStyle(document.documentElement).fontSize,
}));
check("theme persists across reload", after.theme === "light", String(after.theme));
check("text size persists across reload", after.font === "18px", after.font);
check("contrast persists across reload", after.contrast === "high", String(after.contrast));
check("layout width persists across reload", after.width === "wide", String(after.width));

/* ------------------------------------------------------------- reset button */

await page.getByRole("button", { name: "Settings" }).click();
await page.getByRole("tab", { name: "Appearance" }).click();
await page.getByRole("button", { name: "Restore appearance defaults" }).click();
await page.waitForTimeout(300);
const reset = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  font: getComputedStyle(document.documentElement).fontSize,
  contrast: document.documentElement.dataset.contrast,
}));
check(
  "reset restores defaults",
  reset.font === "16px" && reset.contrast === "normal",
  `font=${reset.font} contrast=${reset.contrast}`,
);

// Force dark for the dark screenshot regardless of the runner's OS setting.
await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}appearance-dark.png`, fullPage: false });
const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("dark theme applies", darkBg === "rgb(11, 11, 12)", darkBg);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(", ")}` : ""),
);
console.log(`screenshots -> ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
