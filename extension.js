import GLib from 'gi://GLib';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class HighlightFocusedWindowExtension extends Extension {
    enable() {
        this._border = null;
        this._transitionUpdateId = 0;
        this._transitionUpdateCount = 0;

        this._signals = [
            [global.display, global.display.connect('notify::focus-window', () => this._refresh())],
            [global.display, global.display.connect('window-created', () => this._refresh())],
            [global.window_manager, global.window_manager.connect('size-change', () => {
                this._removeBorder();
                this._startTransitionRefresh();
            })],
            [global.window_manager, global.window_manager.connect('size-changed', () => {
                this._startTransitionRefresh();
            })],
        ];

        this._refresh();
    }

    disable() {
        this._signals?.forEach(([object, id]) => object.disconnect(id));
        this._signals = null;

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

    _refresh() {
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
        global.window_group.add_child(this._border);
        this._border.set_position(rect.x, rect.y);
        this._border.set_size(rect.width, rect.height);
        this._border.show();
    }
}
