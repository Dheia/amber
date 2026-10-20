/*
 * Repeater form widget (Accordion mode)
 *
 * Data attributes:
 * - data-control="repeateraccordion" - enables the control on an element
 */
'use strict';

import { createRepeaterFormWidgetBase } from './repeater.js';

export function registerRepeaterAccordion(jax) {
    class RepeaterFormWidgetAccordion extends createRepeaterFormWidgetBase(jax) {
        init() {
            // Overrides
            this.selectorToolbar = ':scope > .field-repeater-toolbar';
            this.selectorChecked = ':scope > .field-repeater-items > .field-repeater-item > .repeater-header input[type=checkbox]:checked';
            super.init();
        }

        connect() {
            super.connect();

            // Next tick to let other controls initialize
            setTimeout(() => {
                this.applyExpandedItems();
            }, 0);
        }

        onElementClick(ev) {
            const expand = ev.target.closest('[data-repeater-expand]'),
                collapse = ev.target.closest('[data-repeater-collapse]');

            if ((expand && this.ownsElement(expand)) || (collapse && this.ownsElement(collapse))) {
                this.toggleCollapse(ev);
                return;
            }

            const header = ev.target.closest('.repeater-header');
            if (header && this.ownsElement(header) && this.clickItemHeader(ev)) {
                return;
            }

            super.onElementClick(ev);
        }

        clickItemHeader(ev) {
            const target = ev.target;
            if (
                !target.classList.contains('repeater-header') &&
                !target.classList.contains('repeater-item-title') &&
                !target.classList.contains('repeater-item-checkbox')
            ) {
                return false;
            }

            const item = target.closest('.field-repeater-item'),
                isCollapsed = item.classList.contains('collapsed');

            if (!this.config.itemsExpanded) {
                this.collapseAll();
            }

            isCollapsed ? this.expand(item) : this.collapse(item);

            return true;
        }

        applyExpandedItems() {
            if (this.config.itemsExpanded || !this.itemContainer) {
                return;
            }

            this.itemContainer.querySelectorAll(':scope > .field-repeater-item').forEach((item) => {
                this.collapse(item);
            });
        }

        toggleCollapse(ev) {
            const item = ev.target.closest('.field-repeater-item'),
                isCollapsed = item.classList.contains('collapsed');

            ev.preventDefault();

            this.getCheckedItemsOrItem(item).forEach((el) => {
                isCollapsed ? this.expand(el) : this.collapse(el);
            });
        }

        collapseAll() {
            this.itemContainer.querySelectorAll(':scope > .field-repeater-item').forEach((item) => {
                this.collapse(item);
            });
        }

        expandAll() {
            this.itemContainer.querySelectorAll(':scope > .field-repeater-item').forEach((item) => {
                this.expand(item);
            });
        }

        collapse(item) {
            item.classList.add('collapsed');

            const title = item.querySelector(':scope > .repeater-header > .repeater-item-title');
            if (title) {
                title.textContent = this.getCollapseTitle(item);
            }
        }

        expand(item) {
            item.classList.remove('collapsed');
        }

        //
        // Event Overrides
        //

        eventOnAddItem() {
            if (!this.config.itemsExpanded) {
                this.collapseAll();
            }
        }

        eventOnDuplicateItem(fromItem) {
            this.eventOnAddItem();
        }

        eventMenuFilter(item, list) {
            const toggleRow = (selector, visible) => {
                const link = list.querySelector(selector);
                if (link) {
                    link.closest('li').style.display = visible ? '' : 'none';
                }
            };

            const toggleDisabled = (selector, disabled) => {
                const link = list.querySelector(selector);
                if (link) {
                    link.closest('li').classList.toggle('disabled', disabled);
                }
            };

            // Hide/show duplicate button
            toggleDisabled('[data-repeater-duplicate]', !this.canAdd);

            // Hide/show remove button
            toggleDisabled('[data-repeater-remove]', !this.canRemove);

            // Hide/show up/down
            toggleRow('[data-repeater-move-up]', !!item.previousElementSibling);
            toggleRow('[data-repeater-move-down]', !!item.nextElementSibling);

            // Hide/show expand/collapse
            toggleRow('[data-repeater-expand]', item.classList.contains('collapsed'));
            toggleRow('[data-repeater-collapse]', !item.classList.contains('collapsed'));
        }
    }

    jax.registerControl('repeateraccordion', RepeaterFormWidgetAccordion);
}
