<?php namespace Larajax\Ui\Widgets;

use Illuminate\Support\Facades\Gate;
use ApplicationException;
use ForbiddenException;

/**
 * ListStructure
 *
 * @package larajax\ui
 * @author Alexey Bobkov, Samuel Georges
 */
class ListStructure extends Lists
{
    /**
     * @var bool useStructure display parent/child relationships in the list.
     */
    public $useStructure = true;

    /**
     * @var bool showTree will display the tree structure
     */
    public $showTree = true;

    /**
     * @var bool treeExpanded will expand the tree nodes by default.
     */
    public $treeExpanded = true;

    /**
     * @var bool showReorder allows the user to reorder the records.
     */
    public $showReorder = true;

    /**
     * @var bool includeSortOrders specifies if "sort_orders" should be included in postback.
     */
    public $includeSortOrders = false;

    /**
     * @var string sortOrderColumn column used to apply default structure ordering.
     */
    public $sortOrderColumn = 'sort_order';

    /**
     * @var bool includeReferencePool should be used when sorting within subset of records.
     * For example, sorting with pagination.
     */
    public $includeReferencePool = false;

    /**
     * @var int|null maxDepth defines the maximum levels allowed for reordering.
     */
    public $maxDepth = null;

    /**
     * @var bool dragRow allows dragging the entire row in addition to the reorder handle.
     */
    public $dragRow = true;

    /**
     * @var array permissions needed to modify the structure.
     */
    protected $permissions;

    /**
     * make the list structure widget from named arguments; repeats the parent
     * list parameters and adds the structure options.
     *
     * @param \Illuminate\Database\Eloquent\Model|null $model
     * @param array|string|null $columns definitions array or YAML file path
     * @param int|null $recordsPerPage
     * @param bool|null $showCheckboxes
     * @param string|null $recordUrl link for each record, `:id` substitutes the key
     * @param string|null $recordOnClick JavaScript for the record click
     * @param string|null $noRecordsMessage
     * @param array|string|null $defaultSort
     * @param bool|null $showSetup
     * @param bool|string|null $showPagination
     * @param string|null $alias
     * @param bool|null $showTree
     * @param bool|null $showReorder
     * @param int|null $maxDepth
     * @param bool|null $treeExpanded
     */
    public static function make(
        $model = null,
        $columns = null,
        $recordsPerPage = null,
        $showCheckboxes = null,
        $recordUrl = null,
        $recordOnClick = null,
        $noRecordsMessage = null,
        $defaultSort = null,
        $showSetup = null,
        $showPagination = null,
        $alias = null,
        $showTree = null,
        $showReorder = null,
        $maxDepth = null,
        $treeExpanded = null,
        ...$config
    ): static {
        return static::makeFromNamedArgs(get_defined_vars(), $config);
    }

    /**
     * init the widget, called by the constructor and free from its parameters.
     */
    public function init()
    {
        // Extend view to include parent
        $this->addViewPathFrom(Lists::class);

        // Defaults needed for reinit
        $this->useStructure = true;
        $this->showReorder = true;
        $this->showPagination = false;
        $this->showTree = true;

        $this->fillFromConfig([
            'maxDepth',
            'dragRow',
            'showTree',
            'showReorder',
            'treeExpanded',
            'includeSortOrders',
            'includeReferencePool',
            'sortOrderColumn',
            'permissions'
        ]);

        parent::init();

        // Hide tree when sorting
        if ($this->isUserSorting()) {
            $this->disableStructure();
        }

        if ($this->showTree) {
            $this->validateTree();
        }
        else {
            $this->maxDepth = 1;
        }

        // Hide reorder without permission
        if (!$this->hasStructurePermission()) {
            $this->showReorder = false;
        }
    }

    /**
     * prepareVars for display
     */
    public function prepareVars()
    {
        parent::prepareVars();

        // Alter tree status based on record content
        $this->showTree = $this->getIndentTreeStatus($this->records);

        $this->vars['useStructure'] = $this->useStructure;
        $this->vars['maxDepth'] = $this->maxDepth;
        $this->vars['dragRow'] = $this->dragRow;
        $this->vars['showTree'] = $this->showTree;
        $this->vars['showReorder'] = $this->showReorder;
        $this->vars['includeSortOrders'] = $this->useSortOrdering();
        $this->vars['treeLevel'] = 0;
        $this->vars['indentSize'] = $this->getIndentSize();
    }

