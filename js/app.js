/**
 * 报价单 - 入口文件
 * 加载各模块后初始化事件绑定
 */

document.addEventListener('DOMContentLoaded', function() {
  // ====== Status Bar ======
  var StatusBar = window.Capacitor?.Plugins?.StatusBar;
  if (StatusBar) {
    var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#C8604A';
    StatusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' });
    StatusBar.setBackgroundColor({ color: isDark ? '#000000' : primaryColor });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      var color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#C8604A';
      StatusBar.setStyle({ style: e.matches ? 'DARK' : 'LIGHT' });
      StatusBar.setBackgroundColor({ color: e.matches ? '#000000' : color });
    });
  }

  // ====== Shared State ======
  window.ocrExpiry = { compulsory: '', commercial: '', nonVehicle: '' };
  window.lastCompanyValue = '';
  var apiKeyVisible = false;

  // ====== DOM References ======
  var confirmOverlay = document.getElementById('confirmOverlay');
  var confirmCancel = document.getElementById('confirmCancel');
  var confirmOk = document.getElementById('confirmOk');
  var confirmViewImg = document.getElementById('confirmViewImg');
  var imgViewerOverlay = document.getElementById('imgViewerOverlay');
  var imgViewerImg = document.getElementById('imgViewerImg');
  var imgPreview = document.getElementById('imgPreview');
  var imgPreviewWrap = document.getElementById('imgPreviewWrap');
  var imgPreviewStatus = document.getElementById('imgPreviewStatus');

  // ====== Input Elements ======
  var insuranceCompany = document.getElementById('insuranceCompany');
  var plateNumber = document.getElementById('plateNumber');
  var quickRate = document.getElementById('quickRate');
  var addInvest = document.getElementById('addInvest');
  var compulsoryAmount = document.getElementById('compulsoryAmount');
  var compulsoryRate = document.getElementById('compulsoryRate');
  var commercialAmount = document.getElementById('commercialAmount');
  var commercialRate = document.getElementById('commercialRate');
  var nonVehicleAmount = document.getElementById('nonVehicleAmount');
  var nonVehicleRate = document.getElementById('nonVehicleRate');
  var vehicleTax = document.getElementById('vehicleTax');
  var compulsoryExpiryYear = document.getElementById('compulsoryExpiryYear');
  var compulsoryExpiryMonth = document.getElementById('compulsoryExpiryMonth');
  var compulsoryExpiryDay = document.getElementById('compulsoryExpiryDay');
  var commercialExpiryYear = document.getElementById('commercialExpiryYear');
  var commercialExpiryMonth = document.getElementById('commercialExpiryMonth');
  var commercialExpiryDay = document.getElementById('commercialExpiryDay');
  var resultSection = document.getElementById('resultSection');

  // ====== Hide result on input change ======
  var allInputs = [insuranceCompany, plateNumber, quickRate, addInvest,
    compulsoryAmount, compulsoryRate, commercialAmount, commercialRate,
    nonVehicleAmount, nonVehicleRate, vehicleTax];
  allInputs.forEach(function(input) {
    input.addEventListener('input', function() {
      if (resultSection.style.display === 'block') {
        resultSection.style.display = 'none';
      }
    });
  });

  // ====== Tab Switching ======
  var navItems = document.querySelectorAll('.nav-item');
  var tabContents = document.querySelectorAll('.tab-content');
  var headerTitle = document.querySelector('.header-title');
  var tabTitles = { tabCalc: '计算', tabSettings: '设置' };

  navItems.forEach(function(item) {
    item.addEventListener('click', function() {
      var targetTab = item.dataset.tab;
      navItems.forEach(function(n) { n.classList.remove('active'); });
      item.classList.add('active');
      tabContents.forEach(function(t) { t.classList.remove('active'); });
      document.getElementById(targetTab).classList.add('active');
      headerTitle.textContent = tabTitles[targetTab] || '报价单';
      if (targetTab === 'tabSettings') {
        document.getElementById('settingsMenu').style.display = 'block';
        document.getElementById('subpageRecords').style.display = 'none';
        document.getElementById('subpageModels').style.display = 'none';
        document.getElementById('subpageDualConfig').style.display = 'none';
      }
    });
  });

  // ====== Settings Sub-pages ======
  function showSubpage(name) {
    document.getElementById('settingsMenu').style.display = 'none';
    if (name === 'records') {
      document.getElementById('subpageRecords').style.display = 'block';
      document.getElementById('subpageModels').style.display = 'none';
      document.getElementById('subpageDualConfig').style.display = 'none';
      renderRecords();
    } else if (name === 'models') {
      document.getElementById('subpageModels').style.display = 'block';
      document.getElementById('subpageRecords').style.display = 'none';
      document.getElementById('subpageDualConfig').style.display = 'none';
      renderProviders();
    } else if (name === 'dualConfig') {
      document.getElementById('subpageDualConfig').style.display = 'block';
      document.getElementById('subpageModels').style.display = 'none';
      document.getElementById('subpageRecords').style.display = 'none';
      renderDualConfigUI();
    }
  }

  function hideSubpages() {
    document.getElementById('settingsMenu').style.display = 'block';
    document.getElementById('subpageRecords').style.display = 'none';
    document.getElementById('subpageModels').style.display = 'none';
    document.getElementById('subpageDualConfig').style.display = 'none';
  }

  document.getElementById('btnGoRecords').addEventListener('click', function() { showSubpage('records'); });
  document.getElementById('btnGoModels').addEventListener('click', function() { showSubpage('models'); });
  document.getElementById('btnGoDualConfig').addEventListener('click', function() { showSubpage('dualConfig'); });
  document.getElementById('btnBackFromRecords').addEventListener('click', hideSubpages);
  document.getElementById('btnBackFromModels').addEventListener('click', hideSubpages);
  document.getElementById('btnBackFromDualConfig').addEventListener('click', hideSubpages);

  // ====== Quick Fill Rate ======
  quickRate.addEventListener('blur', function() {
    var rates = parseTripleInput(quickRate.value);
    if (rates) {
      compulsoryRate.value = rates[0];
      commercialRate.value = rates[1];
      nonVehicleRate.value = rates[2];
    }
  });

  // ====== Add Investment ======
  addInvest.addEventListener('blur', function() {
    var addRates = parseDoubleInput(addInvest.value);
    if (addRates) {
      compulsoryRate.value = addValue(compulsoryRate.value, addRates[0]);
      commercialRate.value = addValue(commercialRate.value, addRates[1]);
    }
  });

  // ====== Rate Sync ======
  [compulsoryRate, commercialRate, nonVehicleRate].forEach(function(el) {
    el.addEventListener('input', function() {
      syncRatesToQuick();
    });
  });

  // ====== Company Name Correction ======
  insuranceCompany.addEventListener('blur', function() {
    var newVal = insuranceCompany.value.trim();
    if (window.lastCompanyValue && newVal && window.lastCompanyValue !== newVal) {
      saveCompanyCorrection(window.lastCompanyValue, newVal);
    }
    window.lastCompanyValue = newVal;
  });

  window.trackCompanyBeforeOCR = function() {
    window.lastCompanyValue = insuranceCompany.value.trim();
  };

  // ====== Calculate Button ======
  document.getElementById('btnCalculate').addEventListener('click', function() {
    var data = getFormData();

    var missing = [];
    if (!insuranceCompany.value.trim()) missing.push({ label: '保险公司', el: insuranceCompany });
    if (!plateNumber.value.trim()) missing.push({ label: '车牌号', el: plateNumber });
    if (!quickRate.value.trim()) missing.push({ label: '费率', el: quickRate });

    if (missing.length > 0) {
      showMissingFieldsDialog(missing);
      return;
    }

    var rates = parseQuickRate(quickRate.value.trim());
    if (rates.length >= 1) compulsoryRate.value = rates[0];
    if (rates.length >= 2) commercialRate.value = rates[1];
    if (rates.length >= 3) nonVehicleRate.value = rates[2];

    var newData = getFormData();

    var hasAmount = newData.compulsoryAmount > 0 || newData.commercialAmount > 0 || newData.nonVehicleAmount > 0 || newData.vehicleTax > 0;
    if (!hasAmount) {
      showMissingFieldsDialog([
        { label: '交强险保费', el: compulsoryAmount },
        { label: '商业险保费', el: commercialAmount },
        { label: '随车非车保费', el: nonVehicleAmount },
        { label: '车船税', el: vehicleTax },
      ]);
      return;
    }

    var rateMissing = [];
    if (newData.compulsoryAmount > 0 && !compulsoryRate.value.trim()) {
      rateMissing.push({ label: '交强险费率', el: compulsoryRate });
    }
    if (newData.commercialAmount > 0 && !commercialRate.value.trim()) {
      rateMissing.push({ label: '商业险费率', el: commercialRate });
    }
    if (newData.nonVehicleAmount > 0 && !nonVehicleRate.value.trim()) {
      rateMissing.push({ label: '随车非车费率', el: nonVehicleRate });
    }
    if (rateMissing.length > 0) {
      showMissingFieldsDialog(rateMissing);
      return;
    }

    var missingExpiry = [];
    if (newData.compulsoryAmount > 0 && newData.compulsoryRate > 0 && !newData.compulsoryExpiry) {
      missingExpiry.push({ label: '交强险到期时间', el: compulsoryExpiryYear, type: 'expiry', expiryEls: [compulsoryExpiryYear, compulsoryExpiryMonth, compulsoryExpiryDay] });
    }
    if (newData.commercialAmount > 0 && newData.commercialRate > 0 && !newData.commercialExpiry) {
      missingExpiry.push({ label: '商业险到期时间', el: commercialExpiryYear, type: 'expiry', expiryEls: [commercialExpiryYear, commercialExpiryMonth, commercialExpiryDay] });
    }

    if (missingExpiry.length > 0) {
      showMissingExpiryDialog(missingExpiry, newData);
      return;
    }

    if (lastCalculatedData && isSameData(lastCalculatedData, newData)) {
      doCalculate(newData);
      return;
    }

    showConfirmDialog(newData);
  });

  // ====== Reset ======
  document.getElementById('btnReset').addEventListener('click', function() {
    var inputList = [
      insuranceCompany, plateNumber, quickRate, addInvest,
      compulsoryAmount, compulsoryRate,
      commercialAmount, commercialRate,
      nonVehicleAmount, nonVehicleRate,
      vehicleTax,
      compulsoryExpiryYear, compulsoryExpiryMonth, compulsoryExpiryDay,
      commercialExpiryYear, commercialExpiryMonth, commercialExpiryDay,
    ];
    inputList.forEach(function(input) { input.value = ''; });
    resultSection.style.display = 'none';
    window.ocrExpiry.compulsory = '';
    window.ocrExpiry.commercial = '';
    window.ocrExpiry.nonVehicle = '';
    lastCalculatedData = null;
  });

  // ====== Image Upload ======
  var fileInput = document.getElementById('fileInput');
  var btnSelectImg = document.getElementById('btnSelectImg');
  var btnRemoveImg = document.getElementById('btnRemoveImg');

  btnSelectImg.addEventListener('click', function() {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    handleFileSelect(file);
  });

  btnRemoveImg.addEventListener('click', function() {
    imgPreview.src = '';
    imgPreviewWrap.style.display = 'none';
    imgPreviewStatus.textContent = '';
    imgPreviewStatus.className = 'img-preview-status';
    fileInput.value = '';
  });

  // ====== Image Viewer Events ======
  document.getElementById('btnViewImg').addEventListener('click', function() {
    if (!imgPreview.src || imgPreviewWrap.style.display === 'none') {
      showToast('请先上传图片');
      return;
    }
    updateBaseSize();
    resetViewer();
    imgViewerImg.src = imgPreview.src;
    imgViewerOverlay.style.display = 'block';
  });

  imgViewerOverlay.addEventListener('click', function() {
    imgViewerOverlay.style.display = 'none';
  });

  imgViewerImg.addEventListener('touchstart', function(e) {
    cancelFling();
    movedSinceTouch = false;
    if (e.touches.length === 2) {
      t0 = e.touches[0]; t1 = e.touches[1];
      pinchStartDist = dist(t0, t1);
      pinchStartScale = scale;
      var m2 = mid(t0, t1);
      pinchMidStartX = m2.x;
      pinchMidStartY = m2.y;
      pinchStartCX = cx;
      pinchStartCY = cy;
    } else if (e.touches.length === 1) {
      t0 = e.touches[0];
      panStartX = t0.clientX - cx;
      panStartY = t0.clientY - cy;
      velHistory = [{ x: t0.clientX, y: t0.clientY, t: Date.now() }];
    }
  }, { passive: true });

  imgViewerImg.addEventListener('touchmove', function(e) {
    movedSinceTouch = true;
    if (e.touches.length === 2 && t0 && t1) {
      var ct0 = e.touches[0], ct1 = e.touches[1];
      var curDist = dist(ct0, ct1);
      var curMid = mid(ct0, ct1);
      var newScale = Math.min(Math.max(pinchStartScale * (curDist / pinchStartDist), 0.5), MAX_SCALE);
      cx = pinchMidStartX + pinchStartCX - curMid.x;
      cy = pinchMidStartY + pinchStartCY - curMid.y;
      scale = newScale;
      clampCenter();
      imgViewerImg.style.transform = 'translate(' + cx + 'px, ' + cy + 'px) scale(' + scale + ')';
    } else if (e.touches.length === 1 && t0) {
      var ct = e.touches[0];
      var newCX = ct.clientX - panStartX;
      var newCY = ct.clientY - panStartY;
      if (scale <= 1) newCY = 0;
      var s = getScaledSize();
      var maxX2 = Math.max(0, (s.w - vw()) / 2);
      var maxY2 = Math.max(0, (s.h - vh()) / 2);
      var overshoot = 80;
      newCX = Math.min(Math.max(newCX, -maxX2 - overshoot), maxX2 + overshoot);
      newCY = Math.min(Math.max(newCY, -maxY2 - overshoot), maxY2 + overshoot);
      cx = newCX;
      cy = newCY;
      imgViewerImg.style.transform = 'translate(' + cx + 'px, ' + cy + 'px) scale(' + scale + ')';
      var now = Date.now();
      velHistory.push({ x: ct.clientX, y: ct.clientY, t: now });
      if (velHistory.length > 5) velHistory.shift();
    }
  }, { passive: true });

  imgViewerImg.addEventListener('touchend', function(e) {
    if (e.touches.length === 1) {
      var remaining = e.touches[0];
      t0 = remaining; t1 = null;
      panStartX = remaining.clientX - cx;
      panStartY = remaining.clientY - cy;
      velHistory = [{ x: remaining.clientX, y: remaining.clientY, t: Date.now() }];
    } else if (e.touches.length === 0) {
      t0 = null; t1 = null;
      if (scale > 1 && movedSinceTouch && velHistory.length >= 2) {
        var last = velHistory[velHistory.length - 1];
        var first = velHistory[0];
        var dt = (last.t - first.t) || 1;
        var vx = (last.x - first.x) / dt * 16;
        var vy = (last.y - first.y) / dt * 16;
        if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
          startFling(vx, vy);
          return;
        }
      }
      if (scale < MIN_SCALE) scale = MIN_SCALE;
      clampCenter();
      applyTransform(true);
    }
  }, { passive: true });

  imgViewerImg.addEventListener('click', function(e) {
    e.stopPropagation();
    if (movedSinceTouch) return;
    var now = Date.now();
    if (lastTapTime && now - lastTapTime < 300) {
      lastTapTime = 0;
      var tapX = e.clientX;
      var tapY = e.clientY;
      if (scale > MIN_SCALE) {
        scale = MIN_SCALE; cx = 0; cy = 0;
        applyTransform(true);
      } else {
        scale = 2;
        updateBaseSize();
        cx = vw() / 2 - tapX;
        cy = vh() / 2 - tapY;
        clampCenter();
        applyTransform(true);
      }
      return;
    }
    lastTapTime = now;
    setTimeout(function() {
      if (lastTapTime !== now) return;
      imgViewerOverlay.style.display = 'none';
    }, 300);
  });

  // ====== Save Record ======
  document.getElementById('btnSaveRecord').addEventListener('click', async function() {
    var data = getFormData();
    var results = calculate(data);
    if (results.total === 0) { showToast('请先填写数据并计算'); return; }

    var record = {
      id: Date.now(),
      company: insuranceCompany.value || '未填写',
      plate: plateNumber.value || '未填写',
      time: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    };
    Object.assign(record, data, results);
    record.localImage = null;

    if (imgPreview.src && imgPreviewWrap.style.display !== 'none') {
      try {
        record.localImage = await saveImageToLocal(imgPreview.src, record.id);
      } catch (e) { console.warn('[保存] 图片保存失败:', e.message || e); }
    }

    saveRecord(record);
    showToast('已保存到记录');
  });

  // ====== Copy & Share ======
  document.getElementById('btnCopyPlan').addEventListener('click', function() {
    var data = getFormData();
    var results = calculate(data);
    copyToClipboard(formatPlanText(data, results));
    showToast('已复制文案');
  });

  document.getElementById('btnShareResult').addEventListener('click', async function() {
    var data = getFormData();
    var results = calculate(data);
    var text = formatPlanText(data, results);
    try {
      var Share = window.Capacitor?.Plugins?.Share;
      if (Share) { await Share.share({ title: '车险报价单', text: text, dialogTitle: '分享报价单' }); return; }
    } catch (e) { /* noop */ }
    try {
      if (navigator.share) { await navigator.share({ title: '车险报价单', text: text }); return; }
    } catch (e) { if (e.name !== 'AbortError') console.log(e); }
    copyToClipboard(text);
    showToast('已复制到剪贴板');
  });

  // ====== Confirm Dialog Delegation ======
  confirmCancel.addEventListener('click', function() {
    confirmOverlay.style.display = 'none';
    confirmCallback = null;
  });
  confirmOk.addEventListener('click', function() {
    confirmOverlay.style.display = 'none';
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });
  confirmOverlay.addEventListener('click', function(e) {
    if (e.target === confirmOverlay) { confirmOverlay.style.display = 'none'; confirmCallback = null; }
  });

  // ====== Records ======
  document.getElementById('btnClearAllRecords').addEventListener('click', function() {
    var records = getRecords();
    if (records.length === 0) return;
    showConfirm('确定要清空全部历史记录吗？此操作不可撤销。', async function() {
      for (var r of records) { if (r.localImage) await deleteLocalImage(r.localImage); }
      localStorage.removeItem('chefeibao_records');
      document.getElementById('recordSearchInput').value = '';
      renderRecords();
      showToast('已清空全部记录');
    });
  });
  document.getElementById('recordSearchInput').addEventListener('input', function() { renderRecords(); });

  // ====== Provider Modal Events ======
  document.getElementById('btnAddProvider').addEventListener('click', function() { openProviderModal(null); });
  document.getElementById('btnCloseProviderModal').addEventListener('click', closeProviderModal);
  document.getElementById('btnCancelProvider').addEventListener('click', closeProviderModal);
  document.getElementById('providerModal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('providerModal')) closeProviderModal();
  });

  document.getElementById('quickSelectProvider').addEventListener('change', function() {
    var key = document.getElementById('quickSelectProvider').value;
    if (!key) return;
    var preset = PROVIDER_PRESETS[key];
    if (!preset) return;
    document.getElementById('inputProviderId').value = key;
    document.getElementById('inputBaseUrl').value = preset.baseUrl;
    document.getElementById('inputProtocol').value = preset.protocol;
    document.getElementById('inputApiKey').value = '';
    document.getElementById('inputProviderId').focus();
  });

  document.getElementById('btnToggleApiKey').addEventListener('click', function() {
    apiKeyVisible = !apiKeyVisible;
    document.getElementById('inputApiKey').type = apiKeyVisible ? 'text' : 'password';
  });

  document.getElementById('btnAddModel').addEventListener('click', addModelTag);
  document.getElementById('inputModelName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); addModelTag(); }
  });
  document.getElementById('btnAutoFetch').addEventListener('click', autoFetchModels);

  document.getElementById('btnSaveProvider').addEventListener('click', function() {
    var id = document.getElementById('inputProviderId').value.trim();
    var baseUrl = document.getElementById('inputBaseUrl').value.trim();
    var apiKey = document.getElementById('inputApiKey').value.trim();
    var protocol = document.getElementById('inputProtocol').value;
    if (!id) { showToast('请填写提供商 ID'); return; }
    if (!baseUrl) { showToast('请填写 Base URL'); return; }
    if (modalModels.length === 0) { showToast('请至少添加一个模型'); return; }

    var name = PROVIDER_PRESETS[id] ? PROVIDER_PRESETS[id].name : id;
    var providers = getProviders();
    if (editingProviderId) {
      var idx = providers.findIndex(function(p) { return p.id === editingProviderId; });
      if (idx >= 0) {
        providers[idx] = Object.assign({}, providers[idx], { id: id, name: name, baseUrl: baseUrl, apiKey: apiKey, protocol: protocol, models: modalModels.slice(), selectedModel: modalModels[0] || '' });
      }
    } else {
      if (providers.some(function(p) { return p.id === id; })) { showToast('提供商 ID 已存在'); return; }
      providers.push({ id: id, name: name, baseUrl: baseUrl, apiKey: apiKey, protocol: protocol, models: modalModels.slice(), selectedModel: modalModels[0] || '' });
      if (!getActiveProviderId()) setActiveProvider(id);
    }
    saveProviders(providers);
    closeProviderModal();
    renderProviders();
    showToast(editingProviderId ? '已更新' : '已添加');
  });

  // ====== Provider Card Actions ======
  document.getElementById('providerList').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var pId = btn.dataset.id;
    if (action === 'select') {
      setActiveProvider(pId);
      renderProviders();
      var p = getProviders().find(function(x) { return x.id === pId; });
      showToast(p ? '已切换到 ' + p.name : '已切换');
    } else if (action === 'edit') { openProviderModal(pId);
    } else if (action === 'delete') { deleteProvider(pId);
    } else if (action === 'test') { testProvider(pId); }
  });

  document.getElementById('providerList').addEventListener('change', function(e) {
    if (e.target.dataset.action === 'switchModel') {
      var swId = e.target.dataset.id;
      var model = e.target.value;
      var provs = getProviders();
      var swP = provs.find(function(x) { return x.id === swId; });
      if (swP) { swP.selectedModel = model; saveProviders(provs); showToast('已切换到 ' + model); }
    }
  });

  // ====== Dual Config Events ======
  document.getElementById('chkDualRecognize').addEventListener('change', function() {
    var cfg = getDualConfig();
    cfg.enabled = document.getElementById('chkDualRecognize').checked;
    saveDualConfig(cfg);
    renderDualConfigUI();
  });

  document.getElementById('selectDualCount').addEventListener('change', async function() {
    var cfg = getDualConfig();
    var newCount = parseInt(document.getElementById('selectDualCount').value);
    var oldCount = cfg.count;
    cfg.count = newCount;

    if (cfg.models.length > newCount) {
      var providers = getProviders();
      var modelsWithInfo = cfg.models.map(function(item) {
        var p = providers.find(function(x) { return x.id === item.providerId; });
        return p ? { provider: p, model: item.model } : null;
      }).filter(Boolean);
      var excluded = await showExcludeModelsDialog(modelsWithInfo, newCount);
      if (excluded !== null) {
        excluded.sort(function(a, b) { return b - a; }).forEach(function(idx2) { cfg.models.splice(idx2, 1); });
        saveDualConfig(cfg); renderDualConfigUI(); showToast('已更新参与识别的模型');
      } else { cfg.count = oldCount; document.getElementById('selectDualCount').value = oldCount; saveDualConfig(cfg); }
    } else if (cfg.models.length < newCount) {
      var providers2 = getProviders();
      var addedModels = new Set(cfg.models.map(function(m) { return m.providerId + '|||' + m.model; }));
      var availableModels = [];
      providers2.forEach(function(p) { (p.models || []).forEach(function(model) { var key = p.id + '|||' + model; if (!addedModels.has(key)) availableModels.push({ provider: p, model: model }); }); });
      if (availableModels.length === 0) { showToast('没有更多可用的模型'); cfg.count = oldCount; document.getElementById('selectDualCount').value = oldCount; saveDualConfig(cfg); return; }
      var needCount = newCount - cfg.models.length;
      var selected = await showSelectModelsDialog(availableModels, needCount);
      if (selected !== null) { selected.forEach(function(item) { cfg.models.push({ providerId: item.provider.id, model: item.model }); }); saveDualConfig(cfg); renderDualConfigUI(); showToast('已添加参与识别的模型'); }
      else { cfg.count = oldCount; document.getElementById('selectDualCount').value = oldCount; saveDualConfig(cfg); }
    } else { saveDualConfig(cfg); }
  });

  document.getElementById('btnAddDualModel').addEventListener('click', async function() {
    var selectDualProvider = document.getElementById('selectDualProvider');
    if (selectDualProvider.disabled) { showToast('暂无可选择的供应商'); return; }
    var val = selectDualProvider.value;
    if (!val) { showToast('请选择供应商和模型'); return; }
    var parts = val.split('|||');
    var providerId = parts[0], dualModel = parts[1];
    var cfg2 = getDualConfig();
    var maxCount2 = cfg2.count || 2;
    cfg2.models.push({ providerId: providerId, model: dualModel });

    if (cfg2.models.length > maxCount2) {
      var providers3 = getProviders();
      var modelsWithInfo2 = cfg2.models.map(function(item) { var p = providers3.find(function(x) { return x.id === item.providerId; }); return p ? { provider: p, model: item.model } : null; }).filter(Boolean);
      var excluded2 = await showExcludeModelsDialog(modelsWithInfo2, maxCount2);
      if (excluded2 !== null) { excluded2.sort(function(a, b) { return b - a; }).forEach(function(idx3) { cfg2.models.splice(idx3, 1); }); saveDualConfig(cfg2); renderDualConfigUI(); showToast('已更新参与识别的模型'); }
      else { cfg2.models.pop(); saveDualConfig(cfg2); renderDualConfigUI(); }
    } else { saveDualConfig(cfg2); renderDualConfigUI(); }
  });

  // ====== Test All Dual Models ======
  document.getElementById('btnTestAllDualModels').addEventListener('click', async function() {
    var cfg3 = getDualConfig();
    if (cfg3.models.length === 0) { showToast('暂无参与识别的模型'); return; }
    var providers4 = getProviders();
    var modelsToTest = cfg3.models.map(function(item) { var p = providers4.find(function(x) { return x.id === item.providerId; }); return p ? { provider: p, model: item.model } : null; }).filter(Boolean);
    if (modelsToTest.length === 0) { showToast('暂无可用的模型'); return; }
    showToast('正在测试 ' + modelsToTest.length + ' 个模型...');

    var testCanvas = document.createElement('canvas');
    testCanvas.width = 100; testCanvas.height = 100;
    var ctx = testCanvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#000000'; ctx.font = '14px Arial'; ctx.fillText('TEST', 25, 55);
    var testDataUrl = testCanvas.toDataURL('image/jpeg', 0.8);
    var testBase64 = testDataUrl.split(',')[1] || '';

    var testResults = await Promise.allSettled(modelsToTest.map(async function(item) {
      var startTime = Date.now();
      try { var testProvider = Object.assign({}, item.provider, { selectedModel: item.model }); await callProviderAPI(testProvider, item.model, testDataUrl, testBase64, 'image/jpeg'); return { provider: item.provider.name || item.provider.id, model: item.model, success: true, time: ((Date.now() - startTime) / 1000).toFixed(1) }; }
      catch (e) { return { provider: item.provider.name || item.provider.id, model: item.model, success: false, error: e.message, time: ((Date.now() - startTime) / 1000).toFixed(1) }; }
    }));
    var passed = testResults.filter(function(r) { return r.status === 'fulfilled' && r.value.success; }).map(function(r) { return r.value; });
    var failed = testResults.filter(function(r) { return r.status === 'fulfilled' && !r.value.success; }).map(function(r) { return r.value; });
    var msg2 = '测试完成：' + passed.length + ' 个成功' + (failed.length > 0 ? '，' + failed.length + ' 个失败' : '');
    showToast(msg2);
  });

  // ====== Font Size ======
  var savedFontSize = getFontSize();
  document.getElementById('fontSizeSlider').value = savedFontSize;
  applyFontSize(savedFontSize);
  var fontSizeEl = document.getElementById('fontSizeSlider');
  ['input', 'change'].forEach(function(evt) {
    fontSizeEl.addEventListener(evt, function() {
      var size = parseInt(fontSizeEl.value);
      localStorage.setItem(FONT_SIZE_KEY, size);
      applyFontSize(size);
    });
  });

  // ====== Init ======
  renderRecords();
  renderProviders();
  updateDualBadge();

  // ====== Records Render & Restore ======
  function renderRecords() {
    var records = getRecords();
    var btnClearAllRecords = document.getElementById('btnClearAllRecords');
    var recordSearchWrap = document.getElementById('recordSearchWrap');
    var recordSearchInput = document.getElementById('recordSearchInput');
    var emptyStateSettings = document.getElementById('emptyStateSettings');
    var recordListSettings = document.getElementById('recordListSettings');

    btnClearAllRecords.style.display = records.length > 0 ? 'block' : 'none';
    recordSearchWrap.style.display = records.length > 0 ? 'block' : 'none';

    var searchTerm = recordSearchInput.value.trim().toLowerCase();
    var filtered = searchTerm
      ? records.filter(function(r) { return (r.plate || '').toLowerCase().includes(searchTerm); })
      : records;

    if (filtered.length === 0) {
      emptyStateSettings.style.display = 'flex';
      recordListSettings.innerHTML = '';
      return;
    }

    emptyStateSettings.style.display = 'none';
    recordListSettings.innerHTML = '';

    filtered.forEach(function(r) {
      var item = document.createElement('div');
      item.className = 'record-item';
      item.dataset.recordId = r.id;

      var feeParts = [];
      if (r.compulsoryFee > 0) feeParts.push('<span class="record-fee-item"><span class="record-fee-dot" style="background:#E8734A;"></span>交强险 ' + formatMoney(r.compulsoryFee) + '</span>');
      if (r.commercialFee > 0) feeParts.push('<span class="record-fee-item"><span class="record-fee-dot" style="background:#E8A04A;"></span>商业险 ' + formatMoney(r.commercialFee) + '</span>');
      if (r.nonVehicleFee > 0) feeParts.push('<span class="record-fee-item"><span class="record-fee-dot" style="background:#6CB4A8;"></span>随车非车 ' + formatMoney(r.nonVehicleFee) + '</span>');
      var feeHtml = feeParts.join('<span class="record-fee-separator">/</span>');

      item.innerHTML =
        '<div class="record-item-top">' +
        '<div class="record-item-info">' +
        '<div class="record-company">' + escapeHtml(r.company || '未填写') + '</div>' +
        '<div class="record-plate">' + escapeHtml(r.plate || '未填写') + '</div>' +
        '</div>' +
        '<div class="record-item-meta">' +
        '<div class="record-time">' + escapeHtml(formatRecordTime(r.time)) + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="record-amount">' + formatMoney(r.afterTax || 0) + '</div>' +
        (feeParts.length > 0 ? '<div class="record-fees">' + feeHtml + '</div>' : '') +
        '<div class="record-bottom">' +
        '<button class="record-delete" data-id="' + r.id + '" title="删除记录">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
        '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>删除</button>' +
        '</div>';
      recordListSettings.appendChild(item);
    });

    recordListSettings.querySelectorAll('.record-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id2 = parseInt(btn.dataset.id, 10);
        deleteRecord(id2);
      });
    });

    recordListSettings.querySelectorAll('.record-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.record-delete')) return;
        var id3 = parseInt(item.dataset.recordId, 10);
        var record = records.find(function(r) { return r.id === id3; });
        if (!record) return;
        restoreRecordToForm(record);
      });
    });
  }

  async function restoreRecordToForm(record) {
    insuranceCompany.value = record.company || '';
    plateNumber.value = record.plate || '';
    compulsoryAmount.value = record.compulsoryAmount || '';
    compulsoryRate.value = record.compulsoryRate || '';
    commercialAmount.value = record.commercialAmount || '';
    commercialRate.value = record.commercialRate || '';
    nonVehicleAmount.value = record.nonVehicleAmount || '';
    nonVehicleRate.value = record.nonVehicleRate || '';
    vehicleTax.value = record.vehicleTax || '';
    addInvest.value = record.addInvest || '';

    if (record.compulsoryExpiry) parseExpiryToInputs(record.compulsoryExpiry, compulsoryExpiryYear, compulsoryExpiryMonth, compulsoryExpiryDay);
    if (record.commercialExpiry) parseExpiryToInputs(record.commercialExpiry, commercialExpiryYear, commercialExpiryMonth, commercialExpiryDay);

    if (record.compulsoryRate && record.commercialRate && record.nonVehicleRate) {
      quickRate.value = record.compulsoryRate + '/' + record.commercialRate + '/' + record.nonVehicleRate;
    }

    if (record.localImage) {
      if (record.localImage.startsWith('data:')) {
        imgPreview.src = record.localImage;
        imgPreviewWrap.style.display = 'block';
        imgPreviewStatus.textContent = '已恢复图片';
        imgPreviewStatus.className = 'img-preview-status';
      } else {
        try {
          var Filesystem = window.Capacitor?.Plugins?.Filesystem;
          if (Filesystem) {
            var imageDataUrl = await readLocalImage(record.localImage);
            if (imageDataUrl) {
              imgPreview.src = imageDataUrl;
              imgPreviewWrap.style.display = 'block';
              imgPreviewStatus.textContent = '已恢复图片';
              imgPreviewStatus.className = 'img-preview-status';
            }
          }
        } catch (e) {
          console.warn('[恢复] 恢复图片失败:', e.message || e);
        }
      }
    }

    Array.from(navItems).forEach(function(item) { item.classList.remove('active'); });
    document.querySelector('[data-tab="tabCalc"]').classList.add('active');
    Array.from(tabContents).forEach(function(tab) { tab.classList.remove('active'); });
    document.getElementById('tabCalc').classList.add('active');

    var data = getFormData();
    if (data.compulsoryRate > 0 || data.commercialRate > 0 || data.nonVehicleRate > 0) {
      var results = calculate(data);
      displayResults(results);
      resultSection.style.display = 'block';
    }

    hideSubpages();
    showToast('已恢复记录数据');
  }

  // ====== Back Button ======
  var App = window.Capacitor?.Plugins?.App;
  if (App) {
    App.addListener('backButton', function() {
      var conflictOverlay = document.querySelector('.confirm-overlay[style*="z-index: 1100"]');
      if (conflictOverlay) { conflictOverlay.remove(); return; }
      if (confirmOverlay.style.display === 'flex') { confirmOverlay.style.display = 'none'; return; }
      if (document.getElementById('imgViewerOverlay').style.display === 'block') { document.getElementById('imgViewerOverlay').style.display = 'none'; return; }
      if (document.getElementById('providerModal').style.display === 'flex') { closeProviderModal(); return; }
      if (document.getElementById('subpageRecords').style.display === 'block' || document.getElementById('subpageModels').style.display === 'block' || document.getElementById('subpageDualConfig').style.display === 'block') { hideSubpages(); return; }
      var activeTab = document.querySelector('.tab-content.active');
      if (activeTab && activeTab.id === 'tabSettings') {
        Array.from(navItems).forEach(function(item) { item.classList.remove('active'); });
        document.querySelector('[data-tab="tabCalc"]').classList.add('active');
        Array.from(tabContents).forEach(function(tab) { tab.classList.remove('active'); });
        document.getElementById('tabCalc').classList.add('active');
        return;
      }
      App.exitApp();
    });
  }
});
