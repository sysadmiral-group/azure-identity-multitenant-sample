
const path = require('path');

var fs = require('fs');

async function getDaemonAppData(tenantId, appName) {
    let daemonAppData;
    const dbDir = path.join(__dirname, "db");
    if (! await checkFileExists(dbDir)){
        await fs.promises.mkdir(dbDir, { recursive: true });
    }
    const daemonAppSpFile = path.join(dbDir, getFileName(tenantId, appName));
    if (await checkFileExists(daemonAppSpFile)){
        const daemonAppDataStr = await fs.promises.readFile(daemonAppSpFile);
        daemonAppData = JSON.parse(daemonAppDataStr);
        daemonAppData._alreadyExists = "true";
        return daemonAppData;
    } else {
        return null;
    }
}

async function saveDaemonAppData(tenantId, appName, daemonAppData) {
    const dbDir = path.join(__dirname, "db");
    if (! await checkFileExists(dbDir)){
        await fs.promises.mkdir(dbDir, { recursive: true });
    }
    const daemonAppSpFile = path.join(dbDir, getFileName(tenantId, appName));
    daemonAppData._credentials_file_path = daemonAppSpFile;
    await fs.promises.writeFile(daemonAppSpFile, JSON.stringify(daemonAppData));
}

function getFileName(tenantId, appName) {
    return `sp-${tenantId}-${appName.replace(' ', '_')}`;
}

async function checkFileExists(filepath){
    let flag = true;
    try {
      await fs.promises.access(filepath, fs.constants.F_OK);
    }catch(e){
      flag = false;
    }
    return flag;
}
  
module.exports = {
    getDaemonAppData,
    saveDaemonAppData,
}