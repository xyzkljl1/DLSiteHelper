// 通过postMessage调用content-script
var my_db = new Set();
var close_when_done = false;
window.onload = function () {
    window.postMessage({ cmd: 'query' }, '*');
};
/*
function invokeContentScript(code)
{
	window.postMessage({cmd: 'invoke', code: code}, '*');
}*/

window.addEventListener("message", function (e) {
    if (e.data && e.data.cmd == 'setData') {
        var tmp = e.data.code.split(" ");
        for (let item in tmp)
            if (item.length > 0)
                my_db.add(tmp[item]);
        console.log('Inject.js Got DB：' + my_db.size);
        ReplaceAllItem();
        //这几个滑块变更时需要重新判定
        var same_voice_item = document.getElementById("__work_same_voice");
        if (same_voice_item)
            same_voice_item.setAttribute("onresize","javascript:ReplaceRelatedItem()");
        var same_company_item = document.getElementById("__maker_works");
        if (same_company_item)
            same_company_item.setAttribute("onresize", "javascript:ReplaceRelatedItem()");
        var same_series_item = document.getElementById("__work_same_series");
        if (same_series_item)
            same_series_item.setAttribute("onresize", "javascript:ReplaceRelatedItem()");
    } else if (e.data && e.data.cmd == 'markDone') {
        if (close_when_done)
            CloseWindow();
        else
        {
            var id = GetFileName(window.location.href);
            my_db.add(id);
            ReplaceTitleItem();
        }
    }
}, false);

function MarkEliminated() {
    var id = GetFileName(window.location.href);
    if (IsItemValid(id))
        window.postMessage({ cmd: 'markEliminated', code: id }, '*');
}

function MarkEliminatedAndClose() {
    close_when_done = true;
    var id = GetFileName(window.location.href);
    if (IsItemValid(id))
        window.postMessage({ cmd: 'markEliminated', code: id }, '*');
    else
        CloseWindow();
}

function CloseWindow()
{
    //js不能关闭不是由自己打开的window，也不能使用chrome.tabs，所以需要由background查询tabs并关闭
    window.postMessage({ cmd: 'CloseTab' }, '*');
}

function IsItemValid(id) {
    if (my_db.has(id))
        return false;
    return true;
}

function GetFileName(path)
{
    return path.substring(path.lastIndexOf("/") + 1, path.lastIndexOf("."));
}

function SetLabelDisplayFalse(item) {
    //用dislpay:none会令滑块里display本来就不为none的元素数量不对，原因尚不清楚
    //只用于自己的display不变的标签
    var value = "display: none;";
    if (item.hasAttribute("style")) {
        var style = item.getAttribute("style");
        style = style.replace(value, '') + value;
        item.setAttribute("style", style);
    }
    else
        item.setAttribute("style", value);
}
function SetLabelVisibleFalse(item) {
    //用dislpay:none会令滑块里display本来就不为none的元素数量不对，原因尚不清楚
    //只用于自己的visibility不变的标签
    var value = "visibility: hidden;";
    if (item.hasAttribute("style")) {
        var style = item.getAttribute("style");
        style = style.replace(value, '') + value;
        item.setAttribute("style", style);
    }
    else
        item.setAttribute("style",  value);
}
function SetLabelVisibleTrue(item) {
    var value = "visibility: hidden;";
    if (item.hasAttribute("style")) {
        var style = item.getAttribute("style");
        style = style.replace(value,'');
        item.setAttribute("style", style);
    }
}


function ReplaceAllItem() {
    ReplaceTitleItem();
    ReplaceRelatedItem();
    ReplaceRecommendAndSearchItem();
}

//标题
function ReplaceTitleItem()
{
    var id = GetFileName(window.location.href);
    if (/[RVJ]{1,2}[0-9]{1,6}/.test(id))
        if (!IsItemValid(id)) {
            var tmp = document.getElementsByClassName("base_title_br clearfix")[0].getElementsByTagName("h1")[0];
            var title = tmp.getElementsByTagName("a")[0];
            title.innerHTML = "<s>" + title.innerHTML + "</s>";
        }
}

function ReplaceRelatedItem() {
    //同系列、社团作品、同声优作品
    //只有部分元素,随页面变化
    for (let item of document.getElementsByClassName("work_ncol")) {
        var id = item.getAttribute("data-workno");
        if (!IsItemValid(id))
            SetLabelVisibleFalse(item.parentElement);
        else
            SetLabelVisibleTrue(item.parentElement);
    }
}

function ReplaceRecommendAndSearchItem() {
    //搜索列表，单列
    for (let item of document.getElementsByClassName("work_1col"))
    {
        var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            item.parentElement.parentElement.setAttribute("hidden", true);
    }
    //搜索列表，方阵
    for (let item of document.getElementsByClassName("work_img_main"))
    {
        var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            SetLabelVisibleFalse(item.parentElement);
    }
    //也购买过、也查看过、最近看过的作品
    //所有元素最初就存在,不会变更
    for (let item of document.getElementsByClassName("recommend_work_item")) {
        var address = item.getElementsByClassName("work_name")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item.parentElement);
    }
}