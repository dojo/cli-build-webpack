module.exports = function (grunt) {
	require('grunt-dojo2').initConfig(grunt, {
		copy: {
			staticDistFiles: { src: 'src/webpack.config.js', dest: 'dist/umd/webpack.config.js' },
			staticDevFiles: { src: 'src/webpack.config.js', dest: '_build/src/webpack.config.js' }
		}
	});

	grunt.registerTask('ci', [
		'intern:node'
	]);

	grunt.registerTask('dist', grunt.config.get('distTasks').concat(['copy:staticDistFiles']));
	grunt.registerTask('dev', grunt.config.get('devTasks').concat(['copy:staticDevFiles']));
};
