import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class HighlightFocusedWindowPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Appearance'});
        const group = new Adw.PreferencesGroup({
            title: 'Focused window border',
            description: 'Configure the border drawn around the focused window.',
        });
        page.add(group);
        window.add(page);

        const widthRow = new Adw.SpinRow({
            title: 'Border width',
            subtitle: 'Width in pixels',
        });
        widthRow.set_range(1, 50);
        widthRow.get_adjustment().set_step_increment(1);
        settings.bind('border-width', widthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(widthRow);

        const opacityRow = new Adw.SpinRow({
            title: 'Opacity',
            subtitle: 'Percentage from 0 to 100',
        });
        opacityRow.set_range(0, 100);
        opacityRow.get_adjustment().set_step_increment(1);
        settings.bind('opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(opacityRow);

        const colorRow = new Adw.EntryRow({
            title: 'Border color',
            text: settings.get_string('border-color'),
        });
        const colorButton = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog(),
        });
        colorButton.set_valign(Gtk.Align.CENTER);
        colorButton.set_hexpand(false);
        colorRow.add_suffix(colorButton);
        group.add(colorRow);

        let updatingColor = false;
        const setButtonColor = value => {
            const rgba = new Gdk.RGBA();
            if (rgba.parse(value)) {
                updatingColor = true;
                colorButton.set_rgba(rgba);
                updatingColor = false;
            }
        };
        setButtonColor(settings.get_string('border-color'));

        colorRow.connect('notify::text', () => {
            const value = colorRow.get_text().trim();
            const rgba = new Gdk.RGBA();
            if (!rgba.parse(value))
                return;

            const normalized = `#${[rgba.red, rgba.green, rgba.blue]
                .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0'))
                .join('')}`;
            if (normalized !== settings.get_string('border-color'))
                settings.set_string('border-color', normalized);
        });

        colorButton.connect('notify::rgba', button => {
            if (updatingColor)
                return;

            const rgba = button.get_rgba();
            const normalized = `#${[rgba.red, rgba.green, rgba.blue]
                .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0'))
                .join('')}`;
            colorRow.set_text(normalized);
            settings.set_string('border-color', normalized);
        });

        settings.connect('changed::border-color', () => {
            const value = settings.get_string('border-color');
            if (colorRow.get_text() !== value)
                colorRow.set_text(value);
            setButtonColor(value);
        });
    }
}
