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
const PACKAGES_THEME = 'theme';
const PACKAGES_KEYWORD = 'keyword';
const PACKAGES_DELAY_TIME = 'delay-time';
const PACKAGES_RESULTS_ROWS = 'results-rows';
const PACKAGES_DEFAULT_LANGUAGE = 'default-language';
const PACKAGES_MAX_CHARS = 'max-chars';
const PACKAGES_TITLE_FONT_SIZE = 'title-font-size';
const PACKAGES_EXTRACT_FONT_SIZE = 'extract-font-size';
const PACKAGES_RESULT_WIDTH = 'result-width';
const PACKAGES_RESULT_HEIGHT = 'result-height';
const PACKAGES_ENABLE_SHORTCUTS = 'enable-shortcuts';

const Themes = {
    LIGHT: 0,
    DARK: 1
};

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
        let theme_page = this._get_theme_page();

        let notebook = new Gtk.Notebook({
            margin_left: 5,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 5,
            expand: true
        });

        notebook.append_page(main_page.page, main_page.label);
        notebook.append_page(theme_page.page, theme_page.label);

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

        // default language
        let default_language = page.addEntry(
            "Default language:",
            PACKAGES_DEFAULT_LANGUAGE
        );

        // delay time
        let delay = page.addSpin('Delay time(ms):', PACKAGES_DELAY_TIME, {
            lower: 100,
            upper: 5000,
            step_increment: 100
        });

        // max chars
        let max_chars = page.addSpin('Max chars:', PACKAGES_MAX_CHARS, {
            lower: 50,
            upper: 2000,
            step_increment: 50
        });

        let result = {
            label: page_label,
            page: page
        };
        return result;
    },

    _get_theme_page: function() {
        let page_label = new Gtk.Label({
            label: 'Theme'
        });
        let page = new packagesPrefsGrid();

        // theme
        let item = new Gtk.ComboBoxText();

        for(let theme in Themes) {
            if(Themes.hasOwnProperty(theme)) {
                let label =
                    theme[0].toUpperCase() + theme.substring(1).toLowerCase();
                item.insert(-1, Themes[theme].toString(), label);
            }
        }

        // item.set_active_id(this._settings.get_enum(PACKAGES_THEME)).toString();
        item.set_active_id(
            this._settings.get_enum(PACKAGES_THEME) == 0 ? '0' : '1'
        );
        item.connect('changed', Lang.bind(this, function (combo) {
            let value = parseInt(combo.get_active_id(), 10);

            if (value !== undefined &&
                this._settings.get_enum(PACKAGES_THEME) !== value) {
                this._settings.set_enum(PACKAGES_THEME, value);
            }
        }));
        page.addRow("Theme:", item);

        // title font size
        let title_font_size = page.addSpin(
            'Title font size(px):',
            PACKAGES_TITLE_FONT_SIZE, {
                lower: 1,
                upper: 40,
                step_increment: 1
            }
        );

        // extract font size
        let extract_font_size = page.addSpin(
            'Extract font size(px):',
            PACKAGES_EXTRACT_FONT_SIZE, {
                lower: 1,
                upper: 20,
                step_increment: 1
            }
        );

        // results rows
        let results_rows = page.addSpin(
            'Max results rows:',
            PACKAGES_RESULTS_ROWS, {
                lower: 1,
                upper: 10,
                step_increment: 1
            }
        );

        // requires restart
        page.addItem(new Gtk.Label({label: 'Requires restart shell'}));
        // result width
        page._result_width = page.addSpin(
            'Width(px):',
            PACKAGES_RESULT_WIDTH, {
                lower: 100,
                upper: 1500,
                step_increment: 10
            }
        );

        // result height
        page._result_height = page.addSpin(
            'Height(px):',
            PACKAGES_RESULT_HEIGHT, {
                lower: 50,
                upper: 1500,
                step_increment: 10
            }
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
