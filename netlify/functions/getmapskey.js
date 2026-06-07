// Serves the Google Maps JavaScript API key from a secure environment variable.
// The key never appears in any file in the repository — index.html fetches it
// from this endpoint at runtime instead.

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify({ key: process.env.GOOGLE_API_KEY || '' })
});
