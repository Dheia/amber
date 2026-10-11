/*
 * Row Link control
 *
 * Links an entire table row by finding the first anchor in each row.
 *
 * Data attributes:
 * - data-control="rowlink" - enables the plugin on a table element
 *
 * Config:
 * - target - the anchor selector to use for linking (default: 'a')
 * - excludeClass - disables the link for elements with this class (default: 'nolink')
 * - linkedClass - this class is added to affected table rows (default: 'rowlink')
 */
'use strict';

import { Popup } from '../popup/popup.js';

export function registerRowlink(jax) {
    jax.registerControl('rowlink', class extends jax.ControlBase {
        connect() {
            this.target = this.config.target || 'a';
            this.excludeClass = this.config.excludeClass || 'nolink';
            this.linkedClass = this.config.linkedClass || 'rowlink';
            this.rows = [];

            const rows = this.element.tagName === 'TR'
                ? [this.element]
                : Array.from(this.element.querySelectorAll('tr')).filter((row) => row.querySelector('td'));

            rows.forEach((row) => this.linkRow(row));

            // Add keyboard navigation to list rows
            this.rows.forEach((row) => {
                row.setAttribute('tabindex', 0);
            });
        }

        disconnect() {
            this.rows = null;
        }

        // Wires up a single row when it contains an eligible anchor.
        linkRow(row) {
            if (row.classList.contains(this.excludeClass)) {
                return;
            }

            const link = Array.from(row.querySelectorAll(this.target)).find((anchor) => {
                const cell = anchor.closest('td');
                return !(cell && cell.classList.contains(this.excludeClass)) &&
                    !anchor.classList.contains(this.excludeClass);
            });

            if (!link) {
                return;
            }

            const href = link.getAttribute('href');
            const onclick = typeof link.onclick === 'function' ? link.onclick : null;
            const isPopup = link.matches('[data-control=popup]');
            const isRequest = link.hasAttribute('data-request');

            // Guards against a nested nolink element re-triggering the row link.
            const state = { skipNextBubble: false };
            const exclude = this.excludeClass;

            // Resolves the linkable cell the event originated in, or null when excluded.
            const activeCell = (ev) => {
                const cell = ev.target.closest('td');
                return cell && !cell.classList.contains(exclude) && row.contains(cell) ? cell : null;
            };

            const handleClick = (ev) => {
                if (state.skipNextBubble) {
                    state.skipNextBubble = false;
                    return;
                }

                if (document.body.classList.contains('drag')) {
                    return;
                }

                if (onclick) {
                    onclick.apply(link);
                }
                else if (isRequest) {
                    jax.request(link);
                }
                else if (isPopup) {
                    Popup.fromElement(link);
                }
                else if (ev.ctrlKey || ev.metaKey) {
                    window.open(href);
                }
                else {
                    jax.visit(href);
                }
            };

            this.listen('click', row, (ev) => {
                // Mirrors the "td:not(.nolink) > .nolink" delegated guard.
                const excluded = ev.target.closest('.' + exclude);
                if (excluded &&
                    excluded.parentElement &&
                    excluded.parentElement.matches('td:not(.' + exclude + ')') &&
                    row.contains(excluded)
                ) {
                    state.skipNextBubble = true;
                }
            });

            this.listen('click', row, (ev) => {
                // Delegation guard: only clicks inside a linkable cell activate the row.
                if (activeCell(ev)) {
                    handleClick(ev);
                }
            });

            this.listen('mousedown', row, (ev) => {
                if (ev.button === 1 && activeCell(ev)) {
                    window.open(href);
                }
            });

            this.listen('keypress', row, (ev) => {
                if (ev.key === ' ' || ev.key === 'Spacebar') {
                    handleClick(ev);
                    ev.preventDefault();
                    ev.stopPropagation();
                }
            });

            row.classList.add(this.linkedClass);
            this.rows.push(row);

            // Reveal the link contents in place (order preserved), then hide the redundant anchor.
            const contents = document.createDocumentFragment();
            while (link.firstChild) {
                contents.appendChild(link.firstChild);
            }
            link.parentNode.insertBefore(contents, link.nextSibling);
            link.style.display = 'none';
        }
    });
}
