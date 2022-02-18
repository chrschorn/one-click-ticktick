import {storage} from '/js/store.js';

export const ticktickApi = {
    clientId: 'TF8YKgsK67BA1htYrS',
    clientSecret: '&U2rl3Ci1(hl(zS!DVC6Dt^$#&v2cO07',
    authorized: async function() {
        let token = (await storage.get('token')).token;
        return !!token;
    },
    task: {
        create: async function(data) {
            const token = (await storage.get('token')).token;
            const response = await fetch('https://api.ticktick.com/open/v1/task', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return response;
        },
        complete: async function(projectId, taskId) {
            const token = (await storage.get('token')).token;
            const response = await fetch('https://api.ticktick.com/open/v1/project/' + projectId + '/task/' + taskId + '/complete', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            return response;
        },
        get: async function(projectId, taskId) {
            const token = (await storage.get('token')).token;
            console.log(token);
            const response = await fetch('https://api.ticktick.com/open/v1/project/' + projectId + '/task/' + taskId, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
            });
            return response;
        }
    },
    logout: function() {
        return new Promise((resolve, reject) => {
            storage.remove('token').then(() => chrome.identity.clearAllCachedAuthTokens(() => { resolve() }));
        });
    },
    login: function() {
        var self = this;
        var redirectUri = chrome.identity.getRedirectURL();
        var scope = 'tasks:write';
    
        var authURL = new URL('https://ticktick.com/oauth/authorize');
        authURL.searchParams.append('client_id', self.clientId); 
        authURL.searchParams.append('scope', scope); 
        authURL.searchParams.append('state', ''); 
        authURL.searchParams.append('redirect_uri', redirectUri); 
        authURL.searchParams.append('response_type', 'code'); 
    
        console.log(authURL.href);
        
        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: authURL.href,
                    interactive: true
                },
                function(data) {
                    console.log(data);
                    var response = new URL(data);
                    var authCode = response.searchParams.get('code');
                    console.log("Auth Code: " + authCode);
        
                    if (!authCode) {
                        // TODO: error handling
                        console.log("Auth failed");
                    }
        
                    var tokenParams = {
                        client_id: self.clientId,
                        client_secret: self.clientSecret,
                        code: authCode,
                        grant_type: 'authorization_code',
                        scope: scope,
                        redirect_uri: redirectUri // effectively not used, but needs to be passed anyway
                    }
        
                    console.log(tokenParams);
        
                    fetch('https://ticktick.com/oauth/token', {
                            method: 'POST',
                            body: new URLSearchParams(tokenParams)
                        })
                        .then(function(response) {
                            if (!response.ok)
                                console.log("Response not ok: ", response);
                            return response;
                        })
                        .then(response => response.json())
                        .then(function(data) {
                            console.log("Success:", data);
                            console.log("Access token:", data.access_token);

                            storage.set({token: data.access_token}).then(resolve);
                    });
                }
            );
        });
    }
};