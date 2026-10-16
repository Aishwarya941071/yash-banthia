// netlify/functions/get-youtube-videos.js

exports.handler = async (event, context) => {
  try {
    const CHANNEL_ID = 'UCcGfAvXP4JJQoJpdyBHLjbw';
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
    
    const response = await fetch(feedUrl);
    const xmlText = await response.text();
    
    // Simple regex parsing instead of DOM parser
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    let count = 0;
    
    while ((match = entryRegex.exec(xmlText)) !== null && count < 6) {
      const entryContent = match[1];
      
      // Extract video ID
      const idMatch = entryContent.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (!idMatch) continue;
      
      const videoId = idMatch[1];
      
      // Extract title
      const titleMatch = entryContent.match(/<title>([^<]+)<\/title>/);
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
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(videos)
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch videos' })
    };
  }
};
