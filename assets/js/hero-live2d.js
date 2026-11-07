/*
 * hero-live2d.js — 首屏 Live2D 立绘
 *
 * 当前模型：正统「荧」（原神）同人 Live2D —— FanArt Free Live2D/Lumine
 * （画+装：いくるみゆむ @ikurumidwd，https://booth.pm/ja/items/7766317）。
 * 非官方同人，版权归 HoYoverse；条款：仅限非商用粉丝用途、禁止改変・
 * 再配布・AI 训练 —— 站点展示保持模型数据原样（仅贴图降采样到
 * 2048 以适配移动 GPU 纹理上限与加载体积），不修改任何绑定/参数。
 *
 * 运行时三件套全部本地 vendor（assets/lib/live2d/），不走 CDN：
 *   live2dcubismcore.min.js   Cubism 官方核心 5.x（模型是 moc3 v5）
 *   pixi.min.js               PIXI v6（pixi-live2d-display 0.4.0 的对端）
 *   cubism4.min.js            pixi-live2d-display 的 Cubism 4 构建
 *
 * 几条纪律（与 hero-canvas.js 一致）：
 *   · 模型预热在脚本解析时就开跑 —— moc3 在揭幕幕布后面传输，
 *     幕布拉开即近就绪；运行时库仍等揭幕结束再拉（并行、保序）
 *   · 剧照（still.webp）垫场：加载期间先看静态荧，模型就绪淡入交接；
 *     加载失败它就是最终形态；reduced-motion 下它替代整个模型下载
 *   · 出视口停 ticker，回视口再启动
 *   · 任何一步失败（库 404 / WebGL 不可用 / 模型损坏）都优雅降级，
 *     绝不留一个空壳
 */
