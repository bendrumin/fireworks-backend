const express = require('express');
const cors = require('cors');
require('dotenv').config();

const eventsRoutes = require('./routes/events');
const reportsRoutes = require('./routes/reports');

// Import scrapers
const { scrapeTwinCitiesFamily, scrapeFox9 } = require('./scrapers/twinCitiesScraper');
// Import supabase for saving events
const supabase = require('./utils/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to check for duplicates
async function isDuplicate(event) {
  // Check for exact name match
  const { data: exactMatch } = await supabase
    .from('events')
    .select('id')
    .eq('name', event.name);

  if (exactMatch && exactMatch.length > 0) {
    return true;
  }

  // Check for location + date match (to catch different naming of same event)
  const { data: locationMatch } = await supabase
    .from('events')
    .select('id')
    .eq('location_name', event.location_name)
    .eq('event_date', event.event_date);

  if (locationMatch && locationMatch.length > 0) {
    return true;
  }

  return false;
}

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
      
      // Save events to database with improved duplicate checking
      let savedCount = 0;
      for (const event of tcfEvents) {
        try {
          const duplicate = await isDuplicate(event);
          
          if (duplicate) {
            console.log(`⏭️  Skipping duplicate: ${event.name} (${event.location_name})`);
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
            console.log(`✅ Saved: ${event.name} in ${event.location_name}`);
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
      
      // Save events to database with improved duplicate checking
      let savedCount = 0;
      for (const event of fox9Events) {
        try {
          const duplicate = await isDuplicate(event);
          
          if (duplicate) {
            console.log(`⏭️  Skipping duplicate: ${event.name} (${event.location_name})`);
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
            console.log(`✅ Saved: ${event.name} in ${event.location_name}`);
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

// Cleanup duplicates endpoint
app.get('/cleanup/duplicates', async (req, res) => {
  try {
    console.log('🧹 Starting duplicate cleanup...');
    
    // Get all events
    const { data: allEvents, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: true }); // Keep earliest created
    
    if (fetchError) throw fetchError;
    
    // Group by location_name and event_date to find duplicates
    const eventGroups = {};
    const duplicateIds = [];
    
    for (const event of allEvents) {
      const key = `${event.location_name}-${event.event_date}`;
      
      if (!eventGroups[key]) {
        eventGroups[key] = [];
      }
      eventGroups[key].push(event);
    }
    
    // Find duplicates (keep the first one, mark others for deletion)
    for (const [key, events] of Object.entries(eventGroups)) {
      if (events.length > 1) {
        console.log(`🔍 Found ${events.length} duplicates for ${key}`);
        
        // Keep the first event (earliest created), mark others for deletion
        for (let i = 1; i < events.length; i++) {
          duplicateIds.push(events[i].id);
          console.log(`   -> Marking for deletion: ${events[i].name} (ID: ${events[i].id})`);
        }
      }
    }
    
    let deletedCount = 0;
    
    // Delete duplicates in batches
    if (duplicateIds.length > 0) {
      console.log(`🗑️  Deleting ${duplicateIds.length} duplicate events...`);
      
      for (const id of duplicateIds) {
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', id);
        
        if (deleteError) {
          console.error(`❌ Error deleting event ${id}:`, deleteError.message);
        } else {
          deletedCount++;
        }
      }
    }
    
    // Get final count
    const { data: finalEvents, error: finalError } = await supabase
      .from('events')
      .select('*', { count: 'exact' });
    
    if (finalError) throw finalError;
    
    res.json({
      success: true,
      message: `Cleanup completed! Removed ${deletedCount} duplicate events.`,
      duplicatesFound: duplicateIds.length,
      duplicatesDeleted: deletedCount,
      totalEventsRemaining: finalEvents.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
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
  console.log(`🧹 Cleanup endpoint: http://localhost:${PORT}/cleanup/duplicates`);
});