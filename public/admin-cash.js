window.renderCashTab = async function() {
    try {
        const txs = await adminApi('GET', '/api/admin/cash-transactions');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand" style="color:var(--neon-green)">💸 KASA YÖNETİMİ</h2>
                <div style="display:flex; gap:10px;">
                    <button id="btn-bulk-delete" class="btn btn-danger" style="display:none; background:rgba(255,51,102,0.2); border-color:var(--neon-red);" onclick="bulkDeleteCash()">🗑️ SEÇİLENLERİ SİL</button>
                    <button class="btn btn-primary" onclick="openCashModal()">+ YENİ İŞLEM EKLE</button>
                </div>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:40px;"><input type="checkbox" id="select-all-cash" onclick="toggleSelectAllCash(this)"></th>
                            <th>TARİH</th>
                            <th>İŞLEM TİPİ</th>
                            <th>CARİ HESAP</th>
                            <th>HESAP/KASA</th>
                            <th>TUTAR</th>
                            <th>İŞLEM</th>
                        </tr>
                    </thead>
                    <tbody id="cash-table-body">
        `;
        
        txs.forEach(t => {
            const isTahsilat = t.type === 'TAHSILAT';
            html += `
                <tr data-id="${t.id}">
                    <td><input type="checkbox" class="cash-row-check" onclick="updateBulkDeleteBtn()"></td>
                    <td>${new Date(t.date).toLocaleDateString('tr-TR')}</td>
                    <td>
                        <span class="badge ${isTahsilat ? 'badge-success' : 'badge-danger'}">
                            ${isTahsilat ? 'TAHSİLAT' : 'ÖDEME'}
                        </span>
                    </td>
                    <td title="${t.cariCode}">${t.companyName || t.cariCode}</td>
                    <td>${(t.accountType || "").replace('_', ' ')}</td>
                    <td style="color:${isTahsilat ? 'var(--neon-green)' : 'var(--neon-pink)'}; font-weight:bold;">
                        ${isTahsilat ? '+' : '-'}${parseFloat(t.amount).toLocaleString('tr-TR')} TL
                    </td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-icon" onclick="viewCashDetails('${t.id}')" title="Detay">🔍</button>
                            <button class="btn-icon" onclick="openCashModal('${t.id}')" title="Düzenle">✏️</button>
                            <button class="btn-icon" onclick="deleteCashTransaction('${t.id}')" title="Sil" style="color:var(--neon-red)">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.toggleSelectAllCash = function(el) {
    const checks = document.querySelectorAll('.cash-row-check');
    checks.forEach(c => c.checked = el.checked);
    updateBulkDeleteBtn();
}

window.updateBulkDeleteBtn = function() {
    const selectedCount = document.querySelectorAll('.cash-row-check:checked').length;
    const btn = document.getElementById('btn-bulk-delete');
    if(btn) {
        btn.style.display = selectedCount > 0 ? 'block' : 'none';
        btn.textContent = `🗑️ SEÇİLENLERİ SİL (${selectedCount})`;
    }
}

window.bulkDeleteCash = function() {
    const selected = Array.from(document.querySelectorAll('.cash-row-check:checked')).map(cb => cb.closest('tr').getAttribute('data-id'));
    if(selected.length === 0) return;

    window.showConfirm(`${selected.length} adet işlemi silmek istediğinize emin misiniz?`, async () => {
        try {
            for(const id of selected) {
                await adminApi('DELETE', `/api/admin/cash-transactions/${id}`);
            }
            showToast(`${selected.length} işlem başarıyla silindi`);
            renderCashTab();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

window.openCashModal = async function(cashId = null) {
    try {
        const [methods, companies] = await Promise.all([
            adminApi('GET', '/api/payment-methods'),
            adminApi('GET', '/api/companies')
        ]);
        
        let tx = { type: 'TAHSILAT', cariCode: '', amount: '', accountType: 'KASA', date: new Date().toISOString().split('T')[0], notes: '', receiptCode: '' };
        if (cashId) {
            const all = await adminApi('GET', '/api/admin/cash-transactions');
            tx = all.find(t => t.id === cashId);
        }

        window.resetModalBtn('💾 KAYDET', 'btn btn-premium-save', true);
        document.getElementById('modal-title').textContent = cashId ? 'Kasa İşlemi Düzenle' : '➕ YENİ KASA İŞLEMİ';
        
        let html = `
            <div class="form-group">
                <label>İşlem Tipi *</label>
                <select id="m-cash-type" class="form-control" style="width:100%;">
                    <option value="TAHSILAT" ${tx.type === 'TAHSILAT' ? 'selected' : ''}>TAHSİLAT (Giriş)</option>
                    <option value="ODEME" ${tx.type === 'ODEME' ? 'selected' : ''}>ÖDEME (Çıkış)</option>
                </select>
            </div>
            <div class="form-group">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label>Ödeme Yöntemi / Kasa *</label>
                    <a href="javascript:void(0)" onclick="managePaymentMethods()" style="font-size:0.75em; color:var(--neon-cyan); text-decoration:none;">⚙️ Hesapları Yönet</a>
                </div>
                <select id="m-cash-account" class="form-control" style="width:100%;">
                    ${methods.map(m => `<option value="${m.name}" ${tx.accountType === m.name ? 'selected' : ''}>${m.name} (${m.type})</option>`).join('')}
                </select>
            </div>
            <div class="form-group full-width" style="position:relative;">
                <label>Cari Hesap Seçimi *</label>
                <input type="text" id="m-cash-cari-display" class="form-control" placeholder="Cari adını veya kodunu yazmaya başlayın..." value="${tx.cariCode}" autocomplete="off">
                <input type="hidden" id="m-cash-cari-code" value="${tx.cariCode}">
                <div id="m-cash-cari-results" class="search-results"></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px;" class="full-width">
                <div class="form-group">
                    <label>Tutar (TL) *</label>
                    <input type="number" id="m-cash-amount" class="form-control" value="${tx.amount}" placeholder="0.00" style="font-size:1.1em; font-weight:bold; color:var(--neon-green);">
                </div>
                <div class="form-group">
                    <label>İşlem Tarihi</label>
                    <input type="date" id="m-cash-date" class="form-control" value="${tx.date ? new Date(tx.date).toISOString().split('T')[0] : ''}">
                </div>
                <div class="form-group">
                    <label>Fiş / Evrak No</label>
                    <input type="text" id="m-cash-receipt" class="form-control" value="${tx.receiptCode || ''}" placeholder="Fiş No">
                </div>
            </div>
            <div class="form-group full-width">
                <label>Not / Açıklama</label>
                <textarea id="m-cash-notes" class="form-control" rows="3" placeholder="Açıklama...">${tx.notes || ''}</textarea>
            </div>
            <input type="hidden" id="m-cash-id" value="${cashId || ''}">
        `;

        document.getElementById('modal-body').innerHTML = html;

        // Cari Arama Mantığı
        const cariInput = document.getElementById('m-cash-cari-display');
        const cariCodeInput = document.getElementById('m-cash-cari-code');
        const cariResults = document.getElementById('m-cash-cari-results');

        cariInput.oninput = () => {
            const q = cariInput.value.toLocaleLowerCase('tr');
            if(q.length < 1) { cariResults.classList.remove('active'); return; }
            const filtered = companies.filter(c => (c.ad || '').toLocaleLowerCase('tr').includes(q) || (c.cariKod || '').toLocaleLowerCase('tr').includes(q)).slice(0, 10);
            
            if(filtered.length > 0) {
                cariResults.innerHTML = filtered.map(c => `
                    <div class="search-item" onclick="selectCashCari('${c.cariKod}', '${c.ad.replace(/'/g, "\\'")}')">
                        <div class="search-avatar">${(c.ad || '?')[0].toUpperCase()}</div>
                        <div class="search-info">
                            <b>${c.ad}</b>
                            <div class="search-details">
                                <div class="detail-group"><span class="detail-label">Kod:</span><span class="detail-value value-cyan">${c.cariKod}</span></div>
                                <div class="detail-group"><span class="detail-label">Şehir:</span><span class="detail-value">${c.sehir || '-'}</span></div>
                            </div>
                        </div>
                    </div>
                `).join('');
                cariResults.classList.add('active');
            } else { cariResults.classList.remove('active'); }
        };

        window.selectCashCari = (code, name) => {
            cariCodeInput.value = code;
            cariInput.value = name;
            cariResults.classList.remove('active');
        };

        // Dışarı tıklayınca kapat
        document.addEventListener('click', (e) => {
            if(!e.target.closest('.form-group')) cariResults.classList.remove('active');
        }, { once: true });

        document.getElementById('modal-save-btn').onclick = saveCashTransaction;
        openModal();
    } catch(e) { console.error(e); showToast('Hata: ' + e.message, 'error'); }
}

async function saveCashTransaction() {
    const cashId = document.getElementById('m-cash-id').value;
    const data = {
        type: document.getElementById('m-cash-type').value,
        cariCode: document.getElementById('m-cash-cari-code').value,
        accountType: document.getElementById('m-cash-account').value,
        amount: parseFloat(document.getElementById('m-cash-amount').value),
        receiptCode: document.getElementById('m-cash-receipt').value,
        date: document.getElementById('m-cash-date').value,
        notes: document.getElementById('m-cash-notes').value
    };

    if (!data.cariCode || !data.amount) return showToast('Lütfen zorunlu alanları doldurun', 'error');

    try {
        if (cashId) {
            await adminApi('PUT', `/api/admin/cash-transactions/${cashId}`, data);
            showToast('İşlem güncellendi');
        } else {
            await adminApi('POST', '/api/admin/cash-transactions', data);
            showToast('İşlem kaydedildi');
        }
        closeModal();
        renderCashTab();
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteCashTransaction = async function(id) {
    window.showConfirm('Bu kasa işlemi silinsin mi? (Cari bakiye geri alınacaktır)', async () => {
        try {
            await adminApi('DELETE', `/api/admin/cash-transactions/${id}`);
            showToast('İşlem silindi');
            renderCashTab();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

window.viewCashDetails = async function(cashId) {
    try {
        const txs = await adminApi('GET', '/api/admin/cash-transactions');
        const tx = txs.find(t => t.id === cashId);
        if (!tx) throw new Error('İşlem kaydı bulunamadı');

        window.resetModalBtn('', '', false);
        document.getElementById('modal-title').textContent = 'Kasa İşlem Detayı';
        document.getElementById('modal-body').innerHTML = `
            <div class="full-width glass-card" style="padding:20px; border-color:${tx.type==='TAHSILAT'?'var(--neon-green)':'var(--neon-pink)'}">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div>
                        <label style="opacity:0.6; font-size:0.8em;">İŞLEM TİPİ</label>
                        <div style="font-weight:bold; color:${tx.type==='TAHSILAT'?'var(--neon-green)':'var(--neon-pink)'}">${tx.type}</div>
                    </div>
                    <div>
                        <label style="opacity:0.6; font-size:0.8em;">İŞLEM TARİHİ</label>
                        <div style="font-weight:bold;">${new Date(tx.date).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div>
                        <label style="opacity:0.6; font-size:0.8em;">CARİ HESAP</label>
                        <div style="font-weight:bold; color:var(--neon-cyan)">${tx.cariCode}</div>
                    </div>
                    <div>
                        <label style="opacity:0.6; font-size:0.8em;">HESAP / KASA</label>
                        <div style="font-weight:bold;">${(tx.accountType || "").replace('_', ' ')}</div>
                    </div>
                    <div>
                        <label style="opacity:0.6; font-size:0.8em;">FİŞ NO</label>
                        <div style="font-weight:bold;">${tx.receiptCode || '-'}</div>
                    </div>
                    <div>
                        <label style="opacity:0.6; font-size:0.8em;">TUTAR</label>
                        <div style="font-size:1.4em; font-weight:bold; color:${tx.type==='TAHSILAT'?'var(--neon-green)':'var(--neon-pink)'}">${parseFloat(tx.amount).toFixed(2)} TL</div>
                    </div>
                </div>
                <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.05); padding-top:15px;">
                    <label style="opacity:0.6; font-size:0.8em;">NOT / AÇIKLAMA</label>
                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-top:5px; min-height:40px;">${tx.notes || 'Açıklama yok.'}</div>
                </div>
            </div>
        `;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}
