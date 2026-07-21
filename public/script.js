const uploadArea   = document.getElementById('uploadArea');
const fileInput    = document.getElementById('fileInput');
const previewArea  = document.getElementById('previewArea');
const previewImg   = document.getElementById('previewImg');
const changeBtn    = document.getElementById('changeBtn');
const analyzeBtn   = document.getElementById('analyzeBtn');
const loading      = document.getElementById('loading');
const results      = document.getElementById('results');
const errorBox     = document.getElementById('errorBox');
const retryBtn     = document.getElementById('retryBtn');
const errorRetryBtn = document.getElementById('errorRetryBtn');

let selectedFile = null;

// 點擊上傳區域
uploadArea.addEventListener('click', () => fileInput.click());

// 拖曳上傳
uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

// 選擇檔案
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (file.size > 4 * 1024 * 1024) {
    alert('圖片太大了！請選擇 4MB 以下的圖片。');
    return;
  }
  selectedFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  uploadArea.style.display = 'none';
  previewArea.style.display = 'block';
  analyzeBtn.style.display = 'block';
  results.style.display = 'none';
  errorBox.style.display = 'none';
}

// 換張圖片
changeBtn.addEventListener('click', resetToUpload);
retryBtn.addEventListener('click', resetToUpload);
errorRetryBtn.addEventListener('click', resetToUpload);

function resetToUpload() {
  selectedFile = null;
  fileInput.value = '';
  uploadArea.style.display = 'block';
  previewArea.style.display = 'none';
  analyzeBtn.style.display = 'none';
  results.style.display = 'none';
  errorBox.style.display = 'none';
  loading.style.display = 'none';
}

// 開始分析
analyzeBtn.addEventListener('click', analyze);

async function analyze() {
  if (!selectedFile) return;

  previewArea.style.display = 'none';
  analyzeBtn.style.display = 'none';
  loading.style.display = 'block';
  results.style.display = 'none';
  errorBox.style.display = 'none';

  try {
    // 將圖片壓縮並轉成 base64
    const base64 = await compressAndEncode(selectedFile);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        mimeType: selectedFile.type
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || '分析失敗');

    showResults(data);
  } catch (err) {
    loading.style.display = 'none';
    errorBox.style.display = 'block';
    document.getElementById('errorMsg').textContent = `錯誤：${err.message}`;
  }
}

// 壓縮圖片並轉成 base64（不含 data: 前綴）
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]); // 去掉 "data:image/jpeg;base64,"
    };
    img.onerror = reject;
    img.src = url;
  });
}

function showResults(data) {
  loading.style.display = 'none';
  results.style.display = 'flex';

  const p = data.product;

  document.getElementById('productName').textContent = p.productName || '未知物品';
  document.getElementById('brand').textContent = `品牌：${p.brand || '未知'}`;
  document.getElementById('model').textContent = `型號：${p.model || '未知'}`;
  document.getElementById('year').textContent = `年份：${p.estimatedYear || '未知'}`;
  document.getElementById('description').textContent = p.description || '';

  // 全新價格
  const np = p.newPrice;
  if (np && np.min != null) {
    document.getElementById('newPrice').textContent = `$${np.min} – $${np.max} ${np.currency}`;
    document.getElementById('newPriceNote').textContent = np.note || '';
  }

  // 二手價格
  const up = p.usedPrice;
  if (up && up.min != null) {
    document.getElementById('usedPrice').textContent = `$${up.min} – $${up.max} ${up.currency}`;
    document.getElementById('usedPriceNote').textContent = up.note || '';
  }

  // 信心度
  const conf = (p.confidence || '').toLowerCase();
  const confEl = document.getElementById('confidence');
  confEl.textContent = { high: '高', medium: '中', low: '低' }[conf] || conf;
  confEl.className = `confidence-badge confidence-${conf}`;

  // 購買連結
  showBuyLinks(p.searchKeywords || p.productName);

  // eBay 資料
  if (data.ebay) {
    showEbay(data.ebay);
  }
}

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
  const soldEl = document.getElementById('soldListings');

  activeEl.innerHTML = renderEbayItems(ebay.active);
  soldEl.innerHTML = renderEbayItems(ebay.sold);

  if (ebay.active.length > 0 || ebay.sold.length > 0) {
    section.style.display = 'block';
  }

  // Tab 切換
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
  if (!items || items.length === 0) return '<p style="color:#888;font-size:0.88rem">暫無資料</p>';
  return items.map(item => `
    <div class="ebay-item">
      <span class="ebay-title">${escapeHtml(item.title)}</span>
      <span class="ebay-price">$${item.price.toFixed(2)}</span>
      <a class="ebay-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">查看</a>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
