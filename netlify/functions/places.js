// Full live discovery using the Google Places API (New).
// Multi-point neighborhood grids per region for deep off-the-beaten-path discovery.

// Each region has multiple anchor points covering different neighborhoods,
// so the distance-ranked pass surfaces local gems across the whole area —
// not just the well-known downtown cluster.
const REGION_POINTS = {
  'Tampa': [
    { name:'Tampa',       lat:27.9477, lng:-82.4584, radius:4000 }, // Downtown / Water Street
    { name:'Tampa',       lat:28.0068, lng:-82.4597, radius:3000 }, // Seminole Heights
    { name:'Tampa',       lat:27.9375, lng:-82.4760, radius:3000 }, // Hyde Park / SoHo
    { name:'Tampa',       lat:27.9620, lng:-82.4387, radius:3000 }, // Ybor City
    { name:'Tampa',       lat:27.9640, lng:-82.4670, radius:3000 }, // Armature Works / Heights
    { name:'Tampa',       lat:27.8890, lng:-82.5020, radius:3000 }, // South Tampa / Bayshore
    { name:'Tampa',       lat:28.0533, lng:-82.4055, radius:3500 }, // USF / Busch area
    { name:'Tampa',       lat:27.9200, lng:-82.5150, radius:3000 }, // Westshore / Airport area
  ],
  'St. Petersburg': [
    { name:'St. Petersburg', lat:27.7705, lng:-82.6377, radius:3500 }, // Downtown / Beach Drive
    { name:'St. Petersburg', lat:27.7713, lng:-82.6594, radius:3000 }, // Grand Central / Warehouse Arts
    { name:'St. Petersburg', lat:27.7980, lng:-82.6350, radius:3000 }, // Kenwood / Historic NW
    { name:'St. Petersburg', lat:27.7500, lng:-82.6400, radius:3000 }, // Gulfport border / south
    { name:'St. Petersburg', lat:27.7850, lng:-82.6700, radius:3000 }, // Tyrone / mid-peninsula
    { name:'St. Petersburg', lat:27.7600, lng:-82.6200, radius:3000 }, // Old Southeast / waterfront
  ],
  'Clearwater': [
    { name:'Clearwater',  lat:27.9659, lng:-82.8001, radius:3500 }, // Downtown Clearwater
    { name:'Clearwater',  lat:27.9852, lng:-82.8278, radius:3000 }, // Clearwater Beach
    { name:'Clearwater',  lat:27.9500, lng:-82.7800, radius:3000 }, // South Clearwater / US-19
    { name:'Clearwater',  lat:28.0000, lng:-82.7700, radius:3000 }, // North Clearwater / Countryside
  ],
  'Dunedin': [
    { name:'Dunedin',     lat:28.0121, lng:-82.7901, radius:3000 }, // Downtown Dunedin
    { name:'Dunedin',     lat:28.0320, lng:-82.7850, radius:2500 }, // North Dunedin
    { name:'Dunedin',     lat:28.0641, lng:-82.8304, radius:3000 }, // Honeymoon Island / Causeway
    { name:'Dunedin',     lat:27.9950, lng:-82.7900, radius:2500 }, // South Dunedin / border
  ],
  'Tarpon Springs': [
    { name:'Tarpon Springs', lat:28.1488, lng:-82.7573, radius:3000 }, // Downtown / sponge docks
    { name:'Tarpon Springs', lat:28.1610, lng:-82.7500, radius:2500 }, // North Tarpon
    { name:'Tarpon Springs', lat:28.1350, lng:-82.7570, radius:2500 }, // South Tarpon / Anclote
    { name:'Tarpon Springs', lat:28.1500, lng:-82.7800, radius:2500 }, // West / waterfront
  ],
  'Safety Harbor': [
    { name:'Safety Harbor', lat:27.9909, lng:-82.6926, radius:3000 }, // Downtown / marina
    { name:'Safety Harbor', lat:28.0100, lng:-82.6900, radius:2500 }, // North Safety Harbor
    { name:'Safety Harbor', lat:27.9700, lng:-82.6800, radius:2500 }, // South / Philippe Park
  ],
  'St Pete Beach': [
    { name:'St Pete Beach', lat:27.7303, lng:-82.7415, radius:3500 }, // St Pete Beach central
    { name:'St Pete Beach', lat:27.6957, lng:-82.7367, radius:2500 }, // Pass-a-Grille
    { name:'St Pete Beach', lat:27.7600, lng:-82.7500, radius:2500 }, // North St Pete Beach
  ],
  'Gulfport': [
    { name:'Gulfport',    lat:27.7470, lng:-82.7098, radius:2500 }, // Downtown Gulfport
    { name:'Gulfport',    lat:27.7350, lng:-82.7050, radius:2000 }, // South waterfront
  ],
  'Treasure Island': [
    { name:'Treasure Island', lat:27.7670, lng:-82.7715, radius:3000 },
    { name:'Treasure Island', lat:27.7850, lng:-82.7800, radius:2500 }, // North TI / Sunset Beach
  ],
  'Brandon': [
    { name:'Brandon',     lat:27.9378, lng:-82.2859, radius:4000 }, // Downtown Brandon
    { name:'Brandon',     lat:27.9200, lng:-82.3100, radius:3000 }, // South Brandon
    { name:'Brandon',     lat:27.9600, lng:-82.2700, radius:3000 }, // North Brandon / Bloomingdale
  ]
};

