var fs = require('fs');
var path = require('path');
var assert = require('chai').assert;
var _ = require('lodash');
var mkdirp = require('mkdirp');
var webpack = require('webpack');
var MemoryFileSystem = require('memory-fs');
var spawnSync = require('spawn-sync'); // Node 0.10.x support
var WebpackWatcher = require('..');

// Note: some of the tests will fail inconsistently, this seems to relate
// to issues with file watchers detecting changes. Run the tests a few
// times and see if it fixes the issue.


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
  it('can provide onFailed hooks', function(done) {
    var config = {
      context: '/path/does/not/exist/',
      entry: './some_file.js',
      output: {
        path: '/another/path/that/does/not/exist',
        filename: 'some_file.js'
      }
    };
    var watcher = new WebpackWatcher(webpack(config));

    watcher.onFailed(function(err) {
      assert.instanceOf(err, Error);
      assert.include(err.stack, './some_file.js');
      assert.include(err.stack, '/path/does/not/exist/');
      done();
    });

    watcher.onceDone(function(){});
  });
  it('respects the useMemoryFS option', function() {
    var watcher = new WebpackWatcher(webpack({}), {
      useMemoryFS: false
    });
    assert.strictEqual(watcher.fs, fs);

    watcher = new WebpackWatcher(webpack({}), {
      useMemoryFS: true
    });
    assert.instanceOf(watcher.fs, MemoryFileSystem);
    assert.instanceOf(watcher.compiler.outputFileSystem, MemoryFileSystem);
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
      var content = watcher.fs.readFileSync(outputPath);
      content = content.toString();
      assert.include(content, '__BASIC_BUNDLE_ENTRY_TEST__');
      assert.include(content, '__BASIC_BUNDLE_REQUIRE_TEST__');
      done();
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
      },
      cache: false
    };
    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__INVALIDATED_BUNDLE_ONE__";');
    var watcher = new WebpackWatcher(webpack(config));
    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(stats.compilation.assets['output.js'].existsAt, output);
      var content = watcher.fs.readFileSync(output);
      assert.include(content.toString(), '__INVALIDATED_BUNDLE_ONE__');
      watcher.onInvalid(_.once(function() {
        assert.isFalse(watcher.isReady);
        watcher.onceDone(function(err) {
          assert.isNull(err);
          content = watcher.fs.readFileSync(output);
          assert.include(content.toString(), '__INVALIDATED_BUNDLE_TWO__');
          done();
        });
      }));
      fs.writeFileSync(entry, 'module.exports = "__INVALIDATED_BUNDLE_TWO__";');
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
  it('continues to detect changes and rebuild the bundle', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'persistent_watch', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'persistent_watch', 'output.js');

    var compiler = webpack({
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      },
      cache: false
    });

    var watcher = new WebpackWatcher(compiler);

    mkdirp.sync(path.dirname(entry));

    fs.writeFileSync(entry, 'module.exports = "__WATCH_TEST_ONE__";');
    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(output, stats.compilation.assets['output.js'].existsAt);
      var contents = watcher.fs.readFileSync(output);
      var compiledBundle = contents.toString();
      assert.include(compiledBundle, '__WATCH_TEST_ONE__');
      fs.writeFileSync(entry, 'module.exports = "__WATCH_TEST_TWO__";');
      setTimeout(function() {
        watcher.onceDone(function(err, stats) {
          assert.isNull(err);
          assert.isObject(stats);
          assert.equal(output, stats.compilation.assets['output.js'].existsAt);
          contents = watcher.fs.readFileSync(output);
          assert.include(contents.toString(), '__WATCH_TEST_TWO__');
          fs.writeFileSync(entry, 'module.exports = "__WATCH_TEST_THREE__";');
          setTimeout(function() {
            watcher.onceDone(function(err, stats) {
              assert.isNull(err);
              assert.isObject(stats);
              assert.equal(output, stats.compilation.assets['output.js'].existsAt);
              contents = watcher.fs.readFileSync(output);
              assert.include(contents.toString(), '__WATCH_TEST_THREE__');
              done();
            });
          }, 200);
        });
      }, 200);
    });
  });
  it('allows files to be read from memory and written to disk', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'rw_test', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'rw_test', 'output.js');

    var compiler = webpack({
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      },
      cache: false
    });

    var watcher = new WebpackWatcher(compiler);

    mkdirp.sync(path.dirname(entry));

    fs.writeFileSync(entry, 'module.exports = "__RW_TEST_ONE__";');
    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(output, stats.compilation.assets['output.js'].existsAt);
      var contents = watcher.fs.readFileSync(output);
      fs.writeFileSync(output, contents);
      contents = fs.readFileSync(output);
      assert.include(contents.toString(), '__RW_TEST_ONE__');
      fs.writeFileSync(entry, 'module.exports = "__RW_TEST_TWO__";');
      setTimeout(function() {
        watcher.onceDone(function(err, stats) {
          assert.isNull(err);
          assert.isObject(stats);
          assert.equal(output, stats.compilation.assets['output.js'].existsAt);
          contents = watcher.fs.readFileSync(output);
          fs.writeFileSync(output, contents);
          contents = fs.readFileSync(output);
          assert.include(contents.toString(), '__RW_TEST_TWO__');
          fs.writeFileSync(entry, 'module.exports = "__RW_TEST_THREE__";');
          setTimeout(function() {
            watcher.onceDone(function(err, stats) {
              assert.isNull(err);
              assert.isObject(stats);
              contents = watcher.fs.readFileSync(output);
              fs.writeFileSync(output, contents);
              contents = fs.readFileSync(output);
              assert.include(contents.toString(), '__RW_TEST_THREE__');
              done();
            });
          }, 200);
        });
      }, 200);
    });
  });
  it('provides an async method to write files from memory to disk', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'write_files_async', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'write_files_async', 'output.js');

    var compiler = webpack({
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      },
      cache: false
    });

    var watcher = new WebpackWatcher(compiler);

    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__ASYNC_WRITE_FILE_TEST_ONE__";');

    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(output, stats.compilation.assets['output.js'].existsAt);
      watcher.writeAssets(function(err, filenames) {
        assert.isNull(err);
        assert.isArray(filenames);
        assert.equal(filenames.length, 1);
        assert.equal(filenames[0], output);
        var contents = fs.readFileSync(output);
        assert.include(contents.toString(), '__ASYNC_WRITE_FILE_TEST_ONE__');
        fs.writeFileSync(entry, 'module.exports = "__ASYNC_WRITE_FILE_TEST_TWO__";');
        setTimeout(function() {
          watcher.onceDone(function(err, stats) {
            assert.isNull(err);
            assert.isObject(stats);
            watcher.writeAssets(function(err, filenames) {
              assert.isNull(err);
              assert.isArray(filenames);
              assert.equal(filenames.length, 1);
              assert.equal(filenames[0], output);
              contents = fs.readFileSync(output);
              assert.include(contents.toString(), '__ASYNC_WRITE_FILE_TEST_TWO__');
              fs.writeFileSync(entry, 'module.exports = "__ASYNC_WRITE_FILE_TEST_THREE__";');
              setTimeout(function() {
                watcher.onceDone(function(err, stats) {
                  assert.isNull(err);
                  assert.isObject(stats);
                  watcher.writeAssets(function(err, filenames) {
                    assert.isNull(err);
                    assert.isArray(filenames);
                    assert.equal(filenames.length, 1);
                    assert.equal(filenames[0], output);
                    contents = fs.readFileSync(output);
                    assert.include(contents.toString(), '__ASYNC_WRITE_FILE_TEST_THREE__');
                    done();
                  });
                });
              }, 200);
            });
          });
        }, 200);
      });
    });
  });
  it('writeAssets will create a dir path to a filename', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'write_assets_mkdirp', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'write_assets_mkdirp', 'nested_dir', 'and_another', 'output.js');

    var compiler = webpack({
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      }
    });

    var watcher = new WebpackWatcher(compiler);

    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__ASYNC_WRITE_FILE_TEST_ONE__";');

    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(output, stats.compilation.assets['output.js'].existsAt);
      watcher.writeAssets(function(err, filenames) {
        assert.isNull(err);
        assert.isArray(filenames);
        assert.equal(filenames.length, 1);
        assert.equal(filenames[0], output);
        var contents = fs.readFileSync(output);
        assert.include(contents.toString(), '__ASYNC_WRITE_FILE_TEST_ONE__');
        fs.writeFileSync(entry, 'module.exports = "__ASYNC_WRITE_FILE_TEST_TWO__";');
        done();
      });
    });
  });
  it('provides a way to invalidate the watcher', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'watcher_invalidate', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'watcher_invalidate', 'output.js');

    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__INVALID_TEST_ONE__";');

    var compiler = webpack({
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      },
      cache: false
    });

    var watcher = new WebpackWatcher(compiler);

    var invalidCount = 0;
    watcher.onInvalid(function() {
      invalidCount++;
    });

    watcher.onceDone(function(err, stats) {
      assert.isNull(err);
      assert.isObject(stats);
      assert.equal(output, stats.compilation.assets['output.js'].existsAt);
      assert.equal(invalidCount, 0);
      assert.isNull(err);
      var contents = watcher.fs.readFileSync(output);
      assert.include(contents.toString(), '__INVALID_TEST_ONE__');
      fs.writeFileSync(entry, 'module.exports = "__INVALID_TEST_TWO__";');
      watcher.invalidate();
      assert.equal(invalidCount, 1);
      assert.isNull(watcher.err);
      assert.isNull(watcher.stats);
      watcher.onceDone(function(err, stats) {
        assert.isNull(err);
        assert.isObject(stats);
        var contents = watcher.fs.readFileSync(output);
        assert.include(contents.toString(), '__INVALID_TEST_TWO__');
        fs.writeFileSync(entry, 'module.exports = "__INVALID_TEST_THREE__";');
        watcher.invalidate();
        assert.isNull(watcher.err);
        assert.isNull(watcher.stats);
        assert.equal(invalidCount, 3);
        watcher.onceDone(function(err, stats) {
          assert.isNull(err);
          assert.isObject(stats);
          var contents = watcher.fs.readFileSync(output);
          assert.include(contents.toString(), '__INVALID_TEST_THREE__');
          done();
        });
      });
    });
  });
  it('can run the compiler without the watcher', function(done) {
    var entry = path.join(TEST_OUTPUT_DIR, 'no_watcher', 'entry.js');
    var output = path.join(TEST_OUTPUT_DIR, 'no_watcher', 'output.js');

    mkdirp.sync(path.dirname(entry));
    fs.writeFileSync(entry, 'module.exports = "__NO_WATCHER_TEST_ONE__";');

    var compiler = webpack({
      context: path.dirname(entry),
      entry: './' + path.basename(entry),
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      },
      cache: false
    });

    var watcher = new WebpackWatcher(compiler, {
      watch: false
    });

    assert.isFalse(watcher.isRunning);
    watcher.onceDone(function(err, stats) {
      assert.isFalse(watcher.isRunning);
      assert.isNull(err);
      assert.isObject(stats);
      assert.isNull(watcher.watcher);
      assert.equal(output, stats.compilation.assets['output.js'].existsAt);
      var contents = watcher.fs.readFileSync(output);
      assert.include(contents.toString(), '__NO_WATCHER_TEST_ONE__');
      fs.writeFileSync(entry, 'module.exports = "__NO_WATCHER_TEST_TWO__";');
      watcher.invalidate();
      assert.isFalse(watcher.isRunning);
      watcher.onceDone(function(err, stats) {
        assert.isFalse(watcher.isRunning);
        assert.isNull(err);
        assert.isObject(stats);
        assert.isNull(watcher.watcher);
        contents = watcher.fs.readFileSync(output);
        assert.include(contents.toString(), '__NO_WATCHER_TEST_TWO__');
        fs.writeFileSync(entry, 'module.exports = "__NO_WATCHER_TEST_THREE__";');
        watcher.invalidate();
        assert.isFalse(watcher.isRunning);
        watcher.onceDone(function(err, stats) {
          assert.isFalse(watcher.isRunning);
          assert.isNull(err);
          assert.isObject(stats);
          assert.isNull(watcher.watcher);
          contents = watcher.fs.readFileSync(output);
          assert.include(contents.toString(), '__NO_WATCHER_TEST_THREE__');
          done();
        });
        assert.isTrue(watcher.isRunning);
      });
      assert.isTrue(watcher.isRunning);
    });
    assert.isTrue(watcher.isRunning);
  });
});