const uploadArea      = document.getElementById('uploadArea');
const fileInput       = document.getElementById('fileInput');
const previewGrid     = document.getElementById('previewGrid');
const previewList     = document.getElementById('previewList');
const addPhotoBtn     = document.getElementById('addPhotoBtn');
const addFileInput    = document.getElementById('addFileInput');
const conditionSection = document.getElementById('conditionSection');
const analyzeBtn      = document.getElementById('analyzeBtn');
const loading         = document.getElementById('loading');
const results         = document.getElementById('results');
const errorBox        = document.getElementById('errorBox');
const retryBtn        = document.getElementById('retryBtn');
const shareBtn        = document.getElementById('shareBtn');
const errorRetryBtn   = document.getElementById('errorRetryBtn');

let selectedFiles = [];
let selectedCondition = 'new';
let lastResult = null;

// Condition buttons
document.querySelectorAll('.condition-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.condition-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCondition = btn.dataset.value;
  });
});

// Upload area click
uploadArea.addEventListener('click', () => fileInput.click());

// Drag & drop
uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
});

fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));
addFileInput.addEventListener('change', () => addFiles(Array.from(addFileInput.files)));
addPhotoBtn.addEventListener('click', () => addFileInput.click());

function addFiles(files) {
  for (const file of files) {
    if (selectedFiles.length >= 3) break;
    if (file.size > 4 * 1024 * 1024) {
      alert(`"${file.name}" is too large. Max 4MB per image.`);
      continue;
    }
    selectedFiles.push(file);
  }
  if (selectedFiles.length > 0) renderPreviews();
}

function renderPreviews() {
  uploadArea.style.display = 'none';
  previewGrid.style.display = 'block';
  conditionSection.style.display = 'block';
  analyzeBtn.style.display = 'block';
  results.style.display = 'none';
  errorBox.style.display = 'none';

  previewList.innerHTML = selectedFiles.map((file, i) => {
    const url = URL.createObjectURL(file);
    return `
      <div class="preview-item">
        <img src="${url}" alt="Photo ${i + 1}">
        <button class="remove-btn" data-index="${i}">✕</button>
      </div>
    `;
  }).join('');

  // Remove button handlers
  previewList.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(parseInt(btn.dataset.index), 1);
      if (selectedFiles.length === 0) resetToUpload();
      else renderPreviews();
    });
  });

  addPhotoBtn.style.display = selectedFiles.length < 3 ? 'block' : 'none';
}

changeBtn: retryBtn.addEventListener('click', resetToUpload);
errorRetryBtn.addEventListener('click', resetToUpload);

function resetToUpload() {
  selectedFiles = [];
  fileInput.value = '';
  addFileInput.value = '';
  uploadArea.style.display = 'block';
  previewGrid.style.display = 'none';
  conditionSection.style.display = 'none';
  analyzeBtn.style.display = 'none';
  results.style.display = 'none';
  errorBox.style.display = 'none';
  loading.style.display = 'none';
  lastResult = null;
}

// Analyze
analyzeBtn.addEventListener('click', analyze);

async function analyze() {
  if (selectedFiles.length === 0) return;

  previewGrid.style.display = 'none';
  conditionSection.style.display = 'none';
  analyzeBtn.style.display = 'none';
  loading.style.display = 'block';
  results.style.display = 'none';
  errorBox.style.display = 'none';

  try {
    // Compress all images to base64
    const encoded = await Promise.all(selectedFiles.map(f => compressAndEncode(f)));
    const mimeTypes = selectedFiles.map(f => f.type);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: encoded, mimeTypes, condition: selectedCondition })
    });

    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Analysis failed');

    lastResult = data;
    showResults(data);
  } catch (err) {
    loading.style.display = 'none';
    errorBox.style.display = 'block';
    document.getElementById('errorMsg').textContent = `Error: ${err.message}`;
  }
}

