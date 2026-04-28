window.renderReceivablesTab = async function() {
    try {
        const rcvs = await adminApi('GET', '/api/admin/receivables');
        
        let html = `
            <div class="action-bar">
                <h2 class="brand" style="color:var(--neon-pink)">CARİ HESAPLAR</h2>
                <button class="btn btn-primary" onclick="openRcvModal()">+ Yeni Cari Ekle</button>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>KOD</th><th>FİRMA</th><th>BAKİYE</th><th>DURUM</th><th>KAYNAK</th><th>İŞLEM</th></tr></thead>
                    <tbody>
        `;
        
        rcvs.forEach(r => {
            html += `<tr>
                <td style="color:var(--neon-pink)">${r.code}</td>
                <td>${r.companyName}</td>
                <td>${r.balance.toFixed(2)} TL</td>
                <td><span class="badge ${r.status === 'BORCLU' ? 'badge-danger' : 'badge-success'}">${r.status}</span></td>
                <td><span style="font-size:0.8em; opacity:0.6;">${r.source.toUpperCase()}</span></td>
                <td>
                    <button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-purple); color:var(--neon-purple);" onclick="openRcvModal('${r.id}', '${r.code}', '${r.companyName.replace(/'/g, "\\'")}', ${r.balance}, '${r.status}')">Düzenle</button>
                    <button class="btn" style="padding:5px; font-size:0.8em; border-color:var(--neon-red); color:var(--neon-red);" onclick="deleteRcv('${r.id}')">Sil</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('main-content').innerHTML = html;
    } catch(e) { showToast(e.message, 'error'); }
}

window.openRcvModal = function(id='', code='', name='', balance=0, status='BEKLEMEDE') {
    const isEdit = !!id;
    document.getElementById('modal-title').textContent = isEdit ? 'Cari Düzenle' : 'Yeni Cari Kaydı';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group"><label>Cari Kod</label><input type="text" id="m-rcv-code" value="${code}"></div>
        <div class="form-group"><label>Firma Adı</label><input type="text" id="m-rcv-name" value="${name}"></div>
        <div class="form-group"><label>Bakiye</label><input type="number" id="m-rcv-balance" value="${balance}"></div>
        <div class="form-group"><label>Durum</label>
            <select id="m-rcv-status">
                <option value="BEKLEMEDE" ${status === 'BEKLEMEDE' ? 'selected' : ''}>Beklemede</option>
                <option value="BORCLU" ${status === 'BORCLU' ? 'selected' : ''}>Borçlu</option>
                <option value="ALACAKLI" ${status === 'ALACAKLI' ? 'selected' : ''}>Alacaklı</option>
            </select>
        </div>
        <input type="hidden" id="m-rcv-id" value="${id}">
    `;
    window.resetModalBtn();
    document.getElementById('modal-save-btn').onclick = saveRcv;
    document.getElementById('admin-modal').classList.add('active');
}

async function saveRcv() {
    const id = document.getElementById('m-rcv-id').value;
    const data = {
        code: document.getElementById('m-rcv-code').value,
        companyName: document.getElementById('m-rcv-name').value,
        balance: parseFloat(document.getElementById('m-rcv-balance').value),
        status: document.getElementById('m-rcv-status').value
    };
    try {
        if(id) await adminApi('PUT', `/api/admin/receivables/${id}`, data);
        else await adminApi('POST', '/api/admin/receivables', data);
        closeModal(); renderReceivablesTab(); showToast('Cari kaydedildi');
    } catch(e) { showToast(e.message, 'error'); }
}

window.deleteRcv = async function(id) {
    window.showConfirm('Cari silinsin mi?', async () => {
        try { await adminApi('DELETE', `/api/admin/receivables/${id}`); renderReceivablesTab(); } catch(e) { showToast(e.message, 'error'); }
    });
}
