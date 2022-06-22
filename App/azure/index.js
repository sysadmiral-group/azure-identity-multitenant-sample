// const fetch = require('node-fetch');
var axios = require('axios').default;
const _ = require('lodash');
var moment = require('moment');

const path = require('path');

var msrestazure = require('ms-rest-azure');
var graph = require('azure-graph');
var fs = require('fs');
var uuid = require('uuid');

const {
    msalConfig,
} = require('../authConfig');

const msGraphEndpoint = 'https://graph.microsoft.com/v1.0'


// https://docs.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0
async function createDaemonApp(userTokenResponse) {

    const tenantId = _.get(userTokenResponse, 'account.tenantId');
    // get client application name
    const clientAppId = _.get(userTokenResponse, 'idTokenClaims.aud');

    /////////////////////////////////////////
    // check if app already exists in the db
    // return it if exists
    
    let daemonAppData = await getDaemonAppData(tenantId);
    if (daemonAppData) {
        return daemonAppData;
    }
        
    /////////////////////////////////////////
    // get servicePrincipal of client App
    const clientAppSpResp = await axios.get(`${msGraphEndpoint}/servicePrincipals?$filter=appId eq '${clientAppId}'`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        }
    );
    const clientAppDisplayName = _.get(clientAppSpResp, 'data.value[0].appDisplayName');
    if (!clientAppDisplayName) {
        throw new Error("Application is not registered or consented");
    }

    //////////////////////////////////////////////////
    // creating API servicePrincipal if not already exists
    const daemonAppDisplayName = `${clientAppDisplayName}-API`;

    // check if already exists
    const daemonAppGetResp = await axios.get(`${msGraphEndpoint}/applications?$filter=displayName eq '${daemonAppDisplayName}'`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        }
    );
    let daemonAppObjectId, daemonAppClientId;
    if (_.get(daemonAppGetResp, 'data.value[0]')) {
        daemonAppObjectId = _.get(daemonAppGetResp, 'data.value[0].id');
        daemonAppClientId = _.get(daemonAppGetResp, 'data.value[0].appId');
    } else {
        // Creating new Application 
        const daemonAppCreateResp = await axios.post(`${msGraphEndpoint}/applications`,
            {
                "displayName": daemonAppDisplayName,
                "keyCredentials": []
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userTokenResponse.accessToken}`
                },
            }
        );
        daemonAppObjectId = _.get(daemonAppCreateResp, 'data.id');
        daemonAppClientId = _.get(daemonAppCreateResp, 'data.appId');

    }

    /////////////////////////////////////////
    // get servicePrincipal of daemon App
    let daemonSpId;
    const daemonSpGetResp = await axios.get(`${msGraphEndpoint}/servicePrincipals?$filter=appId eq '${daemonAppClientId}'`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        }
    );
    daemonSpId = _.get(daemonSpGetResp, 'data.value[0].id');
    if (!daemonSpId) {
        // Create servicePrincipal of daemon app - enable service account
        const daemonSpCreateResp = await axios.post(`${msGraphEndpoint}/servicePrincipals`,
            {
                "appId": daemonAppClientId,
                "accountEnabled": true,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userTokenResponse.accessToken}`
                },
            }
        );
        daemonSpId = _.get(daemonSpCreateResp, 'data.value[0].id');
    }

    //////////////////////////////////////////////////
    // Adding Password if not exists
    const passwordDisplayName = "registrator";
    var passwordStartDate = new Date(Date.now());
    var passwordEndDate = new Date(passwordStartDate.toISOString());
    var m = moment(passwordEndDate);
    m.add(1, 'years');
    passwordEndDate = new Date(m.toISOString());
    const daemonAppAddPasswordResp = await axios.post(`${msGraphEndpoint}/applications/${daemonAppObjectId}/addPassword`,
        {
            passwordCredential: {
                displayName: passwordDisplayName,
                startDateTime: passwordStartDate.toISOString(),
                endDateTime: passwordEndDate.toISOString(),
            },
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        });
    
    daemonAppData = {
        tenant: tenantId,
        appId: daemonAppClientId,
        displayName: daemonAppDisplayName,
        password: _.get(daemonAppAddPasswordResp, 'data.secretText'),

        spId: daemonSpId,
    }

    await saveDaemonAppData(tenantId, daemonAppData);
    return daemonAppData;
}


