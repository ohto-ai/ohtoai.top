/* Click effect: a random word floats up and fades out. Vanilla JS, no jQuery. */
(function () {
    var textsClick = ["富强", "民主", "文明", "和谐", "自由", "平等", "公正", "法治", "爱国", "敬业", "诚信", "友善"];
    var textIndex = 0;

    document.addEventListener("click", function (e) {
        var span = document.createElement("span");
        span.textContent = textsClick[textIndex];
        textIndex = (textIndex + 1) % textsClick.length;

        span.style.position = "absolute";
        span.style.zIndex = "999999";
        span.style.left = e.pageX + "px";
        span.style.top = (e.pageY - 20) + "px";
        span.style.fontSize = "0.5rem";
        span.style.fontWeight = "bold";
        span.style.pointerEvents = "none";
        span.style.color = "rgb(" + Math.floor(255 * Math.random()) + "," +
            Math.floor(255 * Math.random()) + "," + Math.floor(255 * Math.random()) + ")";
        document.body.appendChild(span);

        var done = function () {
            if (span.parentNode) span.parentNode.removeChild(span);
        };
        if (span.animate) {
            var animation = span.animate([
                { top: (e.pageY - 20) + "px", opacity: 1 },
                { top: (e.pageY - 180) + "px", opacity: 0 }
            ], {
                duration: 1500,
                easing: "cubic-bezier(0.25, 0.1, 0.25, 1)"
            });
            animation.onfinish = done;
        } else {
            setTimeout(done, 1500);
        }
    });
})();
