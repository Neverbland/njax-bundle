<?php
/**
 * NJAX Service.
 * 
 * @package NeverblandNjaxBundle
 * @author Michał Dudek <michal@michaldudek.pl>
 * 
 * @copyright Copyright (c) 2013, Neverbland <http://www.neverbland.com>
 * @license MIT
 */
namespace Neverbland\Bundle\NjaxBundle;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\HeaderBag;

use Symfony\Bundle\TwigBundle\TwigEngine;

class Njax
{

    /**
     * Request
     * 
     * @var Request
     */
    protected $request;

    /**
     * Current application environment.
     * 
     * @var string
     */
    protected $environment;

    /**
     * List of all initialized bundles.
     * 
     * @var array
     */
    protected $bundles;

    /**
     * Name of the Web Profiler Bundle
     * 
     * @var string
     */
    protected $wdtBundleName = 'Symfony\Bundle\WebProfilerBundle\WebProfilerBundle';

    /**
     * Twig service.
     * 
     * @var TwigEngine
     */
    protected $templating;

    /**
     * Information whether the request is an NJAX request.
     * 
     * @var bool
     */
    protected $isNjax;

    /**
     * Information on what format was requested in the NJAX request.
     * 
     * @var string
     */
    protected $format;

    /**
     * Information if a partial of the site was requested.
     * 
     * @var string
     */
    protected $partial;

    /**
     * Information if a fragment of the site was request (in form of CSS selector).
     * 
     * @var string
     */
    protected $fragment;

    /**
     * What URL should be displayed in the browser upon response?
     * 
     * @var string
     */
    protected $displayUrl;

    /**
     * What page title should be set to upon response?
     * 
     * @var string
     */
    protected $pageTitle;

    /**
     * Some additional data that are going to be sent along with the response.
     * 
     * @var array
     */
    protected $data = array();

    public function __construct(Request $request, TwigEngine $templating, $environment, $bundles) {
        $this->request = $request;
        $this->templating = $templating;
        $this->environment = $environment;
        $this->bundles = $bundles;
    }

