const dnsSync = require('dns-sync');

function Proxy () {
    this.dnsCache = {
        // host: ipaddr
    }
    this.proxies = {
        // <key>: {protocol: 'socks', host: 'localhost', ipaddr: '127.0.0.1', port: 12345, cnt: 0, skip: true}
        // <key>: {protocol: 'http', host: '127.0.0.1', ipaddr: '127.0.0.1', port: 8080, cnt: 42, skip: false}
    };
    this.currentKey = null;

    /**
     * Is the proxy currently used?
     *
     * @return Boolean
     */
    this.isActive = function () {
        return this.current({}).host ? true : false;
    }

    /**
     * Skip current proxy
     *
     * @return Boolean
     */
    this.skip = function () {
        this.current({}).skip = true; // Remove from list broken proxy
        return true;
    }

    /**
     * Return Current Proxy {protocol, host, port}
     *
     * @return Object
     */
    this.current = function (defaultValue) {
        return this.proxies[this.currentKey] || defaultValue;
    }

    /**
     * Build Href for current proxy
     *
     * @return String - Proxy Href
     */
    this.currentHref = function () {
        let proxy = this.current();
        if (proxy) {
            return `${proxy.protocol}://${proxy.ipaddr}:${proxy.port}`;
        }
        return undefined;
    }

    /**
     * Generate hash by proxy object
     *
     * @return String - HashKey
     */
    this.genKey = function (proxy) {
        return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    }

    /**
     * Change proxy
     *
     * @return Object - Current Proxy
     */
    this.next = function (options) {
        options = options || {};
        options.protocol = options.protocol || 'socks';  // default socks, because http is mirror for socks
        var fetchNewProxies = true;
        for (var key in this.proxies) {
            if (this.proxies.hasOwnProperty(key) && !this.proxies[key].skip) {
                // If at least one proxy is not marked as "skip", then you should not receive new proxies from the server
                fetchNewProxies = false;
                break;
            }
        }
        if (fetchNewProxies) { // if proxies is all skipped
            // Fetch list of proxies
            let proxies = require('./request')
                .get('https://proxy.smappi.org/list', {}, {proxy: false})
                .json();
            proxies.forEach(item => {
                var key = this.genKey(item);
                if (!this.proxies[key]) { // if proxy not exist in self.proxies, then add it
                    item.cnt = 0;
                    // determine ipaddr by hostname
                    // most proxy libraries (proxy-agent as example) do not understand domain names, they need an IP address
                    item.ipaddr = this.dnsCache[item.host];
                    if (!item.ipaddr) {
                        item.ipaddr = dnsSync.resolve(item.host);
                        this.dnsCache[item.host] = item.ipaddr;
                    }
                    this.proxies[key] = item;
                }
            });
        }
        let lastSuitableKey, current = this.current({});
        for (var key in this.proxies) {
            if (!this.proxies.hasOwnProperty(key)) continue; // is not property, skip obj
            else if (options.protocol && this.proxies[key].protocol !== options.protocol) continue;
            lastSuitableKey = key;
            if (this.proxies[key].skip) continue; // skip it
            else if (this.proxies[key].cnt < current.cnt) break; // use proxy with a smaller counter of using
            else if (key === this.currentKey) continue; // current object, skip it
            else if (Object.keys(current).length == 0) break;  // INIT current
            else continue;
        }
        this.currentKey = lastSuitableKey; // new current proxy
        this.current({}).cnt += 1; // increment count of using
        console.log(`Use next proxy "${this.currentHref()}"`)
        return this.current();
    }
    return this;
}

module.exports = Proxy();