    /**
     * disableStructure toggles the settings to completely disable the structure
     */
    protected function disableStructure()
    {
        $this->useStructure = false;
        $this->showReorder = false;
        $this->showPagination = true;
        $this->showTree = false;
    }

    /**
     * enableStructure reverts disableStructure
     */
    protected function enableStructure()
    {
        $this->sortColumn = null;
        $this->putSession('sort', null);
        $this->putSession('show_structure', true);
        $this->init();
    }

    /**
     * onSort AJAX handler for sorting the list.
     */
    public function onSort()
    {
        $column = post('sortColumn');
        if (!$column) {
            return;
        }

        // Spool up cache
        $this->getSortColumn();

        // Detect third click
        $isSameColumn = $column === $this->getSortColumn();
        $isFinalStep = $this->getSortStep() >= 2;
        $isSearchEmpty = empty($this->searchTerm);

        // Reset the list state and cache
        if ($isSameColumn && $isFinalStep && $isSearchEmpty) {
            $this->enableStructure();
            return $this->onRefresh();
        }

        // Disable structure when sorting
        $this->putSession('show_structure', null);
        $this->disableStructure();

        return parent::onSort();
    }

    /**
     * onShowStructure
     */
    public function onShowStructure()
    {
        $this->enableStructure();
        return $this->onRefresh();
    }

    /**
     * useSorting
     */
    protected function useSorting(): bool
    {
        return !$this->useStructure;
    }

    /**
     * isUserSorting returns true when the user has chosen a sort column, or when
     * a default sort is configured and the user has not explicitly opened the
     * structure view.
     */
    public function isUserSorting(): bool
    {
        if (parent::isUserSorting()) {
            return true;
        }

        return !$this->getSession('show_structure', empty($this->defaultSort));
    }

    /**
     * setSearchTerm will disable the structure if a value is supplied.
     */
    public function setSearchTerm($term, $resetState = false)
    {
        if (!empty($term)) {
            $this->disableStructure();
        }
        elseif ($resetState) {
            $this->enableStructure();
        }

        parent::setSearchTerm($term, $resetState);
    }

    /**
     * prepareQuery applies structure ordering when no explicit sort is active.
     */
    public function prepareQuery()
    {
        $query = parent::prepareQuery();

        if ($this->shouldApplySortOrderColumn()) {
            $query->orderBy($this->sortOrderColumn);
        }

        return $query;
    }

    /**
     * shouldApplySortOrderColumn checks if the default structure sort should be applied.
     */
    protected function shouldApplySortOrderColumn(): bool
    {
        if (!$this->sortOrderColumn || !$this->useSortOrdering()) {
            return false;
        }

        if ($this->useStructure && $this->showTree) {
            return false;
        }

        return !$this->getSortColumn();
    }

    /**
     * getRecords returns all the records from the supplied model, after filtering
     * @return Collection
     */
    protected function getRecords()
    {
        if (!$this->useStructure || !$this->showTree) {
            return parent::getRecords();
        }

        // Find records
        $records = $this->prepareQuery()->getNested();

        // Extensibility from parent
        if ($event = $this->eventExtendRecords($records)) {
            $records = $event;
        }

        return $this->records = $records;
    }

    /**
     * getTotalColumns calculates the total columns used in the list, including checkboxes
     * and other additions.
     */
    protected function getTotalColumns()
    {
        $total = parent::getTotalColumns();

        if ($this->showReorder) {
            $total++;
        }

        return $total;
    }

    /**
     * getIndentSize returns the size increment of indentation
     */
    protected function getIndentSize(): int
    {
        return 18;
    }

    /**
     * getIndentStartSize is used to pad each row based on its tree level
     */
    protected function getIndentStartSize(int $treeLevel): int
    {
        return ($treeLevel * $this->getIndentSize()) +
            ($this->showTree ? 15 : 0) +
            ($this->showReorder ? 0 : 15);
    }

    /**
     * getIndentTreeStatus checks if the collapse UI should be shown
     * based on if any records have children.
     */
    protected function getIndentTreeStatus($records): bool
    {
        if (!$this->showTree) {
            return false;
        }

        foreach ($records as $record) {
            if ($record->getChildCount()) {
                return true;
            }
        }

        return false;
    }

