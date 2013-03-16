<?php
/**
 * Event listener that takes care of several things to make NJAX work.
 * 
 * @package NeverblandNjaxBundle
 * @subpackage EventListener
 * @author Michał Dudek <michal@michaldudek.pl>
 * 
 * @copyright Copyright (c) 2013, Neverbland <http://www.neverbland.com>
 * @license MIT
 */
namespace Neverbland\Bundle\NjaxBundle\EventListener;

use Symfony\Component\HttpKernel\Event\GetResponseForControllerResultEvent;
use Symfony\Component\HttpKernel\Event\FilterControllerEvent;
use Symfony\Component\HttpKernel\Event\FilterResponseEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

use Neverbland\Bundle\NjaxBundle\Configuration\Njax as NjaxAnnotation;
use Neverbland\Bundle\NjaxBundle\Njax;

class NjaxListener
{

    /**
     * Dependency Injection service container.
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

    /**
     * Handles the @Njax() annotation for the found controller action.
     * 
     * @param FilterControllerEvent $event Event called.
     */
    public function onKernelController(FilterControllerEvent $event) {
        if (!is_array($controller = $event->getController())) {
            return;
        }
      
        $request = $event->getRequest();
        $njax = $this->container->get('njax');

        // force @Njax() annotation for *all* NJAX requests
        if (!$njaxConfiguration = $request->attributes->get('_njax')) {
            if (!$njax->isNjax()) {
                return;
            }

            $njaxConfiguration = new NjaxAnnotation(array());
            $request->attributes->set('_njax', $njaxConfiguration);
        }

        // force every @Njax() annotation to also trigger @Template() (if not defined)
        if (!$templateConfiguration = $request->attributes->get('_template')) {
            $templateAnnotation = new Template(array());

            // if there is @Njax default template set then use this
            if ($njaxConfiguration->getDefaultTemplate()) {
                $templateConfiguration = $njaxConfiguration->getDefaultTemplate();
            } else {
                // if not, then try to guess the template name (just like @Template() would do)
                $guesser = $this->container->get('sensio_framework_extra.view.guesser');
                $templateConfiguration =  $guesser->guessTemplateName($controller, $request);
            }

            $request->attributes->set('_template', $templateConfiguration);
        }

        if (!$njaxConfiguration->getDefaultTemplate()) {
            $njaxConfiguration->setDefaultTemplate($templateConfiguration);
        }
    }

    /**
     * This event is called when the controller action returns something else than a response object (e.g. an array).
     * This function handles the rendering of proper template according to the requested partial.
     * 
     * @param GetResponseForControllerResultEvent $event Event called.
     */
    public function onKernelView(GetResponseForControllerResultEvent $event) {
        // only work with master request
        if ($event->getRequestType() !== HttpKernelInterface::MASTER_REQUEST) {
            return;
        }

        // only on NJAX requests
        $njax = $this->container->get('njax');
        if (!$njax->isNjax()) {
            return;
        }

        $request = $event->getRequest();
        $parameters = $event->getControllerResult();

        if (!$njaxConfiguration = $request->attributes->get('_njax')) {
            return;
        }

        // this behavior is copied from Sensio\Bundle\FrameworkExtraBundle\EventListener\TemplateListener::onKernelView()
        if (null === $parameters) {
            if (!$vars = $request->attributes->get('_template_vars')) {
                if (!$vars = $request->attributes->get('_template_default_vars')) {
                    return;
                }
            }

            $parameters = array();
            foreach ($vars as $var) {
                $parameters[$var] = $request->attributes->get($var);
            }
        }

        if (!is_array($parameters)) {
            return $parameters;
        }

        // get the templating engine
        $templating = $this->container->get('templating');

        // now figure out which template to use
        $partial = $njax->getPartial();
        $template = $njaxConfiguration->getPartialTemplate($partial);
        $usedPartial = $partial;

        // if no specified template then try to guess the name of a partial template
        if (!$template) {
            $template = $njaxConfiguration->guessPartialTemplate($partial);

            // if couldn't guess the name then just use the default one
            if (!$template || !$templating->exists($template)) {
                $template = $njaxConfiguration->getDefaultTemplate();
                $usedPartial = null;
            }
        }

        $content = $templating->render($template, $parameters);
        $event->setResponse(new Response($content));
    }

    /**
     * Called on final Response (should have the lowest priority as possible), renders NJAX response.
     * 
     * @param FilterResponseEvent $event
     */
    public function onKernelResponse(FilterResponseEvent $event) {
        // only work with master request
        if ($event->getRequestType() !== HttpKernelInterface::MASTER_REQUEST) {
            return;
        }

        // only on NJAX requests
        $njax = $this->container->get('njax');
        if (!$njax->isNjax()) {
            return;
        }

        // only on valid responses
        $response = $event->getResponse();
        if ($response->getStatusCode() !== 200) {
            return;
        }

        $response = $njax->renderResponse($response->getContent(), $response);
        $event->setResponse($response);
    }

}