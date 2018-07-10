var _CURRENT = {};

/**
 * Return Current Proxy {protocol, host, port}
 *
 * @return Object
 */
function current () {
    return _CURRENT;
}

/**
 * Build Href
 *
 * @return String
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
 * @return Boolean
 */
function next () {
    // todo: implement change proxy
    // _CURRENT = {protocol: 'socks', host: '127.0.0.1', port: 12345}
    return true;
}

module.exports = { next, current, currentHref }
