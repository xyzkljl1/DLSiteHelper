// 通过postMessage调用content-script
var my_db = new Set();
var my_overlap_works =new Set();
var close_when_done = false;
var main_work_id = null;
var is_unreaded = false;
var WORK_ID_REGULAR = /[RVBJ]{1,2}[0-9]{3,6}/;
var WORK_ID_REGULAR_ALL = /[RVBJ]{1,2}[0-9]{3,6}/g;

window.onload = function () {
    main_work_id = GetFileName(window.location.href);
    if (!WORK_ID_REGULAR.test(main_work_id))
        main_work_id = null;
    window.postMessage({ cmd: 'query', code: main_work_id }, '*');
};
/*
function invokeContentScript(code)
{
	window.postMessage({cmd: 'invoke', code: code}, '*');
}*/

window.addEventListener("message", function (e) {
    if (e.data && e.data.cmd == 'queryDone') {
        var tmp = e.data.code["db"].split(" ");
        for (let item in tmp)
            if (item.length > 0)
                my_db.add(tmp[item]);
        if (e.data.code["overlap"])
            my_overlap_works = new Set(e.data.code["overlap"].split(" "));
        console.log('Inject.js Got DB：' + my_db.size + " " + my_overlap_works.size);

        //此时立刻替换能替换的
        ReplaceTitleItem();
        ReplaceRecommendAndSearchItem();
        ReplacePushItem();
        ReplaceRankItem();
        RefreshPanel();

        //同社团/系列/声优作品列表,resize或者滑动时子项变化
        //监听childList或attributes无效需要用onresize，此时可能尚未加载完成(不知道为什么会这样)所以onload也要连接
        //_recommend_box_viewannouncegenresaleshistory是未发售作品页面下方的"也查看了以下作品"，一样在滑动时子项变化
        /*注:
         * 总体来说：
         * 同社团/系列/声优作品，为关联作品，格式一致，子项浮动
         * 也查看/也购买/最近看过，即推荐作品，格式一致，子项固定
         但同样是作品页面下方的"也查看了以下作品"
         已发售作品下方的，子项固定，格式同推荐列表，没有id
         未发售作品下方的，子项浮动，格式同关联列表，id是_recommend_box_viewannouncegenresaleshistory
         而加入购物车弹出的，子项固定，但格式同关联列表，id为_recommend_box_viewsalesgenresaleshistory，跟前者对应

         也不知道是哪个傻逼写的代码
        */
        for (let id of ["__work_same_voice", "__maker_works", "__work_same_series","_recommend_box_viewannouncegenresaleshistory"]) {
            var list_item = document.getElementById(id);
            if (list_item) {
                ReplaceRelatedItem(list_item);
                list_item.setAttribute("onload", "javascript:ReplaceRelatedItem(" + id + ")");
                list_item.setAttribute("onresize", "javascript:ReplaceRelatedItem(" + id + ")");
            }
        }
        //之后可能会变化需要重新replace的元素：
        //点击加入购物车后出现的推荐列表,列表一开始就存在但为空，列表显示后获得子项且子项不会变动
        var MutationObserver = window.MutationObserver;
        {
            var list_item = document.getElementById("_recommend_box_viewsalesgenresaleshistory");
            if (list_item) {
                var observer = new MutationObserver(function () { ReplaceCartRecommendItem(); NoticeUpdateCart(); });
                observer.observe(list_item, { childList: true });
            }
        }        
        {//活动页面的搜索结果在点击左侧过滤器时不会刷新页面而是直接换掉整个列表,需要监听容器
            var container = document.getElementsByClassName("_search_result_container")[0];
            if (container) {
                var observer = new MutationObserver(function () { ReplaceRecommendAndSearchItem();  });
                observer.observe(container, { childList: true });
            }
        }
        //首页的pushlist，滑动时子项变化
        {
            var observer = new MutationObserver(function () { ReplacePushItem(); });
            for (let list_item of document.getElementsByClassName("push_list"))
                observer.observe(list_item, { childList: true });
        }
    }
    else if (e.data && e.data.cmd == 'markEliminatedDone') {
        if (close_when_done)
            CloseWindow();
        else {
            var id = GetFileName(window.location.href);
            my_db.add(id);
            ReplaceTitleItem();
            RefreshPanel();
        }
    }
    else if (e.data && e.data.cmd == 'markOverlapDone') {
        my_overlap_works.add(e.data.code);
        RefreshPanel();
    }
}, false);

function test() {
}

function NoticeUpdateCart() {
    window.postMessage({ cmd: 'updateCart', code:"" }, '*');
}