function compressAndEncode(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function showResults(data) {
  loading.style.display = 'none';
  results.style.display = 'flex';

  const p = data.product;

  document.getElementById('productName').textContent = p.productName || 'Unknown Item';
  document.getElementById('brand').textContent = `Brand: ${p.brand || 'Unknown'}`;
  document.getElementById('model').textContent = `Model: ${p.model || 'Unknown'}`;
  document.getElementById('year').textContent  = `Year: ${p.estimatedYear || 'Unknown'}`;
  document.getElementById('description').textContent = p.description || '';

  const np = p.newPrice;
  if (np && np.min != null) {
    document.getElementById('newPrice').textContent = `$${np.min} – $${np.max} ${np.currency}`;
    document.getElementById('newPriceNote').textContent = np.note || '';
  }

  const up = p.usedPrice;
  if (up && up.min != null) {
    document.getElementById('usedPrice').textContent = `$${up.min} – $${up.max} ${up.currency}`;
    document.getElementById('usedPriceNote').textContent = up.note || '';
  }

  const conf = (p.confidence || '').toLowerCase();
  const confEl = document.getElementById('confidence');
  confEl.textContent = { high: 'High', medium: 'Medium', low: 'Low' }[conf] || conf;
  confEl.className = `confidence-badge confidence-${conf}`;

  // Market trend
  if (p.marketTrend) {
    document.getElementById('trendText').textContent = p.marketTrend;
    document.getElementById('trendSection').style.display = 'block';
  }

  showBuyLinks(p.searchKeywords || p.productName);

  if (data.ebay) showEbay(data.ebay);
}

// Share button
shareBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const p = lastResult.product;
  const text = `AI Price Estimate for ${p.productName}\nBrand: ${p.brand} | Year: ${p.estimatedYear}\nNew: $${p.newPrice?.min}–$${p.newPrice?.max} USD\nUsed: $${p.usedPrice?.min}–$${p.usedPrice?.max} USD`;

  if (navigator.share) {
    navigator.share({ title: 'AI Price Estimate', text });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      shareBtn.textContent = 'Copied!';
      setTimeout(() => { shareBtn.textContent = 'Share Results'; }, 2000);
    });
  }
});

function showBuyLinks(keywords) {
  if (!keywords) return;
  const q = encodeURIComponent(keywords);
  const platforms = [
    { name: 'eBay',            emoji: '🛒', url: `https://www.ebay.com/sch/i.html?_nkw=${q}` },
    { name: 'Amazon',          emoji: '📦', url: `https://www.amazon.com/s?k=${q}` },
    { name: 'Google Shopping', emoji: '🔍', url: `https://www.google.com/search?q=${q}&tbm=shop` },
  ];
  const section = document.getElementById('buySection');
  const container = document.getElementById('buyLinks');
  container.innerHTML = platforms.map(p => `
    <a class="buy-link" href="${p.url}" target="_blank" rel="noopener">
      <span class="buy-emoji">${p.emoji}</span>
      <span>${p.name}</span>
    </a>
  `).join('');
  section.style.display = 'block';
}

function showEbay(ebay) {
  const section = document.getElementById('ebaySection');
  const activeEl = document.getElementById('activeListings');
  const soldEl   = document.getElementById('soldListings');

  activeEl.innerHTML = renderEbayItems(ebay.active);
  soldEl.innerHTML   = renderEbayItems(ebay.sold);

  if (ebay.active.length > 0 || ebay.sold.length > 0) section.style.display = 'block';

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      activeEl.style.display = tab === 'active' ? 'block' : 'none';
      soldEl.style.display   = tab === 'sold'   ? 'block' : 'none';
    });
  });
}

function renderEbayItems(items) {
  if (!items || items.length === 0) return '<p style="color:#888;font-size:0.88rem">No data available</p>';
  return items.map(item => `
    <div class="ebay-item">
      <span class="ebay-title">${escapeHtml(item.title)}</span>
      <span class="ebay-price">$${item.price.toFixed(2)}</span>
      <a class="ebay-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">View</a>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
