window.renderNotesTab = async function() {
    try {
        const notes = await adminApi('GET', '/api/admin/notes');
        const companies = await adminApi('GET', '/api/companies');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand" style="color:var(--neon-green)">SENET TAKİBİ</h2>
                <button class="btn btn-primary" onclick="openNoteModal()">+ Yeni Senet Ekle</button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>SENET NO</th><th>KURUM</th><th>TUTAR</th><th>VADE</th><th>DURUM</th><th>İŞLEM</th></tr></thead>
                    <tbody>
        `;
        
        notes.forEach(n => {
            html += `<tr>
                <td>${n.noteNo}</td>
                <td>${n.companyName}</td>
                <td>${n.amount.toFixed(2)} ${n.currency}</td>
                <td>${n.dueDate}</td>
                <td><span class="badge ${n.paymentStatus === 'ODENDI' ? 'badge-success' : 'badge-warning'}">${n.paymentStatus}</span></td>
                <td>
                    <button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-cyan); color:var(--neon-cyan);" onclick="toggleNoteStatus('${n.id}', '${n.paymentStatus}')">Durum Değiştir</button>
                    <button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteNote('${n.id}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
        
        // Cache companies for modal
        window._cachedCompanies = companies;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openNoteModal = function() {
    document.getElementById('modal-title').textContent = 'Yeni Senet Kaydı';
    const comps = window._cachedCompanies || [];
    const compOptions = comps.map(c => `<option value="${c.cariKod}|${c.ad}">${c.ad}</option>`).join('');
    
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group"><label>Senet No</label><input type="text" id="m-noteNo"></div>
        <div class="form-group"><label>Kurum</label><select id="m-comp">${compOptions}</select></div>
        <div class="form-group"><label>Tutar</label><input type="number" id="m-amount"></div>
        <div class="form-group"><label>Para Birimi</label><input type="text" id="m-currency" value="TRY"></div>
        <div class="form-group"><label>Vade Tarihi</label><input type="date" id="m-dueDate"></div>
        <div class="form-group full-width"><label>Açıklama</label><input type="text" id="m-desc"></div>
    `;
    window.resetModalBtn();
    document.getElementById('modal-save-btn').onclick = saveNote;
    document.getElementById('admin-modal').classList.add('active');
}

async function saveNote() {
    const compVal = document.getElementById('m-comp').value.split('|');
    const data = {
        noteNo: document.getElementById('m-noteNo').value,
        companyCode: compVal[0],
        companyName: compVal[1],
        amount: parseFloat(document.getElementById('m-amount').value),
        currency: document.getElementById('m-currency').value,
        dueDate: document.getElementById('m-dueDate').value,
        description: document.getElementById('m-desc').value
    };
    try {
        await adminApi('POST', '/api/admin/notes', data);
        closeModal(); renderNotesTab(); showToast('Senet kaydedildi');
    } catch(e) { showToast(e.message, 'error'); }
}

window.toggleNoteStatus = async function(id, current) {
    const next = current === 'ODENDI' ? 'BEKLIYOR' : 'ODENDI';
    try {
        await adminApi('PUT', `/api/admin/notes/${id}`, { paymentStatus: next });
        renderNotesTab();
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteNote = async function(id) {
    window.showConfirm('Senet silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/notes/${id}`); renderNotesTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}
