/*
 * Form Widget
 *
 * Config:
 * - refreshHandler: null
 * - refreshData: {}
 */
'use strict';

import { LoadIndicator } from '../../controls/load-indicator/load-indicator.js';

export function registerFormWidget(jax) {
    jax.registerControl('formwidget', class extends jax.ControlBase {
        init() {
            // Throttle dependency updating
            this.dependantUpdateInterval = 300;
            this.dependantUpdateTimers = {};

            this.fieldElementCache = null;
            this.disposeCallbacks = [];
        }

        connect() {
            this.form = this.element.closest('form');
            this.options = Object.assign({}, this.config || {});

            this.listen('change', '[data-change-handler]', this.onRefreshChangeField);
            this.listen('tab:shown', 'li.tab-lazy > a', this.showLazyTab);
            this.listen('tab:shown-linkable', 'li.tab-lazy > a', this.showLazyTab);
            this.listen('trigger:after-update', '.field-checkboxlist', this.toggleCheckboxlist);
            this.listen('click', '.field-checkboxlist input[type=checkbox]', this.onClickCheckboxListCheckbox);
            this.listen('click', '.field-checkboxlist.is-cumulative input[type=checkbox]', this.onClickCheckboxListCheckboxCumulative);
            this.listen('trigger:empty', '.field-checkboxlist', this.clearCheckboxlist);

            addEventListener('trigger:complete', this.proxy(this.toggleEmptyTabs));

            this.bindDependents();
            this.bindCheckboxlist();
            this.bindCollapsibleSections();
            this.toggleEmptyTabs();
        }

        disconnect() {
            this.disposeCallbacks.forEach(callback => callback());
            this.disposeCallbacks = [];

            removeEventListener('trigger:complete', this.proxy(this.toggleEmptyTabs));

            Object.values(this.dependantUpdateTimers).forEach((timer) => window.clearTimeout(timer));
            window.clearTimeout(this.toggleEmptyTabsTimer);

            this.form = null;
            this.options = null;
            this.fieldElementCache = null;
        }

        // Logic for checkboxlist
        onClickCheckboxListCheckbox(ev) {
            jax.checkboxRangeRegisterClick(ev, '.form-check', 'input[type=checkbox]');
        }

        onClickCheckboxListCheckboxCumulative(ev) {
            const el = ev.delegateTarget;
            if (el.checked) {
                const childGroup = el.closest('.form-check').nextElementSibling;
                if (childGroup && childGroup.classList && childGroup.classList.contains('checkboxlist-group')) {
                    childGroup.querySelectorAll('input[type=checkbox]').forEach((chk) => {
                        chk.checked = true;
                    });
                }
            }
        }

        toggleCheckboxlist(ev) {
            const field = ev.target.closest('.field-checkboxlist'),
                isDisabled = field.classList.contains('control-disabled');

            field.querySelectorAll('input[type=checkbox]:not([data-option-disabled]), .checkboxlist-controls > .control-button').forEach((el) => {
                el.disabled = isDisabled;
            });
        }

        clearCheckboxlist(ev) {
            this.checkAllCheckboxlist(ev.target, false);
        }

        bindCheckboxlist() {
            this.listen('click', '[data-field-checkboxlist-all]', (event) => {
                const el = event.delegateTarget;
                if (el.disabled || el.readOnly) {
                    return;
                }

                this.checkAllCheckboxlist(el.closest('.field-checkboxlist'), true);
            });

            this.listen('click', '[data-field-checkboxlist-none]', (event) => {
                const el = event.delegateTarget;
                if (el.disabled || el.readOnly) {
                    return;
                }

                this.checkAllCheckboxlist(el.closest('.field-checkboxlist'), false);
            });

            this.element.querySelectorAll('.field-checkboxlist').forEach((el) => {
                el.querySelectorAll('input[type=checkbox][disabled]').forEach((checkbox) => {
                    checkbox.dataset.optionDisabled = '';
                });

                this.toggleCheckboxlist({ target: el });
            });
        }

        checkAllCheckboxlist(field, flag) {
            const checkboxes = field.querySelectorAll('input[type=checkbox]:not([data-option-disabled])');

            checkboxes.forEach((checkbox) => {
                checkbox.checked = flag;
            });

            if (checkboxes.length) {
                checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Get all fields elements that belong to this form, nested form
        // fields are removed from this collection.
        getFieldElements() {
            if (this.fieldElementCache !== null) {
                return this.fieldElementCache;
            }

            return this.fieldElementCache = [...this.element.querySelectorAll('[data-field-name]')]
                .filter((el) => el.parentElement.closest('[data-control="formwidget"]') === this.element);
        }

        // Bind dependant fields
        bindDependents() {
            if (!this.element.querySelector('[data-field-depends]')) {
                return;
            }

            const fieldMap = {},
                fieldElements = this.getFieldElements();

            // Map master and slave fields
            fieldElements.filter((el) => el.hasAttribute('data-field-depends')).forEach((element) => {
                const name = element.dataset.fieldName,
                    depends = jax.parseJSON(element.dataset.fieldDepends);

                depends.forEach((depend) => {
                    if (!fieldMap[depend]) {
                        fieldMap[depend] = { fields: [] };
                    }

                    fieldMap[depend].fields.push(name);
                });
            });

            // When a master is updated, refresh its slaves
            Object.entries(fieldMap).forEach(([fieldName, toRefresh]) => {
                const onChange = () => this.onRefreshDependents(fieldName, toRefresh),
                    masters = fieldElements.filter((el) => el.dataset.fieldName === fieldName);

                masters.forEach((el) => el.addEventListener('change', onChange));

                // Set up disposal
                this.disposeCallbacks.push(() => {
                    masters.forEach((el) => el.removeEventListener('change', onChange));
                });
            });
        }

        // Refresh a dependency field
        // Uses a throttle to prevent duplicate calls and click spamming
        onRefreshDependents(fieldName, toRefresh) {
            const fieldElements = this.getFieldElements();

            if (this.dependantUpdateTimers[fieldName] !== undefined) {
                window.clearTimeout(this.dependantUpdateTimers[fieldName]);
            }

            this.dependantUpdateTimers[fieldName] = window.setTimeout(() => {
                const refreshData = Object.assign({},
                    toRefresh,
                    paramToObj('data-refresh-data', this.options.refreshData)
                );

                jax.request(this.form || this.element, this.options.refreshHandler, {
                    data: refreshData
                }).done(() => {
                    this.toggleEmptyTabs();

                    // Refresh field element cache and trigger change only on fields in this form
                    this.fieldElementCache = null;
                    const updatedFieldElements = this.getFieldElements();
                    toRefresh.fields.forEach((field) => {
                        updatedFieldElements
                            .filter((el) => el.dataset.fieldName === field)
                            .forEach((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
                    });
                });
            }, this.dependantUpdateInterval);

            toRefresh.fields.forEach((field) => {
                fieldElements
                    .filter((el) => el.dataset.fieldName === field && isVisible(el))
                    .forEach((el) => {
                        el.classList.add('loading-indicator-container', 'size-form-field');
                        LoadIndicator.show(el);
                    });
            });
        }

        // Calls an AJAX handler when the field updates.
        onRefreshChangeField(ev) {
            if (!this.isCurrentFormContext(ev.target)) {
                return;
            }

            const group = ev.target.closest('[data-change-handler]'),
                handler = group.dataset.changeHandler;

            // Debounce needed because select2 triggers change twice (vanilla + jquery)
            if (this.dependantUpdateTimers[handler] !== undefined) {
                window.clearTimeout(this.dependantUpdateTimers[handler]);
            }

            this.dependantUpdateTimers[handler] = window.setTimeout(() => {
                const refreshData = paramToObj('data-refresh-data', this.options.refreshData);
                jax.request(group, handler, {
                    data: refreshData
                }).done(() => {
                    this.toggleEmptyTabs();
                });
            }, this.dependantUpdateInterval);
        }

        isCurrentFormContext(el) {
            return el.closest('[data-control="formwidget"]') === this.element;
        }

        // Hides tabs that have no content, it is possible this can be
        // called multiple times in a single cycle due to input.trigger.
        toggleEmptyTabs() {
            if (this.toggleEmptyTabsTimer !== undefined) {
                window.clearTimeout(this.toggleEmptyTabsTimer);
            }

            this.toggleEmptyTabsTimer = window.setTimeout(() => {
                this.element.querySelectorAll('[data-control~="tab"]').forEach((tabControl) => {
                    const tabContainer = tabControl.querySelector('.nav-tabs');
                    if (!tabContainer) {
                        return;
                    }

                    // Check each tab pane for form field groups, locate first level form groups only
                    tabControl.querySelectorAll('.tab-pane:not(.is-lazy):not(.nohide)').forEach((pane) => {
                        const hasControls = !!pane.querySelector(':scope > .form-group:not(:empty):not(.oc-hide), :scope > .row > .form-group:not(:empty):not(.oc-hide)');

                        tabControl.querySelectorAll('[data-target="#' + CSS.escape(pane.id) + '"]').forEach((anchor) => {
                            const li = anchor.closest('li');
                            if (li) {
                                li.style.display = hasControls ? '' : 'none';
                            }
                        });
                    });

                    // If a hidden tab was selected, select the first visible tab
                    const tabs = [...tabContainer.children].filter((el) => el.matches('li')),
                        isShown = (li) => li.style.display !== 'none';

                    if (!tabs.some((li) => li.classList.contains('active') && isShown(li))) {
                        const firstVisible = tabs.find(isShown),
                            tab = jax.fetchControl(tabControl, 'tab');

                        if (firstVisible && tab) {
                            tab.goToIndex(tabs.indexOf(firstVisible));
                        }
                    }
                });
            }, 1);
        }

        // Render tab form fields once a lazy tab is selected.
        showLazyTab(ev) {
            const el = ev.delegateTarget,
                handlerName = el.dataset.tabLazyHandler;

            // Nested forms handle their own lazy tabs
            if (!this.isCurrentFormContext(el)) {
                return;
            }

            jax.request(el, handlerName, {
                data: {
                    target: el.dataset.target,
                    name: el.dataset.tabName,
                    section: el.dataset.tabSection
                },
                success: function(data) {
                    this.success(data);
                    el.parentElement.classList.remove('tab-lazy');

                    // Trigger all input presets to populate new fields.
                    setTimeout(function() {
                        document.querySelectorAll('[data-input-preset]').forEach((input) => {
                            const preset = jax.InputPreset && jax.InputPreset.getInstance(input);
                            if (preset && preset.src) {
                                preset.src.dispatchEvent(new Event('input'));
                            }
                        });
                    }, 0);
                }
            });
        }

        // Makes sections collapsible by targeting every field after
        // up until the next section
        bindCollapsibleSections() {
            this.element.querySelectorAll('.section-field[data-field-collapsible]').forEach((section) => {
                if (!this.isCurrentFormContext(section)) {
                    return;
                }

                section.classList.add('collapsed');

                const fieldSection = section.querySelector('.field-section');
                if (fieldSection) {
                    fieldSection.classList.add('is-collapsible');
                }

                const onClick = () => {
                    section.classList.toggle('collapsed');
                    nextUntil(section, '.section-field').forEach((el) => {
                        el.style.display = el.style.display === 'none' ? '' : 'none';
                    });
                };

                section.addEventListener('click', onClick);
                this.disposeCallbacks.push(() => section.removeEventListener('click', onClick));

                nextUntil(section, '.section-field').forEach((el) => {
                    el.style.display = 'none';
                });
            });
        }
    });

    // FORM WIDGET INTERNALS
    // ==============

    function paramToObj(name, value) {
        if (value === undefined || value === null) value = '';
        if (typeof value == 'object') return value;

        try {
            return jax.parseJSON("{" + value + "}");
        }
        catch (e) {
            throw new Error('Error parsing the '+name+' attribute value. '+e);
        }
    }

    function nextUntil(element, selector) {
        const siblings = [];
        let next = element.nextElementSibling;

        while (next && !next.matches(selector)) {
            siblings.push(next);
            next = next.nextElementSibling;
        }

        return siblings;
    }

    function isVisible(element) {
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    }
}
