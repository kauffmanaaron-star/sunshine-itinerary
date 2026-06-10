// Full live discovery using the Google Places API (New).
// Uses the Nearby Search endpoint from the new Places API.

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

const BAY_CENTER = { lat: 27.90, lng: -82.63, radius: 35000 };

// Places API (New) — Nearby Search
async function nearbySearch(lat, lng, radius, includedTypes, key) {
  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  const body = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius
      }
    },
    includedTypes,
    maxResultCount: 20,
    rankPreference: 'POPULARITY'
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.types',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.currentOpeningHours',
        'places.editorialSummary'
      ].join(',')
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Places API error:', res.status, err.slice(0, 200));
    return [];
  }
  const data = await res.json();
  return data.places || [];
}


// Auto-generate a short description from available metadata when Google
// doesn't provide an editorial summary (which is most places).
function generateDesc(name, types, vibe, nearWater, indoor, region, cost, nRatings){
  const busy   = vibe==='busy';
  const pop    = nRatings>1000 ? 'wildly popular ' : nRatings>200 ? 'well-loved ' : '';
  const wf     = nearWater ? 'Waterfront ' : '';
  const tone   = busy ? 'Lively' : 'Relaxed';

  // ── Meals ──────────────────────────────────────────────────────────────────
  if(types.includes('coffee_shop')||types.includes('juice_bar'))
    return pop+'Coffee, light bites and good vibes in '+region+'.';
  if(types.includes('ice_cream_shop')||types.includes('dessert_shop'))
    return pop+'Ice cream, sweets and desserts in '+region+'.';
  if(types.includes('bakery'))
    return pop+'Fresh-baked goods and café fare in '+region+'.';
  if(types.includes('breakfast_restaurant')||types.includes('brunch_restaurant'))
    return pop+'Breakfast and brunch favourite in '+region+'.';
  if(types.includes('barbecue_restaurant'))
    return pop+'Smoked meats and BBQ plates in '+region+'.';
  if(types.includes('seafood_restaurant'))
    return pop+wf+'Seafood restaurant in '+region+'.';
  if(types.includes('italian_restaurant')||types.includes('pizza_restaurant'))
    return pop+'Italian kitchen in '+region+'.';
  if(types.includes('mexican_restaurant'))
    return pop+'Mexican cuisine and margaritas in '+region+'.';
  if(types.includes('japanese_restaurant'))
    return pop+'Sushi, ramen and Japanese dishes in '+region+'.';
  if(types.includes('steak_house'))
    return pop+'Steakhouse with a full bar in '+region+'.';
  if(types.includes('fast_food_restaurant')||types.includes('sandwich_shop'))
    return pop+'Quick, casual eats in '+region+'.';
  if(types.includes('bar')||types.includes('night_club'))
    return pop+tone+' bar and drinks spot in '+region+'.';
  if(types.some(function(t){return t.includes('restaurant');}))
    return pop+(busy?'Bustling':'Casual')+' dining in '+region+(nearWater?' with waterfront views':'')+'.';

  // ── Attractions ────────────────────────────────────────────────────────────
  if(types.includes('aquarium'))
    return pop+'Marine life exhibits and hands-on sea-life experiences in '+region+'.';
  if(types.includes('zoo'))
    return pop+'Animals, wildlife and conservation education in '+region+'.';
  if(types.includes('amusement_park'))
    return 'Rides, shows and full-day entertainment in '+region+'.';
  if(types.includes('museum'))
    return pop+(busy?'Popular':'Quiet')+' museum worth a visit in '+region+'.';
  if(types.includes('art_gallery'))
    return pop+'Art gallery with rotating exhibitions in '+region+'.';
  if(types.includes('spa'))
    return pop+'Spa and wellness retreat in '+region+'.';
  if(types.includes('movie_theater'))
    return 'Cinema — catch a film in '+region+'.';
  if(types.includes('bowling_alley'))
    return 'Bowling lanes and entertainment in '+region+'.';
  if(types.includes('national_park')||types.includes('state_park'))
    return pop+'State or national park with trails and natural scenery near '+region+'.';
  if(types.includes('park')||types.includes('natural_feature'))
    return pop+wf+'Park — a great spot for a walk or some fresh air near '+region+'.';
  if(types.includes('tourist_attraction'))
    return pop+(busy?'Popular':'Well-regarded')+' local attraction in '+region+'.';

  // Generic fallback
  return pop+(indoor?'Indoor':'Outdoor')+' '+(busy?'lively':'quiet')+' spot in '+region+'.';
}

