/**
 * 报价单 - 工具函数
 */

// ====== 配置常量 ======
const COMPANY_CORRECTIONS_KEY = 'chefeibao_company_corrections';
const PROVIDERS_KEY = 'chefeibao_providers';
const ACTIVE_PROVIDER_KEY = 'chefeibao_active_provider';
const DUAL_KEY = 'chefeibao_dual';
const FONT_SIZE_KEY = 'chefeibao_font_size';

const PROVIDER_PRESETS = {
  xiaomi: { name: '小米', baseUrl: 'https://api.xiaomimimo.com/v1', protocol: 'openai' },
  qwen: { name: '千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai' },
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/heic'];
const MAX_SIZE_MB = 10;

const FIELD_LABELS = {
  company: '保险公司',
  plate: '车牌号',
  compulsoryAmount: '交强险保费',
  compulsoryExpiry: '交强险到期',
  commercialAmount: '商业险保费',
  commercialExpiry: '商业险到期',
  nonVehicleAmount: '随车非车保费',
  nonVehicleExpiry: '随车非车到期',
  vehicleTax: '车船税',
};

const OCR_PROMPT = `识别图片中的车险报价信息，返回JSON：
{"company":"保险公司","plate":"车牌号","compulsoryAmount":数字,"compulsoryExpiry":"2025年3月15日","commercialAmount":数字,"commercialExpiry":"2025年3月15日","nonVehicleAmount":数字,"nonVehicleExpiry":"2025年3月15日","vehicleTax":数字}
规则：
- 只识别保费金额，不识别手续费比例
- 随车非车保费=除交强险商业险外所有其他险种保费总和
- 到期时间必须含年月日，格式XXXX年X月X日
- 未找到的字段填0或空字符串
- 只返回JSON`;

// ====== 数值工具 ======
function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

function formatMoney(n) {
  return '¥' + n.toFixed(2);
}

// ====== 费率解析 ======
function parseTripleInput(str) {
  if (!str) return null;
  const parts = str.split(/[\/\-\,]+/).map(function(s) { return parseFloat(s.trim()); });
  if (parts.length === 3 && parts.every(function(n) { return !isNaN(n); })) {
    return parts;
  }
  return null;
}

function parseDoubleInput(str) {
  if (!str) return null;
  const parts = str.split(/[\/\-\,]+/).map(function(s) { return parseFloat(s.trim()); });
  if (parts.length === 2 && parts.every(function(n) { return !isNaN(n); })) {
    return parts;
  }
  return null;
}

function addValue(existing, add) {
  const base = parseFloat(existing) || 0;
  return (base + add).toFixed(2);
}

function parseQuickRate(str) {
  const parts = str.split(/[\/\-\,\s]+/).filter(function(s) { return s.trim() !== ''; });
  return parts.map(function(s) { return parseFloat(s) || 0; });
}

// ====== 字符串工具 ======
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatExpiryDisplay(expiryStr) {
  if (!expiryStr) return '';
  return expiryStr.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/, '$1年 $2月 $3日')
    .replace(/(\d{1,2})月(\d{1,2})日/, '$1月 $2日');
}

function formatRecordTime(timeStr) {
  if (!timeStr) return '';
  if (!timeStr.includes(':') && !timeStr.includes('时')) return timeStr;
  try {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
  } catch (e) {}
  return timeStr.split(/\s+/)[0] || timeStr;
}

// ====== 到期时间工具 ======
function buildExpiryStr(yearEl, monthEl, dayEl) {
  const y = yearEl.value.trim();
  const m = monthEl.value.trim();
  const d = dayEl.value.trim();
  if (!m && !d) return '';
  var str = '';
  if (y) str += y + '年';
  if (m) str += m + '月';
  if (d) str += d + '日';
  return str;
}

function parseExpiryToInputs(expiryStr, yearEl, monthEl, dayEl) {
  if (!expiryStr) return;
  const yearMatch = expiryStr.match(/(\d{4})\s*年/);
  const monthMatch = expiryStr.match(/(\d{1,2})\s*月/);
  const dayMatch = expiryStr.match(/(\d{1,2})\s*日/);
  if (yearMatch) yearEl.value = yearMatch[1];
  if (monthMatch) monthEl.value = monthMatch[1];
  if (dayMatch) dayEl.value = dayMatch[1];
}

// ====== 数据比较 ======
function isSameData(a, b) {
  return a.company === b.company &&
    a.plate === b.plate &&
    a.compulsoryAmount === b.compulsoryAmount &&
    a.compulsoryRate === b.compulsoryRate &&
    a.commercialAmount === b.commercialAmount &&
    a.commercialRate === b.commercialRate &&
    a.nonVehicleAmount === b.nonVehicleAmount &&
    a.nonVehicleRate === b.nonVehicleRate &&
    a.vehicleTax === b.vehicleTax;
}

// ====== 剪贴板 ======
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function() {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* noop */ }
  document.body.removeChild(ta);
}

