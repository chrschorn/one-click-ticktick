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
    $selectionAsTitle = $('#selectionAsTitle');
    $showNotification = $('#showNotification');
    $autoClose = $('#autoClose');

    chrome.runtime.sendMessage({type: 'getOptions'}, function(options) {
        console.log("Options:", options);
        $dueDate.val(options.dueDate);
        $selectionAsTitle.prop('checked', options.selectionAsTitle);
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
    $selectionAsTitle.change(function() {
        setOptions({selectionAsTitle: $selectionAsTitle.is(':checked')});
    });
    $autoClose.change(function() {
        setOptions({autoClose: $autoClose.is(':checked')});
    })
};

$(document).ready(function() {
    init();
});