// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/index.html

const {
    SecretsManagerClient,
    GetSecretValueCommand,
    CreateSecretCommand,

} = require("@aws-sdk/client-secrets-manager");
const _ = require('lodash');

async function getDaemonAppData(tenantId, appName) {
    
    if (!tenantId || !appName ) {
        throw new Error("getDaemonAppData - tenantId or appName is empty");
    }    
    const secretName = getSecretName(tenantId, appName);
    try {
        const client = new SecretsManagerClient();
        
        const command = new GetSecretValueCommand({
            SecretId: secretName,
        });
        const response = await client.send(command);
        const secretString = _.get(response, "SecretString");
        daemonAppData = JSON.parse(secretString);
        daemonAppData._alreadyExists = "true";
        return daemonAppData;
        

    } catch (error) {
        if (_.get(error, 'name') === "ResourceNotFoundException") {
            console.log(`getDaemonAppData - secret ${secretName} does not exist`);
            return null; 
        } else {
            console.log(`getDaemonAppData error ${_.get(error, 'name')} - ${error}`);
            throw error;
        }
    }
}

async function saveDaemonAppData(tenantId, appName, daemonAppData) {
    if (!tenantId ) {
        throw new Error("saveDaemonAppData  is empty");
    }

    if (!daemonAppData) {
        throw new Error("saveDaemonAppData - daemonAppData is empty");
    }

    const secretName = getSecretName(tenantId, appName);
    try {
        const client = new SecretsManagerClient();
        daemonAppData._awsSecretName = secretName;
        const input = {
            Name: secretName,
            SecretString: JSON.stringify(daemonAppData),
            Tags: [
                {
                    Key: "tenantId",
                    Value: tenantId,
                },
                {
                    Key: "appName",
                    Value: appName,
                },   
            ]
        }
        const command = new CreateSecretCommand(input);

        const response = await client.send(command);
        return daemonAppData;
        

    } catch (error) {
        if (_.get(error, 'name') === "ResourceNotFoundException") {
            console.log(`getDaemonAppData - secret ${secretName} does not exist`);
            return null; 
        } else {
            console.log(`getDaemonAppData error ${_.get(error, 'name')} - ${error}`);
            throw error;
        }
    }

}

function getSecretName(tenantId, appName) {
    return `/${appName.replace(' ', '_')}/tenantId=${tenantId}`;
}

module.exports = {
    getDaemonAppData,
    saveDaemonAppData,
}

