var invalid_items = new Set();
var overlap_items = null;
var cart_items = new Set();
var bought_items = new Set();
var WORK_ID_REGULAR = /[RVBJ]{1,2}[0-9]{3,6}/;
var WORK_ID_REGULAR_ALL = /[RVBJ]{1,2}[0-9]{3,6}/g;

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

UpdateCartItems();
UpdateBoughtItems();

//有xxx/RJxxx.html和xxx/RJxxx两种格式的网址
//同样的代码在不同的js里都出现了，目前不知道有什么好的方法解决
function GetFileName(path) {
    var ret = path.substring(path.lastIndexOf("/") + 1);
    if (ret.lastIndexOf(".") > 0)
        ret = ret.substring(0, ret.lastIndexOf("."));
    return ret;
}

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
        for (var item of cart_items)
            tmp = tmp + item + " ";
        for (var item of bought_items)
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
            data: "markOverlap&main=" + request.code[0] + "&sub=" + request.code[1] + "&duplex=" + request.code[2],
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
    else if (request.cmd == "updateCart") {
        UpdateCartItems();
    }
});

function UpdateCartItems() {
    $.ajax({
        url: 'https://www.dlsite.com/maniax/cart',
        type: 'GET',
        path: '/maniax/cart'

    }).done(function (result) {
        result = result.replace(/<script/g, "<a");
        result = result.replace(/<\/script/g, "</a");
        result = result.replace(/<link/g, "<a");
        result = result.replace(/<\/link"/g, "</a");
        result = result.replace(/<img/g, "<a");
        result = result.replace(/<\/img"/g, "</a");
        $('#tmp_area').append(jQuery.parseHTML(result));
        var cart = document.getElementById("tmp_area").getElementsByClassName("cart_list")[0];
        if (cart && cart.getElementsByClassName("work_name"))
            for (let dt of cart.getElementsByClassName("work_name")) {
                var a = dt.getElementsByTagName("a")[0];
                if (a) {
                    var id = GetFileName(a.href);
                    if (WORK_ID_REGULAR.test(id))
                        cart_items.add(id);
                }
            }
        console.log("Cart Info Updated",cart_items.size);
    });
}

function UpdateBoughtItems() {
    $.ajax({
        url: 'https://ssl.dlsite.com/maniax/load/bought/product',
        type: 'GET',
        path: '/maniax/cart'

    }).done(function (result) {
        var obj = JSON.parse(result);
        for (let work of obj["boughts"])
            bought_items.add(work);
        console.log("Bought Info Updated", bought_items.size);
    });
}


function t() {
    UpdateBoughtItems();
}