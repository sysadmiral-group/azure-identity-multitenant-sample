const { c } = require("../authConfig");

async function getDaemonAppData(tenantId, appName) {
    let _getDaemonAppData;
    if (process.env.SECRET_STORAGE === c.LOCAL_FILES) {
        _getDaemonAppData = require("./localFilesSecrets").getDaemonAppData;
    } else {
        _getDaemonAppData = require("./awsSecrets").getDaemonAppData;
    }
    return await _getDaemonAppData(tenantId, appName);
}

async function saveDaemonAppData(tenantId, appName, daemonAppData) {
    let _saveDaemonAppData;
    if (process.env.SECRET_STORAGE === c.LOCAL_FILES) {
        _saveDaemonAppData = require("./localFilesSecrets").saveDaemonAppData;
    } else {
        _saveDaemonAppData = require("./awsSecrets").saveDaemonAppData;
    }
    return await _saveDaemonAppData(tenantId, appName, daemonAppData);  
}

module.exports = {
    getDaemonAppData,
    saveDaemonAppData,
}