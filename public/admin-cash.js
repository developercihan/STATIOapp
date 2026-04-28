window.renderCashTab = async function() {
    try {
        const txs = await adminApi('GET', '/api/admin/cash-transactions');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand" style="color:var(--neon-green)">💸 KASA YÖNETİMİ</h2>
                <button class="btn btn-primary" onclick="openCashModal()">+ YENİ İŞLEM EKLE</button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>TARİH</th>
                            <th>FİŞ NO</th>
                            <th>İŞLEM TİPİ</th>
                            <th>CARİ HESAP</th>
                            <th>HESAP/KASA</th>
                            <th>TUTAR</th>
                            <th>İŞLEM</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        txs.forEach(t => {
            const isTahsilat = t.type === 'TAHSILAT';
            html += `
                <tr>
                    <td>${new Date(t.date).toLocaleDateString('tr-TR')}</td>
                    <td style="color:var(--neon-cyan)">${t.receiptCode || '-'}</td>
                    <td>
                        <span class="badge ${isTahsilat ? 'badge-success' : 'badge-danger'}">
                            ${isTahsilat ? 'TAHSİLAT' : 'ÖDEME'}
                        </span>
                    </td>
                    <td title="${t.cariCode}">${t.companyName}</td>
                    <td>${t.accountType.replace('_', ' ')}</td>
                    <td style="color:${isTahsilat ? 'var(--neon-green)' : 'var(--neon-pink)'}; font-weight:bold;">
                        ${isTahsilat ? '+' : '-'}${parseFloat(t.amount).toFixed(2)} TL
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

window.openCashModal = async function(cashId = null) {
    window.resetModalBtn();
    document.getElementById('modal-title').textContent = cashId ? 'Kasa İşlemini Düzenle' : 'Yeni Kasa İşlemi';
    
    // Tüm Kurumları çek
    const companies = await adminApi('GET', '/api/companies');
    
    let tx = null;
    if (cashId) {
        const txs = await adminApi('GET', '/api/admin/cash-transactions');
        tx = txs.find(t => t.id === cashId);
    }

    document.getElementById('modal-body').innerHTML = `
        <style>
            #m-cash-date::-webkit-calendar-picker-indicator {
                filter: invert(1); cursor: pointer; opacity: 0.7;
            }
            .cash-grid-3 { display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 15px; }
            @media (max-width: 600px) { .cash-grid-3 { grid-template-columns: 1fr; } }
        </style>
        <input type="hidden" id="m-cash-id" value="${cashId || ''}">
        
        <div class="form-group">
            <label>İşlem Tipi *</label>
            <select id="m-cash-type" style="width:100%;" required>
                <option value="TAHSILAT" ${tx && tx.type==='TAHSILAT'?'selected':''}>TAHSİLAT (Giriş)</option>
                <option value="ODEME" ${tx && tx.type==='ODEME'?'selected':''}>ÖDEME (Çıkış)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Ödeme Yöntemi / Kasa *</label>
            <select id="m-cash-account" style="width:100%;" required>
                <option value="NAKIT" ${tx && tx.accountType==='NAKIT'?'selected':''}>NAKİT KASA</option>
                <option value="BANKA" ${tx && tx.accountType==='BANKA'?'selected':''}>BANKA HESABI</option>
                <option value="KREDI_KARTI" ${tx && tx.accountType==='KREDI_KARTI'?'selected':''}>KREDİ KARTI</option>
            </select>
        </div>

        <div class="form-group full-width">
            <label>Cari Hesap Seçimi *</label>
            <input type="text" id="m-cash-cari-search" value="${tx ? tx.cariCode : ''}" style="width:100%; font-size:1.1em;" placeholder="Cari adını veya kodunu yazmaya başlayın..." list="cari-list" required autocomplete="off">
            <datalist id="cari-list">
                ${companies.map(c => `<option value="${c.cariKod}">${c.ad} [${c.cariKod}]</option>`).join('')}
            </datalist>
        </div>

        <div class="full-width cash-grid-3">
            <div class="form-group">
                <label>Tutar (TL) *</label>
                <input type="number" id="m-cash-amount" step="0.01" min="0.01" value="${tx ? tx.amount : ''}" placeholder="0.00" required>
            </div>
            <div class="form-group">
                <label>İşlem Tarihi</label>
                <input type="date" id="m-cash-date" value="${tx ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0]}" style="width:100%;">
            </div>
            <div class="form-group">
                <label>Fiş / Evrak No</label>
                <input type="text" id="m-cash-receipt" value="${tx ? tx.receiptCode : ''}" placeholder="Fiş No">
            </div>
        </div>

        <div class="form-group full-width">
            <label>Not / Açıklama</label>
            <textarea id="m-cash-notes" placeholder="Açıklama..." style="width:100%; height:80px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid var(--glass-border); border-radius:8px; padding:10px;">${tx ? tx.notes : ''}</textarea>
        </div>
    `;
    
    document.getElementById('modal-save-btn').onclick = saveCashTransaction;
    document.getElementById('admin-modal').classList.add('active');
}

async function saveCashTransaction() {
    const cashId = document.getElementById('m-cash-id').value;
    const data = {
        type: document.getElementById('m-cash-type').value,
        cariCode: document.getElementById('m-cash-cari-search').value,
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

        window.resetModalBtn('KAPAT', 'btn', true);
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
                        <div style="font-weight:bold;">${tx.accountType.replace('_', ' ')}</div>
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
        document.getElementById('modal-save-btn').onclick = closeModal;
        document.getElementById('admin-modal').classList.add('active');
    } catch(e) { showToast(e.message, 'error'); }
}