// Classify a Places API (New) result into our app schema
function classify(place, region) {
  const types    = place.types || [];
  const name     = (place.displayName && place.displayName.text) || '';
  const loc      = place.location;
  if (!loc) return null;

  const price    = place.priceLevel;    // e.g. "PRICE_LEVEL_MODERATE"
  const nRatings = place.userRatingCount || 0;

  // Meal vs attraction
  const MEAL_TYPES = ['restaurant','cafe','bar','bakery','food_establishment',
                      'meal_delivery','meal_takeaway','night_club','american_restaurant',
                      'italian_restaurant','mexican_restaurant','japanese_restaurant',
                      'chinese_restaurant','seafood_restaurant','steak_house',
                      'fast_food_restaurant','pizza_restaurant','sandwich_shop',
                      'coffee_shop','juice_bar','ice_cream_shop','dessert_shop',
                      'breakfast_restaurant','brunch_restaurant','barbecue_restaurant'];
  const isMeal = MEAL_TYPES.some(t => types.includes(t));

  // Kind → icon
  // For ambiguous types (art_gallery, tourist_attraction) we cross-check the
  // name so a store with art_gallery in its Google types doesn't get mislabelled.
  const nameL = name.toLowerCase();
  const isRealGallery  = types.includes('art_gallery') &&
    /gallery|museum|art|studio|exhibit|collection|fine art/i.test(name);
  const isRealAttraction = types.includes('tourist_attraction') &&
    !/store|shop|boutique|salon|spa|hotel|inn|suites|lodge|resort|realtor|insurance|dental|clinic|pharmacy|auto|tire|repair/i.test(name);
  const isStore = types.includes('store') || types.includes('clothing_store') ||
    types.includes('shoe_store') || types.includes('jewelry_store') ||
    types.includes('furniture_store') || types.includes('home_goods_store') ||
    types.includes('electronics_store') || types.includes('book_store') ||
    /\b(store|shop|boutique|outlet|mall|retail)\b/i.test(name);

  let k = 'park';
  if      (types.includes('aquarium'))                    k = 'aquarium';
  else if (types.includes('zoo'))                         k = 'amusement';
  else if (types.includes('amusement_park'))              k = 'amusement';
  else if (types.includes('museum'))                      k = 'museum';
  else if (isRealGallery)                                 k = 'art';
  else if (types.includes('movie_theater'))               k = 'amusement';
  else if (types.includes('bowling_alley'))               k = 'amusement';
  else if (types.includes('spa') && !isStore)             k = 'nature';
  else if (/beach/i.test(name) || types.includes('beach'))k = 'beach';
  else if (types.includes('park') || types.includes('national_park') || types.includes('state_park')) k = 'park';
  else if (isStore)                                       k = 'shops';
  else if (isRealAttraction)                              k = 'museum';
  else if (isMeal) {
    if (types.includes('japanese_restaurant') || /sushi|ramen/i.test(name))  k = 'sushi';
    else if (types.includes('italian_restaurant') || types.includes('pizza_restaurant')) k = 'italian';
    else if (types.includes('mexican_restaurant'))        k = 'mexican';
    else if (types.includes('barbecue_restaurant'))       k = 'bbq';
    else if (types.includes('seafood_restaurant'))        k = 'seafood';
    else if (types.includes('coffee_shop') || types.includes('cafe') ||
             types.includes('juice_bar') || types.includes('bakery'))        k = 'cafe';
    else if (types.includes('ice_cream_shop') || types.includes('dessert_shop')) k = 'dessert';
    else if (types.includes('bar') || types.includes('night_club'))          k = 'brewery';
    else                                                  k = 'restaurant';
  }

  // Indoor
  const INDOOR_TYPES = ['restaurant','cafe','bar','museum','art_gallery','aquarium',
    'night_club','movie_theater','bowling_alley','shopping_mall','spa','bakery',
    'coffee_shop','food_establishment','american_restaurant','italian_restaurant',
    'mexican_restaurant','japanese_restaurant','seafood_restaurant','fast_food_restaurant',
    'pizza_restaurant','sandwich_shop','juice_bar','ice_cream_shop','dessert_shop',
    'breakfast_restaurant','brunch_restaurant','barbecue_restaurant','steak_house'];
  const indoor = INDOOR_TYPES.some(t => types.includes(t)) || isMeal;

  // Vibe
  const QUIET_TYPES = ['museum','art_gallery','spa','library','botanical_garden'];
  let vibe = 'busy';
  if (QUIET_TYPES.some(t => types.includes(t)))           vibe = 'quiet';
  if (isMeal) vibe = nRatings > 400 ? 'busy' : 'quiet';
  if (/garden|botanical|nature|preserve|arboretum/i.test(name)) vibe = 'quiet';
  if (/market|wharf|hall|pier|festival/i.test(name))      vibe = 'busy';

  // Near water
  const WATER_RE = /beach|bay|waterfront|harbor|harbour|pier|marina|gulf|coast|island|isle/i;
  const nearWater = WATER_RE.test(name) || types.some(t => /beach|marina/.test(t));

  // Cost — new API uses string price levels
  const PRICE_MAP = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 12,
    'PRICE_LEVEL_MODERATE': 22,
    'PRICE_LEVEL_EXPENSIVE': 40,
    'PRICE_LEVEL_VERY_EXPENSIVE': 70
  };
  let cost = 0;
  if (isMeal) {
    cost = PRICE_MAP[price] || 18;
  } else {
    if (types.includes('amusement_park'))                 cost = 100;
    else if (types.includes('aquarium') || types.includes('zoo')) cost = 32;
    else if (types.includes('museum'))                    cost = 18;
    else if (types.includes('art_gallery'))               cost = 0;
    else if (types.includes('spa'))                       cost = 60;
    else                                                  cost = 0;
  }

  // Duration (minutes)
  let mins = 60;
  if (types.includes('amusement_park'))                   mins = 300;
  else if (types.includes('aquarium') || types.includes('zoo')) mins = 150;
  else if (types.includes('museum') || types.includes('art_gallery')) mins = 90;
  else if (types.includes('park') || types.includes('national_park')) mins = 60;
  else if (isMeal)                                        mins = 60;

  return {
    n:  name,
    r:  region,
    la: loc.latitude,
    lo: loc.longitude,
    c:  cost,
    m:  mins,
    in: indoor,
    v:  vibe,
    b:  nearWater,
    k,
    // Use Google's editorial summary if available, otherwise auto-generate
    d: (place.editorialSummary && place.editorialSummary.text)
       ? place.editorialSummary.text
       : generateDesc(name, types, vibe, nearWater, indoor, region, cost, nRatings),
    ...(isMeal ? { meal: true } : {})
  };
}

