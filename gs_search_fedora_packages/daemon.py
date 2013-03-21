# This file is a part of search-fedorapackages.
#
# search-fedorapackages is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# search-fedorapackages is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with search-fedorapackages.  If not, see
# <http://www.gnu.org/licenses/>.
#
# Copyright (C) 2012 Red Hat, Inc.
# Author: Ralph Bean <rbean@redhat.com>


# Acknowledgement - This project was based on a fork from fedmsg-notify
# Copyright (C) 2012 Red Hat, Inc.
# Author: Luke Macken <lmacken@redhat.com>

from twisted.internet import gtk3reactor
gtk3reactor.install()
from twisted.internet import reactor

import dbus
import dbus.service
import os
import pkgwat.api
import requests
import urllib
import webbrowser

from gi.repository import Gio


# Convenience shorthand for declaring dbus interface methods.
# s.b.n. -> search_bus_name
search_bus_name = 'org.gnome.Shell.SearchProvider'
sbn = dict(dbus_interface=search_bus_name)


class SearchFedoraPackagesService(dbus.service.Object):
    """ The FedoraPackages Search Daemon.
    """
    bus_name = 'org.fedoraproject.fedorapackages.search'

    http_prefix = "https://apps.fedoraproject.org/packages"
    icon_tmpl = "https://apps.fedoraproject.org/packages/images/icons/%s.png"

    _icon_cache = {}
    _icon_cache_dir = os.path.expanduser("~/.cache/search-fedora-packages/")
    _search_cache = {}

    _object_path = '/%s' % bus_name.replace('.', '/')
    __name__ = "SearchFedoraPackagesService"

    def __init__(self):
        print "Constructing"
        self.settings = Gio.Settings.new(self.bus_name)
        if not self.settings.get_boolean('enabled'):
            return

        self.session_bus = dbus.SessionBus()
        bus_name = dbus.service.BusName(self.bus_name, bus=self.session_bus)
        dbus.service.Object.__init__(self, bus_name, self._object_path)
        self._initialize_icon_cache()

    @dbus.service.method(in_signature='s', **sbn)
    def ActivateResult(self, search_id):
        webbrowser.open(self.http_prefix + "/" + search_id.split(':')[0])
        reactor.callLater(0.1, reactor.stop)

    @dbus.service.method(in_signature='as', out_signature='as', **sbn)
    def GetInitialResultSet(self, terms):
        results = self._basic_search(terms)
        reactor.callLater(0.1, reactor.stop)
        return results

    @dbus.service.method(in_signature='as', out_signature='aa{sv}', **sbn)
    def GetResultMetas(self, ids):
        results = [
            dict(
                id=id,
                name=id.split(":")[0],
                gicon=self.iconify(id.split(":")[-1]),
            ) for id in ids
        ]
        reactor.callLater(0.1, reactor.stop)
        return results

    @dbus.service.method(in_signature='asas', out_signature='as', **sbn)
    def GetSubsearchResultSet(self, previous_results, new_terms):
        results = self._basic_search(new_terms)
        reactor.callLater(0.1, reactor.stop)
        return results

    def iconify(self, filetoken):
        filename = self._icon_cache.get(filetoken)

        # If its not in our in-memory cache, then we assume it is also not on
        # disk in the _icon_cache_dir.  Grab it, save it to the fs, and cache
        # the association.
        if not filename:
            url = self.icon_tmpl % filetoken
            filename = self._icon_cache_dir + filetoken + ".png"
            urllib.urlretrieve(url, filename)
            self._icon_cache[filetoken] = filename

        return filename

    def _initialize_icon_cache(self):
        if not os.path.isdir(self._icon_cache_dir):
            os.mkdir(self._icon_cache_dir)

        # Populate our in-memory cache from the file system
        for filename in os.listdir(self._icon_cache_dir):
            self._icon_cache[filename[:-4]] = self._icon_cache_dir + filename

    def _basic_search(self, terms):
        term = ''.join(terms)

        if not term in self._search_cache:
            response = pkgwat.api.search(term)
            rows = response.get('rows', [])
            rows = [row.get('name') + ":" + row.get('icon') for row in rows]
            self._search_cache[term] = rows

        return self._search_cache[term]


def main():
    service = SearchFedoraPackagesService()
    reactor.run()

if __name__ == '__main__':
    main()