(function () {
    "use strict";

    var stage = document.getElementById("hero-stage");
    if (!stage) return;

    var LIB = "assets/lib/live2d/";
    var MODEL_URL = "assets/live2d/lumine/lumine.model3.json";
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 人物在模型画布内的真实占位（占模型框的比例，逐像素实测标定）。
    // 本模型头顶上方有 37% 的空白画布，按画布整体居中会把人物拖低；
    // 构图一律以"人物 bbox"为准。换模型时需重新标定（渲染一帧后对
    // WebGL 画布做 alpha 逐像素扫描），标定失败回退到全画布。
    var ART_FRACTION = { x0: 0.138, y0: 0.372, x1: 0.873, y1: 1.0 };
    var ART_FULL = { x0: 0, y0: 0, x1: 1, y1: 1 };

    // 点击彩蛋用的表情轮换（model3.json 里只登记了这几个趣味表情）
    var TAP_EXPRESSIONS = [
        "exp_heart", "exp_sparkling", "exp_blush", "exp_zitome",
        "exp_angry", "exp_sad", "exp_sweat", "exp_dizzy", "exp_tear",
    ];
    var tapIndex = 0;
    var tapResetTimer = null;

    var scheduled = false;
    var failed = false;
    var app = null;
    var model = null;
    var stillImg = document.getElementById("hero-live2d-still");
    var warmPromise = null;

    /* ----------------------------------------------------------------------
       失败让位
       ---------------------------------------------------------------------- */
    function fail() {
        if (failed) return;
        failed = true;
        // 剧照是 HTML 自带的静态渲染帧，留在原地就是最终形态 ——
        // 一张静态荧好过空线框。没有剧照才整个让位。
        if (app && app.view) app.view.style.display = "none";
        if (!stillImg) stage.style.display = "none";
        if (window.__heroLive2d) delete window.__heroLive2d;
    }

    /* ----------------------------------------------------------------------
       装配
       ---------------------------------------------------------------------- */
    function setup() {
        var PIXI = window.PIXI;
        var Live2DModel = PIXI && PIXI.live2d && PIXI.live2d.Live2DModel;
        if (!Live2DModel) throw new Error("live2d 运行时不完整");

        app = new PIXI.Application({
            backgroundAlpha: 0,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        app.view.className = "hero__live2d-canvas";
        stage.appendChild(app.view);
        resize();

        // ticker 必须显式交给模型：插件默认挂 Ticker.shared，那样模型更新
        // 和本画布的渲染就是两条时钟，会出现"模型在动、画布不刷新"的脱节。
        return window.PIXI.live2d.Live2DModel.from(MODEL_URL, {
            autoInteract: false,
            ticker: app.ticker,
        }).then(function (m) {
                if (failed) return; // 期间 hide() 被触发过就不再上架
                model = m;
                app.stage.addChild(m);
                fit();

                document.addEventListener("pointermove", onMove, { passive: true });
                stage.addEventListener("click", onTap);
                observe();
                app.ticker.start();

                // 剧照功成身退：淡出交接给活体（几何完全对齐，切换无感）
                if (stillImg) {
                    stillImg.classList.add("is-done");
                    setTimeout(function () { stillImg.style.display = "none"; }, 450);
                }

                // 调试句柄：无头/停摆环境里可以手动 tickOnce() 推进一帧
                window.__heroLive2d = {
                    app: app,
                    model: model,
                    tickOnce: function () { app.ticker.update(performance.now()); },
                };
            });
    }

    function boot() {
        // 三件套并行拉取、按序执行：串行要多付两次往返。
        // 动态插入的脚本默认 async=true（谁先下完谁先跑），这里必须
        // 显式 async=false 才能保证 core → pixi → 插件的执行顺序。
        var sources = [
            LIB + "live2dcubismcore.min.js",
            LIB + "pixi.min.js",
            LIB + "cubism4.min.js",
        ];
        var scripts = Promise.all(
            sources.map(function (src) {
                return new Promise(function (resolve, reject) {
                    var s = document.createElement("script");
                    s.src = src;
                    s.async = false;
                    s.onload = resolve;
                    s.onerror = function () {
                        reject(new Error("live2d 依赖加载失败: " + src));
                    };
                    document.head.appendChild(s);
                });
            })
        );
        // 模型文件在幕布期间已由 warmModel() 预热 —— 这里等它落地，
        // 运行时随后发起的请求直接命中 HTTP 缓存，不会二次下载
        return scripts
            .then(function () { return warmPromise; })
            .then(setup);
    }

    /* ----------------------------------------------------------------------
       尺寸
       两件事：
       1. 取景以人物 bbox 为准（ART_FRACTION），人物中心 = 画布中心；
       2. 画布底边对齐 hero 底 —— 模型是"大腿以上"的半身，把作者的人
          物截止线压在首屏底边，就不会悬空露出一道硬切线。画布高度
          上限 hero 可视范围（.hero 有 overflow: clip，探出去会被硬切）。
       ---------------------------------------------------------------------- */
    function fit() {
        if (!model || !app) return;
        var w = app.screen.width;
        var h = app.screen.height;
        var ow = model.internalModel.originalWidth;
        var oh = model.internalModel.originalHeight;
        var f = ART_FRACTION || ART_FULL;
        var aw = ow * (f.x1 - f.x0);
        var ah = oh * (f.y1 - f.y0);
        var s = Math.min(w / aw, h / ah) * 0.98;
        model.scale.set(s);
        model.anchor.set(0, 0);
        // 人物 bbox 中心对齐画布中心（anchor 0,0 时 position 即画布左上角）
        model.position.set(
            w / 2 - ((f.x0 + f.x1) / 2) * ow * s,
            h / 2 - ((f.y0 + f.y1) / 2) * oh * s
        );
    }

    /* 尺寸计算。stage-local 的 hero 底边距离用 offsetTop 链而不是
       getBoundingClientRect：后者会被滚动位置和视差 transform 污染，
       而 offsetTop 永远是布局意义上的静态相对距离。 */
    function computeSize() {
        var w = stage.clientWidth || 1;
        var stageTopDoc = 0;
        var hero = stage.closest(".hero");
        for (var el = stage; el; el = el.offsetParent) stageTopDoc += el.offsetTop;
        var heroBottomLocal = hero
            ? docTop(hero) + hero.offsetHeight - stageTopDoc
            : w;
        var h = Math.round(Math.min(w * 1.3, Math.max(w, heroBottomLocal - 8)));
        return { w: w, h: h, heroBottomLocal: heroBottomLocal };
    }

    /* 剧照与画布同几何：位置/尺寸完全对齐，模型就绪后的淡入交接才是
       无缝的。画布还没建出来时（加载期间）也要摆对 —— 那正是它值班
       的时间。 */
    function placeStill() {
        if (!stillImg) return;
        var size = computeSize();
        stillImg.style.width = size.w + "px";
        stillImg.style.height = size.h + "px";
        stillImg.style.top = Math.round(size.heroBottomLocal - 8 - size.h) + "px";
    }

    function resize() {
        placeStill();
        if (!app) return;
        var size = computeSize();
        app.renderer.resize(size.w, size.h);
        // 画布底边贴 hero 底（向上留 8px），而不是居中
        app.view.style.top = Math.round(size.heroBottomLocal - 8 - size.h) + "px";
        fit();
    }

    function docTop(el) {
        var t = 0;
        while (el) { t += el.offsetTop; el = el.offsetParent; }
        return t;
    }

    window.addEventListener("resize", resize, { passive: true });

    /* ----------------------------------------------------------------------
       交互：视线跟随 + 点击动作
       ---------------------------------------------------------------------- */
    function onMove(e) {
        if (!model || failed) return;
        var r = app.view.getBoundingClientRect();
        model.focus(e.clientX - r.left, e.clientY - r.top);
    }

    function onTap() {
        if (!model || failed) return;
        var em = model.internalModel &&
            model.internalModel.motionManager &&
            model.internalModel.motionManager.expressionManager;
        if (!em) return;
        // 轮换趣味表情，2.6 秒后复位 —— 表情文件都是官方原配，不做任何改変
        var name = TAP_EXPRESSIONS[tapIndex % TAP_EXPRESSIONS.length];
        tapIndex += 1;
        try { em.setExpression(name); } catch (e) { return; }
        clearTimeout(tapResetTimer);
        tapResetTimer = setTimeout(function () {
            try { em.resetExpression(); } catch (e) { /* no-op */ }
        }, 2600);
    }

    /* ----------------------------------------------------------------------
       出视口停表
       ---------------------------------------------------------------------- */
    function observe() {
        if (!("IntersectionObserver" in window)) return;
        new IntersectionObserver(
            function (entries) {
                if (!app) return;
                entries[0].isIntersecting ? app.ticker.start() : app.ticker.stop();
            },
            { threshold: 0 }
        ).observe(stage);
    }

    /* ----------------------------------------------------------------------
       预热 + 懒加载调度
       moc3（brotli 后 ~2MB）是最大的等待项 —— 让它在揭幕幕布后面就
       开始传输：本脚本在 body 末尾一解析就发起预热（页面其余资源
       总共只有几百 KB，不构成竞争），幕布拉开时大概率已经就绪。
       预热的 Promise 交给 boot() 等待：运行时随后发起的请求直接命中
       HTTP 缓存，也避免预热请求还在途中时被二次下载。

       reduced-motion 用户连这 5.5MB 都不必下：剧照（still.webp，66KB，
       从实际渲染帧截取）本身就是"静态那一帧"，直接作为最终形态。
       ---------------------------------------------------------------------- */
    function warmModel() {
        if (warmPromise) return warmPromise;
        warmPromise = fetch(MODEL_URL, { cache: "force-cache" })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var fr = d.FileReferences || {};
                var files = [fr.Moc, fr.Physics]
                    .concat(fr.Textures || [])
                    .filter(Boolean)
                    .map(function (p) { return new URL(p, MODEL_URL).href; });
                return Promise.all(
                    files.map(function (f) {
                        return fetch(f, { cache: "force-cache" }).catch(function () {});
                    })
                );
            })
            .then(function () { return true; })
            .catch(function () { return false; });
        return warmPromise;
    }
    warmModel();
    placeStill();

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        placeStill();

        // 减少动效：剧照即终点，不加载运行时和模型
        if (reduced) return;

        var idle = window.requestIdleCallback
            ? function (cb) { window.requestIdleCallback(cb, { timeout: 800 }); }
            : function (cb) { setTimeout(cb, 800); };
        idle(function () {
            boot().catch(function (err) {
                console.error(err && err.message || "live2d 初始化失败", err);
                fail();
            });
        });
    }

    document.addEventListener("ohto:revealed", function () { setTimeout(schedule, 300); }, { once: true });
    setTimeout(schedule, 4500);
})();
