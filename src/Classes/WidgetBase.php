<?php namespace October\Amber\Classes;

use October\Rain\Html\Helper as HtmlHelper;
use October\Rain\Extension\Extendable;
use Larajax\Contracts\ViewComponentInterface;

/**
 * WidgetBase class
 *
 * @package october\amber
 * @author Alexey Bobkov, Samuel Georges
 */
abstract class WidgetBase extends Extendable implements ViewComponentInterface
{
    use \October\Amber\Traits\EventEmitter;
    use \October\Amber\Traits\SessionMaker;
    use \October\Amber\Traits\ConfigMaker;
    use \October\Amber\Traits\WidgetMaker;
    use \October\Amber\Traits\AssetMaker;
    use \October\Amber\Traits\ErrorMaker;
    use \October\Amber\Traits\ViewMaker;
    use \Larajax\Traits\ViewComponent;

    /**
     * @var object config supplied.
     */
    public $config;

    /**
     * __construct bypasses the extendable constructor since register() calls it
     */
    public function __construct()
    {
    }

    /**
     * register the widget
     */
    public function register()
    {
        $this->config = $this->makeConfig($this->config);
        $this->viewPath = $this->configPath = $this->guessViewPath('/partials');
        $this->assetPath = $this->guessViewPath('/assets', true);

        // Prepare assets used by this widget
        $this->loadAssets();

        // Boot extensions
        $this->extendableConstruct();

        // Initialize the widget
        if (!($this->config->noInit ?? false)) {
            $this->init();
        }
    }

    /**
     * init the widget, called by the constructor and free from its parameters.
     * @return void
     */
    public function init()
    {
    }

    /**
     * render the widget's primary contents.
     * @return string HTML markup supplied by this widget.
     */
    public function render()
    {
    }

    /**
     * loadAssets adds widget specific asset files. Use $this->addJs() and $this->addCss()
     * to register new assets to include on the page.
     * @return void
     */
    protected function loadAssets()
    {
    }

    /**
     * fillFromConfig transfers config values stored inside the $config property directly
     * on to the root object properties. If no properties are defined
     * all config will be transferred if it finds a matching property.
     * @param array $properties
     * @return void
     */
    protected function fillFromConfig($properties = null)
    {
        if ($properties === null) {
            $properties = array_keys((array) $this->config);
        }

        foreach ($properties as $property) {
            if (property_exists($this, $property)) {
                $this->{$property} = $this->getConfig($property, $this->{$property});
            }
        }
    }

    /**
     * getId returns a unique ID for this widget. Useful in creating HTML markup.
     * @param string $suffix An extra string to append to the ID.
     * @return string A unique identifier.
     */
    public function getId($suffix = null)
    {
        $id = class_basename(get_called_class());

        if ($this->alias !== $this->defaultAlias) {
            $id .= '-' . $this->alias;
        }

        if ($suffix !== null) {
            $id .= '-' . $suffix;
        }

        return HtmlHelper::nameToId($id);
    }

    /**
     * getEventHandler returns a fully qualified event handler name for this widget.
     * @param string $name The ajax event handler name.
     * @return string
     */
    public function getEventHandler($name)
    {
        return $this->alias . '::' . $name;
    }

    /**
     * getConfig is a safe accessor for configuration values
     * @param string $name Config name, supports array names like "field[key]"
     * @param mixed $default Default value if nothing is found
     * @return string
     */
    public function getConfig($name = null, $default = null)
    {
        if (!$this->config) {
            return $default;
        }

        return $this->getConfigValueFrom($this->config, $name, $default);
    }

    /**
     * getController returns the controller using this widget.
     */
    public function getController()
    {
        return $this->controller;
    }
}
