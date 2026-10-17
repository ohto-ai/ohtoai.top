/*
 * avatar.js — 首屏头像的国内外 CDN 接力
 *
 * 头像托管在 Gravatar（邮箱 me@ohtoai.top，哈希 = md5("me@ohtoai.top")）。
 * gravatar.com 在国外最稳，国内却经常慢或连不上；gravatar.loli.net 是
 * 国内镜像，代理的是同一张图。于是按下面顺序接力：
 *
 *   1. gravatar.loli.net   国内镜像，index.html 里的静态 src 已经指向它
 *   2. gravatar.com        Gravatar 官方
 *   3. github.com          个人 GitHub 头像
 *   4. assets/img/avatar.png  本地文件，同源兜底
 *
 * 每个源最多等 2.5 秒。有的网络对连不上的域名既不返回成功也不报错，
 * 只靠 onerror 会一直空白，所以必须有超时看门狗。任意一源加载成功
 * 就清掉计时器，不再继续换源。
 *
 * 改邮箱时，这里的 HASH 和 index.html 里的静态 src 要一起更新。
 */
(function () {
    "use strict";

    var img = document.getElementById("hero-avatar");
    if (!img) return;

    var HASH = "6a04c274eb3d604821b4917304f0e7ae";
    var TIMEOUT = 2500;
    var SOURCES = [
        "https://gravatar.loli.net/avatar/" + HASH + "?s=320&d=404",
        "https://gravatar.com/avatar/" + HASH + "?s=160&d=404",
        "https://github.com/Ohto-Ai.png?size=160",
        "assets/img/avatar.png"
    ];

    var attempt = 0;
    var timer = 0;

    function trySource(i) {
        if (i >= SOURCES.length) return;
        clearTimeout(timer);
        attempt = i;
        img.src = SOURCES[i];
        timer = setTimeout(function () {
            // 只有还停留在同一个源上才继续接力，避免迟到的计时器打乱顺序
            if (attempt === i) trySource(i + 1);
        }, TIMEOUT);
    }

    img.addEventListener("load", function () {
        clearTimeout(timer);
    });

    img.addEventListener("error", function () {
        trySource(attempt + 1);
    });

    // 脚本在 </body> 前才执行，头像可能早已加载完成或早已失败，
    // 那两种事件都不会再派发，只能按 complete 先补判一次。
    if (img.complete) {
        // naturalWidth 为 0 表示已经失败了（成功的话什么都不用做）
        if (img.naturalWidth === 0) trySource(1);
    } else {
        timer = setTimeout(function () {
            if (attempt === 0) trySource(1);
        }, TIMEOUT);
    }
})();
