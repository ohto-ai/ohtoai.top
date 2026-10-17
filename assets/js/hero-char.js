/*
 * hero-char.js — 首屏立绘动画
 *
 * v3.14 素材是预先拆好的分层图，按顺序画在同一个 1200×1200 画布上：
 *
 *   base-clean      底图，暖肤色，眼眶留空
 *   face-shading    脸部/下巴的 cel-shading 与刘海投影
 *   iris-gold/blue  虹膜，裁剪在眼眶路径内，随光标连续移动
 *   blink-eyes      闭眼覆盖层，只在眨眼时叠加（眼周已是同肤色）
 *   bangs-front     遮住右眼的刘海
 *   hair-clip       绿色三角形发饰，永远最后画
 *
 * 和之前的四帧切换相比，眨眼不再切换整张图：底图、头发和脸部
 * 始终保持不动，只有眼部局部变化，虹膜也是连续位移而不是换帧。
 * 底图与虹膜的像素坐标沿用素材自带的 1200×1200 画布。
 */
(function () {
    "use strict";

    var stage = document.getElementById("hero-stage");
    if (!stage) return;

    var canvas = document.getElementById("hero-face");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    var W = canvas.width;
    var H = canvas.height;
    var BASE = "assets/img/face/";
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var SOURCES = {
        base: BASE + "base-clean.webp",
        faceShade: BASE + "face-shading.svg",
        gold: BASE + "iris-gold.svg",
        blue: BASE + "iris-blue.svg",
        bangs: BASE + "bangs-front.webp",
        clip: BASE + "hair-clip.svg",
        blink: BASE + "blink-eyes.webp",
    };

    var CORE = ["base", "faceShade", "gold", "blue", "bangs", "clip"];
    var assets = {};
    var pending = CORE.length;
    var coreLoaded = false;

    /* ----------------------------------------------------------------------
       眼眶范围

       坐标与素材像素一一对应。虹膜绘制前先 clip 到眼眶内，
       移动时不会越过睫毛和脸部轮廓。
       ---------------------------------------------------------------------- */
    var eyes = {
        gold: {
            x: 373, y: 677, w: 150, h: 157, dx: 14, dy: 10,
            clip: function () {
                ctx.beginPath();
                ctx.moveTo(378, 710);
                ctx.quadraticCurveTo(385, 682, 414, 674);
                ctx.quadraticCurveTo(456, 663, 490, 686);
                ctx.quadraticCurveTo(520, 706, 524, 744);
                ctx.quadraticCurveTo(528, 789, 496, 827);
                ctx.quadraticCurveTo(465, 846, 429, 832);
                ctx.quadraticCurveTo(392, 816, 382, 773);
                ctx.closePath();
                ctx.clip();
            },
        },
        blue: {
            x: 695, y: 696, w: 141, h: 145, dx: 11, dy: 9,
            clip: function () {
                ctx.beginPath();
                ctx.moveTo(694, 736);
                ctx.quadraticCurveTo(701, 709, 728, 701);
                ctx.quadraticCurveTo(763, 692, 793, 721);
                ctx.quadraticCurveTo(823, 750, 831, 786);
                ctx.quadraticCurveTo(838, 813, 811, 835);
                ctx.quadraticCurveTo(781, 852, 749, 833);
                ctx.quadraticCurveTo(715, 813, 700, 777);
                ctx.closePath();
                ctx.clip();
            },
        },
    };

    function drawFrame(gazeX, gazeY, closed) {
        ctx.clearRect(0, 0, W, H);

        if (assets.base) ctx.drawImage(assets.base, 0, 0, W, H);

        // 脸部阴影叠在底图之上、虹膜之下，眼白区域不受影响
        if (assets.faceShade) ctx.drawImage(assets.faceShade, 0, 0, W, H);

        // 闭眼层没加载好时继续画睁眼，宁可晚一点眨，也不要空着眼眶
        if (closed && assets.blink) {
            ctx.drawImage(assets.blink, 0, 0, W, H);
        } else {
            ["gold", "blue"].forEach(function (name) {
                var p = eyes[name];
                var img = assets[name];
                if (!img) return;

                ctx.save();
                p.clip();
                ctx.drawImage(
                    img,
                    p.x + gazeX * p.dx,
                    p.y + gazeY * p.dy,
                    p.w,
                    p.h
                );
                ctx.restore();
            });
        }

        // 刘海压住虹膜，发饰再压在刘海之上
        if (assets.bangs) ctx.drawImage(assets.bangs, 0, 0, W, H);
        if (assets.clip) ctx.drawImage(assets.clip, 0, 0, W, H);
    }

    /* ----------------------------------------------------------------------
       素材加载

       底图、阴影、虹膜、刘海和发饰到齐就能开画；闭眼层单独加载，
       没到之前只是不眨眼，不影响正常显示。
       ---------------------------------------------------------------------- */
    function coreDone() {
        coreLoaded = true;
        if (reduced) {
            // 减少动效：一张静帧，不启动循环
            drawFrame(0, 0, false);
        } else {
            observe();
        }
    }

    Object.keys(SOURCES).forEach(function (key) {
        var img = new Image();
        var isCore = CORE.indexOf(key) !== -1;

        img.onload = function () {
            assets[key] = img;
            if (!isCore) return;
            pending -= 1;
            if (pending === 0) coreDone();
        };

        img.onerror = function () {
            console.error("立绘素材加载失败:", SOURCES[key]);
            if (!isCore) return;
            pending -= 1;
            if (pending === 0) coreDone();
        };

        img.src = SOURCES[key];
    });

    /* ----------------------------------------------------------------------
       鼠标跟随 + 眨眼

       光标只驱动虹膜，整体位移和倾角仍由 CSS / stage transform 负责。
       ---------------------------------------------------------------------- */
    var pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
    var gaze = { x: 0, y: 0 };
    var target = { x: 0, y: 0, rot: 0 };
    var cur = { x: 0, y: 0, rot: 0 };
    var blinkUntil = 0;
    var nextBlink = 0;

    if (!reduced) {
        document.addEventListener(
            "pointermove",
            function (e) {
                pointer.x = e.clientX;
                pointer.y = e.clientY;
            },
            { passive: true }
        );

        document.addEventListener(
            "mousemove",
            function (e) {
                var nx = e.clientX / window.innerWidth;
                var ny = e.clientY / window.innerHeight;
                target.x = (nx - 0.5) * 46;
                target.y = (ny - 0.5) * 26;
                target.rot = (nx - 0.5) * 9;
            },
            { passive: true }
        );

        // 点她有反应。窄屏立绘是底纹，CSS 已关掉指针事件。
        stage.addEventListener("click", function () {
            blink(190);
        });
    }

    function blink(ms) {
        var now = performance.now();
        blinkUntil = now + (ms || 165);
        // 2.2–6 秒随机。固定间隔一眼就看出是机器在动。
        nextBlink = blinkUntil + 2200 + Math.random() * 3800;
    }

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) nextBlink = performance.now() + 1100;
    });

    /* ----------------------------------------------------------------------
       动画循环

       移出视口就停 rAF，和背后的线框二十面体保持同一条性能纪律。
       ---------------------------------------------------------------------- */
    var rafId = null;
    var last = 0;
    var running = false;

    function frame(now) {
        if (!running) return;
        rafId = requestAnimationFrame(frame);

        // 约 60fps。高刷屏上没必要把画布重绘到 120Hz。
        if (now - last < 15) return;
        last = now;

        var r = stage.getBoundingClientRect();
        var cx = r.left + r.width * 0.5;
        var cy = r.top + r.height * 0.48;
        var tx = (pointer.x - cx) / Math.max(230, r.width * 0.72);
        var ty = (pointer.y - cy) / Math.max(230, r.height * 0.72);
        tx = Math.max(-1, Math.min(1, tx));
        ty = Math.max(-1, Math.min(1, ty));

        gaze.x += (tx - gaze.x) * 0.11;
        gaze.y += (ty - gaze.y) * 0.11;

        cur.x += (target.x - cur.x) * 0.08;
        cur.y += (target.y - cur.y) * 0.08;
        cur.rot += (target.rot - cur.rot) * 0.08;
        stage.style.transform =
            "translate3d(" + cur.x.toFixed(2) + "px," +
            cur.y.toFixed(2) + "px,0) rotate(" + cur.rot.toFixed(2) + "deg)";

        if (now >= nextBlink && assets.blink) blink();

        drawFrame(gaze.x, gaze.y, now < blinkUntil);
    }

    function start() {
        if (running || reduced || !coreLoaded) return;
        running = true;
        last = 0;
        nextBlink = performance.now() + 2600;
        rafId = requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    function observe() {
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(
                function (entries) {
                    entries[0].isIntersecting ? start() : stop();
                },
                { threshold: 0 }
            ).observe(stage);
        } else {
            start();
        }
    }
})();
