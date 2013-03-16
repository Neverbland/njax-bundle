<?php
/**
 * Defines NJAX annotation for Controller actions.
 * 
 * @package NeverblandNjaxBundle
 * @subpackage Configuration
 * @author Michał Dudek <michal@michaldudek.pl>
 * 
 * @copyright Copyright (c) 2013, Neverbland <http://www.neverbland.com>
 * @license MIT
 */
namespace Neverbland\Bundle\NjaxBundle\Configuration;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\ConfigurationAnnotation;
use Symfony\Bundle\FrameworkBundle\Templating\TemplateReference;
 
/**
 * @Njax is a special annotation to ease the work with NJAX requests and templates split into partials.
 * 
 * You can annotate any controller action that will be called by an NJAX request.
 * It behaves similar to @Template() annotation. In fact, if you include @Njax()
 * then you don't have to include @Template() (unless for some specific configuration).
 *
 * @Njax([default_template], partial="[partial_template]", partial2="[partial_template2]")
 * 
 * @Annotation
 */
class Njax extends ConfigurationAnnotation
{

    /**
     * Default template for a controller action.
     * 
     * @var string|TemplateReference
     */
    private $defaultTemplate;

    /**
     * Array of templates used for different partials.
     * 
     * @var array
     */
    private $partialTemplates = array();
 
    /**
     * Constructor.
     * 
     * @param array $options
     */
    public function __construct($options) {
        // read the default template (if specified)
        if (isset($options['value'])) {
            $this->defaultTemplate = $options['value'];
            unset($options['value']);
        }

        foreach($options as $name => $template) {
            $this->partialTemplates[$name] = $template;
        }
    }

    /**
     * Gets the default template for a controller action.
     * 
     * @return string|TemplateReference
     */
    public function getDefaultTemplate() {
        return $this->defaultTemplate;
    }

    /**
     * Sets the default template for a controller action.
     * 
     * @param string|TemplateReference $template
     */
    public function setDefaultTemplate($template) {
        $this->defaultTemplate = $template;
    }

    /**
     * Tries to guess the template for the given partial by appending the partial name to the name of the template,
     * e.g. for AcmeBundle:Acme:index.html.twig it would be AcmeBundle:Acme:index.partial.html.twig.
     * 
     * @param string $partial Name of the partial.
     * @return TemplateReference
     */
    public function guessPartialTemplate($partial) {
        $defTemplate = $this->getDefaultTemplate();

        // if template name given as string then convert it to TemplateReference object
        if (!is_object($defTemplate)) {
            list($bundle, $controller, $name) = explode(':', $defTemplate);
            $name = explode('.', $name);
            $engine = array_pop($name);
            $format = array_pop($name);
            $name = join('.', $name); // join all the rest
            $template = new TemplateReference($bundle, $controller, $name, $format, $engine);
        } else {
            $template = clone $defTemplate;
        }

        // add the partial name to the end of the default name
        $template->set('name', $template->get('name') .'.'. $partial);

        return $template;
    }

    /**
     * Returns templates for all defined partials of a controller action.
     * 
     * @return array
     */
    public function getPartialTemplates() {
        return $this->partialTemplates;
    }

    /**
     * Sets a template for the given partial.
     * 
     * @param string $name Partial name.
     * @param string|TemplateReference $template Template.
     */
    public function setPartialTemplate($name, $template) {
        $this->partialTemplates[$name] = $template;
    }

    /**
     * Returns template for the given partial.
     * 
     * @param string $name Partial name.
     * @return string|TemplateReference
     */
    public function getPartialTemplate($name) {
        if (empty($name)) return null;
        
        return isset($this->partialTemplates[$name]) ? $this->partialTemplates[$name] : null;
    }

    /**
     * Returns the annotation alias name.
     * 
     * @see ConfigurationInterface
     *
     * @return string
     */
    public function getAliasName() {
        return 'njax';
    }
 
}