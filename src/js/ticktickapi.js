import {storage} from '/js/store.js';

export const ticktickApi = {
    clientId: 'A6oZTY3Ph6gWb5NjtN',
    clientSecret: '^(LIIvd9*@PKKTN_(L3Qbh6mh_P1Cp#2',
    authorized: async function() {
        let token = (await storage.get('token')).token;
        return !!token;
    },
    rest: async function(method, path, data) {
        const token = (await storage.get('token')).token;

        var config = {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        }

        if (data)
            config.body = JSON.stringify(data);

        const response = await fetch('https://api.ticktick.com/open/v1/' + path, config);
        return response;
    },
    task: {
        create: async function(data) {
            var projects = await ticktickApi.project.list();
            console.log(projects.body);
            return ticktickApi.rest('POST', 'task', data);
        },
        complete: async function(projectId, taskId) {
            return ticktickApi.rest('POST', 'project/' + projectId + '/task/' + taskId + '/complete');
        }
    },
    project: {
        list: async function() {
            return ticktickApi.rest('GET', 'project'); // not working yet
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
        var scope = 'tasks:read tasks:write';
    
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