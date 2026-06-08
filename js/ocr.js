/**
 * 报价单 - OCR 识别与图片处理
 */

// ====== OCR 调用 ======
async function callOpenAICompatible(provider, model, dataUrl) {
  var url = provider.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + provider.apiKey,
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    var errBody = await resp.text().catch(function() { return ''; });
    throw new Error('API 返回 ' + resp.status + ': ' + errBody.slice(0, 100));
  }

  var json = await resp.json();
  var content = json.choices?.[0]?.message?.content || '';
  return parseOCRJson(content);
}

async function callOCRInterface(provider, model, base64, mimeType) {
  var url = provider.baseUrl;
  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + provider.apiKey,
    },
    body: JSON.stringify({
      model: model,
      image: 'data:' + mimeType + ';base64,' + base64,
      prompt: OCR_PROMPT,
    }),
  });

  if (!resp.ok) {
    var errBody = await resp.text().catch(function() { return ''; });
    throw new Error('OCR API 返回 ' + resp.status + ': ' + errBody.slice(0, 100));
  }

  var json = await resp.json();
  var content = json.result || json.text || json.choices?.[0]?.message?.content || JSON.stringify(json);
  return parseOCRJson(content);
}

function callProviderAPI(provider, modelName, dataUrl, base64, mimeType) {
  if (provider.protocol === 'openai') {
    return callOpenAICompatible(provider, modelName, dataUrl);
  } else if (provider.protocol === 'ocr') {
    return callOCRInterface(provider, modelName, base64, mimeType || 'image/jpeg');
  } else {
    return callOpenAICompatible(provider, modelName, dataUrl);
  }
}

async function tryWithFailover(provider, file, base64, dataUrl) {
  var model = provider.selectedModel || provider.models[0] || '';
  return {
    providerName: provider.name,
    modelName: model,
    data: await callProviderAPI(provider, model, dataUrl, base64, file.type),
  };
}

// ====== OCR 识别入口（含多模型并行） ======
async function recognizeImage(file, provider) {
  try {
    var base64 = await fileToBase64(file);
    var dataUrl = 'data:' + (file.type || 'image/jpeg') + ';base64,' + base64;

    var dualCfg = getDualConfig();
    var allProviders = getProviders().filter(function(p) { return p.models && p.models.length > 0; });

    if (!dualCfg.enabled || dualCfg.models.length <= 1) {
      var result = await tryWithFailover(provider, file, base64, dataUrl);
      document.getElementById('imgPreviewStatus').textContent = result.providerName + ' · ' + result.modelName + ' — 识别完成';
      document.getElementById('imgPreviewStatus').className = 'img-preview-status';
      applyOCRResult(result.data);
      showToast('识别完成，已自动填入数据');
      return;
    }

    var providers = getProviders();
    var modelsToUse = dualCfg.models
      .map(function(item) {
        var p = providers.find(function(x) { return x.id === item.providerId; });
        return p ? { provider: p, model: item.model } : null;
      })
      .filter(Boolean);

    if (modelsToUse.length <= 1) {
      var p2 = modelsToUse[0]?.provider || provider;
      var result2 = await tryWithFailover(p2, file, base64, dataUrl);
      document.getElementById('imgPreviewStatus').textContent = '识别完成';
      document.getElementById('imgPreviewStatus').className = 'img-preview-status';
      applyOCRResult(result2.data);
      showToast('识别完成，已自动填入数据');
      return;
    }

    var maxCount = dualCfg.count || 2;
    if (modelsToUse.length > maxCount) {
      modelsToUse = modelsToUse.slice(0, maxCount);
    }

    if (modelsToUse.length <= 1) {
      var p3 = modelsToUse[0]?.provider || provider;
      var result3 = await tryWithFailover(p3, file, base64, dataUrl);
      document.getElementById('imgPreviewStatus').textContent = '识别完成';
      document.getElementById('imgPreviewStatus').className = 'img-preview-status';
      applyOCRResult(result3.data);
      showToast('识别完成，已自动填入数据');
      return;
    }

    var total = modelsToUse.length;
    var completed = 0;
    document.getElementById('imgPreviewStatus').textContent = '正在识别 (0/' + total + ')...';
    document.getElementById('imgPreviewStatus').className = 'img-preview-status loading';

    var results = await Promise.allSettled(
      modelsToUse.map(async function(item) {
        var originalModel = item.provider.selectedModel;
        item.provider.selectedModel = item.model;
        var r = await tryWithFailover(item.provider, file, base64, dataUrl);
        item.provider.selectedModel = originalModel;
        completed++;
        document.getElementById('imgPreviewStatus').textContent = '正在识别 (' + completed + '/' + total + ')...';
        return r;
      })
    );

    var succeeded = results
      .filter(function(r) { return r.status === 'fulfilled'; })
      .map(function(r) { return r.value; });

    if (succeeded.length === 0) {
      throw new Error('所有模型识别失败');
    }

    if (succeeded.length === 1) {
      var r4 = succeeded[0];
      document.getElementById('imgPreviewStatus').textContent = '识别完成';
      document.getElementById('imgPreviewStatus').className = 'img-preview-status';
      applyOCRResult(r4.data);
      showToast('识别完成，已自动填入数据');
      return;
    }

    var merged = succeeded[0].data;
    var allConflicts = [];
    for (var i2 = 1; i2 < succeeded.length; i2++) {
      var mergeResult = mergeOCRResults(merged, succeeded[i2].data);
      merged = mergeResult.data;
      allConflicts = Array.from(new Set(allConflicts.concat(mergeResult.conflictFields)));
    }

    if (allConflicts.length > 0) {
      var chosen = await showConflictDialog(allConflicts, succeeded);
      if (chosen) {
        merged = chosen;
      } else {
        allConflicts.forEach(function(f) {
          if (f.includes('Amount') || f.includes('Rate') || f === 'vehicleTax') {
            merged[f] = 0;
          } else {
            merged[f] = '';
          }
        });
      }
    }

    document.getElementById('imgPreviewStatus').textContent = '多重识别完成';
    document.getElementById('imgPreviewStatus').className = 'img-preview-status';
    applyOCRResult(merged);
    showToast(allConflicts.length > 0 ? '已选择您确认的数据' : '多重识别一致，已自动填入数据');
  } catch (err) {
    console.error('OCR error:', err);
    document.getElementById('imgPreviewStatus').textContent = '识别失败：' + (err.message || '未知错误');
    document.getElementById('imgPreviewStatus').className = 'img-preview-status error';
    showToast('识别失败，请检查配置后重试');
  }
}

