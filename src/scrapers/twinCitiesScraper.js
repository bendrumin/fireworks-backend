// Updated scrapers that work with the actual website structures

const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../utils/supabase');

async function scrapeTwinCitiesFamily() {
  try {
    console.log('🕷️ Scraping Family Fun Twin Cities...');
    
    // Correct URL
    const response = await axios.get('https://www.familyfuntwincities.com/twin-cities-independence-day-activities/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Look for location patterns - this site uses specific formats
    const text = $('body').text();
    
    // Extract events using common patterns from the content
    const locations = [
      'COLUMBIA HEIGHTS', 'HAM LAKE', 'DULUTH', 'WOODBURY', 'CHANHASSEN', 
      'EDEN PRAIRIE', 'EDINA', 'BLAINE', 'MINNEAPOLIS', 'ST. PAUL',
      'BLOOMINGTON', 'PLYMOUTH', 'BURNSVILLE', 'EAGAN', 'MINNETONKA',
      'LAKEVILLE', 'MAPLE GROVE', 'BROOKLYN PARK', 'STILLWATER', 'ANOKA',
      'ST LOUIS PARK', 'RICHFIELD', 'EXCELSIOR', 'SHAKOPEE'
    ];

    // Find paragraphs that mention these locations with fireworks
    $('p, div').each((i, element) => {
      const elementText = $(element).text().trim();
      
      if (elementText.length < 50 || elementText.length > 1000) return;
      
      // Must mention fireworks or celebration
      if (!elementText.toLowerCase().match(/(firework|celebration|july|4th)/)) return;
      
      let foundLocation = '';
      for (const location of locations) {
        if (elementText.toUpperCase().includes(location)) {
          foundLocation = location;
          break;
        }
      }
      
      if (!foundLocation) return;
      
      // Extract time
      let time = 'Evening';
      const timeMatch = elementText.match(/(\d{1,2}:\d{2}\s*[ap]m?|\d{1,2}\s*[ap]m|dusk|evening)/i);
      if (timeMatch) {
        time = timeMatch[0];
      }
      
      // Extract date - look for July 3, 4, 5, etc.
      let date = '2025-07-04'; // Default
      const dateMatch = elementText.match(/july\s*(\d{1,2})/i);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        date = `2025-07-${day}`;
      }
      
      // Create event name
      const locationName = foundLocation.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      let eventName = `${locationName} Independence Day Fireworks`;
      if (elementText.toLowerCase().includes('celebration')) {
        eventName = `${locationName} July 4th Celebration`;
      }
      
      // Get coordinates
      const coordinates = getCityCoordinates(locationName);
      
      events.push({
        name: eventName,
        location_name: locationName,
        lat: coordinates.lat,
        lng: coordinates.lng,
        event_date: date,
        event_time: time,
        cost: 'Free',
        source: 'familyfuntwincities.com',
        verified: false,
        description: elementText.substring(0, 400)
      });
    });

    // Remove duplicates by location
    const uniqueEvents = events.filter((event, index, self) => 
      index === self.findIndex(e => e.location_name === event.location_name)
    );

    console.log(`📅 Found ${uniqueEvents.length} Family Fun Twin Cities events`);
    return uniqueEvents;

  } catch (error) {
    console.error('❌ Family Fun Twin Cities scraping error:', error.message);
    return [];
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

    // Get all the text content and look for city patterns
    const bodyText = $('body').text();
    
    // Define cities and their common variations
    const cityData = [
      { name: 'Albert Lea', variations: ['Albert Lea'] },
      { name: 'Austin', variations: ['Austin'] },
      { name: 'Bemidji', variations: ['Bemidji'] },
      { name: 'Bloomington', variations: ['Bloomington'] },
      { name: 'Cannon Falls', variations: ['Cannon Falls'] },
      { name: 'Coon Rapids', variations: ['Coon Rapids'] },
      { name: 'Crosby', variations: ['Crosby'] },
      { name: 'Crosslake', variations: ['Crosslake'] },
      { name: 'Delano', variations: ['Delano'] },
      { name: 'Detroit Lakes', variations: ['Detroit Lakes'] },
      { name: 'Duluth', variations: ['Duluth'] },
      { name: 'Eagan', variations: ['Eagan'] },
      { name: 'Edina', variations: ['Edina'] },
      { name: 'Excelsior', variations: ['Excelsior'] },
      { name: 'Ely', variations: ['Ely'] },
      { name: 'Eveleth', variations: ['Eveleth'] },
      { name: 'Lake City', variations: ['Lake City'] },
      { name: 'Mankato', variations: ['Mankato'] },
      { name: 'Minneapolis', variations: ['Minneapolis'] },
      { name: 'Nisswa', variations: ['Nisswa'] },
      { name: 'Pequot Lakes', variations: ['Pequot Lakes'] },
      { name: 'Richfield', variations: ['Richfield'] },
      { name: 'Shakopee', variations: ['Shakopee'] },
      { name: 'Spicer', variations: ['Spicer'] },
      { name: 'St. Louis Park', variations: ['St. Louis Park', 'St Louis Park'] },
      { name: 'Tofte', variations: ['Tofte'] },
      { name: 'Waconia', variations: ['Waconia'] },
      { name: 'Warroad', variations: ['Warroad'] }
    ];

    // Split content into paragraphs and process each
    const paragraphs = bodyText.split(/\n+/).filter(p => p.trim().length > 10);
    
    for (let i = 0; i < paragraphs.length - 1; i++) {
      const currentPara = paragraphs[i].trim();
      const nextPara = paragraphs[i + 1].trim();
      
      // Check if current paragraph is just a city name
      const foundCity = cityData.find(city => 
        city.variations.some(variant => currentPara === variant)
      );
      
      if (foundCity && nextPara.length > 20) {
        // This looks like a city header followed by event description
        let description = nextPara;
        
        // Skip if it doesn't mention fireworks or related terms
        if (!description.toLowerCase().match(/(firework|celebration|july|4th|independence)/)) {
          continue;
        }
        
        // Extract time
        let time = 'Evening';
        const timeMatch = description.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?|\d{1,2}\s*[ap]\.?m\.?|dusk|nightfall)/i);
        if (timeMatch) {
          time = timeMatch[0];
        }
        
        // Extract date
        let date = '2025-07-04';
        if (description.toLowerCase().includes('july 3')) {
          date = '2025-07-03';
        } else if (description.toLowerCase().includes('july 5')) {
          date = '2025-07-05';
        } else if (description.toLowerCase().includes('july 6')) {
          date = '2025-07-06';
        }
        
        // Get coordinates
        const coordinates = getCityCoordinates(foundCity.name);
        
        events.push({
          name: `${foundCity.name} July 4th Fireworks`,
          location_name: foundCity.name,
          lat: coordinates.lat,
          lng: coordinates.lng,
          event_date: date,
          event_time: time,
          cost: 'Check local details',
          source: 'fox9.com',
          verified: false,
          description: description.substring(0, 300)
        });
        
        console.log(`Found: ${foundCity.name} - ${time}`);
      }
    }

    // If we still have no events, try a different approach - look for any mention of cities with fireworks
    if (events.length === 0) {
      console.log('🔄 Trying alternative parsing method...');
      
      for (const cityInfo of cityData) {
        const cityName = cityInfo.name;
        
        // Look for any paragraph that mentions this city and fireworks
        for (const paragraph of paragraphs) {
          if (paragraph.toLowerCase().includes(cityName.toLowerCase()) && 
              paragraph.toLowerCase().match(/(firework|celebration|july|4th)/)) {
            
            let time = 'Evening';
            const timeMatch = paragraph.match(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?|\d{1,2}\s*[ap]\.?m\.?|dusk)/i);
            if (timeMatch) {
              time = timeMatch[0];
            }
            
            const coordinates = getCityCoordinates(cityName);
            
            events.push({
              name: `${cityName} July 4th Fireworks`,
              location_name: cityName,
              lat: coordinates.lat,
              lng: coordinates.lng,
              event_date: '2025-07-04',
              event_time: time,
              cost: 'Check local details',
              source: 'fox9.com',
              verified: false,
              description: paragraph.substring(0, 300)
            });
            
            break; // Only add each city once
          }
        }
      }
    }

    // Remove duplicates by city name
    const uniqueEvents = events.filter((event, index, self) => 
      index === self.findIndex(e => e.location_name === event.location_name)
    );

    console.log(`📺 Found ${uniqueEvents.length} Fox9 events`);
    return uniqueEvents;

  } catch (error) {
    console.error('❌ Fox9 scraping error:', error.message);
    return [];
  }
}