function MarkOverlap(sub_id,duplex) {
    window.postMessage({ cmd: 'markOverlap', code: [main_work_id, sub_id, duplex] }, '*');
}
function MarkOverlapDuplex(sub_id) {
    window.postMessage({ cmd: 'MarkOverlapDuplex', code: [main_work_id, sub_id] }, '*');
}
function MarkEliminated() {
    if (IsItemValid(main_work_id))
        window.postMessage({ cmd: 'markEliminated', code: main_work_id }, '*');
}
function MarkEliminatedAndClose() {
    close_when_done = true;
    if (IsItemValid(main_work_id))
        window.postMessage({ cmd: 'markEliminated', code: main_work_id }, '*');
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

//有xxx/RJxxx.html和xxx/RJxxx两种格式的网址
//同样的代码在不同的js里都出现了，目前不知道有什么好的方法解决
function GetFileName(path)
{
    var ret = path.substring(path.lastIndexOf("/") + 1);
    if (ret.lastIndexOf(".") > 0)
        ret = ret.substring(0, ret.lastIndexOf("."));
    return ret;
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

//商品页面的操作面板
function RefreshPanel() {
    var panel = document.getElementById("DLHWorkInjectPanel");
    if (main_work_id && panel) {
        var need_show_panel = false;
        for (let item of panel.getElementsByClassName("mymarkbtn"))
            if (IsItemValid(main_work_id)) {
                need_show_panel = true;
                item.setAttribute("style", "");
            }
            else
                item.setAttribute("style", "display:none;");

        while (panel.getElementsByClassName("myoverlapbtn")[0]) {
            panel.removeChild(panel.getElementsByClassName("myoverlapbtn")[0]);
            panel.removeChild(panel.getElementsByTagName("br")[0]);
        }
        var text_list = [];
        var ret = new Set();
        var area = document.getElementsByClassName("work_parts_area")[0];
        if (area)
            text_list.push(area.getElementsByTagName("p")[0].innerText);
        area = document.getElementsByClassName("work_article work_story")[0];
        if (area)
            text_list.push(area.innerText);
        for (let text of text_list)
            if (WORK_ID_REGULAR_ALL.test(text))
                for (let sub_id of text.match(WORK_ID_REGULAR_ALL))
                    ret.add(sub_id);
        if (ret.size > 1) {
            for (let sub_id of ret)
                if (!my_overlap_works.has(sub_id)) {
                    need_show_panel = true;
                    panel.insertAdjacentHTML("afterbegin", `<a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id + `',0)">覆盖` + sub_id + `</a><br>`);
                }
        }
        else if (ret.size == 1)
            for (let sub_id of ret)
                if (!my_overlap_works.has(sub_id)) {
                    need_show_panel = true;
                    panel.insertAdjacentHTML("afterbegin", `<a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id + `',0)">覆盖` + sub_id + `</a><br>`);
                    panel.insertAdjacentHTML("afterbegin", `<a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id + `',1)">双向覆盖` + sub_id + `</a><br>`);
                }

        if (need_show_panel)
            panel.parentElement.setAttribute("style", panel.parentElement.getAttribute("style").replace("display:none;", ''));
        else
            panel.parentElement.setAttribute("style", "display:none;");
    }
    else if (panel)
        panel.parentElement.setAttribute("style","display:none;");

}

//商品页面的标题
function ReplaceTitleItem()
{
    if (main_work_id)
        if (!IsItemValid(main_work_id)) {
            var tmp = document.getElementsByClassName("base_title_br clearfix")[0].getElementsByTagName("h1")[0];
            var title = tmp.getElementsByTagName("a")[0];
            title.innerHTML = "<s>" + title.innerHTML + "</s>";
        }
}

//首页侧边栏的rank
function ReplaceRankItem()
{
    //以开始就具有全部子项,点击名次选项卡时display变化，因此直接删掉是最好的
    //固定有前30名，分别使用不同的class name
    for (let list of document.getElementsByClassName("rank_content"))
        for (var i = 1; i <= 30; i++)
        {
            var item=list.getElementsByClassName("rank" + i)[0];
            if (item)
            {
                var id = GetFileName(item.getElementsByTagName("a")[0].getAttribute("href"));
                if (!IsItemValid(id))
                    item.parentElement.removeChild(item);
            }
        }
}

//首页上方的推送列表
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

//同系列、社团作品、同声优作品
//src为空时替换整个页面中的元素，否则只替换src下的元素
function ReplaceRelatedItem(src=null) {
    var array = src.getElementsByClassName("work_ncol");
    //只有部分元素,随页面变化
    for (let item of array) {
        var id = item.getAttribute("data-workno");
        SetLiLabelVisible(item.parentElement, IsItemValid(id));
        //SetLiLabelWhite(item.parentElement, IsItemValid(id));
    }
}

//点击加入购物车后弹出页面的列表
function ReplaceCartRecommendItem() {
    var list_item = document.getElementById("_recommend_box_viewsalesgenresaleshistory");
    //格式上跟ReplaceRelatedItem的列表相同，可以用ReplaceRelatedItem替代
    //但是由于这个列表的子项不会在滑动时变化，所以用ReplaceRecommendAndSearchItem的方式隐藏效果更好
    for (let item of list_item.getElementsByClassName("work_ncol")) {
        var id = item.getAttribute("data-workno");
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item.parentElement);
    }
}

//搜索结果/社团/活动列表，首页下方的worklist，也购买过、也查看过、最近看过的作品
function ReplaceRecommendAndSearchItem() {
    //单列搜索结果列表/社团商品列表/活动商品列表，社团发售预告列表
    for (let item of document.getElementsByClassName("work_1col"))
    {
        var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            item.parentElement.parentElement.setAttribute("hidden", true);
    }
    //方阵搜索结果列表/社团商品列表/活动商品列表
    for (let item of document.getElementsByClassName("work_img_main"))
    {
        var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item.parentElement);
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