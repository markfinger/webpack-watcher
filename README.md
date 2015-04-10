webpack-watcher
===============

[![Build Status](https://travis-ci.org/markfinger/webpack-watcher.svg?branch=master)](https://travis-ci.org/markfinger/webpack-watcher)


A wrapper around webpack compilers which:
- improves performance by writing assets to an in-memory filesystem
- provides a callback interface to detect when:
  - the compilation process has completed
  - a watcher has invalidated the compiled assets
  - the compilation process has failed and/or encountered errors

Basic usage
-----------

```javascript
var fs = require('fs');
var webpack = require('webpack');
var WebpackWatcher = require('webpack-watcher');
var config = require('./path/to/your/webpack.config');

var compiler = webpack(config);

var watcher = new WebpackWatcher(compiler);

watcher.onceDone(function(err, stats) {
  // If the compilation process has completed, this will be called immediately,
  // otherwise it will be called when the process next completes.
  if (err) throw err;

  watcher.writeAssets(function(err, filenames) {
    // Read the assets from memory and write them to the file system
    // ...
  });
});

watcher.onDone(function(err, stats) {
  // Called every time the compilation completes
  // ...
});

watcher.onInvalid(function() {
  // Called whenever the compiler's watcher determines that the bundle
  // needs to be recompiled
  // ...
});

watcher.onFailed(function(err) {
  // Called if the compiler failed or the compilation process produced errors
  // ...
});

// Start the compilation process
// Note: this is called automatically if you use `onceDone`
watcher.start();

// Trigger a rebuild of the bundle
watcher.invalidate();

// Close the compiler's watcher
watcher.close();
```


Configuration
-------------

```javascript
var watcher = new WebpackWatcher(webpack(config), {
  // The delay between a change being detected and the restart
  // of the bundle compilation process
  watchDelay: 200,
  // Reduces the overhead of background compilation by forcing
  // the compiler to write to an in-memory filesystem.
  useMemoryFS: true
});
```

This codebase is heavily indebted to [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware).
