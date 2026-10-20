<?php namespace Larajax\Ui\Widgets\Filter;

/**
 * HasFilterEvents declares the filter's extension points as methods that a subclass
 * overrides to extend the filter or fire its own events.
 */
trait HasFilterEvents
{
    /**
     * eventExtendScopesBefore is called before the filter scopes are defined.
     */
    protected function eventExtendScopesBefore(): void
    {
    }

    /**
     * eventExtendScopes is called after the filter scopes have been initialized,
     * giving subclasses an opportunity to add, modify or remove scopes.
     */
    protected function eventExtendScopes(): void
    {
    }

    /**
     * eventOverrideHeaderValue may return a replacement scope header value.
     */
    protected function eventOverrideHeaderValue($scope, $value)
    {
        return null;
    }

    /**
     * eventUpdate is called after a scope update, giving subclasses the
     * opportunity to add or replace AJAX partial output in the result.
     */
    protected function eventUpdate(array $result, array $params): array
    {
        return $result;
    }

    /**
     * eventExtendQuery is called when a scope builds its list of options,
     * allowing the option query to be extended.
     */
    protected function eventExtendQuery($query, $scope): void
    {
    }
}