// ====== 合并两个模型结果 ======
function mergeOCRResults(dataA, dataB) {
  var fields = [
    'company', 'plate',
    'compulsoryAmount', 'compulsoryExpiry',
    'commercialAmount', 'commercialExpiry',
    'nonVehicleAmount', 'nonVehicleExpiry',
    'vehicleTax',
  ];

  var merged = {};
  var conflictFields = [];

  fields.forEach(function(f) {
    var valA = dataA[f];
    var valB = dataB[f];

    if (valA === valB) {
      merged[f] = valA;
    } else if (valA === 0 || valA === '') {
      merged[f] = valB;
    } else if (valB === 0 || valB === '') {
      merged[f] = valA;
    } else {
      if (typeof valA === 'number') {
        merged[f] = Math.max(valA, valB);
      } else {
        merged[f] = valA;
      }
      conflictFields.push(f);
    }
  });

  return { data: merged, conflictCount: conflictFields.length, conflictFields: conflictFields };
}

// ====== 冲突选择弹窗 ======
function showConflictDialog(conflictFields, succeeded) {
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.zIndex = '1100';

    var dialog = document.createElement('div');
    dialog.className = 'conflict-dialog';

    var providerNames = succeeded.map(function(r) { return r.providerName; });

    var html = '<div style="flex-shrink:0;text-align:left;font-size:0.85rem;">';
    html += '<div style="font-weight:600;margin-bottom:10px;color:#E74C3C;">⚠️ 以下字段两个模型识别结果不一致</div>';
    html += '<div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px;">请点击您认为正确的值</div>';
    html += '</div>';

    html += '<div class="conflict-dialog-scroll">';

    conflictFields.forEach(function(f, idx) {
      var label = FIELD_LABELS[f] || f;
      var values = succeeded.map(function(r) { return r.data[f]; });

      html += '<div style="background:var(--primary-light);border-radius:10px;padding:10px 12px;margin-bottom:8px;">';
      html += '<div style="font-weight:600;color:#E74C3C;margin-bottom:6px;font-size:0.8rem;">' + label + '</div>';

      values.forEach(function(val, vi) {
        var displayVal = (val === 0 || val === '') ? '未识别到' : val;
        html += '<div class="conflict-option" data-field="' + f + '" data-value="' + val + '" data-idx="' + idx + '">';
        html += '<span style="color:var(--text-secondary);font-size:0.75rem;">' + providerNames[vi] + '</span>';
        html += '<span style="font-weight:600;color:var(--text);">' + displayVal + '</span>';
        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>';

    html += '<div class="conflict-dialog-footer">';
    var hasImg = document.getElementById('imgPreview').src && document.getElementById('imgPreviewWrap').style.display !== 'none';
    if (hasImg) {
      html += '<div id="conflictViewImg" class="conflict-view-img-btn" style="margin:0 0 10px;">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="9.5" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M2 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      html += '查看图片';
      html += '</div>';
    }
    html += '<div style="display:flex;gap:10px;">';
    html += '<button class="confirm-btn confirm-cancel" id="conflictCancelAll" style="flex:1;">全部跳过</button>';
    html += '<button class="confirm-btn confirm-ok" id="conflictConfirm" style="flex:1;">确认选择</button>';
    html += '</div>';
    html += '</div>';

    dialog.innerHTML = html;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var choices = {};
    conflictFields.forEach(function(f) {
      choices[f] = 0;
    });

    overlay.querySelectorAll('.conflict-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        var f = opt.dataset.field;
        var v = opt.dataset.value;
        choices[f] = v;
        overlay.querySelectorAll('.conflict-option[data-field="' + f + '"]').forEach(function(o) {
          o.classList.remove('selected');
        });
        opt.classList.add('selected');
      });
    });

    conflictFields.forEach(function(f) {
      var first = overlay.querySelector('.conflict-option[data-field="' + f + '"]');
      if (first) {
        first.classList.add('selected');
      }
    });

    var conflictViewImg = overlay.querySelector('#conflictViewImg');
    if (conflictViewImg) {
      conflictViewImg.addEventListener('click', function() {
        updateBaseSize();
        resetViewer();
        imgViewerImg.src = document.getElementById('imgPreview').src;
        imgViewerOverlay.style.display = 'block';
      });
    }

    overlay.querySelector('#conflictCancelAll').addEventListener('click', function() {
      document.body.removeChild(overlay);
      resolve(null);
    });

    overlay.querySelector('#conflictConfirm').addEventListener('click', function() {
      document.body.removeChild(overlay);
      var finalData = JSON.parse(JSON.stringify(succeeded[0].data));
      conflictFields.forEach(function(f) {
        var chosenValue = choices[f];
        succeeded.forEach(function(r) {
          if (String(r.data[f]) === String(chosenValue)) {
            finalData[f] = r.data[f];
          }
        });
      });
      resolve(finalData);
    });
  });
}

