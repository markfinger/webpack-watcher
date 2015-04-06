var fs = require('fs');
var path = require('path');
var assert = require('chai').assert;
var _ = require('lodash');
var mkdirp = require('mkdirp');
var webpack = require('webpack');
var spawnSync = require('spawn-sync'); // Node 0.10.x support
var WebpackWatcher = require('..');

var TEST_OUTPUT_DIR = path.join(__dirname, 'test_output');

// Ensure we have a clean slate before and after each test
beforeEach(function() {
  spawnSync('rm', ['-rf', TEST_OUTPUT_DIR]);
});
afterEach(function() {
  spawnSync('rm', ['-rf', TEST_OUTPUT_DIR]);
});

describe('WebpackWatcher', function() {
  it('is a function', function() {
    assert.isFunction(WebpackWatcher);
  });
  it('can accept compiler and option arguments', function() {
    var compiler = webpack({});
    var opts = {};
    var watcher = new WebpackWatcher(compiler, opts);
    assert.strictEqual(watcher.compiler, compiler);
    assert.strictEqual(watcher.opts, opts);
  });
  it('can provide onFailure hooks', function(done) {
    var config = {
      context: '/path/does/not/exist/',
      entry: './some_file.js',
      output: {
        path: '/another/path/that/does/not/exist',
        filename: 'some_file.js'
      }
    };
    var watcher = new WebpackWatcher(webpack(config));

    watcher.onFailure(function(err) {
      assert.instanceOf(err, Error);
      assert.include(err.stack, './some_file.js');
      assert.include(err.stack, '/path/does/not/exist/');
      done();
    });

    watcher.start();
  });
  it('can provide onInvalid and onDone hooks', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'hook_test', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'hook_test', 'output.js');
    var config = {
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      }
    };
    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__HOOK_TEST_ONE__";');

    var watcher = new WebpackWatcher(webpack(config));

    var onInvalidCalls = 0;
    watcher.onInvalid(function() {
      onInvalidCalls++;
    });

    var onDoneCalls = 0;
    watcher.onDone(function() {
      onDoneCalls++;
    });

    assert.equal(onInvalidCalls, 0);
    assert.equal(onDoneCalls, 0);

    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(onInvalidCalls, 0);
      assert.equal(onDoneCalls, 1);
      var onInvalidCalled = false;
      var onDoneCalled = false;
      watcher.onInvalid(_.once(function() {
        assert.equal(onInvalidCalls, 1);
        assert.equal(onDoneCalls, 1);
        onInvalidCalled = true;
        onDoneCalled && onInvalidCalled && done();
      }));
      watcher.onDone(_.once(function() {
        assert.equal(onInvalidCalls, 1);
        assert.equal(onDoneCalls, 2);
        onDoneCalled = true;
        onDoneCalled && onInvalidCalled && done();
      }));
      fs.writeFileSync(entry, 'module.exports = "__HOOK_TEST_TWO__";');
    });
  });
  it('can block until a bundle is generated', function(done) {
    var compiler = webpack(require('./basic_bundle/webpack.config'));
    var watcher = new WebpackWatcher(compiler);
    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      var outputPath = path.join(TEST_OUTPUT_DIR, 'basic_bundle', 'output.js');
      assert.equal(stats.compilation.assets['output.js'].existsAt, outputPath);
      watcher.fs.readFile(outputPath, function(err, data) {
        assert.isNull(err);
        var content = data.toString();
        assert.include(content, '__BASIC_BUNDLE_ENTRY_TEST__');
        assert.include(content, '__BASIC_BUNDLE_REQUIRE_TEST__');
        done();
      });
    });
  });
  it('can block until an invalidated bundle has been rebuilt', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'invalidated_bundle', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'invalidated_bundle', 'output.js');
    var config = {
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      }
    };
    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__INVALIDATED_BUNDLE_ONE__";');
    var watcher = new WebpackWatcher(webpack(config), {
      useMemoryFS: false
    });
    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(stats.compilation.assets['output.js'].existsAt, output);
      watcher.fs.readFile(output, function(err, data) {
        assert.isNull(err);
        assert.include(data.toString(), '__INVALIDATED_BUNDLE_ONE__');
        watcher.onInvalid(_.once(function() {
          assert.isFalse(watcher.isReady);
          watcher.onceDone(function() {
            watcher.fs.readFile(output, function(err, data) {
              assert.isNull(err);
              assert.include(data.toString(), '__INVALIDATED_BUNDLE_TWO__');
              done();
            });
          });
        }));
        // Need to wait for the watcher to kick in
        setTimeout(function() {
          fs.writeFile(entry, 'module.exports = "__INVALIDATED_BUNDLE_TWO__";', function(err) {
            assert.isNull(err);
          });
        }, 200);
      });
    });
  });
  it('calls onceDone if an error occurs', function(done) {
    var config = {
      context: '/path/does/not/exist/',
      entry: './some_file.js',
      output: {
        path: '/another/path/that/does/not/exist',
        filename: 'some_file.js'
      }
    };
    var watcher = new WebpackWatcher(webpack(config));

    watcher.onceDone(function(err) {
      assert.instanceOf(err, Error);
      assert.include(err.stack, './some_file.js');
      assert.include(err.stack, '/path/does/not/exist/');
      done();
    });
  });
});