// Main handler
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const key = process.env.GOOGLE_API_KEY_PLACES;
  if (!key) return {
    statusCode: 500, headers,
    body: JSON.stringify({ error: 'Missing GOOGLE_API_KEY_PLACES' })
  };

  let regions = [], setting = 'either', mealsOn = true;
  try {
    const body = JSON.parse(event.body || '{}');
    regions  = body.regions  || [];
    setting  = body.setting  || 'either';
    mealsOn  = body.mealsOn !== false;
  } catch(e) {}

  // Query targets
  const targets = regions.length > 0
    ? regions.filter(r => REGION_CENTERS[r])
        .map(r => ({ name: r, ...REGION_CENTERS[r] }))
    : [{ name: 'Tampa Bay', ...BAY_CENTER }];

  const queryTargets = targets.slice(0, 4);

  // Build type lists based on filters
  const attractionTypes = [];
  if (setting !== 'outdoor') {
    attractionTypes.push(
      ['museum','art_gallery'],
      ['aquarium'],
      ['amusement_park']
    );
  }
  if (setting !== 'indoor') {
    attractionTypes.push(
      ['tourist_attraction'],
      ['park','national_park','state_park']
    );
  }

  const mealTypeSets = [];
  if (mealsOn) {
    mealTypeSets.push(
      ['restaurant','american_restaurant','seafood_restaurant','steak_house','barbecue_restaurant'],
      ['italian_restaurant','mexican_restaurant','japanese_restaurant','pizza_restaurant'],
      ['breakfast_restaurant','brunch_restaurant','fast_food_restaurant','sandwich_shop']
    );
    if (setting !== 'outdoor') {
      mealTypeSets.push(['cafe','coffee_shop','bakery','dessert_shop','ice_cream_shop']);
    }
  }

  // Fire all queries concurrently
  const raw = [];
  await Promise.all(queryTargets.map(async (t) => {
    const allSets = [...attractionTypes, ...mealTypeSets];
    await Promise.all(allSets.map(async (typeSet) => {
      const results = await nearbySearch(t.lat, t.lng, t.radius, typeSet, key);
      results.forEach(r => raw.push({ place: r, region: t.name }));
    }));
  }));

  // Deduplicate and classify
  const seenIds   = new Set();
  const seenNames = new Set();
  const pois = [];

  for (const { place, region } of raw) {
    if (!place.id || seenIds.has(place.id))     continue;
    const name = place.displayName && place.displayName.text;
    if (!name || seenNames.has(name))           continue;
    seenIds.add(place.id);
    seenNames.add(name);
    const poi = classify(place, region);
    if (poi) pois.push(poi);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ pois, count: pois.length })
  };
};
