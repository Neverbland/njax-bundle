<?php
/**
 * NJAX Twig extension.
 * 
 * @package NeverblandNjaxBundle
 * @subpackage Twig
 * @author Michał Dudek <michal@michaldudek.pl>
 * 
 * @copyright Copyright (c) 2013, Neverbland <http://www.neverbland.com>
 * @license MIT
 */
namespace Neverbland\Bundle\NjaxBundle\Twig\Extension;

use Symfony\Component\DependencyInjection\ContainerInterface;

class NjaxGlobals extends \Twig_Extension
{

    /**
     * Dependency Injection Container.
     * 
     * @var ContainerInterface
     */
    protected $container;

    /**
     * Constructor.
     * 
     * @param ContainerInterface $container
     */
    public function __construct(ContainerInterface $container) {
        $this->container = $container;
    }

    public function getFunctions() {
        return array(
            'is_njax' => new \Twig_Function_Method($this, 'isNjax'),
            'njax_partial' => new \Twig_Function_Method($this, 'getPartial'),
            'njax_fragment' => new \Twig_Function_Method($this, 'getFragment')
        );
    }
    
    public function isNjax() {
        return $this->container->get('njax')->isNjax();
    }

    public function getPartial() {
        return $this->container->get('njax')->getPartial();
    }

    public function getFragment() {
        return $this->container->get('njax')->getFragment();
    }

    public function getName(){
        return 'njax_globals';
    }

}