// 通过postMessage调用content-script
var my_db = new Set();
var my_overlap_works = new Set();
var my_overlapped_works = new Set();
var main_work_id = null;
var is_unreaded = false;
var WORK_ID_REGULAR = /[RVBJ]{2}[0-9]{3,8}/;
var WORK_ID_REGULAR_ALL = /[RVBJ]{2}[0-9]{3,8}/g;

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
        if (e.data.code["overlapped"])
            my_overlapped_works = new Set(e.data.code["overlapped"].split(" "));
        //此时立刻替换能替换的
        ReplaceTitleItem();
        ReplaceRecommendAndSearchItem();
        ReplacePushItem();
        ReplaceRankItem();
        ReplaceGenreItem();
        RefreshPanel();

        //同社团/系列/声优作品列表,resize或者滑动时子项变化
        //监听childList或attributes无效需要用onresize，此时可能尚未加载完成(不知道为什么)所以onload也要连接,但仍然有时初始状态没替换掉，不知道怎么解决
        //_recommend_box_viewannouncegenresaleshistory是未发售作品页面下方的"也查看了以下作品"，一样在滑动时子项变化
        /*注:
         * 总体来说：
         * 同社团/系列/声优作品，为关联作品[Related]，格式一致，子项浮动
         * 也查看/也购买/最近看过，即推荐作品[Recommend]，格式一致，子项固定
         * 首页上方的打折/推荐为推送作品[Push]，格式一致，子项固定
         * 排行页面的排行为[Rank],首页的综合排行为[Recommend]，首页的分类别排行为单独格式(与Recommend一起处理)
         * 类别首页(如maniax/works/voice)上方的排行/推荐是类别作品[Genre]，子项固定(与一般关联/推荐作品、其它地方的排行都不同)
         * 显示和隐式的搜索结果为[Search],新作品列表等也属于搜索作品
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
                var observer = new MutationObserver(function () { ReplaceCartRecommendItem();});
                observer.observe(list_item, { childList: true });
            }
        }
        //加入购物车按钮
        {
            var items = document.getElementsByClassName("btn_cart");
            if (items)
                for (let item of items)
                    item.onclick = NoticeUpdateCart;
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
        //首页下方的新作品列表(new_worklist)，具有若干work_block,每个block动态加载若干n_worklist_item
        //点击"更多"按钮时，添加若干work_block
        //因此要递归监听(subtree)
        {
            var observer = new MutationObserver(function () { ReplaceNewWorklist(); });
            var item = document.getElementById("new_worklist");
            if(item)
                observer.observe(item, { childList: true,subtree:true });
        }
    }
    else if (e.data && e.data.cmd == 'markEliminatedDone') {
        var id = GetFileName(window.location.href);
        my_db.add(id);
        ReplaceTitleItem();
        RefreshPanel();
    }
    else if (e.data && e.data.cmd == 'markOverlapDone') {
        console.log(e.data.code);
        my_overlap_works.add(e.data.code["id"]);
        if (e.data.code["duplex"])
            my_overlapped_works.add(e.data.code["id"]);
        RefreshPanel();
    }
    else if (e.data && e.data.cmd == 'markSpecialEliminatedDone') {
        my_db.add(main_work_id);
        ReplaceTitleItem();
        RefreshPanel();
    }

}, false);


function NoticeUpdateCart() {
    window.postMessage({ cmd: 'updateCart', code:"" }, '*');
}

function MarkOverlap(sub_id, duplex) {
    $.ajax({
        url: 'http://127.0.0.1:4567',
        type: 'GET',
        data: "markOverlap&main=" + main_work_id + "&sub=" + sub_id + "&duplex=" + duplex,
        timeout: 2000,
        cache: false
    }).success(function (result) {
        console.log("markOverlap " + main_work_id + " " + sub_id + " Success");
        window.postMessage({ cmd: 'markOverlap', code: [main_work_id, sub_id, duplex] }, '*');
    });
}

function MarkSpecialEliminated() {
    if (IsItemValid(main_work_id))
        $.ajax({
            url: 'http://127.0.0.1:4567',
            type: 'GET',
            data: 'markSpecialEliminated' + main_work_id,
            timeout: 2000,
            cache: false
        }).success(function (result) {
            console.log("MarkSP " + main_work_id);
            window.postMessage({ cmd: 'markSpecialEliminated', code: main_work_id }, '*');
        });
}

function MarkEliminated(close_window) {
    if (IsItemValid(main_work_id)) {
        $.ajax({
            url: 'http://127.0.0.1:4567',
            type: 'GET',
            data: 'markEliminated' + main_work_id,
            timeout: 2000,
            cache: false
        }).success(function (result) {
            console.log("Mark " + main_work_id);
            window.postMessage({ cmd: 'markEliminated', code: main_work_id }, '*');
            if (close_window)
                CloseWindow();
        });
    }
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
//有时会在后面出现如/?locale=ja_JP
//同样的代码在不同的js里都出现了，目前不知道有什么好的方法解决
function GetFileName(path) {
    var tmp = path.split("/").reverse();
    for (let item of tmp) {
        var ret = item;
        ret = WORK_ID_REGULAR.exec(ret);
        if(ret)
            return ret[0];
    }
    return "";
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
        //设置标记已读按钮
        for (let item of panel.getElementsByClassName("mymarkbtn"))
            if (IsItemValid(main_work_id)) {
                need_show_panel = true;
                item.setAttribute("style", "");
            }
            else
                item.setAttribute("style", "display:none;");
        //移除旧的按钮
        while (panel.getElementsByClassName("myoverlapbtn")[0]) 
            panel.removeChild(panel.getElementsByClassName("myoverlapbtn")[0].parentElement);
        while (panel.getElementsByClassName("myoverlappedbtn")[0])
            panel.removeChild(panel.getElementsByClassName("myoverlappedbtn")[0].parentElement);
        while (panel.getElementsByClassName("myoverlaphint")[0])
            panel.removeChild(panel.getElementsByClassName("myoverlaphint")[0].parentElement);
        while (panel.getElementsByClassName("myspoverlapbtn")[0])
            panel.removeChild(panel.getElementsByClassName("myspoverlapbtn")[0].parentElement);
        //检查是否需要标记覆盖
        var ret = new Map();
        {//正文提到的其它作品
            var text_list = [];
            for (let area of document.getElementsByClassName("work_parts_area"))
                text_list.push(area.innerText);
            for (let area of document.getElementsByClassName("work_article work_story"))
                text_list.push(area.innerText);
            for (let text of text_list)
                if (WORK_ID_REGULAR_ALL.test(text))
                    for (let sub_id of text.match(WORK_ID_REGULAR_ALL))
                        if (sub_id != main_work_id)
                            ret.set(sub_id,"");
        }
        {//其它语言版本
            for (let item of document.getElementsByClassName("work_edition_linklist_item"))
            {
                var sub_id = GetFileName(item.href);
                if (sub_id != main_work_id)
                    ret.set(sub_id, item.innerText);
            }
        }
        //console.log(text_list);
        //console.log(ret);
        //添加标记该作品覆盖其它作品的按钮
        if (ret.size > 1) {
            for (let sub_id of ret)
                if (!my_overlap_works.has(sub_id[0])) {
                    need_show_panel = true;
                    if (sub_id[1]!="")//其它语言版本全部视为双向覆盖
                        panel.insertAdjacentHTML("afterbegin", `<div><a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id[0] + `',1)">双向覆盖` + sub_id[0] + ` ` + sub_id[1] + `</a></div>`);
                    else
                        panel.insertAdjacentHTML("afterbegin", `<div><a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id[0] + `',0)">覆盖` + sub_id[0] + ` ` + sub_id[1] + `</a></div>`);
                }
        }
        else if (ret.size == 1)
            for (let sub_id of ret)
                if (!my_overlap_works.has(sub_id[0])) {
                    need_show_panel = true;
                    panel.insertAdjacentHTML("afterbegin", `<div><a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id[0] + `',0)">覆盖` + sub_id[0] + ` ` + sub_id[1] + `</a></div>`);
                    panel.insertAdjacentHTML("afterbegin", `<div><a class="myoverlapbtn" href="javascript:MarkOverlap('` + sub_id[0] + `',1)">双向覆盖` + sub_id[0] + ` ` + sub_id[1] + `</a></div>`);
                }
        //添加覆盖提示
        if (my_overlap_works.size > 0&&IsItemValid(main_work_id)){
            need_show_panel = true;
            var ct = 0;
            for (let id of my_overlap_works)
                if (my_db.has(id))
                    ct++;
            //特记排除，如果想排除该作品，且不想连带排除其覆盖的作品，则使用特记排除
            if (ct == my_overlap_works.size)
                panel.insertAdjacentHTML("afterbegin", `<div><a class="myspoverlapbtn" href="javascript:MarkSpecialEliminated()">特记排除</a></div>`);
            panel.insertAdjacentHTML("afterbegin", `<div><a class="myoverlaphint">覆盖` + ct + "/" + my_overlap_works.size + `</a></div>`);
        }
        //添加覆盖该作品的作品
        for (let id of my_overlapped_works)
            {
            need_show_panel = true;
            //该作品可能不是/maniax/work下的，但都会自动转过去
            var url = "https://www.dlsite.com/maniax/work/=/product_id/" + id + ".html";
            //用afterend会加到panel的平级，beforeend才会加到panel的子元素
            panel.insertAdjacentHTML("beforeend", `<div><a class="myoverlappedbtn" href="` + url + `">包含于` + id + `</a></div>`);
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
            for (let item of document.getElementsByClassName("base_title_br clearfix")) {
                var title=item.getElementsByTagName("h1")[0];
                title.outerHTML = "<s>" + title.outerHTML + "</s>";
            }
        }
}

//特定类别的推荐/排行/打折作品,如maniax/works/voice顶部的滑动条，固定
function ReplaceGenreItem() {   
    for (let item of document.getElementsByClassName("genre_work_item")) {
        var address = item.getElementsByClassName("genre_work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item);
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
function ReplaceRelatedItem(src) {
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
//    for (let item of list_item.getElementsByClassName("work_ncol")) {
    for (let item of list_item.getElementsByClassName("n_work_list_item swiper-slide _recommend_swiper_slide")) {
        //有两种格式
        var sub_item = item.getElementsByClassName("swiper-slide")[0];
        var id = "";
        if (sub_item) 
            id = sub_item.getAttribute("data-prod");
        else {
            sub_item = item.getElementsByClassName("work_ncol")[0];
            id = sub_item.getAttribute("data-workno");
        }
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item);

    }
}

//首页下方的worklist
function ReplaceNewWorklist(){

    for (let item of document.getElementsByClassName("n_worklist_item"))
        if (item.getElementsByClassName("work_name").length > 0) {
            var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
            var id = GetFileName(address);
            if (!IsItemValid(id))
                item.setAttribute("hidden", true);
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
    //首页下方的new_worklist
    ReplaceNewWorklist();
    //也购买过、也查看过、最近看过的作品
    //所有元素最初就存在,不会变更
    //在产品页面和首页都有，但是在产品页面work_name具有href，在首页上则是work_name下的a具有href
    for (let item of document.getElementsByClassName("recommend_work_item")) {
        var work_name_item = item.getElementsByClassName("work_name")[0];
        if (work_name_item.hasAttribute("href"))
            address = work_name_item.getAttribute("href");
        else
            address = work_name_item.getElementsByTagName("a")[0].getAttribute("href");
        var id = GetFileName(address);
        if (!IsItemValid(id))
            SetLabelDisplayFalse(item.parentElement);
    }
    //首页的分类别排行
    for (let class_name of [ "genre_ranking_item","genre_ranking_sub_item"])
        for (let item of document.getElementsByClassName(class_name)) {
            var address = item.getElementsByClassName("work_name")[0].getElementsByTagName("a")[0].getAttribute("href");
            var id = GetFileName(address);
            if (!IsItemValid(id))
                SetLabelDisplayFalse(item);
        }
}