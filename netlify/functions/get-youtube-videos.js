// netlify/functions/get-youtube-videos.js
// This function fetches videos from your YouTube channel and returns them as JSON

exports.handler = async (event, context) => {
  try {
    // Your channel ID
    const CHANNEL_ID = 'UCcGfAvXP4JJQoJpdyBHLjbw';
    const MAX_RESULTS = 6;
    
    // Option 1: Using RSS Feed (no API key needed)
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
    
    const response = await fetch(feedUrl);
    const text = await response.text();
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Failed to parse XML');
    }
    
    const entries = xmlDoc.querySelectorAll('entry');
    
    const videos = Array.from(entries)
      .slice(0, MAX_RESULTS)
      .map(entry => {
        const id = entry.querySelector('id').textContent.split(':')[2];
        const title = entry.querySelector('title').textContent;
        const url = entry.querySelector('link[rel="alternate"]').getAttribute('href');
        
        return {
          id,
          title,
          url,
          thumbnail: `https://img.youtube.com/vi/${id}/sddefault.jpg`,
          channel: 'Yash builds with AI'
        };
      });

    return {
      statusCode: 200,
      body: JSON.stringify(videos),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch videos' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
