﻿var WORK_ID_REGULAR = /[RVBJ]{2}[0-9]{3,8}/;
var WORK_ID_REGULAR_ALL = /[RVBJ]{2}[0-9]{3,8}/g;
console.log('ContentScript Begin');

// 注意，必须设置了run_at=document_start 此段代码才会生效
document.addEventListener('DOMContentLoaded', DoInject);
function DoInject() {
    //购入履历页面全都是已购买没有必要注入
    if (window.location.href == "https://www.dlsite.com/home/mypage/userbuy")
        return;
    // 注入自定义JS
    injectCustomJs();
    initCustomPanel();
}

//有xxx/RJxxx.html和xxx/RJxxx两种格式的网址
//同样的代码在不同的js里都出现了，目前不知道有什么好的方法解决
function GetFileName(path) {
    var ret = path.substring(path.lastIndexOf("/") + 1);
    if (ret.lastIndexOf(".") > 0)
        ret = ret.substring(0, ret.lastIndexOf("."));
    return ret;
}

function initCustomPanel()
{
    var id = GetFileName(window.location.href);
    if (WORK_ID_REGULAR.test(id)) {
        var panel = document.createElement('div');
        panel.className = 'inject-panel';
        panel.setAttribute("style", "z-index:9999;display:none;");
        panel.innerHTML = `
		<div class="btn-area" id="DLHWorkInjectPanel">
            <div><a class="mymarkbtn" href="javascript:MarkEliminated(false)">已阅</a></div>
            <div><a class="mymarkbtn" href="javascript:MarkEliminated(true)">已阅并关闭</a></div>
		</div>
		<div id="lalal">
		</div>
	`;
        document.body.appendChild(panel);
    }
}

function injectCustomJs()
{
	var jsPath = 'js/inject.js';
	var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    //temp.setAttribute('src', jsPath);
	temp.src = chrome.runtime.getURL(jsPath);
	temp.onload = function()
	{
		this.parentNode.removeChild(this);
	};
	document.body.appendChild(temp);
}

window.addEventListener("message", function(e)
{
    //console.log('收到消息：', e.data);
    if (e.data && e.data.cmd == 'invoke')
        eval('(' + e.data.code + ')');
    else if (e.data && ["query", "markEliminated", "markSpecialEliminated", "markOverlap"].includes(e.data.cmd)) {
        chrome.runtime.sendMessage({ cmd: e.data.cmd, code: e.data.code?e.data.code:"" },
            function (response) {
                window.postMessage({ cmd: e.data.cmd + "Done", code: response });
            });
    }
    else if (e.data && ["CloseTab","updateCart"].includes(e.data.cmd)) {
        chrome.runtime.sendMessage({ cmd: e.data.cmd, code: e.data.code ? e.data.code : "" });
    }
}, false);