    /**
     * validateTree validates the model and settings if useStructure is used
     */
    public function validateTree()
    {
        if (!$this->modelIsInstanceOf(\October\Contracts\Database\TreeInterface::class)) {
            $modelClass = get_class($this->model);
            throw new ApplicationException(
                "To display list as a tree, the model {$modelClass} must implement methods found in October\Contracts\Database\TreeInterface, or set showTree to false"
            );
        }
    }

    /**
     * useSortOrdering
     */
    public function useSortOrdering(): bool
    {
        return $this->includeSortOrders || $this->modelIsInstanceOf(\October\Contracts\Database\SortableInterface::class);
    }

    /**
     * onReorder
     */
    public function onReorder()
    {
        if (!$this->hasStructurePermission()) {
            throw new ForbiddenException;
        }

        $itemId = post('record_id');
        if (!$itemId) {
            return;
        }

        $item = $this->model->newQueryWithoutScopes()->find($itemId);
        if (!$item) {
            return;
        }

        if ($this->eventBeforeReorderStructure($item) === false) {
            return $this->onRefresh();
        }

        $this->reorderForItem($item);

        $this->eventReorderStructure($item);

        return $this->onRefresh();
    }

    /**
     * reorderForItem applies generic reordering logic
     */
    protected function reorderForItem($item, $multisite = false)
    {
        // Nested Tree
        if ($this->modelIsInstanceOf(\October\Contracts\Database\NestedSetInterface::class)) {
            if ($prevId = post($multisite ? 'previous_root_id' : 'previous_id')) {
                $item->moveAfter($prevId);
            }
            elseif ($nextId = post($multisite ? 'next_root_id' : 'next_id')) {
                $item->moveBefore($nextId);
            }
            elseif ($parentId = post($multisite ? 'parent_root_id' : 'parent_id')) {
                $item->makeChildOf($parentId);
            }
        }
        else {
            // Simple Tree
            if (app('model.inspector')->hasRelation($this->model, 'parent')) {
                $item->parent = post($multisite ? 'parent_root_id' : 'parent_id');
                $item->save(['force' => true]);
            }

            // Sortable
            if ($this->modelIsInstanceOf(\October\Contracts\Database\SortableInterface::class)) {
                $item->setSortableOrder(
                    post($multisite ? 'root_sort_orders' : 'sort_orders'),
                    $this->includeReferencePool ? null : true
                );
            }
        }
    }

    /**
     * onToggleTreeNode sets a node (model) to an expanded or collapsed state, stored in the
     * session, then renders the list again.
     */
    public function onToggleTreeNode()
    {
        $this->putSession('tree_node_status_' . post('node_id'), post('status') ? 0 : 1);

        return $this->onRefresh();
    }

    /**
     * isTreeNodeExpanded checks if a node (model) is expanded in the session.
     * @param  Model $node
     * @return bool
     */
    public function isTreeNodeExpanded($node)
    {
        return $this->getSession('tree_node_status_' . $node->getKey(), $this->treeExpanded);
    }

    /**
     * hasStructurePermission checks if the user has permissions to modify the structure.
     */
    protected function hasStructurePermission(): bool
    {
        if (!$this->permissions) {
            return true;
        }

        return Gate::any((array) $this->permissions);
    }

    /**
     * eventBeforeReorderStructure is called before a record is restructured.
     * Subclasses may return false to halt the reorder.
     */
    protected function eventBeforeReorderStructure($item)
    {
        return $this->fireEvent('list.beforeReorderStructure', [$item], true);
    }

    /**
     * eventReorderStructure is called after a record has been restructured.
     */
    protected function eventReorderStructure($item): void
    {
        $this->fireEvent('list.reorderStructure', [$item]);
    }

    /**
     * modelIsInstanceOf checks the model against a class or interface, supporting
     * both October Rain models (isClassInstanceOf includes behaviors) and plain
     * Eloquent models (native instanceof).
     */
    protected function modelIsInstanceOf(string $class): bool
    {
        if (method_exists($this->model, 'isClassInstanceOf')) {
            return $this->model->isClassInstanceOf($class);
        }

        return $this->model instanceof $class;
    }
}
