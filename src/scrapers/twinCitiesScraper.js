const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../utils/supabase');

async function scrapeTwinCitiesFamily() {
  try {
    console.log('🕷️ Scraping Twin Cities Family...');
    
    const response = await axios.get('https://twincitiesfamily.com/4th-of-july-events-fireworks/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Look for common event patterns
    $('h3, h4, .event-title, .entry-title').each((i, element) => {
      const title = $(element).text().trim();
      
      // Skip if doesn't seem like a fireworks event
      if (!title.toLowerCase().includes('firework') && 
          !title.toLowerCase().includes('july') && 
          !title.toLowerCase().includes('4th')) {
        return;
      }

      let description = '';
      let location = '';
      let date = '2025-07-04'; // Default to July 4th
      let time = 'Evening';

      // Get surrounding text for context
      const nextElements = $(element).nextAll().slice(0, 3);
      nextElements.each((j, nextEl) => {
        const text = $(nextEl).text().trim();
        if (text.length > 20) {
          description += text + ' ';
        }
        
        // Look for location indicators
        if (text.toLowerCase().includes('park') || 
            text.toLowerCase().includes('lake') ||
            text.toLowerCase().includes('downtown')) {
          location = text;
        }
        
        // Look for time
        if (text.match(/\d{1,2}:\d{2}/)) {
          time = text.match(/\d{1,2}:\d{2}[^\s]*/)?.[0] || time;
        }
      });

      // Extract location from title if not found
      if (!location && title.includes(' - ')) {
        location = title.split(' - ')[1];
      } else if (!location && title.includes(' at ')) {
        location = title.split(' at ')[1];
      }

      events.push({
        name: title,
        location_name: location || 'Twin Cities Area',
        lat: 44.9778, // Default Minneapolis coordinates
        lng: -93.2650,
        event_date: date,
        event_time: time,
        cost: 'Check event details',
        source: 'twincitiesfamily.com',
        verified: false,
        description: description.trim().substring(0, 500)
      });
    });

    console.log(`📅 Found ${events.length} potential events`);
    return events;

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    return [];
  }
}

async function saveEventsToDatabase(events) {
  let savedCount = 0;
  
  for (const event of events) {
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
        console.log(`✅ Saved: ${event.name}`);
        savedCount++;
      }
    } catch (err) {
      console.error(`❌ Database error for ${event.name}:`, err.message);
    }
  }

  return savedCount;
}

async function runScraper() {
  console.log('🚀 Starting multi-site scraper...');
  
  // Scrape both sites
  const twinCitiesEvents = await scrapeTwinCitiesFamily();
  const fox9Events = await scrapeFox9();
  
  // Combine all events
  const allEvents = [...twinCitiesEvents, ...fox9Events];
  
  if (allEvents.length > 0) {
    const savedCount = await saveEventsToDatabase(allEvents);
    console.log(`✨ Scraper complete! Saved ${savedCount} new events from ${allEvents.length} found`);
  } else {
    console.log('📭 No events found from any source');
  }
}
async function scrapeFox9() {
  try {
    console.log('🦊 Scraping Fox9...');
    
    const response = await axios.get('https://www.fox9.com/news/july-4th-fireworks-minnesota-2025-list', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Fox9 often uses article text with city names and events
    $('p, li, .rich-text p').each((i, element) => {
      const text = $(element).text().trim();
      
      // Look for lines that mention cities and fireworks
      if (text.length < 20 || text.length > 300) return;
      
      // Must mention fireworks or July 4th related terms
      if (!text.toLowerCase().match(/(firework|july|4th|celebration|display)/)) return;
      
      // Extract city/location names (common Minnesota cities)
      const cities = [
        'Minneapolis', 'St. Paul', 'Bloomington', 'Plymouth', 'Duluth',
        'Rochester', 'Mankato', 'St. Cloud', 'Moorhead', 'Burnsville',
        'Eagan', 'Eden Prairie', 'Minnetonka', 'Edina', 'Lakeville',
        'Woodbury', 'Maple Grove', 'Brooklyn Park', 'Stillwater', 'Anoka'
      ];
      
      let foundCity = '';
      for (const city of cities) {
        if (text.toLowerCase().includes(city.toLowerCase())) {
          foundCity = city;
          break;
        }
      }
      
      if (!foundCity) return;
      
      // Extract time if mentioned
      let time = 'Evening';
      const timeMatch = text.match(/(\d{1,2}:\d{2}\s*[ap]m?|\d{1,2}\s*[ap]m)/i);
      if (timeMatch) {
        time = timeMatch[0];
      }
      
      // Look for date (default to July 4th)
      let date = '2025-07-04';
      const dateMatch = text.match(/july\s*(\d{1,2})/i);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        date = `2025-07-${day}`;
      }
      
      // Create event name
      let eventName = `${foundCity} Fireworks`;
      if (text.toLowerCase().includes('festival')) {
        eventName = `${foundCity} Festival Fireworks`;
      } else if (text.toLowerCase().includes('celebration')) {
        eventName = `${foundCity} July 4th Celebration`;
      }
      
      // Get approximate coordinates for Minnesota cities
      const coordinates = getCityCoordinates(foundCity);
      
      events.push({
        name: eventName,
        location_name: foundCity,
        lat: coordinates.lat,
        lng: coordinates.lng,
        event_date: date,
        event_time: time,
        cost: 'Check local details',
        source: 'fox9.com',
        verified: false,
        description: text.substring(0, 300)
      });
    });

    // Remove duplicates by name
    const uniqueEvents = events.filter((event, index, self) => 
      index === self.findIndex(e => e.name === event.name)
    );

    console.log(`📺 Found ${uniqueEvents.length} Fox9 events`);
    return uniqueEvents;

  } catch (error) {
    console.error('❌ Fox9 scraping error:', error.message);
    return [];
  }
}

// Helper function for city coordinates
function getCityCoordinates(city) {
  const cityCoords = {
    'Minneapolis': { lat: 44.9778, lng: -93.2650 },
    'St. Paul': { lat: 44.9537, lng: -93.0900 },
    'Bloomington': { lat: 44.8408, lng: -93.2982 },
    'Plymouth': { lat: 45.0105, lng: -93.4555 },
    'Duluth': { lat: 46.7867, lng: -92.1005 },
    'Rochester': { lat: 44.0121, lng: -92.4802 },
    'Mankato': { lat: 44.1636, lng: -94.0000 },
    'St. Cloud': { lat: 45.5579, lng: -94.1632 },
    'Moorhead': { lat: 46.8737, lng: -96.7678 },
    'Burnsville': { lat: 44.7678, lng: -93.2777 },
    'Eagan': { lat: 44.8041, lng: -93.1668 },
    'Eden Prairie': { lat: 44.8547, lng: -93.4708 },
    'Minnetonka': { lat: 44.9211, lng: -93.4687 },
    'Edina': { lat: 44.8897, lng: -93.3498 },
    'Lakeville': { lat: 44.6497, lng: -93.2427 },
    'Woodbury': { lat: 44.9239, lng: -92.9594 },
    'Maple Grove': { lat: 45.0724, lng: -93.4558 },
    'Brooklyn Park': { lat: 45.0941, lng: -93.3563 },
    'Stillwater': { lat: 45.0566, lng: -92.8065 },
    'Anoka': { lat: 45.1972, lng: -93.3866 }
  };
  
  return cityCoords[city] || { lat: 44.9778, lng: -93.2650 }; // Default to Minneapolis
}

module.exports = { runScraper, scrapeTwinCitiesFamily, scrapeFox9 };
