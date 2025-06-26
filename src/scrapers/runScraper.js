require('dotenv').config(); 

const { runScraper } = require('./twinCitiesScraper');

// Run the scraper
runScraper()
  .then(() => {
    console.log('🎉 Scraper finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Scraper failed:', error);
    process.exit(1);
  });