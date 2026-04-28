const crypto = require('crypto');
const dataAccess = require('../services/dataAccess');
const { dataDir } = require('../services/dataAccess');
const path = require('path');

async function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
    }
    
    try {
        const usersPath = path.join(dataDir, 'users.json');
        const users = await dataAccess.readJson(usersPath);
        const user = users.find(u => u.id === req.session.userId);
        
        if (!user || !user.isActive) {
            req.session.destroy();
            return res.status(403).json({ error: 'Kullanıcı hesabı bulunamadı veya deaktif' });
        }
        
        req.user = user;
        next();
    } catch (e) {
        return res.status(500).json({ error: 'Sunucu hatası (requireLogin)' });
    }
}

function normalizeRole(role) {
    if (!role) return 'distributor';
    const r = role.toLowerCase();
    if (r === 'user') return 'distributor';
    if (r === 'admin') return 'admin';
    if (r === 'warehouse') return 'warehouse';
    return 'distributor';
}

function hasPermission(user, permission) {
    if (!user) return false;
    if (normalizeRole(user.role) === 'admin') return true;
    if (!user.permissions || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes(permission);
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Oturum bulunamadı' });
        }
        if (hasPermission(req.user, permission)) {
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
        if (normalizeRole(req.user.role) === normalizeRole(role)) {
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

module.exports = {
    requireLogin,
    requirePermission,
    requireRole,
    csrfCheck,
    hasPermission,
    normalizeRole
};
