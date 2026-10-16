/*
 * work.js — 作品区渲染
 *
 * 数据来自 repos.data.js（由 GitHub Action 预生成，不走运行时 API）。
 * 每张卡片都是**真链接** —— 中键、右键复制链接、读屏软件、禁用 JS 全部正常。
 *
 * 布局（跨列宽度、图片宽高比）全部由 CSS 的 nth-child 决定，
 * 所以数据里不需要写任何布局字段。
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

        /* ---- 图区 ---- */
        var shot = el("div", "work-card__shot");
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

        /* ---- 标题 ---- */
        a.appendChild(el("h3", "work-card__title", repo.name));

        /* ---- 标签：直接取 GitHub 上该仓库的 topics ----
           超过 MAX_TAGS 就不再显示 —— client-tools 那种挂了 5 个的，
           而且 mc / minecraft / minecraft-mod 三个说的是同一件事。
           topics 在 GitHub 上本来就是小写连字符，原样显示即可。 */
        var topics = Array.isArray(repo.topics) ? repo.topics : [];
        if (topics.length) {
            var tagList = el("ul", "work-card__tags");
            topics.slice(0, MAX_TAGS).forEach(function (t) {
                tagList.appendChild(el("li", "work-card__tag", t));
            });
            a.appendChild(tagList);
        }

        /* ---- 描述 ---- */
        if (repo.desc) {
            a.appendChild(el("p", "work-card__desc", repo.desc));
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
        a.appendChild(foot);

        return a;
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

    var frag = document.createDocumentFragment();
    repos.forEach(function (repo) {
        frag.appendChild(buildCard(repo));
    });
    grid.appendChild(frag);

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
})();
