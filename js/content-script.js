console.log('这是content script!');

// 注意，必须设置了run_at=document_start 此段代码才会生效
document.addEventListener('DOMContentLoaded', DoInject);
function DoInject(){
    // 注入自定义JS
    injectCustomJs();
    initCustomPanel();
}

function initCustomPanel()
{
    var path = window.location.href;
    var id = path.substring(path.lastIndexOf("/") + 1, path.lastIndexOf("."));
    if (/[RVJ]{1,2}[0-9]{1,6}/.test(id)) {
        var panel = document.createElement('div');
        panel.className = 'inject-panel';
        panel.setAttribute("style", "z-index:9999;");
        panel.innerHTML = `
		<div class="btn-area" id="DLHWorkInjectPanel">
			<a href="javascript:MarkEliminated()">已阅</a><br>
			<a href="javascript:MarkEliminatedAndClose()">已阅并关闭</a><br>
		</div>
		<div id="lalal">
		</div>
	`;
        document.body.appendChild(panel);
    }
}

function injectCustomJs(jsPath)
{
	jsPath = jsPath || 'js/inject.js';
	var temp = document.createElement('script');
	temp.setAttribute('type', 'text/javascript');
	temp.src = chrome.extension.getURL(jsPath);
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
    else if (e.data && ["query", "markEliminated", "markOverlap"].includes(e.data.cmd)) {
        chrome.runtime.sendMessage({ cmd: e.data.cmd, code: e.data.code?e.data.code:"" },
            function (response) {
                window.postMessage({ cmd: e.data.cmd + "Done", code: response });
            });
    }
    else if (e.data && ["CloseTab"].includes(e.data.cmd)) {
        chrome.runtime.sendMessage({ cmd: e.data.cmd, code: e.data.code ? e.data.code : "" });
    }
}, false);
