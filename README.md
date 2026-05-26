October Amber
=======

Form, List and UI tools for Laravel and [October CMS](https://octobercms.com).

Amber is the foundation layer for rendering forms, lists, filters and other backend widgets. It is the same widget engine that powers the October CMS admin panel, packaged as a standalone library so it can be used anywhere. This includes front-end pages, inside October CMS themes/components, or directly from a plain Laravel route/controller.

## What is this?

Amber provides a reusable, YAML-driven widget system for building data-editing interfaces. It is not tied to a specific application shell. Use it to:

- Render forms and lists in a regular Laravel app, outside of any CMS.
- Build the field-rendering pipeline inside October CMS itself.
- Compose admin-style UIs from configuration rather than hand-written markup.

In short, Amber is the wider abstraction that sits below October's backend module; the part that knows how to turn a `fields.yaml` into a working form, or a set of `columns.yaml` into a sortable list.

## Requirements

- PHP 8.2 or higher
- Laravel 12
- [october/rain](https://github.com/octobercms/library) (used for the underlying database, validation, and HTML helpers)

## Installation

```bash
composer require october/amber
```

The package registers an `AmberServiceProvider` automatically via Laravel's package discovery.

## Usage

Use the widgets directly from a Laravel controller:

```php
use October\Amber\Widgets\Form;

public function edit(Request $request, int $id)
{
    $user = User::findOrFail($id);

    $form = Form::createIn($this, [
        'model' => $user,
        'fields' => '~/resources/amber/user/fields.yaml',
    ]);

    return view('users.edit', ['form' => $form]);
}
```

Render in a Blade view:

```blade
{!! $form->render() !!}
```

## Included Widgets

- **Form** - YAML or array-driven form builder with field widgets (text, dropdown, repeater, file upload, etc.)
- **Lists** - sortable, paginated record lists with column types and row actions
- **ListStructure** - tree and reorderable list variants
- **Filter** - scope-based filtering for list views
- **Toolbar** - action buttons and search bar
