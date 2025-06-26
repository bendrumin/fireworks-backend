const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

// Get all events
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    
    let query = supabase
      .from('events')
      .select('*')
      .eq('verified', true)
      .order('event_date', { ascending: true });

    // If location provided, you could add distance filtering here later
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Calculate distances if user location provided
    if (lat && lng) {
      const eventsWithDistance = data.map(event => ({
        ...event,
        distance: calculateDistance(
          parseFloat(lat), 
          parseFloat(lng), 
          event.lat, 
          event.lng
        )
      }));
      
      res.json(eventsWithDistance);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get events by date range
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('verified', true)
      .gte('event_date', today)
      .lte('event_date', thirtyDaysFromNow)
      .order('event_date', { ascending: true });
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// Add new event (for scrapers)
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert([req.body])
      .select();
    
    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Search events
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('verified', true)
      .or(`name.ilike.%${q}%,location_name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('event_date', { ascending: true });
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error searching events:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

// Helper function for distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;