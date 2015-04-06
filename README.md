# webpack-watcher

A wrapper around webpack compilers which:
- improves performance by writing to an in-memory filesystem
- watches the files and continually recompiles the bundles in the background
- provides a callback interface to detect when a bundle:
  - has completed the compilation process
  - has been invalidated by the watcher
  - has produced errors during the compilation process

## Basic usage

```javascript
var fs = require('fs');
var webpack = require('webpack');
var WebpackWatcher = require('webpack-watcher');
var config = require('./path/to/your/webpack.config');

var compiler = webpack(config);

var watcher = new WebpackWatcher(compiler);

watcher.onDone(function(stats) {
  // Called every time the compilation process has completed
  // ...
});

watcher.onceDone(function(err, stats) {
  // If the compilation process has completed, this will be called immediately,
  // otherwise it will be called when the process next completes.
  if (err) throw err;

  // Read the bundle from memory and write it to disk
  watcher.fs.readFile('/path/to/file.js', function(err, data) {
    fs.writeFile('/path/to/file.js', data, function(err) {
      // ...
    });
  });
});

watcher.onInvalid(function() {
  // Called whenever the compiler's watcher determines that the bundle
  // needs to be recompiled
  // ...
});

watcher.onFailed(function(err) {
  // Called whenever the compiler encounters any errors
  // ...
});

// Invalidate the compiler's watcher
watcher.invalidateWatcher();

// Close the compiler's watcher
watcher.closeWatcher();
```

This codebase is heavily indebted to [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware).