// ====== 结果填入表单 ======
function applyOCRResult(data) {
  document.getElementById('resultSection').style.display = 'none';
  var correctedCompany = correctCompanyName(data.company);
  document.getElementById('insuranceCompany').value = correctedCompany || '';
  window.lastCompanyValue = correctedCompany;
  document.getElementById('plateNumber').value = data.plate || '';
  if (data.compulsoryAmount != null) document.getElementById('compulsoryAmount').value = data.compulsoryAmount;
  if (data.compulsoryRate != null) document.getElementById('compulsoryRate').value = data.compulsoryRate;
  ocrExpiry.compulsory = data.compulsoryExpiry || '';
  parseExpiryToInputs(data.compulsoryExpiry,
    document.getElementById('compulsoryExpiryYear'),
    document.getElementById('compulsoryExpiryMonth'),
    document.getElementById('compulsoryExpiryDay'));
  if (data.commercialAmount != null) document.getElementById('commercialAmount').value = data.commercialAmount;
  if (data.commercialRate != null) document.getElementById('commercialRate').value = data.commercialRate;
  ocrExpiry.commercial = data.commercialExpiry || '';
  parseExpiryToInputs(data.commercialExpiry,
    document.getElementById('commercialExpiryYear'),
    document.getElementById('commercialExpiryMonth'),
    document.getElementById('commercialExpiryDay'));
  if (data.nonVehicleAmount != null) document.getElementById('nonVehicleAmount').value = data.nonVehicleAmount;
  if (data.nonVehicleRate != null) document.getElementById('nonVehicleRate').value = data.nonVehicleRate;
  ocrExpiry.nonVehicle = data.nonVehicleExpiry || '';
  if (data.vehicleTax != null) document.getElementById('vehicleTax').value = data.vehicleTax;
}

// ====== 图片查看器（触摸手势支持） ======
var scale = 1, cx = 0, cy = 0;
var baseW = 0, baseH = 0;
var MIN_SCALE = 1, MAX_SCALE = 5;
var lastTapTime = 0;
var movedSinceTouch = false;

var t0 = null, t1 = null;
var pinchStartDist = 0, pinchStartScale = 1;
var pinchStartCX = 0, pinchStartCY = 0;
var pinchMidStartX = 0, pinchMidStartY = 0;
var panStartX = 0, panStartY = 0;
var velHistory = [];
var flingRAF = null;

var imgViewerImg = document.getElementById('imgViewerImg');
var imgViewerOverlay = document.getElementById('imgViewerOverlay');

function vw() { return window.innerWidth; }
function vh() { return window.innerHeight; }

