import { storage } from '/js/store.js';
import { ticktickApi } from '/js/ticktickapi.js';


async function getTabContentAsMarkdown(tab) {
    try {
        var result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [
                '/lib/readability-0.4.4.js',
                '/lib/turndown-7.1.2.js',
                '/js/contentscript.js'
            ],
        });
    } catch (error) {
        console.log(error);
        return "";
    }

    if (!Array.isArray(result) || result.length == 0)
        return "";

    var markdown = result[0].result;
    // Finds # only if not immediately followed by whitespace or \ / # " : * ? < > |
    // these symbols all invalidate a string that would otherwise be recognized as a tag
    // by TickTick. We place an invalid symbol after each found #.
    const removeTagsRegex = /#(?![\s\\\/#":*?<>|])/g;
    markdown = markdown.replace(removeTagsRegex, '#/');
    return markdown;
}

export async function oneClickTickTick(tab, contextInfo) {
    if (!await ticktickApi.authorized()) {
        chrome.runtime.openOptionsPage();
        return;
    }

    const options = await storage.loadOptions();

    var plainTitle = tab.title;

    var taskData = {
        title: '[' + tab.title + '](' + tab.url + ')'
    };

    if (contextInfo && contextInfo.selectionText) {
        if (options.taskTitle == "selectedText") {
            if (options.includePageContent) {
                taskData.content = "# " + taskData.title;
                taskData.content += "\n\n" + await getTabContentAsMarkdown(tab);
            } else {
                taskData.content = taskData.title;
            }
            taskData.title = '[' + contextInfo.selectionText + '](' + tab.url + ')';
            plainTitle = contextInfo.selectionText;
        } else {
            taskData.content = contextInfo.selectionText;
        }
    } else if (options.includePageContent) {
        taskData.content = await getTabContentAsMarkdown(tab);
    }

    var dueDateNum = Number(options.dueDate);

    if (dueDateNum != -1) {
        var dueDate = new Date();
        dueDate.setHours(0, 0, 0, 0);
        // add one day of milliseconds times dueDate value (0 = today, 1 = tomorrow, etc.)
        dueDate.setTime(dueDate.getTime() + dueDateNum * 24 * 60 * 60 * 1000);
        let dateStr = dueDate.toISOString();
        dateStr = dateStr.replace('Z', '+0000')
        taskData.dueDate = dateStr;
        taskData.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        taskData.isAllDay = true;  // required to not show up as "at 00:00"
    }

    if (options.targetListId) {
        taskData.projectId = options.targetListId;
    }

    if (options.taskPriority) {
        taskData.priority = options.taskPriority;
    }

    if (options.tags) {
        // example: "  tag1   tag2" -> "#tag1 #tag2"
        let tags = options.tags
            .split(" ")
            .filter(tag => tag)  // remove empty tags (i.e. extra spaces)
            .map(tag => '#' + tag.trim())
            .join(" ");

        if (taskData.content) {
            taskData.content += "\n\n";
        } else {
            taskData.content = "";
        }

        taskData.content += "Tags: " + tags
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
                { title: 'Show Task...' },
                { title: 'Delete Task' }
            ]
        };

        notification = createNotification(null, newNotification, task);
    }

    if (options.autoClose) {
        chrome.tabs.remove(tab.id, function () { });
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
    } catch (error) {
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
            chrome.sessions.getRecentlyClosed({ maxResults: 1 }, function (sessions) {
                if (sessions.length > 0 && sessions[0].tab && sessions[0].tab.index === tab.index) {
                    chrome.sessions.restore(sessions[0].tab.sessionId);
                }
            });
        }
    }
}

function createNotification(notificationId, options, taskPromise) {
    return new Promise((resolve, reject) => {
        chrome.notifications.create(notificationId, options, function (createdId) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }

            var handler = function (id, buttonIndex, retries) {
                if (id != createdId) {
                    return;
                }

                taskPromise
                    .then(response => response.clone().json())
                    .then(data => {
                        if (buttonIndex === 0) {
                            chrome.tabs.create({ url: 'https://ticktick.com/webapp/#p/' + data.projectId + '/tasks/' + data.id });
                            chrome.notifications.clear(id);
                        } else if (buttonIndex === 1) {
                            ticktickApi.task.delete(data.projectId, data.id);
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

export function getSelectionInfo(info, tab, callback) {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => getSelection().toString()
    }, function (response) {
        var result = response[0].result;
        var selection = info.selectionText;

        if (!chrome.runtime.lastError && result.length > 0) {
            selection = result[0];
        }

        selection = info.selectionText.replace(/(\r\n|\n|\r)/gm, "\n\n");
        callback(selection);
    });
};