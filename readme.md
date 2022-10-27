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
	// cache directory for templates
	// also useful for css minification
	// Read ->
	cacheDir: path.resolve(module.parent.path, '.cache'),
};

// set it before any routes
webserver.use(liveDirectoryViews(viewOptions));

// Render the template using .render() method
webserver.get('/', (request, response) => {
	// this method is added the the middleware
	// so dont go looking for it from hyper-express
	response.render('user.pug', { name: 'Anthony Mugendi' });
});

// Activate webserver by calling .listen(port, callback);
webserver
	.listen(80)
	.then((socket) => console.log('Webserver started on port 80'))
	.catch((error) => console.log('Failed to start webserver on port 80'));
```

# The magic of using [live-directory-static](https://www.npmjs.com/package/live-directory-static) & [live-directory-views](https://www.npmjs.com/package/live-directory-views)

These two modules were built to work together with [hyper-express](https://www.npmjs.com/package/hyper-express). Used together they are able to achieve something magical in optimizing your site! As if HyperExpress wasnt fast enough already! :)

1. **Cacheing** : the two modules extensively use [p-memoize](https://www.npmjs.com/package/p-memoize) to cache any long-ish operations.
2. **css super minification** : Css minification has two inportant steps:

    - Removing all unused css. This is a huge problem for many
    - Minifying the final css file

    As you might expect, minifying is the simpler task. Removing unwanted css is much more difficult! That is because you have to account for all the pages that the css file is included or else some pages will not display properly.

    By using [live-directory-static](https://www.npmjs.com/package/live-directory-static) & [live-directory-views](https://www.npmjs.com/package/live-directory-views) together and setting them to use the same `cacheDir`, you let theme achieve some magic. Here is how it works.

    - live-directory-views generates the views and keeps them updated via live-directory.
    - But it also writes and updates actual cache files corresponding to each page rendered.
    - When the page then loads it's static resources live-directory-static kicks in and starts rendering static files off live-directory.
    - For each css file, it checks all the views that request that css file and then using [purgecss](https://www.npmjs.com/package/purgecss) removes all css that won't be used by any of the views/pages. That process is memoized cleverly so that should either the css file or the view files change, then it will be regenerated.
    - This css is then minified.
    - What is truly magical about this is that you can build your site without fearing or caring about css ballooning in size. Any newly used css selectors will be added to the css generated and that process memoized till the next change.

Using this method, I reduced some generic template file from 500kb to serving only 42kb of css!

## Activating this magic!

Simply use both middleware and let them share a cache directory.

```javascript
const HyperExpress = require('hyper-express');
const webserver = new HyperExpress.Server();
const path = require('path');
const os = require('os');

const liveDirectoryViews = require('live-directory-views');
const liveDirectoryStatic = require('live-directory-static');

// let us cache somewhere off the app folder
// if not set, default cacheDir is path.resolve(module.parent.path, '.cache')
// if directory is missing, an attempt to create one is made
const templateCacheDir = path.join(os.homedir(),  'templates-cache');


let staticOptions = {
	//...other options
	cacheDir: templateCacheDir,
};

//static files middleware
webserver.use(liveDirectoryStatic(['path/to/dir1', 'path/to/dir2'], staticOptions));

//
let viewOptions = {
	//...other options
	cacheDir: templateCacheDir,
};

// views middleware
webserver.use(liveDirectoryViews(viewOptions));


// Render the template using .render() method
webserver.get('/', (request, response) => {
	// this method is added the the middleware
	// so dont go looking for it from hyper-express
	response.render('user.pug', { name: 'Anthony Mugendi' });
});

// Activate webserver by calling .listen(port, callback);
webserver
	.listen(80)
	.then((socket) => console.log('Webserver started on port 80'))
	.catch((error) => console.log('Failed to start webserver on port 80'));
```
