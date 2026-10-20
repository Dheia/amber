<?php namespace Larajax\Ui\Widgets;

use Illuminate\Support\Facades\Gate;
use Larajax\Ui\Classes\ToolbarButton;
use Larajax\Ui\Classes\WidgetBase;
use SystemException;

/**
 * Toolbar Widget
 * Used for building a toolbar, renders a toolbar.
 *
 * @package larajax\ui
 * @author Alexey Bobkov, Samuel Georges
 */
class Toolbar extends WidgetBase
{
    //
    // Configurable Properties
    //

    /**
     * @var array|string buttons as declarative definitions (array or YAML file path)
     * or a controller partial name.
     */
    public $buttons;

    /**
     * @var array|string search widget configuration or partial name, optional.
     */
    public $search;

    /**
     * @var string setupHandler displays a list configuration icon in the toolbar.
     */
    public $setupHandler;

    //
    // Object Properties
    //


    /**
     * @var WidgetBase searchWidget reference
     */
    protected $searchWidget;

    /**
     * @var array cssClasses to apply to the toolbar container element
     */
    public $cssClasses = [];

    /**
     * @var string listWidgetId
     */
    public $listWidgetId;

    /**
     * @var array|null buttonsConfig holds declarative button configuration.
     */
    protected $buttonsConfig;

    /**
     * @var ToolbarButton[]|null allButtons collection of all button definitions.
     */
    protected $allButtons;

    /**
     * make the toolbar widget from named arguments, other configuration keys pass
     * through the variadic tail.
     *
     * @param array|string|null $buttons button definitions (array or YAML file path) or a partial name
     * @param array|string|null $search search widget configuration or partial name
     * @param string|null $setupHandler
     * @param string|null $alias
     */
    public static function make(
        $buttons = null,
        $search = null,
        $setupHandler = null,
        $alias = null,
        ...$config
    ): static {
        return static::makeFromNamedArgs(get_defined_vars(), $config);
    }

    /**
     * bindToListWidget wires toolbar search and list linkage to a list widget.
     */
    public function bindToListWidget(Lists $list): void
    {
        $this->listWidgetId = $list->getId();

        if (!$search = $this->getSearchWidget()) {
            return;
        }

        $list->setSearchOptions([
            'mode' => $search->mode,
            'scope' => $search->scope,
        ]);

        $list->setSearchTerm($search->getActiveTerm());

        $search->bindEvent('search.submit', function () use ($list, $search) {
            $list->setSearchTerm($search->getActiveTerm(), true);

            return $list->onRefresh();
        });
    }

    /**
     * init the widget, called by the constructor and free from its parameters.
     */
    public function init()
    {
        $this->fillFromConfig([
            'buttons',
            'search',
            'setupHandler',
        ]);

        $this->initButtonsConfig();

        // Prepare the search widget (optional)
        if (isset($this->search)) {
            if (is_string($this->search)) {
                $searchConfig = $this->makeConfig(['partial' => $this->search]);
            }
            else {
                $searchConfig = $this->makeConfig($this->search);
            }

            $searchConfig->alias = $this->alias . 'Search';
            $this->searchWidget = $this->makeWidget(\Larajax\Ui\Widgets\Search::class, $searchConfig);
            $this->searchWidget->bindToController();
        }
    }

    /**
     * Renders the widget.
     */
    public function render()
    {
        $this->prepareVars();
        return $this->makePartial('toolbar');
    }

    /**
     * prepareVars for display
     */
    public function prepareVars()
    {
        $this->vars['search'] = $this->searchWidget ? $this->searchWidget->render() : '';
        $this->vars['cssClasses'] = implode(' ', $this->cssClasses);
        $this->vars['controlPanel'] = $this->makeControlPanel();
        $this->vars['setupHandler'] = $this->setupHandler;
    }

    /**
     * getSearchWidget
     */
    public function getSearchWidget()
    {
        return $this->searchWidget;
    }

