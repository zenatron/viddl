import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function getPuppeteerBrowser() {
  return puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
    env: {
      ...process.env,
      CHROME_PATH: await chromium.executablePath()
    }
  });
} 