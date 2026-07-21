export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    const data = await response.json();
    const names = (data.models || []).map(m => m.name);
    return res.status(200).json({ models: names });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
