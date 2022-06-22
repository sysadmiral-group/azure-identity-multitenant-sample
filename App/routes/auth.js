/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const express = require('express');
const msal = require('@azure/msal-node');

const {
    msalConfig,
    REDIRECT_URI,
    POST_LOGOUT_REDIRECT_URI,
    azureSigninScopes,
    azureManagementScopes,
    c
} = require('../authConfig');

const {
    createDaemonApp,
    assignDaemonAppRole,
} = require('../azure');

const router = express.Router();
const msalInstance = new msal.ConfidentialClientApplication(msalConfig);
const cryptoProvider = new msal.CryptoProvider();

const _ = require('lodash');

/**
 * Prepares the auth code request parameters and initiates the first leg of auth code flow
 * @param req: Express request object
 * @param res: Express response object
 * @param next: Express next function
 * @param opts: {
 *   redirectTo: url to redirect to (string)
 *   scopes: array of scopes, example ["https://graph.microsoft.com/user", "https://management.azure.com/user_impersonation" ]
 *   next: string, defines next step there access_code is used. custom logic used to process it
 *   nextParams: defines next step parameters 
 * }
 * @param redirectTo: (url string) where to redirect after we get ACCESS_TOKEN
 * @param scopes: (strings array) scope to require
 */
async function redirectToAuthCodeUrl(req, res, next, opts) {
    
    // create a GUID for crsf
    req.session.csrfToken = cryptoProvider.createNewGuid();

    /**
     * The MSAL Node library allows you to pass your custom state as state parameter in the Request object.
     * The state parameter can also be used to encode information of the app's state before redirect.
     * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
     */
    const state = cryptoProvider.base64Encode(
        JSON.stringify({
            csrfToken: req.session.csrfToken,
            redirectTo: _.get(opts, "redirectTo"),
            next: _.get(opts, "next"),
            ..._.get(opts, "nextParams", {}),
        })
    );

    const authCodeUrlRequestParams = {
        state: state,

        /**
         * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
         */
        //scopes: [],
        scopes: _.get(opts, "scopes", []),
    };

    const authCodeRequestParams = {

        /**
         * By default, MSAL Node will add OIDC scopes to the auth code request. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
         */
        // scopes: [],
        scopes: _.get(opts, "scopes", []),
    };

    // Generate PKCE Codes before starting the authorization flow
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

    // Set generated PKCE codes and method as session vars
    req.session.pkceCodes = {
        challengeMethod: 'S256',
        verifier: verifier,
        challenge: challenge,
    };

    // @param authCodeUrlRequestParams: parameters for requesting an auth code url
    // authCodeRequestParams: parameters for requesting tokens using auth code
    
    /**
     * By manipulating the request objects below before each request, we can obtain
     * auth artifacts with desired claims. For more information, visit:
     * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationurlrequest
     * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationcoderequest
     **/
    // url parameters:
    // https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow

    req.session.authCodeUrlRequest = {
        redirectUri: REDIRECT_URI,
        responseMode: 'form_post', // recommended for confidential clients
        codeChallenge: req.session.pkceCodes.challenge,
        codeChallengeMethod: req.session.pkceCodes.challengeMethod,
        ...authCodeUrlRequestParams,
    };

    req.session.authCodeRequest = {
        redirectUri: REDIRECT_URI,
        code: "",
        ...authCodeRequestParams,
    };

    // Get url to sign user in and consent to scopes needed for application
    try {
        const authCodeUrlResponse = await msalInstance.getAuthCodeUrl(req.session.authCodeUrlRequest);
        res.redirect(authCodeUrlResponse);
    } catch (error) {
        next(error);
    }
};


router.get('/signin', async function (req, res, next) {
    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(req, res, next, {
        redirectTo: "/",
        scopes: azureSigninScopes,
    });
});

router.get('/acquireToken', async function (req, res, next) {

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(req, res, next, {
        redirectTo: "/azure/profile",
        scopes: azureManagementScopes,
    });
});

router.get('/createDaemonApp', async function (req, res, next) {

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(req, res, next, {
        redirectTo: "/azure/daemonApp",
        scopes: ["https://graph.microsoft.com//.default"],
        //scopes: ["https://management.azure.com/.default", "Application.ReadWrite.All" ],
        //scopes: ["https://management.azure.com//.default", "https://graph.microsoft.com//.default" ],
        //scopes: ["https://management.azure.com//subscriptions/928f490f-b18e-413c-ac78-3df981618526", "Application.ReadWrite.All" ],
        next: c.CREATE_DAEMON_APP,
    });
});

router.get('/assignRoleToDaemonApp', async function (req, res, next) {

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(req, res, next, {
        redirectTo: "/azure/assignRoleToDaemonApp",
        scopes: ["https://management.azure.com//.default"],
        next: c.ASSIGN_ROLE_TO_DAEMON_APP,
    });
});

router.post('/redirect', async function (req, res, next) {
    if (_.get(req, 'body.error')) {
        return next(new Error(`${_.get(req, 'body.error')} - ${_.get(req, 'body.error_description')}`));
    }
    if (req.body.state) {
        const state = JSON.parse(cryptoProvider.base64Decode(req.body.state));

        // check if csrfToken matches
        if (state.csrfToken === req.session.csrfToken) {
            req.session.authCodeRequest.code = req.body.code; // authZ code
            req.session.authCodeRequest.codeVerifier = req.session.pkceCodes.verifier // PKCE Code Verifier

            try {
                const tokenResponse = await msalInstance.acquireTokenByCode(req.session.authCodeRequest);
                req.session.accessToken = tokenResponse.accessToken;
                req.session.idToken = tokenResponse.idToken;
                req.session.account = tokenResponse.account;
                req.session.isAuthenticated = true;

                // code here what to do before redirect to user's output
                const nextAction = state.next;
                if (nextAction === c.CREATE_DAEMON_APP ) {
                    const daemonAppData = await createDaemonApp(tokenResponse);
                    req.session.daemonAppData = daemonAppData;
                } else if (nextAction === c.ASSIGN_ROLE_TO_DAEMON_APP) {
                    const assignDaemonAppRoleData = await assignDaemonAppRole(tokenResponse);
                    req.session.assignDaemonAppRoleData = assignDaemonAppRoleData;
                }
                res.redirect(state.redirectTo);
            } catch (error) {
                next(error);
            }
        } else {
            next(new Error('csrf token does not match'));
        }
    } else {
        next(new Error('state is missing'));
    }
});

router.get('/signout', function (req, res) {
    /**
     * Construct a logout URI and redirect the user to end the
     * session with Azure AD. For more information, visit:
     * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
     */
    const logoutUri = `${msalConfig.auth.authority}/oauth2/v2.0/logout?post_logout_redirect_uri=${POST_LOGOUT_REDIRECT_URI}`;

    req.session.destroy(() => {
        res.redirect(logoutUri);
    });
});

router.get('/deleteSession', function (req, res) {

    req.session.destroy(() => {
        res.redirect("/");
        req.session = null;
    });
});

module.exports = router;

