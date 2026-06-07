/**
 * 报价单 - 数据存储（localStorage）
 */

// ====== 公司名称修正 ======
function getCompanyCorrections() {
  try { return JSON.parse(localStorage.getItem(COMPANY_CORRECTIONS_KEY) || '{}'); }
  catch { return {}; }
}

function saveCompanyCorrection(wrongName, correctName) {
  if (!wrongName || !correctName || wrongName === correctName) return;
  const corrections = getCompanyCorrections();
  corrections[wrongName] = correctName;
  localStorage.setItem(COMPANY_CORRECTIONS_KEY, JSON.stringify(corrections));
}

function correctCompanyName(name) {
  if (!name) return name;
  const corrections = getCompanyCorrections();
  return corrections[name] || name;
}

// ====== Providers ======
function getProviders() {
  try {
    return JSON.parse(localStorage.getItem(PROVIDERS_KEY) || '[]');
  } catch { return []; }
}

function saveProviders(list) {
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(list));
}

function getActiveProviderId() {
  return localStorage.getItem(ACTIVE_PROVIDER_KEY) || '';
}

function setActiveProvider(id) {
  localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
}

function getActiveProvider() {
  const id = getActiveProviderId();
  const providers = getProviders();
  return providers.find(function(p) { return p.id === id; }) || null;
}

// ====== Dual Config ======
function getDualConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem(DUAL_KEY) || '{"enabled":true,"count":2,"models":[]}');
    if (cfg.models.length > 0 && typeof cfg.models[0] === 'string') {
      const providers = getProviders();
      cfg.models = cfg.models.map(function(id) {
        const p = providers.find(function(x) { return x.id === id; });
        return {
          providerId: id,
          model: p ? (p.selectedModel || (p.models && p.models[0]) || '') : ''
        };
      });
      saveDualConfig(cfg);
    }
    return cfg;
  } catch {
    return { enabled: true, count: 2, models: [] };
  }
}

function saveDualConfig(cfg) {
  localStorage.setItem(DUAL_KEY, JSON.stringify(cfg));
  updateDualBadge();
}

// ====== Records ======
function getRecords() {
  try {
    return JSON.parse(localStorage.getItem('chefeibao_records') || '[]');
  } catch {
    return [];
  }
}

function saveRecord(record) {
  const records = getRecords();
  const existIdx = records.findIndex(function(r) {
    return r.plate === record.plate && r.company === record.company;
  });
  if (existIdx >= 0) {
    records[existIdx] = record;
  } else {
    records.unshift(record);
  }
  localStorage.setItem('chefeibao_records', JSON.stringify(records));
}

function deleteRecord(id) {
  showConfirm('确定要删除这条记录吗？', function() {
    const records = getRecords();
    const record = records.find(function(r) { return r.id === id; });
    if (record && record.localImage) {
      deleteLocalImage(record.localImage);
    }
    const newRecords = records.filter(function(r) { return r.id !== id; });
    localStorage.setItem('chefeibao_records', JSON.stringify(newRecords));
    renderRecords();
    showToast('已删除');
  });
}

// ====== Font Size ======
function getFontSize() {
  return parseInt(localStorage.getItem(FONT_SIZE_KEY) || '100');
}

function applyFontSize(size) {
  document.documentElement.style.setProperty('--font-scale', size / 100);
  var fontSizeValue = document.getElementById('fontSizeValue');
  if (fontSizeValue) fontSizeValue.textContent = size + '%';
}