// Assign Reader Role for daemon app 
// https://docs.microsoft.com/en-us/rest/api/authorization/role-assignments/create
// Management REST API - https://docs.microsoft.com/en-us/rest/api/resources/resources/get
async function assignDaemonAppRole(userTokenResponse) {
    const tenantId = _.get(userTokenResponse, 'account.tenantId');

    const daemonAppData = await getDaemonAppData(tenantId);
    if (!daemonAppData) {
        throw new Error("Daemon Application does not exists or not found in the db"); 
    }

    // Get Subscriptions
    const subscriptionsResp = await axios.get(`https://management.azure.com/subscriptions?api-version=2020-01-01`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        }
    );
    // For POC we are working with first subscription, Generally maybe multiple subscriptions for single tenant  
    const subscriptionId = _.get(subscriptionsResp, 'data.value[0].subscriptionId');
    if (!subscriptionId) {
        throw new Error(`Cannot find subscription for tenant ${tenantId}`);  
    }

    // Reader role has well-known id: https://docs.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
    const roleId = 'acdd72a7-3385-48ef-bd42-f606fba81ae7';
    const roleAssignmentsBaseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleAssignments`;
    const apiVersionParam = 'api-version=2020-04-01-preview';

    // 
    const roleAssignmentName = uuid.v4();
    let assignDaemonAppRoleData = {
        ...daemonAppData,
        subscriptionId,
        roleAssignmentName,
        role: "Reader",
        roleId,
    }
    try {
        const roleAssignmentCreateResp = await axios.put(`${roleAssignmentsBaseUrl}/${roleAssignmentName}?${apiVersionParam}`,
            {
                properties: {
                    roleDefinitionId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${roleId}`,
                    principalId: _.get(daemonAppData, "spId"),
                    principalType: "ServicePrincipal"
                }
            },
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${userTokenResponse.accessToken}`
                },
            }

        );
        return assignDaemonAppRoleData;
    } catch (error) {
        const responseError = _.get(error, 'response.data.error');
        if (_.get(responseError, 'code') === "RoleAssignmentExists") {
            console.log(`"The role assignment already exists.`);
            return assignDaemonAppRoleData; 
        } else {
            console.log(`roleAssignmentCreateResp error ${error} - ${_.get(responseError, 'message')}`);
            throw error;
        }
    

    }
}



module.exports = {
    createDaemonApp,
    assignDaemonAppRole,
}

async function getDaemonAppData(tenantId) {
    let daemonAppData;
    const dbDir = path.join(__dirname, "db");
    if (! await checkFileExists(dbDir)){
        await fs.promises.mkdir(dbDir, { recursive: true });
    }
    const daemonAppSpFile = path.join(dbDir, `sp-${tenantId}`);
    if (await checkFileExists(daemonAppSpFile)){
        const daemonAppDataStr = await fs.promises.readFile(daemonAppSpFile);
        daemonAppData = JSON.parse(daemonAppDataStr);
        daemonAppData._alreadyExists = "true";
        return daemonAppData;
    } else {
        return null;
    }
}

async function saveDaemonAppData(tenantId, daemonAppData) {
    const dbDir = path.join(__dirname, "db");
    if (! await checkFileExists(dbDir)){
        await fs.promises.mkdir(dbDir, { recursive: true });
    }
    const daemonAppSpFile = path.join(dbDir, `sp-${tenantId}`);
    daemonAppData._credentials_file_path = daemonAppSpFile;
    await fs.promises.writeFile(daemonAppSpFile, JSON.stringify(daemonAppData));
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