/*global log, global */ // <-- for jshint
/** Credit:
 *  based off prefs.js from the gnome shell extensions repository at
 *  git.gnome.org/browse/gnome-shell-extensions
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Params = imports.misc.params;

const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
let extensionPath = Me.path;

// Settings
const PACKAGES_KEYWORD = 'keyword';

function init() {
}

const packagesPrefsGrid = new GObject.Class({
    Name: 'Prefs.Grid',
    GTypeName: 'packagesPrefsGrid',
    Extends: Gtk.Grid,

    _init: function (params) {
        this.parent(params);
        this.margin = this.row_spacing = this.column_spacing = 10;
        this._rownum = 0;
        this._settings = Convenience.getSettings();

        Gtk.Settings.get_default().gtk_button_images = true;
    },

    addEntry: function (text, key) {
        let item = new Gtk.Entry({ hexpand: true });
        item.text = this._settings.get_string(key);
        this._settings.bind(key, item, 'text', Gio.SettingsBindFlags.DEFAULT);
        return this.addRow(text, item);
    },

    addBoolean: function (text, key) {
        let item = new Gtk.Switch({active: this._settings.get_boolean(key)});
        this._settings.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        return this.addRow(text, item);
    },

    addSpin: function (label, key, adjustmentProperties, spinProperties) {
        adjustmentProperties = Params.parse(adjustmentProperties, {
            lower: 0,
            upper: 100,
            step_increment: 100
        });
        let adjustment = new Gtk.Adjustment(adjustmentProperties);
        spinProperties = Params.parse(spinProperties, {
            adjustment: adjustment,
            numeric: true,
            snap_to_ticks: true
        }, true);
        let spinButton = new Gtk.SpinButton(spinProperties);

        spinButton.set_value(this._settings.get_int(key));
        spinButton.connect('value-changed', Lang.bind(this, function (spin) {
            let value = spin.get_value_as_int();
            if(this._settings.get_int(key) !== value) {
                this._settings.set_int(key, value);
            }
        }));
        return this.addRow(label, spinButton, true);
    },

    addShortcut: function(text, settings_key) {
        let item = new Gtk.Entry({
            hexpand: false
        });
        item.set_text(this._settings.get_strv(settings_key)[0]);
        item.connect('changed', Lang.bind(this, function(entry) {
            let [key, mods] = Gtk.accelerator_parse(entry.get_text());

            if(Gtk.accelerator_valid(key, mods)) {
                let shortcut = Gtk.accelerator_name(key, mods);
                this._settings.set_strv(settings_key, [shortcut]);
            }
        }));

        return this.addRow(text, item);
    },

    addRow: function (text, widget, wrap) {
        let label = new Gtk.Label({
            label: text,
            hexpand: true,
            halign: Gtk.Align.START,
            use_markup: true
        });
        label.set_line_wrap(wrap || false);
        this.attach(label, 0, this._rownum, 1, 1); // col, row, colspan, rowspan
        this.attach(widget, 1, this._rownum, 1, 1);
        this._rownum++;
        return widget;
    },

    addItem: function (widget, col, colspan, rowspan) {
        this.attach(widget, col || 0, this._rownum, colspan || 2, rowspan || 1);
        this._rownum++;
        return widget;
    }
});

const packagesSearchProviderPrefsWidget = new GObject.Class({
    Name: 'packagesSearchProvider.Prefs.Widget',
    GTypeName: 'packagesSearchProviderPrefsWidget',
    Extends: Gtk.Box,

    _init: function (params) {
        this.parent(params);
        this._settings = Convenience.getSettings();

        let main_page = this._get_main_page();

        let notebook = new Gtk.Notebook({
            margin_left: 5,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 5,
            expand: true
        });

        notebook.append_page(main_page.page, main_page.label);

        this.add(notebook);
    },

    _get_main_page: function() {
        let page_label = new Gtk.Label({
            label: 'Settings'
        });
        let page = new packagesPrefsGrid();

        // keyword
        let keyword = page.addEntry(
            "Keyword:",
            PACKAGES_KEYWORD
        );

        let result = {
            label: page_label,
            page: page
        };
        return result;
    },
});

function buildPrefsWidget() {
    let widget = new packagesSearchProviderPrefsWidget();
    widget.show_all();

    return widget;
}
