/*
 * bgm.js — 首页背景音乐开关
 *
 * 音源：HOYO-MiX《风息的离别诗 Zeitlind's Poem》整曲（175s），
 * Opus 24kbps mono（.webm）为主源，AAC 40kbps（.m4a）兜底 Safari。
 * 曲子开头极轻、结尾自然淡出，整曲循环的接缝天生顺滑。
 *
 * 交互：
 *   · 左键开关 —— 播放/暂停（含淡入淡出）；
 *   · 右键开关 —— 展开小控制面板：播放/暂停 + 音量滑杆；
 *   · 浏览器禁止有声自动播放 —— 默认关闭，开启只来自用户点击；
 *   · 上次离开时开着（localStorage），本次在首次交互时自动续上，
 *     且若那次交互本身就点在开关上则让位给 click，避免双重切换；
 *   · 音量记忆在 localStorage，淡入淡出目标跟随用户音量。
 */
(function () {
    "use strict";

    var wrap = document.getElementById("bgm");
    var audio = document.getElementById("bgm-audio");
    var btn = document.getElementById("bgm-toggle");
    var panel = document.getElementById("bgm-panel");
    var playBtn = document.getElementById("bgm-play");
    var volumeInput = document.getElementById("bgm-volume");
    var volumeLabel = document.getElementById("bgm-volume-label");
    if (!wrap || !audio || !btn || !panel || !playBtn || !volumeInput || !volumeLabel) return;

    var KEY = "ohto:bgm";
    var KEY_VOL = "ohto:bgm:vol";
    var DEFAULT_VOLUME = 0.45;
    var fadeTimer = null;
    var wanted = false; // 用户意图；与 audio 的瞬时状态分开记
    var panelOpen = false;

    /* ------------------------------------------------------------------
       音量：读用户上次的选择，淡入淡出以它为目标
       ------------------------------------------------------------------ */
    function userVolume() {
        try {
            var v = parseFloat(localStorage.getItem(KEY_VOL));
            if (isFinite(v) && v >= 0 && v <= 1) return v;
        } catch (e) {
            /* 不可用就用默认值 */
        }
        return DEFAULT_VOLUME;
    }

    function saveVolume(v) {
        try {
            localStorage.setItem(KEY_VOL, String(v));
        } catch (e) {
            /* 同上 */
        }
    }

    audio.volume = userVolume();
    volumeInput.value = Math.round(audio.volume * 100);
    volumeLabel.textContent = Math.round(audio.volume * 100) + "%";

    /* ------------------------------------------------------------------
       状态与音量
       ------------------------------------------------------------------ */
    function setPressed(on) {
        wanted = on;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "Pause background music" : "Play background music");
        btn.classList.toggle("is-playing", on);
        // 面板里的播放按钮同步同一份状态（图标由 aria-pressed 驱动 CSS 切换）
        playBtn.setAttribute("aria-pressed", on ? "true" : "false");
        playBtn.setAttribute("aria-label", on ? "Pause background music" : "Play background music");
    }

    function fadeVolume(to) {
        if (fadeTimer) clearInterval(fadeTimer);
        var from = audio.volume;
        var t0 = performance.now();
        fadeTimer = setInterval(function () {
            var k = Math.min((performance.now() - t0) / 900, 1);
            audio.volume = from + (to - from) * k;
            if (k >= 1) {
                clearInterval(fadeTimer);
                fadeTimer = null;
                if (to === 0) audio.pause();
            }
        }, 50);
    }

    function turnOn() {
        setPressed(true);
        try {
            localStorage.setItem(KEY, "1");
        } catch (e) {
            /* 隐私模式等存不了就算了 */
        }
        audio.volume = 0;
        var p = audio.play();
        if (p && p.catch) {
            p.then(function () {
                fadeVolume(userVolume());
            }).catch(function () {
                // 自动播放被拒（比如续上时交互不算手势）——退回关闭态等下次点击
                setPressed(false);
                try {
                    localStorage.removeItem(KEY);
                } catch (e2) {
                    /* 同上 */
                }
            });
        } else {
            fadeVolume(userVolume());
        }
    }

    function turnOff() {
        setPressed(false);
        try {
            localStorage.removeItem(KEY);
        } catch (e) {
            /* 同上 */
        }
        fadeVolume(0);
    }

    /* ------------------------------------------------------------------
       控制面板（右键开关展开）
       ------------------------------------------------------------------ */
    function openPanel() {
        if (panelOpen) return;
        panelOpen = true;
        panel.hidden = false;
        // 锚定在开关右侧、底部对齐；放不下就换到左侧
        var r = btn.getBoundingClientRect();
        var pw = panel.offsetWidth;
        var left = r.right + 10;
        if (left + pw > window.innerWidth - 8) left = r.left - pw - 10;
        panel.style.left = left + "px";
        panel.style.bottom = window.innerHeight - r.bottom + "px";
        document.addEventListener("pointerdown", onDocDown, true);
        document.addEventListener("keydown", onPanelKey, true);
    }

    function closePanel() {
        if (!panelOpen) return;
        panelOpen = false;
        panel.hidden = true;
        document.removeEventListener("pointerdown", onDocDown, true);
        document.removeEventListener("keydown", onPanelKey, true);
    }

    function onDocDown(e) {
        // 点在面板或开关上不算"外面"——滑杆拖动时不能把面板关掉
        if (!panel.contains(e.target) && !btn.contains(e.target)) closePanel();
    }

    function onPanelKey(e) {
        if (e.key === "Escape") closePanel();
    }

    btn.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        panelOpen ? closePanel() : openPanel();
    });

    playBtn.addEventListener("click", function () {
        wanted ? turnOff() : turnOn();
    });

    volumeInput.addEventListener("input", function () {
        var v = Number(volumeInput.value) / 100;
        audio.volume = v; // 立即生效；若正在淡入淡出，拖动会被下一帧盖回——停手即稳定
        if (fadeTimer) {
            clearInterval(fadeTimer);
            fadeTimer = null;
        }
        volumeLabel.textContent = volumeInput.value + "%";
    });

    volumeInput.addEventListener("change", function () {
        saveVolume(Number(volumeInput.value) / 100);
    });

    /* ------------------------------------------------------------------
       主开关与自动续上
       ------------------------------------------------------------------ */
    btn.addEventListener("click", function () {
        wanted ? turnOff() : turnOn();
    });

    audio.addEventListener(
        "error",
        function () {
            // 两个源都拉不到（比如文件被裁掉）：开关与面板一并置灰
            btn.disabled = true;
            btn.setAttribute("aria-disabled", "true");
            btn.title = "Background music unavailable";
            closePanel();
        },
        true // <source> 的错误不冒泡到 audio，得用捕获
    );

    // 上次开着走：首次任意交互自动续上。
    // 那次交互若恰好点在开关上，让位给 click 自己处理，防止一开一关。
    try {
        if (localStorage.getItem(KEY) === "1") {
            function resume(e) {
                document.removeEventListener("pointerdown", resume, true);
                document.removeEventListener("keydown", resume, true);
                if (!wanted && !btn.contains(e.target)) turnOn();
            }
            document.addEventListener("pointerdown", resume, {
                once: true,
                capture: true,
            });
            document.addEventListener("keydown", resume, {
                once: true,
                capture: true,
            });
        }
    } catch (e) {
        /* localStorage 不可用就当没开过 */
    }
})();
