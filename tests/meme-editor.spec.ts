import { test, expect } from '@playwright/test';

test.describe('Prompt processing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForFunction(() => typeof (window as any).processPrompt === 'function');
  });

  test('replaces "ralph" with trigger word', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).processPrompt('a picture of ralph eating paste');
    });
    expect(result).toBe('a picture of ralphwiggum eating paste');
  });

  test('replaces "wiggum" with trigger word', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).processPrompt('chief wiggum arresting someone');
    });
    expect(result).toBe('chief ralphwiggum arresting someone');
  });

  test('replaces both ralph and wiggum', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).processPrompt('ralph and wiggum together');
    });
    expect(result).toBe('ralphwiggum and ralphwiggum together');
  });

  test('adds trigger word if not present', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).processPrompt('a boy eating glue');
    });
    expect(result).toBe('ralphwiggum a boy eating glue');
  });

  test('does not add trigger word if already present', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).processPrompt('ralphwiggum eating crayons');
    });
    expect(result).toBe('ralphwiggum eating crayons');
  });

  test('case insensitive replacement', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).processPrompt('RALPH and Wiggum');
    });
    expect(result).toBe('ralphwiggum and ralphwiggum');
  });
});

test.describe('US-004: Text editing inline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#add-text-btn');
  });

  test('double-clicking text box enters edit mode', async ({ page }) => {
    // Fabric.js creates an upper canvas for interactions - use that
    const upperCanvas = page.locator('.upper-canvas');
    // Double click on center of canvas where text is placed
    await upperCanvas.dblclick({ position: { x: 256, y: 256 }, force: true });
    // Check if text is in editing mode by verifying cursor blinks or textarea exists
    const isEditing = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.isEditing === true;
    });
    expect(isEditing).toBe(true);
  });

  test('can type new text content', async ({ page }) => {
    // Fabric.js creates an upper canvas for interactions - use that
    const upperCanvas = page.locator('.upper-canvas');
    await upperCanvas.dblclick({ position: { x: 256, y: 256 }, force: true });
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Hello Ralph!');
    const text = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.text;
    });
    expect(text).toBe('Hello Ralph!');
  });
});

test.describe('US-005: Text resize and rotate controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#add-text-btn');
  });

  test('selected text box shows resize handles', async ({ page }) => {
    const hasControls = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.hasControls === true;
    });
    expect(hasControls).toBe(true);
  });

  test('selected text box has rotation control', async ({ page }) => {
    const hasRotatingPoint = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      // In Fabric.js 5, check if mtr control exists
      return activeObject?.controls?.mtr !== undefined;
    });
    expect(hasRotatingPoint).toBe(true);
  });
});

test.describe('US-006: Font selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('font dropdown exists with meme fonts', async ({ page }) => {
    const fontSelect = page.locator('#font-select');
    await expect(fontSelect).toBeVisible();
    const options = await fontSelect.locator('option').allTextContents();
    expect(options).toContain('Impact');
    expect(options).toContain('Arial Black');
    expect(options).toContain('Comic Sans MS');
    expect(options).toContain('Bangers');
    expect(options).toContain('Permanent Marker');
  });

  test('changing font updates selected text box', async ({ page }) => {
    await page.click('#add-text-btn');
    await page.selectOption('#font-select', 'Comic Sans MS');
    const fontFamily = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.fontFamily;
    });
    expect(fontFamily).toBe('Comic Sans MS');
  });
});

test.describe('US-007: Text color and stroke controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('fill color picker exists', async ({ page }) => {
    await expect(page.locator('#fill-color')).toBeVisible();
  });

  test('stroke color picker exists', async ({ page }) => {
    await expect(page.locator('#stroke-color')).toBeVisible();
  });

  test('stroke width input exists', async ({ page }) => {
    await expect(page.locator('#stroke-width')).toBeVisible();
  });

  test('meme style preset button exists', async ({ page }) => {
    await expect(page.locator('#meme-style-btn')).toBeVisible();
  });

  test('changing fill color updates text', async ({ page }) => {
    await page.click('#add-text-btn');
    await page.fill('#fill-color', '#ff0000');
    await page.locator('#fill-color').dispatchEvent('change');
    const fill = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.fill;
    });
    expect(fill).toBe('#ff0000');
  });

  test('meme style preset sets white fill and black stroke', async ({ page }) => {
    await page.click('#add-text-btn');
    await page.click('#meme-style-btn');
    const styles = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return {
        fill: activeObject?.fill,
        stroke: activeObject?.stroke,
        strokeWidth: activeObject?.strokeWidth
      };
    });
    expect(styles.fill).toBe('#ffffff');
    expect(styles.stroke).toBe('#000000');
    expect(styles.strokeWidth).toBe(3);
  });
});

