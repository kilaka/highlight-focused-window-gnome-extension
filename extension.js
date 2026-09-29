import GLib from 'gi://GLib';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class HighlightFocusedWindowExtension extends Extension {
    enable() {
        this._border = null;
        this._settings = this.getSettings();
        this._trackedWindow = null;
        this._trackedWindowSignals = [];
        this._transitionUpdateId = 0;
        this._transitionUpdateCount = 0;

        this._settingsSignals = [
            this._settings.connect('changed::border-width', () => this._refresh()),
            this._settings.connect('changed::border-color', () => this._refresh()),
            this._settings.connect('changed::opacity', () => this._refresh()),
        ];

        this._signals = [
            [global.display, global.display.connect('notify::focus-window', () => {
                this._trackFocusedWindow();
                this._refresh();
            })],
            [global.display, global.display.connect('window-created', () => {
                this._trackFocusedWindow();
                this._refresh();
            })],
            [global.window_manager, global.window_manager.connect('size-change', () => {
                this._removeBorder();
                this._startTransitionRefresh();
            })],
            [global.window_manager, global.window_manager.connect('size-changed', () => {
                this._startTransitionRefresh();
            })],
        ];

        this._trackFocusedWindow();
        this._refresh();
    }

    disable() {
        this._signals?.forEach(([object, id]) => object.disconnect(id));
        this._signals = null;
        this._untrackFocusedWindow();
        this._settingsSignals?.forEach(id => this._settings.disconnect(id));
        this._settingsSignals = null;
        this._settings = null;

        if (this._transitionUpdateId)
            GLib.Source.remove(this._transitionUpdateId);
        this._transitionUpdateId = 0;

        this._removeBorder();
    }

    _startTransitionRefresh() {
        if (this._transitionUpdateId)
            GLib.Source.remove(this._transitionUpdateId);

        this._transitionUpdateCount = 0;
        this._transitionUpdateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._transitionUpdateCount++;
            this._refresh();

            if (this._transitionUpdateCount >= 10) {
                this._transitionUpdateId = 0;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    }

    _removeBorder() {
        this._border?.destroy();
        this._border = null;
    }

    _trackFocusedWindow() {
        const window = global.display.focus_window;
        if (window === this._trackedWindow)
            return;

        this._untrackFocusedWindow();
        this._trackedWindow = window;
        if (!window)
            return;

        this._trackedWindowSignals = [
            [window, window.connect('position-changed', () => this._startTransitionRefresh())],
            [window, window.connect('size-changed', () => this._startTransitionRefresh())],
        ];
    }

    _untrackFocusedWindow() {
        this._trackedWindowSignals?.forEach(([object, id]) => object.disconnect(id));
        this._trackedWindowSignals = [];
        this._trackedWindow = null;
    }

    _refresh() {
        this._trackFocusedWindow();
        const window = global.display.focus_window;
        if (!window || window.minimized) {
            this._removeBorder();
            return;
        }

        const rect = window.get_frame_rect();
        if (rect.width <= 0 || rect.height <= 0)
            return;

        this._removeBorder();

        this._border = new St.Bin({
            styleClass: 'focused-window-highlight',
            reactive: false,
        });
        this._applyStyle();
        global.window_group.add_child(this._border);
        this._border.set_position(rect.x, rect.y);
        this._border.set_size(rect.width, rect.height);
        this._border.show();
    }

    _applyStyle() {
        if (!this._border || !this._settings)
            return;

        const width = this._settings.get_int('border-width');
        const color = this._settings.get_string('border-color');
        const opacity = this._settings.get_int('opacity') / 100;
        const hex = color.replace('#', '');
        const red = Number.parseInt(hex.slice(0, 2), 16);
        const green = Number.parseInt(hex.slice(2, 4), 16);
        const blue = Number.parseInt(hex.slice(4, 6), 16);

        this._border.set_style(
            `border: ${width}px solid rgba(${red}, ${green}, ${blue}, ${opacity}); ` +
            'background-color: transparent;'
        );
    }
}
