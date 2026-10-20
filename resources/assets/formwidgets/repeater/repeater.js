/*
 * Repeater form widget base class
 */
'use strict';

import { Popover } from '../../controls/popover/popover.js';

// One base class per framework instance, so subclasses extend the injected ControlBase
const baseClasses = new WeakMap();

export function createRepeaterFormWidgetBase(jax) {
    if (baseClasses.has(jax)) {
        return baseClasses.get(jax);
    }

    class RepeaterFormWidgetBase extends jax.ControlBase {
        init() {
            this.itemCount = 0;
            this.canAdd = true;
            this.canRemove = true;
            this.toolbarBusy = false;
            this.dragState = null;
            this.initDefaults();
        }

        initDefaults() {
            const defaults = {
                useReorder: true,
                sortableHandle: '.repeater-item-handle',
                addHandler: 'onAddItem',
                removeHandler: 'onRemoveItem',
                useDuplicate: true,
                duplicateHandler: 'onDuplicateItem',
                removeConfirm: 'Are you sure?',
                itemsExpanded: true,
                titleFrom: null,
                minItems: null,
                maxItems: null
            };

            // Only missing attributes take the default; an empty attribute is PHP's false
            for (const key in defaults) {
                if (this.config[key] === undefined) {
                    this.config[key] = defaults[key];
                }
            }
        }

        connect() {
            this.itemContainer = this.element.querySelector(':scope > .field-repeater-items');
            this.toolbar = this.element.querySelector(this.selectorToolbar);

            // Items
            this.listen('change', this.onElementChange);
            this.listen('click', this.onElementClick);
            this.listen('show.bs.dropdown', this.onShowItemMenu);

            // Toolbar add button posts through its own data-request attribute
            this.listen('ajax:done', this.onAjaxDone);

            if (this.config.useReorder) {
                this.onPointerMove = this.onPointerMove.bind(this);
                this.onPointerUp = this.onPointerUp.bind(this);
                this.listen('pointerdown', this.onPointerDown);
            }

            this.countItems();
            this.togglePrompt();
        }

        disconnect() {
            this.cancelDrag();
            this.itemContainer = null;
            this.toolbar = null;
        }

        //
        // Delegated events
        //

        onElementClick(ev) {
            const commands = [
                ['[data-repeater-move-up]', this.clickMoveItemUp],
                ['[data-repeater-move-down]', this.clickMoveItemDown],
                ['[data-repeater-remove]', this.clickRemoveItem],
                ['[data-repeater-duplicate]', this.clickDuplicateItem],
                ['[data-repeater-cmd=add-group]', this.clickAddGroupButton],
                ['[data-repeater-cmd=add]', this.onAddItemButton]
            ];

            for (const [selector, handler] of commands) {
                const target = ev.target.closest(selector);
                if (target && this.ownsElement(target)) {
                    handler.call(this, ev, target);
                    return;
                }
            }
        }

        onElementChange(ev) {
            if (ev.target.matches('.repeater-header input[type=checkbox]') && this.ownsElement(ev.target)) {
                this.clickItemCheckbox(ev);
            }
        }

        onAjaxDone(ev) {
            if (ev.target.matches('[data-repeater-cmd=add]') && this.ownsElement(ev.target)) {
                this.onAddItemSuccess(ev);
            }
        }

        // ownsElement checks containment against this repeater, so nested
        // repeaters never respond to each other's elements
        ownsElement(el) {
            return el.closest('.field-repeater') === this.element;
        }

        //
        // Items
        //

        clickItemCheckbox(ev) {
            const item = ev.target.closest('li');

            item.classList.toggle('is-checked', ev.target.checked);
        }

        onShowItemMenu(ev) {
            const target = ev.target.closest('.repeater-item-dropdown');
            if (!target || !this.ownsElement(target)) {
                return;
            }

            const template = this.element.querySelector(':scope > [data-item-menu-template]'),
                item = target.closest('li'),
                dropdownList = target.querySelector('.dropdown-menu');

            dropdownList.innerHTML = template.innerHTML;

            this.eventMenuFilter(item, dropdownList);

            if (this.toolbarBusy) {
                dropdownList.querySelectorAll('li').forEach((li) => li.classList.add('disabled'));
            }
        }

        clickRemoveItem(ev, target) {
            // Button is disabled
            if (target.closest('li.disabled')) {
                return;
            }

            this.onRemoveItem(this.findItemFromTarget(target));
        }

        onRemoveItem(item) {
            const items = this.getCheckedItemsOrItem(item);

            const itemData = items.map((el) => ({
                repeater_index: el.dataset.repeaterIndex,
                repeater_group: el.dataset.repeaterGroup
            }));

            jax.request(this.element, this.config.removeHandler, {
                data: {
                    _repeater_items: itemData
                },
                confirm: this.config.removeConfirm,
                afterUpdate: () => {
                    this.onRemoveItemSuccess(items);
                }
            });
        }

        onRemoveItemSuccess(items) {
            items.forEach((item) => {
                item.remove();

                this.eventOnRemoveItem(item);

                this.countItems();
                this.triggerChange();
            });
        }

        clickDuplicateItem(ev, target) {
            // Button is disabled
            if (target.closest('li.disabled')) {
                return;
            }

            this.toolbarBusy = true;

            const item = this.findItemFromTarget(target);
            this.eventOnDuplicateItem(item);
            this.onDuplicateItem(item);
        }

        onDuplicateItem(item) {
            jax.request(this.element, this.config.duplicateHandler, {
                data: {
                    _repeater_index: item.dataset.repeaterIndex,
                    _repeater_group: item.dataset.repeaterGroup
                },
                afterUpdate: (data) => {
                    this.toolbarBusy = false;
                    if (data.result) {
                        this.onDuplicateItemSuccess(item, data.result.duplicateIndex);
                    }
                    else {
                        this.eventOnErrorAddItem();
                    }
                }
            });
        }

        onDuplicateItemSuccess(item, duplicateIndex) {
            const sourceItem = this.findItemFromIndex(item.dataset.repeaterIndex),
                duplicateItem = this.findItemFromIndex(duplicateIndex);

            if (sourceItem && duplicateItem) {
                sourceItem.after(duplicateItem);
            }

            this.countItems();
            this.triggerChange();
            this.eventDuplicateOnEnd();
        }

        clickMoveItemUp(ev, target) {
            const item = this.findItemFromTarget(target),
                prevItem = item.previousElementSibling;

            if (prevItem) {
                prevItem.before(item);
            }

            this.eventSortableOnEnd();
        }

        clickMoveItemDown(ev, target) {
            const item = this.findItemFromTarget(target),
                nextItem = item.nextElementSibling;

            if (nextItem) {
                nextItem.after(item);
            }

            this.eventSortableOnEnd();
        }

        //
        // Add items
        //

        onAddItemButton(ev) {
            this.eventOnAddItem();
        }

        onAddItemSuccess(ev) {
            this.itemCount++;
            this.triggerChange();
        }

        clickAddGroupButton(ev, target) {
            // Prevent adding new items until the last one is finished
            if (target.classList.contains('jax-loading') || target.classList.contains('oc-loading')) {
                return;
            }

            const template = this.element.querySelector(':scope > [data-group-palette-template]');

            const popover = new Popover(target, {
                extraClass: 'repeater-palette-popover',
                content: template.innerHTML
            });

            popover.show();

            this.addGroupButton = target;

            // The popover mounts outside this element, so its clicks are routed here
            popover.element.addEventListener('click', (ev) => {
                const addLink = ev.target.closest('[data-repeater-add]');
                if (addLink) {
                    this.clickPaletteAddItem(ev, addLink);
                }
                else if (ev.target.closest('[data-dismiss=popover]')) {
                    popover.hide();
                }
            });

            this.palettePopover = popover;
        }

        clickPaletteAddItem(ev, target) {
            // The request fires from the repeater element to inherit the parent form data
            if (this.palettePopover) {
                this.palettePopover.hide();
                this.palettePopover = null;
            }

            this.eventOnAddItem();

            // ajax:promise fires synchronously only when the request is actually sent
            let isSent = false;
            const onSent = (ev) => {
                isSent = isSent || ev.target === this.element;
            };

            this.element.addEventListener('ajax:promise', onSent);

            const request = jax.request(this.element, this.config.addHandler, {
                data: {
                    _repeater_group: target.dataset.repeaterAddGroup
                },
                afterUpdate: () => {
                    this.itemCount++;
                    this.triggerChange();
                }
            });

            this.element.removeEventListener('ajax:promise', onSent);

            // Prevent adding new items until the last one is finished
            const addButton = this.addGroupButton;
            if (isSent && addButton) {
                addButton.classList.add('oc-loading');
                request.finally(() => addButton.classList.remove('oc-loading')).catch(() => {});
            }
        }

        //
        // State
        //

        triggerChange() {
            this.togglePrompt();

            // Notify the change monitor and any field watchers
            this.element.dispatchEvent(new Event('change', { bubbles: true }));

            // Event
            this.eventOnChange();
        }

        togglePrompt() {
            if (this.config.minItems && this.config.minItems > 0) {
                this.canRemove = this.itemCount > this.config.minItems;
            }

            if (this.config.maxItems && this.config.maxItems > 0) {
                this.canAdd = this.itemCount < this.config.maxItems;
            }

            if (this.toolbar) {
                this.toolbar.style.display = this.canAdd ? '' : 'none';
            }

            const pointerInput = this.element.querySelector(':scope > [data-repeater-pointer-input]');
            if (pointerInput) {
                pointerInput.disabled = !!this.itemCount;
            }
        }

        getCollapseTitle(item) {
            let target = item;
            const titleFromAttr = this.getTitleFromAttribute(item),
                defaultText = this.config.defaultTitle || '',
                explicitText = item.dataset.itemTitle;

            let foundTitleFrom = false;

            // Group mode supplies explicit text
            if (explicitText && !titleFromAttr) {
                return explicitText;
            }

            // A specific title from attribute was provided
            if (titleFromAttr) {
                const titleFrom = item.querySelector('[data-field-name="' + titleFromAttr + '"]');
                if (titleFrom) {
                    target = titleFrom;
                    foundTitleFrom = true;
                }
            }

            // The title from attribute was not found
            if (explicitText && !foundTitleFrom) {
                return explicitText;
            }

            // Find anything within the target
            let result = '';
            const textInput = target.querySelector('input[type=text], select, textarea');

            if (textInput) {
                if (textInput.matches('select')) {
                    const option = textInput.options[textInput.selectedIndex];
                    result = option ? option.text : '';
                }
                else if (textInput.matches('textarea')) {
                    // Strip tags using an inert document so no markup is executed
                    result = (new DOMParser().parseFromString(String(textInput.value), 'text/html').body.textContent || '').substring(0, 255);
                }
                else {
                    result = textInput.value;
                }
            }
            else {
                // Look for an element with class 'form-control'
                const spanTextInput = target.querySelector('.form-control');
                if (spanTextInput) {
                    result = spanTextInput.textContent;
                }
            }

            return result ? result : (explicitText || defaultText);
        }

        getTitleFromAttribute(item) {
            if (this.config.titleFrom) {
                return this.config.titleFrom;
            }

            return item.dataset.titleFrom || null;
        }

        findItemFromIndex(itemIndex) {
            return this.itemContainer.querySelector(':scope > li[data-repeater-index="' + itemIndex + '"]');
        }

        findItemFromTarget(target) {
            return target.closest('.repeater-header').closest('li');
        }

        getCheckedItemsOrItem(item) {
            const items = this.getCheckedItems();

            if (!items.length) {
                return [item];
            }

            return items;
        }

        getCheckedItems() {
            return Array.from(this.element.querySelectorAll(this.selectorChecked))
                .map((checkbox) => checkbox.closest('li'));
        }

        countItems() {
            this.itemCount = this.itemContainer
                ? this.itemContainer.querySelectorAll(':scope > .field-repeater-item').length
                : 0;

            this.element.classList.toggle('repeater-empty', this.itemCount === 0);
        }

        //
        // Drag reorder (pointer events)
        //

        onPointerDown(ev) {
            if (ev.button !== 0) {
                return;
            }

            const handle = ev.target.closest(this.config.sortableHandle);
            if (!handle || !this.ownsElement(handle)) {
                return;
            }

            const item = handle.closest('li'),
                container = item.parentElement;

            ev.preventDefault();

            this.dragState = {
                item: item,
                container: container,
                started: false,
                startY: ev.clientY,
                pointerId: ev.pointerId
            };

            addEventListener('pointermove', this.onPointerMove);
            addEventListener('pointerup', this.onPointerUp);
        }

        onPointerMove(ev) {
            const drag = this.dragState;
            if (!drag) {
                return;
            }

            // Drag threshold keeps clicks intact
            if (!drag.started) {
                if (Math.abs(ev.clientY - drag.startY) < 4) {
                    return;
                }
                drag.started = true;
                drag.item.classList.add('repeater-item-dragging');
                document.body.classList.add('repeater-dragging');
            }

            // Find the sibling whose vertical midpoint the pointer has crossed
            const siblings = Array.from(drag.container.children)
                .filter((el) => el !== drag.item);

            let placed = false;
            for (const sibling of siblings) {
                const rect = sibling.getBoundingClientRect();
                if (ev.clientY < rect.top + rect.height / 2) {
                    sibling.before(drag.item);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                drag.container.appendChild(drag.item);
            }
        }

        onPointerUp(ev) {
            const drag = this.dragState;
            const wasSorted = drag && drag.started;

            this.cancelDrag();

            if (wasSorted) {
                this.eventSortableOnEnd();
                this.triggerChange();
            }
        }

        cancelDrag() {
            if (this.dragState) {
                this.dragState.item.classList.remove('repeater-item-dragging');
                document.body.classList.remove('repeater-dragging');
                this.dragState = null;
            }

            removeEventListener('pointermove', this.onPointerMove);
            removeEventListener('pointerup', this.onPointerUp);
        }

        //
        // Event Overrides
        //

        eventSortableOnEnd() {
        }

        eventOnChange() {
        }

        eventOnAddItem() {
        }

        eventOnRemoveItem() {
        }

        eventOnErrorAddItem() {
        }

        eventOnDuplicateItem(fromItem) {
        }

        eventDuplicateOnEnd() {
        }

        eventMenuFilter() {
        }
    }

    baseClasses.set(jax, RepeaterFormWidgetBase);

    return RepeaterFormWidgetBase;
}
