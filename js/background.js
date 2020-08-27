var invalid_items = new Set();
var overlap_items = null;

$.ajax({
    url: 'http://127.0.0.1:4567',
    type: 'GET',
    data: "QueryInvalidDLSite"
}).done(function (result) {
    var tmp = result.split(" ");
    for (let item in tmp)
        if (item.length > 0)
            invalid_items.add(tmp[item]);
    console.log("DB Sync Done 1,Record:"+invalid_items.size);
    });

$.ajax({
    url: 'http://127.0.0.1:4567',
    type: 'GET',
    data: "QueryOverlapDLSite"
}).done(function (result) {
    overlap_items = JSON.parse(result);
    for (let key in overlap_items)
        overlap_items[key] = new Set(overlap_items[key]);
    console.log("DB Sync Done 2,Record:", Object.keys(overlap_items).length);
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
        for (var item of invalid_items)
            tmp = tmp + item + " ";
        if (request.code && overlap_items[request.code])
            sendResponse({ "db": tmp, "overlap": Array.from(overlap_items[request.code]).join(" ") });
        else
            sendResponse({ "db": tmp, "overlap": "" });
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
            invalid_items.add(request.code);
            sendResponse("Mark Sucess");
        });
    }
    else if (request.cmd == "CloseTab") {
        console.log("close tab:", sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
    }
    else if (request.cmd == "markOverlap") {
        $.ajax({
            url: 'http://127.0.0.1:4567',
            type: 'GET',
            data: "markOverlap&main="+request.code[0]+"&sub="+request.code[1]+"&duplex="+request.code[2],
            async: false,//异步执行的话SendResponse会失效
            timeout: 2000
        }).success(function (result) {
            console.log("markOverlap " + request.code[0] + " " + request.code[1] + " " + result);
            overlap_items[request.code[0]].add(request.code[1]);
            if (request.code[2])
                overlap_items[request.code[1]].add(request.code[0]);
            sendResponse(request.code[1]);
        });
    }
});
