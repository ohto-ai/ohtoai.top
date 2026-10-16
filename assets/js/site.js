/*
 * site.js — 导航、时钟、揭示动效
 *
 * 动效双引擎：
 *   · GSAP 可用  → GSAP + ScrollTrigger 驱动（时间轴错位、滚动联动）
 *   · GSAP 不可用 → IntersectionObserver + CSS transition 驱动
 * 两条路径最终都落到同一个 data-revealed 状态上，所以任何一条挂了页面都完整。
 */
(function () {
    "use strict";

    var de = document.documentElement;
    var hasGsap = typeof window.gsap !== "undefined";

    if (hasGsap) de.classList.add("has-gsap");

    /* ======================================================================
       动效偏好
       启动时读一次，并且**监听变化** —— 用户会实时切换这个开关，
       只读一次是这类代码最常见的 bug。
       ====================================================================== */
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reduced = motionQuery.matches;

    motionQuery.addEventListener("change", function (e) {
        reduced = e.matches;
        if (reduced && lenis) {
            lenis.destroy();
            lenis = null;
        }
    });

    /* ======================================================================
       安全网：内容绝不能永远停在 opacity: 0
       ====================================================================== */
    function revealEverything() {
        var nodes = document.querySelectorAll(
            ".reveal, .reveal-stagger, .mask-reveal"
        );
        Array.prototype.forEach.call(nodes, function (node) {
            node.setAttribute("data-revealed", "");
        });
    }

    /* ======================================================================
       平滑滚动
       ====================================================================== */
    var lenis = null;

    // 读 <head> 内联定义的揭幕时长，避免这里另写一个常量跟它跑偏
    function curtainMs() {
        var v = getComputedStyle(de)
            .getPropertyValue("--curtain-duration")
            .trim();
        var n = parseFloat(v);
        if (!isFinite(n)) return 950;
        return v.indexOf("ms") > -1 ? n : n * 1000;
    }

    function initSmoothScroll() {
        if (lenis || reduced || typeof window.Lenis === "undefined") return;

        lenis = new window.Lenis({
            duration: 1.1,
            easing: function (t) {
                return Math.min(1, 1.001 - Math.pow(2, -10 * t));
            },
            smoothWheel: true,
            // 触底/触顶后不再累积越界的目标位置
            overscroll: false,
        });

        // Lenis 接管滚动后，CSS 的 scroll-behavior 会打架，关掉它
        de.style.scrollBehavior = "auto";

        // 让 Lenis 驱动 GSAP 的时钟，而不是各跑一条 rAF。
        // 两条独立的 rAF 会让 ScrollTrigger 读到迟一帧的位置，
        // 滚动到区块边界时能看出抖动。
        if (window.gsap && window.ScrollTrigger) {
            lenis.on("scroll", window.ScrollTrigger.update);
            window.gsap.ticker.add(function (time) {
                lenis.raf(time * 1000);
            });
            window.gsap.ticker.lagSmoothing(0);
        } else {
            (function raf(time) {
                if (lenis) lenis.raf(time);
                requestAnimationFrame(raf);
            })(performance.now());
        }

        // 锚点交给 Lenis，才不会有"先跳再滑"的割裂感
        document.addEventListener("click", function (e) {
            var link = e.target.closest && e.target.closest('a[href^="#"]');
            if (!link) return;
            var id = link.getAttribute("href");
            if (!id || id === "#") return;
            var target = document.querySelector(id);
            if (!target) return;

            e.preventDefault();
            lenis.scrollTo(target, { offset: -80 });

            // 让键盘用户和读屏软件的焦点也跟着走
            target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
        });
    }

    /* 平滑滚动必须等揭幕的位移动画走完再初始化。

       揭幕期间内容整体下移 100vh，这会撑大文档的可滚动区域（实测
   scrollHeight 4269 → 就绪后 3369，差整整一个视口）。此刻初始化，
   Lenis 量到的就是虚高的 limit。而它的 Dimensions 靠 ResizeObserver
   监听尺寸，ResizeObserver 看的是布局盒子 —— transform 不改变布局尺寸，
   所以它永远发现不了这个变化，limit 会一直停在错的值上。
   表现就是：滚到底后继续滚不报错，但反向要空滚好几下才开始上升。

   加载期间本来也滚不动（内联 CSS 里锁了 overflow），所以推迟初始化
   不会损失任何体验。 */
    if (de.classList.contains("is-skip-preloader")) {
        initSmoothScroll();
    } else {
        // 同一个原因，ScrollTrigger 也必须在位移动画结束后重新量一次：
        // 各区块的入场触发点是在揭幕途中创建的，那时文档还高着一个视口，
        // 算出来的 start/end 全部偏低。不刷新的话，滚到区块附近会看到
        // 触发时机不对、甚至像是"刷了两次"。
        function afterRevealLayoutSettles() {
            initSmoothScroll();
            if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        }

        document.addEventListener(
            "ohto:revealed",
            function () {
                setTimeout(afterRevealLayoutSettles, curtainMs() + 60);
            },
            { once: true }
        );
        // 兜底：万一 ohto:revealed 没来（脚本被拦等）
        setTimeout(afterRevealLayoutSettles, 5000);
    }

    /* ======================================================================
       导航滚动状态
       用 IntersectionObserver 盯一个哨兵元素，而不是监听 scroll 事件 ——
       scroll 回调每帧都跑，哨兵只在真正跨过阈值时才触发。
       ====================================================================== */
    var nav = document.getElementById("site-nav");

    if (nav) {
        // 哨兵放在 120px 处而不是 0：导航栏要等真正"往下滚了一段"
        // 才滑出来。贴着 0 的话滚动 1px 它就冒头，首屏还是被切掉一截。
        var sentinel = document.createElement("div");
        sentinel.setAttribute("aria-hidden", "true");
        sentinel.style.cssText =
            "position:absolute;top:120px;left:0;width:1px;height:1px;pointer-events:none";
        document.body.insertBefore(sentinel, document.body.firstChild);

        if ("IntersectionObserver" in window) {
            new IntersectionObserver(
                function (entries) {
                    var entry = entries[0];
                    if (entry.isIntersecting) {
                        nav.removeAttribute("data-scrolled");
                    } else {
                        nav.setAttribute("data-scrolled", "");
                    }
                },
                { threshold: 0 }
            ).observe(sentinel);
        } else {
            nav.setAttribute("data-scrolled", "");
        }
    }

    /* ======================================================================
       移动端菜单
       ====================================================================== */
    var toggle = document.getElementById("nav-toggle");
    var panel = document.getElementById("nav-panel");

    if (toggle && panel) {
        function setMenu(open) {
            if (open) {
                panel.setAttribute("data-open", "");
                toggle.setAttribute("aria-expanded", "true");
                toggle.setAttribute("aria-label", "关闭菜单");
                de.style.overflow = "hidden";
            } else {
                panel.removeAttribute("data-open");
                toggle.setAttribute("aria-expanded", "false");
                toggle.setAttribute("aria-label", "打开菜单");
                de.style.overflow = "";
            }
        }

        toggle.addEventListener("click", function () {
            setMenu(!panel.hasAttribute("data-open"));
        });

        // 点了菜单里的链接就关掉
        panel.addEventListener("click", function (e) {
            if (e.target.closest("a")) setMenu(false);
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && panel.hasAttribute("data-open")) {
                setMenu(false);
                toggle.focus();
            }
        });

        // 视口拉宽回桌面尺寸时复位，避免菜单卡在打开态
        window.matchMedia("(min-width: 641px)").addEventListener(
            "change",
            function (e) {
                if (e.matches) setMenu(false);
            }
        );
    }

    /* ======================================================================
       页脚
       ====================================================================== */
    var clockEl = document.getElementById("footer-clock");
    var yearEl = document.getElementById("footer-year");

    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    if (clockEl) {
        // 用访问者自己的时区，不要写死 UTC+8
        var timeFmt;
        try {
            timeFmt = new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZoneName: "short",
            });
        } catch (e) {
            timeFmt = null;
        }

        function tickClock() {
            var now = new Date();
            clockEl.textContent = timeFmt
                ? timeFmt.format(now)
                : now.toLocaleTimeString();
        }

        tickClock();
        setInterval(tickClock, 1000);
    }

    /* ======================================================================
       指针驱动的效果
       光标聚光灯 / 磁性按钮 / 作品行跟随高光

       全部共用一个 rAF，插值在同一条循环里做。
       触屏设备直接跳过 —— 没有光标，这些效果只会白白占性能。
       ====================================================================== */
    var finePointer =
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (finePointer && !reduced) {
        var spot = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
        var spotRunning = false;
        var magnets = [];

        Array.prototype.forEach.call(
            document.querySelectorAll(".btn"),
            function (btn) {
                magnets.push({ el: btn, on: false });
            }
        );

        // 聚光灯：rAF 插值。追平目标就停帧，下次 mousemove 再唤醒 ——
        // 光标静止时不该还占着一条 rAF。
        // 立绘跟随光标轻微倾斜。走 CSS 的 rotate 属性，不用 transform ——
        // transform 已经被 GSAP 的视差占着（yPercent），写进去会互相覆盖。
        // rotate / translate / transform 是三个独立属性，会叠加。
        var charEl = document.getElementById("hero-char");
        var charRot = 0;

        function spotLoop() {
            spot.x += (spot.tx - spot.x) * 0.09;
            spot.y += (spot.ty - spot.y) * 0.09;

            de.style.setProperty("--mx", (spot.x * 100).toFixed(2) + "%");
            de.style.setProperty("--my", (spot.y * 100).toFixed(2) + "%");

            // 倾角必须相对视口中心算（spot.x 的范围是 0..1，中心 0.5）。
            // 直接拿 spot.x 当角度的话，静止时就带着 1.75° 的歪斜 ——
            // 而旋转会撑大包围盒，实测把页面顶宽了 20px。
            var wantRot = charEl ? (spot.x - 0.5) * 7 : 0;   // ±3.5°
            if (charEl) {
                charRot += (wantRot - charRot) * 0.07;
                charEl.style.rotate = charRot.toFixed(2) + "deg";
            }

            if (
                Math.abs(spot.tx - spot.x) < 0.0004 &&
                Math.abs(spot.ty - spot.y) < 0.0004 &&
                Math.abs(charRot - wantRot) < 0.01
            ) {
                spotRunning = false;
                return;
            }
            requestAnimationFrame(spotLoop);
        }

        document.addEventListener(
            "mousemove",
            function (e) {
                spot.tx = e.clientX / window.innerWidth;
                spot.ty = e.clientY / window.innerHeight;
                if (!spotRunning) {
                    spotRunning = true;
                    requestAnimationFrame(spotLoop);
                }

                // 磁性按钮：光标进入按钮外扩一圈的范围才开始"吸"。
                // 直接写 translate，平滑交给 CSS transition —— 这里不需要
                // rAF，光标不动时每帧写同一个值是白费。
                //
                // 先读完所有矩形再统一写样式：读写交错会强制同步布局
                // （样式一写，下一次 getBoundingClientRect 就得重排整页）。
                var boxes = magnets.map(function (m) {
                    return m.el.getBoundingClientRect();
                });

                var next = boxes.map(function (r) {
                    var mx = e.clientX - (r.left + r.width / 2);
                    var my = e.clientY - (r.top + r.height / 2);
                    var dist = Math.sqrt(mx * mx + my * my);
                    var radius = Math.max(r.width, r.height) * 0.75 + 70;
                    if (dist >= radius) return null;
                    var pull = (1 - dist / radius) * 0.32;
                    return [mx * pull, my * pull];
                });

                next.forEach(function (v, i) {
                    var m = magnets[i];
                    if (v) {
                        m.el.style.translate =
                            v[0].toFixed(1) + "px " + v[1].toFixed(1) + "px";
                        m.on = true;
                    } else if (m.on) {
                        m.el.style.translate = "";
                        m.on = false;
                    }
                });
            },
            { passive: true }
        );

        // 作品行跟随高光：记录光标在该行内的相对位置
        Array.prototype.forEach.call(
            document.querySelectorAll(".work-row"),
            function (row) {
                row.addEventListener(
                    "mousemove",
                    function (e) {
                        var r = row.getBoundingClientRect();
                        row.style.setProperty(
                            "--rx",
                            (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%"
                        );
                        row.style.setProperty(
                            "--ry",
                            (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%"
                        );
                    },
                    { passive: true }
                );
            }
        );

        // 启动聚光灯，让它从初始位置平滑滑到光标处
        spotRunning = true;
        requestAnimationFrame(spotLoop);
    } else {
        // 触屏或减少动效：把按钮上可能残留的位移清掉
        Array.prototype.forEach.call(
            document.querySelectorAll(".btn"),
            function (btn) {
                btn.style.translate = "";
            }
        );
    }

    /* ======================================================================
       滚动视差
       背景、首屏文字、常驻动画以不同速度移动，产生纵深。
       maximeheckel 用的就是这个手法（内部叫 --scene-follow-distance）。
       ====================================================================== */
    if (window.gsap && window.ScrollTrigger && !reduced) {
        var wideEnough = window.matchMedia("(min-width: 861px)").matches;

        if (wideEnough) {
            // 首屏文字：随滚动缓慢上移
            gsap.to(".hero__copy", {
                yPercent: -14,
                ease: "none",
                scrollTrigger: {
                    trigger: ".hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: 0.6,
                },
            });

            // 常驻动画：移动得更快，拉开与文字的前后关系
            gsap.to(".hero__char", {
                yPercent: -34,
                ease: "none",
                scrollTrigger: {
                    trigger: ".hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: 0.6,
                },
            });
        }

        // 背景网格整页缓慢漂移 —— 幅度很小，但整个页面因此有了"在动"的底子
        gsap.to(".site-bg", {
            yPercent: 6,
            ease: "none",
            scrollTrigger: {
                trigger: document.documentElement,
                start: "top top",
                end: "bottom bottom",
                scrub: 1.2,
            },
        });
    }

    /* ======================================================================
       揭示动效
       ====================================================================== */

    // 给错位容器的子元素标序号，CSS 用 --i 算延迟
    Array.prototype.forEach.call(
        document.querySelectorAll(".reveal-stagger"),
        function (group) {
            Array.prototype.forEach.call(group.children, function (child, i) {
                child.style.setProperty("--i", i);
            });
        }
    );

    function markRevealed(node) {
        node.setAttribute("data-revealed", "");
    }

    /* ---- GSAP 路径 ---- */
    function initGsap() {
        var gsap = window.gsap;

        if (window.ScrollTrigger) {
            gsap.registerPlugin(window.ScrollTrigger);
        }

        // Hero：一条时间轴，而不是靠一堆 CSS delay 拼凑。
        // mask-reveal 不在 GSAP 的管辖范围内 —— 它的 clip-path 动效交给 CSS，
        // 见 motion.css 里的说明。这里只负责在时间轴上给它打揭示标记。
        var heroBits = document.querySelectorAll(".hero .reveal");

        if (heroBits.length) {
            var tl = gsap.timeline({ defaults: { ease: "expo.out" } });

            tl.to(heroBits, {
                opacity: 1,
                y: 0,
                duration: 1,
                stagger: 0.08,
                onStart: function () {
                    // 一次把 hero 里所有需要揭示的元素都标记掉。
                    // mask-reveal 的错位由它们各自的 --reveal-delay 交给 CSS 处理 ——
                    // 不要用 gsap.delayedCall 去延后标记，它依赖 GSAP 的 ticker，
                    // 在无头/降频环境下不一定触发。
                    Array.prototype.forEach.call(
                        document.querySelectorAll(
                            ".hero .reveal, .hero .mask-reveal"
                        ),
                        markRevealed
                    );
                },
            });

            if (reduced) tl.progress(1);
        } else {
            Array.prototype.forEach.call(
                document.querySelectorAll(".hero .mask-reveal"),
                markRevealed
            );
        }

        // 其余区块：滚动进入时揭示
        var rest = document.querySelectorAll(
            "main > section:not(.hero) .reveal, " +
                "main > section:not(.hero) .reveal-stagger, " +
                ".site-footer .reveal"
        );

        Array.prototype.forEach.call(rest, function (node) {
            if (reduced || !window.ScrollTrigger) {
                markRevealed(node);
                return;
            }

            var isGroup = node.classList.contains("reveal-stagger");

            window.ScrollTrigger.create({
                trigger: node,
                start: "top 88%",
                once: true,
                onEnter: function () {
                    markRevealed(node);

                    if (isGroup) {
                        // 容器本身不动，动的是子元素 —— 这样才有错位感
                        gsap.fromTo(
                            node.children,
                            { opacity: 0, y: 18 },
                            {
                                opacity: 1,
                                y: 0,
                                duration: 0.7,
                                ease: "expo.out",
                                stagger: 0.07,
                            }
                        );
                    } else {
                        gsap.fromTo(
                            node,
                            { opacity: 0, y: 24 },
                            {
                                opacity: 1,
                                y: 0,
                                duration: 0.9,
                                ease: "expo.out",
                            }
                        );
                    }
                },
            });
        });
    }

    /* ---- 回退路径：IntersectionObserver + CSS ---- */
    function initObserver() {
        var nodes = document.querySelectorAll(
            ".reveal, .reveal-stagger, .mask-reveal"
        );

        if (!("IntersectionObserver" in window)) {
            revealEverything();
            return;
        }

        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        markRevealed(entry.target);
                        io.unobserve(entry.target);
                    }
                });
            },
            { rootMargin: "0px 0px -12% 0px", threshold: 0 }
        );

        Array.prototype.forEach.call(nodes, function (node) {
            io.observe(node);
        });
    }

    /* ---- 启动 ---- */
    var revealsStarted = false;

    function startReveals() {
        // 必须防重入。ohto:revealed 和下面的兜底定时器都会走到这里，
        // 早先没有这道闸，结果是 initGsap 跑了两遍 —— 每个元素身上挂了
        // 两个 ScrollTrigger，滚到区块时会看见入场动画原地播两次，
        // 像是页面"刷新了一下"。
        if (revealsStarted) return;
        revealsStarted = true;

        try {
            if (hasGsap) {
                initGsap();
            } else {
                initObserver();
            }
        } catch (err) {
            // 任何意外都不能让内容留在不可见状态
            revealEverything();
        }
    }

    if (de.classList.contains("is-skip-preloader")) {
        // 本次访问没有加载页，直接开始
        startReveals();
    } else {
        // 万一 ohto:revealed 没来（加载页脚本被拦等）的兜底。
        // 引用要留住，好在事件正常时把它取消掉。
        var revealFallback = setTimeout(startReveals, 4200);

        // 等加载页的幕布拉开再入场 —— 否则动画全在遮罩后面白跑一遍
        document.addEventListener(
            "ohto:revealed",
            function () {
                clearTimeout(revealFallback);
                startReveals();
            },
            { once: true }
        );
    }
})();
