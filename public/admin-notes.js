window.renderNotesTab = async function() {
    try {
        const notes = await adminApi('GET', '/api/admin/notes');
        const companies = await adminApi('GET', '/api/companies');
        window._cachedCompanies = companies;
        
        let html = `
            <div class="action-bar">
                <h2 class="brand" style="color:var(--neon-blue)">📜 SENET & ÇEK KONTROL MERKEZİ</h2>
                <div style="display:flex; gap:10px;">
                    <button id="btn-bulk-notes-delete" class="btn btn-danger" style="display:none; background:rgba(255,51,102,0.2); border-color:var(--neon-red);" onclick="bulkDeleteNotes()">🗑️ SEÇİLENLERİ SİL</button>
                    <button class="btn btn-premium-save" onclick="openNoteModal()">+ Yeni Senet/Çek Girişi</button>
                </div>
            </div>

            <div class="glass-card" style="padding:0; overflow:hidden;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:40px;"><input type="checkbox" id="select-all-notes" onclick="toggleSelectAllNotes(this)"></th>
                            <th>SENET NO / VADE</th>
                            <th>YOLCULUK (KİMDEN ➔ NEREYE)</th>
                            <th>TUTAR</th>
                            <th>KONUM / DURUM (DEĞİŞTİRMEK İÇİN TIKLA)</th>
                            <th style="text-align:right;">İŞLEMLER</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        notes.forEach(n => {
            const status = n.paymentStatus || 'PORTFOY';
            let statusLabel = '📦 PORTFÖYDE';
            let statusColor = 'var(--neon-cyan)';
            let journeyHtml = `<span style="color:var(--neon-green)">${n.companyName}</span> ➔ <span style="color:var(--neon-cyan)">PORTFÖY</span>`;

            if (status === 'CIRO') {
                statusLabel = '🔄 CİRO EDİLDİ';
                statusColor = 'var(--neon-purple)';
                journeyHtml += ` ➔ <span style="color:var(--neon-purple)">${n.description?.replace('Ciro edildi: ', '') || 'Tedarikçi'}</span>`;
            } else if (status === 'BANKA') {
                statusLabel = '🏦 BANKADA';
                statusColor = 'var(--neon-blue)';
                journeyHtml += ` ➔ <span style="color:var(--neon-blue)">BANKA</span>`;
            } else if (status === 'ODENDI') {
                statusLabel = '✅ TAHSİL EDİLDİ';
                statusColor = 'var(--neon-green)';
                journeyHtml += ` ➔ <span style="color:var(--neon-green)">KASA/BANKA</span>`;
            } else if (status === 'IADE') {
                statusLabel = '❌ İADE EDİLDİ';
                statusColor = 'var(--neon-red)';
                journeyHtml += ` ➔ <span style="color:var(--neon-red)">İADE (CARİYE BORÇ)</span>`;
            }

            html += `
                <tr data-id="${n.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td><input type="checkbox" class="note-row-check" onclick="updateBulkNotesBtn()"></td>
                    <td>
                        <div style="font-weight:bold; color:var(--neon-cyan);">${n.noteNo || 'BELİRSİZ'}</div>
                        <div style="font-size:0.75em; opacity:0.6;">Vade: ${n.dueDate ? new Date(n.dueDate).toLocaleDateString('tr-TR') : '-'}</div>
                    </td>
                    <td style="font-size:0.9em;">${journeyHtml}</td>
                    <td style="font-weight:bold; font-size:1.1em;">${n.amount.toLocaleString('tr-TR')} ${n.currency}</td>
                    <td style="cursor:pointer;" onclick="openStatusChangeModal('${n.id}', '${status}', ${n.amount})">
                        <div class="status-pill" style="display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); padding:6px 12px; border-radius:20px; border:1px solid ${statusColor}44;">
                            <div style="width:8px; height:8px; border-radius:50%; background:${statusColor}; box-shadow:0 0 10px ${statusColor};"></div>
                            <b style="color:${statusColor}; font-size:0.85em;">${statusLabel}</b>
                            <small style="opacity:0.4; margin-left:5px;">▼</small>
                        </div>
                    </td>
                    <td style="text-align:right;">
                        <div style="display:flex; gap:8px; justify-content:flex-end;">
                            ${status === 'PORTFOY' ? `
                                <button class="btn btn-action" style="color:var(--neon-green); border-color:var(--neon-green);" onclick="openTahsilModal('${n.id}', ${n.amount})">💰 TAHSİL ET</button>
                                <button class="btn btn-action" style="color:var(--neon-purple); border-color:var(--neon-purple); padding:4px 8px;" onclick="openCiroModal('${n.id}', ${n.amount})">🔄 CİRO ET</button>
                            ` : ''}
                            <button class="btn btn-action" style="color:var(--neon-cyan); border-color:var(--neon-cyan); padding:4px 8px;" onclick="openNoteModal('${n.id}')">✏️ DÜZENLE</button>
                            <button class="btn btn-action btn-danger" style="padding:4px 8px;" onclick="deleteNote('${n.id}')">🗑️ SİL</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        if (notes.length === 0) html += `<tr><td colspan="5" style="text-align:center; padding:60px; opacity:0.5;">Senet veya çek kaydı bulunamadı.</td></tr>`;
        
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.toggleSelectAllNotes = function(el) {
    const checks = document.querySelectorAll('.note-row-check');
    checks.forEach(c => c.checked = el.checked);
    updateBulkNotesBtn();
}

window.updateBulkNotesBtn = function() {
    const selectedCount = document.querySelectorAll('.note-row-check:checked').length;
    const btn = document.getElementById('btn-bulk-notes-delete');
    if(btn) {
        btn.style.display = selectedCount > 0 ? 'block' : 'none';
        btn.textContent = `🗑️ SEÇİLENLERİ SİL (${selectedCount})`;
    }
}

window.bulkDeleteNotes = function() {
    const selected = Array.from(document.querySelectorAll('.note-row-check:checked')).map(cb => cb.closest('tr').getAttribute('data-id'));
    if(selected.length === 0) return;

    window.showConfirm(`${selected.length} adet senedi silmek istediğinize emin misiniz? (Cari bakiye düzeltmeleri de yapılacaktır!)`, async () => {
        try {
            for(const id of selected) {
                // Senedi bulup cari bilgisini alalım
                const notes = await adminApi('GET', '/api/admin/notes');
                const n = notes.find(x => x.id === id);
                if(n) {
                    await adminApi('POST', '/api/admin/cash-transactions', {
                        type: 'ODEME',
                        cariCode: n.companyCode,
                        amount: n.amount,
                        accountType: 'SENET/ÇEK',
                        notes: `TOPLU SİLME DÜZELTMESİ: ${n.noteNo} nolu senet silindi.`,
                        date: new Date().toISOString().split('T')[0]
                    });
                }
                await adminApi('DELETE', `/api/admin/notes/${id}`);
            }
            showToast(`${selected.length} senet başarıyla silindi ve cari bakiyeler düzeltildi.`);
            renderNotesTab();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

window.openStatusChangeModal = function(id, currentStatus, amount) {
    document.getElementById('modal-title').textContent = 'Senet Durumunu Güncelle';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
            <button class="btn" style="width:100%; padding:15px; text-align:left; border-color:var(--neon-cyan); display:flex; justify-content:space-between;" onclick="updateNoteStatusOnly('${id}', 'PORTFOY')">
                <span>📦 PORTFÖYDE (Bende Bekliyor)</span>
                ${currentStatus === 'PORTFOY' ? '✅' : ''}
            </button>
            <button class="btn" style="width:100%; padding:15px; text-align:left; border-color:var(--neon-blue); display:flex; justify-content:space-between;" onclick="updateNoteStatusOnly('${id}', 'BANKA')">
                <span>🏦 BANKADA (Tahsilata Verildi)</span>
                ${currentStatus === 'BANKA' ? '✅' : ''}
            </button>
            <button class="btn" style="width:100%; padding:15px; text-align:left; border-color:var(--neon-purple); display:flex; justify-content:space-between;" onclick="openCiroModal('${id}', ${amount})">
                <span>🔄 CİRO EDİLDİ (Birisine Ödeme Yapıldı)</span>
                ${currentStatus === 'CIRO' ? '✅' : ''}
            </button>
            <button class="btn" style="width:100%; padding:15px; text-align:left; border-color:var(--neon-red); display:flex; justify-content:space-between;" onclick="processReturn('${id}', ${amount})">
                <span>❌ İADE EDİLDİ (Karşılıksız / Borca Geri İşle)</span>
                ${currentStatus === 'IADE' ? '✅' : ''}
            </button>
        </div>
    `;
    window.resetModalBtn('', '', false);
    document.getElementById('admin-modal').classList.add('active');
}

async function updateNoteStatusOnly(id, newStatus) {
    try {
        await adminApi('PUT', `/api/admin/notes/${id}`, { paymentStatus: newStatus });
        closeModal(); renderNotesTab(); showToast('Durum güncellendi.');
    } catch(e) { showToast(e.message, 'error'); }
}

window.openNoteModal = async function(id = null) {
    const isEdit = !!id;
    document.getElementById('modal-title').textContent = isEdit ? 'Senet/Çek Bilgilerini Düzenle' : 'Yeni Senet Girişi';
    
    let note = { noteNo: '', dueDate: '', companyCode: '', companyName: '', amount: '', currency: 'TRY', description: '' };
    if (isEdit) {
        const notes = await adminApi('GET', '/api/admin/notes');
        note = notes.find(n => n.id === id);
    }

    document.getElementById('modal-body').innerHTML = `
        <div class="modal-body" style="grid-template-columns: 1fr 1fr; gap:15px;">
            <div class="form-group"><label>Senet No</label><input type="text" id="m-noteNo" value="${note.noteNo || ''}" placeholder="Örn: SN-001"></div>
            <div class="form-group"><label>Vade Tarihi</label><input type="date" id="m-dueDate" value="${note.dueDate ? new Date(note.dueDate).toISOString().split('T')[0] : ''}"></div>
            <div class="form-group full-width" style="position:relative;">
                <label>Müşteri (Arayın...)</label>
                <input type="text" id="m-comp-search" class="form-control" value="${note.companyName || ''}" placeholder="Müşteri adını yazın...">
                <div id="m-comp-results" class="glass-card" style="display:none; position:absolute; top:75px; left:0; width:100%; z-index:999; max-height:200px; overflow-y:auto; padding:5px; border-color:var(--neon-cyan);"></div>
                <input type="hidden" id="m-comp" value="${note.companyCode ? note.companyCode + '|' + note.companyName : ''}">
            </div>
            <div class="form-group"><label>Tutar</label><input type="number" id="m-amount" value="${note.amount || ''}" step="0.01"></div>
            <div class="form-group"><label>Para Birimi</label><input type="text" id="m-currency" value="${note.currency || 'TRY'}"></div>
            <div class="form-group full-width"><label>Açıklama</label><input type="text" id="m-desc" value="${note.description || ''}" placeholder="Ekstrede görünecek açıklama..."></div>
            <input type="hidden" id="m-note-id" value="${id || ''}">
        </div>
    `;

    const searchInput = document.getElementById('m-comp-search');
    const resultsDiv = document.getElementById('m-comp-results');
    const targetInput = document.getElementById('m-comp');
    const comps = window._cachedCompanies || [];

    searchInput.oninput = () => {
        const val = searchInput.value.toLowerCase();
        if(!val) { resultsDiv.style.display = 'none'; return; }
        const filtered = comps.filter(c => c.ad.toLowerCase().includes(val) || c.cariKod.toLowerCase().includes(val));
        if(filtered.length > 0) {
            resultsDiv.innerHTML = filtered.map(c => `
                <div class="search-result-item" style="padding:10px; cursor:pointer; border-radius:5px;" onclick="selectNoteComp('${c.cariKod}', '${c.ad}')">
                    <b style="color:var(--neon-cyan)">${c.ad}</b> <small style="opacity:0.6">(${c.cariKod})</small>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = '<div style="padding:10px; opacity:0.5;">Sonuç bulunamadı</div>';
            resultsDiv.style.display = 'block';
        }
    };

    window.selectNoteComp = (kod, ad) => {
        targetInput.value = `${kod}|${ad}`;
        searchInput.value = ad;
        resultsDiv.style.display = 'none';
    };

    window.resetModalBtn(isEdit ? '💾 GÜNCELLE' : '💾 KAYDET VE EKSTREYE İŞLE', 'btn btn-premium-save', true);
    document.getElementById('modal-save-btn').onclick = saveNote;
    document.getElementById('admin-modal').classList.add('active');
}

async function saveNote() {
    const id = document.getElementById('m-note-id').value;
    const compVal = document.getElementById('m-comp').value.split('|');
    const amount = parseFloat(document.getElementById('m-amount').value);
    const noteNo = document.getElementById('m-noteNo').value;
    const dueDate = document.getElementById('m-dueDate').value;
    const desc = document.getElementById('m-desc').value;
    const currency = document.getElementById('m-currency').value;

    try {
        if (id) {
            // Sadece senet bilgilerini güncelle
            await adminApi('PUT', `/api/admin/notes/${id}`, {
                noteNo,
                companyCode: compVal[0],
                companyName: compVal[1],
                amount,
                dueDate,
                description: desc,
                currency
            });
            showToast('Senet bilgileri güncellendi');
        } else {
            // Yeni giriş: Hem kasa hem senet
            await adminApi('POST', '/api/admin/cash-transactions', {
                type: 'TAHSILAT',
                cariCode: compVal[0],
                amount: amount,
                accountType: 'SENET/ÇEK',
                receiptCode: noteNo,
                notes: `Senet Girişi: ${noteNo} - ${desc}`,
                date: new Date().toISOString().split('T')[0]
            });

            await adminApi('POST', '/api/admin/notes', {
                noteNo,
                type: 'ALACAK',
                companyCode: compVal[0],
                companyName: compVal[1],
                amount: amount,
                dueDate,
                description: desc,
                paymentStatus: 'PORTFOY'
            });
            showToast('Senet portföye ve cariye işlendi.');
        }

        closeModal(); renderNotesTab();
    } catch(e) { showToast(e.message, 'error'); }
}

window.openTahsilModal = function(id, amount) {
    document.getElementById('modal-title').textContent = 'Tahsilat Girişi';
    document.getElementById('modal-body').innerHTML = `
        <div class="glass-card" style="padding:15px; border-color:var(--neon-green); margin-bottom:15px;">
            <p>Bedel: <b>${amount.toLocaleString('tr-TR')} ₺</b>. Parayı nereye aldınız?</p>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="btn" style="padding:20px; border-color:var(--neon-cyan);" onclick="processTahsil('${id}', ${amount}, 'NAKİT KASA')">💵 NAKİT KASA</button>
            <button class="btn" style="padding:20px; border-color:var(--neon-blue);" onclick="processTahsil('${id}', ${amount}, 'BANKA')">🏦 BANKA HESABI</button>
        </div>
    `;
    window.resetModalBtn('', '', false);
    document.getElementById('admin-modal').classList.add('active');
}

async function processTahsil(id, amount, target) {
    try {
        const notes = await adminApi('GET', '/api/admin/notes');
        const n = notes.find(x => x.id === id);
        
        await adminApi('POST', '/api/admin/cash-transactions', {
            type: 'GELIR',
            cariCode: 'SISTEM',
            amount: amount,
            accountType: target,
            notes: `Senet Nakde Çevrildi: ${n.noteNo}`,
            date: new Date().toISOString().split('T')[0]
        });
        
        // 2. Asıl Müşterinin Ekstresine Bilgi Notu Düş (0 TL - Takip İçin)
        await adminApi('POST', '/api/admin/cash-transactions', {
            type: 'TAHSILAT',
            cariCode: n.companyCode,
            amount: 0,
            accountType: 'BİLGİ',
            notes: `BİLGİ: ${n.noteNo} nolu senet ${target} kanalıyla tahsil edildi.`,
            date: new Date().toISOString().split('T')[0]
        });

        await adminApi('PUT', `/api/admin/notes/${id}`, { paymentStatus: 'ODENDI' });
        closeModal(); renderNotesTab(); showToast('Tahsilat kasaya işlendi.');
    } catch(e) { showToast(e.message, 'error'); }
}

window.openCiroModal = function(noteId, amount) {
    document.getElementById('modal-title').textContent = 'Senet Ciro (Ödeme)';
    const comps = window._cachedCompanies || [];
    
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group full-width" style="position:relative;">
            <label>Ciro Edilecek Kurum (Arayın...)</label>
            <input type="text" id="ciro-search" class="form-control" placeholder="Kurum adını yazmaya başlayın..." style="width:100%;">
            <div id="ciro-results" class="glass-card" style="display:none; position:absolute; top:75px; left:0; width:100%; z-index:999; max-height:200px; overflow-y:auto; padding:5px; border-color:var(--neon-cyan);"></div>
            <input type="hidden" id="ciro-target" value="">
        </div>
        <p style="font-size:0.85em; opacity:0.6; margin-top:10px;">Bu işlem seçilen carinin ekstresine ödeme olarak yansıyacaktır.</p>
    `;
    
    const searchInput = document.getElementById('ciro-search');
    const resultsDiv = document.getElementById('ciro-results');
    const targetInput = document.getElementById('ciro-target');

    searchInput.oninput = () => {
        const val = searchInput.value.toLowerCase();
        if(!val) { resultsDiv.style.display = 'none'; return; }
        
        const filtered = comps.filter(c => c.ad.toLowerCase().includes(val) || c.cariKod.toLowerCase().includes(val));
        if(filtered.length > 0) {
            resultsDiv.innerHTML = filtered.map(c => `
                <div class="search-result-item" style="padding:10px; cursor:pointer; border-radius:5px;" onclick="selectCiroTarget('${c.cariKod}', '${c.ad}')">
                    <b style="color:var(--neon-cyan)">${c.ad}</b> <small style="opacity:0.6">(${c.cariKod})</small>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = '<div style="padding:10px; opacity:0.5;">Sonuç bulunamadı</div>';
            resultsDiv.style.display = 'block';
        }
    };

    window.selectCiroTarget = (kod, ad) => {
        targetInput.value = `${kod}|${ad}`;
        searchInput.value = ad;
        resultsDiv.style.display = 'none';
    };

    window.resetModalBtn('🔄 CİROYU ONAYLA', 'btn btn-premium-save', true);
    document.getElementById('modal-save-btn').onclick = () => {
        if(!targetInput.value) return showToast('Lütfen listeden bir kurum seçin!', 'error');
        processCiro(noteId, amount);
    };
}
async function processCiro(noteId, amount) {
    const targetVal = document.getElementById('ciro-target').value.split('|');
    try {
        const notes = await adminApi('GET', '/api/admin/notes');
        const n = notes.find(x => x.id === noteId);
        if(!n) throw new Error('Senet bulunamadı');

        // 1. Tedarikçiye Ödeme Olarak İşle
        await adminApi('POST', '/api/admin/cash-transactions', {
            type: 'ODEME',
            cariCode: targetVal[0],
            amount: amount,
            accountType: 'SENET/ÇEK',
            notes: `Senet Ciro edildi: ${targetVal[1]} (No: ${n.noteNo})`,
            date: new Date().toISOString().split('T')[0]
        });

        // 2. Asıl Müşterinin Ekstresine Bilgi Notu Düş (0 TL - Takip İçin)
        await adminApi('POST', '/api/admin/cash-transactions', {
            type: 'TAHSILAT', // Bilgi amaçlı giriş gibi görünsün ama tutar 0
            cariCode: n.companyCode,
            amount: 0,
            accountType: 'BİLGİ',
            notes: `BİLGİ: ${n.noteNo} nolu senet ${targetVal[1]} firmasına ciro edildi.`,
            date: new Date().toISOString().split('T')[0]
        });

        await adminApi('PUT', `/api/admin/notes/${noteId}`, { 
            paymentStatus: 'CIRO',
            description: `Ciro edildi: ${targetVal[1]}`
        });

        closeModal(); renderNotesTab(); showToast('Ciro işlemi cariye işlendi.');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteNote = async function(id) {
    window.showConfirm('Bu senedi silmek istediğinize emin misiniz? (NOT: Sildiğinizde cariye işlenen ödeme kaydı da geri alınacaktır!)', async () => {
        try { 
            // Senedi bulup cari bilgisini alalım
            const notes = await adminApi('GET', '/api/admin/notes');
            const n = notes.find(x => x.id === id);
            if(n) {
                // Karşıt işlemle bakiyeyi düzelt (TAHSİLAT'ın tersi ÖDEME'dir)
                await adminApi('POST', '/api/admin/cash-transactions', {
                    type: 'ODEME',
                    cariCode: n.companyCode,
                    amount: n.amount,
                    accountType: 'SENET/ÇEK',
                    notes: `SİLME DÜZELTMESİ: ${n.noteNo} nolu senet kaydı silindi.`,
                    date: new Date().toISOString().split('T')[0]
                });
            }

            await adminApi('DELETE', `/api/admin/notes/${id}`); 
            showToast('Senet silindi ve cari bakiye düzeltildi.');
            renderNotesTab(); 
        } catch(e) { 
            showToast('Hata: ' + e.message, 'error'); 
        }
    });
}

window.processReturn = async function(id, amount) {
    window.showConfirm('Bu senet karşılıksız mı çıktı? Müşterinin borcuna geri eklenecektir. Emin misiniz?', async () => {
        try {
        const notes = await adminApi('GET', '/api/admin/notes');
        const n = notes.find(x => x.id === id);
        if(!n) throw new Error('Senet bulunamadı');

        // Cari borcuna geri ekle (ODEME olarak eklenince bakiye artar)
        await adminApi('POST', '/api/admin/cash-transactions', {
            type: 'ODEME',
            cariCode: n.companyCode,
            amount: amount,
            accountType: 'SENET/ÇEK',
            receiptCode: n.noteNo,
            notes: `Senet İade (Ödenmedi): ${n.noteNo}`,
            date: new Date().toISOString().split('T')[0]
        });

        await adminApi('PUT', `/api/admin/notes/${id}`, { paymentStatus: 'IADE' });
        closeModal();
        renderNotesTab();
        showToast('Senet iade edildi ve tutar carinin borcuna geri işlendi.');
    } catch(e) { showToast(e.message, 'error'); }
    });
}
