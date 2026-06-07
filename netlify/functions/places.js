// Full live discovery — queries Google Places Nearby Search based on the
// user's filters (regions, setting, mealsOn) and returns classified POIs
// ready to merge with the curated dataset in the client.

const REGION_CENTERS = {
  'Tampa':          { lat: 27.9477, lng: -82.4584, radius: 7000 },
  'St. Petersburg': { lat: 27.7705, lng: -82.6377, radius: 6000 },
  'Clearwater':     { lat: 27.9659, lng: -82.8001, radius: 5000 },
  'Dunedin':        { lat: 28.0121, lng: -82.7901, radius: 4000 },
  'Tarpon Springs': { lat: 28.1488, lng: -82.7573, radius: 4000 },
  'Safety Harbor':  { lat: 27.9909, lng: -82.6926, radius: 3500 },
  'St Pete Beach':  { lat: 27.7303, lng: -82.7415, radius: 4000 },
  'Gulfport':       { lat: 27.7470, lng: -82.7098, radius: 3000 },
  'Treasure Island':{ lat: 27.7670, lng: -82.7715, radius: 3000 },
  'Brandon':        { lat: 27.9378, lng: -82.2859, radius: 5000 }
};

// Tampa Bay wide center for "Anywhere" queries
const BAY_CENTER = { lat: 27.90, lng: -82.63, radius: 35000 };

// ── Google Places Nearby Search ──────────────────────────────────────────────
async function nearbySearch(lat, lng, radius, type, key) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&radius=${radius}&type=${type}` +
    `&rankby=prominence&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Places API status:', data.status, type);
    return [];
  }
  return data.results || [];
}

