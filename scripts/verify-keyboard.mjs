/**
 * Regression check for segmented-control keyboard behaviour.
 *
 * Radix's own arrow handling proved non-deterministic (the same keypress
 * selected the next option roughly two times in three), so `Segmented` handles
 * the keys itself. Run this after touching that component:
 *
 *   node scripts/verify-keyboard.mjs
 *
 * Every row must print the same value three times.
 */
import { chromium } from "playwright";

const APP_URL = process.env.COVE_URL ?? "http://127.0.0.1:8081/";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Settings" }).click();
await page.getByRole("tab", { name: "Appearance" }).click();

const theme = () =>
  page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('[role="radio"]'));
    return {
      theme: document.documentElement.dataset.theme,
      focus: (document.activeElement?.textContent ?? "").trim(),
      checked: radios
        .filter((r) => r.getAttribute("aria-checked") === "true")
        .map((r) => (r.textContent ?? "").trim())
        .join(","),
    };
  });

async function scenario(name, run) {
  const results = [];
  for (let i = 0; i < 3; i++) {
    await page.getByRole("radio", { name: "Light", exact: true }).click();
    await page.waitForTimeout(250);
    await run();
    await page.waitForTimeout(250);
    results.push((await theme()).theme);
  }
  console.log(`${name.padEnd(34)} ${results.join("  ")}`);
}

await scenario("click then ArrowRight", async () => {
  await page.keyboard.press("ArrowRight");
});

await scenario("click, focus, ArrowRight", async () => {
  await page.getByRole("radio", { name: "Light", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
});

await scenario("click, screenshot, ArrowRight", async () => {
  await page.screenshot({ path: "screenshots/_debug.png" });
  await page.keyboard.press("ArrowRight");
});

await scenario("click, Tab away, Tab back, Arrow", async () => {
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowRight");
});

await browser.close();
