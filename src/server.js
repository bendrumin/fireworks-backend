// Add this debug endpoint to your server.js

app.get('/scrape/debug', async (req, res) => {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    console.log('🔍 Debug: Checking website content...');
    
    const debugResults = {
      twinCitiesFamily: { status: 'checking...', elements: [] },
      fox9: { status: 'checking...', elements: [] }
    };

    // Debug Twin Cities Family
    try {
      const response = await axios.get('https://twincitiesfamily.com/4th-of-july-events-fireworks/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      debugResults.twinCitiesFamily.status = 'success';
      debugResults.twinCitiesFamily.pageTitle = $('title').text();
      debugResults.twinCitiesFamily.pageLength = response.data.length;
      
      // Check what elements exist
      debugResults.twinCitiesFamily.h3Count = $('h3').length;
      debugResults.twinCitiesFamily.h4Count = $('h4').length;
      debugResults.twinCitiesFamily.eventTitleCount = $('.event-title').length;
      debugResults.twinCitiesFamily.entryTitleCount = $('.entry-title').length;
      
      // Get sample text from headers
      const sampleHeaders = [];
      $('h1, h2, h3, h4, h5').each((i, el) => {
        if (i < 10) { // First 10 headers
          sampleHeaders.push($(el).text().trim());
        }
      });
      debugResults.twinCitiesFamily.sampleHeaders = sampleHeaders;
      
      // Look for July/fireworks mentions
      const pageText = $('body').text().toLowerCase();
      debugResults.twinCitiesFamily.hasJuly = pageText.includes('july');
      debugResults.twinCitiesFamily.hasFireworks = pageText.includes('firework');
      debugResults.twinCitiesFamily.has4th = pageText.includes('4th');

    } catch (error) {
      debugResults.twinCitiesFamily.status = 'error';
      debugResults.twinCitiesFamily.error = error.message;
    }

    // Debug Fox9
    try {
      const response = await axios.get('https://www.fox9.com/news/july-4th-fireworks-minnesota-2025-list', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      debugResults.fox9.status = 'success';
      debugResults.fox9.pageTitle = $('title').text();
      debugResults.fox9.pageLength = response.data.length;
      
      // Check what elements exist
      debugResults.fox9.pCount = $('p').length;
      debugResults.fox9.liCount = $('li').length;
      debugResults.fox9.richTextCount = $('.rich-text p').length;
      
      // Get sample paragraphs
      const sampleParagraphs = [];
      $('p').each((i, el) => {
        if (i < 5) { // First 5 paragraphs
          const text = $(el).text().trim();
          if (text.length > 20 && text.length < 200) {
            sampleParagraphs.push(text);
          }
        }
      });
      debugResults.fox9.sampleParagraphs = sampleParagraphs;
      
      // Look for content mentions
      const pageText = $('body').text().toLowerCase();
      debugResults.fox9.hasJuly = pageText.includes('july');
      debugResults.fox9.hasFireworks = pageText.includes('firework');
      debugResults.fox9.has2025 = pageText.includes('2025');
      debugResults.fox9.hasMinnesota = pageText.includes('minnesota');

    } catch (error) {
      debugResults.fox9.status = 'error';
      debugResults.fox9.error = error.message;
    }

    res.json({
      message: 'Debug information for scrapers',
      results: debugResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug endpoint failed:', error);
    res.status(500).json({
      error: 'Debug failed',
      details: error.message
    });
  }
});