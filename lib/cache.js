// Copyright 2022 Anthony Mugendi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const LRU = require('lru-cache');
const _ = require('lodash');


function setup_cache(opts) {
	const defaults = {
		max: 50000,

		// how long to live in ms
		ttl: 1000 * 60 * 5,

		// return stale items before removing from cache?
		allowStale: false,

		updateAgeOnGet: false,
		updateAgeOnHas: false,
	};

	let cache = new LRU(Object.assign(defaults, opts));

	// monkey patch get to avoid changing cloned data
	cache._get = cache.get;
	cache.get = (key) => {
		return _.cloneDeep(cache._get(key));
	};

	cache.wrap = async function (key, fn, opts = {}) {
		let resp = cache.get(key);

		if (!resp) {
			try {
				// run data function
				resp = await fn();
				// only cache if there are results
				if (resp) {
					cache.set(key, resp, opts);
				}
			} catch (error) {
				throw error
			}
		}
		// deep clone data to prevent cache from ever changing
		return _.cloneDeep(resp);
	};

	return cache;
}

// setup_cache()
// 	.wrap('test', function () {
//         console.log('ssss');
//         return 'ssss'
//     })
// 	.then((resp) => {
// 		console.log({resp});
// 	})
// 	.catch(console.error);

module.exports = (opts = {}) => setup_cache(opts);
