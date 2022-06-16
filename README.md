# Azure Identity Multitenant Sample

## Prerequisite
- Azure account(s) with at least 2 tenants for testing and administrator rights for home app account
- nodejs 14+

## Configuration

### Configure Azure Multitenant App
- create multitenant app and note its application_id (client_id)
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

## Start

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
- [auth-code-flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

- [user-impersonalization-example-1](https://stackoverflow.com/questions/60461875/azure-resource-management-api-without-user-impersonation-is-it-possible)


