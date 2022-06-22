/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

var express = require('express');
var router = express.Router();

var fetch = require('../fetch');

var { GRAPH_ME_ENDPOINT } = require('../authConfig');
const _ = require('lodash');

// custom middleware to check auth state
function isAuthenticated(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.redirect('/auth/signin'); // redirect to sign-in route
    }

    next();
};

router.get('/id',
    isAuthenticated, // check if user is authenticated
    async function (req, res, next) {
        res.render('id', { idTokenClaims: req.session.account.idTokenClaims });
    }
);

router.get('/profile',
    isAuthenticated, // check if user is authenticated
    async function (req, res, next) {
        try {
            const accessToken = req.session.accessToken;
            const profile = {
                subscriptions: "",
                tenant: "",
                resourceGroups: ""
            }
            const apiUrlGetSubscriptions = "https://management.azure.com/subscriptions?api-version=2020-01-01"
            const subscriptionsResponse = await fetch(apiUrlGetSubscriptions, accessToken);
            
            const subscriptionValue = _.get(subscriptionsResponse, 'value', []);
            _.forEach(subscriptionValue, (v) => {
                profile.subscriptions += `${v.subscriptionId} (${v.displayName}) | `;
            })
            const subscriptionId = _.first(subscriptionValue).subscriptionId;
            if (subscriptionId) {
                profile.tenant = _.first(subscriptionValue).tenantId;
                const apiUrlGetResourceGroups = `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups?api-version=2020-01-01`
                const apiUrlResourceGroupsResponse = await fetch(apiUrlGetResourceGroups, accessToken);
                const resourceGroupsValue = _.get(apiUrlResourceGroupsResponse, 'value', []);
                _.forEach(resourceGroupsValue, (v) => {
                    profile.resourceGroups += `name=${v.name} location=${v.location} , `;
                })
            }
            
            const cliExample = `
    ACCESS_TOKEN=${accessToken}
    curl -X GET -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" ${apiUrlGetSubscriptions}`

            res.render('profile', {
                title: 'Subscriptions and resource groups API Call',
                profile,
                cliExample
            });
        } catch (error) {
            next(error);
        }
    }
);

// https://github.com/Azure/azure-sdk-for-node/blob/master/Documentation/ServicePrincipal/spCreate.js
router.get('/daemonApp',
    isAuthenticated, // check if user is authenticated
    async function (req, res, next) {
        try {

            const profile = req.session.daemonAppData;
            res.render('profile', {
                title: "Daemon App Service Principal",
                profile,
                next: {
                    href: "/auth/assignRoleToDaemonApp",
                    title: "Assign Reader Role for Daemon App"
                }
            });
        } catch (error) {
            next(error);
        }
    }
)

router.get('/assignRoleToDaemonApp',
    isAuthenticated, // check if user is authenticated
    async function (req, res, next) {
        try {

            const appId = _.get(req.session.daemonAppData, 'appId');
            const tenantId = _.get(req.session.daemonAppData, 'tenant');
            const password = _.get(req.session.daemonAppData, 'password');
            
            const cliExample = `
    AZURE_CLIENT_SECRET=${password}
    cartography -azure-sp-auth -azure-sync-all-subscriptions -azure-tenant-id ${tenantId} -azure-client-id ${appId} -azure-client-secret-env-var AZURE_CLIENT_SECRET
            `
            const profile = req.session.assignDaemonAppRoleData;
            res.render('profile', {
                title: "Daemon App Service Principal",
                profile,
                cliExample,
                // next: {
                //     href: "/auth/assignRoleToDaemonApp",
                //     title: "Assign Reader Role for Daemon App"
                // }
            });
        } catch (error) {
            next(error);
        }
    }
)
module.exports = router;
