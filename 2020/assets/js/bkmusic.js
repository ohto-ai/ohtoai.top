/*
 * Background music + UI sounds.
 *
 * Music is intentionally NOT loaded on page load: the track is several MB and
 * browsers block audible autoplay anyway. It starts on the first user gesture
 * (and can be muted by the "Home" tile for the rest of the session).
 */
(function () {
    var MUSIC_LIST = [
        "assets/music/ShangShangang-background.mp3"
    ];
    var SOUND_LIST = [
        "assets/sound/attacking.ogg",
        "assets/sound/comrade.ogg",
        "assets/sound/conscript_reporting.ogg",
        "assets/sound/da.ogg",
        "assets/sound/for_the_home country.ogg",
        "assets/sound/for_the_union.ogg",
        "assets/sound/moving_out.ogg",
        "assets/sound/order_received.ogg",
        "assets/sound/waiting_orders.ogg",
        "assets/sound/you_are_sure.ogg"
    ];
    var MUTE_KEY = "thatboy-music-muted";

    function byId(id) {
        return document.getElementById(id);
    }

    function play(el) {
        var result = el.play();
        if (result && result.catch) {
            // Autoplay may still be refused (e.g. no user activation yet).
            result.catch(function () { });
        }
    }

    function isMuted() {
        try {
            return sessionStorage.getItem(MUTE_KEY) === "1";
        } catch (e) {
            return false;
        }
    }

    function callSound() {
        var sound = byId("sound");
        if (!sound || !SOUND_LIST.length) return;
        sound.src = SOUND_LIST[Math.floor(Math.random() * SOUND_LIST.length)];
        sound.volume = 0.5;
        play(sound);
    }

    var music = byId("music");
    var musicStarted = false;

    function switchRandomMusic() {
        if (!music || !MUSIC_LIST.length) return;
        music.src = MUSIC_LIST[Math.floor(Math.random() * MUSIC_LIST.length)];
        music.volume = 0.5;
        play(music);
    }

    function startMusic() {
        if (!music || musicStarted || isMuted()) return;
        musicStarted = true;
        switchRandomMusic();
    }

    // Called from inline onclick handlers in content.html.
    window.callSound = callSound;
    window.switchRandomMusic = switchRandomMusic;
    window.startMusic = startMusic;

    if (music) {
        music.addEventListener("ended", switchRandomMusic);

        var events = ["click", "keydown"];
        var onFirstGesture = function () {
            for (var i = 0; i < events.length; i++) {
                document.removeEventListener(events[i], onFirstGesture);
            }
            startMusic();
        };
        for (var i = 0; i < events.length; i++) {
            document.addEventListener(events[i], onFirstGesture);
        }
    }
})();
