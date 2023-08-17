import { JSDOM } from "./js/jsdom.js";

var invalid_items=new Set();
var overlap_items = null;
var cart_items = new Set();
var bought_items = new Set();
var WORK_ID_REGULAR = /[RVBJ]{2}[0-9]{3,8}/;
var WORK_ID_REGULAR_ALL = /[RVBJ]{2}[0-9]{3,8}/g;
console.log("Service Worker Start");
Init();
UpdateCartItems();
UpdateBoughtItems(false);

//无dom，不能使用ajax和XMLHttpRequest，用fetch代替;不能用domparser,导入mv3版的jsdom(https://github.com/guest271314/jsdom-extension)代替
async function Init() {
    //试试await语法 
    var result = await (await fetch('http://127.0.0.1:4567/?QueryInvalidDLSite', {
        method: "GET",
        headers: { 'Cache-Control': 'no-cache' }
    })).text();

    var tmp = result.split(" ");
    for (let item in tmp)
        if (item.length > 0)
            invalid_items.add(tmp[item]);
    console.log("DB Sync Done 1,Record:" + invalid_items.size);

    result = await (await fetch('http://127.0.0.1:4567/?QueryOverlapDLSite', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
    })).text();
    overlap_items = JSON.parse(result);
    for (let key in overlap_items)
        overlap_items[key] = new Set(overlap_items[key]);
    console.log("DB Sync Done 2,Record:", Object.keys(overlap_items).length);    
}

//有xxx/RJxxx.html和xxx/RJxxx两种格式的网址
//有时会在后面出现如/?locale=ja_JP
//同样的代码在不同的js里都出现了，目前不知道有什么好的方法解决
function GetFileName(path) {
    var tmp = path.split("/").reverse();
    for (let item of tmp) {
        var ret = item;
        ret = WORK_ID_REGULAR.exec(ret);
        if (ret)
            return ret[0];
    }
    return "";
}
//放在外面的代码会在每次重启serveice_work时都执行一次
chrome.runtime.onInstalled.addListener(() => {
    console.log("Init Context Menu");
    //右键菜单
    //v3必须提供id，不能重复创建，需要在onInstalled里创建
    var top_menu = chrome.contextMenus.create({ id: "My DLSiteHelper", title: "MyDLSiteHelper" });
    chrome.contextMenus.create({
        id: "MyDLSiteHelperDownloadAll",
        title: "下载全部",
        parentId: top_menu
    });
    chrome.contextMenus.create({
        id: "MyDLSiteHelperRename",
        title: "重命名本地文件",
        parentId: top_menu
    });
});

//addListener在onInstalled里，在chrome extension里重启会失效，why？
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    switch (info.menuItemId) {
        case "MyDLSiteHelperDownloadAll":
            UpdateBoughtItems(true);
            break;
        case "MyDLSiteHelperRename":
            RenameLocal(true);
            break;
    }
}
);

// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
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
        //如果service worker不能保持常时运行，导致查询请求在service worker初始化完成之前，就会在此处报错
        sendResponse({ "db": tmp, "overlap": overlap_items[request.code] ? Array.from(overlap_items[request.code]).join(" ") : "", "overlapped": overlapped.join(" ")});
    }
    else if (request.cmd == "markEliminated" || request.cmd == "markSpecialEliminated") {
        invalid_items.add(request.code);        
        sendResponse("Done");
    }
    else if (request.cmd == "CloseTab") {
        console.log("close tab:", sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
    }
    else if (request.cmd == "markOverlap") {
        if (!overlap_items[request.code[0]])
            overlap_items[request.code[0]] = new Set();
        overlap_items[request.code[0]].add(request.code[1]);
        if (request.code[2]) {
            if (!overlap_items[request.code[1]])
                overlap_items[request.code[1]] = new Set();
            overlap_items[request.code[1]].add(request.code[0]);
        }
        sendResponse({ "id":request.code[1], "duplex": request.code[2] });
    }
    else if (request.cmd == "updateCart") {
        UpdateCartItems();
    }
});
//获得购物车里的作品，不发送到本地，因为没有必要存进数据库
function UpdateCartItems() {
    fetch('https://www.dlsite.com/maniax/cart',{
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
    }).then(res => res.text()).then(function (result) {
        //把乱七八糟的变成文本,省的报错
        result = result.replace(/<script/g, "<a");
        result = result.replace(/<\/script/g, "</a");
        result = result.replace(/<link/g, "<a");
        result = result.replace(/<\/link"/g, "</a");
        result = result.replace(/<img/g, "<a");
        result = result.replace(/<\/img"/g, "</a");
        let dom = new JSDOM(result);
        var doc = dom.window.document;
        cart_items.clear();
        var cart = doc.getElementsByClassName("cart_list")[0];
        if (cart && cart.getElementsByClassName("work_name"))
            for (let dt of cart.getElementsByClassName("work_name")) {
                var a = dt.getElementsByTagName("a")[0];
                if (a) {
                    var id = GetFileName(a.href);
                    if (WORK_ID_REGULAR.test(id))
                        cart_items.add(id);
                }
            }
        console.log("Cart Info Updated ",cart_items.size);
    });
}
//向本地服务器发送重命名请求
function RenameLocal(need_download) {
    fetch('http://127.0.0.1:4567/?RenameLocal',{
        method: "GET",
        headers: { 'Cache-Control': 'no-cache' }
    }).then(result => result.text())
      .then(text =>console.log("Rename Started"));
}
//获得已购买作品并发送到本地服务器
function UpdateBoughtItems(need_download) {
    fetch('https://ssl.dlsite.com/maniax/load/bought/product',{
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
    }).then(res => res.text()).then(function (result) {
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
            fetch('http://127.0.0.1:4567/?UpdateBoughtItems',{
                method: 'POST',
                headers: { 'Cache-Control': 'no-cache' },
                body: tmp
            }).then(function (result) {
                if (result.ok)
                    console.log("Server Bought Items Updated", bought_items.size);
                else
                    console.log("Can't UpdateBoughtItems");
                });
        else
            fetch('http://127.0.0.1:4567/?UpdateBoughtItems', {
                method: 'POST',
                headers: { 'Cache-Control': 'no-cache' },
                body: tmp
            }).then(function (result) {
                if (result.ok)
                    StartDownload();
                else
                    console.log("Can't UpdateBoughtItems");
            });
    });
}
//向本地服务器发送下载请求
async function StartDownload() {
    //先下载一次刷新cookie?不知道有没有用
    Promise.race([
        new Promise((resolve, reject) => { setTimeout(resolve, 1500, 'head timeout,ignore'); }),
        fetch('https://www.dlsite.com/maniax/download/=/product_id/RJ258916.html', {
        //url:'https://ssl.dlsite.com/maniax/mypage',
        //url:'https://download.dlsite.com/get/=/type/work/domain/doujin/dir/RJ299000/file/RJ298231.part1.exe/_/20200903152647',
        method: "HEAD",
        headers: { 'Cache-Control': 'no-cache' }
        }
    )]);
    //chrome.cookies.getAll({ "url": "https://download.dlsite.com/get/=/type/work/domain/doujin/dir/RJ299000/file/RJ298231.part2.rar/_/20200903152755" }, function (cookies) {
    var cookies=await chrome.cookies.getAll({ "url": "https://www.dlsite.com/maniax/download/=/product_id/RJ258916.html" });
    var ret = "";
    for (let cookie of cookies)
        ret += cookie.name + "=" + cookie.value + "; ";
    console.log("Trying to Start Download,this may take few minutes.");
    var res = await fetch('http://127.0.0.1:4567?Download', {
        method: "POST",
        headers: { 'Cache-Control': 'no-cache' },
        body: ret,
        //无需手动设置user-agent,本来就会带上
    });
    if(res.ok)
        console.log("Download Begin " + res.text());
    else
        console.log("Download Fail.");
}

let lifeline;
console.log("Service Worker Start keep alive loop");
keepAlive();
//防止service worker自己关闭
chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'keepAlive') {
        lifeline = port;
        setTimeout(keepAliveForced, 25e3); // 25sec，如果30秒没有新事件service worker就会关闭 #https://developer.chrome.com/blog/longer-esw-lifetimes/
        port.onDisconnect.addListener(keepAliveForced);
    }
});

function keepAliveForced() {
    lifeline?.disconnect();
    lifeline = null;
    keepAlive();
}

async function keepAlive() {
    if (lifeline) return;
    for (const tab of await chrome.tabs.query({ url: '*://*/*' })) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => chrome.runtime.connect({ name: 'keepAlive' }),
                // `function` will become `func` in Chrome 93+
            });
            chrome.tabs.onUpdated.removeListener(retryOnTabUpdate);
            return;
        } catch (e) { }
    }
    chrome.tabs.onUpdated.addListener(retryOnTabUpdate);
}

async function retryOnTabUpdate(tabId, info, tab) {
    if (info.url && /^(file|https?):/.test(info.url)) {
        keepAlive();
    }
}