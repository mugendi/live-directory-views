/**
 * Copyright (c) 2022 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const path = require('path'),
	fs = require('fs-extra'),
	LiveDirectory = require('live-directory'),
	cons = require('consolidate'),
	minify = require('html-minifier').minify,
	{ md5 } = require('./lib/utils'),
	{ wrap } = require('./lib/cache')(),
	_ = require('lodash');

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
	if (
		// has cacheDir
		opts.cacheDir &&
		// cache dir is missing
		!fs.existsSync(opts.cacheDir)
	) {
		fs.ensureDirSync(opts.cacheDir);
	}

	// console.log(opts.cacheDir);

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

	async function template_render(file, data = {}) {
		let html,
			env = process.env.NODE_ENV;
		// optimize html
		try {
			// add cache param for cache-ing by engines that support it
			data = Object.assign({ cache: true }, data);

			let cacheKey = md5({
				env,
				data,
				path:file.path,
				modified: fs.statSync(file.path).mtimeMs,
				devHash: env == 'development' ? Date.now() : '0'
			});

			// console.log(cacheKey);

			html = await wrap(cacheKey, async function () {
				try {
					console.log("rendering", file.path, data);
					// render view given data
					html = await templateEngine(file.path, data).catch(
						(error) => {
							throw error;
						}
					);

					// minify html output for non dev modes
					if (env !== 'development') {
						let minifyOpts = {
							collapseWhitespace: true,
							conservativeCollapse: true,
							continueOnParseError: false,
							keepClosingSlash: true,
							removeComments: true,
							removeScriptTypeAttributes: true,
							sortAttributes: true,
							sortClassName: true,
						};

						html = minify(html, minifyOpts);
					}

					return html;
				} catch (error) {
					throw error;
				}
			});
		} catch (error) {
			console.error(error);
		}

		return html;
	}

	// Create LiveDirectory instance
	const liveTemplates = new LiveDirectory({
		path: viewsDir,
	});

	// Handle 'reload' event from LiveDirectory so we can add the renderFile function
	liveTemplates.on('file_reload', (file) => {
		// bind the memoized render function to ensure we only
		file.renderFile = file.renderFile || template_render.bind(null, file);
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

								return html;
							})
							.then((content) => {
								// if we have been asked to write cache dir
								if (fs.existsSync(opts.cacheDir)) {
									let fileName = referer_to_filename(request);

									let filePath = path.join(
										opts.cacheDir,
										fileName
									);

									let lastTemplateCache = fs.existsSync(
										filePath
									)
										? fs.statSync(filePath).mtimeMs
										: 0;

									// if template has been updated recently...
									if (
										template.last_update > lastTemplateCache
									) {
										fs.writeFileSync(filePath, content);
									}
								}
								// console.log(resp);
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

function referer_to_filename(request) {
	return _.snakeCase(request.hostname + ' ' + request.path);
}

module.exports = middleware;
