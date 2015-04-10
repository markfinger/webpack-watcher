var path = require('path');

module.exports = {
  context: __dirname,
	entry: './entry.js',
  output: {
    path: path.join(__dirname, '..', 'test_output', 'basic_bundle'),
    filename: 'output.js'
  },
  cache: false
};