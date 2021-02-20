var invalid_items = new Set();
var overlap_items = null;
var cart_items = new Set();
var bought_items = new Set();
var WORK_ID_REGULAR = /[RVBJ]{2}[0-9]{3,6}/;
var WORK_ID_REGULAR_ALL = /[RVBJ]{2}[0-9]{3,6}/g;

$.ajax({
    url: 'http://127.0.0.1:4567',
    type: 'GET',
    data: "QueryInvalidDLSite",
    cache: false
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
    data: "QueryOverlapDLSite",
    cache: false
}).done(function (result) {
    overlap_items = JSON.parse(result);
    for (let key in overlap_items)
        overlap_items[key] = new Set(overlap_items[key]);
    console.log("DB Sync Done 2,Record:", Object.keys(overlap_items).length);
});

UpdateCartItems();
UpdateBoughtItems(false);

//有xxx/RJxxx.html和xxx/RJxxx两种格式的网址
//同样的代码在不同的js里都出现了,目前不知道有什么好的方法解决
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
    onclick: function () { UpdateBoughtItems(true);}
});
chrome.contextMenus.create({
    title: "重命名本地文件",
    parentId: top_menu,
    onclick: function () { RenameLocal(true); }
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
        //查找覆盖该作品的作品,目前看来overlap_items比较小,直接枚举
        var overlapped = [];
        for (let key in overlap_items)
            for (let item of overlap_items[key])
                if (item == request.code)
                    overlapped.push(key);
        sendResponse({ "db": tmp, "overlap": overlap_items[request.code] ? Array.from(overlap_items[request.code]).join(" ") : "", "overlapped": overlapped.join(" ")});
    }
    else if (request.cmd == "markEliminated" || request.cmd =="markSpecialEliminated") {
        $.ajax({
            url: 'http://127.0.0.1:4567',
            type: 'GET',
            data: request.cmd + request.code,
            async: false,//异步执行的话SendResponse会失效
            timeout: 2000,
            cache: false
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
            timeout: 2000,
            cache: false
        }).success(function (result) {
            console.log("markOverlap " + request.code[0] + " " + request.code[1] + " " + result);
            if (!overlap_items[request.code[0]])
                overlap_items[request.code[0]] = new Set();
            overlap_items[request.code[0]].add(request.code[1]);
            if (request.code[2]) {
                if (!overlap_items[request.code[1]])
                    overlap_items[request.code[1]] = new Set();
                overlap_items[request.code[1]].add(request.code[0]);
            }
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
        path: '/maniax/cart',
        cache:false//不使用缓存
    }).done(function (result) {
        //把乱七八糟的变成文本,省的报错
        result = result.replace(/<script/g, "<a");
        result = result.replace(/<\/script/g, "</a");
        result = result.replace(/<link/g, "<a");
        result = result.replace(/<\/link"/g, "</a");
        result = result.replace(/<img/g, "<a");
        result = result.replace(/<\/img"/g, "</a");
        $('#tmp_area').append(jQuery.parseHTML(result));
        cart_items.clear();
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
        document.getElementById("tmp_area").innerHTML = "";
        console.log("Cart Info Updated",cart_items.size);
    });
}

function RenameLocal(need_download) {
    $.ajax({
        url: 'http://127.0.0.1:4567/?RenameLocal',
        type: 'Get',
        cache: false
    }).success(function (result) {
        console.log("Rename Started");
    });
}

function UpdateBoughtItems(need_download) {
    $.ajax({
        url: 'https://ssl.dlsite.com/maniax/load/bought/product',
        type: 'GET',
        path: '/maniax/cart',
        cache: false
    }).done(function (result) {
        //从网站获取数据
        var obj = JSON.parse(result);
        var tmp = "";
        for (let work of obj["boughts"]){
            bought_items.add(work);
            tmp += work + " ";
        }
        console.log("Local Bought Items Updated", bought_items.size);
        //更新到本地server
        if (!need_download)
            $.ajax({
                url: 'http://127.0.0.1:4567/?UpdateBoughtItems',
                type: 'POST',
                data: tmp,
                cache: false
            }).success(function (result) {
                console.log("Server Bought Items Updated", bought_items.size);
                });
        else
            $.ajax({
                url: 'http://127.0.0.1:4567/?UpdateBoughtItems',
                type: 'POST',
                data: tmp,
                cache: false
            }).success(function (result) {
                StartDownload();
                });
    });
}

function StartDownload() {
    //先下载一次刷新cookie?不知道有没有用
    $.ajax({
        //url: 'https://www.dlsite.com/maniax/download/=/product_id/RJ258916.html',
        url:'https://ssl.dlsite.com/maniax/mypage',
        //url:'https://download.dlsite.com/get/=/type/work/domain/doujin/dir/RJ299000/file/RJ298231.part1.exe/_/20200903152647',
        type: 'HEAD',
        cache: false,        
    }).done(function (result) {
//        chrome.cookies.getAll({ "url": "https://www.dlsite.com/maniax/download/=/product_id/RJ258916.html" }, function (cookies) {
//          chrome.cookies.getAll({ "domain": "dlsite.com" }, function (cookies) {
        chrome.cookies.getAll({ "url": "https://download.dlsite.com/get/=/type/work/domain/doujin/dir/RJ299000/file/RJ298231.part2.rar/_/20200903152755" }, function (cookies) {
            var ret = "";
            for (let cookie of cookies)
                ret += cookie.name + "=" + cookie.value + "; ";
            $.ajax({
                url: 'http://127.0.0.1:4567?Download',
                type: 'POST',
                data: ret,
                cache: false,
                beforeSend: function (request) { request.setRequestHeader("user-agent",window.navigator.userAgent); }
            }).done(function (result) {
                console.log("Download Begin " + result);
            });
        });
    });
}
//测试用
function t() {
    UpdateBoughtItems();
}