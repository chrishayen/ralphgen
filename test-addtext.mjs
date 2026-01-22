// @ts-check
import { chromium } from 'playwright';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('http://localhost:8080/');

  // Wait for Fabric.js canvas to be ready
  await page.waitForFunction(() => window.canvas !== undefined && window.canvas !== null);

  console.log('Running US-003 tests: Add text box to canvas\n');

  let allPassed = true;

  // Test 1: Add Text button exists
  const addTextBtn = await page.$('#add-text-btn');
  const btnExists = addTextBtn !== null;
  console.log(`Test 1: Add Text button exists - ${btnExists ? 'PASS' : 'FAIL'}`);
  if (!btnExists) allPassed = false;

  // Test 2: Click Add Text adds IText object
  const initialCount = await page.evaluate(() => {
    return window.canvas.getObjects().filter(o => o.type === 'i-text').length;
  });

  await page.click('#add-text-btn');
  await page.waitForTimeout(100);

  const afterOneClick = await page.evaluate(() => {
    return window.canvas.getObjects().filter(o => o.type === 'i-text').length;
  });

  const test2Pass = afterOneClick === initialCount + 1;
  console.log(`Test 2: Click Add Text adds text box - ${test2Pass ? 'PASS' : 'FAIL'} (count: ${afterOneClick})`);
  if (!test2Pass) allPassed = false;

  // Test 3: Text has correct default content
  const textContent = await page.evaluate(() => {
    const textObj = window.canvas.getObjects().filter(o => o.type === 'i-text')[0];
    return textObj ? textObj.text : null;
  });
  const test3Pass = textContent === 'Your text here';
  console.log(`Test 3: Text has default content "Your text here" - ${test3Pass ? 'PASS' : 'FAIL'}`);
  if (!test3Pass) allPassed = false;

  // Test 4: Text is centered on canvas
  const textPosition = await page.evaluate(() => {
    const textObj = window.canvas.getObjects().filter(o => o.type === 'i-text')[0];
    return textObj ? { left: textObj.left, top: textObj.top, originX: textObj.originX, originY: textObj.originY } : null;
  });
  const isCentered = textPosition && textPosition.left === 256 && textPosition.top === 256;
  console.log(`Test 4: Text is centered on canvas - ${isCentered ? 'PASS' : 'FAIL'}`);
  if (!isCentered) allPassed = false;

  // Test 5: Text is auto-selected after adding
  const isSelected = await page.evaluate(() => {
    const textObj = window.canvas.getObjects().filter(o => o.type === 'i-text')[0];
    return window.canvas.getActiveObject() === textObj;
  });
  console.log(`Test 5: Text is auto-selected after adding - ${isSelected ? 'PASS' : 'FAIL'}`);
  if (!isSelected) allPassed = false;

  // Test 6: Can add multiple text boxes
  await page.click('#add-text-btn');
  await page.waitForTimeout(100);
  await page.click('#add-text-btn');
  await page.waitForTimeout(100);

  const afterThreeTotal = await page.evaluate(() => {
    return window.canvas.getObjects().filter(o => o.type === 'i-text').length;
  });
  const test6Pass = afterThreeTotal === 3;
  console.log(`Test 6: Can add multiple text boxes - ${test6Pass ? 'PASS' : 'FAIL'} (count: ${afterThreeTotal})`);
  if (!test6Pass) allPassed = false;

  // Test 7: Text boxes are draggable (selectable property is true)
  const isSelectable = await page.evaluate(() => {
    const textObj = window.canvas.getObjects().filter(o => o.type === 'i-text')[0];
    return textObj ? textObj.selectable : false;
  });
  console.log(`Test 7: Text boxes are draggable (selectable=true) - ${isSelectable ? 'PASS' : 'FAIL'}`);
  if (!isSelectable) allPassed = false;

  // Test 8: Text shows selection handles when clicked
  // First deselect all
  await page.evaluate(() => window.canvas.discardActiveObject());
  await page.waitForTimeout(100);

  // Click on canvas center to select a text box
  const canvasEl = await page.$('canvas.upper-canvas');
  const box = await canvasEl.boundingBox();
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(100);

  const hasActiveAfterClick = await page.evaluate(() => {
    const active = window.canvas.getActiveObject();
    return active !== null && active !== undefined && active.type === 'i-text';
  });
  console.log(`Test 8: Text shows selection handles when clicked - ${hasActiveAfterClick ? 'PASS' : 'FAIL'}`);
  if (!hasActiveAfterClick) allPassed = false;

  // Take screenshot showing text boxes on canvas
  await page.screenshot({ path: '/tmp/ralphgen-us003-test.png' });

  await browser.close();

  console.log(`\n${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