    /***********************************************
     * RESPONSE METHODS
     ***********************************************/
    /**
     * Creates a response object for the given content.
     * 
     * It also sets up all necessary headers and passes data required for NJAX JavaScript handler.
     * 
     * @param string $content Rendered template content that will be inserted on the page.
     * @param Response $response [optional] If already got Response object then use it.
     * @return Response
     */
    public function renderResponse($content, Response $response = null) {
        $response = (isset($response)) ? $response : new Response();

        $esiEncoded = $this->extractEsi($content);

        // JSON responses get some additional love and features :)
        if ($this->getFormat() == 'json') {
            if ($response->headers->has('X-Partial')) {
                $json = $content;

            } else {
                $json = array(
                    'content' => $content
                );
                
                // add web profiler debug toolbar
                if (
                    in_array($this->environment, array('dev', 'test'))
                    && in_array($this->wdtBundleName, $this->bundles)
                    && ($response->headers->has('X-Debug-Token') || $response->headers->has('x-debug-token'))
                ) {
                    $json['wdt'] = $this->templating->render('WebProfilerBundle:Profiler:toolbar_js.html.twig', array(
                        'position' => 'bottom',
                        'token' => $response->headers->get('X-Debug-Token'),
                    ));
                }
            }

            // make sure content is utf8 (encode only if its not)
            $json['content'] = !preg_match('//u', $json['content']) ? utf8_encode($json['content']) : $json['content'];
            $jsonString = !$response->headers->has('X-Partial') ? json_encode($json) : trim(json_encode($json), '"');
            $jsonString = $this->parseEsi($jsonString, $esiEncoded);

            $response->setContent($jsonString);
            $response->headers->set('Content-Type', 'application/json');
        }

        // add some more additional headers to pass some information with
        if ($displayUrl = $this->getDisplayUrl()) {
            $response->headers->set('X-NJAX-Display-URL', $displayUrl);
        }

        if ($pageTitle = $this->getPageTitle()) {
            $response->headers->set('X-NJAX-Title', $pageTitle);
        }

        // pass along some data
        if ($data = $this->getData()) {
            $response->headers->set('X-NJAX-Data', json_encode($data));
        }

        // set some headers, but not really sure about them...
        $response->headers->set('Cache-Control', 'no-cache');
        $response->headers->set('Expires', 'Sun, 19 Nov 1978 05:00:00 GMT');
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
    
    /***********************************************
     * ESI
     ***********************************************/
    /**
     * Extracts ESI caching from content.
     * 
     * @param string $content
     * @return array
     */
    protected function extractEsi($content) {
        $content = preg_replace('#<esi\:comment[^>]*(?:/|</esi\:comment)>#', '', $content);
        $content = preg_replace('#<esi\:remove>.*?</esi\:remove>#', '', $content);
        $matches = array();
        preg_match_all('#<esi\:include\s+(.*?)\s*(?:/|</esi\:include)>#', $content, $matches);
        
        $esi = $matches[0];
        $esiEncoded = array();
        foreach ($esi as $esiStr) {
            $encoded = json_encode($esiStr);
            $trimmed = trim($encoded, '"');
            $esiEncoded[] = $trimmed;
        }
        
        return array(
            'original' => $esi,
            'encoded' => $esiEncoded
        );
    }
    
    /**
     * Parses ESI caching include inside of a JSON string.
     * 
     * @param string $json
     * @param array $esi Extracted ESI data.
     * @return string
     */
    protected function parseEsi($json, $esi) {
        return str_replace($esi['encoded'], $esi['original'], $json);
    }

    /***********************************************
     * SETTERS AND GETTERS
     ***********************************************/
    /**
     * Sets the URL that will be displayed in the client's address bar.
     * 
     * @param string $url
     */
    public function setDisplayUrl($url) {
        $this->displayUrl = $url;
    }

    /**
     * Returns the URL that will be displayed in the client's address bar (if any custom specified).
     * 
     * @return string
     */
    public function getDisplayUrl() {
        return $this->displayUrl;
    }

    /**
     * Sets the custom page title for this NJAX request.
     * 
     * @param string $pageTitle
     */
    public function setPageTitle($pageTitle) {
        $this->pageTitle = $pageTitle;
    }

    /**
     * Returns the custom page title (if any) for this NJAX request.
     * 
     * @return string
     */
    public function getPageTitle() {
        return $this->pageTitle;
    }

    /**
     * Gets the format in which the response should be rendered.
     * 
     * @return string Either 'json' or 'html'.
     */
    public function getFormat() {
        if (isset($this->format)) {
            return $this->format;
        }

        $this->format = $this->request->headers->get('X-NJAX-Format', 'html');
        return $this->format;
    }

    /**
     * Returns the name of the requested fragment of the site (if any) in form of CSS selector.
     * 
     * @return string
     */
    public function getFragment() {
        if (isset($this->fragment)) {
            return $this->fragment;
        }

        $this->fragment = $this->request->headers->get('X-NJAX-Fragment', '');
        return $this->fragment;
    }

    /**
     * Returns the name of the requested part of the rendered site (if any).
     * 
     * @return string
     */
    public function getPartial() {
        if (isset($this->partial)) {
            return $this->partial;
        }

        $this->partial = $this->request->headers->get('X-NJAX-Partial', '');
        return $this->partial;
    }

    /**
     * Set a data variable that is going to be sent along with the response.
     * 
     * @param string $name Name of the variable.
     * @param mixed $value Value of the variable.
     */
    public function setDataVariable($name, $value) {
        $this->data[$name] = $value;
    }

    /**
     * Get a data variable that is being sent along with the response.
     * 
     * @param string $name Name of the variable.
     * @return mixed
     */
    public function getDataVariable($name) {
        return $this->data[$name];
    }

    /**
     * Returns all variables that are being sent along with the response.
     * 
     * @return array
     */
    public function getData() {
        return $this->data;
    }

    /**
     * Checks if the current request is an NJAX request.
     * 
     * @return bool
     */
    public function isNjax() {
        if (isset($this->isNjax)) {
            return $this->isNjax;
        }

        $this->isNjax = ($this->request->isXmlHttpRequest() && $this->request->headers->has('X-NJAX') && ($this->request->headers->get('X-NJAX') == 'true'));
        return $this->isNjax;
    }
    
}