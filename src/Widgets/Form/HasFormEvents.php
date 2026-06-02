<?php namespace October\Amber\Widgets\Form;

use stdClass;
use October\Rain\Element\ElementHolder;

/**
 * HasFormEvents declares the form's extension points as overridable methods.
 *
 * Amber consumers extend the form by subclassing and overriding these methods.
 * October's backend form subclass overrides them to additionally fire global
 * events (e.g. `backend.form.extendFields`) for plugin-based extensibility.
 */
trait HasFormEvents
{
    /**
     * eventExtendFieldsBefore is called before the form fields are defined,
     * giving subclasses an opportunity to register additional fields prior
     * to configuration parsing.
     */
    protected function eventExtendFieldsBefore(): void
    {
    }

    /**
     * eventExtendFields is called after all form fields have been defined,
     * giving subclasses an opportunity to add, modify, or remove fields.
     */
    protected function eventExtendFields(ElementHolder $fields): void
    {
    }

    /**
     * eventBeforeRefresh is called before the form is refreshed. Subclasses
     * may mutate the $dataHolder->data property in place to alter the data
     * used to populate field values.
     */
    protected function eventBeforeRefresh(stdClass $dataHolder): void
    {
    }

    /**
     * eventRefreshFields is called when the form is refreshed, giving subclasses
     * the opportunity to modify the form fields prior to rendering.
     */
    protected function eventRefreshFields(array $fields): void
    {
    }

    /**
     * eventRefresh is called after the form is refreshed. Subclasses may
     * return an augmented result array to add or replace AJAX partial output.
     */
    protected function eventRefresh(array $result): array
    {
        return $result;
    }
}
