Neverbland NJAX Bundle
============

NJAX - Navigation in AJAX. Integration with Symfony2.

# Installation

Install using [Composer](https://getcomposer.org/).

    $ composer require neverbland/njax-bundle dev-master

Then load the bundle in your application kernel:

    public function registerBundles()
    {
        $bundles = array(
            // ...
            new Neverbland\Bundle\NjaxBundle\NeverblandNjaxBundle()
        );
    }

And in the end also include NJAX js file somewhere on your site:

    <script type="text/javascript" src="/bundles/neverblandnjax/js/jquery.njax.js"></script>

You can also include `jquery.njax.wdt.js` in dev mode of your site in order to get updated Web Debug Toolbar on every NJAX load.

# Using in JavaScript

For usage information refer to main NJAX repository: https://github.com/Neverbland/njax

# Additional PHP features

TBD.

# Contributing

You are welcome to submit pull requests.

## Updating NJAX JavaScript library

In order to update `jquery.njax.js` file you should use [Gulp](http://gulpjs.com/). There is a `gulpfile.js` in the main dir of the repo which will do all the work for you.

To update the JS simply run `gulp` command:

    $ gulp

It will pull latest version of NJAX from [Bower](http://bower.io/) and copy the JS plugin into `Resources/public/js/jquery.njax.js`.