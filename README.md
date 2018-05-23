Smappi Common Library
----------------------

Installation of Smappi CL:

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
