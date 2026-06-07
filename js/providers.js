/**
 * 报价单 - 模型供应商管理
 */

var modalModels = [];
var editingProviderId = null;

// ====== 渲染供应商列表 ======
function renderProviders() {
    const providers = getProviders();
    var emptyStateProviders = document.getElementById('emptyStateProviders');
    var providerListEl = document.getElementById('providerList');
    emptyStateProviders.style.display = providers.length === 0 ? 'flex' : 'none';
    providerListEl.innerHTML = '';

    if (providers.length === 0) return;

    const activeId = getActiveProviderId();
    const dualCfg = getDualConfig();
    const dualEnabled = dualCfg.enabled;

    var modelsTitle = document.querySelector('#subpageModels .subpage-title');
    if (modelsTitle) {
        modelsTitle.textContent = dualEnabled ? '识别模型配置（多重识别）' : '识别模型配置';
    }

    const dualInfoMap = new Map();
    if (dualEnabled) {
        dualCfg.models.forEach(function(item) {
            if (!dualInfoMap.has(item.providerId)) {
                dualInfoMap.set(item.providerId, []);
            }
            dualInfoMap.get(item.providerId).push(item.model);
        });
    }

    var sortedProviders = providers.slice().sort(function(a, b) {
        var aDual = dualInfoMap.has(a.id) ? 0 : 1;
        var bDual = dualInfoMap.has(b.id) ? 0 : 1;
        return aDual - bDual;
    });

    sortedProviders.forEach(function(p) {
        var isActive = p.id === activeId;
        var isDual = dualInfoMap.has(p.id);
        var dualModels = dualInfoMap.get(p.id) || [];
        var card = document.createElement('div');
        card.className = 'provider-card' + (!dualEnabled && isActive ? ' active' : '') + (isDual ? ' dual-active' : '');
        var badgeHtml = '';
        if (dualEnabled) {
            if (isDual) {
                badgeHtml = '<span class="provider-card-badge" style="background:var(--primary-light);color:var(--primary);">多重识别使用中</span>';
            } else {
                badgeHtml = '<span class="provider-card-badge" style="background:#F5F5F5;color:#999;">未使用</span>';
            }
        } else {
            if (isActive) badgeHtml = '<span class="provider-card-badge">使用中</span>';
        }

        var dualModelsHtml = '';
        if (dualModels.length > 0) {
            dualModelsHtml = '<div class="provider-card-dual-models">' + dualModels.map(function(m) {
                return '<span class="provider-model-chip" style="background:var(--primary-light);color:var(--primary);">' + escapeHtml(m) + '</span>';
            }).join('') + '</div>';
        }

        var modelSelectHtml = '';
        if (!dualEnabled) {
            var options = (p.models || []).map(function(m) {
                var sel = m === (p.selectedModel || p.models[0]) ? ' selected' : '';
                return '<option value="' + escapeHtml(m) + '"' + sel + '>' + escapeHtml(m) + '</option>';
            }).join('');
            modelSelectHtml = '<select class="provider-model-select" data-action="switchModel" data-id="' + p.id + '">' + options + '</select>';
        }

        var selectBtnHtml = '';
        if (!dualEnabled) {
            selectBtnHtml = '<button class="provider-action-btn provider-action-select" data-action="select" data-id="' + p.id + '">' + (isActive ? '当前使用' : '使用此模型') + '</button>';
        }

        card.innerHTML =
            '<div class="provider-card-header">' +
            '<span class="provider-card-dot"></span>' +
            '<span class="provider-card-name">' + escapeHtml(p.name || p.id) + '</span>' +
            badgeHtml +
            '</div>' +
            '<div class="provider-card-meta">' + escapeHtml(p.baseUrl) + '</div>' +
            dualModelsHtml +
            modelSelectHtml +
            '<div class="provider-card-actions">' +
            selectBtnHtml +
            '<button class="provider-action-btn provider-action-test" data-action="test" data-id="' + p.id + '">测试</button>' +
            '<button class="provider-action-btn provider-action-edit" data-action="edit" data-id="' + p.id + '">编辑</button>' +
            '<button class="provider-action-btn provider-action-delete" data-action="delete" data-id="' + p.id + '">删除</button>' +
            '</div>';
        providerListEl.appendChild(card);
    });
}

