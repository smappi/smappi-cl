var _PROXIES = [
    // {protocol: 'socks', host: '127.0.0.1', port: 12345, cnt: 0, skip: true}
];
var _PROXIDX;

/**
 * Is the proxy currently used?
 *
 * @return Boolean
 */
function isActive () {
    return this.current().protocol ? true : false;
}

/**
 * Return Current Proxy {protocol, host, port}
 *
 * @return Object
 */
function current () {
    return _PROXIES[_PROXIDX] || {};
}

/**
 * Build Href for Agent.proxy
 *
 * @return String - Proxy Href
 */
function currentHref () {
    let href, cp = current();
    if (cp.protocol)
        href = `${cp.protocol}://${cp.host}:${cp.port}`;
    return href;
}

/**
 * Change proxy
 *
 * @return Object - Current Proxy
 */
function next (options) {
    if (options && options.skipCurrent && _PROXIES[_PROXIDX]) {
        // Remove from list broken proxy
        // _PROXIES.splice(_PROXIDX, 1);
        _PROXIES[_PROXIDX].skip = true;
    }
    if (_PROXIES.filter(p => !p.skip).length == 0) {
        // Fetch list of proxies
        let proxies = require('./request')
            .get('https://proxy.smappi.org/list', {}, {proxy: false})
            .json();
        proxies.forEach(item => {
            if (_PROXIES.filter(p => p.host == item.host).length == 0) { // if proxy not exist in _PROXIES, then add it
                item.cnt = 0;
                _PROXIES.push(item);
            }
        });
        // console.log('FETCHED PROXIES', _PROXIES)
    }
    _PROXIES.sort((a, b) => a.cnt - b.cnt); // sort by count of using
    let idx = 0;
    for (; idx < _PROXIES.length; idx++) {
        if (idx == _PROXIDX || _PROXIES[idx].skip) continue;
        break; // get next proxy
    }
    _PROXIDX = idx; // new proxy idx
    if (_PROXIES[_PROXIDX]) {
        _PROXIES[_PROXIDX].cnt += 1; // increment count of using
    }
    // console.log('CURRENT PROXIES', _PROXIES, _PROXIDX)
    console.log(`Use next proxy "${this.currentHref()}"`)
    return _PROXIES[_PROXIDX];
}

module.exports = { next, current, currentHref, isActive }
