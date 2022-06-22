// const fetch = require('node-fetch');
var axios = require('axios').default;
const _ = require('lodash');
var moment = require('moment');

const path = require('path');

var msrestazure = require('ms-rest-azure');
var graph = require('azure-graph');
var fs = require('fs');

const {
    msalConfig,
} = require('../authConfig');

const msGraphEndpoint = 'https://graph.microsoft.com/v1.0'


// https://docs.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0
async function createDaemonApp(userTokenResponse) {

    const tenantId = _.get(userTokenResponse, 'account.tenantId');
    // get client application name
    const clientAppId = _.get(userTokenResponse, 'idTokenClaims.aud');


    let spDataStr;

    /////////////////////////////////////////
    // check if app already exists in the db
    // return it if exists
    
    // local path to output data
    const dbDir = path.join(__dirname, "db");
    if (! await fs.promises.exists(dbDir)){
        await fs.promises.mkdir(dbDir, { recursive: true });
    }
    const apiSpOutFile = path.join(dbDir, `sp-${tenantId}`);
    if (await fs.promises.exists(apiSpOutFile)){
        spDataStr = await fs.promises.readFile(apiSpOutFile);
        return JSON.stringify(spDataStr);
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
    const apiAppDisplayName = `${clientAppDisplayName}-API`;


    // check if already exists
    const apiSpGetResp = await axios.get(`${msGraphEndpoint}/applications?$filter=displayName eq '${apiAppDisplayName}'`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        }
    );
    let apiId, apiAppId;
    if (_.get(apiSpGetResp, 'data.value[0]')) {
        apiId = _.get(apiSpGetResp, 'data.value[0].id');
        apiAppId = _.get(apiSpGetResp, 'data.value[0].appId');
    } else {
    // Creating new Application 
    
        const apiAppCreateResp = await axios.post(`${msGraphEndpoint}/applications`,
            {
                "displayName": apiAppDisplayName,
                "keyCredentials": []
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userTokenResponse.accessToken}`
                },
            }
        );
        apiId = _.get(apiAppCreateResp, 'data.id');
        apiAppId = _.get(apiAppCreateResp, 'data.appId');
    }

    //////////////////////////////////////////////////
    // Adding Password if not exists
    const passwordDisplayName = "registrator";
    var startDate = new Date(Date.now());
    var endDate = new Date(startDate.toISOString());
    var m = moment(endDate);
    m.add(1, 'years');
    endDate = new Date(m.toISOString());
    const apiAppAddPasswordResp = await axios.post(`${msGraphEndpoint}/applications/${apiId}/addPassword`,
        {
            displayName: passwordDisplayName,
            startDateTime: startDate.toISOString(),
            endDateTime: endDate.toISOString(),
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userTokenResponse.accessToken}`
            },
        });
    
    return apiAppAddPasswordResp;
}


async function createDaemonApp1(userTokenResponse) {
    // console.log(`tokenResponse = ${JSON.stringify(tokenResponse)}`);

    const tenantId = _.get(userTokenResponse, 'account.tenantId');
    const creds = {
        authority: `https://login.microsoftonline.com/${tenantId}/`,
        //account: req.session.account,
        //idToken: req.session.idToken,
        accessToken: userTokenResponse.accessToken,
        fromCache: false,
        tokenType: "Bearer",
    }
    // const credsForGraph = new graph.TokenCredentials(userTokenResponse.accessToken);
    https://github.com/Azure/ms-rest-nodeauth#authenticating-with-an-existing-token
    var credsForGraph = {
        signRequest: (request) => {
            if (!request.headers) request.headers = new HttpHeaders();
            request.headers["Authorization"] = `Bearer ${userTokenResponse.accessToken}`;
            return Promise.resolve(request);
        },
    }
    var graphClient = new graph(credsForGraph, tenantId);
    var startDate = new Date(Date.now());
    var endDate = new Date(startDate.toISOString());
    var m = moment(endDate);
    m.add(1, 'years');
    endDate = new Date(m.toISOString());
    var applicationCreateParameters = {
      availableToOtherTenants: false,
      displayName: "test-app-for-rollback",
      homepage: "localhost:5000",
      identifierUris: ["localhost:5000"],
      passwordCredentials: [{
        startDate: startDate,
        endDate: endDate,
        keyId: msrestazure.generateUuid(),
        value: "e21re3421qr_^_DASf"
      }]
    };
    const app = await graphClient.applications.create(applicationCreateParameters);
    return app;
        
    //  graphClient.applications.create(applicationCreateParameters    , function (err, application, req, res) {
    //     if (err) {
    //         console.log('Error occured while creating the application: \n' + util.inspect(err, { depth: null }));
    //         return;
    //     }
    //     var servicePrincipalCreateParameters = {
    //         appId: application.appId,
    //         accountEnabled: true
    //     };
    //     console.log('Underlying Application objectId: ' + application.objectId);
    // });
} 


    //  On-behalf-Of token - example - https://github.com/Azure-Samples/ms-identity-javascript-tutorial/blob/main/4-AdvancedGrants/1-call-api-graph/API/index.js
    // return await getOnbehalfAccessToken(userTokenResponse, ["https://graph.microsoft.com/Application.ReadWrite.All"]);
async function getOnbehalfAccessToken(userTokenResponse, scopes) {

        const tokenValue = userTokenResponse.accessToken
        const tenantId = _.get(userTokenResponse, 'account.tenantId');
        const tokenEndpoint = `https://login.microsoftonline.com/common/oauth2/v2.0/token`;
    
        let myHeaders = new fetch.Headers();
        myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
    
        let urlencoded = new URLSearchParams();
        urlencoded.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
        urlencoded.append('client_id', msalConfig.auth.clientId);
        urlencoded.append('client_secret', msalConfig.auth.clientSecret);
        urlencoded.append('assertion', tokenValue);
        urlencoded.append('scope', ...scopes);
        urlencoded.append('requested_token_use', 'on_behalf_of');
    
        let options = {
            method: 'POST',
            headers: myHeaders,
            body: urlencoded,
        };
    
        let response = await fetch(tokenEndpoint, options);
        let json = response.json();
        return json;

}

module.exports = {
    createDaemonApp,
}