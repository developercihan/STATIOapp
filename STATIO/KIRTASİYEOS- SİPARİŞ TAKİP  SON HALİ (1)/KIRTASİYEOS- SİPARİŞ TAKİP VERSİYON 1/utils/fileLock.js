const locks = new Map();

async function acquireLock(filePath) {
    while (locks.has(filePath)) {
        await locks.get(filePath);
    }
    let resolveFn;
    const promise = new Promise(resolve => {
        resolveFn = resolve;
    });
    locks.set(filePath, promise);
    return resolveFn;
}

function releaseLock(filePath, resolveFn) {
    if (locks.has(filePath)) {
        locks.delete(filePath);
        resolveFn();
    }
}

async function withLock(filePath, fn) {
    const resolveFn = await acquireLock(filePath);
    try {
        return await fn();
    } finally {
        releaseLock(filePath, resolveFn);
    }
}

module.exports = {
    acquireLock,
    releaseLock,
    withLock
};
