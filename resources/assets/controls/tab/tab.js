/*
 * Tab control
 *
 * Data attributes:
 * - data-control="tab" - enables the tab control on a .control-tabs element
 * - data-linkable - reflects the active tab in the URL hash and opens the
 *   tab matching the hash on page load
 *
 * Tabs marked with the `tab-lazy` class load their pane contents through the
 * anchor's data-tab-lazy-handler on first activation.
 */
'use strict';

export function registerTab(jax) {
    jax.registerControl('tab', class extends jax.ControlBase {
        init() {
            this.nav = this.element.querySelector('ul.nav-tabs');
            this.content = this.element.querySelector('.tab-content');
        }

        connect() {
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

        tabs() {
            return [...this.nav.children].filter((el) => el.matches('li'));
        }

        panes() {
            return [...this.content.children].filter((el) => el.matches('.tab-pane'));
        }

        activate(li) {
            const tabs = this.tabs(),
                index = tabs.indexOf(li);

            if (index === -1) {
                return;
            }

            tabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
            this.panes().forEach((pane, i) => pane.classList.toggle('active', i === index));

            const anchor = li.querySelector('a');

            // Lazy contents load on first activation
            if (li.classList.contains('tab-lazy')) {
                this.loadLazyTab(li, anchor, this.panes()[index]);
            }

            // Reflect the active tab in the URL
            if (this.element.hasAttribute('data-linkable') && anchor && anchor.hash) {
                history.replaceState(null, '', anchor.hash);
            }
        }

        loadLazyTab(li, anchor, pane) {
            const handler = anchor && anchor.dataset.tabLazyHandler;
            if (!handler || !pane) {
                return;
            }

            jax.request(anchor, handler, {
                data: {
                    target: pane.id ? '#' + pane.id : null,
                    name: anchor.dataset.tabName,
                    section: anchor.dataset.tabSection
                },
                success: (data) => {
                    if (pane.id && typeof data['#' + pane.id] === 'string') {
                        pane.innerHTML = data['#' + pane.id];
                    }
                    li.classList.remove('tab-lazy');
                    pane.classList.remove('is-lazy');
                }
            });
        }

        showHashedAnchorTab() {
            const anchor = this.nav.querySelector('a[href="' + CSS.escape(location.hash) + '"], a[name="' + CSS.escape(location.hash.slice(1)) + '"]');
            if (anchor) {
                this.activate(anchor.closest('li'));
            }
        }
    });
}
