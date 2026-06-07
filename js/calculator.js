/**
 * 报价单 - 计算逻辑
 */

// ====== 获取表单数据 ======
function getFormData() {
  return {
    company: document.getElementById('insuranceCompany').value.trim(),
    plate: document.getElementById('plateNumber').value.trim(),
    compulsoryAmount: parseFloat(document.getElementById('compulsoryAmount').value) || 0,
    compulsoryRate: parseFloat(document.getElementById('compulsoryRate').value) || 0,
    compulsoryExpiry: buildExpiryStr(
      document.getElementById('compulsoryExpiryYear'),
      document.getElementById('compulsoryExpiryMonth'),
      document.getElementById('compulsoryExpiryDay')
    ),
    commercialAmount: parseFloat(document.getElementById('commercialAmount').value) || 0,
    commercialRate: parseFloat(document.getElementById('commercialRate').value) || 0,
    commercialExpiry: buildExpiryStr(
      document.getElementById('commercialExpiryYear'),
      document.getElementById('commercialExpiryMonth'),
      document.getElementById('commercialExpiryDay')
    ),
    nonVehicleAmount: parseFloat(document.getElementById('nonVehicleAmount').value) || 0,
    nonVehicleRate: parseFloat(document.getElementById('nonVehicleRate').value) || 0,
    nonVehicleExpiry: (window.ocrExpiry || {}).nonVehicle,
    vehicleTax: parseFloat(document.getElementById('vehicleTax').value) || 0,
  };
}

// ====== 计算核心 ======
function calculate(data) {
  const allRatesZero = data.compulsoryRate === 0 && data.commercialRate === 0 && data.nonVehicleRate === 0;

  var compulsoryFee, commercialFee, nonVehicleFee, total, afterTax;
  const premiumTotal = round2(data.compulsoryAmount + data.commercialAmount + data.nonVehicleAmount + data.vehicleTax);

  if (allRatesZero) {
    compulsoryFee = round2(data.compulsoryAmount);
    commercialFee = round2(data.commercialAmount);
    nonVehicleFee = round2(data.nonVehicleAmount);
    total = premiumTotal;
    afterTax = premiumTotal;
  } else {
    compulsoryFee = round2(data.compulsoryAmount / 1.06 * data.compulsoryRate / 100);
    commercialFee = round2(data.commercialAmount / 1.06 * data.commercialRate / 100);
    nonVehicleFee = round2(data.nonVehicleAmount / 1.06 * data.nonVehicleRate / 100);
    total = round2(compulsoryFee + commercialFee + nonVehicleFee);
    afterTax = total;
  }

  return {
    compulsoryFee: round2(compulsoryFee),
    commercialFee: round2(commercialFee),
    nonVehicleFee: round2(nonVehicleFee),
    total: round2(total),
    afterTax: round2(afterTax),
    allRatesZero: allRatesZero,
    premiumTotal: premiumTotal,
  };
}

// ====== 显示结果 ======
function displayResults(results) {
  if (results.allRatesZero) {
    document.getElementById('labelCompulsory').textContent = '交强险保费';
    document.getElementById('labelCommercial').textContent = '商业险保费';
    document.getElementById('labelNonVehicle').textContent = '随车非车保费';
    document.getElementById('labelAfterTax').textContent = '保费合计';
    document.getElementById('resultCompulsory').textContent = '¥ ' + results.compulsoryFee.toFixed(2);
    document.getElementById('resultCommercial').textContent = '¥ ' + results.commercialFee.toFixed(2);
    document.getElementById('resultNonVehicle').textContent = '¥ ' + results.nonVehicleFee.toFixed(2);
    document.getElementById('resultAfterTax').textContent = '¥ ' + results.afterTax.toFixed(2);
  } else {
    document.getElementById('labelCompulsory').textContent = '交强险手续费';
    document.getElementById('labelCommercial').textContent = '商业险手续费';
    document.getElementById('labelNonVehicle').textContent = '随车非车保费手续费';
    document.getElementById('labelAfterTax').textContent = '税后手续费';
    document.getElementById('resultCompulsory').textContent = '¥ ' + results.compulsoryFee.toFixed(2);
    document.getElementById('resultCommercial').textContent = '¥ ' + results.commercialFee.toFixed(2);
    document.getElementById('resultNonVehicle').textContent = '¥ ' + results.nonVehicleFee.toFixed(2);
    document.getElementById('resultAfterTax').textContent = '¥ ' + results.afterTax.toFixed(2);
  }
}

