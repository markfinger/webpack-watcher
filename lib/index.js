var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var MemoryFileSystem = require('memory-fs');
var async = require('async');
var mkdirp = require('mkdirp');

var WebpackWatcher = function WebpackWatcher(compiler, opts) {
  this.opts = _.defaults(opts || {}, this.defaultOptions);

  // Callback stores
  this._onDone = []; // function(stats) {}
  this._onceDone = []; // function(err, stats) {}
  this._onInvalid = []; // function() {}
  this._onFailed = []; // function(err) {}

  // State and compilation output
  this.isWatching = false;
  this.watcher = null;
  this.isRunning = false;
  this.isReady = false;
  this.err = null;
  this.stats = null;

  // Hook in to the compiler
  this.compiler = compiler;
  this.compiler.plugin('done', this.handleDone.bind(this));
  this.compiler.plugin('invalid', this.handleInvalid.bind(this));
  this.compiler.plugin('failed', this.handleFailure.bind(this));
  this.fs = fs;
  if (this.opts.useMemoryFS) {
    this.fs = new MemoryFileSystem();
    this.compiler.outputFileSystem = this.fs;
  }
};

WebpackWatcher.prototype.defaultOptions = {
  watch: true,
  watchDelay: 200,
  useMemoryFS: true
};

WebpackWatcher.prototype.watch = function watch() {
  this.isWatching = true;
  this.watcher = this.compiler.watch(
    this.opts.watchDelay,
    function() {/* no-op */}
  );
};

WebpackWatcher.prototype.run = function run() {
  this.compiler.run(function() {/* no-op */});
  this.isRunning = true;
};

WebpackWatcher.prototype.onDone = function onDone(cb) {
  this._onDone.push(cb);
};

WebpackWatcher.prototype.onceDone = function onceDone(cb) {
  if (this.isReady && (this.err || this.stats)) {
    return cb(this.err, this.stats);
  }

  this._onceDone.push(cb);

  if (this.opts.watch && !this.isWatching) {
    this.watch();
  }

  if (!this.opts.watch && !this.isRunning) {
    this.run();
  }
};

WebpackWatcher.prototype.onInvalid = function onInvalid(cb) {
  this._onInvalid.push(cb);
};

WebpackWatcher.prototype.onFailed = function onFailed(cb) {
  this._onFailed.push(cb);
};

WebpackWatcher.prototype.invalidate = function invalidate() {
  this.compiler.applyPlugins('invalid');
};

WebpackWatcher.prototype.close = function close(cb) {
  cb = cb || function() {};
  if (this.watcher) {
    this.isWatching = false;
    this.watcher.close(cb);
  }
};

WebpackWatcher.prototype.handleDone = function handleDone(stats) {
  this.isRunning = false;
  this.isReady = true;
  this.err = null;
  this.stats = null;

  // Defer in case the bundle has been invalidated
  // during the compilation process
  process.nextTick(function() {
    if (!this.isReady) return;

    if (stats.hasErrors()) {
      this.err = _.first(stats.compilation.errors);
    }
    this.stats = stats;

    this._onDone.forEach(function(cb) {
      cb(this.err, this.stats);
    }, this);

    var _onceDone = this._onceDone;
    this._onceDone = [];
    _onceDone.forEach(function(cb) {
      cb(this.err, this.stats);
    }, this);

    if (this.err) {
      this._onFailed.forEach(function(cb) {
        cb(this.err);
      }, this);

      this.isReady = false;
    }
  }.bind(this));
};

WebpackWatcher.prototype.handleInvalid = function handleInvalid() {
  this.isRunning = false;
  this.isReady = false;
  this.err = null;
  this.stats = null;

  this._onInvalid.forEach(function(cb) {
    cb();
  });
};

WebpackWatcher.prototype.handleFailure = function handleFailure(err) {
  this.isRunning = false;
  this.err = err;
  this.stats = null;

  this._onFailed.forEach(function(cb) {
    cb(this.err);
  }, this);
};

WebpackWatcher.prototype.writeAssets = function(cb) {
  if (this.err) return cb(this.err);
  if (!this.stats) return cb(new Error('Compilation has not completed successfully'));

  var filenames = _.pluck(_.values(this.stats.compilation.assets), 'existsAt');

  async.each(filenames, function(filename, cb) {
    this.fs.readFile(filename, function(err, data) {
      if (err) return cb(err);
      mkdirp(path.dirname(filename), function(err) {
        if (err) return cb(err);
        fs.writeFile(filename, data, cb);
      });
    });
  }.bind(this), function(err) {
    if (err) return cb(err);
    cb(null, filenames)
  });
};

module.exports = WebpackWatcher;