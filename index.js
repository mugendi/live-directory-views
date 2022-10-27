/**
 * Copyright (c) 2022 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const path = require('path');
const fs = require('fs');
const LiveDirectory = require('live-directory');
const util = require('util');
const cons = require('consolidate');
const pMemoize = require('p-memoize');

function is_object(value) {
	if (!value) return false;
	return value.toString() === '[object Object]';
}

function middleware(opts = {}) {
	if (!is_object(opts)) {
		throw new Error('Options passed to middleware must be an object');
	}

	opts = Object.assign(
		{
			engine: 'pug',
			dir: 'views',
			ttl: 1000 * 3600,
			cacheDir: path.resolve(module.parent.path, '.cache'),
		},
		opts
	);

	// ensure cache dir
	if(
		// has cacheDir
		opts.cacheDir &&
		// parent directory exists
		fs.existsSync(path.dirname(opts.cacheDir)) &&
		// cache dir is missing
		!fs.existsSync(opts.cacheDir)
	){
		fs.mkdirSync(opts.cacheDir)
	}

	console.log(opts.cacheDir);

	// make view path
	// console.log(module.parent.path);

	const viewsDir = path.isAbsolute(opts.dir)
		? opts.dir
		: path.resolve(module.parent.path, opts.dir);

	// ensure directory exists
	if (!fs.existsSync(viewsDir))
		throw new Error(`The views directory ${opts.dir} does not exist!`);

	// determine engine function
	if (!cons[opts.engine]) {
		throw new Error(
			`The engine ${opts.engine} is not supported. See https://github.com/tj/consolidate.js#supported-template-engines`
		);
	}

	const templateEngine = cons[opts.engine];

	// setup the other important methods

	function template_render(file, data = {}) {
		return templateEngine(file.path, data).catch((error) => {
			throw error;
		});
	}

	// console.log(process.env.NODE_ENV=='development');
	// don't memoize on development
	const memoizedTemplateRender =
		process.env.NODE_ENV == 'development'
			? template_render
			: pMemoize(template_render, {
					maxAge: opts.ttl,
					cacheKey: (args) => {
						// make key using the file content and data passed
						// This way we memoize the file for as long as:
						// 1. the contents stay the same
						// 2. the data used to render it stays the same
						let key =
							args[0].content + ' > ' + util.inspect(args[1]);
						// console.log({key});
						return key;
					},
			  });

	// Create LiveDirectory instance
	const liveTemplates = new LiveDirectory({
		path: viewsDir,
	});

	// Handle 'reload' event from LiveDirectory so we can add the renderFile function
	liveTemplates.on('file_reload', (file) => {
		// bind the memoized render function to ensure we only
		file.renderFile = memoizedTemplateRender.bind(null, file);
	});

	return (request, response, next) => {
		// add the render function to response
		// this is the function we use within our routes
		response.render = async function (filePath, data = {}) {
			// ensure leading slash
			if (/^\//.test(filePath) === false) {
				filePath = '/' + filePath;
			}

			if (!is_object(data)) {
				throw new Error('Arg #2 passed to render() must be an object');
			}

			// wait for templates to be ready
			liveTemplates
				.ready()
				.then((resp) => {
					// console.log(resp);

					// try and get file
					const template = liveTemplates.get(filePath);

					if (template) {
						// merge data with response.locals
						data = Object.assign(response.locals || {}, data);

						// render or throw any errors
						template
							.renderFile(data)
							// post content out
							.then((html) => {
								response.status(200).html(html).end();
							})
							// throw all errors
							.catch((error) => {
								throw error;
							});
					} else {
						throw new Error(
							`Template ${filePath} does not exist in ${viewsDir}`
						);
					}
				})
				.catch(console.error);
		};

		next();
	};
}

module.exports = middleware;
