function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

function normalizeTextTR(str) {
    if (!str) return '';
    return str.toString()
        .replace(/i/g, 'İ')
        .replace(/ı/g, 'I')
        .toUpperCase();
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

function toIsoDateOnly(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
}

function formatDateTr(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMoney(amount, currency='TRY') {
    const num = parseFloat(amount);
    if (isNaN(num)) return `0,00 ${currency === 'TRY' ? '₺' : currency}`;
    
    // Turkish formatting: 1.234,56
    const formatted = num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${currency === 'TRY' ? '₺' : currency}`;
}

function daysUntilDate(dateStr) {
    if (!dateStr) return 0;
    const targetDate = new Date(dateStr);
    const today = new Date();
    targetDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function ensureArray(val) {
    if (val === null || val === undefined || val === '') return [];
    if (Array.isArray(val)) return val;
    return [val];
}

module.exports = {
    safeJsonParse,
    normalizeTextTR,
    makeId,
    toIsoDateOnly,
    formatDateTr,
    formatMoney,
    daysUntilDate,
    ensureArray
};