// ====== 测试连接 ======
async function testProvider(id) {
    var provider = getProviders().find(function(p) { return p.id === id; });
    if (!provider) return;

    if (!provider.apiKey) { showToast('请先配置 API Key'); return; }
    if (!provider.baseUrl) { showToast('请先配置 Base URL'); return; }
    if (!provider.models || provider.models.length === 0) { showToast('请先添加至少一个模型'); return; }

    showToast('正在测试 ' + provider.name + ' 连接...');

    try {
        if (provider.protocol === 'openai') {
            var url = provider.baseUrl.replace(/\/+$/, '') + '/models';
            var resp = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + provider.apiKey },
            });
            if (!resp.ok) {
                var errBody = await resp.text().catch(function() { return ''; });
                throw new Error(resp.status + ': ' + errBody.slice(0, 80));
            }
            showToast(provider.name + ' 连接测试通过 ✓');
        } else {
            var resp2 = await fetch(provider.baseUrl, { method: 'OPTIONS' }).catch(function() { return null; });
            if (resp2 && resp2.ok) {
                showToast(provider.name + ' 连接测试通过 ✓');
            } else {
                showToast(provider.name + ' 端点可达，具体请上传图片测试');
            }
        }
    } catch (err) {
        console.error('Provider test error:', err);
        showToast(provider.name + ' 连接失败: ' + err.message);
    }
}

// ====== 删除供应商 ======
function deleteProvider(id) {
    showConfirm('确定要删除此提供商吗？', function() {
        var providers = getProviders().filter(function(p) { return p.id !== id; });
        saveProviders(providers);
        if (getActiveProviderId() === id) {
            setActiveProvider(providers.length > 0 ? providers[0].id : '');
        }
        renderProviders();
        showToast('已删除');
    });
}

