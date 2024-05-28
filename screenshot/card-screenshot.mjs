#!/usr/bin/env node
import puppeteer from "puppeteer";

async function captureScreenshot(cardId, outputPath = null) {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.setViewport({ width: 2000, height: 2000, deviceScaleFactor: 2 });

  await page.goto(`https://borismus.github.io/asimov/#${cardId}`, {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector(".focus");

  const element = await page.$(".focus");

  try {
    // Get screenshot of a particular element.
    const defaultPath = `${cardId}.png`;
    await element.screenshot({ path: outputPath || defaultPath });
  } catch (e) {
    // if element is 'not visible', spit out error and continue
    console.log(`Couldnt take screenshot of card ${cardId}. cause: `, e);
  }
  await browser.close();
}

console.log(process.argv);
if (process.argv.length < 3) {
  console.error("usage: node card-screenshot.mjs <card-id> <optional output path>");
  console.error("example: node card-screenshot.mjs germ-theory-of-disease out.png");
  process.exit(1);
}

captureScreenshot(process.argv[2], process.argv[3]);
