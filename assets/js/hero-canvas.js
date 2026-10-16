/*
 * hero-canvas.js — 首屏常驻动画
 *
 * 一个缓慢自转的线框二十面体，带顶点辉光。
 * 用 canvas 2D 手写三维投影，而不是引 three.js —— 观感是"发光的工程结构"，
 * 但体积是 5KB 而不是 600KB。
 *
 * 几条性能纪律：
 *   · 移出视口就停 rAF（首屏滚过去之后不该继续烧 CPU）
 *   · DPR 封顶 2（4K 屏上按 3x 渲染等于白白多画一倍像素）
 *   · prefers-reduced-motion 下只画一帧静帧
 */
(function () {
    "use strict";

    var canvas = document.getElementById("hero-canvas");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ----------------------------------------------------------------------
       颜色 —— 从设计令牌里读，这样改 --base-hue 时 canvas 会跟着变。
       canvas 的 fillStyle getter 对 oklch() 会原样返回字符串，不做 sRGB
       归一化，所以这里把颜色真画到 1×1 画布上再读像素。
       ---------------------------------------------------------------------- */
    function resolveColor(cssColor, fallback) {
        try {
            var probe = document.createElement("canvas");
            probe.width = probe.height = 1;
            var pctx = probe.getContext("2d", { willReadFrequently: true });
            pctx.clearRect(0, 0, 1, 1);
            pctx.fillStyle = cssColor;
            pctx.fillRect(0, 0, 1, 1);
            var d = pctx.getImageData(0, 0, 1, 1).data;
            if (d[3] === 0) return fallback;
            return [d[0], d[1], d[2]];
        } catch (e) {
            return fallback;
        }
    }

    function readTokens() {
        var cs = getComputedStyle(document.documentElement);
        var accent = (cs.getPropertyValue("--accent-fill") || "").trim();
        var faint = (cs.getPropertyValue("--gray-1000") || "").trim();
        return {
            accent: resolveColor(accent, [69, 92, 233]),
            faint: resolveColor(faint, [235, 236, 240]),
        };
    }

    var COLORS = readTokens();

    function rgba(rgb, a) {
        return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
    }

    /* ----------------------------------------------------------------------
       几何 —— 正二十面体
       顶点取自 (0, ±1, ±φ) 的循环置换，棱长恰为 2。
       ---------------------------------------------------------------------- */
    var PHI = (1 + Math.sqrt(5)) / 2;

    var VERTICES = [
        [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
        [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
        [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
    ];

    // 棱：顶点对距离等于 2 的连线
    var EDGES = [];
    (function buildEdges() {
        for (var i = 0; i < VERTICES.length; i++) {
            for (var j = i + 1; j < VERTICES.length; j++) {
                var a = VERTICES[i], b = VERTICES[j];
                var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
                var d2 = dx * dx + dy * dy + dz * dz;
                if (Math.abs(d2 - 4) < 0.001) EDGES.push([i, j]);
            }
        }
    })();

    /* ----------------------------------------------------------------------
       视口与尺寸
       ---------------------------------------------------------------------- */
    var w = 0, h = 0, cx = 0, cy = 0, unit = 0;

    function resize() {
        var rect = canvas.getBoundingClientRect();
        if (!rect.width) return false;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = rect.width;
        h = rect.height;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx = w / 2;
        cy = h / 2;
        // 二十面体的外接半径约 1.902，透视放大最多到 6.5/(6.5-1.902) ≈ 1.41，
        // 所以屏幕上最大延展约 2.68 个单位。取 0.15 让它占画布约八成，
        // 四周留出余量 —— 取大了会被画布边界切掉棱角。
        unit = Math.min(w, h) * 0.16;
        return true;
    }

    /* ----------------------------------------------------------------------
       状态
       ---------------------------------------------------------------------- */
    var rotX = -0.42;
    var rotY = 0.6;
    var spin = 0;
    var pointerX = 0, pointerY = 0; // -1..1，鼠标对姿态的轻微影响
    var targetPX = 0, targetPY = 0;

    var projected = new Array(VERTICES.length);

    function projectAll() {
        var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        var camZ = 6.5;

        for (var i = 0; i < VERTICES.length; i++) {
            var v = VERTICES[i];
            var x = v[0], y = v[1], z = v[2];

            // 绕 Y 轴
            var x1 = x * cosY - z * sinY;
            var z1 = x * sinY + z * cosY;
            // 绕 X 轴
            var y1 = y * cosX - z1 * sinX;
            var z2 = y * sinX + z1 * cosX;

            var k = camZ / (camZ + z2);
            projected[i] = {
                x: cx + x1 * unit * k,
                y: cy + y1 * unit * k,
                // 归一化深度：0 = 最近，1 = 最远
                depth: (z2 + PHI) / (2 * PHI),
                scale: k,
            };
        }
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);

        // 外圈：一点点"工程图纸"的味道
        ctx.beginPath();
        ctx.arc(cx, cy, unit * 1.62, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(COLORS.accent, 0.09);
        ctx.lineWidth = 1;
        ctx.stroke();

        // 棱：近的更亮更粗，产生体积感
        for (var e = 0; e < EDGES.length; e++) {
            var a = projected[EDGES[e][0]];
            var b = projected[EDGES[e][1]];
            var depth = (a.depth + b.depth) / 2;
            var near = 1 - depth;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = rgba(COLORS.accent, 0.1 + near * 0.5);
            ctx.lineWidth = 0.7 + near * 1.1;
            ctx.stroke();
        }

        // 顶点：近处带辉光
        for (var i = 0; i < projected.length; i++) {
            var p = projected[i];
            var near = 1 - p.depth;
            var r = (1.2 + near * 2.4) * p.scale;

            if (near > 0.45) {
                var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
                g.addColorStop(0, rgba(COLORS.accent, 0.32 * near));
                g.addColorStop(1, rgba(COLORS.accent, 0));
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = rgba(COLORS.faint, 0.35 + near * 0.6);
            ctx.fill();
        }
    }

    /* ----------------------------------------------------------------------
       动画循环
       ---------------------------------------------------------------------- */
    var rafId = null;
    var last = 0;
    var running = false;

    function frame(now) {
        if (!running) return;
        var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
        last = now;

        // 自转 + 鼠标带来的轻微倾角偏移
        spin += dt * 0.22;
        pointerX += (targetPX - pointerX) * 0.045;
        pointerY += (targetPY - pointerY) * 0.045;

        rotY = spin + pointerX * 0.5;
        rotX = -0.42 + pointerY * 0.35;

        projectAll();
        draw();
        rafId = requestAnimationFrame(frame);
    }

    function start() {
        if (running || reduced) return;
        running = true;
        last = 0;
        rafId = requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    /* ----------------------------------------------------------------------
       初始化
       ---------------------------------------------------------------------- */
    if (!resize()) {
        // 布局还没算出来（或元素被隐藏），下一帧再试
        requestAnimationFrame(function () {
            if (resize()) {
                projectAll();
                draw();
                observe();
            }
        });
    } else {
        projectAll();
        draw();
        observe();
    }

    function observe() {
        if (reduced) return; // 静帧，不启动循环

        if ("IntersectionObserver" in window) {
            new IntersectionObserver(
                function (entries) {
                    entries[0].isIntersecting ? start() : stop();
                },
                { threshold: 0 }
            ).observe(canvas);
        } else {
            start();
        }
    }

    // 鼠标只影响姿态，幅度刻意压得很小 —— 是"有反应"，不是"跟着跑"
    window.addEventListener(
        "mousemove",
        function (e) {
            targetPX = (e.clientX / window.innerWidth) * 2 - 1;
            targetPY = (e.clientY / window.innerHeight) * 2 - 1;
        },
        { passive: true }
    );

    var resizeTimer = null;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (resize()) {
                projectAll();
                if (!running) draw();
            }
        }, 150);
    });

    // 系统主题色变化时（比如切到高对比度）重新取一遍令牌
    if (window.matchMedia) {
        try {
            window
                .matchMedia("(prefers-contrast: more)")
                .addEventListener("change", function () {
                    COLORS = readTokens();
                });
        } catch (e) {
            /* 老浏览器不支持，忽略 */
        }
    }
})();