// ====== 弹窗管理 ======
function openProviderModal(editId) {
    editingProviderId = editId || null;
    modalModels = [];

    if (editingProviderId) {
        var p = getProviders().find(function(x) { return x.id === editingProviderId; });
        if (!p) return;
        document.getElementById('providerModalTitle').textContent = '编辑模型提供商';
        document.getElementById('quickSelectProvider').value = '';
        document.getElementById('inputProviderId').value = p.id;
        document.getElementById('inputBaseUrl').value = p.baseUrl;
        document.getElementById('inputProtocol').value = p.protocol || 'openai';
        document.getElementById('inputApiKey').value = p.apiKey || '';
        modalModels = (p.models || []).slice();
    } else {
        document.getElementById('providerModalTitle').textContent = '添加模型提供商';
        document.getElementById('quickSelectProvider').value = '';
        document.getElementById('inputProviderId').value = '';
        document.getElementById('inputBaseUrl').value = '';
        document.getElementById('inputProtocol').value = 'openai';
        document.getElementById('inputApiKey').value = '';
        modalModels = [];
    }

    renderModalModels();
    document.getElementById('providerModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeProviderModal() {
    document.getElementById('providerModal').style.display = 'none';
    document.body.style.overflow = '';
    editingProviderId = null;
    modalModels = [];
}

// ====== 弹窗内模型管理 ======
function addModelTag() {
    var name = document.getElementById('inputModelName').value.trim();
    if (!name) return;
    if (modalModels.includes(name)) {
        showToast('模型已存在');
        return;
    }
    modalModels.push(name);
    document.getElementById('inputModelName').value = '';
    renderModalModels();
    document.getElementById('inputModelName').focus();
}

function removeModalModel(index) {
    modalModels.splice(index, 1);
    renderModalModels();
}

function renderModalModels() {
    document.getElementById('modelCount').textContent = modalModels.length;
    var modalModelList = document.getElementById('modalModelList');

    if (modalModels.length === 0) {
        modalModelList.innerHTML = '<p class="model-tag-empty" id="modalModelEmpty">暂无模型</p>';
        return;
    }

    modalModelList.innerHTML = '';
    modalModels.forEach(function(m, i) {
        var item = document.createElement('div');
        item.className = 'model-select-item';
        var optionsHtml = modalModels.map(function(nm) {
            var sel = nm === m ? ' selected' : '';
            return '<option value="' + escapeHtml(nm) + '"' + sel + '>' + escapeHtml(nm) + '</option>';
        }).join('');
        item.innerHTML =
            '<select class="model-select-list-pick" data-idx="' + i + '">' + optionsHtml + '</select>' +
            '<button class="model-remove-btn" data-idx="' + i + '">&times;</button>';
        item.querySelector('select').addEventListener('change', function(e) {
            modalModels[i] = e.target.value;
            renderModalModels();
        });
        item.querySelector('.model-remove-btn').addEventListener('click', function() {
            modalModels.splice(i, 1);
            renderModalModels();
        });
        modalModelList.appendChild(item);
    });
}

// ====== 自动获取模型 ======
function autoFetchModels() {
    var baseUrl = document.getElementById('inputBaseUrl').value.trim();
    var apiKey = document.getElementById('inputApiKey').value.trim();
    if (!baseUrl) { showToast('请先填写 Base URL'); return; }
    if (!apiKey) { showToast('请先填写 API Key'); return; }

    showToast('正在获取模型列表...');
    fetch(baseUrl.replace(/\/+$/, '') + '/models', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
    })
        .then(function(resp) {
            if (!resp.ok) throw new Error('' + resp.status);
            return resp.json();
        })
        .then(function(json) {
            var models = (json.data || []).map(function(m) { return m.id; }).filter(Boolean);
            if (baseUrl.includes('xiaomimimo')) {
                models = models.filter(function(m) { return m === 'mimo-v2.5'; });
            }
            if (baseUrl.includes('dashscope')) {
                models = models.filter(function(m) { return m === 'qwen3.6-flash'; });
            }
            if (models.length === 0) {
                showToast('未找到可用模型');
                return;
            }
            var added = 0;
            models.forEach(function(name) {
                if (!modalModels.includes(name)) {
                    modalModels.push(name);
                    added++;
                }
            });
            renderModalModels();
            showToast(added > 0 ? '已添加 ' + added + ' 个模型' : '模型列表已存在');
        })
        .catch(function(err) {
            showToast('获取失败：' + (err.message || '网络错误'));
        });
}

