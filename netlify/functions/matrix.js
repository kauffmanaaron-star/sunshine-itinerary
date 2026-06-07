// Returns real driving times (in seconds) between consecutive itinerary stops
// using the Google Distance Matrix API. Reads the key from Netlify environment variables.

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const key = process.env.GOOGLE_API_KEY_MATRIX;
  if (!key) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  let stops;
  try {
    stops = JSON.parse(event.body).stops;
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!stops || stops.length < 2) {
    return { statusCode: 200, headers, body: JSON.stringify({ times: [] }) };
  }

  try {
    // Build origins (all stops except last) and destinations (all stops except first)
    // so that element[i][i] gives the sequential leg i -> i+1
    const origins = stops.slice(0, -1).map(s => `${s.la},${s.lo}`).join('|');
    const destinations = stops.slice(1).map(s => `${s.la},${s.lo}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinations)}` +
      `&mode=driving` +
      `&units=imperial` +
      `&key=${key}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Matrix API HTTP ${res.status}`);
    const data = await res.json();

    if (data.status !== 'OK') throw new Error(`Matrix API: ${data.status}`);

    // Read the diagonal: row[i].elements[i] = leg from stop[i] to stop[i+1]
    const times = data.rows.map((row, i) => {
      const el = row.elements[i];
      if (el && el.status === 'OK') return el.duration.value; // seconds
      return null; // null = fall back to haversine estimate in the app
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ times })
    };

  } catch (err) {
    console.error('Matrix error:', err.message);
    // Return nulls — the app falls back to haversine estimates for any null leg
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ times: new Array(stops.length - 1).fill(null) })
    };
  }
};
