# Azure Identity Multitenant Sample
Queries User's Azure resources using registered [Azure Multitenant App](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-convert-app-to-be-multi-tenant) and [auth-code-flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

## Prerequisite
- Azure account(s) with at least 2 tenants for testing and administrator rights for home app account
- nodejs 14+

## Configuration

### Configure Azure Multitenant App
- register Azure Multitenant app and note its application_id (client_id)
- set API Permissions:
    * https://management.azure.com/user_impersonation
    * https://graph.microsoft.com/User.Read
- Create and note Client Secret

### configure `.env`
- Notice, that `.env` contains sensitive data, so it is set in [.gitignore](.gitignore)
```
cd App
cp .env.sample .env
```
- set CLIENT_ID and CLIENT_SECRET from the configured Azure App

### secret storage
- using AWS Secret manager with [js sdk v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/index.html)



## Start

### On AWS


### Locally 
```
cd App
yarn install 
```
- run locally with `yarn start` (or `npm run start`)
- Launch in vscode debugger - use [.vscode/launch.json](.vscode/launch.json)

### Build and Deploy
- Build using Dockerfile(Dockerfile)

## References
- [ms-identity-node (initial code copied from here)](https://github.com/Azure-Samples/ms-identity-node)
- [azure web-app-quickstart](https://docs.microsoft.com/en-us/azure/active-directory/develop/web-app-quickstart?pivots=devlang-nodejs-msal)
- [Azure Multitenant App](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-convert-app-to-be-multi-tenant)
- [MSAL Nodejs Library](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md)

- [MSAL Samples](https://docs.microsoft.com/en-us/azure/active-directory/develop/sample-v2-code)

- [auth-code-flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

- [user-impersonalization-example-1](https://stackoverflow.com/questions/60461875/azure-resource-management-api-without-user-impersonation-is-it-possible)

- [Azure SDK for node](https://github.com/Azure/azure-sdk-for-node/blob/master/Documentation/ServicePrincipal/spCreate.js)
