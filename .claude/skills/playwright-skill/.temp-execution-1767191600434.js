// 百度搜索 AI 新闻 - 直接使用搜索 URL
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const page = await browser.newPage();

  try {
    console.log('🌐 正在百度搜索 "AI 新闻 2025"...');

    // 直接使用搜索 URL
    const searchUrl = 'https://www.baidu.com/s?wd=AI%20新闻%202025';
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // 等待页面加载
    await page.waitForTimeout(3000);

    console.log('✅ 搜索完成！');
    console.log('📄 页面标题:', await page.title());

    await page.screenshot({
      path: '/tmp/baidu-ai-news.png',
      fullPage: true
    });
    console.log('📸 截图已保存到 /tmp/baidu-ai-news.png');

    console.log('⏳ 浏览器将保持打开 60 秒，你可以浏览搜索结果...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await browser.close();
    console.log('👋 浏览器已关闭');
  }
})();
