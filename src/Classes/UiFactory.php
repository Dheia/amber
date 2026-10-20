<?php namespace Larajax\Ui\Classes;

use Larajax\Ui\Helpers\DateTime as DateTimeHelper;

/**
 * UiFactory creates view-based UI components.
 *
 * Usage:
 *
 *     <?= UiFactory::button(label: 'Save', primary: true) ?>
 *
 *     <?php UiFactory::card(title: 'Settings')->slot() ?>
 *         <p>Content</p>
 *     <?php UiFactory::end() ?>
 *
 * @package larajax\ui
 * @author Alexey Bobkov, Samuel Georges
 */
class UiFactory
{
    use \Larajax\Ui\Classes\UiFactory\HasInputs;
    use \Larajax\Ui\Classes\UiFactory\HasButtons;

    /**
     * iconClass resolves a semantic icon key to CSS classes.
     */
    public static function iconClass(string $icon, ?string $pack = null): string
    {
        return app(IconManager::class)->iconClass($icon, $pack);
    }

    /**
     * icon renders an icon element from a semantic icon key.
     */
    public static function icon(string $icon, array $attributes = [], ?string $pack = null): string
    {
        return app(IconManager::class)->icon($icon, $attributes, $pack);
    }

    /**
     * registerIconPack adds or replaces an icon pack at runtime.
     */
    public static function registerIconPack(string $name, mixed $pack): IconManager
    {
        return app(IconManager::class)->registerPack($name, $pack);
    }

    /**
     * extendIcons overlays additional icon definitions at runtime for every pack.
     */
    public static function extendIcons(mixed $extension): IconManager
    {
        return app(IconManager::class)->extend($extension);
    }

    /**
     * resolveTimezoneUsing sets the callback that returns the viewer's timezone, used to display dates stored in the app timezone.
     */
    public static function resolveTimezoneUsing(?callable $resolver): void
    {
        DateTimeHelper::resolveTimezoneUsing($resolver);
    }

    /**
     * timezone returns the viewer's timezone.
     */
    public static function timezone(): string
    {
        return DateTimeHelper::userTimezone();
    }

    /**
     * slot switches to a named slot on the current component
     */
    public static function slot(string $name): void
    {
        ViewComponent::captureSlot($name);
    }

    /**
     * end closes the current component and renders it
     */
    public static function end(): void
    {
        ViewComponent::endComponent();
    }

    /**
     * callout
     */
    public static function callout()
    {
        return new \Larajax\Ui\Classes\UiFactory\Migrate\Callout();
    }
}
