var fs = require('fs');
var MemoryFileSystem = require('memory-fs');
var _ = require('lodash');

var WebpackWatcher = function WebpackWatcher(compiler, opts) {
	this.opts = _.defaults(opts || {}, this.defaultOptions);

  // Callback stores
  this._whenReady = []; // function(err, stats) {}
  this._onDone = []; // function(stats) {}
  this._onInvalid = []; // function() {}
  this._onFailure = []; // function(err) {}

  // State and compilation output
  this.hasStarted = false;
  this.isReady = false;
  this.err = null;
  this.stats = null;

  // Hook in to the compiler
  this.compiler = compiler;
  this.compiler.plugin('done', this.handleBundleDone.bind(this));
  this.compiler.plugin('invalid', this.handleBundleInvalidation.bind(this));
  this.compiler.plugin('failed', this.handleBundleFailure.bind(this));
  this.fs = fs;
  if (this.opts.useMemoryFS) {
    this.fs = new MemoryFileSystem();
    this.compiler.outputFileSystem = this.fs;
  }
  this.watcher = null;
};

WebpackWatcher.prototype.defaultOptions = {
	watchDelay: 200,
  useMemoryFS: true
};

WebpackWatcher.prototype.start = function start() {
  if (!this.hasStarted) {
    this.hasStarted = true;
    this.watcher = this.compiler.watch(
      this.opts.watchDelay,
      function(){/* no-op */}
    );
  }
};

WebpackWatcher.prototype.whenReady = function whenReady(cb) {
  if (!this.hasStarted) {
    this.start();
  }
  if (this.isReady && this.stats) {
    return cb(this.err, this.stats);
  }
  this._whenReady.push(cb);
};

WebpackWatcher.prototype.onDone = function onDone(cb) {
  this._onDone.push(cb);
};

WebpackWatcher.prototype.onInvalid = function onInvalid(cb) {
  this._onInvalid.push(cb);
};

WebpackWatcher.prototype.onFailure = function onFailure(cb) {
  this._onFailure.push(cb);
};

WebpackWatcher.prototype.invalidateWatcher = function invalidateWatcher() {
  this.handleBundleInvalidation();
  this.watcher.invalidate();
};

WebpackWatcher.prototype.closeWatcher = function closeWatcher(callback) {
  this.watcher.close(callback || function() {});
};

WebpackWatcher.prototype.handleBundleDone = function handleBundleDone(stats) {
  this.isReady = true;
  this.err = null;
  this.stats = null;

	// Defer in case the bundle has been invalidated
	// during the compilation process
	process.nextTick(function() {
		if (!this.isReady) return;

    this.err = null;
    this.stats = stats;

    if (!stats.hasErrors()) {
      this._onDone.forEach(function(cb) {
        cb(stats);
      });
    } else {
      this.isReady = false;
      this.err = stats.compilation.errors[0];
      this.handleBundleFailure();
    }

    var _whenReady = this._whenReady;
    this._whenReady = [];
    _whenReady.forEach(function(cb) {
      cb(this.err, this.stats);
    }, this);
	}.bind(this));
};

WebpackWatcher.prototype.handleBundleInvalidation = function handleBundleInvalidation() {
  this.isReady = false;
  this.err = null;
  this.stats = null;
  this._onInvalid.forEach(function(cb) {
    cb();
  });
};

WebpackWatcher.prototype.handleBundleFailure = function handleBundleFailure(err) {
  if (err) {
    this.err = err;
  }
  this.stats = null;

  this._onFailure.forEach(function(cb) {
    cb(this.err);
  }, this);
};

module.exports = WebpackWatcher;