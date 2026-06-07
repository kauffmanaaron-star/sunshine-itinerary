// Places API proxy — keeps the Google API key server-side.
// Currently used to enrich existing POIs with live ratings, hours and a photo URL.
// In a future phase this endpoint can be extended to power full live discovery,
// replacing the static 100-place dataset with unlimited real-time results.

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const key = process.env.GOOGLE_API_KEY_PLACES;
  if (!key) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  let query, lat, lng;
  try {
    const body = JSON.parse(event.body);
    query = body.query;   // e.g. "Florida Aquarium Tampa FL"
    lat   = body.lat;
    lng   = body.lng;
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  try {
    // Find Place — cheapest Places API call, returns one best match
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(query)}` +
      `&inputtype=textquery` +
      `&locationbias=point:${lat},${lng}` +
      `&fields=place_id,name,rating,user_ratings_total,opening_hours,price_level,photos` +
      `&key=${key}`;

    const findRes = await fetch(findUrl);
    if (!findRes.ok) throw new Error(`Find place HTTP ${findRes.status}`);
    const findData = await findRes.json();

    if (!findData.candidates || !findData.candidates.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ found: false }) };
    }

    const place = findData.candidates[0];

    // Build a photo URL if available (200px thumbnail)
    let photoUrl = null;
    if (place.photos && place.photos.length) {
      const ref = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo` +
        `?maxwidth=400&photo_reference=${ref}&key=${key}`;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        found:        true,
        placeId:      place.place_id,
        rating:       place.rating || null,
        ratingCount:  place.user_ratings_total || null,
        priceLevel:   place.price_level || null,
        openNow:      place.opening_hours ? place.opening_hours.open_now : null,
        photoUrl
      })
    };

  } catch (err) {
    console.error('Places error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ found: false }) };
  }
};
