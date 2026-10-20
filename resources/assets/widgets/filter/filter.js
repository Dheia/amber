/*
 * Filter widget control
 *
 * Data attributes:
 * - data-control="filterwidget" - enables the filter widget
 * - data-update-handler - AJAX handler for scope updates
 * - data-load-handler - AJAX handler for popover form contents
 * - data-page-name - page parameter to reset when a filter is applied
 *
 * JavaScript API:
 * jax.fetchControl(element, 'filterwidget')
 *
 * Covers the built-in scope types (checkbox, switch, dropdown) and the popover
 * scope types backed by filter widgets (text, number, date, group).
 */
'use strict';

import { Popover } from '../../controls/popover/popover.js';
import DragScroll from '../../controls/drag-scroll/drag-scroll.js';

export function registerFilterWidget(jax) {
    jax.registerControl('filterwidget', class extends jax.ControlBase {
        init() {
            this.config = Object.assign({
                updateHandler: null,
                loadHandler: null,
                pageName: null
            }, this.config);

            this.popover = null;
            this.activeScope = null;
        }

        connect() {
            this.listen('change', this.onChange);
            this.listen('click', this.onClick);
            this.listen('ajax:update', this.onContainerUpdate);

            this.bindScrollable();
            this.bindCheckboxes();
        }

        disconnect() {
            this.closePopover();
            this.unbindScrollable();
        }

        bindScrollable() {
            this.scrollable = this.element.querySelector('.filter-scopes');
            if (this.scrollable) {
                this.dragScroll = new DragScroll(this.scrollable, {
                    scrollClassContainer: this.scrollable.parentNode
                });
            }
        }

        unbindScrollable() {
            if (this.dragScroll) {
                this.dragScroll.dispose();
            }

            this.dragScroll = null;
            this.scrollable = null;
        }

        onContainerUpdate(ev) {
            // Rebind the scrollable area when the entire container is replaced
            if (ev.target === this.element) {
                this.unbindScrollable();
                this.bindScrollable();
            }
        }

        onChange(ev) {
            const el = ev.target,
                scope = el.closest('.filter-scope');

            if (!scope || this.popover?.element?.contains(el)) {
                return;
            }

            // Dropdown scope
            if (el.matches('select')) {
                this.submitUpdate(scope, { value: el.value });
                return;
            }

            // Checkbox and switch scopes
            if (el.matches('input[type="checkbox"]')) {
                if (scope.classList.contains('is-indeterminate')) {
                    this.switchToggle(el, scope);
                }
                else {
                    this.checkboxToggle(el, scope);
                }
            }
        }

        onClick(ev) {
            // Popover scope trigger
            const scopeLink = ev.target.closest('a.filter-scope');
            if (scopeLink && this.element.contains(scopeLink)) {
                ev.preventDefault();
                this.openPopover(scopeLink);
            }
        }

        // Bound on the popover element directly since it is attached to the body,
        // outside this widget's own click delegation.
        onPopoverClick(ev) {
            const actionEl = ev.target.closest('[data-filter-action]');
            if (!actionEl || !this.popover) {
                return;
            }

            ev.preventDefault();

            if (actionEl.dataset.filterAction === 'apply') {
                this.submitUpdate(this.activeScope, jax.values(this.popover.element.querySelector('form')));
            }
            else {
                this.submitUpdate(this.activeScope, { clearScope: true });
            }

            this.closePopover();
        }

        //
        // Popover scopes
        //

        openPopover(scopeLink) {
            // Second click closes the scope
            if (this.activeScope === scopeLink) {
                this.closePopover();
                return;
            }

            this.closePopover();
            this.activeScope = scopeLink;
            scopeLink.classList.add('popover-highlight');

            const scopeName = scopeLink.dataset.scopeName;

            const popover = new Popover(scopeLink, {
                extraClass: 'filter-popover',
                content: '<form data-request-parent-form>'
                    + '<input type="hidden" name="scopeName" value="" />'
                    + '<div class="filter-popover-content control-filter-popover"><span class="control-popover-loading"></span></div>'
                    + '</form>',
                onCheckDocumentClickTarget: (target) => this.onCheckDocumentClickTargetDatePicker(target),
                onClose: () => {
                    scopeLink.classList.remove('popover-highlight');
                    if (this.activeScope === scopeLink) {
                        this.activeScope = null;
                    }
                    if (this.popover === popover) {
                        this.popover = null;
                    }
                }
            });

            this.popover = popover;
            popover.show();
            popover.element.addEventListener('click', (ev) => this.onPopoverClick(ev));
            popover.element.querySelector('[name="scopeName"]').value = scopeName;

            // Load form contents
            jax.request(popover.element.querySelector('form'), this.config.loadHandler, {
                success: (data) => {
                    if (popover.element && typeof data.result === 'string') {
                        popover.element.querySelector('.filter-popover-content').innerHTML = data.result;
                        this.bindPopoverContent();
                    }
                }
            });
        }

        // If the click happens on a pikaday element, do not close the popover
        onCheckDocumentClickTargetDatePicker(target) {
            if (!target.classList) {
                return false;
            }

            return target.classList.contains('pika-next') ||
                target.classList.contains('pika-prev') ||
                target.classList.contains('pika-select') ||
                target.classList.contains('pika-button') ||
                !!target.closest('.pika-table') ||
                !!target.closest('.pika-title');
        }

        closePopover() {
            if (this.popover) {
                this.popover.hide();
                this.popover = null;
            }

            if (this.activeScope) {
                this.activeScope.classList.remove('popover-highlight');
                this.activeScope = null;
            }
        }

        // bindPopoverContent wires the popover form behavior: condition-based
        // visibility, native date mirrors and group option loading.
        bindPopoverContent() {
            const root = this.popover.element;

            // Condition select show/hide (data-trigger)
            const conditionSelect = root.querySelector('select[name="Filter[condition]"]');
            if (conditionSelect) {
                const applyTriggers = () => {
                    root.querySelectorAll('[data-trigger-condition]').forEach((el) => {
                        const match = /value\[(.+)\]/.exec(el.dataset.triggerCondition);
                        if (!match) {
                            return;
                        }
                        const isMatch = conditionSelect.value === match[1],
                            show = el.dataset.triggerAction === 'show';
                        el.style.display = (isMatch === show) ? '' : 'none';
                    });
                };
                conditionSelect.addEventListener('change', applyTriggers);
                applyTriggers();
            }

            // Group filter option management
            const group = root.querySelector('[data-control="groupfilter"]');
            if (group) {
                this.bindGroupFilter(group);
            }
        }

        bindGroupFilter(group) {
            const locker = group.querySelector('[data-groupfilter-datalocker]'),
                availableList = group.querySelector('[data-groupfilter-available]'),
                activeList = group.querySelector('[data-groupfilter-active]'),
                handler = group.dataset.optionsHandler;

            const activeIds = () => {
                try { return JSON.parse(locker.value) || []; }
                catch (e) { return []; }
            };

            const saveIds = (ids) => {
                locker.value = JSON.stringify(ids);
            };

            const renderItem = (list, option, isActive) => {
                const li = document.createElement('li');
                li.dataset.itemId = option.id;
                li.className = isActive ? 'is-active' : '';
                li.innerHTML = '<a href="javascript:;"></a>';
                const iconClass = isActive ? group.dataset.removeIcon : group.dataset.addIcon;
                if (iconClass) {
                    const icon = document.createElement('i');
                    icon.className = iconClass;
                    icon.setAttribute('aria-hidden', 'true');
                    li.firstChild.appendChild(icon);
                }
                li.firstChild.appendChild(document.createTextNode(option.name));
                li.addEventListener('click', () => {
                    const ids = activeIds(),
                        index = ids.indexOf(option.id);

                    if (index > -1) {
                        ids.splice(index, 1);
                    }
                    else {
                        ids.push(option.id);
                    }

                    saveIds(ids);
                    li.remove();
                    renderItem(index > -1 ? availableList : activeList, option, index === -1);
                });
                list.appendChild(li);
            };

            const renderOptions = (options) => {
                availableList.innerHTML = '';
                activeList.innerHTML = '';
                (options.active || []).forEach((option) => renderItem(activeList, option, true));
                (options.available || []).forEach((option) => {
                    if (!activeIds().includes(option.id)) {
                        renderItem(availableList, option, false);
                    }
                });
            };

            // Expose for the search input's AJAX response
            group.addEventListener('ajax:done', (ev) => {
                const data = ev.detail && ev.detail.data;
                if (data && data.options) {
                    renderOptions(data.options);
                }
            });

            // Initial load
            jax.request(group, handler, {
                success: (data) => {
                    if (data.options) {
                        renderOptions(data.options);
                    }
                }
            });
        }

        //
        // Checkboxes
        //

        bindCheckboxes() {
            this.element.querySelectorAll('.filter-scope input[type="checkbox"]').forEach((el) => {
                const scope = el.closest('.filter-scope');

                if (scope.classList.contains('is-indeterminate')) {
                    scope.classList.toggle('active', !!this.getSwitchValue(el));
                }
                else {
                    scope.classList.toggle('active', el.checked);
                }
            });
        }

        checkboxToggle(el, scope) {
            this.submitUpdate(scope, { value: el.checked });

            scope.classList.toggle('active', el.checked);
        }

        // Switch value is the checkbox control state, already advanced by its click
        // handler: 0 = unfiltered (unchecked), 1 = first condition (indeterminate),
        // 2 = second condition (checked)
        switchToggle(el, scope) {
            const switchValue = this.getSwitchValue(el);

            this.submitUpdate(scope, { value: switchValue });

            scope.classList.toggle('active', !!switchValue);
        }

        getSwitchValue(el) {
            return parseInt(el.dataset.checked) || 0;
        }

        //
        // AJAX
        //

        submitUpdate(scope, data) {
            if (!this.config.updateHandler || !scope) {
                return;
            }

            data = data || {};
            data.scopeName = scope.dataset.scopeName;

            this.element.classList.add('is-loading');

            const submitData = { data: data };

            // Reset the shared page parameter when a filter is applied
            if (this.config.pageName) {
                submitData.query = { [this.config.pageName]: null };
            }

            jax.request(this.element, this.config.updateHandler, submitData)
                .always(() => {
                    this.element.classList.remove('is-loading');
                });
        }
    });
}
