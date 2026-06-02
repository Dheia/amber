<?php namespace October\Amber\Classes\WidgetManager;

use Str;

/**
 * HasFormWidgets concern
 */
trait HasFormWidgets
{
    /**
     * @var array formWidgets stored in the form of ['FormWidgetClass' => $formWidgetInfo]
     */
    protected $formWidgets;

    /**
     * @var array formWidgetCallbacks cache
     */
    protected $formWidgetCallbacks = [];

    /**
     * @var array formWidgetHints keyed by their code.
     * Stored in the form of ['formwidgetcode' => 'FormWidgetClass'].
     */
    protected $formWidgetHints;

    /**
     * listFormWidgets returns a list of registered form widgets, including any
     * inherited from a parent manager. Child registrations override the parent
     * on key collision.
     * @return array Array keys are class names.
     */
    public function listFormWidgets()
    {
        if ($this->formWidgets === null) {
            $this->formWidgets = [];

            // Load externally registered widgets
            foreach ($this->formWidgetCallbacks as $callback) {
                $callback($this);
            }

            // Allow subclasses to discover widgets from additional sources
            $this->discoverFormWidgets();
        }

        if ($this->parent) {
            return $this->formWidgets + $this->parent->listFormWidgets();
        }

        return $this->formWidgets;
    }

    /**
     * registerFormWidget registers a single form widget.
     * @param string $className Widget class name.
     * @param array $widgetInfo Registration information, can contain a `code` key.
     */
    public function registerFormWidget($className, $widgetInfo = null)
    {
        if (!is_array($widgetInfo)) {
            $widgetInfo = ['code' => $widgetInfo];
        }

        $widgetCode = $widgetInfo['code'] ?? null;

        if (!$widgetCode) {
            $widgetCode = Str::getClassId($className);
        }

        $this->formWidgets[$className] = $widgetInfo;
        $this->formWidgetHints[$widgetCode] = $className;
    }

    /**
     * registerFormWidgets manually registers form widget for consideration. Usage:
     *
     *     WidgetManager::registerFormWidgets(function ($manager) {
     *         $manager->registerFormWidget(\Backend\FormWidgets\CodeEditor::class, 'codeeditor');
     *     });
     *
     */
    public function registerFormWidgets(callable $definitions)
    {
        $this->formWidgetCallbacks[] = $definitions;
    }

    /**
     * resolveFormWidget returns a class name from a form widget code
     * Normalizes a class name or converts a code to its class name.
     * Returns the class name resolved, or the original name.
     * @param string $name
     * @return string
     */
    public function resolveFormWidget($name)
    {
        if ($this->formWidgets === null) {
            $this->listFormWidgets();
        }

        $hints = $this->formWidgetHints;

        if (isset($hints[$name])) {
            return $hints[$name];
        }

        $_name = Str::normalizeClassName($name);
        if (isset($this->formWidgets[$_name])) {
            return $_name;
        }

        if ($this->parent) {
            return $this->parent->resolveFormWidget($name);
        }

        return $name;
    }

    /**
     * discoverFormWidgets is an extension point for subclasses to register
     * widgets from additional sources (e.g. modules, plugins, app providers).
     */
    protected function discoverFormWidgets()
    {
    }
}
