/**
 * Handles injecting of the Web Debug Toolbar in Symfony2 dev environment for NJAX page loads.
 * 
 * @author Michał Dudek <michal@michaldudek.pl>
 * @copyright Copyright (c) 2013, Neverbland <http://www.neverbland.com>
 * @license MIT
 */
(function($, undefined) {
    "use strict";

    $(function() {
        $('body').on('njax:success.wdt', function(ev, response, raw) {
            // only when raw response was JSON - HTML responses don't support the WDT
            if (typeof raw !== 'object') {
                return;
            }

            // if there is no WDT included then don't worry about this listener
            if (raw.wdt === undefined) {
                return;
            }

            $('.sf-toolbar').remove();
            $(raw.wdt).appendTo('body');
        });
    });

})(jQuery);