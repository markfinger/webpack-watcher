webpack-watcher
===============

[![Build Status](https://travis-ci.org/markfinger/webpack-watcher.svg?branch=master)](https://travis-ci.org/markfinger/webpack-watcher)

A wrapper around webpack compilers which:
- improves performance by writing assets to an in-memory filesystem
- provides a callback interface to detect when:
  - the compilation process has completed
  - the compiled assets have been invalidated by a plugin (for example: webpack's file watcher)
  - the compilation process has failed and/or encountered errors


Basic usage
-----------

```javascript
var webpack = require('webpack');
var WebpackWatcher = require('webpack-watcher');
var config = require('./path/to/your/webpack.config');

var compiler = webpack(config);

var watcher = new WebpackWatcher(compiler);

watcher.onceDone(function(err, stats) {
  // Called once the current compilation process has completed. If the
  // process has already completed, the function will be called immediately.
  // If a compilation process is already underway, concurrent calls to
  // `onceDone` will stack up until the process completes.
});

watcher.writeAssets(function(err, filenames) {
  // Read the assets from memory and write them to the file system
});

watcher.onDone(function(err, stats) {
  // Called every time the compilation completes
});

watcher.onInvalid(function() {
  // Called whenever the compiler's watcher determines that the bundle
  // needs to be recompiled
});

watcher.onFailed(function(err) {
  // Called if the compilation process failed or produced errors
});

// Run the compilation process once and start the watcher.
// Called automatically by `onceDone`, if `watch: true`
watcher.watch();

// Run the compilation process once.
// Called automatically by `onceDone`, if `watch: false`
watcher.run();

// Force the compiler to invalidate the assets.
watcher.invalidate();

// Close the compiler's watcher
watcher.close();
```


Configuration
-------------

```javascript
var watcher = new WebpackWatcher(webpack(config), {
  // Defaults
  // --------
  // Indicates that your source files should be watched for changes
  watch: true,
  // The delay between a change being detected and the restart
  // of the compilation process
  watchDelay: 200,
  // Reduces the overhead of background compilation by forcing
  // the compiler to write to an in-memory filesystem.
  useMemoryFS: true
});
```

This codebase is heavily indebted to [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware).
