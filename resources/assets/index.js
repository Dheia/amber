/*
 * Larajax UI - explicit registration entry
 *
 * Registers every control and widget against a provided Larajax framework
 * instance without touching globals, so build tools and native ESM consumers
 * can import it statically from the Composer-installed package source:
 *
 *     import { jax } from "larajax";
 *     import { registerUi } from "./vendor/larajax/ui/resources/assets/index.js";
 *
 *     registerUi(jax);
 *     jax.start();
 *
 * Bundler configs may shorten the path with an alias (see the README).
 *
 * Importing this module has no side effects; registration happens only when
 * registerUi() is called, and starting the framework stays with the caller.
 * Repeated calls for the same instance are ignored. One framework instance
 * per page is assumed; document-level listeners bind per registered instance.
 */
'use strict';

// Controls
import { registerLoaderContainer } from './controls/loader-container/loader-container-control.js';
import { registerSearchInput } from './controls/search-input/search-input-control.js';
import { registerCustomSelect } from './controls/custom-select/custom-select-control.js';
import { registerPopover } from './controls/popover/popover.js';
import { registerPopup } from './controls/popup/popup.js';
import { registerTab } from './controls/tab/tab.js';
import { registerDatepicker } from './controls/datepicker/datepicker.js';
import { registerInputPreset } from './controls/input-preset/input-preset.js';
import { registerInputHotkey } from './controls/input-hotkey/hotkey-control.js';
import { registerInputTrigger } from './controls/input-trigger/input-trigger-control.js';
import { registerChangeMonitor } from './controls/change-monitor/change-monitor-control.js';
import { registerDragScroll } from './controls/drag-scroll/drag-scroll-control.js';
import { registerToolbar } from './controls/toolbar/toolbar-control.js';
import { registerRowlink } from './controls/rowlink/rowlink-control.js';
import { registerCheckbox } from './controls/checkbox/checkbox-control.js';
import { registerCheckboxRange } from './controls/checkbox/checkbox-range.js';
import { registerDropdown } from './controls/dropdown/dropdown.js';

// Widgets
import { registerFormWidget } from './widgets/form/form.js';
import { registerListWidget } from './widgets/list/list.js';
import { registerFilterWidget } from './widgets/filter/filter.js';
import { registerListStructureWidget } from './widgets/liststructure/liststructure.js';

// Form widgets
import { registerFileUpload } from './formwidgets/fileupload/fileupload.js';
import { registerRelationQuickCreate } from './formwidgets/relation/relation-quick-create.js';
import { registerRepeaterAccordion } from './formwidgets/repeater/repeater-accordion.js';
import { registerRepeaterBuilder } from './formwidgets/repeater/repeater-builder.js';

// Shared classes for programmatic use
export { Popover } from './controls/popover/popover.js';
export { Popup } from './controls/popup/popup.js';
export { PopupStacker } from './controls/popup/popup-stacker.js';
export { LoadIndicator } from './controls/load-indicator/load-indicator.js';
export { default as DragScroll } from './controls/drag-scroll/drag-scroll.js';

// Framework instances that have completed registration
const registered = new WeakSet();

/**
 * registerUi registers all Larajax UI controls and widgets against the given
 * framework instance, layered: generic controls first, then widgets that
 * build on them.
 */
export function registerUi(jax) {
    if (
        !jax ||
        typeof jax.registerControl !== 'function' ||
        typeof jax.ControlBase !== 'function' ||
        typeof jax.request !== 'function'
    ) {
        throw new Error(
            'Larajax UI requires a Larajax framework instance with the control API ' +
            '(registerControl, ControlBase, request). Pass the `jax` export of the ' +
            'larajax package, or load the framework bundle build - the plain ' +
            'framework.js build does not include the control API.'
        );
    }

    if (registered.has(jax)) {
        return jax;
    }

    // Controls
    registerLoaderContainer(jax);
    registerSearchInput(jax);
    registerCustomSelect(jax);
    registerPopover(jax);
    registerPopup(jax);
    registerTab(jax);
    registerDatepicker(jax);
    registerInputPreset(jax);
    registerInputHotkey(jax);
    registerInputTrigger(jax);
    registerChangeMonitor(jax);
    registerDragScroll(jax);
    registerToolbar(jax);
    registerRowlink(jax);
    registerCheckbox(jax);
    registerCheckboxRange(jax);
    registerDropdown(jax);

    // Widgets
    registerFormWidget(jax);
    registerListWidget(jax);
    registerFilterWidget(jax);
    registerListStructureWidget(jax);

    // Form widgets
    registerFileUpload(jax);
    registerRelationQuickCreate(jax);
    registerRepeaterAccordion(jax);
    registerRepeaterBuilder(jax);

    registered.add(jax);

    return jax;
}
