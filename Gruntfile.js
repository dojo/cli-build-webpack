module.exports = function(grunt) {
    require('grunt-dojo2').initConfig(grunt, {
        staticDefinitionFiles: ['**/*.d.ts', '**/*.html', '**/*.md']
    });
    grunt.registerTask('ci', [
        'intern:node'
    ]);
};
