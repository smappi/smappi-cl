Smappi Common Library
----------------------

For install Smappi CL:

    npm install smappi-cl

Example of usage:

```
    const { jquery, request, DOM, logger: console } = require('smappi');

    function example (URL) {
        let $ = jquery(DOM(request.get(URL).content));
        $('div[class~="item"]').each(function () {
            console.log('ITEM', $(this));
        });
    }

    module.exports = { example }
```