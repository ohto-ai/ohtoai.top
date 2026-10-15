/*
 * repos.data.js — 作品区数据
 *
 * 这个文件由 .github/workflows/repos.yml 定期自动重新生成。
 * 页面把它当普通本地脚本加载，**不在运行时调 GitHub API** ——
 * api.github.com 在国内长期不稳定，运行时拉取会把"首屏依赖外部网络"
 * 这个刚被我们消除掉的故障模式又请回来。
 *
 * 想调整展示哪些仓库：改 workflow 里的 FEATURED 白名单即可。
 * 描述文本一律取自 GitHub 原样，不要在这里编造。
 *
 * @generated 2026-10-15（手工初始版本，之后由 Action 接手）
 */
window.OhtoRepos = {
    generated: "2026-10-15",
    login: "Ohto-Ai",
    total: 47,
    featured: [
        {
            name: "PostLive",
            desc: "Client for a study live-streaming platform — a student research project",
            lang: "C++",
            stars: 9,
            year: 2023,
        },
        {
            name: "LightPaper",
            desc: "A lightweight dynamic desktop (live wallpaper) engine in C++",
            lang: "C++",
            stars: 5,
            year: 2023,
        },
        {
            name: "NonogramGenerator",
            desc: "Nonogram generator — logic puzzles that paint a bitmap",
            lang: "C++",
            stars: 4,
            year: 2023,
        },
        {
            name: "CMakeProjectTemplate",
            desc: "CMake template for Windows and Ubuntu",
            lang: "CMake",
            stars: 3,
            year: 2023,
        },
        {
            name: "webhook",
            desc: "a webhook on Linux, Windows and MacOS",
            lang: "C++",
            stars: 3,
            year: 2022,
        },
    ],
};
