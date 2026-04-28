const PLAN_LIMITS = {
    startup: {
        maxProducts: 500,
        maxUsers: 3,
        features: ['basic_reports', 'pdf_export'],
        price: 5000
    },
    professional: {
        maxProducts: 5000,
        maxUsers: 15,
        features: ['basic_reports', 'pdf_export', 'excel_export', 'stock_alerts'],
        price: 12500
    },
    ultimate: {
        maxProducts: Infinity,
        maxUsers: Infinity,
        features: ['basic_reports', 'pdf_export', 'excel_export', 'stock_alerts', 'analytics', 'backup_restore'],
        price: 20000
    }
};

function getPlanLimit(planId) {
    return PLAN_LIMITS[planId] || PLAN_LIMITS.startup;
}

module.exports = { PLAN_LIMITS, getPlanLimit };
