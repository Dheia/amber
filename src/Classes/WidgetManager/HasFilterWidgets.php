<?php namespace October\Amber\Classes\WidgetManager;

use Str;

/**
 * HasFilterWidgets concern
 */
trait HasFilterWidgets
{
    /**
     * @var array filterWidgets
     */
    protected $filterWidgets;

    /**
     * @var array filterWidgetCallbacks cache
     */
    protected $filterWidgetCallbacks = [];

    /**
     * @var array filterWidgetHints keyed by their code.
     * Stored in the form of ['filterwidgetcode' => 'FilterWidgetClass'].
     */
    protected $filterWidgetHints;

    /**
     * listFilterWidgets returns a list of registered filter widgets.
     * @return array Array keys are class names.
     */
    public function listFilterWidgets()
    {
        if ($this->filterWidgets === null) {
            $this->filterWidgets = [];

            // Load externally registered widgets
            foreach ($this->filterWidgetCallbacks as $callback) {
                $callback($this);
            }

            // Allow subclasses to discover widgets from additional sources
            $this->discoverFilterWidgets();
        }

        if ($this->parent) {
            return $this->filterWidgets + $this->parent->listFilterWidgets();
        }

        return $this->filterWidgets;
    }

    /**
     * getFilterWidgets returns the raw array of registered filter widgets.
     * @return array Array keys are class names.
     */
    public function getFilterWidgets()
    {
        return $this->filterWidgets;
    }

    /**
     * registerFilterWidget registers a single filter widget.
     */
    public function registerFilterWidget($className, $widgetInfo)
    {
        if (!is_array($widgetInfo)) {
            $widgetInfo = ['code' => $widgetInfo];
        }

        $widgetCode = $widgetInfo['code'] ?? null;

        if (!$widgetCode) {
            $widgetCode = Str::getClassId($className);
        }

        $this->filterWidgets[$className] = $widgetInfo;
        $this->filterWidgetHints[$widgetCode] = $className;
    }

    /**
     * registerFilterWidgets manually registers filter widget for consideration. Usage:
     *
     *     WidgetManager::registerFilterWidgets(function ($manager) {
     *         $manager->registerFilterWidget(\Backend\FilterWidgets\DateRange::class, 'daterange');
     *     });
     *
     */
    public function registerFilterWidgets(callable $definitions)
    {
        $this->filterWidgetCallbacks[] = $definitions;
    }

    /**
     * resolveFilterWidget returns a class name from a filter widget code
     * Normalizes a class name or converts a code to its class name.
     * Returns the class name resolved, or the original name.
     * @param string $name
     * @return string
     */
    public function resolveFilterWidget($name)
    {
        if ($this->filterWidgets === null) {
            $this->listFilterWidgets();
        }

        $hints = $this->filterWidgetHints;

        if (isset($hints[$name])) {
            return $hints[$name];
        }

        $_name = Str::normalizeClassName($name);
        if (isset($this->filterWidgets[$_name])) {
            return $_name;
        }

        if ($this->parent) {
            return $this->parent->resolveFilterWidget($name);
        }

        return $name;
    }

    /**
     * discoverFilterWidgets is an extension point for subclasses to register
     * widgets from additional sources (e.g. modules, plugins, app providers).
     */
    protected function discoverFilterWidgets()
    {
    }
}
