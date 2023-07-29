var login = function() {
    chrome.runtime.sendMessage({type: 'login'}, function(response) {
        location.reload();
    });
};

var logout = function() {
    chrome.runtime.sendMessage({type: 'logout'}, function(response) {
        location.reload();
    });
};

var setOptions = function(payload) {
    chrome.runtime.sendMessage({type: 'setOptions', payload: payload});
};

var init = function() {
    chrome.runtime.sendMessage({type: 'isLoggedIn'}, function(response) {
        console.log("isLoggedIn:", response);
        $('#optionsSection').toggle(response);
        $('#logoutSection').toggle(response);
        $('#loginSection').toggle(!response);
    });

    $dueDate = $('#dueDate');
    $taskTitle = $('#taskTitle');
    $showNotification = $('#showNotification');
    $autoClose = $('#autoClose');
    $targetList = $('#targetList');
    $taskPriority = $('#taskPriority');
    $tagsList = $('#tagsList');

    chrome.runtime.sendMessage({type: 'getOptions'}, function(options) {
        console.log("Options:", options);
        $dueDate.val(options.dueDate);
        $taskTitle.val(options.taskTitle);
        $targetList.val(options.targetListId);
        $tagsList.val(options.tags);
        $taskPriority.val(options.taskPriority);
        $showNotification.prop('checked', options.showNotification);
        $autoClose.prop('checked', options.autoClose);
    });

    $('#login').click(login);
    $('#logout').click(logout);

    $dueDate.change(function() {
        setOptions({dueDate: $dueDate.val()});
    });
    $showNotification.change(function() {
        setOptions({showNotification: $showNotification.is(':checked')});
    });
    $taskTitle.change(function() {
        setOptions({taskTitle: $taskTitle.val()});
    });
    $autoClose.change(function() {
        setOptions({autoClose: $autoClose.is(':checked')});
    });
    $targetList.change(function() {
        setOptions({targetListId: $targetList.val().trim()});
    });
    $tagsList.change(function() {
        setOptions({tags: $tagsList.val().trim()});
    });
    $taskPriority.change(function() {
        setOptions({taskPriority: $taskPriority.val()});
    });
};

$(document).ready(function() {
    init();
});