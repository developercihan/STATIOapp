/**
 * Statio - i18n Dictionary
 * Tüm metin çevirileri ve dil ayarları burada tutulur.
 */

const translations = {
    tr: {
        // Genel
        "loading": "Yükleniyor...",
        "error": "Hata",
        "success": "Başarılı",
        "info": "Bilgi",
        "warning": "Uyarı",
        "save": "Kaydet",
        "cancel": "İptal",
        "delete": "Sil",
        "edit": "Düzenle",
        "actions": "İşlemler",
        "logout": "Çıkış Yap",
        "close": "Kapat",
        
        // Sipariş Ekranı
        "order_center": "Sipariş Merkezi",
        "order_tracking": "Sipariş Takibi",
        "admin_panel": "Yönetim Paneli",
        "order_params": "Sipariş Parametreleri",
        "distributor": "Hedef Distribütör",
        "company": "Alıcı Kurum",
        "protocol_type": "Protokol Tipi",
        "notes": "Ek Notlar",
        "search_placeholder": "Ürün kod veya adıyla ara...",
        "cart_title": "Sepet İşlemleri",
        "submit_order": "Siparişi Tamamla",
        "total": "Toplam",
        "tax": "KDV",
        "grand_total": "Genel Toplam",
        "subtotal": "Ara Toplam",
        "added_to_cart": "Sepete eklendi",
        
        // Admin Panel
        "dashboard": "Dashboard",
        "products": "Ürünler",
        "orders": "Siparişler",
        "distributors": "Distribütörler",
        "companies": "Kurumlar (Cariler)",
        "users": "Kullanıcılar",
        "warehouses": "Depolar",
        "backups": "Yedekler",
        "product_code": "Ürün Kodu",
        "product_name": "Ürün Adı",
        "price": "Fiyat",
        "stock": "Stok",
        "status": "Durum",
        "critical_stock": "Kritik Stok Uyarısı",
        "stock_status": "Stok Durumu",
        "no_image": "GÖRSEL YOK",
        "tax_incl": "KDV Dahil",
        "tax_excl": "KDV Hariç",
        "excl": "Hariç",
        "add_to_cart": "Sepete Ekle",
        "tax_total": "KDV Toplamı",
        "company_discount": "Cari İskontosu"
    },
    en: {
        // General
        "loading": "Loading...",
        "error": "Error",
        "success": "Success",
        "info": "Info",
        "warning": "Warning",
        "save": "Save",
        "cancel": "Cancel",
        "delete": "Delete",
        "edit": "Edit",
        "actions": "Actions",
        "logout": "Logout",
        "close": "Close",
        
        // Order Screen
        "order_center": "Order Center",
        "order_tracking": "Order Tracking",
        "admin_panel": "Admin Panel",
        "order_params": "ORDER PARAMETERS",
        "distributor": "Target Distributor",
        "company": "Buyer Company",
        "protocol_type": "Protocol Type",
        "notes": "Additional Notes",
        "notes_placeholder": "Add notes to order...",
        "search_placeholder": "Search products (Code or Name)...",
        "cart_title": "CART ACTIONS",
        "submit_order": "SUBMIT ORDER",
        "total": "Total",
        "tax": "Tax",
        "grand_total": "Grand Total",
        "subtotal": "Subtotal",
        "added_to_cart": "Added to cart",
        "no_image": "NO IMAGE",
        "tax_incl": "Tax Incl.",
        "tax_excl": "Tax Excl.",
        "excl": "Excl.",
        "add_to_cart": "Add to Cart",
        "tax_total": "Tax Total",
        "company_discount": "Company Discount",

        // Admin Panel
        "dashboard": "Dashboard",
        "products": "Products",
        "orders": "Orders",
        "distributors": "Distributors",
        "companies": "Companies",
        "users": "Users",
        "warehouses": "Warehouses",
        "backups": "Backups",
        "product_code": "Product Code",
        "product_name": "Product Name",
        "price": "Price",
        "stock": "Stock",
        "status": "Status",
        "critical_stock": "Critical Stock Warning",
        "stock_status": "Stock Status"
    }
};

window.i18n = {
    lang: localStorage.getItem('statio_lang') || 'tr',
    currency: localStorage.getItem('statio_currency') || 'TRY',
    
    t(key) {
        return translations[this.lang][key] || key;
    },
    
    setLang(l) {
        this.lang = l;
        localStorage.setItem('statio_lang', l);
        this.apply();
    },
    
    setCurrency(c) {
        this.currency = c;
        localStorage.setItem('statio_currency', c);
        location.reload();
    },

    apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = this.t(key);
            } else {
                el.textContent = this.t(key);
            }
        });
        // Update specific complex elements if needed
        document.documentElement.lang = this.lang;
    }
};

// Auto-apply on load
document.addEventListener('DOMContentLoaded', () => window.i18n.apply());

