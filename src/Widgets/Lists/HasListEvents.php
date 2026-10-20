<?php namespace Larajax\Ui\Widgets\Lists;

/**
 * HasListEvents declares the list's extension points as overridable methods backed by
 * widget-local events, so a subclass can override them or callers can use bindEvent().
 */
trait HasListEvents
{
    /**
     * eventExtendColumns is called after the list columns are defined, giving
     * subclasses an opportunity to add, modify or remove columns.
     */
    protected function eventExtendColumns(): void
    {
        $this->fireEvent('list.extendColumns');
    }

    /**
     * eventExtendQueryBefore is called before the list widget applies its scopes
     * to the record query.
     */
    protected function eventExtendQueryBefore($query): void
    {
        $this->fireEvent('list.extendQueryBefore', [$query]);
    }

    /**
     * eventExtendSearchQuery is called inside the search constraint grouping,
     * allowing extra search conditions.
     */
    protected function eventExtendSearchQuery($query): void
    {
        $this->fireEvent('list.extendSearchQuery', [$query]);
    }

    /**
     * eventExtendSortColumn is called after sorting is applied to the query.
     */
    protected function eventExtendSortColumn($query, string $sortColumn, string $sortDirection): void
    {
        $this->fireEvent('list.extendSortColumn', [$query, $sortColumn, $sortDirection]);
    }

    /**
     * eventExtendQuery is called after the list widget has applied its scopes.
     * Subclasses may return a replacement query object.
     */
    protected function eventExtendQuery($query)
    {
        if (!$this->hasListEventListeners('list.extendQuery')) {
            return null;
        }

        return $this->fireEvent('list.extendQuery', [&$query], true) ?? $query;
    }

    /**
     * eventExtendRecords is called before the widget uses the records collection.
     * Subclasses may return a replacement collection.
     */
    protected function eventExtendRecords($records)
    {
        if (!$this->hasListEventListeners('list.extendRecords')) {
            return null;
        }

        return $this->fireEvent('list.extendRecords', [&$records], true) ?? $records;
    }

    /**
     * eventRefresh is called after the list is refreshed. Subclasses may
     * return an augmented result array to add or replace AJAX partial output.
     */
    protected function eventRefresh(array $result): array
    {
        $eventResults = $this->fireEvent('list.refresh', [&$result]);

        foreach ($eventResults as $eventResult) {
            if (!is_array($eventResult)) {
                continue;
            }

            $result = $eventResult + $result;
        }

        return $result;
    }

    /**
     * eventOverrideRecordAction may return a replacement record action. Return a
     * string to replace the URL, or an array with `url`, `onclick` or `clickable`
     * keys to override each aspect.
     */
    protected function eventOverrideRecordAction($record, $url, $onClick)
    {
        return $this->fireEvent('list.overrideRecordAction', [$record, $url, $onClick], true);
    }

    /**
     * eventOverrideHeaderValue may return a replacement column header value.
     */
    protected function eventOverrideHeaderValue($column, $value)
    {
        if (!$this->hasListEventListeners('list.overrideHeaderValue')) {
            return null;
        }

        return $this->fireEvent('list.overrideHeaderValue', [$column, &$value], true) ?? $value;
    }

    /**
     * eventOverrideColumnValueRaw may return a replacement raw column value.
     */
    protected function eventOverrideColumnValueRaw($record, $column, $value)
    {
        if (!$this->hasListEventListeners('list.overrideColumnValueRaw')) {
            return null;
        }

        return $this->fireEvent('list.overrideColumnValueRaw', [$record, $column, &$value], true) ?? $value;
    }

    /**
     * eventOverrideColumnValue may return a replacement column value.
     */
    protected function eventOverrideColumnValue($record, $column, $value)
    {
        if (!$this->hasListEventListeners('list.overrideColumnValue')) {
            return null;
        }

        return $this->fireEvent('list.overrideColumnValue', [$record, $column, &$value], true) ?? $value;
    }

    /**
     * eventInjectRowClass may return a custom CSS class string for a record row.
     */
    protected function eventInjectRowClass($record, $value)
    {
        if (!$this->hasListEventListeners('list.injectRowClass')) {
            return null;
        }

        return $this->fireEvent('list.injectRowClass', [$record, &$value], true) ?? $value;
    }

    /**
     * hasListEventListeners checks if the widget has callbacks for a local event.
     */
    protected function hasListEventListeners(string $event): bool
    {
        return isset($this->emitterEventCollection[$event]) || isset($this->emitterSingleEventCollection[$event]);
    }
}
