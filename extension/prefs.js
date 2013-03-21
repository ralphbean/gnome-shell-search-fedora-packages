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
const PACKAGES_SEARCH_FROM_CLIPBOARD = 'search-from-clipboard';
const PACKAGES_SEARCH_FROM_PRIMARY_SELECTION = 'search-from-primary-selection';
const PACKAGES_ENABLE_SHORTCUTS = 'enable-shortcuts';

const Themes = {
    LIGHT: 0,
    DARK: 1
};

function init() {
}

const packagesKeybindingsWidget = new GObject.Class({
    Name: 'packages.Keybindings.Widget',
    GTypeName: 'packagesKeybindingsWidget',
    Extends: Gtk.Box,

    _init: function(keybindings) {
        this.parent();
        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._keybindings = keybindings;
        this._settings = Convenience.getSettings();

        let scrolled_window = new Gtk.ScrolledWindow();
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC,
            Gtk.PolicyType.AUTOMATIC
        );

        this._columns = {
            NAME: 0,
            ACCEL_NAME: 1,
            MODS: 2,
            KEY: 3
        };

        this._store = new Gtk.ListStore();
        this._store.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT
        ]);

        this._tree_view = new Gtk.TreeView({
            model: this._store,
            hexpand: true,
            vexpand: true
        });
        this._tree_view.get_selection().set_mode(Gtk.SelectionMode.SINGLE);

        let action_renderer = new Gtk.CellRendererText();
        let action_column = new Gtk.TreeViewColumn({
            'title': 'Action',
            'expand': true
        });
        action_column.pack_start(action_renderer, true);
        action_column.add_attribute(action_renderer, 'text', 1);
        this._tree_view.append_column(action_column);

        let keybinding_renderer = new Gtk.CellRendererAccel({
            'editable': true,
            'accel-mode': Gtk.CellRendererAccelMode.GTK
        });
        keybinding_renderer.connect('accel-edited',
            Lang.bind(this, function(renderer, iter, key, mods) {
                let value = Gtk.accelerator_name(key, mods);
                let [success, iterator ] =
                    this._store.get_iter_from_string(iter);

                if(!success) {
                    printerr("Can't change keybinding");
                }

                let name = this._store.get_value(iterator, 0);

                this._store.set(
                    iterator,
                    [this._columns.MODS, this._columns.KEY],
                    [mods, key]
                );
                this._settings.set_strv(name, [value]);
            })
        );

        let keybinding_column = new Gtk.TreeViewColumn({
            'title': 'Modify'
        });
        keybinding_column.pack_end(keybinding_renderer, false);
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-mods',
            this._columns.MODS
        );
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-key',
            this._columns.KEY
        );
        this._tree_view.append_column(keybinding_column);

        scrolled_window.add(this._tree_view);
        this.add(scrolled_window);

        this._refresh();
    },

    _refresh: function() {
        this._store.clear();

        for(let settings_key in this._keybindings) {
            let [key, mods] = Gtk.accelerator_parse(
                this._settings.get_strv(settings_key)[0]
            );

            let iter = this._store.append();
            this._store.set(iter,
                [
                    this._columns.NAME,
                    this._columns.ACCEL_NAME,
                    this._columns.MODS,
                    this._columns.KEY
                ],
                [
                    settings_key,
                    this._keybindings[settings_key],
                    mods,
                    key
                ]
            );
        }
    }
});

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
        let keybindings_page = this._get_keybindings_page();

        let notebook = new Gtk.Notebook({
            margin_left: 5,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 5,
            expand: true
        });

        notebook.append_page(main_page.page, main_page.label);
        notebook.append_page(theme_page.page, theme_page.label);
        notebook.append_page(keybindings_page.page, keybindings_page.label);

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

    _get_keybindings_page: function() {
        let page_label = new Gtk.Label({
            label: 'Shortcuts'
        });
        let page = new packagesPrefsGrid();

        let enable_shortcuts = page.addBoolean(
            'Shortcuts:',
            PACKAGES_ENABLE_SHORTCUTS
        );
        enable_shortcuts.connect('notify::active',
            Lang.bind(this, function(s) {
                let active = s.get_active();
                keybindings_widget.set_sensitive(active);
            })
        );

        let shortcuts_enabled = this._settings.get_boolean(PACKAGES_ENABLE_SHORTCUTS);

        let keybindings = {};
        keybindings[PACKAGES_SEARCH_FROM_CLIPBOARD] = 'Search from clipboard';
        keybindings[PACKAGES_SEARCH_FROM_PRIMARY_SELECTION] =
            'Search from primary selection';

        let keybindings_widget = new packagesKeybindingsWidget(keybindings);
        keybindings_widget.set_sensitive(shortcuts_enabled);
        page.addItem(keybindings_widget)

        let label_text =
            '<sup>*</sup>Search from primary selection requires ' +
            '<a href="http://sourceforge.net/projects/xclip/">xclip</a>';
        page.addItem(new Gtk.Label({
            label: label_text,
            use_markup: true
        }));

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
