var db = new Set();

$.ajax({
    url: 'http://127.0.0.1:4567',
    type: 'GET',
    data: "QueryDLSite"
}).done(function (result) {
    var tmp = result.split(" ");
    for (let item in tmp)
        if (item.length > 0)
            db.add(tmp[item]);
    console.log("DB Sync Done,Record:"+db.size);
    });

//右键菜单
var top_menu=chrome.contextMenus.create({title: "My DLSiteHelper"});
chrome.contextMenus.create({
    title: "下载全部",
    parentId: top_menu,
    onclick: function () {
        $.ajax({
            url: 'http://127.0.0.1:4567',
            type: 'GET',
            data: "Download"
        }).done(function (result) {
            console.log("Download Begin "+result);
        });
    }
});

// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    //console.log('Receive From Content:',request);
    if (request.cmd == "query") {
        var tmp = "";
        for (var item of db)
            tmp = tmp + item + " ";
        sendResponse(tmp);
    }
    else if (request.cmd == "markEliminated") {
        $.ajax({
            url: 'http://127.0.0.1:4567',
            type: 'GET',
            data: "markEliminated" + request.code,
            async: false,//异步执行的话SendResponse会失效
            timeout: 2000
        }).success(function (result) {
            console.log("Mark " + request.code + " " + result);
            db.add(request.code);
            sendResponse("Mark Sucess");
        });
    }
    else if (request.cmd == "CloseTab") {
        console.log("close tab:",sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
    }
});