// ====== 文案生成 ======
function formatPlanText(data, results) {
  const lines = [];
  if (data.company) lines.push('保险公司：' + data.company);
  if (data.plate) lines.push('车牌号：' + data.plate);

  var premium = 0;
  if (data.compulsoryAmount > 0) {
    premium += data.compulsoryAmount;
    lines.push('交强险保费：' + data.compulsoryAmount + '元，到期时间：' + (data.compulsoryExpiry || '未知'));
  }
  if (data.commercialAmount > 0) {
    premium += data.commercialAmount;
    lines.push('商业险保费：' + data.commercialAmount + '元，到期时间：' + (data.commercialExpiry || '未知'));
  }
  if (data.nonVehicleAmount > 0) {
    premium += data.nonVehicleAmount;
    lines.push('随车非车保费：' + data.nonVehicleAmount + '元');
  }
  if (data.vehicleTax > 0) {
    premium += data.vehicleTax;
    lines.push('车船税：' + data.vehicleTax + '元');
  }

  premium = round2(premium);
  if (premium > 0) lines.push('保费合计：' + premium + '元');
  if (results.afterTax > 0) {
    if (results.allRatesZero) {
      lines.push('实付为：' + premium.toFixed(2) + '元');
    } else {
      lines.push('费用：' + results.afterTax.toFixed(2) + '元');
      lines.push('实付为：' + (premium - results.afterTax).toFixed(2) + '元');
    }
  }
  return lines.join('\n');
}

// ====== Toast 提示 ======
let toastTimer = null;
function showToast(msg) {
  var toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, 2000);
}

// ====== 图片处理 ======
function fileToBase64(file) {
  return new Promise(function(resolve, reject) {
    if (file.size < 500 * 1024) {
      const reader = new FileReader();
      reader.onload = function() {
        const base64 = reader.result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = function() {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_SIZE = 1600;
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          if (w > h) {
            h = Math.round(h * MAX_SIZE / w);
            w = MAX_SIZE;
          } else {
            w = Math.round(w * MAX_SIZE / h);
            h = MAX_SIZE;
          }
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = compressed.split(',')[1] || '';
        resolve(base64);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise(function(resolve, reject) {
    const img = new Image();
    img.onload = function() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round(h * maxSize / w);
            w = maxSize;
          } else {
            w = Math.round(w * maxSize / h);
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        const base64 = compressed.split(',')[1] || '';
        if (!base64) {
          reject(new Error('图片压缩后数据为空'));
          return;
        }
        resolve(base64);
      } catch (e) {
        reject(new Error('图片压缩失败: ' + (e.message || e)));
      }
    };
    img.onerror = function() {
      reject(new Error('图片加载失败'));
    };
    img.src = dataUrl;
  });
}

function saveImageToLocal(dataUrl, recordId) {
  try {
    return compressImage(dataUrl, 1600, 0.8).then(function(compressedBase64) {
      if (!compressedBase64) return null;
      return 'data:image/jpeg;base64,' + compressedBase64;
    });
  } catch (e) {
    console.warn('[保存] 图片保存失败:', e);
    return Promise.resolve(null);
  }
}

function deleteLocalImage(filePath) {
  if (!filePath) return Promise.resolve();
  try {
    const { Filesystem } = window.Capacitor?.Plugins || {};
    if (!Filesystem) return Promise.resolve();
    return Filesystem.deleteFile({ path: filePath, directory: 'DATA' });
  } catch (e) {
    console.warn('删除本地图片失败:', e);
    return Promise.resolve();
  }
}

function readLocalImage(filePath) {
  if (!filePath) return Promise.resolve(null);
  try {
    const { Filesystem } = window.Capacitor?.Plugins || {};
    if (!Filesystem) {
      console.warn('[读取] Filesystem 不可用');
      return Promise.resolve(null);
    }
    console.log('[读取] 读取文件: ' + filePath);
    return Filesystem.readFile({ path: filePath, directory: 'DATA', encoding: 'base64' }).then(function(result) {
      console.log('[读取] 读取成功, data长度=' + (result.data ? result.data.length : 0));
      return 'data:image/jpeg;base64,' + result.data;
    });
  } catch (e) {
    console.warn('[读取] 读取本地图片失败:', e.message || e);
    return Promise.resolve(null);
  }
}

// ====== OCR JSON 解析 ======
function parseOCRJson(text) {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  var raw = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      company: parsed.company || '',
      plate: parsed.plate || '',
      compulsoryAmount: num(parsed.compulsoryAmount),
      compulsoryExpiry: parsed.compulsoryExpiry || '',
      commercialAmount: num(parsed.commercialAmount),
      commercialExpiry: parsed.commercialExpiry || '',
      nonVehicleAmount: num(parsed.nonVehicleAmount),
      nonVehicleExpiry: parsed.nonVehicleExpiry || '',
      vehicleTax: num(parsed.vehicleTax),
    };
  } catch (e) {
    console.warn('JSON parse failed, trying field extraction:', e.message);
    const extract = function(key) {
      const m = raw.match(new RegExp('"' + key + '"\\s*:\\s*("?[^",}\\]]*"?|\\d+\\.?\\d*)'));
      return m ? m[1].replace(/"/g, '').trim() : '';
    };
    return {
      company: extract('company'),
      plate: extract('plate'),
      compulsoryAmount: num(extract('compulsoryAmount')),
      compulsoryExpiry: extract('compulsoryExpiry'),
      commercialAmount: num(extract('commercialAmount')),
      commercialExpiry: extract('commercialExpiry'),
      nonVehicleAmount: num(extract('nonVehicleAmount')),
      nonVehicleExpiry: extract('nonVehicleExpiry'),
      vehicleTax: num(extract('vehicleTax')),
    };
  }
}
