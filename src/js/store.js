export const storage = {
    location: chrome.storage.sync,
    defaults: {
        showNotification: true, 
        taskTitle: "tabTitle", 
        autoClose: false, 
        dueDate: -1, 
        targetListId: null,
        taskPriority: 0
    },
    set: function(obj) {
        return new Promise ((resolve, reject) => {
            storage.location.set(obj, function() {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });
    },
    get: function(obj) { 
        return new Promise ((resolve, reject) => {
            storage.location.get(obj, function(result) {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(result);
            });
        });
    },
    remove: function(obj) { 
        return new Promise ((resolve, reject) => {
            storage.location.remove(obj, function(result) {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(result);
            });
        });
    },
    loadOptions: async function() {
        var self = this;
        const storedOptions = await self.location.get(Object.keys(self.defaults));

        // set default values if no value exists (undefined)
        for (const [key, value] of Object.entries(self.defaults)) {
            if (storedOptions[key] === undefined) {
                storedOptions[key] = value;
            }
        };

        // set all values again in case defaults were not set in storage yet
        await self.set(storedOptions);
        return storedOptions;
    },
    local: {
        set: function(obj) {
            return new Promise ((resolve, reject) => {
                chrome.storage.local.set(obj, function() {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(obj);
                });
            });
        },
        get: function(obj) { 
            return new Promise ((resolve, reject) => {
                chrome.storage.local.get(obj, function(result) {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(result);
                });
            });
        },
    }
};