/** Run a local server first. Optional E2E_ADMIN_TOKEN enables authenticated checks. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.E2E_BASE_URL||'http://127.0.0.1:8000');
 await page.waitForSelector('.card');
 assert.equal(await page.title(),'ResearchSpace · 找到你的科研连接');
 await page.locator('#search-input').fill('半导体');await page.locator('#search-form button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent.includes('1 条'));
 assert.match(await page.locator('.card h3').innerText(),/Transistors/);
 await page.locator('[data-detail]').first().click();await page.waitForSelector('dialog[open]');
 assert.match(await page.locator('#detail-content').innerText(),/研究周期/);await page.locator('.dialog-close').click();
 await page.locator('[data-save]').first().click();await page.waitForFunction(()=>document.querySelector('#saved-count').textContent==='1');
 await page.locator('[data-view=profile]').click();await page.locator('[name=institution]').fill('清华大学');
 await page.locator('[name=interests]').fill('计算机，机器学习');await page.locator('[name=degree]').selectOption('bachelor');
 await page.locator('[name=year]').fill('2');await page.locator('[name=skills]').fill('Python');
 await page.locator('[name=languages]').fill('中文，英语');await page.locator('#profile-form button[type=submit]').click();
 await page.waitForSelector('#hide-conflicts');await page.locator('#clear-filters').click();
 await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent.includes('条结果'));
 assert.ok(!(await page.locator('#results').innerText()).includes('香港科技大学'));
 await page.reload();await page.waitForSelector('.card');
 await page.locator('[data-view=profile]').click();assert.equal(await page.locator('[name=institution]').inputValue(),'清华大学');
 await page.locator('[data-view=saved]').click();await page.waitForSelector('.card');
 assert.match(await page.locator('.card h3').first().innerText(),/Transistors/);
 await page.locator('[data-view=sources]').click();await page.waitForSelector('.source-row');
 assert.equal(await page.locator('.source-row').count(),6);
 if(process.env.E2E_ADMIN_TOKEN){await page.locator('#admin-token').fill(process.env.E2E_ADMIN_TOKEN);await page.locator('#refresh-jobs').click();await page.waitForTimeout(300);assert.ok(!(await page.locator('#toast').innerText()).includes('需要管理员令牌'))}
 await page.locator('[data-view=explore]').click();await page.waitForSelector('.card');
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: search, detail, shortlist, profile, recommendations, persistence, sources, mobile overflow, JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