// Wide-area center for "Anywhere" queries — one broad sweep of the whole Bay
const BAY_POINTS = [
  { name:'Tampa Bay',       lat:27.9477, lng:-82.4584, radius:12000 }, // Tampa core
  { name:'Tampa Bay',       lat:27.7705, lng:-82.6377, radius:10000 }, // St. Pete core
  { name:'Tampa Bay',       lat:27.9659, lng:-82.8001, radius: 8000 }, // Clearwater / beaches
  { name:'Tampa Bay',       lat:28.1488, lng:-82.7573, radius: 8000 }, // North Pinellas
  { name:'Tampa Bay',       lat:28.0121, lng:-82.7901, radius: 6000 }, // Dunedin
];

async function nearbySearch(lat, lng, radius, includedTypes, key, rankByDistance=false) {
  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  const body = {
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    includedTypes,
    excludedTypes: [
      'lodging','hotel','motel','extended_stay_hotel','hostel',
      'gas_station','car_repair','car_wash','car_dealer',
      'dentist','doctor','hospital','pharmacy','insurance_agency',
      'real_estate_agency','lawyer','bank','atm','finance'
    ],
    maxResultCount: 20,
    rankPreference: rankByDistance ? 'DISTANCE' : 'POPULARITY'
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': [
          'places.id','places.displayName','places.types','places.location',
          'places.rating','places.userRatingCount','places.priceLevel',
          'places.currentOpeningHours','places.editorialSummary'
        ].join(',')
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Places nearbySearch failed [${includedTypes}]: ${res.status} ${err.slice(0,200)}`);
      return [];
    }
    const data = await res.json();
    if (data.error) {
      console.error(`Places API error [${includedTypes}]:`, JSON.stringify(data.error).slice(0,200));
      return [];
    }
    return data.places || [];
  } catch(e) {
    console.error(`nearbySearch exception [${includedTypes}]:`, e.message);
    return [];
  }
}

function classify(place, region) {
  const types  = place.types || [];
  const name   = (place.displayName && place.displayName.text) || '';
  const loc    = place.location;
  if (!loc) return null;
  const price    = place.priceLevel;
  const nRatings = place.userRatingCount || 0;

  const MEAL_TYPES = ['restaurant','cafe','bar','bakery','food_establishment',
    'meal_delivery','meal_takeaway','night_club','american_restaurant',
    'italian_restaurant','mexican_restaurant','japanese_restaurant',
    'chinese_restaurant','seafood_restaurant','steak_house',
    'fast_food_restaurant','pizza_restaurant','sandwich_shop',
    'coffee_shop','juice_bar','ice_cream_shop','dessert_shop',
    'breakfast_restaurant','brunch_restaurant','barbecue_restaurant'];
  const isMeal = MEAL_TYPES.some(t => types.includes(t));

  let k = 'park';
  const nameL = name.toLowerCase();
  const isRealGallery = types.includes('art_gallery') &&
    /gallery|museum|art|studio|exhibit|collection|fine art/i.test(name);
  const isRealAttraction = types.includes('tourist_attraction') &&
    !/store|shop|boutique|salon|spa|hotel|inn|suites|lodge|resort|realtor|insurance|dental|clinic|pharmacy|auto|tire|repair/i.test(name);
  const isStore = types.includes('store') || types.includes('clothing_store') ||
    types.includes('shoe_store') || types.includes('jewelry_store') ||
    types.includes('furniture_store') || types.includes('home_goods_store') ||
    types.includes('electronics_store') || types.includes('book_store') ||
    /\b(store|shop|boutique|outlet|mall|retail)\b/i.test(name);

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

  const INDOOR_TYPES = ['restaurant','cafe','bar','museum','art_gallery','aquarium',
    'night_club','movie_theater','bowling_alley','shopping_mall','spa','bakery',
    'coffee_shop','food_establishment','american_restaurant','italian_restaurant',
    'mexican_restaurant','japanese_restaurant','seafood_restaurant','fast_food_restaurant',
    'pizza_restaurant','sandwich_shop','juice_bar','ice_cream_shop','dessert_shop',
    'breakfast_restaurant','brunch_restaurant','barbecue_restaurant','steak_house'];
  const indoor = INDOOR_TYPES.some(t => types.includes(t)) || isMeal;

  const QUIET_TYPES = ['museum','art_gallery','spa','library','botanical_garden'];
  let vibe = 'busy';
  if (QUIET_TYPES.some(t => types.includes(t)))           vibe = 'quiet';
  if (isMeal) vibe = nRatings > 400 ? 'busy' : 'quiet';
  if (/garden|botanical|nature|preserve|arboretum/i.test(name)) vibe = 'quiet';
  if (/market|wharf|hall|pier|festival/i.test(name))      vibe = 'busy';

  const WATER_RE = /beach|bay|waterfront|harbor|harbour|pier|marina|gulf|coast|island|isle/i;
  const nearWater = WATER_RE.test(name) || types.some(t => /beach|marina/.test(t));

  const PRICE_MAP = {
    'PRICE_LEVEL_FREE': 0, 'PRICE_LEVEL_INEXPENSIVE': 12,
    'PRICE_LEVEL_MODERATE': 22, 'PRICE_LEVEL_EXPENSIVE': 40,
    'PRICE_LEVEL_VERY_EXPENSIVE': 70
  };
  let cost = 0;
  if (isMeal) { cost = PRICE_MAP[price] || 18; }
  else {
    if (types.includes('amusement_park'))                 cost = 100;
    else if (types.includes('aquarium') || types.includes('zoo')) cost = 32;
    else if (types.includes('museum'))                    cost = 18;
    else if (types.includes('art_gallery'))               cost = 0;
    else if (types.includes('spa'))                       cost = 60;
    else                                                  cost = 0;
  }

  let mins = 60;
  if (types.includes('amusement_park'))                   mins = 300;
  else if (types.includes('aquarium') || types.includes('zoo')) mins = 150;
  else if (types.includes('museum') || types.includes('art_gallery')) mins = 90;
  else if (types.includes('park') || types.includes('national_park')) mins = 60;
  else if (isMeal)                                        mins = 60;

  // Use Google's editorial summary if available, otherwise auto-generate
  const editorial = place.editorialSummary && place.editorialSummary.text;
  const d = editorial || generateDesc(name, types, vibe, nearWater, indoor, region, cost, nRatings);

  return { n: name, r: region, la: loc.latitude, lo: loc.longitude,
           c: cost, m: mins, in: indoor, v: vibe, b: nearWater, k, d,
           ...(isMeal ? { meal: true } : {}) };
}

function generateDesc(name, types, vibe, nearWater, indoor, region, cost, nRatings){
  const pop    = nRatings>1000 ? 'Wildly popular ' : nRatings>200 ? 'Well-loved ' : '';
  const wf     = nearWater ? 'waterfront ' : '';
  const tone   = vibe==='busy' ? 'Lively' : 'Relaxed';
  if(types.includes('coffee_shop')||types.includes('juice_bar')) return pop+'Coffee and light bites in '+region+'.';
  if(types.includes('ice_cream_shop')||types.includes('dessert_shop')) return pop+'Ice cream and desserts in '+region+'.';
  if(types.includes('bakery')) return pop+'Fresh-baked goods and café fare in '+region+'.';
  if(types.includes('breakfast_restaurant')||types.includes('brunch_restaurant')) return pop+'Breakfast and brunch in '+region+'.';
  if(types.includes('barbecue_restaurant')) return pop+'Smoked meats and BBQ in '+region+'.';
  if(types.includes('seafood_restaurant')) return pop+wf+'Seafood restaurant in '+region+'.';
  if(types.includes('italian_restaurant')||types.includes('pizza_restaurant')) return pop+'Italian kitchen in '+region+'.';
  if(types.includes('mexican_restaurant')) return pop+'Mexican cuisine in '+region+'.';
  if(types.includes('japanese_restaurant')) return pop+'Japanese dining in '+region+'.';
  if(types.includes('steak_house')) return pop+'Steakhouse in '+region+'.';
  if(types.includes('bar')||types.includes('night_club')) return pop+tone+' bar and drinks in '+region+'.';
  if(types.some(function(t){return t.includes('restaurant');})) return pop+(vibe==='busy'?'Bustling':'Casual')+' dining in '+region+(nearWater?' with waterfront views':'')+'.';
  if(types.includes('aquarium')) return pop+'Marine life exhibits in '+region+'.';
  if(types.includes('zoo')) return pop+'Wildlife and animals in '+region+'.';
  if(types.includes('amusement_park')) return 'Rides and entertainment in '+region+'.';
  if(types.includes('museum')) return pop+(vibe==='busy'?'Popular':'Quiet')+' museum in '+region+'.';
  if(types.includes('art_gallery')) return pop+'Art gallery in '+region+'.';
  if(types.includes('spa')) return pop+'Spa and wellness in '+region+'.';
  if(types.includes('national_park')||types.includes('state_park')) return pop+'State or national park near '+region+'.';
  if(types.includes('park')||types.includes('natural_feature')) return pop+wf+'Park — great for a stroll near '+region+'.';
  if(types.includes('tourist_attraction')) return pop+(vibe==='busy'?'Popular':'Well-regarded')+' attraction in '+region+'.';
  return pop+(indoor?'Indoor':'Outdoor')+' '+(vibe==='busy'?'lively':'quiet')+' spot in '+region+'.';
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const key = process.env.GOOGLE_API_KEY_PLACES;
  if (!key) {
    console.error('GOOGLE_API_KEY_PLACES not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  let regions = [], setting = 'either', mealsOn = true;
  try {
    const body = JSON.parse(event.body || '{}');
    regions  = body.regions  || [];
    setting  = body.setting  || 'either';
    mealsOn  = body.mealsOn !== false;
  } catch(e) { console.error('Body parse error:', e.message); }

  console.log(`Places request: regions=${JSON.stringify(regions)} setting=${setting} mealsOn=${mealsOn}`);

  // Build the list of anchor points to query
  let queryPoints = [];
  if (regions.length > 0) {
    // Specific regions selected — use all neighborhood points for each
    regions.forEach(r => {
      if (REGION_POINTS[r]) queryPoints.push(...REGION_POINTS[r]);
    });
  } else {
    // "Anywhere" — use the wide bay-area sweep
    queryPoints = BAY_POINTS;
  }

  // Cap total points to keep latency reasonable (each point × type sets = many calls)
  // For 1 region: use all its points. For 2+: cap at 6 points total, spread evenly.
  if (regions.length > 1) {
    const perRegion = Math.max(2, Math.floor(6 / regions.length));
    queryPoints = regions.flatMap(r => (REGION_POINTS[r] || []).slice(0, perRegion));
  }

  // ── Attraction type sets ──────────────────────────────────────────────────────
  const attractionSets = [];
  if (setting !== 'outdoor') {
    attractionSets.push(
      ['museum'],
      ['art_gallery'],
      ['aquarium','zoo'],
      ['movie_theater','bowling_alley'],
      ['spa'],
      ['amusement_park']
    );
  }
  if (setting !== 'indoor') {
    attractionSets.push(
      ['tourist_attraction'],
      ['park'],
      ['national_park','state_park'],
      ['campground','rv_park']
    );
  }

  // ── Meal type sets ────────────────────────────────────────────────────────────
  const mealSets = [];
  if (mealsOn) {
    mealSets.push(
      ['restaurant','american_restaurant'],
      ['seafood_restaurant','steak_house'],
      ['italian_restaurant','pizza_restaurant'],
      ['mexican_restaurant','japanese_restaurant'],
      ['barbecue_restaurant','chinese_restaurant'],
      ['breakfast_restaurant','brunch_restaurant'],
      ['fast_food_restaurant','sandwich_shop'],
      ['bar','night_club']
    );
    if (setting !== 'outdoor') {
      mealSets.push(
        ['cafe','coffee_shop'],
        ['bakery','dessert_shop','ice_cream_shop']
      );
    }
  }

  const allTypeSets = [...attractionSets, ...mealSets];

  // ── Query: popularity pass on all points, then distance pass for hidden gems ──
  const raw = [];
  for (const pt of queryPoints) {
    // Popularity pass — well-known spots
    for (const typeSet of allTypeSets) {
      const results = await nearbySearch(pt.lat, pt.lng, pt.radius, typeSet, key, false);
      results.forEach(r => raw.push({ place: r, region: pt.name }));
    }
    // Distance pass — neighbourhood gems with tighter radius
    const localRadius = Math.min(pt.radius, 2500);
    for (const typeSet of allTypeSets) {
      const results = await nearbySearch(pt.lat, pt.lng, localRadius, typeSet, key, true);
      results.forEach(r => raw.push({ place: r, region: pt.name }));
    }
  }

  console.log(`Raw results before dedup: ${raw.length}`);

  const seenIds = new Set(), seenNames = new Set(), pois = [];
  for (const { place, region } of raw) {
    if (!place.id || seenIds.has(place.id)) continue;
    const name = place.displayName && place.displayName.text;
    if (!name || seenNames.has(name)) continue;
    seenIds.add(place.id);
    seenNames.add(name);
    const poi = classify(place, region);
    if (poi) pois.push(poi);
  }

  console.log(`Returning ${pois.length} classified POIs`);
  return { statusCode: 200, headers, body: JSON.stringify({ pois, count: pois.length }) };
};
