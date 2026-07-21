# price-estimator

## Goal
An AI-powered product appraisal web app. Users upload a photo of any item, and the app identifies the brand, model, year, condition, and gives estimated new and used prices.

## Live URL
https://price-estimator-five.vercel.app

## Stack
- **Frontend**: HTML / CSS / Vanilla JS (in `public/`)
- **Backend**: Vercel Serverless Functions (Node.js, in `api/`)
- **AI**: Google Gemini API (gemini-3-flash-preview) — image recognition + price estimation
- **Price data**: eBay Browse API (optional, plug in EBAY_APP_ID when available)

## Features
- Upload 1–3 photos of the same item
- Condition selector (New / Like New / Good / Fair / Poor)
- AI identifies: product name, brand, model, estimated year
- Estimated new price and used price (USD)
- Market trend note
- Where to buy links (eBay, Amazon, Google Shopping)
- Share / copy results
- eBay live price listings (when EBAY_APP_ID is set)

## Environment Variables (set in Vercel)
| Key | Description |
|-----|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key (free tier) |
| `EBAY_APP_ID` | eBay Developer App ID (optional, for live prices) |

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Send images + condition → get product info + prices |
| `/api/models` | GET | Debug: list available Gemini models |

## Deployment
- Hosted on **Vercel** (auto-deploys on push to `main`)
- GitHub repo: https://github.com/ericchu0507-tech/price-estimator

## Folder Structure
```
price-estimator/
├── api/
│   ├── analyze.js      ← main AI analysis endpoint
│   └── models.js       ← debug: list available models
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .env.example        ← template for API keys
├── .gitignore
├── package.json
├── vercel.json
└── CLAUDE.md           ← this file
```