// Helper function for city coordinates (expanded)
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
    'Anoka': { lat: 45.1972, lng: -93.3866 },
    'Chanhassen': { lat: 44.8619, lng: -93.5272 },
    'Columbia Heights': { lat: 45.0411, lng: -93.2630 },
    'Ham Lake': { lat: 45.2469, lng: -93.2077 },
    'Blaine': { lat: 45.1607, lng: -93.2349 },
    'St Louis Park': { lat: 44.9481, lng: -93.3478 },
    'Richfield': { lat: 44.8831, lng: -93.2830 },
    'Excelsior': { lat: 44.9022, lng: -93.5647 },
    'Shakopee': { lat: 44.7973, lng: -93.5272 },
    'Albert Lea': { lat: 43.6481, lng: -93.3687 },
    'Austin': { lat: 43.6666, lng: -92.9735 },
    'Bemidji': { lat: 47.4737, lng: -94.8803 },
    'Cannon Falls': { lat: 44.5094, lng: -92.9054 },
    'Coon Rapids': { lat: 45.1732, lng: -93.3030 },
    'Delano': { lat: 45.0424, lng: -93.7888 },
    'Detroit Lakes': { lat: 46.8171, lng: -95.8453 },
    'Ely': { lat: 47.9032, lng: -91.8673 },
    'Eveleth': { lat: 47.4624, lng: -92.5407 },
    'Lake City': { lat: 44.4497, lng: -92.2685 },
    'Nisswa': { lat: 46.5199, lng: -94.2886 }
  };
  
  return cityCoords[city] || { lat: 44.9778, lng: -93.2650 }; // Default to Minneapolis
}

module.exports = { scrapeTwinCitiesFamily, scrapeFox9 };