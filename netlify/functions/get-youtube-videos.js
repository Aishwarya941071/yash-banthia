// netlify/functions/get-youtube-videos.js
// Fetches videos from your YouTube channel

const xml2js = require('xml2js');

exports.handler = async (event, context) => {
  try {
    const CHANNEL_ID = 'UCcGfAvXP4JJQoJpdyBHLjbw';
    const MAX_RESULTS = 6;
    
    // Fetch RSS feed from YouTube
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
    
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      throw new Error(`YouTube feed returned ${response.status}`);
    }
    
    const xmlText = await response.text();
    
    // Parse XML manually (simpler, no dependencies)
    const videos = [];
    
    // Extract video entries using regex
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    let count = 0;
    
    while ((match = entryRegex.exec(xmlText)) !== null && count < MAX_RESULTS) {
      const entryXml = match[1];
      
      // Extract video ID
      const idMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (!idMatch) continue;
      
      const videoId = idMatch[1];
      
      // Extract title
      const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1] : 'Untitled';
      
      videos.push({
        id: videoId,
        title: title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
        channel: 'Yash builds with AI'
      });
      
      count++;
    }
    
    if (videos.length === 0) {
      throw new Error('No videos found in feed');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(videos)
    };
    
  } catch (error) {
    console.error('Error in get-youtube-videos:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message,
        message: 'Failed to fetch YouTube videos'
      })
    };
  }
};