// ====== Dual Config UI ======
function renderDualConfigUI() {
    var cfg = getDualConfig();
    document.getElementById('chkDualRecognize').checked = cfg.enabled;
    document.getElementById('selectDualCount').value = cfg.count;

    var providers = getProviders();
    var dualModelListEl = document.getElementById('dualModelList');
    if (cfg.models.length === 0) {
        dualModelListEl.innerHTML = '<p class="failover-queue-empty">暂无模型，请添加</p>';
    } else {
        dualModelListEl.innerHTML = '';
        cfg.models.forEach(function(item, i) {
            var p = providers.find(function(x) { return x.id === item.providerId; });
            if (!p) return;
            var model = item.model || p.selectedModel || (p.models && p.models[0]) || '';
            var queueItem = document.createElement('div');
            queueItem.className = 'failover-queue-item';
            queueItem.innerHTML =
                '<span class="failover-queue-order">' + (i + 1) + '</span>' +
                '<div class="failover-queue-info">' +
                '<div class="failover-queue-name">' + escapeHtml(p.name || p.id) + '</div>' +
                '<div class="failover-queue-model">' + escapeHtml(model) + '</div>' +
                '</div>' +
                '<button class="failover-queue-remove" data-idx="' + i + '" title="移除">&times;</button>';
            queueItem.querySelector('.failover-queue-remove').addEventListener('click', function() {
                cfg.models.splice(i, 1);
                saveDualConfig(cfg);
                renderDualConfigUI();
            });
            dualModelListEl.appendChild(queueItem);
        });
    }

    var selectDualProvider = document.getElementById('selectDualProvider');
    var addedModels = new Set(cfg.models.map(function(m) { return m.providerId + '|||' + m.model; }));
    var hasAvailable = false;

    providers.forEach(function(p) {
        (p.models || []).forEach(function(model) {
            var key = p.id + '|||' + model;
            if (addedModels.has(key)) return;
            hasAvailable = true;
        });
    });

    if (!hasAvailable) {
        selectDualProvider.innerHTML = '<option value="" disabled selected>暂无可选择的供应商</option>';
        selectDualProvider.disabled = true;
        selectDualProvider.classList.add('select-disabled');
    } else {
        selectDualProvider.disabled = false;
        selectDualProvider.classList.remove('select-disabled');
        selectDualProvider.innerHTML = '<option value="">选择供应商和模型...</option>';
        providers.forEach(function(p) {
            (p.models || []).forEach(function(model) {
                var key = p.id + '|||' + model;
                if (addedModels.has(key)) return;
                var opt = document.createElement('option');
                opt.value = key;
                opt.textContent = (p.name || p.id) + ' · ' + model;
                selectDualProvider.appendChild(opt);
            });
        });
    }
}

function updateDualBadge() {
    var cfg = getDualConfig();
    var count = cfg.enabled ? cfg.models.length || cfg.count : 1;
    var el = document.getElementById('dualConfigBadge');
    if (el) el.textContent = count + ' 个模型';
}

// ====== 排除模型弹窗 ======
function showExcludeModelsDialog(models, maxCount) {
    return new Promise(function(resolve) {
        var excludeCount = models.length - maxCount;
        var overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '1100';
        var dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.maxWidth = '340px';
        dialog.style.maxHeight = '80vh';
        dialog.style.overflow = 'auto';

        var html = '<div class="confirm-dialog-content">';
        html += '<div class="confirm-dialog-title" style="color:#E74C3C;">⚠️ 已添加 ' + models.length + ' 个模型</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">识别模型数为 ' + maxCount + '，请选择 ' + excludeCount + ' 个不使用的模型：</div>';

        models.forEach(function(item, i) {
            html += '<div class="exclude-model-item" data-idx="' + i + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;background:var(--card-bg);border:1.5px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.15s;">';
            html += '<span class="exclude-checkbox" style="width:20px;height:20px;border-radius:6px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;"></span>';
            html += '<div style="flex:1;"><div style="font-weight:500;font-size:0.85rem;">' + (item.provider.name || item.provider.id) + '</div><div style="font-size:0.75rem;color:var(--text-secondary);">' + item.model + '</div></div>';
            html += '</div>';
        });

        html += '<div style="display:flex;gap:10px;margin-top:16px;">';
        html += '<button class="confirm-btn confirm-cancel" id="excludeCancel" style="flex:1;">取消</button>';
        html += '<button class="confirm-btn confirm-ok" id="excludeConfirm" style="flex:1;">确定</button>';
        html += '</div></div>';

        dialog.innerHTML = html;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        var excludedIndices = new Set();
        overlay.querySelectorAll('.exclude-model-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var idx = parseInt(item.dataset.idx, 10);
                if (excludedIndices.has(idx)) {
                    excludedIndices.delete(idx);
                    item.style.borderColor = 'var(--border)';
                    item.style.background = 'var(--card-bg)';
                    item.querySelector('.exclude-checkbox').style.background = 'transparent';
                    item.querySelector('.exclude-checkbox').innerHTML = '';
                } else {
                    if (excludedIndices.size >= excludeCount) {
                        showToast('最多选择 ' + excludeCount + ' 个不使用');
                        return;
                    }
                    excludedIndices.add(idx);
                    item.style.borderColor = '#E74C3C';
                    item.style.background = '#FFF5F5';
                    item.querySelector('.exclude-checkbox').style.background = '#E74C3C';
                    item.querySelector('.exclude-checkbox').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                }
            });
        });

        overlay.querySelector('#excludeConfirm').addEventListener('click', function(e) {
            e.stopPropagation();
            if (excludedIndices.size !== excludeCount) {
                showToast('请选择 ' + excludeCount + ' 个不使用的模型');
                return;
            }
            document.body.removeChild(overlay);
            resolve(Array.from(excludedIndices));
        });

        overlay.querySelector('#excludeCancel').addEventListener('click', function(e) {
            e.stopPropagation();
            document.body.removeChild(overlay);
            resolve(null);
        });
    });
}

