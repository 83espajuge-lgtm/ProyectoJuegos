const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8080');
    await new Promise(r => setTimeout(r, 1000));
    // Press ENTER to start game
    await page.keyboard.press('Enter');
    // Wait for fade in and game to run
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({path: 'screenshot_game.png'});
    // Wait more to see where player falls
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({path: 'screenshot_game2.png'});
    await browser.close();
})();
