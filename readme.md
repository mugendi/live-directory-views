<!--
 Copyright (c) 2022 Anthony Mugendi

 This software is released under the MIT License.
 https://opensource.org/licenses/MIT
-->

# live-directory-views

Before diving in, you should read about [LiveDirectory](https://github.com/kartikk221/live-directory) by [Kartik](https://github.com/kartikk221) to see why you really want to use it!

This module acts as a middleware to help render all your templates. To do so:

-   [live-directory](https://www.npmjs.com/package/live-directory) watches the views directory for any file changes.
-   [p-memoize](https://www.npmjs.com/package/p-memoize) is used to memoize rendering for 1 hour by default (see ttl option below) unless the template changes and/or the data used to render it changes.
	
	Note: No memoization is done when `NODE_ENV=='development`, because, why would we? 
 
-   [consolidate](https://www.npmjs.com/package/consolidate) helps with the multi-engine rendering.

Well tested with [hyper-express](https://www.npmjs.com/package/hyper-express) but should in theory work with [express](https://www.npmjs.com/package/express) too. Let me know if it doesn't.

## How to use

```javascript
const HyperExpress = require('hyper-express');
const webserver = new HyperExpress.Server();
const liveDirectoryViews = require('live-directory-views');

// options you can add to your views middleware
// example below includes all the default values
let viewOptions = {
    // your rendering engine. See https://github.com/tj/consolidate.js#supported-template-engines
	engine: 'pug',
    // the directory where your template files are 
	dir: 'views',
    // how long should we cache template renders where the template or data hasn't changed
	ttl: 1000 * 3600,
};

// set it before any routes
webserver.use(liveDirectoryViews(viewOptions));

// Render the template using .render() method
webserver.get('/', (request, response) => {

    // this method is added the the middleware
    // so dont go looking for it from hyper-express
	response.render('user.pug', {name:"Anthony Mugendi"})

});

// Activate webserver by calling .listen(port, callback);
webserver
	.listen(80)
	.then((socket) => console.log('Webserver started on port 80'))
	.catch((error) => console.log('Failed to start webserver on port 80'));
```