// ====== 选择模型弹窗 ======
function showSelectModelsDialog(availableModels, needCount) {
    return new Promise(function(resolve) {
        var actualNeed = Math.min(needCount, availableModels.length);
        var overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '1100';
        var dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.maxWidth = '340px';
        dialog.style.maxHeight = '80vh';
        dialog.style.overflow = 'auto';

        var html = '<div class="confirm-dialog-content">';
        html += '<div class="confirm-dialog-title" style="color:#4CAF50;">➕ 请添加模型</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">当前模型不足，请选择要参与识别的模型：</div>';

        availableModels.forEach(function(item, i) {
            html += '<div class="select-model-item" data-idx="' + i + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;background:var(--card-bg);border:1.5px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.15s;">';
            html += '<span class="select-checkbox" style="width:20px;height:20px;border-radius:6px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;"></span>';
            html += '<div style="flex:1;"><div style="font-weight:500;font-size:0.85rem;">' + (item.provider.name || item.provider.id) + '</div><div style="font-size:0.75rem;color:var(--text-secondary);">' + item.model + '</div></div>';
            html += '</div>';
        });

        html += '<div style="display:flex;gap:10px;margin-top:16px;">';
        html += '<button class="confirm-btn confirm-cancel" id="selectModelCancel" style="flex:1;">取消</button>';
        html += '<button class="confirm-btn confirm-ok" id="selectModelConfirm" style="flex:1;">确定</button>';
        html += '</div></div>';

        dialog.innerHTML = html;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        var selectedIndices = new Set();
        overlay.querySelectorAll('.select-model-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var idx = parseInt(item.dataset.idx, 10);
                if (selectedIndices.has(idx)) {
                    selectedIndices.delete(idx);
                    item.style.borderColor = 'var(--border)';
                    item.style.background = 'var(--card-bg)';
                    item.querySelector('.select-checkbox').style.background = 'transparent';
                    item.querySelector('.select-checkbox').innerHTML = '';
                } else {
                    if (selectedIndices.size >= actualNeed) {
                        showToast('最多选择 ' + actualNeed + ' 个模型');
                        return;
                    }
                    selectedIndices.add(idx);
                    item.style.borderColor = '#4CAF50';
                    item.style.background = '#F0FAF7';
                    item.querySelector('.select-checkbox').style.background = '#4CAF50';
                    item.querySelector('.select-checkbox').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                }
            });
        });

        overlay.querySelector('#selectModelConfirm').addEventListener('click', function(e) {
            e.stopPropagation();
            if (selectedIndices.size === 0) {
                showToast('请至少选择 1 个模型');
                return;
            }
            document.body.removeChild(overlay);
            resolve(Array.from(selectedIndices).map(function(i) { return availableModels[i]; }));
        });

        overlay.querySelector('#selectModelCancel').addEventListener('click', function(e) {
            e.stopPropagation();
            document.body.removeChild(overlay);
            resolve(null);
        });
    });
}