    /**
     * makeControlPanel
     */
    public function makeControlPanel()
    {
        $this->vars['alias'] = $this->alias;

        if ($this->buttonsConfig !== null) {
            return $this->makePartial('buttons', ['buttons' => $this->getButtons()]);
        }

        if (!isset($this->buttons)) {
            return '<div data-control="toolbar"></div>';
        }

        return $this->controller->makePartial($this->buttons, $this->vars);
    }

    /**
     * initButtonsConfig resolves the `buttons` config as declarative button definitions
     * when supplied as an array or a YAML file path, otherwise the string keeps its
     * original meaning of a controller partial name.
     */
    protected function initButtonsConfig(): void
    {
        if (is_array($this->buttons)) {
            $this->buttonsConfig = $this->buttons;
            $this->buttons = null;
        }
        elseif (is_string($this->buttons) && preg_match('/\.ya?ml$/i', $this->buttons)) {
            $loaded = (array) $this->makeConfig($this->buttons);
            $this->buttonsConfig = $loaded['buttons'] ?? [];
            $this->buttons = null;
        }
    }

    /**
     * defineToolbarButtons builds the button definitions from the configuration and
     * gives extensions the opportunity to modify them.
     */
    protected function defineToolbarButtons(): void
    {
        if ($this->allButtons !== null) {
            return;
        }

        $this->allButtons = [];

        $this->addButtons((array) $this->buttonsConfig);

        $this->eventExtendButtons();
    }

    /**
     * eventExtendButtons is called after the toolbar buttons are defined, giving
     * extensions the opportunity to add, modify or remove buttons. The host controller
     * may implement a `toolbarExtendButtons` method as an override, mirroring the
     * form and list controller conventions.
     */
    protected function eventExtendButtons(): void
    {
        if ($this->controller && method_exists($this->controller, 'toolbarExtendButtons')) {
            $this->controller->toolbarExtendButtons($this);
        }

        $this->fireEvent('toolbar.extendButtons', [$this]);
    }

    /**
     * addButtons programmatically, accepts button names as keys with configuration
     * arrays or ToolbarButton instances as values.
     */
    public function addButtons(array $buttons): void
    {
        $this->defineToolbarButtons();

        foreach ($buttons as $name => $config) {
            if ($config instanceof ToolbarButton) {
                $button = $config;
                if (is_string($name) && !$button->name) {
                    $button->name($name);
                }
            }
            else {
                $button = new ToolbarButton(['name' => $name] + (array) $config);
            }

            $this->allButtons[$button->name] = $button;
        }
    }

    /**
     * removeButton programmatically by its name.
     */
    public function removeButton(string $name): void
    {
        $this->defineToolbarButtons();

        unset($this->allButtons[$name]);
    }

    /**
     * getButton returns a defined button by its name.
     */
    public function getButton(string $name): ?ToolbarButton
    {
        $this->defineToolbarButtons();

        return $this->allButtons[$name] ?? null;
    }

    /**
     * getButtons returns the visible button definitions.
     * @return ToolbarButton[]
     */
    public function getButtons(): array
    {
        $this->defineToolbarButtons();

        return array_filter($this->allButtons, [$this, 'isButtonVisible']);
    }

    /**
     * isButtonVisible checks the button's gate abilities and resolves a `visible` config
     * value given as a host controller method name.
     */
    protected function isButtonVisible(ToolbarButton $button): bool
    {
        if ($button->permissions && !Gate::any((array) $button->permissions)) {
            return false;
        }

        $visible = $button->visible;

        if (is_string($visible)) {
            if (!$this->controller || !method_exists($this->controller, $visible)) {
                throw new SystemException("The visible method [{$visible}] for toolbar button [{$button->name}] is not found on the controller.");
            }

            return (bool) $this->controller->{$visible}($button);
        }

        return $visible !== false;
    }
}
