import GLib from 'gi://GLib';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class HighlightFocusedWindowExtension extends Extension {
    enable() {
        this._highlight = new St.Widget({
            styleClass: 'focused-window-highlight',
            reactive: false,
            visible: false,
        });

        Main.layoutManager.addTopChrome(this._highlight, {trackFullscreen: true});

        this._signals = [
            [global.display, global.display.connect('notify::focus-window', () => this._update())],
            [global.display, global.display.connect('window-created', () => this._update())],
        ];

        this._windowSignals = new Map();
        this._transitionUpdateId = 0;
        this._transitionUpdateCount = 0;

        this._signals.push([
            global.window_manager,
            global.window_manager.connect('size-changed', () => this._scheduleDelayedUpdate()),
        ]);

        this._watchFocusedWindow();
        this._update();
    }

    disable() {
        for (const [window, ids] of this._windowSignals)
            ids.forEach(id => window.disconnect(id));
        this._windowSignals.clear();

        this._signals?.forEach(([object, id]) => object.disconnect(id));
        this._signals = null;

        if (this._transitionUpdateId)
            GLib.Source.remove(this._transitionUpdateId);
        this._transitionUpdateId = 0;

        this._highlight?.destroy();
        this._highlight = null;
    }

    _watchFocusedWindow() {
        const window = global.display.focus_window;
        if (!window || this._windowSignals.has(window))
            return;

        const ids = [
            window.connect('position-changed', () => this._update()),
            window.connect('size-changed', () => this._update()),
            window.connect('notify::minimized', () => this._update()),
        ];
        this._windowSignals.set(window, ids);
    }

    _scheduleDelayedUpdate() {
        if (this._transitionUpdateId)
            GLib.Source.remove(this._transitionUpdateId);

        this._transitionUpdateCount = 0;
        this._transitionUpdateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._transitionUpdateCount++;
            this._update();

            if (this._transitionUpdateCount >= 10) {
                this._transitionUpdateId = 0;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    }

    _update() {
        if (!this._highlight)
            return;

        this._watchFocusedWindow();

        const window = global.display.focus_window;
        const actor = window?.get_compositor_private();
        if (!window || !actor || window.minimized || !actor.visible) {
            this._highlight.hide();
            return;
        }

        const [x, y] = actor.get_transformed_position();
        const [width, height] = actor.get_transformed_size();
        if (width <= 0 || height <= 0) {
            this._highlight.hide();
            return;
        }

        this._highlight.set_position(Math.round(x), Math.round(y));
        this._highlight.set_size(Math.round(width), Math.round(height));
        this._highlight.show();
    }
}
