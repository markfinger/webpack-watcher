# webpack-watcher

A wrapper around webpack compilers which:
- improves the bundling speed by performing all operations in memory
- watches the files and continually regenerates the bundles in the background
- provides a callback interface to detect when a bundle has been invalidated or completed
- provides a callback interface to request generated bundles

webpack-watcher was built to improve webpack's performance during development by
enabling an easy API for caching generated bundles.

## Basic usage

```javascript
var fs = require('fs');
var webpack = require('webpack');
var WebpackWatcher = require('webpack-watcher');
var config = require('./path/to/your/webpack.config');

var compiler = webpack(config, function(err) {
	if (err) {
		console.error(err);
	}
})

var webpackWatcher = new WebpackWatcher(compiler, {
	onInvalid: function() {
		// Called whenever the watcher determines that the bundle
		// needs to be regenerated
	},
	onDone: function(stats) {
		// Called every time the bundle has been generated
	},
	onError: function(err) {
		// Called whenever the watcher encounters any errors
	}
});

// Callbacks provided to onReady will be called immediately, if the bundle
// has already been generated, or as soon as webpack has completed.
// Unlike onDone and onInvalid, onReady callbacks will only be called once
webpackWatcher.onReady(function(stats) {
	// Read the bundle from memory by specifying an output path
	// which matches those in your config
	var content = watcher.readFileSync('/path/to/file.js');
	// Write the bundle to disk
	fs.writeFileSync('/path/to/file.js', content);
});
```

Be aware that a `WebpackWatcher` will immediately invoke the compiler so that
the bundle is ready as soon as possible.

If you want to easily maintain a bundle cache, you can use `onInvalid` and `onDone`
callbacks to invalidate/populate your cache.

If you only want to populate the cache on demand, use `onInvalid` + `onDone` to
invalidate it and use `onReady` for populating it.

You can invalidate the compiler's watcher with `webpackWatcher.invalidateWatcher()`.

You can close the compiler's watcher with `webpackWatcher.closeWatcher()`.

This codebase is pretty heavily indebted to
[webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware).
