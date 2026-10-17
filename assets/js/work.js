/*
 * work.js — 作品区渲染
 *
 * 数据来自 repos.data.js（由 GitHub Action 预生成，不走运行时 API）。
 * 每张卡片都是**真链接** —— 中键、右键复制链接、读屏软件、禁用 JS 全部正常。
 *
 * 布局是"砖墙"：三列宽度 5:4:3，砖块高度由图片比例和文字内容自然决定，
 * 块与块之间只留 2px 缝。横向 / 纵向的图文组合也在这里决定 ——
 * 宽列隔一块做一次横向图文，窄列始终纵向。
 * 列数只在跨断点时重排一次，拖动窗口不会反复重建 DOM。
 */
(function () {
    "use strict";

    var grid = document.getElementById("work-list");
    var data = window.OhtoRepos;

    if (!grid) return;

    /* ----------------------------------------------------------------------
       语言色 —— GitHub 官方配色
       ---------------------------------------------------------------------- */
    var LANG_COLORS = {
        "C++": "#f34b7d",
        C: "#555555",
        "C#": "#178600",
        CMake: "#DA3434",
        Java: "#b07219",
        Python: "#3572A5",
        JavaScript: "#f1e05a",
        TypeScript: "#3178c6",
        HTML: "#e34c26",
        CSS: "#563d7c",
        Shell: "#89e051",
        Rust: "#dea584",
        Go: "#00ADD8",
        Kotlin: "#A97BFF",
        Swift: "#F05138",
        Ruby: "#701516",
        PHP: "#4F5D95",
        Lua: "#000080",
        Vue: "#41b883",
    };

    // 每张卡最多显示几个 topic
    var MAX_TAGS = 3;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        // 一律用 textContent —— 数据来自 GitHub，不能当 HTML 解析
        if (text != null) node.textContent = text;
        return node;
    }

    function buildCard(repo) {
        var a = document.createElement("a");
        a.className = "work-card";
        a.href = "https://github.com/" + (data.login || "Ohto-Ai") + "/" + repo.name;
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        var langColor = LANG_COLORS[repo.lang] || "";
        if (langColor) a.style.setProperty("--lang", langColor);

        /* ---- 图区 ----
           缩略图是装饰性的：链接的可读名称由下面的标题提供，
           这里再读一遍仓库名 / "screenshot" 只会让读屏重复。 */
        var shot = el("div", "work-card__shot");
        shot.setAttribute("aria-hidden", "true");
        if (repo.shot) {
            var img = document.createElement("img");
            img.src = repo.shot;
            img.alt = repo.name + " screenshot";
            img.loading = "lazy";
            img.decoding = "async";
            // 图片缺失时退回占位块，而不是留一个破图标
            img.addEventListener("error", function () {
                img.remove();
                shot.classList.add("work-card__shot--ph");
                shot.appendChild(el("span", "work-card__ph-name", repo.name));
            });
            shot.appendChild(img);
        } else {
            shot.classList.add("work-card__shot--ph");
            shot.appendChild(el("span", "work-card__ph-name", repo.name));
        }
        a.appendChild(shot);

        /* ---- 文字区 ----
           标题、标签、描述、元信息各占一块，块与块之间用 1px 线分开。
           整块和上面的图区共用一条边，拼成一张完整的大矩形。 */
        var body = el("div", "work-card__body");

        body.appendChild(el("h3", "work-card__title", repo.name));

        /* 标签：直接取 GitHub 上该仓库的 topics ----
           超过 MAX_TAGS 就不再显示 —— client-tools 那种挂了 5 个的，
           而且 mc / minecraft / minecraft-mod 三个说的是同一件事。
           topics 在 GitHub 上本来就是小写连字符，原样显示即可。 */
        var topics = Array.isArray(repo.topics) ? repo.topics : [];
        if (topics.length) {
            var tagList = el("ul", "work-card__tags");
            topics.slice(0, MAX_TAGS).forEach(function (t) {
                tagList.appendChild(el("li", "work-card__tag", t));
            });
            body.appendChild(tagList);
        }

        if (repo.desc) {
            body.appendChild(el("p", "work-card__desc", repo.desc));
        }

        /* ---- 底部元信息 ---- */
        var foot = el("div", "work-card__foot");
        if (repo.lang) {
            var lang = el("span", "work-row__lang");
            var dot = el("span", "work-row__dot");
            dot.style.background = langColor || "var(--text-disabled)";
            lang.appendChild(dot);
            lang.appendChild(document.createTextNode(repo.lang));
            foot.appendChild(lang);
        }
        if (repo.stars > 0) {
            foot.appendChild(el("span", "work-row__stars", "★ " + repo.stars));
        }
        var arrow = el("span", "work-card__arrow", "↗");
        arrow.setAttribute("aria-hidden", "true");
        foot.appendChild(arrow);

        body.appendChild(foot);
        a.appendChild(body);

        return a;
    }

    /* ----------------------------------------------------------------------
       布局：按视口选列数和宽列比例
       ---------------------------------------------------------------------- */
    function getLayout() {
        if (window.innerWidth <= 760) {
            return {
                key: "one",
                columns: [
                    { cls: "work-col--wide", weight: 1, allowHorizontal: false },
                ],
            };
        }

        if (window.innerWidth <= 1100) {
            return {
                key: "two",
                columns: [
                    { cls: "work-col--wide", weight: 3, allowHorizontal: true },
                    { cls: "work-col--mid", weight: 2, allowHorizontal: false },
                ],
            };
        }

        return {
            key: "three",
            columns: [
                { cls: "work-col--wide", weight: 5, allowHorizontal: true },
                { cls: "work-col--mid", weight: 4, allowHorizontal: false },
                { cls: "work-col--narrow", weight: 3, allowHorizontal: false },
            ],
        };
    }

    // 按列宽比例分卡片，例如 12 张 → 5 / 4 / 3
    function splitCounts(total, weights) {
        var sum = weights.reduce(function (a, b) { return a + b; }, 0);
        var remaining = total;

        return weights.map(function (weight, i) {
            if (i === weights.length - 1) return remaining;

            var count = Math.round((total * weight) / sum);
            // 只有一张卡时保证它落在第一列（按比例四舍五入会把它推到最后一列）
            if (i === 0 && total > 0) count = Math.max(count, 1);

            count = Math.min(remaining, count);
            remaining -= count;
            return count;
        });
    }

    var currentKey = null;

    function render() {
        var layout = getLayout();
        if (layout.key === currentKey) return;

        var firstRender = currentKey === null;
        currentKey = layout.key;

        var weights = layout.columns.map(function (c) { return c.weight; });
        var counts = splitCounts(repos.length, weights);

        grid.textContent = "";

        var repoIndex = 0;

        layout.columns.forEach(function (config, columnIndex) {
            var col = el("div", "work-col " + config.cls);
            col.classList.add("reveal-stagger");

            var horizontal = 0;

            for (var i = 0; i < counts[columnIndex]; i++) {
                var card = buildCard(repos[repoIndex]);

                // 宽列隔一块做横向图文；相邻的横向块再左右翻转，
                // 免得整列都是同一个方向。
                if (config.allowHorizontal && i % 2 === 0) {
                    card.classList.add("work-card--h");
                    if (horizontal % 2 === 1) {
                        card.classList.add("work-card--h-flip");
                    }
                    horizontal++;
                }

                card.style.setProperty("--i", i);
                col.appendChild(card);
                repoIndex++;
            }

            grid.appendChild(col);
        });

        /* 断点重排发生在入场动画之后时，新节点没有 ScrollTrigger 接管。
           直接标记为已揭示，避免内容停在 opacity: 0。 */
        if (!firstRender) {
            Array.prototype.forEach.call(
                grid.querySelectorAll(".work-col"),
                function (col) {
                    col.setAttribute("data-revealed", "");
                }
            );
        }
    }

    /* ----------------------------------------------------------------------
       渲染
       ---------------------------------------------------------------------- */
    var repos = data && Array.isArray(data.featured) ? data.featured : [];

    if (!repos.length) {
        // 数据文件缺失或被拦截时的降级，而不是留一片空白
        var empty = el(
            "p",
            "work-empty",
            "Project list is unavailable right now — head to GitHub instead."
        );
        grid.parentNode.insertBefore(empty, grid.nextSibling);
        return;
    }

    render();

    // 数量统计
    var countEl = document.getElementById("work-count");
    if (countEl) {
        countEl.textContent =
            repos.length +
            " selected · " +
            (data.total || "?") +
            " public repositories";
    }

    // "All repositories" 按钮带上总数
    var allLabel = document.getElementById("work-all-label");
    if (allLabel && data.total) {
        allLabel.textContent = "All " + data.total + " repositories";
    }

    /* ----------------------------------------------------------------------
       跨断点时重排
       ---------------------------------------------------------------------- */
    var resizeTimer;

    window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
            var previousKey = currentKey;
            render();

            // 砖墙高度变了，滚动触发点的位置也得跟着重算
            if (previousKey !== currentKey && window.ScrollTrigger) {
                window.ScrollTrigger.refresh();
            }
        }, 150);
    });
})();
