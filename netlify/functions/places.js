// Full live discovery using the Google Places API (New).
// Two anchor points per region: downtown core + best off-the-beaten-path neighborhood.
// Balances discovery depth with API cost (~24 calls per build @ $0.032 = ~$0.77/build).
 
const REGION_POINTS = {
  'Tampa': [
    { name:'Tampa', lat:27.9477, lng:-82.4584, radius:5000 }, // Downtown / Water Street core
    { name:'Tampa', lat:28.0068, lng:-82.4597, radius:3000 }, // Seminole Heights — best hidden gems
  ],
  'St. Petersburg': [
    { name:'St. Petersburg', lat:27.7705, lng:-82.6377, radius:4000 }, // Downtown / Beach Drive
    { name:'St. Petersburg', lat:27.7713, lng:-82.6594, radius:3000 }, // Warehouse Arts District
  ],
  'Clearwater': [
    { name:'Clearwater', lat:27.9659, lng:-82.8001, radius:3500 }, // Downtown Clearwater
    { name:'Clearwater', lat:27.9852, lng:-82.8278, radius:2500 }, // Clearwater Beach
  ],
  'Dunedin': [
    { name:'Dunedin', lat:28.0121, lng:-82.7901, radius:3000 }, // Downtown Dunedin
    { name:'Dunedin', lat:28.0641, lng:-82.8304, radius:2500 }, // Honeymoon Island area
  ],
  'Tarpon Springs': [
    { name:'Tarpon Springs', lat:28.1488, lng:-82.7573, radius:3000 }, // Downtown / sponge docks
    { name:'Tarpon Springs', lat:28.1350, lng:-82.7570, radius:2500 }, // South / Anclote waterfront
  ],
  'Safety Harbor': [
    { name:'Safety Harbor', lat:27.9909, lng:-82.6926, radius:3000 }, // Downtown / marina
    { name:'Safety Harbor', lat:27.9700, lng:-82.6800, radius:2500 }, // South / Philippe Park area
  ],
  'St Pete Beach': [
    { name:'St Pete Beach', lat:27.7303, lng:-82.7415, radius:3500 }, // St Pete Beach central
    { name:'St Pete Beach', lat:27.6957, lng:-82.7367, radius:2500 }, // Pass-a-Grille
  ],
  'Gulfport': [
    { name:'Gulfport', lat:27.7470, lng:-82.7098, radius:2500 }, // Downtown Gulfport
    { name:'Gulfport', lat:27.7350, lng:-82.7050, radius:2000 }, // South waterfront
  ],
  'Treasure Island': [
    { name:'Treasure Island', lat:27.7670, lng:-82.7715, radius:3000 }, // Central
    { name:'Treasure Island', lat:27.7850, lng:-82.7800, radius:2500 }, // Sunset Beach north
  ],
  'Brandon': [
    { name:'Brandon', lat:27.9378, lng:-82.2859, radius:4000 }, // Downtown Brandon
    { name:'Brandon', lat:27.9200, lng:-82.3100, radius:3000 }, // South Brandon
  ]
};
 
// "Anywhere" — 3 well-spread bay points covering the whole region
const BAY_POINTS = [
  { name:'Tampa Bay', lat:27.9477, lng:-82.4584, radius:10000 }, // Tampa
  { name:'Tampa Bay', lat:27.7705, lng:-82.6377, radius: 8000 }, // St. Pete
  { name:'Tampa Bay', lat:27.9852, lng:-82.8278, radius: 7000 }, // Clearwater beaches
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
 
  // Build anchor points to query
  let queryPoints = [];
  if (regions.length > 0) {
    regions.forEach(r => { if (REGION_POINTS[r]) queryPoints.push(...REGION_POINTS[r]); });
  } else {
    queryPoints = BAY_POINTS;
  }
 
  // Focused type sets — broad categories that give real variety without explosion
  // Each point runs these concurrently, keeping total wall-clock time low
  const attrSets = [];
  if (setting !== 'outdoor') attrSets.push(
    ['museum','art_gallery'],
    ['aquarium','zoo','amusement_park','bowling_alley','movie_theater']
  );
  if (setting !== 'indoor') attrSets.push(
    ['tourist_attraction'],
    ['park','national_park','state_park']
  );
 
  const mealSets = [];
  if (mealsOn) {
    mealSets.push(
      ['restaurant','american_restaurant','seafood_restaurant','steak_house','barbecue_restaurant'],
      ['italian_restaurant','mexican_restaurant','japanese_restaurant','pizza_restaurant','chinese_restaurant'],
      ['breakfast_restaurant','brunch_restaurant','fast_food_restaurant','sandwich_shop','bar']
    );
    if (setting !== 'outdoor') mealSets.push(
      ['cafe','coffee_shop','bakery','dessert_shop','ice_cream_shop']
    );
  }
 
  const allSets = [...attrSets, ...mealSets];
 
  // Run all points CONCURRENTLY — each point fires its type sets sequentially
  // Wall-clock time = slowest single point, not all calls added together
  const raw = [];
  await Promise.all(queryPoints.map(async (pt) => {
    // Popularity pass
    for (const typeSet of allSets) {
      const r = await nearbySearch(pt.lat, pt.lng, pt.radius, typeSet, key, false);
      r.forEach(p => raw.push({ place: p, region: pt.name }));
    }
    // Distance pass — smaller radius for neighbourhood gems
    const local = Math.min(pt.radius, 2000);
    for (const typeSet of allSets) {
      const r = await nearbySearch(pt.lat, pt.lng, local, typeSet, key, true);
      r.forEach(p => raw.push({ place: p, region: pt.name }));
    }
  }));
 
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
 
