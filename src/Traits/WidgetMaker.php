<?php namespace October\Amber\Traits;

use Lang;
use Backend\Classes\FormField;
use Exception;

/**
 * WidgetMaker Trait
 *
 * Adds widget based methods to a controller class, or a class that
 * contains a `$controller` property referencing a controller.
 *
 * @package october\amber
 * @author Alexey Bobkov, Samuel Georges
 */
trait WidgetMaker
{
    /**
     * getWidget
     */
    public function getWidget(string $name)
    {
        $controller = property_exists($this, 'controller') && $this->controller
            ? $this->controller
            : $this;

        return $controller->widget->{$name} ?? null;
    }

    /**
     * makeWidget object with the supplied configuration file.
     * @param string $class
     * @param array $widgetConfig
     * @return \October\Amber\Classes\WidgetBase
     */
    public function makeWidget($class, $widgetConfig = [])
    {
        $controller = property_exists($this, 'controller') && $this->controller
            ? $this->controller
            : $this;

        if (!class_exists($class)) {
            throw new Exception(__("A widget class name ':name' has not been registered", [
                'name' => $class
            ]));
        }

        return new $class($controller, $widgetConfig);
    }

    /**
     * makeFormWidget object with the supplied form field and widget configuration.
     * The fieldConfig is a field name, an array of config or a FormField object.
     * @param string $class
     * @param mixed $fieldConfig
     * @param array|object $widgetConfig
     * @return \October\Amber\Classes\FormWidgetBase
     */
    public function makeFormWidget($class, $fieldConfig = [], $widgetConfig = [])
    {
        $controller = property_exists($this, 'controller') && $this->controller
            ? $this->controller
            : $this;

        if (!class_exists($class)) {
            throw new Exception(__("A widget class name ':name' has not been registered", [
                'name' => $class
            ]));
        }

        if (is_string($fieldConfig)) {
            $fieldConfig = ['fieldName' => $fieldConfig];
        }

        if (is_array($fieldConfig)) {
            if (isset($fieldConfig['name'])) {
                $fieldConfig['fieldName'] = $fieldConfig['name'];
            }

            $formField = new FormField($fieldConfig);
            $formField->displayAs('widget', $fieldConfig);
        }
        else {
            $formField = $fieldConfig;
        }

        return $class::createIn($controller, [
            'formField' => $formField,
            ...(array) $widgetConfig
        ]);
    }
}
