var MemoryFileSystem = require('memory-fs');
var _ = require('lodash');

var WebpackWatcher = function WebpackWatcher(compiler, options) {
	this.compiler = compiler;
	this.options = _.defaults(options, this.defaultOptions);
	this.isReady = false;
	this.onReadyCallbacks = [];
	this.fs = new MemoryFileSystem();
	this.compiler.outputFileSystem = this.fs;
	this.compiler.plugin('done', this.handleBundleDone.bind(this));
	this.compiler.plugin('invalid', this.handleBundleInvalidation.bind(this));
	this.compiler.plugin('compile', this.handleBundleInvalidation.bind(this));
	this.watcher = this.compiler.watch(this.options.watchDelay, this.handleBundleError.bind(this));
	this.stats = null;
	this.isInitialBuild = true;
};

WebpackWatcher.prototype.defaultOptions = {
	watchDelay: 200,
	onInvalid: null,  // function() { ... }
	onDone: null,  // function(stats) { ... }
	onError: null  // function(err) { ... }
};

WebpackWatcher.prototype.handleBundleError = function handleBundleError(err) {
	this.stats = null;
	if (err && this.options.onError) {
		this.options.onError(err);
	}
};

WebpackWatcher.prototype.handleBundleDone = function handleBundleDone(stats) {
	this.isReady = true;
	// Defer in case the bundle has been invalidated
	// during the compilation process
	process.nextTick(function() {
		if (!this.isReady) {
			return;
		}
		this.stats = stats;
		// When initially building bundles, webpack sends two `done` signals.
		// Sometimes the first is triggered too early to read the generated
		// files. So we defer until the second occurs.
		if (this.isInitialBuild) {
			this.isInitialBuild = false;
			return;
		}
		if (this.options.onDone) {
			this.options.onDone(stats);
		}
		var onReadyCallbacks = this.onReadyCallbacks;
		this.onReadyCallbacks = [];
		onReadyCallbacks.forEach(this.onReady, this);
	}.bind(this));
};

WebpackWatcher.prototype.handleBundleInvalidation = function handleBundleInvalidation() {
	this.isReady = false;
	this.stats = null;
	if (this.options.onInvalid) {
		this.options.onInvalid();
	}
};

WebpackWatcher.prototype.readFileSync = function readFileSync(filename) {
	return this.fs.readFileSync(filename);
};

WebpackWatcher.prototype.onReady = function onReady(callback) {
	if (this.isReady) {
		callback(this.stats);
	} else {
		this.onReadyCallbacks.push(callback);
	}
};

WebpackWatcher.prototype.invalidateWatcher = function invalidateWatcher() {
	this.handleBundleInvalidation();
	return this.watcher.invalidate();
};

WebpackWatcher.prototype.closeWatcher = function closeWatcher(callback) {
	callback = callback || function() {};
	return this.watcher.close(callback);
};

module.exports = WebpackWatcher;