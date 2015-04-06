# webpack-watcher

A wrapper around webpack compilers which:
- improves performance by writing to an in-memory filesystem
- watches the files and continually regenerates the bundles in the background
- provides a callback interface to detect when a bundle:
  - has been invalidated
  - has produced an error
  - has completed
  - is ready to write to disk

## Basic usage

```javascript
var fs = require('fs');
var webpack = require('webpack');
var WebpackWatcher = require('webpack-watcher');
var config = require('./path/to/your/webpack.config');

var compiler = webpack(config);

var watcher = new WebpackWatcher(compiler);

watcher.onInvalid(function() {
  // Called whenever the watcher determines that the bundle
  // needs to be regenerated
});

watcher.onDone(function(stats) {
  // Called every time the compilation process has completed
});

watcher.onFailed(function(err) {
  // Called whenever the compiler encounters any errors
});

watcher.whenReady(function(err, stats) {
  // Called when the bundle has completed. Note: whenReady callbacks will
  // only ever be called once
  if (err) throw err;

  // Read the bundle from memory and write it to disk
  watcher.fs.readFile('/path/to/file.js', function(err, data) {
    fs.writeFile('/path/to/file.js', data, function(err) {
      // ...
    });
  });
});

// Invalidate the compiler's watcher
watcher.invalidateWatcher()

// Close the compiler's watcher
watcher.closeWatcher()
```

This codebase is pretty heavily indebted to [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware).
