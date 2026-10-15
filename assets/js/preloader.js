/*
 * preloader.js — 加载页
 *
 * 设计约束（这几条是旧站翻车的地方，不要放松）：
 *   1. 零依赖。旧站的揭幕逻辑挂在 CDN 上的 jQuery，CDN 一挂整站永久不可用。
 *   2. 揭幕信号与 window.load 解耦。旧站等 readyState === "complete"，
 *      而 complete 还要等 bilibili 那 1.5MB 的图。
 *   3. 有最短展示时长（避免 80ms 闪一下，那比没有还糟）和硬上限。
 *   4. 无论走哪条路径，<head> 里那段内联脚本都会在 4 秒后兜底揭幕。
 */
(function () {
    "use strict";

    var preloader = document.getElementById("preloader");
    var de = document.documentElement;

    // 同一会话内已经加载过，或页面上根本没有加载页 —— 直接交还给内联兜底
    if (!preloader || de.classList.contains("is-skip-preloader")) {
        return;
    }

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var MIN_DISPLAY = 600; // 最短展示，防闪烁
    var MAX_DISPLAY = 3000; // 硬上限，配合内联兜底的 4000ms
    var FADE = reduced ? 0 : 250; // 内层文字淡出
    var CURTAIN = reduced ? 0 : 920; // 幕布滑出

    var start = performance.now();
    var revealed = false;
    var rafId = null;
    var wordTimer = null;

    /* ----------------------------------------------------------------------
       问候语轮播
       绝对定位叠在同一个格子里，靠 data-active / data-past 切换。
       ---------------------------------------------------------------------- */
    var words = Array.prototype.slice.call(
        preloader.querySelectorAll(".preloader__word")
    );
    var wordIndex = 0;

    function showWord(i) {
        words.forEach(function (el, n) {
            if (n === i) {
                el.setAttribute("data-active", "");
                el.removeAttribute("data-past");
            } else if (n < i) {
                el.removeAttribute("data-active");
                el.setAttribute("data-past", "");
            } else {
                el.removeAttribute("data-active");
                el.removeAttribute("data-past");
            }
        });
    }

    if (words.length && !reduced) {
        showWord(0);
        wordTimer = setInterval(function () {
            wordIndex += 1;
            if (wordIndex >= words.length) {
                clearInterval(wordTimer);
                wordTimer = null;
                return;
            }
            showWord(wordIndex);
        }, 190);
    } else if (words.length) {
        // 降级：直接停在最后一句（中文）
        showWord(words.length - 1);
    }

    /* ----------------------------------------------------------------------
       计数器
       缓出曲线推进，看起来始终在动，不会中途卡住。
       ---------------------------------------------------------------------- */
    var counterEl = document.getElementById("preloader-counter");

    function renderCounter(now) {
        if (!counterEl) return;
        var t = Math.min((now - start) / MAX_DISPLAY, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        // 走到 99 就停，最后一下留给真正揭幕时跳到 100
        var value = Math.min(Math.round(eased * 99), 99);
        counterEl.textContent = value < 10 ? "0" + value : String(value);
    }

    function tick(now) {
        renderCounter(now);
        rafId = requestAnimationFrame(tick);
    }

    if (counterEl && !reduced) {
        rafId = requestAnimationFrame(tick);
    } else if (counterEl) {
        counterEl.textContent = "100";
    }

    /* ----------------------------------------------------------------------
       揭幕
       ---------------------------------------------------------------------- */
    function reveal() {
        if (revealed) return;
        revealed = true;

        if (rafId) cancelAnimationFrame(rafId);
        if (wordTimer) clearInterval(wordTimer);

        if (counterEl) counterEl.textContent = "100";

        // 1) 内层文字淡出
        preloader.setAttribute("data-leaving", "");

        // 2) 幕布滑出。先解除 is-loading，主页在幕布下面显现，
        //    这样滑出的是"揭幕"，而不是"先黑一下再出现"。
        setTimeout(function () {
            de.classList.remove("is-loading");
            preloader.setAttribute("data-curtain", "");

            // 通知其余模块可以开始它们的入场动效了
            try {
                document.dispatchEvent(new CustomEvent("ohto:revealed"));
            } catch (e) {
                /* 极老浏览器没有 CustomEvent 构造器，忽略即可 */
            }

            // 3) 彻底清理：把节点移出 DOM。
            //    旧站把 z-index:999999 的全屏元素永久留在树里，
            //    一旦 hide 没触发就会静默吞掉整页的点击。
            setTimeout(function () {
                preloader.setAttribute("data-done", "");
                preloader.style.display = "none";
                if (preloader.parentNode) {
                    preloader.parentNode.removeChild(preloader);
                }
                try {
                    sessionStorage.setItem("ohto:loaded", "1");
                } catch (e) {
                    /* 隐私模式下写不进去，下次访问再播一遍，可接受 */
                }
            }, CURTAIN);
        }, FADE);
    }

    /* ----------------------------------------------------------------------
       触发时机
       主信号用 DOMContentLoaded —— 绝不等图片。
       ---------------------------------------------------------------------- */
    function scheduleReveal() {
        var elapsed = performance.now() - start;
        var wait = Math.max(0, MIN_DISPLAY - elapsed);
        setTimeout(reveal, wait);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleReveal, {
            once: true,
        });
    } else {
        scheduleReveal();
    }

    // 硬上限：不管发生什么，3 秒后一定揭幕
    setTimeout(reveal, MAX_DISPLAY);

    // 从 bfcache 返回时不重播加载页
    window.addEventListener("pageshow", function (e) {
        if (e.persisted) reveal();
    });
})();