test.describe('US-008: Delete text box', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('delete button exists', async ({ page }) => {
    await expect(page.locator('#delete-text-btn')).toBeVisible();
  });

  test('delete button removes selected text box', async ({ page }) => {
    await page.click('#add-text-btn');
    let textCount = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      return canvas?.getObjects?.().filter((o: any) => o.type === 'i-text').length;
    });
    expect(textCount).toBe(1);

    await page.click('#delete-text-btn');
    textCount = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      return canvas?.getObjects?.().filter((o: any) => o.type === 'i-text').length;
    });
    expect(textCount).toBe(0);
  });

  test('delete key removes selected text box when not editing', async ({ page }) => {
    await page.click('#add-text-btn');
    // Verify text is selected
    const isSelected = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.type === 'i-text';
    });
    expect(isSelected).toBe(true);

    // Text should not be in editing mode after being added
    let isEditing = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      const activeObject = canvas?.getActiveObject?.();
      return activeObject?.isEditing === true;
    });
    expect(isEditing).toBe(false);

    // Focus on the body to receive keyboard events
    await page.evaluate(() => document.body.focus());

    await page.keyboard.press('Delete');
    await page.waitForTimeout(100);

    const textCount = await page.evaluate(() => {
      const canvas = (window as any).canvas;
      return canvas?.getObjects?.().filter((o: any) => o.type === 'i-text').length;
    });
    expect(textCount).toBe(0);
  });
});

test.describe('US-009: Download meme as PNG', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('download button exists', async ({ page }) => {
    await expect(page.locator('#download-btn')).toBeVisible();
  });

  test('download without generated image does not save to gallery', async ({ page }) => {
    // Track if gallery POST was called
    let galleryPostCalled = false;
    await page.route('/api/gallery', async route => {
      if (route.request().method() === 'POST') {
        galleryPostCalled = true;
      }
      await route.continue();
    });

    // Click download without generating an image first
    await page.click('#download-btn');

    // Wait for any potential gallery save attempt
    await page.waitForTimeout(500);

    // Gallery should NOT have been called
    expect(galleryPostCalled).toBe(false);
  });

  test('download creates PNG file when image is generated', async ({ page }) => {
    // Mock the generate API to return a test image
    await page.route('/api/generate', async route => {
      // Return a small valid PNG base64
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
      });
    });

    // Generate an image first
    await page.fill('#prompt-input', 'test ralph');
    await page.click('#generate-btn');
    await page.waitForFunction(() => {
      const canvas = (window as any).canvas;
      return canvas?.getObjects?.().some((o: any) => o.type === 'image');
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-btn')
    ]);
    expect(download.suggestedFilename()).toMatch(/ralph-meme-\d+\.png/);
  });
});

test.describe('US-010: Save meme to gallery on download', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Mock the generate API
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
      });
    });
  });

  test('download button saves to gallery automatically', async ({ page }) => {
    // Generate an image first
    await page.fill('#prompt-input', 'Test prompt');
    await page.click('#generate-btn');
    await page.waitForFunction(() => {
      const canvas = (window as any).canvas;
      return canvas?.getObjects?.().some((o: any) => o.type === 'image');
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-btn')
    ]);
    // Wait for gallery to render after download
    await page.waitForSelector('.gallery-item');
    // Verify gallery item exists
    const thumbnails = page.locator('.gallery-item');
    await expect(thumbnails.first()).toBeVisible();
  });
});

test.describe('US-011: View gallery with thumbnails', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Mock the generate API
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
      });
    });

    // Generate an image first
    await page.fill('#prompt-input', 'Test prompt');
    await page.click('#generate-btn');
    await page.waitForFunction(() => {
      const canvas = (window as any).canvas;
      return canvas?.getObjects?.().some((o: any) => o.type === 'image');
    });

    // Add a meme to gallery via download
    await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-btn')
    ]);
    await page.waitForSelector('.gallery-item');
  });

  test('gallery background exists', async ({ page }) => {
    await expect(page.locator('#gallery-background')).toBeAttached();
  });

  test('shows thumbnail for saved memes', async ({ page }) => {
    const thumbnails = page.locator('.gallery-item');
    await expect(thumbnails.first()).toBeVisible();
  });

  test('clicking thumbnail shows preview', async ({ page }) => {
    // Use evaluate to trigger click since gallery is in background
    await page.evaluate(() => {
      const img = document.querySelector('.gallery-item img') as HTMLElement;
      img?.click();
    });
    await expect(page.locator('#gallery-preview')).toBeVisible();
  });
});