function updateBaseSize() {
  var natW = imgViewerImg.naturalWidth || 1;
  var natH = imgViewerImg.naturalHeight || 1;
  var ratio = natW / natH;
  if (ratio > vw() / vh()) {
    baseW = vw();
    baseH = vw() / ratio;
  } else {
    baseH = vh();
    baseW = vh() * ratio;
  }
}

function getScaledSize() {
  return { w: baseW * scale, h: baseH * scale };
}

function clampCenter() {
  if (scale <= 1) { cx = 0; cy = 0; return; }
  var s = getScaledSize();
  var maxX = Math.max(0, (s.w - vw()) / 2);
  var maxY = Math.max(0, (s.h - vh()) / 2);
  cx = Math.min(Math.max(cx, -maxX), maxX);
  cy = Math.min(Math.max(cy, -maxY), maxY);
}

function applyTransform(animate) {
  clampCenter();
  if (animate) {
    imgViewerImg.classList.add('animating');
    setTimeout(function() { imgViewerImg.classList.remove('animating'); }, 320);
  } else {
    imgViewerImg.classList.remove('animating');
  }
  imgViewerImg.style.transform = 'translate(' + cx + 'px, ' + cy + 'px) scale(' + scale + ')';
}

function resetViewer() {
  scale = 1; cx = 0; cy = 0;
  cancelFling();
  applyTransform(false);
}

function startFling(vx, vy) {
  cancelFling();
  var curVX = vx, curVY = vy;

  function step() {
    cx += curVX;
    cy += curVY;
    curVX *= 0.95;
    curVY *= 0.95;

    var s = getScaledSize();
    var maxX = Math.max(0, (s.w - vw()) / 2);
    var maxY = Math.max(0, (s.h - vh()) / 2);
    var bounced = false;
    if (cx > maxX) { cx = maxX; curVX = 0; bounced = true; }
    if (cx < -maxX) { cx = -maxX; curVX = 0; bounced = true; }
    if (cy > maxY) { cy = maxY; curVY = 0; bounced = true; }
    if (cy < -maxY) { cy = -maxY; curVY = 0; bounced = true; }

    imgViewerImg.style.transform = 'translate(' + cx + 'px, ' + cy + 'px) scale(' + scale + ')';
    if (Math.abs(curVX) < 0.3 && Math.abs(curVY) < 0.3) {
      if (bounced) applyTransform(true);
      return;
    }
    flingRAF = requestAnimationFrame(step);
  }
  flingRAF = requestAnimationFrame(step);
}

function cancelFling() {
  if (flingRAF) { cancelAnimationFrame(flingRAF); flingRAF = null; }
}

function dist(a, b) {
  return Math.sqrt(Math.pow(b.clientX - a.clientX, 2) + Math.pow(b.clientY - a.clientY, 2));
}
function mid(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

// ====== 图片上传 ======
function handleFileSelect(file) {
  if (!file) return;

  if (!ACCEPTED_TYPES.includes(file.type)) {
    showToast('请选择 JPG / PNG / WebP 格式的图片');
    return;
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    showToast('图片大小不能超过 ' + MAX_SIZE_MB + 'MB');
    return;
  }

  showImagePreview(file);
  setTimeout(function() {
    document.getElementById('quickRate').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function() { document.getElementById('quickRate').focus(); }, 300);
  }, 200);
}

function showImagePreview(file) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    document.getElementById('imgPreview').src = ev.target.result;
    document.getElementById('imgPreviewWrap').style.display = 'block';
    var provider = getActiveProvider();
    var statusText = provider
      ? '使用 ' + provider.name + ' · ' + (provider.selectedModel || provider.models[0] || '默认模型') + ' 识别中...'
      : '未配置识别模型，请先在设置中添加';
    document.getElementById('imgPreviewStatus').textContent = statusText;
    document.getElementById('imgPreviewStatus').className = provider ? 'img-preview-status loading' : 'img-preview-status error';

    setTimeout(function() {
      var scrollEl = document.querySelector('.tab-content.active .scroll-area');
      if (scrollEl) {
        var rateEl = document.getElementById('quickRate');
        if (rateEl) {
          scrollEl.scrollTop = rateEl.offsetTop - scrollEl.offsetTop - 20;
        }
      }
      setTimeout(function() {
        var rateEl2 = document.getElementById('quickRate');
        if (rateEl2) rateEl2.focus();
      }, 300);
    }, 500);

    if (!provider) return;
    window.trackCompanyBeforeOCR();
    recognizeImage(file, provider);
  };
  reader.onerror = function() {
    showToast('图片读取失败，请重试');
  };
  reader.readAsDataURL(file);
}
