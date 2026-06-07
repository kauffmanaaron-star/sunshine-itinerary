// Fetches live weather for Tampa Bay from the National Weather Service (free, no API key).
// Falls back to a sensible default if the request fails.

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    // Step 1: get the forecast office and grid coordinates for downtown Tampa
    const pointRes = await fetch(
      'https://api.weather.gov/points/27.9477,-82.4584',
      { headers: { 'User-Agent': 'SunshineItinerary/1.0 contact@example.com' } }
    );
    if (!pointRes.ok) throw new Error('points failed');
    const pointData = await pointRes.json();
    const forecastUrl = pointData.properties.forecast;

    // Step 2: get the actual forecast
    const forecastRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': 'SunshineItinerary/1.0 contact@example.com' }
    });
    if (!forecastRes.ok) throw new Error('forecast failed');
    const forecastData = await forecastRes.json();

    // Use the first period (current / today)
    const period = forecastData.properties.periods[0];
    const temp = `${period.temperature}\u00b0${period.temperatureUnit}`;
    const cond = period.shortForecast;
    // Trim the detailed forecast to a readable length
    const note = period.detailedForecast.length > 140
      ? period.detailedForecast.slice(0, 137) + '...'
      : period.detailedForecast;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ t: temp, cond, note })
    };

  } catch (err) {
    // Graceful fallback — app still works, just shows a static estimate
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        t: '84\u00b0F',
        cond: 'Partly sunny',
        note: 'Typical Tampa Bay afternoon \u2014 warm and humid with a chance of a brief afternoon shower.'
      })
    };
  }
};
