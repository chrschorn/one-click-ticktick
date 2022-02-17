var notificationMs = 4000;
var contextMenuId = "OneClickTickTick";

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
    .then(function(registration) {
      console.log('Registration successful, scope is:', registration.scope);
    })
    .catch(function(error) {
      console.log('Service worker registration failed, error:', error);
    });
}

var tryImport = function(script) {
    try {
        importScripts(script);
    } catch (e) {
        console.error('importScripts in ' + script + ': ' + e);
    }
}

var importAll = function() {
    tryImport('/js/ticktickapi.js');
    tryImport('/js/store.js');
};


//////////////////
// Event Handlers
//////////////////


self.addEventListener('install', function(event) {
    importAll();
});


// add context menu item
chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: contextMenuId,
        title: "Send page to TickTick",
        contexts: ["page", "frame", "link", "editable", "video", "audio", "browser_action", "page_action", "image"]}
    );
    chrome.contextMenus.create({
        id: contextMenuId + "Selection",
        title: "Send selection to TickTick",
        contexts: ["selection"]}
    );
});


// handle extension button click
chrome.action.onClicked.addListener(function(tab) {
    importAll();
    oneClickTickTick(tab);    
});


// listen to context menu
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    importAll();

    if (info.menuItemId == contextMenuId + "Selection") {
        getSelectionInfo(info, tab, function(selection) {
            info.selectionText = selection;
            oneClickTickTick(tab, info);
        });
    } else if (info.menuItemId.startsWith(contextMenuId)) {
        oneClickTickTick(tab, info);
    }
});


chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    importAll();

    if (message.type === 'task') {
        oneClickTickTick(message.payload)
    } else if (message.type === 'login') {
        ticktickApi.login().then(sendResponse);
    } else if (message.type === 'logout') {
        ticktickApi.logout().then(sendResponse);
    } else if (message.type === 'getOptions') {
        storage.loadOptions().then(opts => {
            sendResponse(opts);
        });
    } else if (message.type === 'setOptions') {
        console.log("setOptions:", message.payload)
        storage.set(message.payload);
    } else if (message.type === 'isLoggedIn') {
        ticktickApi.authorized().then(response => {
            sendResponse(response);
        });
    } else {
        console.log("Unrecognized message:", message, sender);
    }

    return true;
});


var createNotification = function(notificationId, options, taskPromise) {
    return new Promise((resolve, reject) => {
        chrome.notifications.create(notificationId, options, function(createdId) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }

            var handler = function(id, buttonIndex, retries) {
                if(id != createdId) {
                    return;
                }

                taskPromise
                    .then(response => response.clone().json())
                    .then(data => {
                        if (buttonIndex === 0) {
                            chrome.tabs.create({ url: 'https://ticktick.com/webapp/#p/' + data.projectId + '/tasks/' + data.id });
                            chrome.notifications.clear(id);
                        } else if (buttonIndex === 1) {
                            ticktickApi.task.complete(data.projectId, data.id);
                            chrome.notifications.clear(id);
                        }
                    });

                chrome.notifications.onButtonClicked.removeListener(handler);
            };

            chrome.notifications.onButtonClicked.addListener(handler);
            resolve(createdId);
        });
    });
};


var oneClickTickTick = async function(tab, contextInfo) {
    if(!await ticktickApi.authorized()) {
        chrome.runtime.openOptionsPage();
        return;
    }

    const options = await storage.loadOptions();

    var plainTitle = tab.title;

    var taskData = {
        title: '[' + tab.title + '](' + tab.url + ')'
    };

    if (contextInfo && contextInfo.selectionText) {
        if (options.selectionAsTitle) {
            taskData.content = taskData.title;
            taskData.title = '[' + contextInfo.selectionText + '](' + tab.url + ')';
            plainTitle = contextInfo.selectionText;
        } else {
            taskData.content = contextInfo.selectionText;
        }
    }

    var dueDateNum = Number(options.dueDate);

    if (dueDateNum != -1) {
        var dueDate = new Date();
        dueDate.setHours(0, 0, 0, 0);
        // add one day of milliseconds times dueDate value (0 = today, 1 = tomorrow, etc.)
        dueDate.setTime(dueDate.getTime() + dueDateNum * 24 * 60 * 60 * 1000);
        dateStr = dueDate.toISOString();
        dateStr = dateStr.replace('Z', '+0000')
        taskData.dueDate = dateStr;
        taskData.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    const task = ticktickApi.task.create(taskData);
    var notification = null;

    if (options.showNotification) {
        let newNotification = {
            title: "TickTick Task Created",
            message: 'Title: ' + plainTitle,
            iconUrl: "/icons/icon256.png",
            type: "basic",
            buttons: [
                {title: 'Show Task...'},
                {title: 'Complete Task'}
            ]
        };

        notification = createNotification(null, newNotification, task);
    }

    if (options.autoClose) {
        chrome.tabs.remove(tab.id, function(){});
    }

    try {
        var response = await task;

        if (!response.ok) {
            if (response.status === 401) {
                chrome.runtime.openOptionsPage();
                return;
            }
            throw new Error("An error occured during task creation: " + response.status);
        } else {
            const data = await response.clone().json();
            console.log("Success: ", data);
        }
    } catch(error) {
        console.log(error);

        let updatedContent = {
            title: "Failed to create task!",
            message: error.message,
            buttons: []
        };

        if (notification) {
            notification.then(notId => {
                chrome.notifications.update(notId, updatedContent);
            });
        } else {
            createNotification(null, updatedContent);
        }

        if (options.autoClose) {
            // try to recover the tab, only try it on the last session that was closed
            // otherwise it might restore an unrelated session
            chrome.sessions.getRecentlyClosed({maxResults: 1}, function (sessions) {
                if (sessions.length > 0 && sessions[0].tab && sessions[0].tab.index === tab.index) {
                    chrome.sessions.restore(sessions[0].tab.sessionId);
                }
            });
        }
    }
}


getSelectionInfo = function(info, tab, callback) {
    chrome.scripting.executeScript({
        target: {tabId: tab.id}, 
        function: () => getSelection().toString()
    }, function(response) {
        var result = response[0].result;
        var selection = info.selectionText;

        if (!chrome.runtime.lastError && result.length > 0) {
            selection = result[0];
        }

        selection = info.selectionText.replace(/(\r\n|\n|\r)/gm, "\n\n");
        callback(selection);
    });
};

