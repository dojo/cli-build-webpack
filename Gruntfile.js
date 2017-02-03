module.exports = function(grunt) {
    require('grunt-dojo2').initConfig(grunt, {
        staticDefinitionFiles: ['**/*.d.ts', '**/*.html']
    });
    grunt.registerTask('ci', [
        'intern:node'
    ]);
};
