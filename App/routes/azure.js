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
            
            const curlExample = `curl -X GET -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" ${apiUrlGetSubscriptions}`
            res.render('profile', {
                profile,
                accessToken,
                curlExample
            });
        } catch (error) {
            next(error);
        }
    }
);


module.exports = router;
