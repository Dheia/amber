/*
 * List widget control
 *
 * Data attributes:
 * - data-control="listwidget" - enables the list widget
 *
 * JavaScript API:
 * jax.fetchControl(element, 'listwidget')
 * jax.listOnLoadForm(recordId, context) - opens the onLoadPopupForm handler in a popup,
 *   used by the recordOnClick "popup" shorthand
 *
 * Ported from October CMS (october.list.js) as vanilla JS. Not yet ported:
 * drag-scrollable headers (native horizontal scrolling applies instead).
 */
'use strict';

import { Popup } from '../../controls/popup/popup.js';

export function registerListWidget(jax) {
    // List helper, opens a record form in a popup from the controller's onLoadPopupForm handler
    jax.listOnLoadForm = function(recordId, context) {
        Popup.open({
            handler: 'onLoadPopupForm',
            extraData: {
                form_record_id: recordId,
                form_context: context || null
            }
        });
    };

    jax.registerControl('listwidget', class extends jax.ControlBase {
        init() {
            this.checkboxSelector = '.list-checkbox input[type="checkbox"]';
            this.head = this.element.querySelector('thead');
            this.body = this.element.querySelector('tbody');
        }

        connect() {
            this.listen('change', this.onChangeCheckbox);
            this.listen('click', this.onClickCheckbox);
            this.listen('ajax:setup', this.onAjaxSetup);

            this.updateUi();
            this.notifyCheckedState();
        }

        disconnect() {
            this.head = null;
            this.body = null;
        }

        // Shift-click selects the range between the previously clicked
        // checkbox and this one
        onClickCheckbox(ev) {
            const el = ev.target;
            if (!el.matches('input[type="checkbox"]') || !el.closest('.list-checkbox') || !this.body.contains(el)) {
                return;
            }

            jax.checkboxRangeRegisterClick(ev, 'tr', this.checkboxSelector);
        }

        // Checkbox helpers

        bodyCheckboxes() {
            return [...this.body.querySelectorAll(this.checkboxSelector)];
        }

        headCheckbox() {
            return this.head.querySelector(this.checkboxSelector);
        }

        updateUi() {
            this.bodyCheckboxes().forEach((el) => {
                el.closest('tr').classList.toggle('active', el.checked);
            });

            this.checkIndeterminate();
        }

        checkIndeterminate() {
            const all = this.bodyCheckboxes(),
                headCb = this.headCheckbox(),
                checkedCount = all.filter((el) => el.checked).length;

            if (!headCb) {
                return;
            }

            headCb.indeterminate = checkedCount > 0 && checkedCount !== all.length;
            headCb.checked = checkedCount > 0;
        }

        onChangeCheckbox(ev) {
            const el = ev.target;
            if (!el.matches('input[type="checkbox"]') || !el.closest('.list-checkbox')) {
                return;
            }

            // Head checkbox toggles everything
            if (this.head.contains(el)) {
                this.bodyCheckboxes().forEach((cb) => {
                    cb.checked = el.checked;
                    cb.closest('tr').classList.toggle('active', el.checked);
                });
                this.checkIndeterminate();
                this.notifyCheckedState();
                return;
            }

            // Body checkbox toggles its row
            el.closest('tr').classList.toggle('active', el.checked);

            if (!el.checked) {
                const headCb = this.headCheckbox();
                if (headCb) {
                    headCb.checked = false;
                }
            }

            this.checkIndeterminate();
            this.notifyCheckedState();
        }

        // notifyCheckedState updates buttons linked to this list through
        // a [data-list-linkage] container: [data-list-checked-trigger] buttons
        // enable when rows are checked, and an optional [data-list-checked-counter]
        // span displays the count
        notifyCheckedState() {
            const listWidget = this.element.closest('.list-widget');
            if (!listWidget || !listWidget.id) {
                return;
            }

            const checkedCount = this.getChecked().length;

            document.querySelectorAll('[data-list-linkage="' + listWidget.id + '"] [data-list-checked-trigger], [data-list-linkage="' + listWidget.id + '"][data-list-checked-trigger]').forEach((button) => {
                button.disabled = checkedCount === 0;

                const counter = button.querySelector('[data-list-checked-counter]');
                if (counter) {
                    counter.textContent = checkedCount ? '(' + checkedCount + ')' : '';
                }
            });
        }

        // Checked value collection

        getChecked() {
            return this.bodyCheckboxes()
                .filter((el) => el.checked)
                .map((el) => el.value);
        }

        getUnchecked() {
            return this.bodyCheckboxes()
                .filter((el) => !el.checked)
                .map((el) => el.value);
        }

        getCheckedFromLocker() {
            try {
                const lockerEl = this.element.querySelector('[data-list-datalocker-checked]'),
                    locker = JSON.parse(lockerEl.value);

                this.getUnchecked().forEach((value) => {
                    const index = locker.indexOf(value);
                    if (index > -1) {
                        locker.splice(index, 1);
                    }
                });

                return locker;
            }
            catch (err) {
                return [];
            }
        }

        getAllChecked() {
            return this.getChecked().concat(this.getCheckedFromLocker());
        }

        toggleChecked(el) {
            const checkbox = el.closest('tr').querySelector(this.checkboxSelector);
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // AJAX integration: include checked state with requests inside the list

        onAjaxSetup(ev) {
            const context = ev.detail && ev.detail.context;
            if (context && context.options && context.options.data) {
                context.options.data.allChecked = this.getAllChecked();
            }
        }
    });

    /*
     * Checked-request buttons: AJAX requests fired from a [data-list-checked-request]
     * button inside a [data-list-linkage] container include the checked row ids of
     * the linked list widget
     */
    addEventListener('ajax:setup', function(ev) {
        const button = ev.target.closest('[data-list-checked-request]');
        if (!button) {
            return;
        }

        const linkage = button.closest('[data-list-linkage]');
        if (!linkage) {
            return;
        }

        const listWidget = document.getElementById(linkage.dataset.listLinkage);
        if (!listWidget) {
            return;
        }

        const control = jax.fetchControl(listWidget.querySelector('[data-control="listwidget"]'), 'listwidget');
        const context = ev.detail && ev.detail.context;

        if (control && context && context.options && context.options.data) {
            context.options.data.checked = control.getChecked();
        }
    });

    /*
     * Page chooser: submits the "Go to page" form via AJAX
     */
    addEventListener('submit', function(ev) {
        const form = ev.target.closest('form[data-list-page-chooser]');
        if (!form) {
            return;
        }

        ev.preventDefault();

        const chooser = document.getElementById(form.dataset.chooserId),
            input = form.querySelector('input[data-chooser-input]'),
            handler = form.dataset.handler,
            pageName = input.name,
            pageNumber = input.value,
            transportMethod = pageName === '_page' ? 'data' : 'query';

        jax.request(chooser || form, handler, {
            [transportMethod]: { [pageName]: pageNumber }
        });
    });
}
