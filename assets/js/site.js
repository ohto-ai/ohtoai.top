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

    if (!reduced && typeof window.Lenis !== "undefined") {
        lenis = new window.Lenis({
            duration: 1.1,
            easing: function (t) {
                return Math.min(1, 1.001 - Math.pow(2, -10 * t));
            },
            smoothWheel: true,
        });

        // Lenis 接管滚动后，CSS 的 scroll-behavior 会打架，关掉它
        de.style.scrollBehavior = "auto";

        (function raf(time) {
            if (lenis) lenis.raf(time);
            requestAnimationFrame(raf);
        })(performance.now());

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

    /* ======================================================================
       导航滚动状态
       用 IntersectionObserver 盯一个哨兵元素，而不是监听 scroll 事件 ——
       scroll 回调每帧都跑，哨兵只在真正跨过阈值时才触发。
       ====================================================================== */
    var nav = document.getElementById("site-nav");

    if (nav) {
        var sentinel = document.createElement("div");
        sentinel.setAttribute("aria-hidden", "true");
        sentinel.style.cssText =
            "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
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
        function spotLoop() {
            spot.x += (spot.tx - spot.x) * 0.09;
            spot.y += (spot.ty - spot.y) * 0.09;

            de.style.setProperty("--mx", (spot.x * 100).toFixed(2) + "%");
            de.style.setProperty("--my", (spot.y * 100).toFixed(2) + "%");

            if (
                Math.abs(spot.tx - spot.x) < 0.0004 &&
                Math.abs(spot.ty - spot.y) < 0.0004
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
            gsap.to(".hero__canvas", {
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
    function startReveals() {
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
        // 等加载页的幕布拉开再入场 —— 否则动画全在遮罩后面白跑一遍
        document.addEventListener("ohto:revealed", startReveals, { once: true });

        // 万一那个事件没来（比如加载页脚本被拦），兜底
        setTimeout(startReveals, 4200);
    }
})();
