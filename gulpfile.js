/* jshint node: true */
'use strict';

var gulp = require('gulp'),
    bower = require('gulp-bower');

gulp.task('bower', function() {
    bower();
});

gulp.task('publish', function() {
    gulp.src('./Resources/public/js/bower_components/njax/jquery.njax.js')
        .pipe(gulp.dest('./Resources/public/js/'));
});

gulp.task('default', ['bower', 'publish']);