// ====== 费率同步 ======
function syncRatesToQuick() {
  const c = document.getElementById('compulsoryRate').value || '0';
  const m = document.getElementById('commercialRate').value || '0';
  const n = document.getElementById('nonVehicleRate').value || '0';
  document.getElementById('quickRate').value = c + '/' + m + '/' + n;
}

// ====== 执行计算与结果处理 ======
var lastCalculatedData = null;

function doCalculate(data) {
  lastCalculatedData = cloneObj(data);
  const results = calculate(data);
  displayResults(results);
  document.getElementById('resultSection').style.display = 'block';
  const text = formatPlanText(data, results);
  copyToClipboard(text);
  showToast('已计算并复制文案');
  setTimeout(function() {
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function cloneObj(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ====== 确认数据弹窗 ======
function showConfirmDialog(data) {
  var html = '<div class="confirm-dialog-content">';
  html += '<div class="confirm-dialog-title">请核对以下数据：</div>';

  html += '<div class="confirm-card confirm-card-info">';
  html += '<div class="confirm-row"><span class="confirm-label">保险公司</span><span class="confirm-value">' + (data.company || '未填写') + '</span></div>';
  html += '<div class="confirm-row"><span class="confirm-label">车牌号</span><span class="confirm-value">' + (data.plate || '未填写') + '</span></div>';
  html += '</div>';

  if (data.compulsoryAmount > 0) {
    html += '<div class="confirm-card confirm-card-compulsory">';
    html += '<div class="confirm-card-title" style="color:#E8734A;">交强险</div>';
    html += '<div class="confirm-row"><span>保费</span><span class="confirm-value">' + data.compulsoryAmount + ' 元</span></div>';
    html += '<div class="confirm-row"><span>费率</span><span class="confirm-value">' + data.compulsoryRate + '%</span></div>';
    if (data.compulsoryExpiry) html += '<div class="confirm-row"><span>到期</span><span class="confirm-value">' + formatExpiryDisplay(data.compulsoryExpiry) + '</span></div>';
    html += '</div>';
  }

  if (data.commercialAmount > 0) {
    html += '<div class="confirm-card confirm-card-commercial">';
    html += '<div class="confirm-card-title" style="color:#E8A04A;">商业险</div>';
    html += '<div class="confirm-row"><span>保费</span><span class="confirm-value">' + data.commercialAmount + ' 元</span></div>';
    html += '<div class="confirm-row"><span>费率</span><span class="confirm-value">' + data.commercialRate + '%</span></div>';
    if (data.commercialExpiry) html += '<div class="confirm-row"><span>到期</span><span class="confirm-value">' + formatExpiryDisplay(data.commercialExpiry) + '</span></div>';
    html += '</div>';
  }

  if (data.nonVehicleAmount > 0) {
    html += '<div class="confirm-card confirm-card-nonvehicle">';
    html += '<div class="confirm-card-title" style="color:#6CB4A8;">随车非车</div>';
    html += '<div class="confirm-row"><span>保费</span><span class="confirm-value">' + data.nonVehicleAmount + ' 元</span></div>';
    html += '<div class="confirm-row"><span>费率</span><span class="confirm-value">' + data.nonVehicleRate + '%</span></div>';
    html += '</div>';
  }

  if (data.vehicleTax > 0) {
    html += '<div class="confirm-card confirm-card-tax">';
    html += '<div class="confirm-row"><span class="confirm-label">车船税</span><span class="confirm-value">' + data.vehicleTax + ' 元</span></div>';
    html += '</div>';
  }

  html += '</div>';

  document.getElementById('confirmMessage').innerHTML = html;

  var hasImg = document.getElementById('imgPreview').src && document.getElementById('imgPreviewWrap').style.display !== 'none';
  document.getElementById('confirmViewImg').style.display = hasImg ? 'flex' : 'none';

  document.getElementById('confirmOverlay').style.display = 'flex';

  var onOk = function() {
    document.getElementById('confirmOverlay').style.display = 'none';
    document.getElementById('confirmOk').removeEventListener('click', onOk);
    document.getElementById('confirmCancel').removeEventListener('click', onCancel);
    document.getElementById('confirmViewImg').removeEventListener('click', onViewImg);
    doCalculate(data);
  };
  var onCancel = function() {
    document.getElementById('confirmOverlay').style.display = 'none';
    document.getElementById('confirmOk').removeEventListener('click', onOk);
    document.getElementById('confirmCancel').removeEventListener('click', onCancel);
    document.getElementById('confirmViewImg').removeEventListener('click', onViewImg);
  };
  var onViewImg = function() {
    updateBaseSize();
    resetViewer();
    document.getElementById('imgViewerImg').src = document.getElementById('imgPreview').src;
    document.getElementById('imgViewerOverlay').style.display = 'block';
  };
  document.getElementById('confirmOk').addEventListener('click', onOk);
  document.getElementById('confirmCancel').addEventListener('click', onCancel);
  document.getElementById('confirmViewImg').addEventListener('click', onViewImg);
}

// ====== 缺失字段弹窗 ======
function showMissingFieldsDialog(missing) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.style.zIndex = '1100';

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.style.maxWidth = '320px';
  dialog.style.maxHeight = '80vh';
  dialog.style.overflow = 'auto';

  var html = '<div style="text-align:left;">';
  html += '<div style="font-weight:600;margin-bottom:12px;font-size:1rem;color:#E74C3C;">⚠️ 请填写以下必填项</div>';

  missing.forEach(function(item, i) {
    const inputType = item.el.type === 'number' ? 'number' : 'text';
    const placeholder = item.el.placeholder || '';
    html += '<div style="margin-bottom:12px;">';
    html += '<label style="font-size:0.8rem;font-weight:500;color:var(--text);margin-bottom:6px;display:block;">' + item.label + '</label>';
    html += '<input type="' + inputType + '" class="missing-field-input" data-idx="' + i + '" placeholder="' + placeholder + '" step="0.01" min="0" style="width:100%;height:42px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:10px;padding:0 14px;font-size:0.85rem;color:var(--text);outline:none;box-sizing:border-box;">';
    html += '</div>';
  });

  html += '<div style="display:flex;gap:10px;margin-top:16px;">';
  html += '<button class="confirm-btn confirm-cancel" id="missingFieldsCancel" style="flex:1;">取消</button>';
  html += '<button class="confirm-btn confirm-ok" id="missingFieldsOk" style="flex:1;">确定</button>';
  html += '</div></div>';

  dialog.innerHTML = html;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const firstInput = overlay.querySelector('.missing-field-input');
  if (firstInput) setTimeout(function() { firstInput.focus(); }, 100);

  overlay.querySelector('#missingFieldsOk').addEventListener('click', function(e) {
    e.stopPropagation();
    overlay.querySelectorAll('.missing-field-input').forEach(function(input) {
      const idx = parseInt(input.dataset.idx, 10);
      const val = input.value.trim();
      if (val) {
        missing[idx].el.value = val;
      }
    });
    document.body.removeChild(overlay);
  });

  overlay.querySelector('#missingFieldsCancel').addEventListener('click', function(e) {
    e.stopPropagation();
    document.body.removeChild(overlay);
  });
}

// ====== 缺失到期时间弹窗 ======
function showMissingExpiryDialog(missingExpiry, data) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.style.zIndex = '1100';

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.style.maxWidth = '320px';

  var html = '<div style="text-align:left;">';
  html += '<div style="font-weight:600;margin-bottom:12px;font-size:1rem;color:#E74C3C;">⚠️ 请填写到期时间</div>';
  html += '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">以下保险有保费但缺少到期时间：</div>';

  missingExpiry.forEach(function(item, i) {
    html += '<div style="margin-bottom:12px;">';
    html += '<label style="font-size:0.8rem;font-weight:500;color:var(--text);margin-bottom:6px;display:block;">' + item.label + '</label>';
    html += '<div class="expiry-inputs" style="gap:6px;">';
    html += '<input type="number" class="expiry-dialog-input" data-idx="' + i + '" data-type="year" placeholder="年" min="2020" max="2099" style="flex:1;min-width:50px;height:40px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;text-align:center;font-size:0.85rem;color:var(--text);outline:none;">';
    html += '<span style="font-size:0.8rem;color:var(--text-secondary);">年</span>';
    html += '<input type="number" class="expiry-dialog-input" data-idx="' + i + '" data-type="month" placeholder="月" min="1" max="12" style="flex:1;min-width:40px;height:40px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;text-align:center;font-size:0.85rem;color:var(--text);outline:none;">';
    html += '<span style="font-size:0.8rem;color:var(--text-secondary);">月</span>';
    html += '<input type="number" class="expiry-dialog-input" data-idx="' + i + '" data-type="day" placeholder="日" min="1" max="31" style="flex:1;min-width:40px;height:40px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;text-align:center;font-size:0.85rem;color:var(--text);outline:none;">';
    html += '<span style="font-size:0.8rem;color:var(--text-secondary);">日</span>';
    html += '</div></div>';
  });

  html += '<div style="display:flex;gap:10px;margin-top:16px;">';
  html += '<button class="confirm-btn confirm-cancel" id="expirySkip" style="flex:1;">跳过</button>';
  html += '<button class="confirm-btn confirm-ok" id="expiryConfirm" style="flex:1;">确定</button>';
  html += '</div></div>';

  dialog.innerHTML = html;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const firstInput = overlay.querySelector('.expiry-dialog-input');
  if (firstInput) setTimeout(function() { firstInput.focus(); }, 100);

  overlay.querySelector('#expiryConfirm').addEventListener('click', function(e) {
    e.stopPropagation();
    missingExpiry.forEach(function(item, i) {
      const year = overlay.querySelector('.expiry-dialog-input[data-idx="' + i + '"][data-type="year"]');
      const month = overlay.querySelector('.expiry-dialog-input[data-idx="' + i + '"][data-type="month"]');
      const day = overlay.querySelector('.expiry-dialog-input[data-idx="' + i + '"][data-type="day"]');
      if (year && month && day) {
        const y = year.value.trim();
        const m = month.value.trim();
        const d = day.value.trim();
        if (y && m && d) {
          const expiryStr = y + '年' + m + '月' + d + '日';
          item.expiryEls[0].value = y;
          item.expiryEls[1].value = m;
          item.expiryEls[2].value = d;
          if (item.label.includes('交强')) window.ocrExpiry.compulsory = expiryStr;
          if (item.label.includes('商业')) window.ocrExpiry.commercial = expiryStr;
        }
      }
    });
    document.body.removeChild(overlay);
    const newData = getFormData();
    showConfirmDialog(newData);
  });

  overlay.querySelector('#expirySkip').addEventListener('click', function(e) {
    e.stopPropagation();
    document.body.removeChild(overlay);
    showConfirmDialog(data);
  });
}

// ====== 通用确认弹窗（单条消息） ======
var confirmCallback = null;

function showConfirm(message, onOk) {
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmViewImg').style.display = 'none';
  confirmCallback = onOk;
  document.getElementById('confirmOverlay').style.display = 'flex';
}
