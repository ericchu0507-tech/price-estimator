export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    // Step 1: 用 Gemini 辨識物品並估價
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are a professional product appraiser. Analyze this image carefully.

Return ONLY a valid JSON object with no markdown formatting:
{
  "productName": "specific product name in English",
  "brand": "brand name, or 'Unknown' if not identifiable",
  "model": "model name or number, or 'Unknown'",
  "estimatedYear": "year or range like '2018-2020', or 'Unknown'",
  "category": "product category (e.g. Electronics, Clothing, Toy, etc.)",
  "newPrice": {
    "min": 0,
    "max": 0,
    "currency": "USD",
    "note": "brief reason for this estimate"
  },
  "usedPrice": {
    "min": 0,
    "max": 0,
    "currency": "USD",
    "note": "brief reason for this estimate"
  },
  "searchKeywords": "3-5 keywords suitable for eBay search",
  "confidence": "high or medium or low",
  "description": "2-3 sentence product description"
}`
              },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json();
      throw new Error(`Gemini error: ${JSON.stringify(errData)}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Gemini returned no text');

    // 清除可能的 markdown 格式後解析 JSON
    const cleanText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const product = JSON.parse(cleanText);

    // Step 2: 用 eBay API 查詢實際售價（需要 EBAY_APP_ID）
    let ebay = null;
    if (process.env.EBAY_APP_ID && product.searchKeywords) {
      ebay = await searchEbay(product.searchKeywords, process.env.EBAY_APP_ID);
    }

    return res.status(200).json({ success: true, product, ebay });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

async function searchEbay(keywords, appId) {
  const base = 'https://svcs.ebay.com/services/search/FindingService/v1';
  const common = `SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&keywords=${encodeURIComponent(keywords)}&paginationInput.entriesPerPage=5`;

  const [activeRes, soldRes] = await Promise.all([
    fetch(`${base}?OPERATION-NAME=findItemsByKeywords&${common}&sortOrder=BestMatch`),
    fetch(`${base}?OPERATION-NAME=findCompletedItems&${common}&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true&sortOrder=EndTimeSoonest`)
  ]);

  const [activeData, soldData] = await Promise.all([activeRes.json(), soldRes.json()]);

  const parseItems = (items = []) => items.map(item => ({
    title: item.title?.[0] || '',
    price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
    currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] || 'USD',
    url: item.viewItemURL?.[0] || '',
    condition: item.condition?.[0]?.conditionDisplayName?.[0] || ''
  }));

  return {
    active: parseItems(activeData?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item),
    sold: parseItems(soldData?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item)
  };
}
