const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

// Get recent live reports (last 30 minutes)
router.get('/', async (req, res) => {
  try {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('live_reports')
      .select('*')
      .gte('report_timestamp', thirtyMinutesAgo)
      .order('report_timestamp', { ascending: false });
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching live reports:', error);
    res.status(500).json({ error: 'Failed to fetch live reports' });
  }
});

// Submit new live report
router.post('/', async (req, res) => {
  try {
    const report = {
      ...req.body,
      report_timestamp: Date.now()
    };
    
    const { data, error } = await supabase
      .from('live_reports')
      .insert([report])
      .select();
    
    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating live report:', error);
    res.status(500).json({ error: 'Failed to create live report' });
  }
});

module.exports = router;