// ── Classify a raw Places result into our app's schema ───────────────────────
function classify(place, region) {
  const types  = place.types || [];
  const name   = place.name  || '';
  const price  = place.price_level;
  const nRatings = place.user_ratings_total || 0;
  const loc    = place.geometry && place.geometry.location;
  if (!loc) return null;

  // Meal vs attraction
  const MEAL_TYPES = ['restaurant','cafe','bar','bakery','food',
                      'meal_delivery','meal_takeaway','night_club'];
  const isMeal = MEAL_TYPES.some(t => types.includes(t));

  // Kind → icon
  let k = 'park';
  if      (types.includes('aquarium'))              k = 'aquarium';
  else if (types.includes('zoo'))                   k = 'amusement';
  else if (types.includes('amusement_park'))        k = 'amusement';
  else if (types.includes('museum'))                k = 'museum';
  else if (types.includes('art_gallery'))           k = 'art';
  else if (types.includes('bowling_alley'))         k = 'amusement';
  else if (types.includes('movie_theater'))         k = 'amusement';
  else if (types.includes('spa'))                   k = 'nature';
  else if (/beach/i.test(name) || types.includes('beach')) k = 'beach';
  else if (types.includes('park') || types.includes('natural_feature')) k = 'park';
  else if (types.includes('tourist_attraction'))    k = 'museum';
  else if (isMeal) {
    if (/sushi|ramen|japanese/i.test(name))         k = 'sushi';
    else if (/pizza|italian|trattoria|osteria/i.test(name)) k = 'italian';
    else if (/mexican|taco|cantina/i.test(name))    k = 'mexican';
    else if (/bbq|barbecue|smokehouse/i.test(name)) k = 'bbq';
    else if (/seafood|fish|crab|lobster|oyster/i.test(name)) k = 'seafood';
    else if (/cafe|coffee|brew|roast|espresso|bakery/i.test(name)) k = 'cafe';
    else if (types.includes('bar') || types.includes('night_club')) k = 'brewery';
    else k = 'restaurant';
  }

  // Indoor
  const INDOOR_TYPES = ['museum','art_gallery','aquarium','restaurant','cafe','bar',
    'night_club','movie_theater','bowling_alley','shopping_mall','gym','spa','bakery','food'];
  const indoor = INDOOR_TYPES.some(t => types.includes(t)) || isMeal;

  // Vibe
  let vibe = 'busy'; // default
  const QUIET_TYPES = ['museum','art_gallery','spa','natural_feature','library'];
  if (QUIET_TYPES.some(t => types.includes(t)))         vibe = 'quiet';
  if (isMeal) vibe = nRatings > 400 ? 'busy' : 'quiet';
  if (/garden|botanical|arboretum|nature|preserve/i.test(name)) vibe = 'quiet';
  if (/market|wharf|hall|pier|festival/i.test(name))    vibe = 'busy';

  // Near water
  const WATER_RE = /beach|bay|waterfront|harbor|harbour|pier|marina|gulf|coast|island|isle/i;
  const nearWater = WATER_RE.test(name) ||
    types.some(t => /beach|marina/.test(t));

  // Cost estimate
  let cost = 0;
  if (isMeal) {
    cost = ({1: 12, 2: 20, 3: 35, 4: 60})[price] || 18;
  } else {
    if (types.includes('amusement_park'))            cost = 100;
    else if (types.includes('aquarium') || types.includes('zoo')) cost = 32;
    else if (types.includes('museum'))               cost = 18;
    else if (types.includes('art_gallery'))          cost = 0;
    else if (types.includes('spa'))                  cost = 60;
    else                                             cost = 0;
  }

  // Duration estimate (minutes)
  let mins = 60;
  if (types.includes('amusement_park'))              mins = 300;
  else if (types.includes('aquarium') || types.includes('zoo')) mins = 150;
  else if (types.includes('museum') || types.includes('art_gallery')) mins = 90;
  else if (types.includes('park') || types.includes('natural_feature')) mins = 60;
  else if (isMeal)                                   mins = 60;

  return {
    n:  name,
    r:  region,
    la: loc.lat,
    lo: loc.lng,
    c:  cost,
    m:  mins,
    in: indoor,
    v:  vibe,
    b:  nearWater,
    k,
    ...(isMeal ? { meal: true } : {})
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const key = process.env.GOOGLE_API_KEY_PLACES;
  if (!key) return { statusCode: 500, headers, body: JSON.stringify({ error: 'No key' }) };

  let regions = [], setting = 'either', mealsOn = true;
  try {
    const body = JSON.parse(event.body || '{}');
    regions  = body.regions  || [];
    setting  = body.setting  || 'either';
    mealsOn  = body.mealsOn !== false;
  } catch(e) {}

  // Determine query targets
  const targets = regions.length > 0
    ? regions.filter(r => REGION_CENTERS[r]).map(r => ({ name: r, ...REGION_CENTERS[r] }))
    : [{ name: 'Tampa Bay', ...BAY_CENTER }]; // "Anywhere" = one wide query

  // Cap at 4 regions to keep latency reasonable (all results deduped client-side with curated list)
  const queryTargets = targets.slice(0, 4);

  // Build type list based on filters
  const attractionTypes = [];
  if (setting !== 'outdoor') attractionTypes.push('museum','art_gallery','aquarium','amusement_park','spa');
  if (setting !== 'indoor')  attractionTypes.push('tourist_attraction','park','natural_feature');
  const mealTypes = [];
  if (mealsOn) {
    mealTypes.push('restaurant');
    if (setting !== 'outdoor') mealTypes.push('cafe');
  }

  // Fire all queries concurrently per target (faster than sequential)
  const raw = [];
  await Promise.all(queryTargets.map(async (t) => {
    const allTypes = [...attractionTypes, ...mealTypes];
    await Promise.all(allTypes.map(async (type) => {
      const results = await nearbySearch(t.lat, t.lng, t.radius, type, key);
      results.forEach(r => raw.push({ place: r, region: t.name }));
    }));
  }));

  // Classify, dedupe by place_id and name, filter nulls
  const seenIds   = new Set();
  const seenNames = new Set();
  const pois = [];

  for (const { place, region } of raw) {
    if (seenIds.has(place.place_id))   continue;
    if (seenNames.has(place.name))     continue;
    seenIds.add(place.place_id);
    seenNames.add(place.name);
    const poi = classify(place, region);
    if (poi) pois.push(poi);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ pois, count: pois.length })
  };
};
