Smappi Common Library
----------------------

[![travis](https://secure.travis-ci.org/smappi/smappi.png)](http://travis-ci.org/smappi/smappi)


Installation of [Smappi](https://smappi.org/) CL:

```bash
npm install smappi-cl
```

Example of usage:

```javascript
const { jquery, request, DOM, logger: console } = require('smappi-cl');

function example (URL) {
    let $ = jquery(DOM(request.get(URL).content));
    $('div[class~="item"]').each(function () {
        console.log('ITEM', $(this));
    });
}

module.exports = { example }
```

More [examples](https://smappi.org/marketplace/)
