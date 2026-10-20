/*
 * Repeater form widget (Builder mode)
 *
 * Data attributes:
 * - data-control="repeaterbuilder" - enables the control on an element
 *
 * The header transfer re-runs after AJAX updates complete.
 */
'use strict';

import { createRepeaterFormWidgetBase } from './repeater.js';

export function registerRepeaterBuilder(jax) {
    class RepeaterFormWidgetBuilder extends createRepeaterFormWidgetBase(jax) {
        init() {
            // Overrides
            this.selectorToolbar = ':scope > .field-repeater-builder > .field-repeater-toolbar';
            this.selectorChecked = ':scope > .field-repeater-builder > .field-repeater-groups > .field-repeater-group > .repeater-header input[type=checkbox]:checked';

            super.init();
        }

        connect() {
            this.sidebar = this.element.querySelector(':scope > .field-repeater-builder > .field-repeater-groups');

            this.onUpdateComplete = this.onUpdateComplete.bind(this);
            addEventListener('ajax:update-complete', this.onUpdateComplete);

            super.connect();

            this.transferBuilderItemHeaders();
            this.selectBuilderItem();
        }

        disconnect() {
            removeEventListener('ajax:update-complete', this.onUpdateComplete);
            this.sidebar = null;

            super.disconnect();
        }

        onUpdateComplete() {
            this.transferBuilderItemHeaders();
        }

        onElementClick(ev) {
            const groupItem = ev.target.closest('.field-repeater-group:not(.is-placeholder)');

            if (groupItem && this.ownsElement(groupItem) && !ev.target.closest('.group-controls')) {
                this.clickBuilderItem(groupItem);
                return;
            }

            super.onElementClick(ev);
        }

        clickBuilderItem(item) {
            this.selectBuilderItem(item.dataset.repeaterIndex);
        }

        selectBuilderItem(itemIndex) {
            if (itemIndex === undefined) {
                const firstItem = this.sidebar.querySelector(':scope > li');
                itemIndex = firstItem ? firstItem.dataset.repeaterIndex : null;
            }

            const select = (container) => {
                container.querySelectorAll(':scope > li.is-selected').forEach((el) => {
                    el.classList.remove('is-selected');
                });

                const item = container.querySelector(':scope > li[data-repeater-index="' + itemIndex + '"]');
                if (item) {
                    item.classList.add('is-selected');
                }
            };

            select(this.sidebar);
            select(this.itemContainer);

            this.setCollapsedTitles();
        }

        setCollapsedTitles() {
            this.itemContainer.querySelectorAll(':scope > .field-repeater-item').forEach((item) => {
                const groupItem = this.sidebar.querySelector(
                    ':scope > li[data-repeater-index="' + item.dataset.repeaterIndex + '"]'
                );

                if (groupItem) {
                    const title = groupItem.querySelector('[data-group-title]');
                    if (title) {
                        title.textContent = this.getCollapseTitle(item);
                    }
                }
            });
        }

        transferBuilderItemHeaders() {
            const template = this.element.querySelector(':scope > [data-group-template]');

            this.itemContainer.querySelectorAll(':scope > .field-repeater-item > .repeater-header').forEach((header) => {
                const item = header.closest('li'),
                    holder = document.createElement('div');

                holder.innerHTML = template.innerHTML.trim();
                const groupItem = holder.firstElementChild;

                this.sidebar.appendChild(groupItem);

                header.classList.add('group-controls');
                groupItem.querySelector('[data-group-controls]').replaceWith(header);

                const image = groupItem.querySelector('[data-group-image] > i');
                if (item.dataset.itemIcon) {
                    image.className = item.dataset.itemIcon;
                }

                groupItem.querySelector('[data-group-title]').textContent = item.dataset.itemTitle || '';
                groupItem.querySelector('[data-group-description]').textContent = item.dataset.itemDescription || '';

                groupItem.setAttribute('data-repeater-index', item.dataset.repeaterIndex);
                groupItem.setAttribute('data-repeater-group', item.dataset.repeaterGroup || '');

                // Remove last loader if there is one
                const placeholder = this.sidebar.querySelector('li.is-placeholder');
                if (placeholder) {
                    placeholder.remove();
                }

                // Select this item
                this.selectBuilderItem(item.dataset.repeaterIndex);
            });
        }

        sortItemsToSidebar() {
            this.sidebar.querySelectorAll(':scope > li').forEach((sbItem) => {
                const item = this.findItemFromIndex(sbItem.dataset.repeaterIndex);
                if (item) {
                    this.itemContainer.appendChild(item);
                }
            });
        }

        sortSidebarToItems() {
            this.itemContainer.querySelectorAll(':scope > .field-repeater-item').forEach((item) => {
                const sidebarItem = this.sidebar.querySelector(
                    ':scope > li[data-repeater-index="' + item.dataset.repeaterIndex + '"]'
                );

                if (sidebarItem) {
                    this.sidebar.appendChild(sidebarItem);
                }
            });
        }

        appendLoadingItem(afterItem) {
            const template = this.element.querySelector(':scope > [data-group-loading-template]'),
                holder = document.createElement('div');

            holder.innerHTML = template.innerHTML.trim();
            const loadingItem = holder.firstElementChild;

            if (afterItem) {
                afterItem.after(loadingItem);
            }
            else {
                this.sidebar.appendChild(loadingItem);
            }
        }

        //
        // Event Overrides
        //

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

            // Hide expand/collapse
            toggleRow('[data-repeater-expand]', false);
            toggleRow('[data-repeater-collapse]', false);
        }

        eventSortableOnEnd() {
            this.sortItemsToSidebar();
        }

        eventOnAddItem() {
            this.appendLoadingItem();
        }

        eventOnDuplicateItem(fromItem) {
            const sidebarItem = this.sidebar.querySelector(
                ':scope > li[data-repeater-index="' + fromItem.dataset.repeaterIndex + '"]'
            );

            this.appendLoadingItem(sidebarItem);
        }

        eventDuplicateOnEnd() {
            this.sortSidebarToItems();
        }

        eventOnErrorAddItem() {
            const placeholder = this.sidebar.querySelector('li.is-placeholder');
            if (placeholder) {
                placeholder.remove();
            }
        }

        eventOnRemoveItem(item) {
            const containerItem = this.findItemFromIndex(item.dataset.repeaterIndex);
            if (containerItem) {
                containerItem.remove();
            }
        }
    }

    jax.registerControl('repeaterbuilder', RepeaterFormWidgetBuilder);
}
