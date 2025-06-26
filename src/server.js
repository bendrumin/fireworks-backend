const express = require('express');
const cors = require('cors');
require('dotenv').config();

const eventsRoutes = require('./routes/events');
const reportsRoutes = require('./routes/reports');

// Import scrapers
const { scrapeTwinCitiesFamily, scrapeFox9 } = require('./src/scrapers/twinCitiesFamily');
// Import supabase for saving events
const supabase = require('./src/utils/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Scrape endpoint - trigger scrapers manually
app.get('/scrape', async (req, res) => {
  try {
    console.log('🚀 Starting scraping process...');
    
    // Track results
    let totalScraped = 0;
    const results = {
      twinCitiesFamily: { success: false, count: 0, error: null },
      fox9: { success: false, count: 0, error: null }
    };

    // Scrape Twin Cities Family
    try {
      console.log('🔍 Scraping Twin Cities Family...');
      const tcfEvents = await scrapeTwinCitiesFamily();
      
      // Save events to database
      let savedCount = 0;
      for (const event of tcfEvents) {
        try {
          // Check if event already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('name', event.name)
            .eq('source', event.source);

          if (existing && existing.length > 0) {
            console.log(`⏭️  Skipping duplicate: ${event.name}`);
            continue;
          }

          // Insert new event
          const { error } = await supabase
            .from('events')
            .insert([event]);

          if (error) {
            console.error(`❌ Error saving ${event.name}:`, error.message);
          } else {
            savedCount++;
          }
        } catch (err) {
          console.error(`❌ Database error for ${event.name}:`, err.message);
        }
      }
      
      results.twinCitiesFamily.success = true;
      results.twinCitiesFamily.count = savedCount;
      totalScraped += savedCount;
      console.log(`✅ Twin Cities Family: ${tcfEvents.length} events scraped, ${savedCount} saved`);
    } catch (error) {
      console.error('❌ Twin Cities Family scraper failed:', error.message);
      results.twinCitiesFamily.error = error.message;
    }

    // Scrape Fox9
    try {
      console.log('🔍 Scraping Fox9...');
      const fox9Events = await scrapeFox9();
      
      // Save events to database
      let savedCount = 0;
      for (const event of fox9Events) {
        try {
          // Check if event already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('name', event.name)
            .eq('source', event.source);

          if (existing && existing.length > 0) {
            console.log(`⏭️  Skipping duplicate: ${event.name}`);
            continue;
          }

          // Insert new event
          const { error } = await supabase
            .from('events')
            .insert([event]);

          if (error) {
            console.error(`❌ Error saving ${event.name}:`, error.message);
          } else {
            savedCount++;
          }
        } catch (err) {
          console.error(`❌ Database error for ${event.name}:`, err.message);
        }
      }
      
      results.fox9.success = true;
      results.fox9.count = savedCount;
      totalScraped += savedCount;
      console.log(`✅ Fox9: ${fox9Events.length} events scraped, ${savedCount} saved`);
    } catch (error) {
      console.error('❌ Fox9 scraper failed:', error.message);
      results.fox9.error = error.message;
    }

    console.log(`🎉 Scraping complete! Total events saved: ${totalScraped}`);

    // Return detailed results
    res.json({
      success: true,
      message: `Scraping completed! ${totalScraped} total events saved to database.`,
      totalEventsSaved: totalScraped,
      scrapers: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Scraping process failed:', error);
    res.status(500).json({
      success: false,
      error: 'Scraping process failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/events', eventsRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎆 Events API: http://localhost:${PORT}/api/events`);
  console.log(`🔧 Scrape endpoint: http://localhost:${PORT}/scrape`);
});