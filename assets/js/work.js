/*
 * work.js — 作品区渲染
 *
 * 数据来自 repos.data.js（由 GitHub Action 预生成，不走运行时 API）。
 * 每一行都是**真链接** —— 中键、右键复制链接、读屏软件、禁用 JS 全部正常。
 */
(function () {
    "use strict";

    var list = document.getElementById("work-list");
    var data = window.OhtoRepos;

    if (!list) return;

    /* ----------------------------------------------------------------------
       语言色点 —— GitHub 官方配色
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

    var ARROW_SVG =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<path d="M7 17L17 7M7 7h10v10"/></svg>';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        // 一律用 textContent —— 描述来自 GitHub，不能当 HTML 解析
        if (text != null) node.textContent = text;
        return node;
    }

    function buildRow(repo, index) {
        var a = document.createElement("a");
        a.className = "work-row";
        a.href = "https://github.com/" + (data.login || "Ohto-Ai") + "/" + repo.name;
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        a.appendChild(
            el("span", "work-row__index", String(index + 1).padStart(2, "0"))
        );

        var body = el("span", "work-row__body");
        body.appendChild(el("span", "work-row__title", repo.name));

        if (repo.desc) {
            body.appendChild(el("span", "work-row__desc", repo.desc));
        }
        a.appendChild(body);

        var meta = el("span", "work-row__meta");

        if (repo.lang) {
            var lang = el("span", "work-row__lang");
            var dot = el("span", "work-row__dot");
            dot.style.background = LANG_COLORS[repo.lang] || "var(--text-disabled)";
            lang.appendChild(dot);
            lang.appendChild(document.createTextNode(repo.lang));
            meta.appendChild(lang);
        }

        if (repo.stars > 0) {
            meta.appendChild(el("span", "work-row__stars", "★ " + repo.stars));
        }

        var arrow = el("span", "work-row__arrow");
        arrow.innerHTML = ARROW_SVG;
        meta.appendChild(arrow);

        a.appendChild(meta);
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
            "项目列表暂时不可用，请直接访问 GitHub。"
        );
        list.parentNode.insertBefore(empty, list.nextSibling);
        return;
    }

    var frag = document.createDocumentFragment();
    repos.forEach(function (repo, i) {
        frag.appendChild(buildRow(repo, i));
    });
    list.appendChild(frag);

    // 行数统计
    var countEl = document.getElementById("work-count");
    if (countEl) {
        countEl.textContent =
            repos.length + " 个精选 · 共 " + (data.total || "?") + " 个公开仓库";
    }

    // "全部仓库"按钮带上总数
    var allLabel = document.getElementById("work-all-label");
    if (allLabel && data.total) {
        allLabel.textContent = "全部 " + data.total + " 个仓库";
    }
})();
