/*
 * Relation quick create control
 *
 * Opens a popup form when the "Create New" option of a relation dropdown is
 * picked, keeping the previous selection until the new record is created.
 *
 * Data attributes:
 * - data-control="relation-quick-create" - enables the control
 * - data-handler-load - AJAX handler that renders the quick create form
 * - data-quick-create-value - value of the "Create New" option (default __quick_create__)
 * - data-popup-size - size of the quick create popup
 * - data-quick-created - set after a record is created, notifies dependent fields
 *
 * Ported from October CMS (relation-quick-create.js) as vanilla JS.
 */
'use strict';

import { Popup } from '../../controls/popup/popup.js';

export function registerRelationQuickCreate(jax) {
    jax.registerControl('relation-quick-create', class extends jax.ControlBase {
        init() {
            this.config = Object.assign({
                handlerLoad: null,
                quickCreateValue: '__quick_create__',
                popupSize: null,
                quickCreated: false
            }, this.config);
            this.previousValue = null;
        }

        connect() {
            this.select = this.element.querySelector('select');
            this.previousValue = this.select.value;

            // Never revert to the sentinel value if it was selected by default
            if (this.previousValue === this.config.quickCreateValue) {
                this.previousValue = '';
            }

            this.listen('change', 'select', this.onSelectChange);

            // Notify dependent fields after a record is quick created
            if (this.config.quickCreated) {
                this.element.removeAttribute('data-quick-created');
                this.select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        disconnect() {
            this.select = null;
        }

        onSelectChange() {
            var value = this.select.value;
            if (value !== this.config.quickCreateValue) {
                this.previousValue = value;
                return;
            }

            // Revert dropdown to previous value
            this.select.value = this.previousValue;
            this.refreshCustomSelect();

            // Open popup
            Popup.fromElement(this.element, {
                handler: this.config.handlerLoad,
                size: this.config.popupSize || undefined,
                extraData: { _relation_quick_create: 1 }
            });
        }

        // Updates the Select2 display without firing change, like October's change.select2 trigger
        refreshCustomSelect() {
            var customSelect = jax.fetchControl(this.select, 'custom-select');
            if (customSelect && customSelect.$el) {
                customSelect.$el.trigger('change.select2');
            }
        }
    });
}
