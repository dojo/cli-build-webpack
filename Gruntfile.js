module.exports = function(grunt) {
	require('grunt-dojo2').initConfig(grunt, {
		staticDefinitionFiles: [ '**/*.d.ts', '**/*.html', '**/*.md' ],
		copy: {
			'staticDefinitionFiles-dev': {
				expand: true,
				cwd: 'src',
				src: [ '**/*.md' ],
				dest: '<%= devDirectory %>/src/'
			}
		}
	});
	grunt.registerTask('ci', [
		'intern:node'
	]);
};
