# DLSiteHelper  

DLSite专用Chrome插件，与运行在本地的[DLSiteHelperServer](https://github.com/xyzkljl1/DLSiteHelperServer)配套使用，需要在运行DLSiteHelperServer之后启动  

功能：  
标记商品为已读  
在DLSite的搜索、推荐、推送、排行页面 将 已下载/已购买/已加入购物车/(通过该插件)标记为已读的商品 隐藏掉  
触发DLSiteHelperServer的批量下载/批量重命名功能  
标记商品内容覆盖和特记排除(被已读商品覆盖的商品也视作已读，特记排除商品自身视作已读，但其覆盖的商品不被视作已读)  

  
  
现在是在load时替换元素的，所以会有闪烁，暂时没想到好的解决办法