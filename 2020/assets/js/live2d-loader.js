/*
 * Load the Live2D widget after the page itself is done.
 * The widget (177 KB of JS + a model fetched from unpkg) is decorative, so it
 * should never compete with the page's own assets for bandwidth.
 */
(function () {
    var base = "assets/js/";

    function loadScript(src, onload) {
        var script = document.createElement("script");
        script.src = src;
        script.onload = onload;
        document.head.appendChild(script);
    }

    function boot() {
        // The main bundle defines the webpack runtime; the numbered file is the
        // chunk it registers. Loading the chunk first (as the old pages did)
        // throws "webpackJsonpL2Dwidget is not defined".
        loadScript(base + "L2Dwidget.min.js", function () {
            loadScript(base + "L2Dwidget.0.min.js", function () {
                if (!window.L2Dwidget) return;
                L2Dwidget.init({
                    "display": {
                        "superSample": 1,
                        "width": 200,
                        "height": 400,
                        "position": "left",
                        "hOffset": 0,
                        "vOffset": 0
                    }
                });
            });
        });
    }

    function schedule() {
        if (window.requestIdleCallback) {
            requestIdleCallback(boot, { timeout: 3000 });
        } else {
            setTimeout(boot, 1500);
        }
    }

    if (document.readyState === "complete") {
        schedule();
    } else {
        window.addEventListener("load", schedule);
    }
})();
