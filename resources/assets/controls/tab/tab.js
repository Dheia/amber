/*
 * Tab control
 *
 * Data attributes:
 * - data-control="tab" - enables the tab control on a .control-tabs element
 * - data-linkable - reflects the active tab in the URL hash and opens the
 *   tab matching the hash on page load
 *
 * Events:
 * - tab:shown - dispatched on a tab anchor after its tab is shown
 * - tab:shown-linkable - dispatched on the tab anchor opened from the URL hash
 *
 * JavaScript API:
 * jax.fetchControl(element, 'tab').goToIndex(index)
 * jax.fetchControl(element, 'tab').goToElement(element) - shows the tab containing the element
 *
 * The first invalid field of a failed AJAX validation has its tab shown and is focused.
 */
'use strict';

export function registerTab(jax) {
    jax.registerControl('tab', class extends jax.ControlBase {
        init() {
            this.invalidElement = false;
        }

        connect() {
            this.nav = this.element.querySelector('ul.nav-tabs');
            this.content = this.element.querySelector('.tab-content');

            if (!this.nav || !this.content) {
                return;
            }

            this.tabs().forEach((li) => this.initTab(li));

            this.listen('click', this.onClick);

            if (this.element.hasAttribute('data-linkable') && location.hash) {
                this.showHashedAnchorTab();
            }
        }

        disconnect() {
            this.nav = null;
            this.content = null;
        }

        onClick(ev) {
            const anchor = ev.target.closest('.nav-tabs a');
            if (!anchor) {
                return;
            }

            // Nested tab controls handle their own navs
            if (anchor.closest('[data-control="tab"]') !== this.element) {
                return;
            }

            ev.preventDefault();
            this.activate(anchor.closest('li'));
        }

        initTab(li) {
            const tabIndex = this.tabs().indexOf(li),
                anchor = li.querySelector('a'),
                pane = this.panes()[tabIndex];

            if (!anchor || !pane) {
                return;
            }

            // Auto generate the tab pane identifier
            if (!pane.id) {
                pane.id = 'tab-' + tabIndex + '-' + Date.now();
            }

            anchor.dataset.target = '#' + pane.id;
        }

        tabs() {
            return [...this.nav.children].filter((el) => el.matches('li'));
        }

        panes() {
            return [...this.content.children].filter((el) => el.matches('.tab-pane'));
        }

        activate(li) {
            const tabs = this.tabs(),
                index = tabs.indexOf(li);

            if (index === -1 || li.classList.contains('active')) {
                return;
            }

            tabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
            this.panes().forEach((pane, i) => pane.classList.toggle('active', i === index));

            const anchor = li.querySelector('a');
            if (!anchor) {
                return;
            }

            jax.Events.dispatch('tab:shown', { target: anchor });

            // Reflect the active tab in the URL
            if (this.element.hasAttribute('data-linkable') && anchor.hash && !this.invalidElement) {
                history.replaceState(null, '', anchor.hash);
            }
        }

        showHashedAnchorTab() {
            const anchor = this.nav.querySelector('a[href="' + CSS.escape(location.hash) + '"], a[name="' + CSS.escape(location.hash.slice(1)) + '"]');
            if (!anchor) {
                return;
            }

            this.activate(anchor.closest('li'));

            // Next tick
            setTimeout(() => {
                jax.Events.dispatch('tab:shown-linkable', { target: anchor });
            }, 1);
        }

        goToIndex(index) {
            const li = this.tabs()[index];
            if (li) {
                this.activate(li);
            }
        }

        goToPane(pane) {
            if (!pane) {
                return false;
            }

            pane.classList.remove('collapsed');

            const tabIndex = this.panes().indexOf(pane);
            if (tabIndex === -1) {
                return false;
            }

            this.goToIndex(tabIndex);

            return true;
        }

        goToInvalidElement(element) {
            this.invalidElement = true;
            const result = this.goToPane(element.closest('.tab-pane'));
            this.invalidElement = false;
            return result;
        }

        goToElement(element) {
            return this.goToPane(element.closest('.tab-pane'));
        }
    });

    // GLOBAL EVENTS
    // ============================

    // Detect invalid fields, focus the tab
    addEventListener('ajax:invalid-field', function(ev) {
        const { element, isFirst } = ev.detail || {};
        if (!isFirst || !element) {
            return;
        }

        ev.preventDefault();

        const tabElement = element.closest('[data-control~="tab"]'),
            tab = tabElement ? jax.fetchControl(tabElement, 'tab') : null;

        if (tab) {
            tab.goToInvalidElement(element);
        }

        element.focus();
    });
}
