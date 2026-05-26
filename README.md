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

Each widget implements the [Larajax](https://larajax.org/guide/defining-components.html) `ViewComponentInterface`, so AJAX handlers (uploads, validation, partial updates, etc.) are wired in automatically the same way as any other Larajax view component. A widget rendered by Amber behaves like a first-class Larajax component on the page.

## Requirements

- PHP 8.2 or higher
- Laravel 12
- [october/rain](https://github.com/octobercms/library) (used for the underlying database, validation, and HTML helpers)
- [larajax/larajax](https://larajax.org) (provides the View Component interface widgets implement)

## Installation

```bash
composer require october/amber
```

The package registers an `AmberServiceProvider` automatically via Laravel's package discovery.

## Usage

Build a widget inline in your controller action with `Form::make(...)`, then pass it to the view:

```php
public function edit(Request $request, int $id)
{
    $user = User::findOrFail($id);

    $form = Form::make([
        'model' => $user,
        'fields' => '~/resources/amber/user/fields.yaml',
    ]);

    return view('users.edit', ['form' => $form]);
}
```

`Form::make([...])` constructs the widget, binds it to the current controller, and returns it. The widget is a regular PHP object after that - pass it to the view, store it in a variable, do whatever you would do with any other object. AJAX handlers defined on the widget (file uploads, inline validation, partial reloads, etc.) are wired up automatically through Larajax - no extra glue code in your action.

Render the widget in a Blade view:

```blade
{!! $form->render() !!}
```

### How AJAX dispatch works

When the page makes an AJAX request to the same controller, Larajax runs your action body once to rebuild the widget bindings, then dispatches the AJAX handler against them. The action's return value (the view) is discarded on the AJAX pass - only the binding side effect matters. From your perspective, the widget you built in `edit()` is the same widget the AJAX handler operates on.

Note that `view(...)` is **lazy** - it returns a `View` object but does not render any HTML. Blade only compiles the template when the View is converted into a HTTP response. On the AJAX pass, the View is discarded before that ever happens, so calling `view(...)` in your action costs essentially nothing on AJAX requests; only the work you did *before* the return statement (model lookup, `Form::make`, etc.) actually runs.

If your action does work that should *not* run on AJAX requests (mutations, mailers, expensive lookups), guard with Laravel's standard `request()->ajax()`:

```php
public function edit(Request $request, int $id)
{
    $user = User::findOrFail($id);

    $form = Form::make([
        'model' => $user,
        'fields' => '~/resources/amber/user/fields.yaml',
    ]);

    if (!request()->ajax()) {
        // Do expensive thing
    }

    return view('users.edit', ['form' => $form]);
}
```

### Where `Form::make` resolves the controller

`Form::make` reads the current Larajax controller from the container - the same way `request()` reads the current request or `auth()` reads the current auth manager. Larajax binds this during `callAction`, so `Form::make` works in any controller action that runs through `LarajaxController`. From a non-controller context (a job, a console command), pass the host explicitly with `Form::createIn($host, [...])->bindToController()` instead.

## Included Widgets

- **Form** - YAML or array-driven form builder with field widgets (text, dropdown, repeater, file upload, etc.)
- **Lists** - sortable, paginated record lists with column types and row actions
- **ListStructure** - tree and reorderable list variants
- **Filter** - scope-based filtering for list views
- **Toolbar** - action buttons and search bar
