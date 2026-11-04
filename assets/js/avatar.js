/*
 * avatar.js — 首屏头像：本地即显，CDN 后台升级
 *
 * 2026-11 之前是"CDN 接力"：静态 src 指向国内镜像，onerror/超时逐级换源。
 * 实测镜像（gravatar.loli.net）会把单个图片请求拖到 50 秒以上：
 * window.load 要等它，标签页加载转圈转半分多钟；换源链本身还要按
 * 每级 2.5s 空转，且 <img> 换 src 的瞬间头像区域会闪空。
 *
 * 现在反过来：
 *   1. index.html 的静态 src 直接用本地 assets/img/avatar.png ——
 *      同源、必成、52px 显示尺寸下与网络头像肉眼无差，硬刷新-proof；
 *   2. 本文件在离屏 Image 里后台预载镜像高清图，成功才无缝换 src；
 *      超时/失败就保持本地头像，页面从此不依赖任何外部头像服务。
 *
 * 改邮箱时：更新这里的 HASH（md5(邮箱)）与重新生成本地 avatar.png。
 */
(function () {
    "use strict";

    var img = document.getElementById("hero-avatar");
    if (!img) return;

    var HASH = "6a04c274eb3d604821b4917304f0e7ae";
    var TIMEOUT = 4000; // 离屏预载的耐心上限；超时就安心用本地头像
    // 1px GIF：超时后覆盖 src，立即掐断可能悬挂几十秒的连接，
    // 否则离屏 Image 也一样挂住 window.load（标签页转圈的老问题）
    var ABORT = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

    // 本地兜底：升级失败时退回 index.html 里那个同源头像
    var LOCAL = img.getAttribute("src") || "assets/img/avatar.png";

    function upgrade(src) {
        var probe = new Image();
        // 离屏探测也是一次对外请求，隐私口径与可见 img 一致：不带 Referer
        probe.referrerPolicy = "no-referrer";
        var done = false;
        var timer = setTimeout(function () {
            if (done) return;
            done = true;
            probe.src = ABORT;
        }, TIMEOUT);
        probe.onload = function () {
            if (done) return;
            done = true;
            clearTimeout(timer);
            // 正式 <img> 未必吃到 probe 的缓存（镜像可能不给缓存头），
            // 挂一次性 onerror：升级加载失败就退回本地头像，不能留破图
            img.addEventListener(
                "error",
                function () {
                    img.src = LOCAL;
                },
                { once: true }
            );
            img.src = src; // 高清版已就绪，无缝替换
        };
        probe.onerror = function () {
            if (done) return;
            done = true;
            clearTimeout(timer);
        };
        probe.src = src;
    }

    upgrade("https://gravatar.loli.net/avatar/" + HASH + "?s=320&d=404");
})();
