const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Main = imports.ui.main;
const Search = imports.ui.search;
const SearchDisplay = imports.ui.searchDisplay;
const IconGrid = imports.ui.iconGrid;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Util = imports.misc.util;
const URLHighlighter = imports.ui.messageTray.URLHighlighter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Prefs = Me.imports.prefs;

const MAX_SEARCH_RESULTS_COLUMNS = 2
const ICON_SIZE = 120;

const shell_version = imports.misc.config.PACKAGE_VERSION;
const settings = Convenience.getSettings();

function init() {
    // nothing
}
function enable() {
    // nothing
}
function disable() {
    // nothing
}
