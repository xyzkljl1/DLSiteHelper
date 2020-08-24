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

        //此时立刻替换能替换的
        ReplaceTitleItem();
        ReplaceRelatedItem();
        ReplaceRecommendAndSearchItem();
        ReplacePushItem();

        //之后可能会变化需要重新replace的元素：
        //点击加入购物车后出现的推荐列表,列表一开始就存在但为空，列表显示后获得子项且子项不会变动
        var MutationObserver = window.MutationObserver;
        {
            var list_item = document.getElementById("_recommend_box_viewsalesgenresaleshistory");
            if (list_item) 
            {
                var observer = new MutationObserver(function () { ReplaceCartRecommendItem(); });
                observer.observe(list_item, { childList: true });
            }
        }
        //同社团/系列/声优作品列表,resize或者滑动时子项变化
        //监听childList或attributes无效需要用onresize
        //此时可能尚未加载完成(不知道为什么会这样)所以onload也要连接
        for (let id of ["__work_same_voice", "__maker_works", "__work_same_series"])
        {
            var list_item = document.getElementById(id);
            if (list_item) {
                list_item.setAttribute("onload", "javascript:ReplaceRelatedItem("+id+")");
                list_item.setAttribute("onresize", "javascript:ReplaceRelatedItem(" + id +")");
            }
        }
        //首页的pushlist，滑动时子项变化
        {
            var observer = new MutationObserver(function () { ReplacePushItem(); });
            for (let list_item of document.getElementsByClassName("push_list"))
                observer.observe(list_item, { childList: true });
        }
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

function test() {
    console.log("test triggered");
}

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
function SetLiLabelVisible(item,enable) {
    //用dislpay:none会令滑块里display本来就不为none的元素数量不对，原因尚不清楚
    //只用于自己的visibility不变的标签
    var value = "visibility: hidden;";
    if (!enable) {
        if (item.hasAttribute("style")) {
            var style = item.getAttribute("style");
            style = style.replace(value, '') + value;
            item.setAttribute("style", style);
        }
        else
            item.setAttribute("style", value);
    }
    else
    {
        if (item.hasAttribute("style")) {
            var style = item.getAttribute("style");
            style = style.replace(value, '');
            item.setAttribute("style", style);
        }
    }
}

function SetLiLabelWhite(top, enable) {
    var value = "background-color:white;color: white;";
    for (let tagname of ["a", "span"])
        for (let item of top.getElementsByTagName(tagname))
            if (!enable) {
                if (item.hasAttribute("style")) {
                    var style = item.getAttribute("style");
                    style = style.replace(value, '') + value;
                    item.setAttribute("style", style);
                }
                else
                    item.setAttribute("style", value);
            }
            else {
                if (item.hasAttribute("style")) {
                    var style = item.getAttribute("style");
                    style = style.replace(value, '');
                    item.setAttribute("style", style);
                }
            }
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


function ReplacePushItem() {
    for (let list of document.getElementsByClassName("push_list"))
        for (let item of list.getElementsByTagName("li"))
        {
            var name_item = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0];
            if (name_item)
            {
                var id = GetFileName(name_item.getAttribute("href"));
                SetLiLabelVisible(item, IsItemValid(id));
            }
        }
}

//src为空时替换整个页面中的元素，否则只替换src下的元素
function ReplaceRelatedItem(src=null) {
    var array;
    if (src)
        array = src.getElementsByClassName("work_ncol");
    else
        array = document.getElementsByClassName("work_ncol"); 
    //同系列、社团作品、同声优作品
    //只有部分元素,随页面变化
    for (let item of array) {
        var id = item.getAttribute("data-workno");
        SetLiLabelVisible(item.parentElement, IsItemValid(id));
        //SetLiLabelWhite(item.parentElement, IsItemValid(id));
    }
}

function ReplaceCartRecommendItem() {
    var list_item = document.getElementById("_recommend_box_viewsalesgenresaleshistory");
    //点击加入购物车后弹出页面的列表
    //格式上跟ReplaceRelatedItem的列表相同，可以用ReplaceRelatedItem替代
    //但是由于这个列表的子项不会在滑动时变化，所以用ReplaceRecommendAndSearchItem的方式隐藏效果更好
    for (let item of list_item.getElementsByClassName("work_ncol")) {
        var id = item.getAttribute("data-workno");
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item.parentElement);
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
            SetLiLabelVisible(item.parentElement,false);
    }
    //首页下方的worklist
    for (let item of document.getElementsByClassName("n_worklist_item")) {
        var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            item.setAttribute("hidden",true);
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