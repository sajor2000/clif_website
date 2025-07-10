/**
 * API endpoint to collect Web Vitals metrics
 * For Netlify deployment as a serverless function
 * Save as /public/api/vitals.js for Netlify Functions
 */

// Netlify serverless function handler
export async function handler(event) {
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Parse the request body
    const body = JSON.parse(event.body);
    const { name, value, rating, id, navigationType, page } = body;

    // Simple validation
    if (!name || value === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Log the data for now (in a real environment, you would save to a database)
    console.log('Web Vital:', {
      name,
      value,
      rating,
      id,
      navigationType,
      page,
      timestamp: new Date().toISOString(),
      userAgent: event.headers['user-agent'],
      country: event.headers['x-country'] || 'unknown',
    });

    // In a production setup, you would send this data to a database or analytics service
    // Example with Google Analytics:
    // await sendToGoogleAnalytics({ name, value, rating, id });

    // Example with custom analytics endpoint:
    // await fetch('https://analytics.example.com/collect', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ name, value, rating, id, page })
    // });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error processing Web Vitals:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}
