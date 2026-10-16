/*
 * hero-char.js — 首屏立绘动画
 *
 * 走「预渲染多帧 + 换帧」，不是分层动画。
 *
 * 为什么：这张图里眼睛的睑线和盖住右眼的刘海颜色完全一样
 * （实测睑线 #292546、头发 #131a48），按颜色分不开，几何上也切不开
 * —— 两者在像素上是连通的。分层抹除必然误伤一边。
 * 换帧没有这个问题：四张图各自完整，切换时只动 opacity。
 *
 * 四帧：
 *   normal  正视
 *   left    看向左侧
 *   right   看向右侧
 *   blink   闭眼（^_^）
 */
(function () {
    "use strict";

    var stage = document.getElementById("hero-stage");
    if (!stage) return;

    var frames = {};
    Array.prototype.forEach.call(
        stage.querySelectorAll(".hero__frame"),
        function (img) {
            frames[img.getAttribute("data-frame")] = img;
        }
    );
    if (!frames.normal) return;

    var BASE = "assets/img/face/";
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ----------------------------------------------------------------------
       换帧

       目标帧还没加载完就不切 —— 否则会闪一下空白，比不切还糟。
       ---------------------------------------------------------------------- */
    var ready = {};
    ready.normal = true;

    function show(name) {
        if (!ready[name]) return;
        Object.keys(frames).forEach(function (k) {
            if (k === name) frames[k].setAttribute("data-on", "");
            else frames[k].removeAttribute("data-on");
        });
    }

    /* ----------------------------------------------------------------------
       延迟加载另外三帧

       normal 写在 HTML 里，先保证首屏有一张图。
       另外三帧合计约 300KB，等主内容就绪再拉，不跟首屏抢带宽。
       ---------------------------------------------------------------------- */
    function loadRest() {
        ["left", "right", "blink"].forEach(function (k) {
            var img = frames[k];
            if (!img || img.getAttribute("src")) return;
            img.addEventListener("load", function () { ready[k] = true; });
            img.setAttribute("src", BASE + k + ".png");
        });
    }

    if (reduced) {
        // 减少动效：就一张静态立绘，不加载其余帧
        show("normal");
        return;
    }

    if (document.readyState === "complete") setTimeout(loadRest, 400);
    else window.addEventListener("load", function () { setTimeout(loadRest, 400); });

    /* ----------------------------------------------------------------------
       平滑跟随

       幅度比 Doubao 那版收了一半左右 —— 那个是独立的演示页，可以夸张；
       这里文字就在旁边，晃动太大反而干扰阅读。
       ---------------------------------------------------------------------- */
    var target = { x: 0, y: 0, rot: 0 };
    var cur = { x: 0, y: 0, rot: 0 };
    var lastNX = 0.5;
    var blinking = false;

    document.addEventListener(
        "mousemove",
        function (e) {
            var nx = e.clientX / window.innerWidth;
            var ny = e.clientY / window.innerHeight;
            lastNX = nx;

            target.x = (nx - 0.5) * 46;
            target.y = (ny - 0.5) * 26;
            target.rot = (nx - 0.5) * 9;

            // 眨眼期间不抢帧，否则闭眼会被方向帧打断
            if (!blinking) {
                if (nx < 0.4) show("left");
                else if (nx > 0.6) show("right");
                else show("normal");
            }
        },
        { passive: true }
    );

    (function loop() {
        cur.x += (target.x - cur.x) * 0.08;
        cur.y += (target.y - cur.y) * 0.08;
        cur.rot += (target.rot - cur.rot) * 0.08;
        stage.style.transform =
            "translate3d(" + cur.x.toFixed(2) + "px," +
            cur.y.toFixed(2) + "px,0) rotate(" + cur.rot.toFixed(2) + "deg)";
        requestAnimationFrame(loop);
    })();

    /* ----------------------------------------------------------------------
       随机眨眼

       间隔 2.2–6 秒随机。固定间隔一眼就看出是机器在动。
       ---------------------------------------------------------------------- */
    function blink() {
        if (blinking) return;
        blinking = true;
        show("blink");
        setTimeout(function () {
            blinking = false;
            // 睁开后回到光标当前方向对应的那一帧
            if (lastNX < 0.4) show("left");
            else if (lastNX > 0.6) show("right");
            else show("normal");
        }, 150);
    }

    (function schedule() {
        setTimeout(function () {
            blink();
            schedule();
        }, 2200 + Math.random() * 3800);
    })();

    // 点她有反应
    stage.addEventListener("click", blink);
})();
