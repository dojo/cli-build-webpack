module.exports = {
	plugins: [
		require('postcss-import')(),
		require('postcss-cssnext')({
			features: {
				autoprefixer: {
					browsers: [ 'last 2 versions', 'ie >= 10' ]
				}
			}
		})
	]
};
