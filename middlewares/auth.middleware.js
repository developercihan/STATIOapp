const crypto = require('crypto');
const dataAccess = require('../services/dataAccess');
const { dataDir } = require('../services/dataAccess');
const path = require('path');
const { getPlanLimit } = require('../utils/planLimits');

async function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Lütfen giriş yapın' });
    }

    try {
        // Kullanıcı bilgilerini ve Tenant durumunu kontrol et
    const users = await dataAccess.readJson('users.json');
    const user = users.find(u => u.id === req.session.userId);

    if (!user) {
        return res.status(401).json({ error: 'Oturum geçersiz, lütfen tekrar giriş yapın' });
    }

    if (user.isActive === false) {
        return res.status(401).json({ error: 'Hesabınız pasif durumdadır' });
    }

    // Super Admin her zaman girebilir
    if (user.role === 'superadmin') {
        // Plan bilgisini ekle
        const tenants = await dataAccess.readJson('tenants.json');
        const tenant = tenants.find(t => t.id === user.tenantId);
        user.plan = tenant ? tenant.plan : 'startup';
        user.planLimit = getPlanLimit(user.plan);

        req.user = user;
        return next();
    }

    // Diğerleri için Mağaza Durumu kontrolü
    const tenants = await dataAccess.readJson('tenants.json');
    const tenant = tenants.find(t => t.id === user.tenantId);
    
    if (!tenant) {
        return res.status(403).json({ error: 'Mağaza bulunamadı.' });
    }

    if (tenant.status !== 'active') {
        return res.status(403).json({ error: 'Mağazanız askıya alınmıştır.' });
    }

    // Abonelik süresi kontrolü
    if (tenant.subscriptionExpiry) {
        const expiryDate = new Date(tenant.subscriptionExpiry);
        if (expiryDate < new Date()) {
            return res.status(403).json({ 
                error: 'Abonelik süreniz dolmuştur.',
                code: 'SUBSCRIPTION_EXPIRED',
                expiryDate: tenant.subscriptionExpiry 
            });
        }
    }

    user.plan = tenant.plan || 'startup';
    user.planLimit = getPlanLimit(user.plan);
    req.user = user;
    next();
    } catch (e) {
        return res.status(500).json({ error: 'Sunucu hatası (requireLogin)' });
    }
}

function normalizeRole(role) {
    if (!role) return 'distributor';
    const r = role.toLowerCase();
    if (r === 'superadmin') return 'superadmin';
    if (r === 'user') return 'distributor';
    if (r === 'admin') return 'admin';
    if (r === 'warehouse') return 'warehouse';
    return 'distributor';
}

function hasPermission(user, permission) {
    if (!user) return false;
    const role = normalizeRole(user.role);
    if (role === 'superadmin' || role === 'admin') return true;
    if (!user.permissions || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permission);
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Oturum bulunamadı' });
        }
        const role = normalizeRole(req.user.role);
        if (role === 'superadmin' || hasPermission(req.user, permission)) {
            next();
        } else {
            res.status(403).json({ error: `Erişim reddedildi. '${permission}' yetkisi gerekli.` });
        }
    };
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Oturum bulunamadı' });
        }
        const userRole = normalizeRole(req.user.role);
        const targetRole = normalizeRole(role);
        if (userRole === 'superadmin' || userRole === targetRole) {
            next();
        } else {
            res.status(403).json({ error: `Erişim reddedildi. '${role}' rolü gerekli.` });
        }
    };
}

function csrfCheck(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    const clientToken = req.headers['x-csrf-token'];
    if (!clientToken || clientToken !== req.session.csrfToken) {
        return res.status(403).json({ error: 'Geçersiz CSRF token' });
    }
    
    next();
}

function requireSuperAdmin(req, res, next) {
    if (req.user && req.user.role === 'superadmin') return next();
    res.status(403).json({ error: 'Bu işlem için Super Admin yetkisi gereklidir.' });
}

function requireFeature(feature) {
    return (req, res, next) => {
        if (!req.user || !req.user.planLimit) return res.status(401).json({ error: 'Oturum bilgisi eksik' });
        
        if (req.user.planLimit.features.includes(feature)) {
            return next();
        }
        
        res.status(403).json({ 
            error: 'Bu özellik mevcut paketinizde bulunmamaktadır.',
            requiredFeature: feature,
            currentPlan: req.user.plan
        });
    };
}

module.exports = {
    requireLogin,
    requirePermission,
    requireRole,
    requireSuperAdmin,
    requireFeature,
    csrfCheck,
    hasPermission,
    normalizeRole
};
