/*
 * log-website.js — 控制台签名
 * 原版用 jQuery 的 $(function(){}) 包了一层，jQuery 已从本站移除，
 * 这里改成等价的 DOMContentLoaded，行为不变。
 */
(function () {
    "use strict";

    function banner() {
        console.log(`
 ██████╗ ██╗  ██╗████████╗ ██████╗  █████╗ ██╗
██╔═══██╗██║  ██║╚══██╔══╝██╔═══██╗██╔══██╗██║
██║   ██║███████║   ██║   ██║   ██║███████║██║
██║   ██║██╔══██║   ██║   ██║   ██║██╔══██║██║
╚██████╔╝██║  ██║   ██║   ╚██████╔╝██║  ██║██║
 ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝
 Contact me: zhu.thatboy@outlook.com
 `);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", banner, { once: true });
    } else {
        banner();
    }
})();
